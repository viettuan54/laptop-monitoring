const { adminPool } = require('../config/db');

/**
 * GET /api/admin/users
 * Lấy danh sách toàn bộ users trong hệ thống.
 * Chỉ admin mới có quyền truy cập (được enforce bởi requireRole('admin')).
 */
exports.getUsers = async (req, res) => {
  let { limit, offset } = req.query;

  limit = Math.min(parseInt(limit) || 50, 500);
  offset = Math.max(parseInt(offset) || 0, 0);

  try {
    // Single query combining user retrieval and total count via JSON aggregation.
    // This always returns 1 row containing both the total count and the paginated user list.
    const result = await adminPool.query(
      `SELECT 
         (SELECT COUNT(*) FROM users) AS total,
         COALESCE(json_agg(t), '[]'::json) AS data
       FROM (
         SELECT user_id, name, email, role, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2
       ) t`,
      [limit, offset]
    );

    const { total, data } = result.rows[0];

    res.json({
      data,
      total: parseInt(total) || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Admin getUsers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/admin/stats
 * Thống kê tổng quan hệ thống dành cho admin dashboard.
 * Trả về: tổng users, tổng children, tổng devices, số alerts hôm nay,
 *          số thiết bị đang online (heartbeat trong 5 phút qua).
 */
exports.getStats = async (req, res) => {
  try {
    const result = await adminPool.query(`
      SELECT
        (SELECT COUNT(*) FROM users)    AS total_users,
        (SELECT COUNT(*) FROM children) AS total_children,
        (SELECT COUNT(*) FROM devices)  AS total_devices,
        (SELECT COUNT(*) FROM alerts  WHERE created_at >= CURRENT_DATE) AS alerts_today,
        (SELECT COUNT(*) FROM devices WHERE last_seen_at > NOW() - INTERVAL '5 minutes') AS devices_online,
        (SELECT COUNT(*) FROM website_blacklist) AS blacklist_count
    `);

    const stats = result.rows[0];

    res.json({
      total_users:     parseInt(stats.total_users)     || 0,
      total_children:  parseInt(stats.total_children)  || 0,
      total_devices:   parseInt(stats.total_devices)   || 0,
      alerts_today:    parseInt(stats.alerts_today)    || 0,
      devices_online:  parseInt(stats.devices_online)  || 0,
      blacklist_count: parseInt(stats.blacklist_count) || 0,
    });
  } catch (error) {
    console.error('Admin getStats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/admin/blacklist
 * Lấy danh sách website blacklist toàn cục (có phân trang).
 * ?search=domain&limit=50&offset=0
 */
exports.getBlacklist = async (req, res) => {
  let { limit, offset, search } = req.query;

  limit  = Math.min(parseInt(limit) || 50, 500);
  offset = Math.max(parseInt(offset) || 0, 0);

  try {
    let result;
    if (search) {
      result = await adminPool.query(
        `SELECT 
           (SELECT COUNT(*) FROM website_blacklist WHERE domain ILIKE $1) AS total,
           COALESCE(json_agg(t), '[]'::json) AS data
         FROM (
           SELECT b.blacklist_id, b.domain, b.reason, b.created_at,
                  u.name AS added_by_name
           FROM website_blacklist b
           LEFT JOIN users u ON b.added_by = u.user_id
           WHERE b.domain ILIKE $1
           ORDER BY b.created_at DESC
           LIMIT $2 OFFSET $3
         ) t`,
        [`%${search}%`, limit, offset]
      );
    } else {
      result = await adminPool.query(
        `SELECT 
           (SELECT COUNT(*) FROM website_blacklist) AS total,
           COALESCE(json_agg(t), '[]'::json) AS data
         FROM (
           SELECT b.blacklist_id, b.domain, b.reason, b.created_at,
                  u.name AS added_by_name
           FROM website_blacklist b
           LEFT JOIN users u ON b.added_by = u.user_id
           ORDER BY b.created_at DESC
           LIMIT $1 OFFSET $2
         ) t`,
        [limit, offset]
      );
    }

    const { total, data } = result.rows[0];

    res.json({
      data,
      total: parseInt(total) || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Admin getBlacklist error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/admin/blacklist
 * Thêm domain vào danh sách đen toàn cục.
 * Body: { domain, reason }
 */
exports.addBlacklist = async (req, res) => {
  const { domain, reason } = req.body;
  const adminUserId = req.currentUser.user_id;

  if (!domain || typeof domain !== 'string' || domain.trim().length === 0) {
    return res.status(400).json({ message: 'domain is required' });
  }

  // Chuẩn hóa domain: bỏ protocol và trailing slash
  const normalizedDomain = domain.trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();

  if (!normalizedDomain || normalizedDomain.length < 3) {
    return res.status(400).json({ message: 'Invalid domain format' });
  }

  if (normalizedDomain.length > 200) {
    return res.status(400).json({ message: 'Domain cannot exceed 200 characters' });
  }

  if (reason && reason.length > 500) {
    return res.status(400).json({ message: 'Reason cannot exceed 500 characters' });
  }

  try {
    const result = await adminPool.query(
      `INSERT INTO website_blacklist(domain, reason, added_by)
       VALUES($1, $2, $3)
       RETURNING blacklist_id, domain, reason, created_at`,
      [normalizedDomain, reason?.trim() || null, adminUserId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Domain already in blacklist' });
    }
    console.error('Admin addBlacklist error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /api/admin/blacklist/:id
 * Xóa domain khỏi danh sách đen.
 */
exports.deleteBlacklist = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await adminPool.query(
      'DELETE FROM website_blacklist WHERE blacklist_id = $1 RETURNING blacklist_id, domain',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Blacklist entry not found' });
    }

    res.json({ message: 'Removed from blacklist', ...result.rows[0] });
  } catch (error) {
    console.error('Admin deleteBlacklist error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
