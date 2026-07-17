const nodemailer = require('nodemailer');

let transporter = null;

// Khởi tạo transporter dựa trên cấu hình môi trường
const initTransporter = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasSMTP = 
    process.env.SMTP_HOST && 
    process.env.SMTP_PORT && 
    process.env.SMTP_USER && 
    process.env.SMTP_PASSWORD;

  if (isProduction && !hasSMTP) {
    // Fail-fast được kiểm soát từ server.js, nhưng thêm chặn ở đây cho chắc chắn
    throw new Error('❌ Môi trường PRODUCTION yêu cầu cấu hình đầy đủ biến SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.');
  }

  if (hasSMTP) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: parseInt(process.env.SMTP_PORT) === 465, // true cho port 465, false cho các port khác
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    console.log('📬 Nodemailer SMTP Transporter đã được cấu hình thành công.');
  } else {
    // Ở môi trường dev, nếu không có SMTP thì ta không khởi tạo transporter thật
    console.log('📬 Hệ thống đang ở chế độ phát triển và không cấu hình SMTP. Email sẽ được ghi ra console.');
  }
};

/**
 * Gửi email xác minh tài khoản hoặc đặt lại mật khẩu
 * @param {string} to Địa chỉ email nhận
 * @param {string} subject Tiêu đề email
 * @param {string} html Nội dung định dạng HTML
 * @param {string} textFallback Nội dung văn bản thô dự phòng
 */
async function sendMail({ to, subject, html, textFallback }) {
  if (!transporter) {
    // Nếu chưa khởi tạo thì chạy khởi tạo
    initTransporter();
  }

  const from = process.env.SMTP_FROM || '"Laptop Monitor" <no-reply@laptopmonitor.local>';

  if (transporter) {
    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text: textFallback,
        html,
      });
      console.log(`[Email Sent] Email đã gửi thành công tới: ${to}`);
    } catch (err) {
      console.error(`[Email Error] Lỗi khi gửi email tới ${to}:`, err.message);
      // Ở môi trường production, lỗi gửi mail nên được ném ra ngoài để controller xử lý
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
    }
  } else {
    // Chế độ Dev fallback ghi ra console
    console.log('\n=================== MOCK EMAIL SENDING ===================');
    console.log(`FROM: ${from}`);
    console.log(`TO: ${to}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`TEXT FALLBACK:\n${textFallback}`);
    console.log('==========================================================\n');
  }
}

module.exports = {
  sendMail,
  initTransporter,
};
