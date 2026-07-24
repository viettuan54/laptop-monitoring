import os
import sys
import tempfile
import unittest

AGENT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ROOT = os.path.join(AGENT_ROOT, "service")
if SERVICE_ROOT not in sys.path:
    sys.path.insert(0, SERVICE_ROOT)

from offline_queue import OfflineQueue


class FakeResponse:
    def __init__(self, accepted_ids, status_code=201):
        self.status_code = status_code
        self._accepted_ids = accepted_ids

    def __bool__(self):
        return True

    def json(self):
        return {"accepted_client_record_ids": self._accepted_ids}


class FakeApiClient:
    suspended = False

    def __init__(self, accepted_ids):
        self.accepted_ids = accepted_ids
        self.calls = []

    def post(self, endpoint, data=None, timeout=10):
        self.calls.append((endpoint, data))
        return FakeResponse(self.accepted_ids)


class OfflineQueueIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "queue.db")
        self.queue = OfflineQueue(db_path=self.db_path, secure_file=False)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _synced_state(self):
        with self.queue.get_connection() as conn:
            return dict(conn.execute(
                "SELECT client_record_id, synced FROM app_logs ORDER BY client_record_id"
            ).fetchall())

    def test_only_backend_acknowledged_records_are_marked_synced(self):
        first_id, inserted = self.queue.enqueue_app_log(
            "one.exe", "2026-01-01T00:00:00Z", duration_seconds=10,
            client_record_id="record-one"
        )
        self.assertTrue(inserted)
        second_id, inserted = self.queue.enqueue_app_log(
            "two.exe", "2026-01-01T00:00:10Z", duration_seconds=10,
            client_record_id="record-two"
        )
        self.assertTrue(inserted)

        api = FakeApiClient([first_id])
        self.queue._sync_apps(api)

        self.assertEqual(self._synced_state(), {first_id: 1, second_id: 0})
        self.assertEqual(len(api.calls), 1)

    def test_missing_acknowledgement_keeps_the_local_queue_unchanged(self):
        record_id, inserted = self.queue.enqueue_app_log(
            "safe.exe", "2026-01-01T00:00:00Z", duration_seconds=10,
            client_record_id="record-safe"
        )
        self.assertTrue(inserted)

        self.queue._sync_apps(FakeApiClient([]))
        self.assertEqual(self._synced_state(), {record_id: 0})


if __name__ == "__main__":
    unittest.main()
