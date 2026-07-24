import os
import sys
import tempfile
import unittest
from unittest.mock import patch

AGENT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ROOT = os.path.join(AGENT_ROOT, "service")
if SERVICE_ROOT not in sys.path:
    sys.path.insert(0, SERVICE_ROOT)

import enforcement_core
from enforcement_core import EnforcementCore


class FakeQueue:
    def get_daily_usage(self):
        return 0


class EnforcementCoreTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.core = EnforcementCore(FakeQueue(), config_dir=self.temp_dir.name)
        self.core.hosts_path = os.path.join(self.temp_dir.name, "hosts")
        with open(self.core.hosts_path, "w", encoding="utf-8") as hosts_file:
            hosts_file.write("127.0.0.1 localhost\n")
        self.core.update_hosts_file = lambda domains: None

    def tearDown(self):
        self.temp_dir.cleanup()

    def _save_overnight_settings(self):
        self.core.save_settings_cache({
            "allowed_start_time": "22:00:00",
            "allowed_end_time": "06:00:00",
            "daily_limit_minutes": 120,
            "is_locked": False,
        }, [])

    def test_overnight_window_allows_time_after_start(self):
        self._save_overnight_settings()

        class FakeDateTime(enforcement_core.datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2026, 7, 24, 23, 30, 0)

        with patch.object(enforcement_core, "datetime", FakeDateTime):
            should_lock, _, _ = self.core.check_policy_status()

        self.assertFalse(should_lock)

    def test_overnight_window_rejects_midday(self):
        self._save_overnight_settings()

        class FakeDateTime(enforcement_core.datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2026, 7, 24, 12, 0, 0)

        with patch.object(enforcement_core, "datetime", FakeDateTime):
            should_lock, _, _ = self.core.check_policy_status()

        self.assertTrue(should_lock)


if __name__ == "__main__":
    unittest.main()
