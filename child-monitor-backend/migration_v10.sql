-- =========================================================
-- MIGRATION V10: Bảo vệ duration_seconds ở tầng PostgreSQL
-- =========================================================
-- NOT VALID không quét/chặn migration vì dữ liệu lịch sử có thể đang sai,
-- nhưng constraint vẫn áp dụng ngay cho mọi INSERT/UPDATE mới.

BEGIN;

ALTER TABLE app_usage
    DROP CONSTRAINT IF EXISTS chk_app_usage_duration_seconds;
ALTER TABLE app_usage
    ADD CONSTRAINT chk_app_usage_duration_seconds
    CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400)
    NOT VALID;

ALTER TABLE website_logs
    DROP CONSTRAINT IF EXISTS chk_website_logs_duration_seconds;
ALTER TABLE website_logs
    ADD CONSTRAINT chk_website_logs_duration_seconds
    CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400)
    NOT VALID;

COMMIT;

-- Sau khi xử lý dữ liệu lịch sử không hợp lệ, có thể xác nhận constraint:
-- ALTER TABLE app_usage VALIDATE CONSTRAINT chk_app_usage_duration_seconds;
-- ALTER TABLE website_logs VALIDATE CONSTRAINT chk_website_logs_duration_seconds;
