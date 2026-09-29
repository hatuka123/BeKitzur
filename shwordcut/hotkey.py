"""Double-tap detection: Caps Lock expands, left Ctrl converts the keyboard layout."""

import time

from PyQt6.QtCore import QObject, pyqtSignal

from .winapi import VK_CAPITAL, VK_LCONTROL, KeyboardHook


def _now_ms():
    return time.monotonic() * 1000.0


class HotkeyListener(QObject):
    expand = pyqtSignal()
    convert = pyqtSignal()

    def __init__(self, settings):
        super().__init__()
        self.settings = settings
        self._caps_last_down = 0.0
        self._caps_held = False
        self._ctrl_held = False
        self._ctrl_down_at = 0.0
        self._ctrl_clean = False  # this press has not been used as a modifier
        self._ctrl_last_tap = 0.0
        self._hook = KeyboardHook(self._on_key)

    @property
    def installed(self):
        return self._hook.installed

    def start(self):
        self._hook.start()

    def stop(self):
        self._hook.stop()

    def _on_key(self, vk, is_down):
        if vk == VK_CAPITAL:
            self._on_caps(is_down)
        elif vk == VK_LCONTROL:
            self._on_ctrl(is_down)
        elif is_down:
            # Any other key makes Ctrl a modifier (Ctrl+C, Ctrl+V...), not a tap.
            self._ctrl_clean = False
            self._ctrl_last_tap = 0.0

    def _on_caps(self, is_down):
        self._ctrl_last_tap = 0.0
        if not is_down:
            self._caps_held = False
            return
        if self._caps_held:
            return  # auto-repeat while held
        self._caps_held = True

        now = _now_ms()
        if now - self._caps_last_down <= self.settings["double_tap_ms"]:
            self._caps_last_down = 0.0
            self.expand.emit()
        else:
            self._caps_last_down = now

    def _on_ctrl(self, is_down):
        now = _now_ms()
        if is_down:
            if self._ctrl_held:
                return  # auto-repeat while held
            self._ctrl_held = True
            self._ctrl_clean = True
            self._ctrl_down_at = now
            return

        # Fire on the second release, so the user is no longer holding Ctrl
        # when the conversion sends its own keystrokes.
        self._ctrl_held = False
        window = self.settings["double_tap_ms"]
        if not self._ctrl_clean or now - self._ctrl_down_at > window:
            self._ctrl_last_tap = 0.0
            return
        if self._ctrl_last_tap and now - self._ctrl_last_tap <= window:
            self._ctrl_last_tap = 0.0
            self.convert.emit()
        else:
            self._ctrl_last_tap = now
