const { Pool } = require('pg');
require('dotenv').config();

const baseConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

// Bypass RLS - chỉ dùng cho register/login và auth middleware (chưa có user context hoặc cần bypass)
const adminPool = new Pool({
  ...baseConfig,
  user: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
});

// Tuân theo RLS - dùng cho mọi route đã qua middleware auth
const backendPool = new Pool({
  ...baseConfig,
  user: process.env.DB_BACKEND_USER,
  password: process.env.DB_BACKEND_PASSWORD,
});

// Bắt lỗi idle connection bị đóng đột ngột để tránh crash process
// Nếu không có handler này, lỗi sẽ bị throw ra process level → server crash
adminPool.on('error', (err) => {
  console.error('adminPool idle client error:', err.message);
});

backendPool.on('error', (err) => {
  console.error('backendPool idle client error:', err.message);
});

module.exports = { adminPool, backendPool };