-- =========================================================
-- MIGRATION: Cập nhật schema bảo mật v2
-- Chạy bằng: psql -U app_admin -d child_monitor_db -f migration_v2.sql
-- =========================================================

BEGIN;

-- 1. Cập nhật bảng users để hỗ trợ xác minh email, token reset password, và token_version
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1 NOT NULL;

-- Áp dụng Grandfather Clause: Tất cả user hiện có mặc định được coi là đã xác minh email
UPDATE users SET is_verified = TRUE WHERE is_verified IS FALSE;

-- 2. Thay đổi kiểu cột device_secret trên bảng devices từ UUID sang VARCHAR(64)
-- Đầu tiên, xóa constraint DEFAULT gen_random_uuid() cũ
ALTER TABLE devices ALTER COLUMN device_secret DROP DEFAULT;

-- Chuyển kiểu dữ liệu sang VARCHAR(64)
ALTER TABLE devices ALTER COLUMN device_secret TYPE VARCHAR(64);

-- Băm SHA-256 các device_secret cũ bằng extension pgcrypto (đảm bảo tính tương thích)
UPDATE devices SET device_secret = encode(digest(device_secret::text, 'sha256'), 'hex')
WHERE length(device_secret) != 64;

-- 3. Tạo index UNIQUE case-insensitive cho email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- 4. Tạo bảng refresh_tokens để lưu trữ hash của Refresh Token
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Bổ sung cấu hình mặc định (settings) cho các children hiện chưa có
INSERT INTO settings (child_id)
SELECT child_id FROM children
ON CONFLICT (child_id) DO NOTHING;

COMMIT;

