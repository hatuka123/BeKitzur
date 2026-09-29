"""Settings dialog."""

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDialog,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

from .. import autostart
from .icon import icon
from .widgets import divider, hint_label, pixel_button, section_label

LANGUAGES = (("he", "עברית"), ("en", "English"))
INSERT_MODES = ("type", "paste")


class SettingsDialog(QDialog):
    def __init__(self, parent, tr, settings):
        super().__init__(parent)
        self.tr_ = tr
        self.settings = settings
        self.language_changed = False

        self.setWindowIcon(icon())
        self.setWindowTitle(tr("settings"))
        self.setMinimumSize(520, 600)
        self.setLayoutDirection(
            Qt.LayoutDirection.RightToLeft if tr.is_rtl else Qt.LayoutDirection.LeftToRight
        )

        outer = QVBoxLayout(self)
        outer.setContentsMargins(22, 20, 22, 20)
        outer.setSpacing(10)

        title = QLabel(tr("settings"))
        title.setObjectName("Title")
        outer.addWidget(title)

        body = QWidget()
        form = QVBoxLayout(body)
        form.setContentsMargins(0, 0, 12, 0)
        form.setSpacing(6)
        self._build(form)
        form.addStretch(1)

        scroll = QScrollArea()
        scroll.setWidget(body)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        outer.addWidget(scroll, 1)

        outer.addWidget(divider())
        outer.addLayout(self._buttons())

    def _build(self, form):
        tr = self.tr_

        form.addWidget(section_label(tr("set_general")))
        form.addWidget(QLabel(tr("set_language")))
        self.language = QComboBox()
        for _, label in LANGUAGES:
            self.language.addItem(label)
        self.language.setCurrentIndex([c for c, _ in LANGUAGES].index(self.settings["language"]))
        form.addWidget(self.language)
        form.addSpacing(6)

        self.enabled = QCheckBox(tr("set_enabled"))
        self.enabled.setChecked(self.settings["enabled"])
        form.addWidget(self.enabled)

        self.autostart = QCheckBox(tr("set_autostart"))
        self.autostart.setChecked(autostart.is_enabled())
        form.addWidget(self.autostart)

        form.addSpacing(10)
        form.addWidget(section_label(tr("set_trigger")))
        form.addWidget(hint_label(tr("set_trigger_hint")))
        form.addSpacing(4)
        form.addWidget(QLabel(tr("set_double_tap")))
        self.double_tap = QSpinBox()
        self.double_tap.setRange(150, 1200)
        self.double_tap.setSingleStep(50)
        self.double_tap.setValue(self.settings["double_tap_ms"])
        form.addWidget(self.double_tap)

        form.addSpacing(10)
        form.addWidget(section_label(tr("set_convert")))
        self.convert_enabled = QCheckBox(tr("set_convert_enabled"))
        self.convert_enabled.setChecked(self.settings["convert_enabled"])
        form.addWidget(self.convert_enabled)
        form.addWidget(hint_label(tr("set_convert_hint")))
        self.convert_switch = QCheckBox(tr("set_convert_switch"))
        self.convert_switch.setChecked(self.settings["convert_switch_layout"])
        self.convert_switch.setEnabled(self.convert_enabled.isChecked())
        self.convert_enabled.toggled.connect(self.convert_switch.setEnabled)
        form.addWidget(self.convert_switch)

        form.addSpacing(10)
        form.addWidget(section_label(tr("set_behavior")))
        form.addWidget(QLabel(tr("set_case_default")))
        self.case_default = QComboBox()
        self.case_default.addItem(tr("case_yes"))
        self.case_default.addItem(tr("case_no"))
        self.case_default.setCurrentIndex(0 if self.settings["case_sensitive_default"] else 1)
        form.addWidget(self.case_default)
        form.addSpacing(6)

        self.preserve = QCheckBox(tr("set_clipboard"))
        self.preserve.setChecked(self.settings["preserve_clipboard"])
        form.addWidget(self.preserve)
        form.addWidget(hint_label(tr("set_clipboard_hint")))
        form.addSpacing(6)

        form.addWidget(QLabel(tr("set_insert_mode")))
        self.insert_mode = QComboBox()
        self.insert_mode.addItem(tr("insert_type"))
        self.insert_mode.addItem(tr("insert_paste"))
        self.insert_mode.setCurrentIndex(INSERT_MODES.index(self.settings["insert_mode"]))
        form.addWidget(self.insert_mode)

        form.addSpacing(10)
        form.addWidget(section_label(tr("set_notifications")))
        self.toast_miss = QCheckBox(tr("set_toast_miss"))
        self.toast_miss.setChecked(self.settings["toast_on_miss"])
        form.addWidget(self.toast_miss)
        self.toast_hit = QCheckBox(tr("set_toast_hit"))
        self.toast_hit.setChecked(self.settings["toast_on_hit"])
        form.addWidget(self.toast_hit)

    def _buttons(self):
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

    def _save(self):
        language = LANGUAGES[self.language.currentIndex()][0]
        self.language_changed = language != self.settings["language"]

        self.settings.update({
            "language": language,
            "enabled": self.enabled.isChecked(),
            "double_tap_ms": self.double_tap.value(),
            "case_sensitive_default": self.case_default.currentIndex() == 0,
            "preserve_clipboard": self.preserve.isChecked(),
            "insert_mode": INSERT_MODES[self.insert_mode.currentIndex()],
            "toast_on_miss": self.toast_miss.isChecked(),
            "toast_on_hit": self.toast_hit.isChecked(),
            "convert_enabled": self.convert_enabled.isChecked(),
            "convert_switch_layout": self.convert_switch.isChecked(),
        })
        self.settings.save()
        autostart.set_enabled(self.autostart.isChecked())
        self.accept()
