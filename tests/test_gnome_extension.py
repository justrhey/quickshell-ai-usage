import json
import os
import unittest

ROOT = os.path.join(os.path.dirname(__file__), "..")
GNOME_DIR = os.path.join(ROOT, "gnome-extension")
INSTALLABLE_DIR = os.path.join(GNOME_DIR, "ai-usage@justrhey")


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

    def test_installable_indicator_has_provider_icons(self):
        with open(os.path.join(INSTALLABLE_DIR, "metadata.json"), encoding="utf-8") as handle:
            metadata = json.load(handle)
        with open(os.path.join(INSTALLABLE_DIR, "extension.js"), encoding="utf-8") as handle:
            source = handle.read()
        self.assertEqual(metadata["uuid"], "ai-usage@justrhey")
        self.assertIn("OpenCode", metadata["description"])
        self.assertIn("new St.Icon", source)
        self.assertIn("PROVIDER_ORDER = ['codex', 'claude', 'opencode']", source)
        for name in ("codex", "claude", "opencode"):
            self.assertTrue(os.path.isfile(os.path.join(
                INSTALLABLE_DIR, "icons", f"{name}-symbolic.svg"
            )))


if __name__ == "__main__":
    unittest.main()
