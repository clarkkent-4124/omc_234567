-- ================================================================
-- Migration 007: simpan milidetik pada kolom TIME di sync_prtspl
--
-- SQL Server menyimpan timestamp dengan presisi milidetik.
-- DATETIME di MySQL hanya akurat sampai detik — milidetik terpotong.
-- DATETIME(3) menyimpan presisi hingga milidetik.
-- ================================================================

ALTER TABLE sync_prtspl
  MODIFY COLUMN TIME DATETIME(3) NULL;

-- Truncate + resync agar data lama tidak campur dengan data baru
TRUNCATE TABLE alarm_active;
TRUNCATE TABLE sync_prtspl;

SELECT 'Migration 007 selesai. Restart backend untuk resync.' AS info;
