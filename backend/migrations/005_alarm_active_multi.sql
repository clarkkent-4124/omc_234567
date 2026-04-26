-- ================================================================
-- Migration 005: alarm_active — izinkan banyak alarm per POINTPID
--
-- Sebelumnya: UNIQUE pada point_key dan pointpid
--   → hanya 1 alarm aktif per titik sekaligus
--
-- Sekarang: UNIQUE hanya pada pkey (1 alarm per App event)
--   → bisa banyak alarm aktif untuk titik yang sama
--   → App 100 → alarm, Dis 101 (diabaikan), App 102 → alarm baru ✓
--
-- Jalankan, lalu TRUNCATE alarm_active agar bersih
-- ================================================================

-- 1. Hapus UNIQUE lama
ALTER TABLE alarm_active
  DROP INDEX IF EXISTS uq_alarm_active_point_key;

ALTER TABLE alarm_active
  DROP INDEX IF EXISTS uq_alarm_active_pointpid;

-- 2. Ganti jadi index biasa (tetap berguna untuk query)
ALTER TABLE alarm_active
  ADD INDEX IF NOT EXISTS idx_alarm_active_point_key (point_key);

ALTER TABLE alarm_active
  ADD INDEX IF NOT EXISTS idx_alarm_active_pointpid  (pointpid);

-- 3. UNIQUE pada pkey — satu App event hanya boleh trigger 1 alarm
ALTER TABLE alarm_active
  ADD UNIQUE KEY IF NOT EXISTS uq_alarm_active_pkey (pkey);

-- 4. Reset
TRUNCATE TABLE alarm_active;

SELECT 'Migration 005 selesai.' AS info;
