-- =========================================================
-- MIGRATION V6: Lưu thông tin brute-force login vào Database
-- Chạy bằng tài khoản superuser (postgres):
-- psql -U postgres -d child_monitor_db -f migration_v6.sql
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS failed_login_attempts (
    email         VARCHAR(150) PRIMARY KEY,
    attempt_count INT DEFAULT 1 NOT NULL,
    lock_until    TIMESTAMP,
    last_attempt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Cấp quyền cho app_backend và app_admin trên bảng mới
GRANT SELECT, INSERT, UPDATE, DELETE ON failed_login_attempts TO app_backend;
GRANT ALL PRIVILEGES ON failed_login_attempts TO app_admin;

COMMIT;
