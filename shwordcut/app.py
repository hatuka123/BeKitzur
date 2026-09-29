"""Application wiring: tray, hotkey, expansion and the manager window."""

import ctypes
import sys
import threading

from PyQt6.QtCore import QObject, Qt, pyqtSignal
from PyQt6.QtWidgets import QApplication, QMenu, QMessageBox, QSystemTrayIcon

from . import winapi
from .config import Settings, migrate_legacy_data
from .expander import Expander
from .hotkey import CapsLockTrigger
from .i18n import Translator
from .store import Store
from .ui import theme
from .ui.icon import icon
from .ui.manager import ManagerWindow
from .ui.settings import SettingsDialog
from .ui.toast import Toast

MUTEX_NAME = "Local\\ShWordCut.SingleInstance"
SHOW_EVENT_NAME = "Local\\ShWordCut.ShowManager"
ERROR_ALREADY_EXISTS = 183


def _claim_single_instance():
    handle = ctypes.windll.kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if ctypes.windll.kernel32.GetLastError() == ERROR_ALREADY_EXISTS:
        return None
    return handle


def _raise_running_instance():
    """Ask the instance that already holds the mutex to show its window."""
    handle = winapi.open_event(SHOW_EVENT_NAME)
    if not handle:
        return False
    try:
        return winapi.set_event(handle)
    finally:
        winapi.close_handle(handle)


class _ShowRequest(QObject):
    received = pyqtSignal()


class ShWordCutApp:
    def __init__(self):
        self.qt = QApplication(sys.argv)
        self.qt.setQuitOnLastWindowClosed(False)
        self.qt.setApplicationName("ShWordCut")

        migrate_legacy_data()
        self.settings = Settings()
        self.tr = Translator(self.settings)
        self.store = Store(self.settings)

        self.qt.setStyle("Fusion")
        self.qt.setPalette(theme.palette())
        self.qt.setStyleSheet(theme.qss())
        self._apply_direction()

        self.toast = Toast()
        self.window = None

        self.expander = Expander(self.settings, self.store)
        self.expander.notify.connect(self._on_notify)
        self.expander.used.connect(self._on_used)

        self.trigger = CapsLockTrigger(self.settings)
        self.trigger.triggered.connect(self.expander.trigger)
        self.trigger.start()

        self._build_tray()
        self._start_show_listener()

        if not self.trigger.installed:
            QMessageBox.critical(None, "ShWordCut", self.tr("hook_failed"))

    def _apply_direction(self):
        self.qt.setLayoutDirection(
            Qt.LayoutDirection.RightToLeft if self.tr.is_rtl else Qt.LayoutDirection.LeftToRight
        )

    def _build_tray(self):
        self.tray = QSystemTrayIcon(icon(self.settings["enabled"]))
        self.tray.setToolTip("ShWordCut")
        self.tray.activated.connect(self._on_tray_activated)
        self._rebuild_tray_menu()
        self.tray.show()

    def _rebuild_tray_menu(self):
        menu = QMenu()
        menu.setLayoutDirection(
            Qt.LayoutDirection.RightToLeft if self.tr.is_rtl else Qt.LayoutDirection.LeftToRight
        )
        menu.addAction(self.tr("tray_open"), self.show_manager)
        toggle_key = "tray_toggle_off" if self.settings["enabled"] else "tray_toggle_on"
        menu.addAction(self.tr(toggle_key), self.toggle_enabled)
        menu.addSeparator()
        menu.addAction(self.tr("settings"), self.show_settings)
        menu.addSeparator()
        menu.addAction(self.tr("quit"), self.quit)
        self.tray.setContextMenu(menu)
        self._tray_menu = menu

    def _start_show_listener(self):
        self._show_event = winapi.create_event(SHOW_EVENT_NAME)
        self._stop_listener = False
        self._show_bridge = _ShowRequest()
        self._show_bridge.received.connect(self.show_manager)
        threading.Thread(target=self._listen_for_show, daemon=True, name="shwordcut-show").start()

    def _listen_for_show(self):
        while not self._stop_listener:
            # Bounded wait so quit() can stop the thread without signalling the event.
            if winapi.wait_event(self._show_event, 1000) and not self._stop_listener:
                self._show_bridge.received.emit()

    def _on_tray_activated(self, reason):
        if reason in (
            QSystemTrayIcon.ActivationReason.Trigger,
            QSystemTrayIcon.ActivationReason.DoubleClick,
        ):
            self.show_manager()

    def toggle_enabled(self):
        self.settings["enabled"] = not self.settings["enabled"]
        self.settings.save()
        self._sync_enabled_ui()

    def _sync_enabled_ui(self):
        self.tray.setIcon(icon(self.settings["enabled"]))
        self._rebuild_tray_menu()
        if self.window:
            self.window.refresh()

    def show_manager(self):
        if self.window is None:
            self.window = ManagerWindow(self.tr, self.settings, self.store)
            self.window.language_changed.connect(self._on_language_changed)
            self.window.settings_applied.connect(self._sync_enabled_ui)
            geometry = self.settings["window_geometry"]
            if geometry and len(geometry) == 4:
                self.window.setGeometry(*geometry)
        self.window.show()
        self.window.setWindowState(
            self.window.windowState() & ~Qt.WindowState.WindowMinimized
        )
        self.window.raise_()
        self.window.activateWindow()

    def show_settings(self):
        dialog = SettingsDialog(None, self.tr, self.settings)
        if dialog.exec():
            if dialog.language_changed:
                self._on_language_changed()
            else:
                self._sync_enabled_ui()

    def _on_language_changed(self):
        self._apply_direction()
        self._rebuild_tray_menu()
        was_visible = self.window is not None and self.window.isVisible()
        if self.window:
            self.window.deleteLater()
            self.window = None
        if was_visible:
            self.show_manager()
        self.tray.setIcon(icon(self.settings["enabled"]))

    def _on_notify(self, key, good):
        if key in ("toast_miss", "toast_empty") and not self.settings["toast_on_miss"]:
            return
        self.toast.show_message(
            self.tr(key), good, at_cursor=self.settings["toast_position"] == "cursor"
        )

    def _on_used(self, shortcut):
        self.store.record_use(shortcut)
        if self.window and self.window.isVisible():
            self.window.refresh()
        if self.settings["toast_on_hit"]:
            self.toast.show_message(
                f"▶ {shortcut.trigger}", True,
                at_cursor=self.settings["toast_position"] == "cursor",
            )

    def quit(self):
        self._stop_listener = True
        self.trigger.stop()
        winapi.close_handle(self._show_event)
        self.tray.hide()
        self.qt.quit()

    def run(self):
        if not self.store.shortcuts:
            self.show_manager()
        return self.qt.exec()


def main():
    handle = _claim_single_instance()
    if handle is None:
        _raise_running_instance()
        return 0
    return ShWordCutApp().run()
