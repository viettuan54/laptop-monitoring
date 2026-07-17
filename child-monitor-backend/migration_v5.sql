-- =========================================================
-- MIGRATION V5: Agent API, Privacy Controls, Website Blacklist
-- Chạy bằng tài khoản superuser (postgres):
-- psql -U postgres -d child_monitor_db -f migration_v5.sql
-- =========================================================

BEGIN;

-- =========================================================
-- 1. Thêm last_seen_at vào bảng devices
--    Agent cập nhật field này mỗi khi gửi heartbeat,
--    giúp Backend biết thiết bị nào đang online/offline.
-- =========================================================
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;

-- =========================================================
-- 2. Thêm giá trị mới vào enum alert_type
--    Dành cho cảnh báo từ Computer Vision (Edge AI trên Agent)
--    LƯU Ý: PostgreSQL cho phép ADD VALUE nhưng không cho phép
--    xóa giá trị khỏi enum → chỉ thêm, không sửa.
-- =========================================================
DO $$
BEGIN
    -- Phát hiện tư thế ngồi sai (lưng gù, cúi đầu)
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'posture_warning'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'alert_type')
    ) THEN
        ALTER TYPE alert_type ADD VALUE 'posture_warning';
    END IF;

    -- Phát hiện người lạ đứng sau trẻ
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'stranger_detected'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'alert_type')
    ) THEN
        ALTER TYPE alert_type ADD VALUE 'stranger_detected';
    END IF;

    -- Phát hiện khoảng cách mắt quá gần màn hình
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'eye_distance_warning'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'alert_type')
    ) THEN
        ALTER TYPE alert_type ADD VALUE 'eye_distance_warning';
    END IF;
END $$;

-- =========================================================
-- 3. Thêm page_title vào website_logs
--    Agent sẽ lấy tiêu đề tab trình duyệt và gửi kèm URL
-- =========================================================
ALTER TABLE website_logs ADD COLUMN IF NOT EXISTS page_title VARCHAR(500);

-- =========================================================
-- 4. Thêm Privacy Controls vào bảng settings
--    Phụ huynh bật/tắt từng tính năng nhạy cảm độc lập.
--    Agent đọc các flag này từ /api/agent/config để quyết
--    định có kích hoạt tính năng đó hay không.
-- =========================================================
ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_webcam_monitoring   BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_screenshot_review   BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS enable_keylog              BOOLEAN DEFAULT FALSE;

-- =========================================================
-- 5. Tạo bảng website_blacklist
--    Admin quản lý danh sách domain độc hại toàn cục.
--    Agent và Backend đều có thể đọc để so sánh khi trẻ
--    truy cập website mới.
-- =========================================================
CREATE TABLE IF NOT EXISTS website_blacklist (
    blacklist_id  SERIAL PRIMARY KEY,
    domain        VARCHAR(200) NOT NULL UNIQUE,
    reason        VARCHAR(500),
    added_by      INT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index tìm kiếm nhanh theo domain
CREATE INDEX IF NOT EXISTS idx_blacklist_domain ON website_blacklist(domain);

-- =========================================================
-- 6. Cấp quyền cho app_backend trên các đối tượng mới
-- =========================================================
-- Blacklist: backend được đọc + ghi (admin controller dùng adminPool)
GRANT SELECT, INSERT, UPDATE, DELETE ON website_blacklist TO app_backend;
GRANT ALL PRIVILEGES ON website_blacklist TO app_admin;
GRANT USAGE, SELECT ON SEQUENCE website_blacklist_blacklist_id_seq TO app_backend;
GRANT USAGE, SELECT ON SEQUENCE website_blacklist_blacklist_id_seq TO app_admin;

COMMIT;

-- =========================================================
-- Sau khi chạy xong, kiểm tra bằng các lệnh sau:
-- SELECT column_name FROM information_schema.columns WHERE table_name='devices' AND column_name='last_seen_at';
-- SELECT column_name FROM information_schema.columns WHERE table_name='website_logs' AND column_name='page_title';
-- SELECT column_name FROM information_schema.columns WHERE table_name='settings' AND column_name LIKE 'enable_%';
-- SELECT enumlabel FROM pg_enum WHERE enumtypid=(SELECT oid FROM pg_type WHERE typname='alert_type');
-- SELECT table_name FROM information_schema.tables WHERE table_name='website_blacklist';
-- =========================================================
