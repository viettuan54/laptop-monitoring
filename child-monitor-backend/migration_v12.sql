-- =========================================================
-- MIGRATION V12: Trạng thái tài khoản và quản trị người dùng
-- =========================================================

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_role_active
    ON users(role, is_active);

GRANT SELECT, UPDATE, DELETE ON users TO app_backend;
GRANT ALL PRIVILEGES ON users TO app_admin;

COMMIT;
