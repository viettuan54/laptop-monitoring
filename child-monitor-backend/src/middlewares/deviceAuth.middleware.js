/**
 * Middleware xác thực thiết bị (agent trên laptop con).
 *
 * Cách hoạt động:
 *  - Agent gửi header: X-Device-Secret: <device_secret>
 *  - Middleware tra cứu devices WHERE device_secret = $1
 *  - Nếu hợp lệ → gán req.device = { device_id, child_id, device_name }
 *
 * Tại sao không dùng JWT phụ huynh?
 *  - JWT phụ huynh sống 7 ngày và có toàn quyền trên account (xóa thiết bị, xem alerts...)
 *  - Nếu bị trích xuất từ máy con → rủi ro bảo mật rất lớn
 *  - device_secret chỉ có quyền ghi log, không làm được gì khác
 */

const { adminPool } = require('../config/db');
const crypto = require('crypto');

module.exports = async (req, res, next) => {
  try {
    const deviceSecret = req.headers['x-device-secret'];

    if (!deviceSecret) {
      return res.status(401).json({ message: 'X-Device-Secret header missing' });
    }

    // Validate UUID format cơ bản để tránh query DB với input rác
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(deviceSecret)) {
      return res.status(401).json({ message: 'Invalid device secret format' });
    }

    const hashedSecret = crypto.createHash('sha256').update(deviceSecret).digest('hex');

    // Tra cứu thiết bị theo device_secret đã hash
    // Dùng adminPool vì không có RLS context – device_secret là credential độc lập
    const result = await adminPool.query(
      'SELECT device_id, child_id, device_name FROM devices WHERE device_secret = $1',
      [hashedSecret]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid device secret' });
    }

    // Gán thông tin thiết bị vào request để controller dùng
    req.device = result.rows[0];

    next();
  } catch (error) {
    console.error('Device auth middleware error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
