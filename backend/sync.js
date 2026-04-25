const { mysql: db, getMssql } = require('./db');

// ── State ────────────────────────────────────────────────────────
const state = {
  timer:          null,
  running:        false,
  jobRunning:     false,
  intervalSeconds: 15,
  lastRun:        null,
  lastSynced:     0,      // jumlah row yang di-sync pada run terakhir
  totalSynced:    0,      // akumulasi sejak server start
  lastPkey:       0,      // PKEY terakhir yang sudah masuk ke MySQL
  error:          null,
};

// ── Cache UP3 supaya tidak query DB tiap baris ─────────────────────
// key: "GI:<gi_name>" atau "KP:<feeder_murni>"  →  APJ_ID | null
const up3Cache = new Map();

// ── Parse DESC ─────────────────────────────────────────────────────
//
// Format GI Pickup :  GI-<GI>.<SUMBER_FEEDER>.<INDIKASI>.<RELAY>.<PHASE>.<KESIMPULAN>
// Format KP Pickup :  Feeder_<FEEDER_MURNI>.<KEYPOINT>.<INDIKASI>.<RELAY>.<PHASE>.<KESIMPULAN>
//
// Separator: titik (.)  — sesuai data SQL Server asli
// Mengembalikan object parsed atau null bila bukan GI/KP Pickup
//
function parseDesc(desc) {
  if (!desc || typeof desc !== 'string') return null;

  const parts = desc.split('.').map(s => s.trim());
  if (parts.length < 3) return null;

  const first      = parts[0];
  const kesimpulan = parts[parts.length - 1];   // App / Dis / Ready / NotReady …

  const out = {
    JENIS:        null,
    GI:           null,
    SUMBER_FEEDER: null,
    FEEDER_MURNI: null,
    KEYPOINT:     null,
    INDIKASI:     null,
    RELAY:        null,
    PHASE:        null,
    KESIMPULAN:   kesimpulan || null,
    POINT_KEY:    null,
  };

  if (first.startsWith('GI-')) {
    // ── GI Pickup ──────────────────────────────────────────────
    out.JENIS         = 'PICKUP GI';
    out.GI            = first.slice(3).trim() || null;  // strip "GI-"
    out.SUMBER_FEEDER = parts[1] || null;
    out.INDIKASI      = parts[2] || null;
    out.RELAY         = parts[3] || null;
    out.PHASE         = parts[4] || null;

    out.POINT_KEY = [out.GI, out.SUMBER_FEEDER, out.RELAY, out.PHASE]
      .map(v => (v ?? '')).join('|');

  } else if (first.startsWith('Feeder_')) {
    // ── KP Pickup ──────────────────────────────────────────────
    out.JENIS        = 'PICKUP KP';
    out.FEEDER_MURNI = first.slice(7).trim() || null;  // strip "Feeder_"
    out.KEYPOINT     = parts[1] || null;
    out.INDIKASI     = parts[2] || null;
    out.RELAY        = parts[3] || null;
    out.PHASE        = parts[4] || null;

    out.POINT_KEY = [out.FEEDER_MURNI, out.KEYPOINT, out.RELAY, out.PHASE]
      .map(v => (v ?? '')).join('|');

  } else {
    // Format lain (misal: status PMT, CB, dll) — abaikan
    return null;
  }

  return out;
}

// ── Lookup ID_UP3 dari MySQL ref tables ───────────────────────────
async function lookupUp3(parsed) {
  if (!parsed.JENIS) return null;

  const cacheKey = parsed.JENIS === 'PICKUP GI'
    ? `GI:${parsed.GI}`
    : `KP:${parsed.FEEDER_MURNI}`;

  if (up3Cache.has(cacheKey)) return up3Cache.get(cacheKey);

  let apjId = null;
  try {
    if (parsed.JENIS === 'PICKUP GI' && parsed.GI) {
      const [[row]] = await db.query(
        `SELECT APJ_ID FROM dc_gardu_induk
         WHERE TRIM(GARDU_INDUK_NAMA) = ? LIMIT 1`,
        [parsed.GI]
      );
      apjId = row?.APJ_ID ?? null;

    } else if (parsed.JENIS === 'PICKUP KP' && parsed.FEEDER_MURNI) {
      const [[row]] = await db.query(
        `SELECT APJ_ID FROM dc_cubicle
         WHERE TRIM(CUBICLE_NAME) = ? LIMIT 1`,
        [parsed.FEEDER_MURNI]
      );
      apjId = row?.APJ_ID ?? null;
    }
  } catch {
    // Tabel belum ada atau query gagal — simpan null agar tidak retry tiap baris
  }

  up3Cache.set(cacheKey, apjId);
  return apjId;
}

// ── Baca settings sync_interval dari DB ───────────────────────────
async function loadInterval() {
  try {
    const [[row]] = await db.query(
      `SELECT setting_value FROM settings WHERE setting_key = 'sync_interval' LIMIT 1`
    );
    return parseInt(row?.setting_value) || 15;
  } catch {
    return 15;
  }
}

// ── Satu siklus sinkronisasi ──────────────────────────────────────
// Loop sampai tidak ada sisa — supaya burst data tidak tertunda siklus berikutnya
const BATCH_SIZE = 500;

async function runJob() {
  if (state.jobRunning) return;
  state.jobRunning = true;

  let totalSyncedThisRun = 0;

  try {
    const mssql = await getMssql();

    // Titik awal: MAX(PKEY) dari MySQL (abaikan import negatif)
    // Dibaca SEKALI di awal — tidak diulang tiap batch agar loop bisa maju
    // walau semua baris batch dilewati (bukan GI/KP)
    const [[{ startPkey }]] = await db.query(
      'SELECT COALESCE(MAX(PKEY), 0) AS startPkey FROM sync_prtspl WHERE PKEY > 0'
    );
    let cursorPkey = Math.max(startPkey, state.lastPkey || 0);

    // Loop: terus ambil batch sampai SQL Server tidak punya sisa
    while (true) {
      const result = await mssql.request()
        .input('lastPkey', cursorPkey)
        .query(`
          SELECT TOP ${BATCH_SIZE}
            PKEY, TIME, [DESC]
          FROM prtspl
          WHERE PKEY > @lastPkey
          ORDER BY PKEY ASC
        `);

      const rows = result.recordset;

      // Tidak ada sisa → selesai
      if (rows.length === 0) break;

      const first = rows[0].PKEY;
      const last  = rows[rows.length - 1].PKEY;
      let   synced = 0;

      for (const row of rows) {
        const parsed = parseDesc(row.DESC);

        // Baris yang bukan GI/KP Pickup — lewati (tidak perlu disimpan)
        if (!parsed) continue;

        const id_up3 = await lookupUp3(parsed);

        try {
          await db.query(
            `INSERT IGNORE INTO sync_prtspl
               (PKEY, TIME, \`DESC\`,
                JENIS, GI, SUMBER_FEEDER, FEEDER_MURNI, KEYPOINT,
                INDIKASI, RELAY, PHASE,
                KESIMPULAN, POINT_KEY, ID_UP3)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.PKEY, row.TIME, row.DESC,
              parsed.JENIS, parsed.GI, parsed.SUMBER_FEEDER,
              parsed.FEEDER_MURNI, parsed.KEYPOINT,
              parsed.INDIKASI, parsed.RELAY, parsed.PHASE,
              parsed.KESIMPULAN, parsed.POINT_KEY, id_up3,
            ]
          );
          synced++;
        } catch (insertErr) {
          console.error(`[Sync] Insert error PKEY=${row.PKEY}:`, insertErr.message);
        }
      }

      totalSyncedThisRun += synced;
      // Maju cursor ke PKEY tertinggi batch — WAJIB dilakukan walau 0 row diinsert
      // supaya loop tidak stuck mengulang batch yang sama terus-menerus
      cursorPkey     = last;
      state.lastPkey = last;

      if (synced > 0) {
        console.log(`[Sync] ✚ ${synced} baris (PKEY ${first}–${last})`);
      } else {
        console.log(`[Sync] ○ ${rows.length} baris dilewati (bukan GI/KP), PKEY ${first}–${last}`);
      }

      // Batch < BATCH_SIZE → sudah habis, tidak perlu loop lagi
      if (rows.length < BATCH_SIZE) break;
    }

    state.lastRun     = new Date();
    state.lastSynced  = totalSyncedThisRun;
    state.totalSynced += totalSyncedThisRun;
    state.error       = null;

  } catch (err) {
    state.error   = err.message;
    state.lastRun = new Date();
    console.error('[Sync] Error:', err.message);
  } finally {
    state.jobRunning = false;
  }
}

// ── Start sync ────────────────────────────────────────────────────
async function start() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  try {
    const interval = await loadInterval();
    state.intervalSeconds = interval;
    state.running = true;

    // Jalankan sekali langsung
    await runJob();

    state.timer = setInterval(async () => {
      // Cek perubahan interval
      try {
        const newInterval = await loadInterval();
        if (newInterval !== state.intervalSeconds) {
          console.log(`[Sync] Interval berubah ${state.intervalSeconds}s → ${newInterval}s, restart...`);
          await start();
          return;
        }
      } catch {}

      await runJob();
    }, interval * 1000);

    console.log(`[Sync] ▶ Berjalan — interval: ${interval}s`);
  } catch (err) {
    state.error   = err.message;
    state.running = false;
    console.error('[Sync] Gagal start:', err.message);
  }
}

// ── Stop sync ─────────────────────────────────────────────────────
function stop() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  state.running = false;
  console.log('[Sync] ■ Dihentikan');
}

// ── Status (untuk API) ────────────────────────────────────────────
function getStatus() {
  return {
    running:         state.running,
    intervalSeconds: state.intervalSeconds,
    lastRun:         state.lastRun,
    lastSynced:      state.lastSynced,
    totalSynced:     state.totalSynced,
    lastPkey:        state.lastPkey,
    error:           state.error,
  };
}

// ── Export ────────────────────────────────────────────────────────
module.exports = { start, stop, getStatus, runJob, parseDesc };
