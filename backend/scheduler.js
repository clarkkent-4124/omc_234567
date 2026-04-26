const { mysql: db } = require('./db');

// ── State ────────────────────────────────────────────────────────
const state = {
  timer:                  null,
  running:                false,
  triggerEnabled:         true,  // scheduler_enabled
  cleanupEnabled:         true,  // cleanup_enabled
  triggerDurationEnabled: true,  // trigger_duration_enabled
  jobRunning:             false,
  intervalSeconds:        10,
  lastRun:                null,
  lastTriggered:          0,
  totalTriggered:         0,
  lastCleaned:            0,
  totalActive:            0,
  error:                  null,
};

// ── Baca settings dari DB ─────────────────────────────────────────
async function loadSettings() {
  const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
  const s = {};
  rows.forEach(r => { s[r.setting_key] = Number(r.setting_value); });
  return {
    trigger_duration:          s.trigger_duration          || 30,
    scheduler_interval:        s.scheduler_interval        || 10,
    scheduler_enabled:         s.scheduler_enabled         !== undefined ? s.scheduler_enabled         : 1,
    cleanup_enabled:           s.cleanup_enabled           !== undefined ? s.cleanup_enabled           : 1,
    trigger_duration_enabled:  s.trigger_duration_enabled  !== undefined ? s.trigger_duration_enabled  : 1,
  };
}

// ── Satu siklus kerja ─────────────────────────────────────────────
async function runJob() {
  if (state.jobRunning) return;
  state.jobRunning = true;

  try {
    const { trigger_duration, scheduler_enabled, cleanup_enabled, trigger_duration_enabled } = await loadSettings();

    state.triggerEnabled         = !!scheduler_enabled;
    state.cleanupEnabled         = !!cleanup_enabled;
    state.triggerDurationEnabled = !!trigger_duration_enabled;

    // ── TRIGGER ──────────────────────────────────────────────────
    let triggered = 0;

    if (scheduler_enabled) {
      let toTrigger;

      const ALL_JENIS = `'PICKUP GI', 'PICKUP KP', 'RNR', 'TCS'`;

      // ── Grouping key: POINTPID jika tersedia, POINT_KEY sebagai fallback ──
      // COALESCE(NULLIF(TRIM(sp.POINTPID),''), sp.POINT_KEY) = effective key
      //
      // ── POINT_KEY-only fallback (simpan sebagai komentar jika perlu kembali): ──
      // GROUP BY POINT_KEY  &  JOIN alarm_active aa ON aa.point_key = sp.POINT_KEY

      if (trigger_duration_enabled) {
        // Mode GLITCH FILTER: latest event per POINTPID (atau POINT_KEY) harus 'App'
        // DAN sudah bertahan > trigger_duration detik.
        // Pakai MAX(SEQUENCE) — SEQUENCE dari SQL Server dijamin monoton naik,
        // sedangkan PKEY tidak selalu monoton.
        [toTrigger] = await db.query(`
          SELECT sp.PKEY, sp.SEQUENCE, sp.TIME AS alarm_start, sp.POINT_KEY, sp.POINTPID,
            COALESCE(NULLIF(TRIM(sp.POINTPID),''), sp.POINT_KEY) AS eff_key
          FROM sync_prtspl sp
          INNER JOIN (
            SELECT
              COALESCE(NULLIF(TRIM(POINTPID),''), POINT_KEY) AS eff_key,
              MAX(SEQUENCE) AS max_seq
            FROM sync_prtspl
            WHERE JENIS IN (${ALL_JENIS})
            GROUP BY COALESCE(NULLIF(TRIM(POINTPID),''), POINT_KEY)
          ) latest ON COALESCE(NULLIF(TRIM(sp.POINTPID),''), sp.POINT_KEY) = latest.eff_key
            AND sp.SEQUENCE = latest.max_seq
          LEFT JOIN alarm_active aa   ON aa.pkey  = sp.PKEY
          LEFT JOIN alarm_ack    aa_k ON aa_k.pkey = sp.PKEY
          WHERE sp.KESIMPULAN = 'App'
            AND sp.JENIS IN (${ALL_JENIS})
            AND TIMESTAMPDIFF(SECOND, sp.TIME, NOW()) > ?
            AND aa.id     IS NULL
            AND aa_k.pkey IS NULL
        `, [trigger_duration]);
      } else {
        // Mode LANGSUNG: trigger setiap ada App terbaru per effective key
        [toTrigger] = await db.query(`
          SELECT sp.PKEY, sp.SEQUENCE, sp.TIME AS alarm_start, sp.POINT_KEY, sp.POINTPID,
            COALESCE(NULLIF(TRIM(sp.POINTPID),''), sp.POINT_KEY) AS eff_key
          FROM sync_prtspl sp
          INNER JOIN (
            SELECT
              COALESCE(NULLIF(TRIM(POINTPID),''), POINT_KEY) AS eff_key,
              MAX(SEQUENCE) AS max_seq
            FROM sync_prtspl
            WHERE JENIS IN (${ALL_JENIS})
              AND KESIMPULAN = 'App'
            GROUP BY COALESCE(NULLIF(TRIM(POINTPID),''), POINT_KEY)
          ) latest_app ON COALESCE(NULLIF(TRIM(sp.POINTPID),''), sp.POINT_KEY) = latest_app.eff_key
            AND sp.SEQUENCE = latest_app.max_seq
          LEFT JOIN alarm_active aa   ON aa.pkey  = sp.PKEY
          LEFT JOIN alarm_ack    aa_k ON aa_k.pkey = sp.PKEY
          WHERE sp.JENIS IN (${ALL_JENIS})
            AND aa.id     IS NULL
            AND aa_k.pkey IS NULL
        `);
      }

      for (const alarm of toTrigger) {
        const logKey = alarm.POINTPID || alarm.POINT_KEY;
        try {
          await db.query(
            `INSERT INTO alarm_active (pkey, sequence, point_key, pointpid, triggered_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [alarm.PKEY, alarm.SEQUENCE, alarm.POINT_KEY, alarm.POINTPID || null]
          );
          triggered++;
          console.log(`[Scheduler] ✚ Triggered: ${logKey}`);
        } catch {
          // UNIQUE constraint — sudah ada, skip
        }
      }
    }

    // ── CLEANUP ──────────────────────────────────────────────────
    // Hapus alarm_active yang relay-nya sudah recovery (Dis datang setelah App)
    // Gunakan POINTPID jika tersedia, fallback ke POINT_KEY
    //
    // ── POINT_KEY-only fallback (simpan sebagai komentar jika perlu kembali): ──
    // WHERE sp.POINT_KEY = aa.point_key AND sp.SEQUENCE > aa.sequence AND sp.KESIMPULAN='Dis'
    let cleanedCount = 0;

    if (cleanup_enabled) {
      const [cleaned] = await db.query(`
        DELETE aa FROM alarm_active aa
        WHERE EXISTS (
          SELECT 1 FROM sync_prtspl sp
          WHERE (
            (aa.pointpid IS NOT NULL AND aa.pointpid != '' AND sp.POINTPID = aa.pointpid)
            OR (COALESCE(aa.pointpid,'') = '' AND sp.POINT_KEY = aa.point_key)
          )
            AND sp.SEQUENCE   > aa.sequence
            AND sp.KESIMPULAN = 'Dis'
            AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP', 'RNR', 'TCS')
        )
      `);
      cleanedCount = cleaned.affectedRows || 0;
      if (cleanedCount > 0) console.log(`[Scheduler] ✖ Cleaned: ${cleanedCount}`);
    }

    // ── Hitung total active ───────────────────────────────────────
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM alarm_active');

    state.lastRun        = new Date();
    state.lastTriggered  = triggered;
    state.totalTriggered += triggered;
    state.lastCleaned    = cleanedCount;
    state.totalActive    = total;
    state.error          = null;

  } catch (err) {
    state.error   = err.message;
    state.lastRun = new Date();
    console.error('[Scheduler] Error:', err.message);
  } finally {
    state.jobRunning = false;
  }
}

// ── Start scheduler ───────────────────────────────────────────────
async function start() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  try {
    const { scheduler_interval } = await loadSettings();
    state.intervalSeconds = scheduler_interval;
    state.running = true;

    // Jalankan sekali langsung saat start
    await runJob();

    state.timer = setInterval(async () => {
      try {
        const { scheduler_interval: newInterval } = await loadSettings();
        if (newInterval !== state.intervalSeconds) {
          console.log(`[Scheduler] Interval berubah ${state.intervalSeconds}s → ${newInterval}s, restart...`);
          await start();
          return;
        }
      } catch {}

      await runJob();
    }, scheduler_interval * 1000);

    console.log(`[Scheduler] ▶ Berjalan — interval: ${scheduler_interval}s`);
  } catch (err) {
    state.error   = err.message;
    state.running = false;
    console.error('[Scheduler] Gagal start:', err.message);
  }
}

// ── Stop scheduler ────────────────────────────────────────────────
function stop() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
  state.running = false;
  console.log('[Scheduler] ■ Dihentikan');
}

// ── Status (untuk API) ────────────────────────────────────────────
function getStatus() {
  return {
    running:                state.running,
    triggerEnabled:         state.triggerEnabled,
    cleanupEnabled:         state.cleanupEnabled,
    triggerDurationEnabled: state.triggerDurationEnabled,
    intervalSeconds: state.intervalSeconds,
    lastRun:         state.lastRun,
    lastTriggered:   state.lastTriggered,
    totalTriggered:  state.totalTriggered,
    lastCleaned:     state.lastCleaned,
    totalActive:     state.totalActive,
    error:           state.error,
  };
}

module.exports = { start, stop, getStatus, runJob };
