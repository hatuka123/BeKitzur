"""Caps Lock double-tap detection."""

import time

from PyQt6.QtCore import QObject, pyqtSignal

from .winapi import VK_CAPITAL, KeyboardHook


class CapsLockTrigger(QObject):
    triggered = pyqtSignal()

    def __init__(self, settings):
        super().__init__()
        self.settings = settings
        self._last_down = 0.0
        self._key_held = False
        self._hook = KeyboardHook(self._on_key)

    @property
    def installed(self):
        return self._hook.installed

    def start(self):
        self._hook.start()

    def stop(self):
        self._hook.stop()

    def _on_key(self, vk, is_down):
        if vk != VK_CAPITAL:
            return
        if not is_down:
            self._key_held = False
            return
        if self._key_held:
            return  # auto-repeat while held
        self._key_held = True

        now = time.monotonic() * 1000.0
        if now - self._last_down <= self.settings["double_tap_ms"]:
            self._last_down = 0.0
            self.triggered.emit()
        else:
            self._last_down = now
