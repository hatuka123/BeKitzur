"""Windows 'start with login' entry, stored under the current user only."""

import sys
import winreg
from pathlib import Path

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
VALUE_NAME = "BeKitzur"
# Written by versions from before the rename.
LEGACY_VALUE_NAME = "ShWordCut"


def _command():
    if getattr(sys, "frozen", False):
        return f'"{sys.executable}"'
    launcher = Path(sys.executable)
    pythonw = launcher.with_name("pythonw.exe")
    if pythonw.exists():
        launcher = pythonw
    entry = Path(__file__).resolve().parent.parent / "run.pyw"
    return f'"{launcher}" "{entry}"'


def is_enabled():
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            for name in (VALUE_NAME, LEGACY_VALUE_NAME):
                try:
                    winreg.QueryValueEx(key, name)
                    return True
                except OSError:
                    pass
    except OSError:
        pass
    return False


def set_enabled(enabled):
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            try:
                winreg.DeleteValue(key, LEGACY_VALUE_NAME)
            except FileNotFoundError:
                pass
            if enabled:
                winreg.SetValueEx(key, VALUE_NAME, 0, winreg.REG_SZ, _command())
            else:
                try:
                    winreg.DeleteValue(key, VALUE_NAME)
                except FileNotFoundError:
                    pass
        return True
    except OSError:
        return False
