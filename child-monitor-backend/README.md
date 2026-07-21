# Child Monitor Backend

Hệ thống giám sát laptop trẻ em (Backend API).

## 🚀 Tính năng nổi bật
* **Bảo mật phân tầng**: Phân tách luồng API Agent (X-Device-Secret đã băm SHA-256) và luồng Phụ huynh (JWT).
* **Bảo mật dữ liệu RLS**: Sử dụng Row Level Security (RLS) ở mức PostgreSQL để ngăn rò rỉ chéo thông tin giữa các phụ huynh.
* **Batch Offline Sync**: Hỗ trợ Agent gửi dữ liệu offline dạng lô bằng PostgreSQL `unnest()` và cơ chế idempotent tránh trùng lặp log khi retry.
* **AI Analysis**: Tự động phân tích xu hướng hành vi 24h và hỗ trợ Chat Advisor bằng Gemini AI (chống Prompt Injection bằng XML tags và code validation).
* **Quyền được lãng quên**: Hỗ trợ endpoint xóa hoàn toàn tài khoản và cascade sạch dữ liệu liên quan.

---

## ⚠️ Lưu ý kỹ thuật & Hạn chế kiến trúc (Technical Limitations)

Khi viết báo cáo hoặc triển khai thực tế, hãy lưu ý các điểm sau để chứng minh sự hiểu biết sâu sắc về hệ thống:

### 1. Phân tán Rate Limit (Distributed Rate Limiting)
* **Hiện tại**: Dự án sử dụng `express-rate-limit` với cơ chế lưu trữ mặc định trong bộ nhớ RAM (`MemoryStore`).
* **Hạn chế**: Nếu triển khai dự án chạy Cluster Mode (nhiều tiến trình CPU song song qua PM2 Cluster) hoặc chạy Auto-Scaling đa server (nhiều instance), số lượng request được tính độc lập trên từng instance. Điều này dẫn tới việc Rate Limit không được đồng bộ hóa hoàn toàn trên toàn cụm.
* **Giải pháp nâng cấp**: Khi chuyển sang production thực tế, cần thay thế bộ nhớ MemoryStore mặc định bằng **Redis Store** thông qua thư viện `@express-rate-limit/redis` để quản lý tập trung và chia sẻ giới hạn request giữa các server.

### 2. Audit Log (Nhật ký kiểm toán)
* **Hiện tại**: Các hành động nhạy cảm như thêm/xóa tên miền độc hại trong website blacklist, xoá thiết bị, hay thay đổi mật khẩu chưa được ghi vết lịch sử hoạt động (Audit Logs).
* **Khuyến nghị**: Cần thiết kế thêm bảng `audit_logs` để ghi vết người thực hiện, thời gian và payload của các thay đổi quản trị nhạy cảm nhằm mục tiêu tuân thủ an toàn thông tin trẻ em.