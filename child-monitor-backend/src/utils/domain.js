const { domainToASCII } = require('node:url');

const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Chuẩn hóa input dạng domain hoặc URL đơn giản thành hostname ASCII.
 * Trả về null nếu dữ liệu không an toàn/không phải hostname DNS hợp lệ.
 */
function normalizeDomain(input) {
  if (typeof input !== 'string') return null;

  // Kiểm tra trước khi trim để không vô tình che giấu payload chèn dòng.
  if (/[\u0000-\u0020\u007f#\\]/.test(input)) return null;

  let candidate = input.toLowerCase();
  candidate = candidate.replace(/^https?:\/\//, '');
  candidate = candidate.replace(/\/.*$/, '');
  candidate = candidate.replace(/^www\./, '');
  candidate = candidate.replace(/\.$/, '');

  if (!candidate || candidate.length < 3) return null;

  const asciiDomain = domainToASCII(candidate);
  if (!asciiDomain || asciiDomain.length > 200 || asciiDomain.length > 253) {
    return null;
  }

  const labels = asciiDomain.split('.');
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL.test(label))) {
    return null;
  }

  return asciiDomain;
}

module.exports = { normalizeDomain };
