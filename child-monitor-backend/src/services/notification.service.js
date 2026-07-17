/**
 * Dịch vụ gửi thông báo đẩy (Push Notification Service)
 *
 * Cách hoạt động:
 *  - Nhận vào userId của phụ huynh, tiêu đề và nội dung tin nhắn.
 *  - Ở môi trường phát triển (Development): Ghi log thông báo ra console để kiểm tra luồng.
 *  - Ở môi trường Production: Tích hợp với dịch vụ Firebase Cloud Messaging (FCM) hoặc Expo Push API.
 */

/**
 * Gửi thông báo đẩy đến tất cả thiết bị đã đăng ký của một phụ huynh
 * @param {number} userId ID của người dùng phụ huynh
 * @param {string} title Tiêu đề của thông báo
 * @param {string} message Nội dung của thông báo
 */
async function sendPushNotification(userId, title, message) {
  const isProduction = process.env.NODE_ENV === 'production';

  // LƯU Ý: Phụ huynh có thể đăng ký nhiều thiết bị nhận thông báo (push token)
  // Luồng hoàn chỉnh:
  // 1. SELECT push_token FROM user_devices WHERE user_id = $1
  // 2. Nếu có token, gọi dịch vụ FCM / Expo để đẩy
  
  if (isProduction) {
    console.log(`[Push Notification Production] Sending notification to User ${userId}...`);
    // Ví dụ cấu hình Firebase Admin SDK gửi tin nhắn:
    // const messagePayload = {
    //   notification: { title, body: message },
    //   token: recipientPushToken
    // };
    // admin.messaging().send(messagePayload);
  } else {
    // Môi trường Dev/Test log ra console
    console.log('\n=================== MOCK PUSH NOTIFICATION ===================');
    console.log(`TO USER ID: ${userId}`);
    console.log(`TITLE     : ${title}`);
    console.log(`MESSAGE   : ${message}`);
    console.log('==============================================================\n');
  }
}

module.exports = {
  sendPushNotification,
};
