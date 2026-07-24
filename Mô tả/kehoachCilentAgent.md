# Kế Hoạch Triển Khai Hoàn Chỉnh — Python Client Agent
### Hệ thống Giám sát Laptop Trẻ Em (Windows)

---

## 1. Tổng quan kiến trúc

Agent được chia thành **2 tiến trình tách biệt** chạy ở 2 session khác nhau, giao tiếp qua Named Pipe, để giải quyết đúng vấn đề Windows Session 0 Isolation:

```
┌─────────────────────────────────────────────────────────────────┐
│  SESSION 0 (SYSTEM)                                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Core Service (childmonitor_service.py)                    │  │
│  │  - win32serviceutil.ServiceFramework, Auto Start            │  │
│  │  - Network sync (heartbeat, batch upload, config pull)      │  │
│  │  - offline_queue.py (SQLite: app_logs, web_logs, daily_usage)│  │
│  │  - web_tracker.py (đọc file History Chrome/Edge)            │  │
│  │  - enforcement_core.py (ghi hosts file, tính daily_usage,   │  │
│  │    quyết định is_locked/time_exceeded)                       │  │
│  │  - Named Pipe Server (2 chiều)                               │  │
│  │  - Watchdog: giám sát & spawn lại UI Companion               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │  CreateProcessAsUser /                │
│                          │  WTSSendMessage                       │
│                          ▼                                       │
├─────────────────────────────────────────────────────────────────┤
│  SESSION 1 (User đăng nhập — trẻ em)                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  UI Companion (companion.py) — chạy dưới session của trẻ    │  │
│  │  - app_tracker.py (GetForegroundWindow — BẮT BUỘC ở đây)     │  │
│  │  - Hiển thị cảnh báo đếm ngược, khóa màn hình                │  │
│  │  - Named Pipe Client (gửi tracking data lên Service,         │  │
│  │    nhận lệnh khóa/cảnh báo từ Service)                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc phân chia:** bất cứ thứ gì cần đọc trạng thái desktop/foreground window của trẻ phải chạy trong session của trẻ (UI Companion); bất cứ thứ gì cần chạy bền vững, không phụ thuộc đăng nhập, hoặc cần quyền hệ thống (network, hosts file, service control) thuộc về Core Service.

---

## 2. Công nghệ sử dụng

| Nhóm | Thư viện / Công cụ |
|---|---|
| Ngôn ngữ | Python 3.10+ |
| Windows API | `pywin32` (`win32gui`, `win32process`, `win32crypt`, `win32serviceutil`, `win32ts`, `win32security`) |
| HTTP | `requests` |
| Lưu trữ cục bộ | `sqlite3` |
| Thông tin tiến trình | `psutil` |
| IPC | Named Pipes (`win32pipe`, `win32file`) |
| Đóng gói | PyInstaller (2 executable: service + companion) |
| Cài đặt | Inno Setup hoặc WiX Toolset |
| Phương án dự phòng cho Service | NSSM (nếu `ServiceFramework` + PyInstaller gặp vướng mắc đóng gói) |

---

## 3. Cấu trúc thư mục

```
agent/
├── service/
│   ├── main_service.py         # ServiceFramework entrypoint
│   ├── api_client.py           # HTTP client, header X-Device-Secret, backoff, xử lý 401
│   ├── offline_queue.py        # SQLite: enqueue, batch sync, daily_usage
│   ├── web_tracker.py          # Đọc History Chrome/Edge, multi-profile
│   ├── enforcement_core.py     # Hosts file blocking, tính time_exceeded/is_locked
│   ├── watchdog.py             # Giám sát & spawn lại UI Companion
│   └── pipe_server.py          # Named Pipe server (2 chiều)
├── companion/
│   ├── main_companion.py       # Entry point chạy trong session user
│   ├── app_tracker.py          # GetForegroundWindow polling
│   ├── ui_alerts.py            # Toast cảnh báo, đếm ngược, màn hình khóa
│   └── pipe_client.py          # Named Pipe client
├── config/
│   ├── local_config.json       # server_url, device_secret (mã hóa DPAPI)
│   ├── settings_cache.json     # config + blacklisted_domains cache
│   └── tracker_checkpoint.json # checkpoint đọc History theo từng profile
├── db/
│   └── local.db                # SQLite: app_logs, web_logs, daily_usage
├── installer/
│   ├── setup.iss               # Inno Setup script
│   └── build.spec              # PyInstaller spec (build 2 exe)
└── logs/
    └── agent.log                # log lỗi 401, crash, hosts update...
```

---

## 4. Chi tiết từng thành phần

### 4.1 Core Service — `main_service.py`

- Định nghĩa bằng `win32serviceutil.ServiceFramework`, `SERVICE_AUTO_START`, chạy dưới **Local System**.
- Khởi động 3 vòng lặp nền (thread hoặc `asyncio` task):
  - **Heartbeat loop**: mỗi 60s → `POST /api/agent/heartbeat`, cập nhật `settings_cache.json`.
  - **Config/blacklist loop**: mỗi 10 phút → `GET /api/agent/config`, cập nhật `blacklisted_domains`, trigger `enforcement_core.update_hosts_file()`.
  - **Sync loop**: sau mỗi heartbeat thành công → `offline_queue.sync_offline_data()`.
- Khởi động `pipe_server.py` và `watchdog.py` ngay khi service start.
- Bắt toàn bộ exception ở mức thread wrapper: log lỗi, khởi động lại thread sau X giây thay vì để chết âm thầm.

### 4.2 `api_client.py`

- Giải mã `device_secret` qua `win32crypt.CryptUnprotectData` trước mỗi lần gọi API (hoặc cache trong RAM sau lần đầu, không ghi plaintext ra đĩa/log).
- Tự động đính kèm header `X-Device-Secret`.
- Retry với Exponential Backoff cho lỗi kết nối (timeout, DNS fail, 5xx).
- **Xử lý 401 riêng biệt** (không backoff vô hạn):
  1. Dừng ngay các lần gọi tiếp theo, đặt cờ `suspended = True`.
  2. Ghi log rõ ràng vào `agent.log`: "Device secret bị từ chối — cần cấu hình lại".
  3. Bắt đầu theo dõi `mtime` của `local_config.json` mỗi 5 giây (hoặc dùng `ReadDirectoryChangesW` nếu muốn realtime hơn polling).
  4. Khi phát hiện file thay đổi → giải mã lại secret mới, gọi thử 1 request kiểm tra (`/api/agent/heartbeat`), nếu thành công thì bỏ cờ `suspended`, resume toàn bộ vòng lặp.

### 4.3 `offline_queue.py`

**Schema SQLite:**
```sql
CREATE TABLE IF NOT EXISTS app_logs (
    client_record_id TEXT PRIMARY KEY,
    app_name TEXT, category TEXT,
    start_time TEXT, end_time TEXT, duration_seconds INTEGER,
    synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS web_logs (
    client_record_id TEXT PRIMARY KEY,
    url TEXT, domain TEXT, category TEXT,
    visit_time TEXT, duration_seconds INTEGER, page_title TEXT,
    synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_usage (
    date TEXT PRIMARY KEY,       -- YYYY-MM-DD theo giờ local
    seconds_used INTEGER DEFAULT 0
);
```

- `client_record_id` = `str(uuid.uuid4())` sinh **ngay lúc enqueue**, không sinh lại lúc sync — đảm bảo idempotency đúng với `ON CONFLICT DO NOTHING` phía backend.
- `sync_offline_data(api_client)`:
  1. `SELECT * FROM app_logs WHERE synced = 0 LIMIT 100` (và tương tự cho `web_logs`).
  2. Gửi từng chunk tối đa 100 bản ghi tới `/api/logs/app/batch` / `/api/logs/web/batch`.
  3. Sau mỗi request thành công, `UPDATE ... SET synced = 1` cho các `client_record_id` đã inserted (không chỉ dựa vào response mà nên đối chiếu cả `duplicates` trả về, vì cả 2 trường hợp đều coi là đã đồng bộ xong).
  4. Delay ~200ms giữa các batch để tránh chạm `agentLimiter` (600 req/15 phút).
- `add_daily_usage(seconds)`:
  - Lấy `date` local hiện tại, `INSERT ... ON CONFLICT(date) DO UPDATE SET seconds_used = seconds_used + excluded.seconds_used`.
  - Đảm bảo hàm này **idempotent về mặt cộng dồn** (không double-count) — chỉ được gọi từ một nơi duy nhất (Core Service, dựa trên dữ liệu tracking nhận qua pipe từ Companion), tránh việc cả Companion và Service cùng tính toán gây lệch số liệu.
- Dọn dữ liệu đã sync quá X ngày (ví dụ 7 ngày) để `local.db` không phình to.

### 4.4 `web_tracker.py`

- Chạy trong Core Service (chỉ đọc file trên đĩa, không cần session context).
- Quét định kỳ mỗi 30 giây:
  - Liệt kê toàn bộ thư mục con dạng `Default`, `Profile 1`, `Profile 2`... trong:
    - `%LOCALAPPDATA%\Google\Chrome\User Data\`
    - `%LOCALAPPDATA%\Microsoft\Edge\User Data\`
  - Với mỗi profile: copy file `History` ra file tạm (tránh lỗi `database is locked`), query bảng `urls`/`visits` của SQLite History.
  - Checkpoint theo từng profile lưu trong `tracker_checkpoint.json` (key: `"{browser}:{profile}"` → last visit_time đã đọc), chỉ lấy bản ghi mới hơn checkpoint.
- Đẩy log vào `offline_queue.enqueue_web_log(...)` kèm `client_record_id`.

### 4.5 `enforcement_core.py` (chạy trong Core Service)

**a) Chặn website chủ động — Hosts file:**
- Đọc `blacklisted_domains` từ `settings_cache.json`.
- Với mỗi domain, sinh thêm biến thể `www.<domain>` để tăng độ phủ.
- Ghi đè khối nội dung giữa marker:
  ```
  # === LAPTOP-MONITOR START ===
  127.0.0.1 example.com
  127.0.0.1 www.example.com
  # === LAPTOP-MONITOR END ===
  ```
  vào `C:\Windows\System32\drivers\etc\hosts`, chỉ thay phần giữa 2 marker, giữ nguyên phần còn lại của file.
- Sau khi ghi xong, chạy `ipconfig /flushdns` để hiệu lực ngay lập tức.
- Dùng `threading.Lock` khi ghi để tránh 2 luồng (heartbeat loop và config loop) ghi đè nhau.
- Khi service dừng/uninstall: xóa sạch khối nội dung giữa 2 marker (không xóa cả file hosts).

**b) Time schedule & limits:**
- So sánh giờ local hiện tại với `allowed_start_time`–`allowed_end_time` từ cache.
- Đọc `seconds_used` của ngày hiện tại từ `daily_usage`; nếu vượt `daily_limit_minutes * 60` → gửi lệnh qua pipe cho Companion hiển thị đếm ngược 5 phút rồi khóa máy.
- Nếu `is_locked = true` (phụ huynh khóa thủ công) → gửi lệnh khóa ngay qua pipe.
- **Offline enforcement lúc service khởi động**: đọc ngay `settings_cache.json` cũ, áp policy trước khi chờ heartbeat đầu tiên thành công.
- Xử lý transition qua ngày mới: khi `date` hiện tại khác `date` mới nhất trong `daily_usage`, không cần reset thủ công vì `ON CONFLICT` theo `date` tự tạo dòng mới — nhưng cần đảm bảo chỉ Core Service tính `date` (không để Companion tự tính riêng gây lệch).

### 4.6 `pipe_server.py` / `pipe_client.py` — IPC 2 chiều

- Named Pipe, ví dụ `\\.\pipe\ChildMonitorAgent`.
- **Bảo mật pipe**: tạo với Security Descriptor giới hạn — chỉ SYSTEM và đúng SID của tiến trình Companion do chính Service spawn ra mới được kết nối; từ chối mọi kết nối khác.
- Chiều Service → Companion: lệnh `LOCK_NOW`, `SHOW_WARNING(seconds_left)`, `UPDATE_STATUS`.
- Chiều Companion → Service: dữ liệu tracking `{app_name, start_time, end_time, duration_seconds}` để Service ghi vào `offline_queue` và cộng dồn `daily_usage`.

### 4.7 `watchdog.py` (trong Core Service)

- Dùng `WTSQueryUserToken` lấy token của session user đang đăng nhập.
- Dùng `CreateProcessAsUser` (cần privilege `SE_TCB_NAME`, `SE_ASSIGNPRIMARYTOKEN_NAME` trong token của Service) để spawn `companion.exe` vào đúng session desktop của trẻ.
- Lưu PID vừa spawn, poll bằng `OpenProcess`/`WaitForSingleObject` định kỳ (ví dụ mỗi 5s); nếu process không còn tồn tại → spawn lại ngay.
- Theo dõi sự kiện đổi session (user logout/login lại, switch user) qua `WTSRegisterSessionNotification` để spawn Companion đúng session mới, tránh trường hợp nhiều user dùng chung máy.

### 4.8 UI Companion — `main_companion.py`

- Chạy dưới session/quyền của trẻ (Standard User).
- `app_tracker.py`: polling `win32gui.GetForegroundWindow()` mỗi 3 giây, lấy tên tiến trình qua `win32process.GetWindowThreadProcessId` + `psutil`.
  - Bỏ qua ghi nhận nếu thời gian dùng cửa sổ đó dưới 3 giây (lọc nhiễu Alt-Tab).
  - Gửi dữ liệu qua pipe cho Service, **không tự ghi SQLite hay tự tính `daily_usage`** (tránh trùng logic 2 nơi).
- `ui_alerts.py`: nhận lệnh từ Service qua pipe, hiển thị toast cảnh báo hết giờ (đếm ngược 5 phút), gọi `ctypes.windll.user32.LockWorkStation()` khi nhận `LOCK_NOW`.
- Nếu Companion tự thoát hoặc bị kill: Service (qua `watchdog.py`) phát hiện và spawn lại.

---

## 5. Bảo mật dữ liệu

| Dữ liệu | Biện pháp |
|---|---|
| `device_secret` | Mã hóa bằng `win32crypt.CryptProtectData` (DPAPI), chỉ giải mã trong RAM lúc cần gọi API |
| `local.db` (logs, daily_usage) | Giới hạn quyền file bằng `icacls` — chỉ SYSTEM/Administrators đọc-ghi |
| Named Pipe | Security Descriptor giới hạn SID, không tin client lạ |
| Giao tiếp Agent ↔ Backend | Bắt buộc HTTPS ở môi trường production |
| Webcam/ảnh (Phase sau) | Xử lý on-device, không lưu file tạm, không upload ảnh thô |

---

## 6. Đóng gói & Cài đặt

1. **Build 2 executable riêng** bằng PyInstaller: `childmonitor_service.exe` và `childmonitor_companion.exe`.
   - Kiểm tra kỹ việc bundle `pythonservice.exe`/DLL của `pywin32` — test build sớm, có phương án dự phòng dùng **NSSM** để wrap script nếu `ServiceFramework` gặp vướng mắc đóng gói.
2. **Installer** (Inno Setup hoặc WiX), chạy với quyền Admin, thực hiện:
   - Copy file vào `Program Files`.
   - Đăng ký Service (`sc create` hoặc gọi trực tiếp hàm install của `win32serviceutil`), set Auto Start.
   - Ghi `local_config.json` ban đầu với `server_url` + `device_secret` (mã hóa DPAPI ngay lúc cài đặt).
3. **Uninstaller** phải:
   - `sc stop` + `sc delete` service.
   - Dọn khối `# === LAPTOP-MONITOR START/END ===` khỏi hosts file.
   - Xóa `local.db`, `config/`, log.

---

## 7. Rủi ro cần lường trước & phương án ứng phó

| Rủi ro | Phương án |
|---|---|
| Windows Defender/AV gắn cờ (Service SYSTEM + `CreateProcessAsUser` + sửa hosts file giống hành vi rootkit) | Code signing nếu triển khai thật; khi demo, thêm exception thủ công hoặc tắt tạm real-time protection trên máy test |
| DNS cache khiến hosts file chưa có hiệu lực ngay | Luôn `ipconfig /flushdns` sau mỗi lần cập nhật |
| Trình duyệt dùng DNS-over-HTTPS bỏ qua hosts file | Cần test thực tế trên phiên bản Chrome/Edge cụ thể lúc demo; nêu rõ đây là giới hạn đã biết |
| Trẻ có quyền Admin trên máy | Toàn bộ mô hình chống-tắt giả định trẻ chỉ có tài khoản Standard User — cần nêu rõ giả định này khi trình bày |
| PyInstaller + `ServiceFramework` lỗi đóng gói | Test sớm; dự phòng bằng NSSM |
| Companion bị kill liên tục | Watchdog restart, nhưng nếu trẻ có quyền cao có thể vô hiệu hóa — nằm ngoài phạm vi kỹ thuật thuần Agent |
| Mất dữ liệu `daily_usage` khi crash | Đã lưu bền trong SQLite (Service), không phụ thuộc RAM |

---

## 8. Lộ trình triển khai đề xuất (Phase)

1. **Phase 1 — Core Service khung xương**: service chạy được, heartbeat, config cache, xử lý 401, DPAPI secret.
2. **Phase 2 — Offline queue & sync**: SQLite, batch upload, `daily_usage` schema.
3. **Phase 3 — Web tracker**: đọc History đa profile, checkpoint.
4. **Phase 4 — IPC + Companion cơ bản**: Named Pipe 2 chiều, spawn Companion, `app_tracker` trong Companion.
5. **Phase 5 — Enforcement**: hosts file blocking, time schedule, daily limit, khóa máy, cảnh báo đếm ngược.
6. **Phase 6 — Watchdog & resilience**: tự phục hồi luồng, tự phục hồi Companion, xử lý đổi session.
7. **Phase 7 — Đóng gói & cài đặt**: PyInstaller, Inno Setup/WiX, test uninstall sạch.
8. **Phase 8 (mở rộng, nếu còn thời gian)** — Computer Vision (MediaPipe) và phát hiện hành vi bất thường (Isolation Forest), theo đúng đề cương gốc.

---

*Tài liệu này tổng hợp toàn bộ các điều chỉnh đã thảo luận: idempotency qua `client_record_id`, chunk + throttle batch sync, xử lý 401 với auto-recovery, đa profile trình duyệt, chặn website chủ động qua hosts file, `daily_usage` bền vững chống crash, và tách Core Service (Session 0) khỏi UI Companion (session user) để giải quyết đúng giới hạn Session 0 Isolation của Windows.*
