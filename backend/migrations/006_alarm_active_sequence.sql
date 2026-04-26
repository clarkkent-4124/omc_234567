-- ================================================================
-- Migration 006: tambah kolom sequence di alarm_active
--
-- PKEY dari SQL Server tidak selalu monoton naik.
-- SEQUENCE adalah autoincrement asli SQL Server — dijamin urut.
-- Scheduler kini pakai MAX(SEQUENCE) untuk menentukan event terbaru,
-- dan SEQUENCE > aa.sequence untuk cleanup (Dis datang setelah App).
-- ================================================================

ALTER TABLE alarm_active
  ADD COLUMN IF NOT EXISTS sequence BIGINT NULL AFTER pkey;

ALTER TABLE alarm_active
  ADD INDEX IF NOT EXISTS idx_alarm_active_sequence (sequence);

-- Reset agar data lama (tanpa sequence) tidak mengganggu cleanup
TRUNCATE TABLE alarm_active;

SELECT 'Migration 006 selesai.' AS info;
