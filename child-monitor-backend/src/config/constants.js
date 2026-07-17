/**
 * Các hằng số cấu hình hệ thống dùng chung
 */
module.exports = {
  // Giới hạn số lượng bản ghi tối đa trả về trong một trang của API phân trang
  MAX_PAGINATION_LIMIT: 200,

  // Số ngày lưu trữ dữ liệu logs và alerts trước khi tự động dọn dẹp
  RETENTION_DAYS: 30,
};
