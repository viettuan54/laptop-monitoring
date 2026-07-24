import os
import sys
import time
import logging
import threading
import win32ts
import win32process
import win32security
import win32con
import win32profile

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

class Watchdog:
    """
    Module Watchdog có nhiệm vụ:
    1. Spawn và duy trì tiến trình UI Companion (main_companion.py) dưới User Session tương ứng.
    2. Lắng nghe/xử lý thay đổi Session (Logon/Logoff/Switch User) và thông báo tới PipeServer để cập nhật DACL theo SID của User mới.
    """
    def __init__(self, pipe_server=None):
        self.pipe_server = pipe_server
        self.running = False
        self.companion_process_handle = None
        self.monitor_thread = None

    def get_active_session_user_sid(self, session_id):
        """Lấy Token và User SID của Session đang làm việc (Active Console Session)."""
        try:
            user_token = win32ts.WTSQueryUserToken(session_id)
            token_user = win32security.GetTokenInformation(user_token, win32security.TokenUser)
            user_sid = token_user[0]
            return user_token, user_sid
        except Exception as e:
            logging.warning(f"Could not query user token for Session {session_id}: {e}")
            return None, None

    def spawn_companion_process(self):
        """Khởi chạy main_companion.py trong Active User Session bằng CreateProcessAsUser."""
        try:
            session_id = win32ts.WTSGetActiveConsoleSessionId()
            if session_id == 0xFFFFFFFF or session_id == 0:
                logging.info("No active console user session detected currently.")
                return False

            user_token, user_sid = self.get_active_session_user_sid(session_id)
            if not user_token:
                logging.warning(f"Unable to obtain User Token for Session {session_id}")
                return False

            # Cập nhật PipeServer DACL cho User SID mới
            if self.pipe_server:
                self.pipe_server.recreate_pipe(new_user_sid=user_sid)

            # Xกำหนด đường dẫn tới python.exe và main_companion.py
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            companion_script = os.path.join(base_dir, "companion", "main_companion.py")
            python_exe = sys.executable

            cmd_line = f'"{python_exe}" "{companion_script}"'

            # Thiết lập Environment block cho User Token
            env = win32profile.CreateEnvironmentBlock(user_token, False)

            startup_info = win32process.STARTUPINFO()
            startup_info.dwFlags = win32process.STARTF_USESHOWWINDOW
            startup_info.wShowWindow = win32con.SW_HIDE

            # Duplicate Token với đầy đủ quyền để spawn tiến trình
            primary_token = win32security.DuplicateTokenEx(
                user_token,
                win32security.SecurityImpersonation,
                win32security.TOKEN_ALL_ACCESS,
                win32security.TokenPrimary
            )

            h_process, h_thread, dw_proc_id, dw_thread_id = win32process.CreateProcessAsUser(
                primary_token,
                None,
                cmd_line,
                None,
                None,
                False,
                win32process.CREATE_NO_WINDOW | win32process.CREATE_UNICODE_ENVIRONMENT,
                env,
                os.path.dirname(companion_script),
                startup_info
            )

            self.companion_process_handle = h_process
            logging.info(f"Successfully spawned Companion process PID={dw_proc_id} in Session {session_id}")
            return True

        except Exception as e:
            logging.error(f"Failed to spawn companion process via CreateProcessAsUser: {e}")
            return False

    def on_session_change(self, event, session_id):
        """Callback được gọi khi Windows Service nhận sự kiện thay đổi Session."""
        logging.info(f"Session change event received: {event} for Session ID: {session_id}")
        user_token, user_sid = self.get_active_session_user_sid(session_id)
        if self.pipe_server and user_sid:
            self.pipe_server.recreate_pipe(new_user_sid=user_sid)
        
        # Tự động spawn lại Companion cho Session mới
        self.spawn_companion_process()

    def start(self):
        """Khởi chạy Watchdog background thread để duy trì Companion."""
        self.running = True
        self.monitor_thread = threading.Thread(target=self._watchdog_loop, daemon=True)
        self.monitor_thread.start()
        logging.info("Watchdog thread started.")

    def stop(self):
        self.running = False

    def _watchdog_loop(self):
        while self.running:
            try:
                # Nếu tiến trình chưa được tạo hoặc đã kết thúc, thử spawn lại
                if not self.companion_process_handle:
                    self.spawn_companion_process()
                else:
                    exit_code = win32process.GetExitCodeProcess(self.companion_process_handle)
                    if exit_code != win32con.STILL_ACTIVE:
                        logging.warning(f"Companion process terminated with exit code {exit_code}. Respawning...")
                        self.companion_process_handle = None
                        self.spawn_companion_process()
            except Exception as e:
                logging.error(f"Watchdog loop error: {e}")

            time.sleep(10)
