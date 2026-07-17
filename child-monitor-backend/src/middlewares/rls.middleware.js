const { backendPool } = require('../config/db');

module.exports = async (req, res, next) => {
  let client;
  try {
    client = await backendPool.connect();

    // Thiết lập app.current_user_id cho session hiện tại
    // false = chỉ áp dụng cho session này, không tự động hết hạn khi kết thúc transaction
    await client.query(
      "SELECT set_config('app.current_user_id', $1, false)",
      [String(req.user.user_id)]
    );

    req.db = client;
  } catch (error) {
    console.error('RLS context setup error:', error);
    if (client) client.release();
    return res.status(500).json({ message: 'Internal server error' });
  }

  let released = false;
  const releaseClient = async () => {
    if (!released) {
      released = true;
      try {
        await client.query("RESET app.current_user_id");
      } catch (err) {
        console.error('Error resetting RLS context:', err);
      } finally {
        client.release();
      }
    }
  };

  // Đăng ký giải phóng connection khi request kết thúc hoặc bị ngắt kết nối giữa chừng
  res.on('finish', releaseClient);
  res.on('close', releaseClient);

  next();
};
