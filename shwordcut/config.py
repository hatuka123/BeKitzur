"""Settings persistence."""

import json
import os
import shutil
from pathlib import Path

APP_NAME = "ShWordCut"
DATA_DIR = Path(os.environ.get("APPDATA", Path.home())) / APP_NAME
# The app shipped as "PixelSnip" before it was renamed.
LEGACY_DATA_DIR = DATA_DIR.with_name("PixelSnip")
SETTINGS_FILE = DATA_DIR / "settings.json"
SHORTCUTS_FILE = DATA_DIR / "shortcuts.json"

DEFAULTS = {
    "language": "he",
    "enabled": True,
    "double_tap_ms": 400,
    "case_sensitive_default": True,
    "preserve_clipboard": False,
    "insert_mode": "type",
    "toast_on_miss": True,
    "toast_on_hit": False,
    "toast_position": "cursor",
    "autostart": False,
    "window_geometry": None,
}


def migrate_legacy_data():
    """Bring shortcuts across from the old name. Copies, so the old folder remains as a backup."""
    if DATA_DIR.exists() or not LEGACY_DATA_DIR.exists():
        return
    shutil.copytree(LEGACY_DATA_DIR, DATA_DIR)


class Settings:
    def __init__(self):
        self._data = dict(DEFAULTS)
        self.load()

    def load(self):
        try:
            raw = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        for key in DEFAULTS:
            if key in raw:
                self._data[key] = raw[key]

    def save(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        tmp = SETTINGS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(SETTINGS_FILE)

    def __getitem__(self, key):
        return self._data.get(key, DEFAULTS.get(key))

    def __setitem__(self, key, value):
        self._data[key] = value

    def update(self, values):
        self._data.update(values)
