"""Main shortcut manager window."""

import unicodedata

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QColor
from PyQt6.QtWidgets import (
    QAbstractItemView,
    QComboBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QStackedLayout,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

from .. import __author__, __version__
from . import theme
from .editor import EditorDialog
from .icon import icon
from .settings import SettingsDialog
from .widgets import divider, pixel_button

COL_ON, COL_TRIGGER, COL_VALUE, COL_CATEGORY, COL_USES = range(5)

LRM, RLM = "‎", "‏"


def _bidi(text):
    """Pin a cell to the direction of its first strong character, not the UI's.

    Without this an RTL UI shows '+972-50' as '972-50+' and '12 Main St' as 'Main St 12'.
    Display only: the stored value, and what gets typed, stay unmarked.
    """
    if not text:
        return text
    for ch in text:
        kind = unicodedata.bidirectional(ch)
        if kind in ("R", "AL"):
            return RLM + text + RLM
        if kind == "L":
            break
    # Latin text, and text with no letters at all (phone numbers, codes), reads left to right.
    return LRM + text + LRM


class ManagerWindow(QWidget):
    language_changed = pyqtSignal()
    settings_applied = pyqtSignal()

    def __init__(self, tr, settings, store):
        super().__init__()
        self.tr_ = tr
        self.settings = settings
        self.store = store
        self._loading = False

        self.setObjectName("Root")
        self.setWindowIcon(icon())
        self.setWindowTitle(tr("app_title"))
        self.resize(880, 560)
        self.setMinimumSize(720, 440)
        self.setLayoutDirection(
            Qt.LayoutDirection.RightToLeft if tr.is_rtl else Qt.LayoutDirection.LeftToRight
        )

        root = QVBoxLayout(self)
        root.setContentsMargins(20, 16, 20, 16)
        root.setSpacing(12)
        root.addLayout(self._header())
        root.addWidget(divider())
        root.addLayout(self._toolbar())
        root.addLayout(self._table_area(), 1)
        root.addLayout(self._footer())

        self.refresh()

    def _header(self):
        row = QHBoxLayout()
        title = QLabel(self.tr_("manager"))
        title.setObjectName("Title")
        row.addWidget(title)

        credit = QLabel(self.tr_("credit").format(version=__version__, author=__author__))
        credit.setObjectName("Subtitle")
        credit.setAlignment(Qt.AlignmentFlag.AlignBottom)
        row.addSpacing(12)
        row.addWidget(credit)
        row.addStretch(1)

        self.status = QLabel("")
        self.status.setStyleSheet(
            f"color: {theme.BG}; background: {theme.ACCENT}; padding: 5px 12px;"
            f" font-weight: bold; letter-spacing: 1px;"
        )
        row.addWidget(self.status)
        return row

    def _toolbar(self):
        row = QHBoxLayout()
        row.setSpacing(10)

        self.search = QLineEdit()
        self.search.setPlaceholderText(self.tr_("search"))
        self.search.setClearButtonEnabled(True)
        self.search.textChanged.connect(self.refresh)
        self.search.setMinimumWidth(200)
        row.addWidget(self.search, 2)

        self.category_filter = QComboBox()
        self.category_filter.currentIndexChanged.connect(self.refresh)
        self.category_filter.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToContents)
        row.addWidget(self.category_filter, 1)

        row.addStretch(1)

        self.add_btn = pixel_button(self.tr_("add"), "Primary")
        self.add_btn.clicked.connect(self.add_shortcut)
        self.edit_btn = pixel_button(self.tr_("edit"))
        self.edit_btn.clicked.connect(self.edit_selected)
        self.delete_btn = pixel_button(self.tr_("delete"), "Danger")
        self.delete_btn.clicked.connect(self.delete_selected)
        self.settings_btn = pixel_button(self.tr_("settings"))
        self.settings_btn.clicked.connect(self.open_settings)

        for button in (self.add_btn, self.edit_btn, self.delete_btn, self.settings_btn):
            row.addWidget(button)
        return row

    def _table_area(self):
        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels([
            self.tr_("col_on"),
            self.tr_("col_trigger"),
            self.tr_("col_value"),
            self.tr_("col_category"),
            self.tr_("col_uses"),
        ])
        self.table.verticalHeader().setVisible(False)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setShowGrid(False)
        self.table.setAlternatingRowColors(False)
        self.table.verticalHeader().setDefaultSectionSize(34)
        self.table.doubleClicked.connect(self.edit_selected)
        self.table.itemSelectionChanged.connect(self._sync_buttons)
        self.table.itemChanged.connect(self._on_item_changed)

        header = self.table.horizontalHeader()
        header.setSectionResizeMode(COL_ON, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(COL_TRIGGER, QHeaderView.ResizeMode.Interactive)
        header.setSectionResizeMode(COL_VALUE, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(COL_CATEGORY, QHeaderView.ResizeMode.Interactive)
        header.setSectionResizeMode(COL_USES, QHeaderView.ResizeMode.Fixed)
        self.table.setColumnWidth(COL_ON, 56)
        self.table.setColumnWidth(COL_TRIGGER, 170)
        self.table.setColumnWidth(COL_CATEGORY, 150)
        self.table.setColumnWidth(COL_USES, 80)

        self.empty = QLabel(self.tr_("empty_hint"))
        self.empty.setObjectName("Empty")
        self.empty.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty.setWordWrap(True)

        self.stack = QStackedLayout()
        self.stack.addWidget(self.table)
        self.stack.addWidget(self.empty)
        return self.stack

    def _footer(self):
        row = QHBoxLayout()
        self.count_label = QLabel("")
        self.count_label.setObjectName("Subtitle")
        row.addWidget(self.count_label)
        row.addStretch(1)
        hint = QLabel(self.tr_("set_trigger_hint"))
        hint.setObjectName("Hint")
        row.addWidget(hint)
        return row

    def _visible_shortcuts(self):
        needle = self.search.text().strip().casefold()
        category = self.category_filter.currentData()
        items = []
        for s in self.store.shortcuts:
            if category is not None and (s.category or "") != category:
                continue
            if needle and needle not in s.trigger.casefold() and needle not in s.value.casefold():
                continue
            items.append(s)
        return items

    def _reload_categories(self):
        self._loading = True
        current = self.category_filter.currentData()
        self.category_filter.clear()
        self.category_filter.addItem(self.tr_("all_categories"), None)
        names = self.store.categories()
        if any(not s.category for s in self.store.shortcuts):
            self.category_filter.addItem(self.tr_("no_category"), "")
        for name in names:
            self.category_filter.addItem(name, name)
        index = self.category_filter.findData(current)
        self.category_filter.setCurrentIndex(max(0, index))
        self._loading = False

    def refresh(self):
        if self._loading:
            return
        if self.sender() is not self.category_filter:
            self._reload_categories()

        rows = self._visible_shortcuts()
        self._loading = True
        self.table.setRowCount(len(rows))
        for row, s in enumerate(rows):
            toggle = QTableWidgetItem()
            toggle.setFlags(Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsEnabled)
            toggle.setCheckState(
                Qt.CheckState.Checked if s.enabled else Qt.CheckState.Unchecked
            )
            toggle.setData(Qt.ItemDataRole.UserRole, s.id)
            self.table.setItem(row, COL_ON, toggle)

            trigger = QTableWidgetItem(_bidi(s.trigger))
            trigger.setForeground(QColor(theme.ACCENT))
            font = trigger.font()
            font.setBold(True)
            trigger.setFont(font)
            self.table.setItem(row, COL_TRIGGER, trigger)

            value = QTableWidgetItem(_bidi(s.value))
            value.setToolTip(_bidi(s.value))
            self.table.setItem(row, COL_VALUE, value)

            self.table.setItem(row, COL_CATEGORY, QTableWidgetItem(_bidi(s.category) or "—"))

            uses = QTableWidgetItem(str(s.uses))
            uses.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.table.setItem(row, COL_USES, uses)

            for col in range(5):
                item = self.table.item(row, col)
                if col != COL_ON:
                    item.setData(Qt.ItemDataRole.UserRole, s.id)
                if not s.enabled:
                    item.setForeground(QColor(theme.TEXT_DIM))
        self._loading = False

        self.stack.setCurrentIndex(1 if not self.store.shortcuts else 0)
        self.count_label.setText(f"{len(self.store.shortcuts)} {self.tr_('count_label')}")
        self._sync_status()
        self._sync_buttons()

    def _sync_status(self):
        on = self.settings["enabled"]
        self.status.setText(self.tr_("status_on" if on else "status_off"))
        color = theme.ACCENT if on else theme.WARN
        self.status.setStyleSheet(
            f"color: {theme.BG}; background: {color}; padding: 5px 12px;"
            f" font-weight: bold; letter-spacing: 1px;"
        )

    def _sync_buttons(self):
        has = bool(self.table.selectedItems())
        self.edit_btn.setEnabled(has)
        self.delete_btn.setEnabled(has)

    def _selected_shortcut(self):
        items = self.table.selectedItems()
        if not items:
            return None
        return self.store.get(items[0].data(Qt.ItemDataRole.UserRole))

    def _on_item_changed(self, item):
        if self._loading or item.column() != COL_ON:
            return
        shortcut = self.store.get(item.data(Qt.ItemDataRole.UserRole))
        if shortcut:
            shortcut.enabled = item.checkState() == Qt.CheckState.Checked
            self.store.save()
            self.refresh()

    def add_shortcut(self):
        dialog = EditorDialog(self, self.tr_, self.store)
        if dialog.exec():
            self.store.add(dialog.result_shortcut)
            self.refresh()

    def edit_selected(self):
        shortcut = self._selected_shortcut()
        if not shortcut:
            return
        dialog = EditorDialog(self, self.tr_, self.store, shortcut)
        if dialog.exec():
            self.store.save()
            self.refresh()

    def delete_selected(self):
        shortcut = self._selected_shortcut()
        if not shortcut:
            return
        box = QMessageBox(self)
        box.setWindowTitle(self.tr_("confirm_delete_title"))
        box.setText(f"{self.tr_('confirm_delete_body')}\n\n▶ {shortcut.trigger}")
        box.setIcon(QMessageBox.Icon.NoIcon)
        yes = box.addButton(self.tr_("yes"), QMessageBox.ButtonRole.DestructiveRole)
        yes.setObjectName("Danger")
        box.addButton(self.tr_("no"), QMessageBox.ButtonRole.RejectRole)
        box.exec()
        if box.clickedButton() is yes:
            self.store.remove(shortcut.id)
            self.refresh()

    def open_settings(self):
        dialog = SettingsDialog(self, self.tr_, self.settings)
        if dialog.exec():
            self.settings_applied.emit()
            if dialog.language_changed:
                self.language_changed.emit()
            else:
                self.refresh()

    def closeEvent(self, event):
        self.settings["window_geometry"] = [
            self.x(), self.y(), self.width(), self.height()
        ]
        self.settings.save()
        event.ignore()
        self.hide()
