-- ================================================================
-- Migration 004: Tambah kolom POINTPID untuk grouping alarm
--
-- POINTPID = ID point asli dari SCADA SQL Server (lebih presisi
-- dibanding POINT_KEY yang diderivasi dari parsing DESC).
--
-- Jika POINTPID tersedia → dipakai sebagai kunci group alarm.
-- Jika POINTPID null      → fallback ke POINT_KEY (skema lama).
--
-- Jalankan SATU KALI, lalu TRUNCATE sync_prtspl + alarm_active
-- agar data di-resync ulang dengan POINTPID terisi.
-- ================================================================

-- ── 1. sync_prtspl: tambah kolom POINTPID ───────────────────────
ALTER TABLE sync_prtspl
  ADD COLUMN IF NOT EXISTS POINTPID  VARCHAR(100) NULL
  AFTER PKEY;

-- Index agar query GROUP BY / WHERE POINTPID cepat
ALTER TABLE sync_prtspl
  ADD INDEX IF NOT EXISTS idx_pointpid (POINTPID);

-- Tambah kolom SEQUENCE jika belum ada (dipakai sync cursor)
ALTER TABLE sync_prtspl
  ADD COLUMN IF NOT EXISTS SEQUENCE  BIGINT NULL
  AFTER POINTPID;

-- ── 2. alarm_active: tambah kolom pointpid ──────────────────────
-- Kolom point_key + UNIQUE uq_alarm_active_point_key TETAP ada
-- (fallback / backward compat).
ALTER TABLE alarm_active
  ADD COLUMN IF NOT EXISTS pointpid VARCHAR(100) NULL
  AFTER point_key;

-- UNIQUE pada pointpid: MySQL membolehkan banyak NULL dalam UNIQUE,
-- jadi baris tanpa pointpid (fallback ke point_key) tidak konflik.
ALTER TABLE alarm_active
  ADD UNIQUE KEY IF NOT EXISTS uq_alarm_active_pointpid (pointpid);

-- ── 3. Reset data lama ───────────────────────────────────────────
-- Jalankan manual setelah migration ini agar POINTPID terisi
-- dari SQL Server saat resync berikutnya:
--
--   TRUNCATE TABLE alarm_active;
--   TRUNCATE TABLE sync_prtspl;
--
-- (jangan dijalankan otomatis di sini untuk keamanan)

-- ── Selesai ──────────────────────────────────────────────────────
SELECT 'Migration 004 selesai.' AS info;
