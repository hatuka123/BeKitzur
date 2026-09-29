"""Reads the word before the cursor and replaces it with its shortcut value."""

import threading
import time

from PyQt6.QtCore import QObject, pyqtSignal

from . import winapi

SELECT_SETTLE = 0.03
RESTORE_SETTLE = 0.04
COPY_TIMEOUT = 0.25
COPY_POLL = 0.008
PASTE_SETTLE = 0.09

# Arrow keys move visually, not logically: in an RTL paragraph the previous word
# sits to the RIGHT. Neither direction can be inferred from a foreign app, so try
# one, and if it yields no known shortcut, undo and try the other.
LTR_FIRST = (winapi.VK_LEFT, winapi.VK_RIGHT)
RTL_FIRST = (winapi.VK_RIGHT, winapi.VK_LEFT)


# Shared by every text action: two of them editing the same field at once would
# interleave their keystrokes.
_action_lock = threading.Lock()


class TextAction(QObject):
    """Base for actions that select, copy and retype text in the foreground app."""

    notify = pyqtSignal(str, bool)

    def __init__(self, settings):
        super().__init__()
        self.settings = settings

    def trigger(self):
        if not _action_lock.acquire(blocking=False):
            return
        threading.Thread(target=self._run_guarded, daemon=True).start()

    def _run_guarded(self):
        try:
            self._run()
        finally:
            _action_lock.release()

    def _run(self):
        raise NotImplementedError

    def _grab(self, select_key):
        winapi.send_chord(winapi.VK_CONTROL, winapi.VK_SHIFT, select_key)
        time.sleep(SELECT_SETTLE)
        return self._copy_selection()

    def _collapse(self, restore_key, length):
        """Walk the caret back over the abandoned selection, one character per press.

        Counting characters keeps this correct in both text directions: the restore
        travels the same visual axis the selection did.
        """
        if length:
            winapi.send_key(restore_key, times=length)
            time.sleep(RESTORE_SETTLE)

    def _insert(self, payload, saved, preserve):
        if self.settings["insert_mode"] == "paste":
            winapi.set_clipboard_text(payload)
            winapi.send_chord(winapi.VK_CONTROL, winapi.VK_V)
            time.sleep(PASTE_SETTLE)
        else:
            winapi.type_text(payload)
        self._restore(saved, preserve)

    def _copy_selection(self, timeout=COPY_TIMEOUT):
        before = winapi.clipboard_sequence()
        winapi.send_chord(winapi.VK_CONTROL, winapi.VK_C)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if winapi.clipboard_sequence() != before:
                return winapi.get_clipboard_text()
            time.sleep(COPY_POLL)
        return None

    def _restore(self, saved, preserve):
        if preserve and saved is not None:
            winapi.set_clipboard_text(saved)


class Expander(TextAction):
    used = pyqtSignal(object)

    def __init__(self, settings, store):
        super().__init__(settings)
        self.store = store
        self._preferred = LTR_FIRST

    def _run(self):
        if not self.settings["enabled"]:
            self.notify.emit("toast_disabled", False)
            return

        preserve = self.settings["preserve_clipboard"]
        saved = winapi.get_clipboard_text() if preserve else None
        winapi.release_modifiers()

        first = self._preferred
        orders = [first, RTL_FIRST if first == LTR_FIRST else LTR_FIRST]

        saw_word = False
        for select_key, restore_key in orders:
            raw = self._grab(select_key)
            if not raw:
                continue

            word = raw.strip()
            if word:
                saw_word = True
                match = self.store.lookup(word)
                if match:
                    self._preferred = LTR_FIRST if select_key == winapi.VK_LEFT else RTL_FIRST
                    lead = raw[: len(raw) - len(raw.lstrip())]
                    trail = raw[len(raw.rstrip()):]
                    self._insert(lead + match.value + trail, saved, preserve)
                    self.used.emit(match)
                    return

            self._collapse(restore_key, len(raw))

        self._restore(saved, preserve)
        self.notify.emit("toast_miss" if saw_word else "toast_empty", False)
