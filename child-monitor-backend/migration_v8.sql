-- =========================================================
-- MIGRATION V8: Thêm client_record_id vào app_usage và website_logs
-- Hỗ trợ idempotency cho batch sync của Agent (ON CONFLICT DO NOTHING)
--
-- Chạy bằng tài khoản superuser (postgres):
-- psql -U postgres -d child_monitor_db -f migration_v8.sql
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Thêm cột client_record_id vào app_usage
--    - TEXT (UUID sinh bởi Agent, tối đa 64 ký tự)
--    - UNIQUE: đảm bảo ON CONFLICT DO NOTHING hoạt động đúng
--    - NULL cho các bản ghi cũ gửi qua endpoint đơn lẻ (/api/logs/app)
-- =========================================================
ALTER TABLE app_usage
    ADD COLUMN IF NOT EXISTS client_record_id TEXT;

-- Unique constraint chỉ áp dụng khi client_record_id NOT NULL
-- (partial unique index) → không ảnh hưởng bản ghi cũ có giá trị NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_usage_client_record_id
    ON app_usage(client_record_id)
    WHERE client_record_id IS NOT NULL;

-- =========================================================
-- 2. Thêm cột client_record_id vào website_logs
--    Tương tự như app_usage ở trên
-- =========================================================
ALTER TABLE website_logs
    ADD COLUMN IF NOT EXISTS client_record_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_logs_client_record_id
    ON website_logs(client_record_id)
    WHERE client_record_id IS NOT NULL;

COMMIT;

-- =========================================================
-- Sau khi chạy xong, kiểm tra:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name IN ('app_usage', 'website_logs')
--     AND column_name = 'client_record_id';
-- SELECT indexname FROM pg_indexes
--   WHERE tablename IN ('app_usage', 'website_logs')
--     AND indexname LIKE '%client_record_id%';
-- =========================================================
