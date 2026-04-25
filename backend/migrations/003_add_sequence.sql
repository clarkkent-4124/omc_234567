-- ================================================================
-- Migration 003: tambah kolom SEQUENCE di sync_prtspl
-- Jalankan SATU KALI, lalu restart backend
-- ================================================================

-- Tambah kolom SEQUENCE (dari SQL Server, true autoincrement)
ALTER TABLE sync_prtspl
  ADD COLUMN IF NOT EXISTS SEQUENCE BIGINT NULL AFTER PKEY,
  ADD INDEX idx_sequence (SEQUENCE);

-- Kosongkan data lama agar sync ulang dari awal pakai SEQUENCE
-- (hapus baris ini jika tidak mau sync ulang)
TRUNCATE TABLE sync_prtspl;
TRUNCATE TABLE alarm_active;

SELECT 'Migration 003 selesai. Restart backend.' AS info;
