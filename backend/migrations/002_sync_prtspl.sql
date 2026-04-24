-- ================================================================
-- Migration 002: sync_prtspl + alarm_active/ack refactor
-- Jalankan SATU KALI sebelum deploy backend baru
-- ================================================================

-- ── 1. Buat tabel sync_prtspl (jika belum ada) ──────────────────
CREATE TABLE IF NOT EXISTS sync_prtspl (
  PKEY          INT            NOT NULL,
  TIME          DATETIME       NOT NULL,
  `DESC`        TEXT           NULL,
  JENIS         VARCHAR(20)    NULL,         -- 'PICKUP GI' | 'PICKUP KP'
  GI            VARCHAR(100)   NULL,
  SUMBER_FEEDER VARCHAR(100)   NULL,
  FEEDER_MURNI  VARCHAR(100)   NULL,
  KEYPOINT      VARCHAR(100)   NULL,
  INDIKASI      VARCHAR(100)   NULL,
  RELAY         VARCHAR(100)   NULL,
  PHASE         VARCHAR(20)    NULL,
  KESIMPULAN    VARCHAR(20)    NULL,         -- 'App' | 'Dis' | …
  POINT_KEY     VARCHAR(255)   NULL,         -- composite key untuk pasangan App/Dis
  ID_UP3        INT            NULL,
  PRIMARY KEY (PKEY),
  INDEX idx_point_key   (POINT_KEY),
  INDEX idx_jenis_time  (JENIS, TIME),
  INDEX idx_kesimpulan  (KESIMPULAN)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. alarm_active: rename point_his_id → pkey, point_number → point_key ──
--    Jalankan hanya jika kolom lama masih ada
ALTER TABLE alarm_active
  CHANGE COLUMN point_his_id  pkey       INT          NOT NULL,
  CHANGE COLUMN point_number  point_key  VARCHAR(255) NOT NULL;

-- Hapus UNIQUE lama (point_number), tambah UNIQUE baru (point_key)
ALTER TABLE alarm_active
  DROP INDEX IF EXISTS point_number,
  ADD  UNIQUE KEY uq_alarm_active_point_key (point_key);

-- ── 3. alarm_ack: rename point_his_id → pkey, tambah kolom jika belum ada ──
ALTER TABLE alarm_ack
  CHANGE COLUMN point_his_id  pkey  INT NOT NULL;

ALTER TABLE alarm_ack
  ADD COLUMN IF NOT EXISTS kesimpulan VARCHAR(10) NULL  AFTER pkey,
  ADD COLUMN IF NOT EXISTS catatan    TEXT        NULL  AFTER kesimpulan;

-- ── 4. Tambah setting sync_interval (default 15 detik) ──────────
INSERT INTO settings (setting_key, setting_value)
VALUES ('sync_interval', '15')
ON DUPLICATE KEY UPDATE setting_value = setting_value;   -- jangan overwrite bila sudah diubah user

-- ── Selesai ──────────────────────────────────────────────────────
SELECT 'Migration 002 selesai.' AS info;
