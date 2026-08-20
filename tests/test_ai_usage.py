import importlib.util
import json
import os
import tempfile
import unittest
from unittest import mock

MODULE_PATH = os.path.join(os.path.dirname(__file__), "..", "scripts", "ai_usage.py")
SPEC = importlib.util.spec_from_file_location("ai_usage", MODULE_PATH)
ai_usage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ai_usage)


class FormattingTests(unittest.TestCase):
    def test_windows(self):
        self.assertEqual(ai_usage._human_window(300), "5h")
        self.assertEqual(ai_usage._human_window(10080), "weekly")

    def test_resets(self):
        self.assertEqual(ai_usage._human_reset(7200), "resets in 2h")
        self.assertEqual(ai_usage._human_reset(30), "resets in 1m")


class CodexUsageTests(unittest.TestCase):
    def test_reads_latest_rate_limit(self):
        with tempfile.TemporaryDirectory() as home:
            session_dir = os.path.join(home, ".codex", "sessions")
            os.makedirs(session_dir)
            session = os.path.join(session_dir, "session.jsonl")
            event = {"rate_limits": {"primary": {"used_percent": 42.5, "window_minutes": 300}}}
            with open(session, "w", encoding="utf-8") as handle:
                handle.write(json.dumps(event) + "\n")
            with mock.patch.object(ai_usage, "HOME", home):
                result = ai_usage.codex_usage()
            self.assertTrue(result["available"])
            self.assertEqual(result["percent"], 42.5)
            self.assertEqual(result["window"], "5h")


if __name__ == "__main__":
    unittest.main()
