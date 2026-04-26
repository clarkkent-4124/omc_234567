const { mysql: db, getMssql } = require('./db');

// ── State ────────────────────────────────────────────────────────
const state = {
  timer:           null,
  running:         false,
  jobRunning:      false,
  intervalSeconds: 15,
  lastRun:         null,
  lastSynced:      0,      // jumlah row yang di-sync pada run terakhir
  totalSynced:     0,      // akumulasi sejak server start
  lastSequence:    0,      // SEQUENCE terakhir yang sudah masuk ke MySQL
  error:           null,
};

// ── Cache UP3 supaya tidak query DB tiap baris ─────────────────────
// key: "GI:<gi_name>" atau "KP:<feeder_murni>"  →  APJ_ID | null
const up3Cache = new Map();

// ── Parse DESC ─────────────────────────────────────────────────────
//
// Format comma (3 bagian) — dari SQL Server:
//   PICKUP GI : *GI-{gi},Relay {gi} {relay_no} - {indikasi},{kesimpulan}
//   PICKUP KP : *Feeder_{feeder},Indikasi {indikasi} {rec}_{keypoint},{kesimpulan}
//
// Format titik (banyak bagian) — legacy / fallback:
//   PICKUP GI : GI-{gi}.{relay}.{indikasi}.{relay}.{phase}.{kesimpulan}
//   PICKUP KP : Feeder_{feeder}.{keypoint}.{indikasi}.{relay}.{phase}.{kesimpulan}
//
// Keyword yang relevan — hanya event ini yang diproses
const RELEVANT_KEYWORDS = ['pickup', 'rnr', 'tcs'];

function parseDesc(desc) {
  if (!desc || typeof desc !== 'string') return null;

  // Filter awal: DESC harus mengandung salah satu keyword relevan
  const descLower = desc.toLowerCase();
  if (!RELEVANT_KEYWORDS.some(kw => descLower.includes(kw))) return null;

  // Strip karakter non-alfanumerik di depan (misal: '*', spasi, dll)
  const cleaned = desc.replace(/^[^A-Za-z0-9]+/, '');

  // Support separator titik '.' atau koma ','
  const sep   = cleaned.includes(',') ? ',' : '.';
  const parts = cleaned.split(sep).map(s => s.trim());
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
    out.JENIS = 'PICKUP GI';
    out.GI    = first.slice(3).trim() || null;  // strip "GI-"

    if (sep === ',') {
      // Format: "Relay {gi_name} {relay_no} - {indikasi}"
      // Contoh: "Relay Secang 01 - Pickup Over Current Fault"
      const middle   = parts[1] || '';
      const dashIdx  = middle.indexOf(' - ');
      if (dashIdx !== -1) {
        const left   = middle.slice(0, dashIdx).trim();       // "Relay Secang 01"
        const right  = middle.slice(dashIdx + 3).trim();      // "Pickup Over Current Fault"
        const tokens = left.split(/\s+/);
        out.SUMBER_FEEDER = tokens[tokens.length - 1] || null; // "01"
        out.INDIKASI      = right || null;
      } else {
        // Fallback: tidak ada " - ", ambil seluruh middle
        out.SUMBER_FEEDER = middle || null;
      }
    } else {
      // Format titik: GI-{gi}.{relay}.{indikasi}.{relay}.{phase}.{kesimpulan}
      out.SUMBER_FEEDER = parts[1] || null;
      out.INDIKASI      = parts[2] || null;
      out.RELAY         = parts[3] || null;
      out.PHASE         = parts[4] || null;
    }

    out.POINT_KEY = [out.GI, out.SUMBER_FEEDER, out.RELAY, out.PHASE]
      .map(v => (v ?? '')).join('|');

  } else if (first.startsWith('Feeder_') && descLower.includes('pickup')) {
    // ── KP Pickup ──────────────────────────────────────────────
    out.JENIS        = 'PICKUP KP';
    out.FEEDER_MURNI = first.slice(7).trim() || null;  // strip "Feeder_"

    if (sep === ',') {
      // Format: "Indikasi {indikasi} {rec}_{keypoint}"
      // Contoh: "Indikasi Pickup Fasa C REC_SMU01_S3-17-10"
      //         "Indikasi Pickup Over Current SMU07_S3-121C-206"
      let middle = (parts[1] || '').trim();

      // Strip prefix "Indikasi " jika ada
      if (middle.toLowerCase().startsWith('indikasi ')) {
        middle = middle.slice(9).trim();
      }

      // Token terakhir (dipisah spasi) yang mengandung '_' = {something}_{keypoint}
      const tokens    = middle.split(/\s+/);
      const lastToken = tokens[tokens.length - 1] || '';

      if (lastToken.includes('_')) {
        const uParts  = lastToken.split('_');
        out.KEYPOINT  = uParts[uParts.length - 1] || null;  // "S3-17-10"
        out.INDIKASI  = tokens.slice(0, -1).join(' ') || null; // "Pickup Fasa C"
      } else {
        // Fallback: tidak ada underscore, pakai seluruh middle
        out.INDIKASI = middle || null;
      }
    } else {
      // Format titik: Feeder_{feeder}.{keypoint}.{indikasi}.{relay}.{phase}.{kesimpulan}
      out.KEYPOINT = parts[1] || null;
      out.INDIKASI = parts[2] || null;
      out.RELAY    = parts[3] || null;
      out.PHASE    = parts[4] || null;
    }

    out.POINT_KEY = [out.FEEDER_MURNI, out.KEYPOINT, out.RELAY, out.PHASE]
      .map(v => (v ?? '')).join('|');

  } else if (descLower.includes('rnr')) {
    // ── RNR ────────────────────────────────────────────────────
    // TODO: pisah GI/KP jika diperlukan nanti
    out.JENIS        = 'RNR';
    out.FEEDER_MURNI = first.startsWith('Feeder_') ? first.slice(7).trim() : null;
    out.GI           = first.startsWith('GI-')     ? first.slice(3).trim() : null;
    out.INDIKASI     = parts.slice(1, -1).join(sep) || null; // semua tengah

    out.POINT_KEY = ['RNR', out.GI || out.FEEDER_MURNI, out.INDIKASI]
      .map(v => (v ?? '')).join('|');

  } else if (descLower.includes('tcs')) {
    // ── TCS ────────────────────────────────────────────────────
    // TODO: pisah GI/KP jika diperlukan nanti
    out.JENIS        = 'TCS';
    out.FEEDER_MURNI = first.startsWith('Feeder_') ? first.slice(7).trim() : null;
    out.GI           = first.startsWith('GI-')     ? first.slice(3).trim() : null;
    out.INDIKASI     = parts.slice(1, -1).join(sep) || null; // semua tengah

    out.POINT_KEY = ['TCS', out.GI || out.FEEDER_MURNI, out.INDIKASI]
      .map(v => (v ?? '')).join('|');

  } else {
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

    // Titik awal: MAX(SEQUENCE) dari MySQL
    // Dibaca SEKALI di awal — tidak diulang tiap batch agar loop bisa maju
    // walau semua baris batch dilewati (bukan GI/KP)
    const [[{ startSeq }]] = await db.query(
      'SELECT COALESCE(MAX(SEQUENCE), 0) AS startSeq FROM sync_prtspl'
    );
    let cursorSeq = Math.max(startSeq, state.lastSequence || 0);

    // Loop: terus ambil batch sampai SQL Server tidak punya sisa
    while (true) {
      const result = await mssql.request()
        .input('lastSeq', cursorSeq)
        .query(`
          SELECT TOP ${BATCH_SIZE}
            SEQUENCE, PKEY, TIME, [DESC]
          FROM prtspl
          WHERE SEQUENCE > @lastSeq
            AND [DESC] NOT LIKE '%manual%'
            AND [DESC] NOT LIKE '%put in scan%'
          ORDER BY SEQUENCE ASC
        `);

      const rows = result.recordset;

      // Tidak ada sisa → selesai
      if (rows.length === 0) break;

      const firstSeq = rows[0].SEQUENCE;
      const lastSeq  = rows[rows.length - 1].SEQUENCE;
      let   synced   = 0;

      for (const row of rows) {
        const parsed = parseDesc(row.DESC);

        // Baris yang bukan GI/KP Pickup — lewati (tidak perlu disimpan)
        if (!parsed) continue;

        const id_up3 = await lookupUp3(parsed);

        try {
          await db.query(
            `INSERT IGNORE INTO sync_prtspl
               (SEQUENCE, PKEY, TIME, \`DESC\`,
                JENIS, GI, SUMBER_FEEDER, FEEDER_MURNI, KEYPOINT,
                INDIKASI, RELAY, PHASE,
                KESIMPULAN, POINT_KEY, ID_UP3)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.SEQUENCE, row.PKEY, row.TIME, row.DESC,
              parsed.JENIS, parsed.GI, parsed.SUMBER_FEEDER,
              parsed.FEEDER_MURNI, parsed.KEYPOINT,
              parsed.INDIKASI, parsed.RELAY, parsed.PHASE,
              parsed.KESIMPULAN, parsed.POINT_KEY, id_up3,
            ]
          );
          synced++;
        } catch (insertErr) {
          console.error(`[Sync] Insert error SEQ=${row.SEQUENCE}:`, insertErr.message);
        }
      }

      totalSyncedThisRun += synced;
      // Maju cursor ke SEQUENCE tertinggi batch — WAJIB walau 0 row diinsert
      // supaya loop tidak stuck mengulang batch yang sama terus-menerus
      cursorSeq          = lastSeq;
      state.lastSequence = lastSeq;

      // Tampilkan TIME asli dari SQL Server (UTC) di log
      const fmtTime   = t => t ? String(t).slice(0, 19) : '?';
      const firstTime = fmtTime(rows[0].TIME);
      const lastTime  = fmtTime(rows[rows.length - 1].TIME);

      if (synced > 0) {
        console.log(`[Sync] ✚ ${synced}/${rows.length} baris | SEQ ${firstSeq}–${lastSeq} | ${firstTime} s/d ${lastTime}`);
      } else {
        console.log(`[Sync] ○ ${rows.length} dilewati (bukan GI/KP) | SEQ ${firstSeq}–${lastSeq} | ${firstTime} s/d ${lastTime}`);
      }

      // Batch < BATCH_SIZE → sudah habis, tidak perlu loop lagi
      if (rows.length < BATCH_SIZE) break;
    }

    state.lastRun     = new Date();
    state.lastSynced  = totalSyncedThisRun;
    state.totalSynced += totalSyncedThisRun;
    state.error       = null;

    if (totalSyncedThisRun === 0) {
      console.log(`[Sync] — Tidak ada data baru | cursor SEQ ${state.lastSequence} | ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
    } else {
      console.log(`[Sync] ✔ Selesai — total run ini: ${totalSyncedThisRun} baris`);
    }

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
    lastSequence:    state.lastSequence,
    error:           state.error,
  };
}

// ── Export ────────────────────────────────────────────────────────
module.exports = { start, stop, getStatus, runJob, parseDesc };
