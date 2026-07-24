# Integration tests

## Backend

Các test backend sử dụng PostgreSQL thật và cố ý không fallback sang cấu hình DB thông thường.
Tạo một database test riêng, chạy `Data.sql` cùng các migration mới nhất, sau đó sao chép
`child-monitor-backend/test.env.example` thành `child-monitor-backend/.env.test`.
Test sẽ tự nạp `.env.test` trước `.env`.

`TEST_DB_ADMIN_USER` phải có `BYPASSRLS` để mô phỏng `adminPool`.
`TEST_DB_BACKEND_USER` phải là `NOSUPERUSER NOBYPASSRLS`.

Chạy từ thư mục `child-monitor-backend`:

```powershell
npm test
```

Suite kiểm tra:

- đăng nhập và refresh-token rotation đồng thời;
- cô lập dữ liệu giữa hai phụ huynh bằng RLS thật;
- retry batch idempotent và acknowledgement theo `client_record_id`.

Mỗi lần chạy tạo dữ liệu có prefix ngẫu nhiên và xóa bằng cascade sau khi hoàn tất.

## Agent

Agent test sử dụng SQLite trong thư mục tạm và không thay đổi ACL hoặc database thật:

```powershell
cd child-monitor-agent
.\run_tests.ps1
```

Suite xác nhận queue chỉ đánh dấu `synced` cho ID được backend xác nhận và giữ nguyên
dữ liệu khi acknowledgement bị thiếu.
