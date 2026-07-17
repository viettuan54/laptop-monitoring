-- =========================================================
-- MIGRATION V7: Thêm composite index cho bảng alerts
-- Chạy bằng tài khoản superuser (postgres):
-- psql -U postgres -d child_monitor_db -f migration_v7.sql
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Thêm composite index alerts(device_id, is_read, created_at)
--    Tối ưu query getAlerts khi phụ huynh lọc theo is_read:
--    GET /api/alerts?device_id=X&is_read=false
--    Hiện tại chỉ có index (device_id, created_at) → filter
--    is_read phải scan toàn bộ kết quả của device_id.
--    Index mới giúp PostgreSQL lọc is_read ngay tại index.
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_alerts_device_read_time
    ON alerts(device_id, is_read, created_at DESC);

COMMIT;

-- =========================================================
-- Sau khi chạy xong, kiểm tra:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'alerts';
-- =========================================================
