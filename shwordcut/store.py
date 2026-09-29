"""Shortcut storage and lookup."""

import json
import uuid
from datetime import datetime

from .config import DATA_DIR, SHORTCUTS_FILE


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


class Store:
    def __init__(self, settings):
        self.settings = settings
        self.shortcuts = []
        self.load()

    def load(self):
        try:
            raw = json.loads(SHORTCUTS_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.shortcuts = []
            return
        self.shortcuts = [Shortcut.from_dict(d) for d in raw.get("shortcuts", [])]

    def save(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        payload = {"version": 1, "shortcuts": [s.to_dict() for s in self.shortcuts]}
        tmp = SHORTCUTS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(SHORTCUTS_FILE)

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
