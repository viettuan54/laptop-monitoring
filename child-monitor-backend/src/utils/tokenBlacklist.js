/**
 * Token Blacklist – lưu vào PostgreSQL thay vì in-memory Set.
 *
 * Lý do:
 *  - In-memory Set bị mất khi server restart/crash → token đã logout "sống lại"
 *  - Multi-instance (PM2 cluster, scale ngang): logout ở instance A không có hiệu lực ở instance B
 *
 * Cách hoạt động:
 *  - Mỗi JWT được cấp kèm một `jti` (JWT ID) ngẫu nhiên (UUID)
 *  - Khi logout, lưu jti + expires_at vào bảng token_blacklist
 *  - Middleware auth kiểm tra jti trong bảng này trước khi chấp nhận token
 *  - Cron job định kỳ gọi cleanupExpiredTokens() để dọn dữ liệu cũ
 */

const { adminPool } = require('../config/db');

/**
 * Đưa jti vào blacklist sau khi user logout.
 * @param {string} jti - JWT ID (UUID)
 * @param {Date} expiresAt - Thời điểm token hết hạn (để tự dọn sau)
 */
async function revokeToken(jti, expiresAt) {
  await adminPool.query(
    'INSERT INTO token_blacklist(jti, expires_at) VALUES($1, $2) ON CONFLICT DO NOTHING',
    [jti, expiresAt]
  );
}

/**
 * Kiểm tra xem jti có trong blacklist không.
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
async function isBlacklisted(jti) {
  try {
    const result = await adminPool.query(
      'SELECT 1 FROM token_blacklist WHERE jti = $1',
      [jti]
    );
    return result.rows.length > 0;
  } catch (err) {
    console.error('isBlacklisted DB error:', err.message);
    // Fail-safe: nếu không query được → coi như không bị revoke (tránh block toàn bộ traffic)
    return false;
  }
}

/**
 * Dọn các jti đã hết hạn khỏi bảng token_blacklist.
 * Được gọi bởi cron job trong server.js.
 */
async function cleanupExpiredTokens() {
  try {
    const result = await adminPool.query(
      'DELETE FROM token_blacklist WHERE expires_at < NOW()'
    );
    if (result.rowCount > 0) {
      console.log(`[TokenBlacklist] Đã dọn ${result.rowCount} token hết hạn`);
    }
  } catch (err) {
    console.error('cleanupExpiredTokens DB error:', err.message);
  }
}

/**
 * Dọn các refresh token đã hết hạn khỏi bảng refresh_tokens.
 * Được gọi bởi cron job trong server.js.
 */
async function cleanupExpiredRefreshTokens() {
  try {
    const result = await adminPool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
    if (result.rowCount > 0) {
      console.log(`[TokenBlacklist] Đã dọn ${result.rowCount} refresh token hết hạn`);
    }
  } catch (err) {
    console.error('cleanupExpiredRefreshTokens DB error:', err.message);
  }
}

module.exports = { revokeToken, isBlacklisted, cleanupExpiredTokens, cleanupExpiredRefreshTokens };