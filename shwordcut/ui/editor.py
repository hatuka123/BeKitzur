"""Add / edit a single shortcut."""

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QVBoxLayout,
)

from ..store import Shortcut
from . import theme
from .icon import icon

CASE_MODES = (None, True, False)


class EditorDialog(QDialog):
    def __init__(self, parent, tr, store, shortcut=None):
        super().__init__(parent)
        self.tr_ = tr
        self.store = store
        self.shortcut = shortcut
        self.result_shortcut = None

        self.setWindowIcon(icon())
        self.setWindowTitle(tr("editor_edit" if shortcut else "editor_new"))
        self.setMinimumWidth(460)
        self.setLayoutDirection(
            Qt.LayoutDirection.RightToLeft if tr.is_rtl else Qt.LayoutDirection.LeftToRight
        )

        root = QVBoxLayout(self)
        root.setContentsMargins(22, 20, 22, 20)
        root.setSpacing(6)

        title = QLabel(tr("editor_edit" if shortcut else "editor_new"))
        title.setObjectName("Title")
        root.addWidget(title)
        root.addSpacing(8)

        self.trigger_edit = QLineEdit(shortcut.trigger if shortcut else "")
        self.value_edit = QLineEdit(shortcut.value if shortcut else "")
        self.category_edit = QComboBox()
        self.category_edit.setEditable(True)
        self.category_edit.addItem("")
        for name in store.categories():
            self.category_edit.addItem(name)
        if shortcut:
            self.category_edit.setCurrentText(shortcut.category or "")

        self.case_combo = QComboBox()
        for key in ("case_inherit", "case_yes", "case_no"):
            self.case_combo.addItem(tr(key))
        current = shortcut.case_sensitive if shortcut else None
        self.case_combo.setCurrentIndex(CASE_MODES.index(current))

        self.enabled_check = QCheckBox(tr("field_enabled"))
        self.enabled_check.setChecked(shortcut.enabled if shortcut else True)

        for key, widget in (
            ("field_trigger", self.trigger_edit),
            ("field_value", self.value_edit),
            ("field_category", self.category_edit),
            ("field_case", self.case_combo),
        ):
            label = QLabel(self.tr_(key))
            label.setObjectName("Subtitle")
            root.addWidget(label)
            root.addWidget(widget)
            root.addSpacing(8)

        root.addWidget(self.enabled_check)

        self.error = QLabel("")
        self.error.setStyleSheet(f"color: {theme.DANGER}; font-size: 13px;")
        self.error.setWordWrap(True)
        root.addSpacing(6)
        root.addWidget(self.error)

        root.addStretch(1)
        root.addLayout(self._buttons())

        self.trigger_edit.textChanged.connect(self._clear_error)
        self.value_edit.textChanged.connect(self._clear_error)
        self.trigger_edit.setFocus()

    def _buttons(self):
        from .widgets import pixel_button

        row = QHBoxLayout()
        row.setSpacing(10)
        row.addStretch(1)
        cancel = pixel_button(self.tr_("cancel"))
        cancel.clicked.connect(self.reject)
        save = pixel_button(self.tr_("save"), "Primary")
        save.setDefault(True)
        save.clicked.connect(self._save)
        row.addWidget(cancel)
        row.addWidget(save)
        return row

    def _clear_error(self):
        self.error.setText("")
        self.trigger_edit.setProperty("invalid", False)
        self.value_edit.setProperty("invalid", False)
        for w in (self.trigger_edit, self.value_edit):
            w.style().unpolish(w)
            w.style().polish(w)

    def _fail(self, key, widget):
        self.error.setText(self.tr_(key))
        widget.setProperty("invalid", True)
        widget.style().unpolish(widget)
        widget.style().polish(widget)
        widget.setFocus()

    def _save(self):
        trigger = self.trigger_edit.text().strip()
        value = self.value_edit.text()

        if not trigger:
            return self._fail("err_trigger_empty", self.trigger_edit)
        if any(ch.isspace() for ch in trigger):
            return self._fail("err_trigger_space", self.trigger_edit)
        if not value.strip():
            return self._fail("err_value_empty", self.value_edit)

        exclude = self.shortcut.id if self.shortcut else None
        if self.store.conflicts(trigger, exclude_id=exclude):
            return self._fail("err_conflict", self.trigger_edit)

        target = self.shortcut or Shortcut()
        target.trigger = trigger
        target.value = value
        target.category = self.category_edit.currentText().strip()
        target.case_sensitive = CASE_MODES[self.case_combo.currentIndex()]
        target.enabled = self.enabled_check.isChecked()

        self.result_shortcut = target
        self.accept()
