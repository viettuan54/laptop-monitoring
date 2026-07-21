/**
 * Kiểm tra mật khẩu có đáp ứng chính sách bảo mật hay không:
 * - Tối thiểu 8 ký tự
 * - Ít nhất một chữ cái viết hoa (A-Z)
 * - Ít nhất một chữ số (0-9)
 * - Ít nhất một ký tự đặc biệt (ví dụ: !@#$%^&*...)
 * 
 * @param {string} password Mật khẩu cần kiểm tra
 * @returns {boolean} True nếu mật khẩu hợp lệ, ngược lại False
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }
  
  const minLength = 8;
  const maxLength = 128;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength && password.length <= maxLength && hasUpperCase && hasDigit && hasSpecial;
}

module.exports = {
  validatePassword,
};
