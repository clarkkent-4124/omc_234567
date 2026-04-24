const { mysql: db } = require('./db');

// ── State ────────────────────────────────────────────────────────
const state = {
  timer:           null,
  running:         false,
  triggerEnabled:  true,    // scheduler_enabled: false = skip trigger & cleanup
  cleanupEnabled:  true,    // cleanup_enabled:   false = skip cleanup saja
  jobRunning:      false,   // prevent concurrent runs
  intervalSeconds: 10,
  lastRun:         null,
  lastTriggered:   0,       // jumlah trigger pada run terakhir
  totalTriggered:  0,       // akumulasi sejak server start
  lastCleaned:     0,
  totalActive:     0,
  error:           null,
};

// ── Baca settings dari DB ─────────────────────────────────────────
async function loadSettings() {
  const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
  const s = {};
  rows.forEach(r => { s[r.setting_key] = Number(r.setting_value); });
  return {
    trigger_duration:   s.trigger_duration   || 30,
    scheduler_interval: s.scheduler_interval || 10,
    scheduler_enabled:  s.scheduler_enabled  !== undefined ? s.scheduler_enabled : 1,
    cleanup_enabled:    s.cleanup_enabled    !== undefined ? s.cleanup_enabled    : 1,
  };
}

// ── Satu siklus kerja ─────────────────────────────────────────────
async function runJob() {
  if (state.jobRunning) return;
  state.jobRunning = true;

  try {
    const { trigger_duration, scheduler_enabled, cleanup_enabled } = await loadSettings();

    state.triggerEnabled = !!scheduler_enabled;
    state.cleanupEnabled = !!cleanup_enabled;

    // ── TRIGGER ──────────────────────────────────────────────────
    let triggered = 0;

    if (scheduler_enabled) {
      const [toTrigger] = await db.query(`
        SELECT sp.PKEY, sp.TIME AS alarm_start, sp.POINT_KEY
        FROM sync_prtspl sp
        INNER JOIN (
          SELECT POINT_KEY, MAX(PKEY) AS max_pkey
          FROM sync_prtspl
          WHERE JENIS IN ('PICKUP GI', 'PICKUP KP')
          GROUP BY POINT_KEY
        ) latest ON sp.PKEY = latest.max_pkey
        LEFT JOIN alarm_active aa ON aa.point_key = sp.POINT_KEY
        WHERE sp.KESIMPULAN = 'App'
          AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP')
          AND TIMESTAMPDIFF(SECOND, sp.TIME, NOW()) > ?
          AND aa.id IS NULL
      `, [trigger_duration]);

      for (const alarm of toTrigger) {
        try {
          await db.query(
            `INSERT INTO alarm_active (pkey, point_key, triggered_at)
             VALUES (?, ?, NOW())`,
            [alarm.PKEY, alarm.POINT_KEY]
          );
          triggered++;
          console.log(`[Scheduler] ✚ Triggered: ${alarm.POINT_KEY}`);
        } catch {
          // UNIQUE constraint — point_key sudah ada, skip
        }
      }
    }

    // ── CLEANUP ──────────────────────────────────────────────────
    // Hapus alarm_active yang relay-nya sudah recovery (Dis datang setelah App)
    // Bisa di-nonaktifkan jika ingin semua alarm tetap sampai diack operator
    let cleanedCount = 0;

    if (cleanup_enabled) {
      const [cleaned] = await db.query(`
        DELETE aa FROM alarm_active aa
        WHERE EXISTS (
          SELECT 1 FROM sync_prtspl sp
          WHERE sp.POINT_KEY  = aa.point_key
            AND sp.PKEY       > aa.pkey
            AND sp.KESIMPULAN = 'Dis'
            AND sp.JENIS IN ('PICKUP GI', 'PICKUP KP')
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
    running:         state.running,
    triggerEnabled:  state.triggerEnabled,
    cleanupEnabled:  state.cleanupEnabled,
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
