import json
import os
import unittest

ROOT = os.path.join(os.path.dirname(__file__), "..")
GNOME_DIR = os.path.join(ROOT, "gnome-extension")


class GnomeExtensionTests(unittest.TestCase):
    def test_metadata_matches_extension_directory(self):
        with open(os.path.join(GNOME_DIR, "metadata.json"), encoding="utf-8") as handle:
            metadata = json.load(handle)
        self.assertEqual(metadata["uuid"], "ai-usage@justrhey.github.io")
        self.assertTrue({"45", "46", "47", "48", "49", "50"}.issubset(metadata["shell-version"]))

    def test_extension_uses_bundled_collector(self):
        with open(os.path.join(GNOME_DIR, "extension.js"), encoding="utf-8") as handle:
            source = handle.read()
        self.assertIn("get_child('scripts')", source)
        self.assertIn("get_child('ai_usage.py')", source)
        self.assertIn("REFRESH_SECONDS = 60", source)


if __name__ == "__main__":
    unittest.main()
