"""Shortcut storage and lookup."""

import json
import os
import shutil
import time
import uuid
from datetime import datetime

from .config import DATA_DIR, SHORTCUTS_FILE

# A second copy of the last save. A damaged or missing main file falls back to it.
BACKUP_FILE = SHORTCUTS_FILE.with_suffix(".bak")
# Antivirus and cloud sync briefly lock files they scan; wait them out.
LOCK_RETRIES = 5
LOCK_DELAY = 0.1


class Shortcut:
    __slots__ = ("id", "trigger", "value", "category", "case_sensitive", "enabled", "uses", "created")

    def __init__(self, trigger="", value="", category="", case_sensitive=None,
                 enabled=True, uses=0, id=None, created=None):
        self.id = id or uuid.uuid4().hex
        self.trigger = trigger
        self.value = value
        self.category = category
        self.case_sensitive = case_sensitive
        self.enabled = enabled
        self.uses = uses
        self.created = created or datetime.now().isoformat(timespec="seconds")

    def to_dict(self):
        return {k: getattr(self, k) for k in self.__slots__}

    @classmethod
    def from_dict(cls, d):
        return cls(**{k: d.get(k) for k in cls.__slots__ if k in d})


def _read(path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [Shortcut.from_dict(d) for d in raw.get("shortcuts", [])]


def _retry_locked(action):
    for attempt in range(LOCK_RETRIES):
        try:
            return action()
        except PermissionError:
            if attempt == LOCK_RETRIES - 1:
                raise
            time.sleep(LOCK_DELAY)


def _set_aside(path):
    """Copy an unreadable file out of the way, so no later save can overwrite it."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    try:
        shutil.copy2(path, path.with_name(f"{path.stem}.unreadable-{stamp}.json"))
        return True
    except OSError:
        return False


class Store:
    def __init__(self, settings):
        self.settings = settings
        self.shortcuts = []
        self.load()

    def load(self):
        """Load the list, never silently starting empty while a saved list exists.

        Starting empty would let the next save overwrite every shortcut the user has.
        """
        self.shortcuts = []
        # Set when the main file could be neither read nor copied aside; it must
        # not be replaced until a copy of it exists.
        self._guard_main = False
        for path in (SHORTCUTS_FILE, BACKUP_FILE):
            if not path.exists():
                continue
            try:
                self.shortcuts = _retry_locked(lambda: _read(path))
                return
            except (OSError, ValueError, TypeError, AttributeError):
                if not _set_aside(path) and path == SHORTCUTS_FILE:
                    self._guard_main = True

    def save(self):
        if self._guard_main:
            if not _set_aside(SHORTCUTS_FILE):
                return  # still locked; keep changes in memory rather than risk the file
            self._guard_main = False

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = {"version": 1, "shortcuts": [s.to_dict() for s in self.shortcuts]}
        tmp = SHORTCUTS_FILE.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(json.dumps(payload, indent=2, ensure_ascii=False))
            f.flush()
            # Reach the disk before the swap, or a power cut can leave an empty file.
            os.fsync(f.fileno())
        _retry_locked(lambda: tmp.replace(SHORTCUTS_FILE))
        try:
            _retry_locked(lambda: shutil.copy2(SHORTCUTS_FILE, BACKUP_FILE))
        except OSError:
            pass

    def add(self, shortcut):
        self.shortcuts.append(shortcut)
        self.save()

    def remove(self, shortcut_id):
        self.shortcuts = [s for s in self.shortcuts if s.id != shortcut_id]
        self.save()

    def get(self, shortcut_id):
        return next((s for s in self.shortcuts if s.id == shortcut_id), None)

    def categories(self):
        return sorted({s.category for s in self.shortcuts if s.category})

    def conflicts(self, trigger, exclude_id=None):
        """Triggers that would collide under the loosest matching rule in play."""
        folded = trigger.casefold()
        return [
            s for s in self.shortcuts
            if s.id != exclude_id and (s.trigger == trigger or s.trigger.casefold() == folded)
        ]

    def lookup(self, word):
        if not word:
            return None
        default_cs = self.settings["case_sensitive_default"]
        fallback = None
        for s in self.shortcuts:
            if not s.enabled:
                continue
            cs = default_cs if s.case_sensitive is None else s.case_sensitive
            if cs:
                if s.trigger == word:
                    return s
            else:
                if s.trigger.casefold() == word.casefold():
                    # Exact hits win over case-insensitive ones.
                    if s.trigger == word:
                        return s
                    if fallback is None:
                        fallback = s
        return fallback

    def record_use(self, shortcut):
        shortcut.uses += 1
        self.save()
