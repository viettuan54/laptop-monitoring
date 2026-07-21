-- =========================================================
-- MIGRATION V9: Create dedicated DB user (app_backend) for RLS
--
-- PROBLEM: If DB_BACKEND_USER = DB_ADMIN_USER (postgres/superuser),
-- PostgreSQL skips all RLS policies -> parents can see each other's data.
--
-- SOLUTION: Create a non-superuser role app_backend.
--
-- Run as superuser (postgres):
-- psql -U postgres -d child_monitor_db -f migration_v9.sql
--
-- Then update .env:
--   DB_BACKEND_USER=app_backend
--   DB_BACKEND_PASSWORD=<strong_password>
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Create role app_backend if it does not exist
--    (non-superuser so RLS takes effect)
-- =========================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_backend') THEN
        -- WARNING: Replace 'CHANGE_ME_BACKEND_PASSWORD' with a real strong password
        CREATE ROLE app_backend LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
        RAISE NOTICE 'Role app_backend created.';
    ELSE
        RAISE NOTICE 'Role app_backend already exists, skipping.';
    END IF;
END $$;

-- =========================================================
-- 2. Grant connect and schema usage
-- =========================================================
GRANT CONNECT ON DATABASE child_monitor_db TO app_backend;
GRANT USAGE ON SCHEMA public TO app_backend;

-- =========================================================
-- 3. Grant DML on required tables to app_backend
-- =========================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
    users, children, devices, app_usage, website_logs,
    settings, ai_analysis, alerts, token_blacklist, refresh_tokens, website_blacklist,
    failed_login_attempts
TO app_backend;

-- Grant usage on sequences (for INSERT with SERIAL/BIGSERIAL columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backend;

-- Ensure future tables/sequences also have the right permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_backend;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_backend;

-- =========================================================
-- 4. Ensure app_backend does NOT have BYPASSRLS
--    (required for RLS to take effect)
-- =========================================================
ALTER ROLE app_backend NOBYPASSRLS;

-- =========================================================
-- 5. Enable RLS on all tables that need protection
--    (safe to re-run if already enabled)
-- =========================================================
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE children      ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_usage     ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts        ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 6. Create RLS policies if they do not exist
-- =========================================================

-- Table users: can only see own record
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_self') THEN
        CREATE POLICY users_self ON users
        USING (user_id = current_setting('app.current_user_id', true)::INT);
    END IF;
END $$;

-- Table children
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='children' AND policyname='children_owner') THEN
        CREATE POLICY children_owner ON children
        USING (user_id = current_setting('app.current_user_id', true)::INT);
    END IF;
END $$;

-- Table devices
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='devices' AND policyname='devices_owner') THEN
        CREATE POLICY devices_owner ON devices
        USING (child_id IN (
            SELECT child_id FROM children
            WHERE user_id = current_setting('app.current_user_id', true)::INT
        ));
    END IF;
END $$;

-- Table app_usage
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_usage' AND policyname='appusage_owner') THEN
        CREATE POLICY appusage_owner ON app_usage
        USING (device_id IN (
            SELECT d.device_id FROM devices d
            JOIN children c ON d.child_id = c.child_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::INT
        ));
    END IF;
END $$;

-- Table website_logs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='website_logs' AND policyname='weblogs_owner') THEN
        CREATE POLICY weblogs_owner ON website_logs
        USING (device_id IN (
            SELECT d.device_id FROM devices d
            JOIN children c ON d.child_id = c.child_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::INT
        ));
    END IF;
END $$;

-- Table settings
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='settings' AND policyname='settings_owner') THEN
        CREATE POLICY settings_owner ON settings
        USING (child_id IN (
            SELECT child_id FROM children
            WHERE user_id = current_setting('app.current_user_id', true)::INT
        ));
    END IF;
END $$;

-- Table ai_analysis
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ai_analysis' AND policyname='analysis_owner') THEN
        CREATE POLICY analysis_owner ON ai_analysis
        USING (device_id IN (
            SELECT d.device_id FROM devices d
            JOIN children c ON d.child_id = c.child_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::INT
        ));
    END IF;
END $$;

-- Table alerts
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='alerts' AND policyname='alerts_owner') THEN
        CREATE POLICY alerts_owner ON alerts
        USING (device_id IN (
            SELECT d.device_id FROM devices d
            JOIN children c ON d.child_id = c.child_id
            WHERE c.user_id = current_setting('app.current_user_id', true)::INT
        ));
    END IF;
END $$;

COMMIT;

-- =========================================================
-- After running, verify:
-- SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_backend';
-- -- Expected: rolsuper=false, rolbypassrls=false
--
-- SELECT tablename, policyname FROM pg_policies ORDER BY tablename;
-- -- Check that all policies were created
-- =========================================================
