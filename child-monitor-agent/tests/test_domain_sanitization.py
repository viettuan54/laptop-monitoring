import os
import sys
import unittest

AGENT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_ROOT = os.path.join(AGENT_ROOT, "service")
if SERVICE_ROOT not in sys.path:
    sys.path.insert(0, SERVICE_ROOT)

from enforcement_core import EnforcementCore


class DomainSanitizationTest(unittest.TestCase):
    def test_accepts_and_normalizes_safe_domains(self):
        self.assertEqual(EnforcementCore.normalize_domain("WWW.Example.com"), "example.com")
        self.assertEqual(EnforcementCore.normalize_domain("sub.example.com."), "sub.example.com")
        self.assertEqual(
            EnforcementCore.normalize_domain("tênmiền.vn"),
            "xn--tnmin-hsa0954c.vn",
        )

    def test_rejects_hosts_injection_and_invalid_labels(self):
        invalid_domains = [
            "example.com\n1.2.3.4 injected.test",
            "example.com\r\n# === LAPTOP-MONITOR END ===",
            "example.com # comment",
            "-bad.example",
            "bad_.example",
            "localhost",
        ]
        for domain in invalid_domains:
            with self.subTest(domain=domain):
                self.assertIsNone(EnforcementCore.normalize_domain(domain))


if __name__ == "__main__":
    unittest.main()
