-- =========================================================
-- MIGRATION: Cập nhật schema cho bản vá bảo mật
-- Chạy bằng: psql -U app_admin -d child_monitor_db -f migration.sql
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Thêm device_secret vào bảng devices
--    Agent (laptop con) dùng secret này để POST log thay vì JWT phụ huynh
-- =========================================================
ALTER TABLE devices ADD COLUMN IF NOT EXISTS
    device_secret UUID DEFAULT gen_random_uuid() NOT NULL;

-- Điền device_secret cho các thiết bị đã tồn tại (nếu có)
UPDATE devices SET device_secret = gen_random_uuid() WHERE device_secret IS NULL;

-- Index để tra cứu nhanh khi agent gửi request
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_secret ON devices(device_secret);

-- =========================================================
-- 2. Xóa cột name_encrypted khỏi bảng children
--    Cột này không bao giờ được dùng trong code → tránh gây nhầm lẫn
-- =========================================================
ALTER TABLE children DROP COLUMN IF EXISTS name_encrypted;

-- =========================================================
-- 3. Tạo bảng token_blacklist để thay thế in-memory Set
--    Lưu jti (JWT ID) thay vì cả chuỗi token để tiết kiệm bộ nhớ
-- =========================================================
CREATE TABLE IF NOT EXISTS token_blacklist (
    jti        VARCHAR(36) PRIMARY KEY,           -- UUID của JWT
    expires_at TIMESTAMP NOT NULL                 -- Thời điểm token hết hạn (để tự dọn)
);

-- Index để dọn token hết hạn hiệu quả hơn
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- =========================================================
-- 4. Cấp quyền cho app_backend trên bảng mới
-- =========================================================
GRANT SELECT, INSERT, DELETE ON token_blacklist TO app_backend;

-- app_admin có toàn quyền (đã có GRANT ALL trước đó nhưng cấp lại cho chắc)
GRANT ALL PRIVILEGES ON token_blacklist TO app_admin;

-- =========================================================
-- 5. Cấp thêm quyền SELECT device_secret cho app_backend
--    (cần để middleware deviceAuth tra cứu)
-- =========================================================
-- Quyền SELECT trên devices đã được cấp từ trước, không cần thêm

COMMIT;

-- =========================================================
-- Sau khi chạy xong, kiểm tra:
-- SELECT column_name FROM information_schema.columns WHERE table_name='devices';
-- SELECT column_name FROM information_schema.columns WHERE table_name='children';
-- SELECT table_name FROM information_schema.tables WHERE table_name='token_blacklist';
-- =========================================================
