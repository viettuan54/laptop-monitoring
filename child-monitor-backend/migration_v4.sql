-- =========================================================
-- MIGRATION V4: Cấp quyền DELETE & Cập nhật Retention 30 ngày
-- Chạy bằng tài khoản superuser (postgres) để đảm bảo không lỗi quyền sở hữu:
-- psql -U postgres -d child_monitor_db -f migration_v4.sql
-- =========================================================

BEGIN;

-- 1. Cấp quyền DELETE trên children và devices cho app_backend
GRANT DELETE ON children, devices TO app_backend;

-- 2. Cập nhật hàm cleanup_old_logs() dọn dẹp logs cũ hơn 30 ngày
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM app_usage WHERE start_time < NOW() - INTERVAL '30 days';
    DELETE FROM website_logs WHERE visit_time < NOW() - INTERVAL '30 days';
    DELETE FROM ai_analysis WHERE analyzed_at < NOW() - INTERVAL '30 days';
    DELETE FROM alerts WHERE created_at < NOW() - INTERVAL '30 days' AND is_read = TRUE;
END;
$$ LANGUAGE plpgsql;

COMMIT;
