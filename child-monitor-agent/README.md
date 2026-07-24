# Child Monitor Agent

Windows Agent gồm một Service chạy dưới `LocalSystem` và Companion chạy trong
phiên đăng nhập của trẻ. Yêu cầu Windows 10/11, Python 3 và quyền Administrator.

## Cài đặt

Trước tiên đăng ký thiết bị qua Backend để nhận `device_secret`. Mở PowerShell
với quyền Administrator tại thư mục `child-monitor-agent`:

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\install.ps1 `
  -ServerUrl "https://api.example.com" `
  -DeviceSecret "00000000-0000-0000-0000-000000000000"
```

Installer sẽ:

1. Sao chép mã Agent vào `C:\Program Files\ChildMonitorAgent`.
2. Tạo virtual environment và cài dependencies.
3. Xác minh Device Secret bằng heartbeat với Backend.
4. Mã hóa secret bằng Windows DPAPI LocalMachine.
5. Giới hạn ACL file cấu hình cho SYSTEM và Administrators.
6. Cài `ChildMonitorService` ở chế độ Automatic và khởi động Service.
7. Watchdog của Service tự chạy Companion trong phiên đăng nhập hiện hành.

Máy cài đặt offline có thể truyền `-Wheelhouse <đường-dẫn>` chứa các wheel đã
tải trước.

## Xoay Device Secret hoặc đổi Backend

```powershell
powershell -ExecutionPolicy Bypass -File `
  "C:\Program Files\ChildMonitorAgent\installer\provision.ps1" `
  -ServerUrl "https://api.example.com" `
  -DeviceSecret "11111111-1111-1111-1111-111111111111"
```

Provisioning luôn xác minh credential trước khi thay thế file hiện tại. Chỉ dùng
`-SkipValidation` cho phục hồi offline có chủ đích.

## Gỡ cài đặt

Mặc định chỉ gỡ Service và giữ queue/config để có thể phục hồi:

```powershell
powershell -ExecutionPolicy Bypass -File `
  "C:\Program Files\ChildMonitorAgent\installer\uninstall.ps1"
```

Xóa vĩnh viễn cả cấu hình, logs và SQLite queue:

```powershell
powershell -ExecutionPolicy Bypass -File `
  "C:\Program Files\ChildMonitorAgent\installer\uninstall.ps1" -PurgeData
```
