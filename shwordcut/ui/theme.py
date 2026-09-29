"""Retro pixel-art palette and stylesheet."""

from PyQt6.QtGui import QColor, QPalette

# Game Boy DMG green-olive, widened just enough for warning and danger states.
BG = "#081c08"
PANEL = "#0f2f0f"
PANEL_ALT = "#16441a"
ROW_ALT = "#0c260c"
BORDER = "#306230"
BORDER_HI = "#6f9a1a"
ACCENT = "#9bbc0f"
ACCENT_DK = "#5d7a0c"
DANGER = "#b8431a"
DANGER_DK = "#6d2409"
WARN = "#d4c20a"
TEXT = "#c5dd7a"
TEXT_DIM = "#6b8a45"
SHADOW = "#030a03"

# Miriam Fixed is a Windows bitmap face: pixel-crisp and it covers Hebrew.
FONT_STACK = '"Miriam Fixed", "Consolas", "Courier New", monospace'


def palette():
    """Dark base palette so widgets the stylesheet does not reach stay readable."""
    p = QPalette()
    p.setColor(QPalette.ColorRole.Window, QColor(BG))
    p.setColor(QPalette.ColorRole.WindowText, QColor(TEXT))
    p.setColor(QPalette.ColorRole.Base, QColor(BG))
    p.setColor(QPalette.ColorRole.AlternateBase, QColor(ROW_ALT))
    p.setColor(QPalette.ColorRole.Text, QColor(TEXT))
    p.setColor(QPalette.ColorRole.Button, QColor(PANEL_ALT))
    p.setColor(QPalette.ColorRole.ButtonText, QColor(TEXT))
    p.setColor(QPalette.ColorRole.Highlight, QColor(BORDER))
    p.setColor(QPalette.ColorRole.HighlightedText, QColor(TEXT))
    p.setColor(QPalette.ColorRole.ToolTipBase, QColor(PANEL))
    p.setColor(QPalette.ColorRole.ToolTipText, QColor(TEXT))
    p.setColor(QPalette.ColorRole.PlaceholderText, QColor(TEXT_DIM))
    for role in (QPalette.ColorRole.Text, QPalette.ColorRole.ButtonText,
                 QPalette.ColorRole.WindowText):
        p.setColor(QPalette.ColorGroup.Disabled, role, QColor(TEXT_DIM))
    return p


def qss(scale=1):
    s = lambda n: int(n * scale)
    return f"""
* {{
    font-family: {FONT_STACK};
    font-size: {s(15)}px;
    color: {TEXT};
    outline: none;
}}

QWidget#Root, QDialog {{
    background: {BG};
}}

QScrollArea {{
    background: {BG};
    border: none;
}}
QScrollArea > QWidget > QWidget {{
    background: {BG};
}}

QLabel#Title {{
    color: {ACCENT};
    font-size: {s(22)}px;
    font-weight: bold;
    letter-spacing: 2px;
    padding: {s(4)}px 0;
}}

QLabel#Subtitle, QLabel#Hint {{
    color: {TEXT_DIM};
    font-size: {s(13)}px;
}}

QLabel#SectionHead {{
    color: {WARN};
    font-size: {s(14)}px;
    font-weight: bold;
    letter-spacing: 2px;
    padding-top: {s(10)}px;
}}

QLabel#Empty {{
    color: {TEXT_DIM};
    font-size: {s(14)}px;
    padding: {s(30)}px;
}}

QFrame#Card {{
    background: {PANEL};
    border: 3px solid {BORDER};
}}

QFrame#Divider {{
    background: {BORDER};
    max-height: 2px;
    min-height: 2px;
    border: none;
}}

QPushButton {{
    background: {PANEL_ALT};
    border: 3px solid {BORDER};
    border-bottom: {s(6)}px solid {SHADOW};
    padding: {s(7)}px {s(16)}px;
    font-weight: bold;
    letter-spacing: 1px;
    min-height: {s(16)}px;
}}
QPushButton:hover {{
    background: {BORDER};
    border-color: {BORDER_HI};
}}
QPushButton:pressed {{
    border-bottom: 3px solid {SHADOW};
    margin-top: {s(3)}px;
    background: {BORDER_HI};
    color: {BG};
}}
QPushButton:disabled {{
    color: {TEXT_DIM};
    border-color: {PANEL_ALT};
    border-bottom-color: {SHADOW};
}}

QPushButton#Primary {{
    background: {ACCENT_DK};
    border-color: {ACCENT};
    color: {BG};
}}
QPushButton#Primary:hover {{
    background: {ACCENT};
}}
QPushButton#Danger {{
    background: {DANGER_DK};
    border-color: {DANGER};
}}
QPushButton#Danger:hover {{
    background: {DANGER};
    color: {BG};
}}

QLineEdit, QTextEdit, QSpinBox, QComboBox {{
    background: {BG};
    border: 3px solid {BORDER};
    padding: {s(6)}px {s(8)}px;
    selection-background-color: {ACCENT};
    selection-color: {BG};
}}
QLineEdit:focus, QTextEdit:focus, QSpinBox:focus, QComboBox:focus {{
    border-color: {ACCENT};
}}
QLineEdit[invalid="true"] {{
    border-color: {DANGER};
}}

QComboBox::drop-down {{
    border: none;
    width: {s(22)}px;
}}
QComboBox::down-arrow {{
    image: none;
    border-left: {s(5)}px solid transparent;
    border-right: {s(5)}px solid transparent;
    border-top: {s(6)}px solid {ACCENT};
    width: 0;
    height: 0;
}}
QComboBox QAbstractItemView {{
    background: {PANEL};
    border: 3px solid {ACCENT};
    selection-background-color: {BORDER};
    padding: {s(2)}px;
}}

QSpinBox::up-button, QSpinBox::down-button {{
    background: {PANEL_ALT};
    border: 2px solid {BORDER};
    width: {s(18)}px;
}}
QSpinBox::up-arrow {{
    border-left: {s(4)}px solid transparent;
    border-right: {s(4)}px solid transparent;
    border-bottom: {s(5)}px solid {ACCENT};
    width: 0; height: 0;
}}
QSpinBox::down-arrow {{
    border-left: {s(4)}px solid transparent;
    border-right: {s(4)}px solid transparent;
    border-top: {s(5)}px solid {ACCENT};
    width: 0; height: 0;
}}

QTableWidget {{
    background: {PANEL};
    border: 3px solid {BORDER};
    gridline-color: {PANEL_ALT};
    selection-background-color: {BORDER};
    selection-color: {TEXT};
}}
QTableWidget::item {{
    padding: {s(6)}px {s(8)}px;
    border: none;
}}
QTableWidget::item:selected {{
    background: {BORDER};
}}
QHeaderView::section {{
    background: {PANEL_ALT};
    color: {WARN};
    border: none;
    border-bottom: 3px solid {BORDER};
    border-right: 2px solid {BG};
    padding: {s(7)}px {s(8)}px;
    font-weight: bold;
    letter-spacing: 1px;
}}
QTableCornerButton::section {{
    background: {PANEL_ALT};
    border: none;
}}
QTableWidget::indicator {{
    width: {s(16)}px;
    height: {s(16)}px;
    background: {BG};
    border: 3px solid {BORDER};
}}
QTableWidget::indicator:checked {{
    background: {ACCENT};
    border-color: {ACCENT};
}}

QCheckBox {{
    spacing: {s(10)}px;
    padding: {s(3)}px 0;
}}
QCheckBox::indicator {{
    width: {s(18)}px;
    height: {s(18)}px;
    background: {BG};
    border: 3px solid {BORDER};
}}
QCheckBox::indicator:checked {{
    background: {ACCENT};
    border-color: {ACCENT};
}}
QCheckBox::indicator:hover {{
    border-color: {BORDER_HI};
}}

QScrollBar:vertical {{
    background: {BG};
    width: {s(16)}px;
    border-left: 2px solid {BORDER};
}}
QScrollBar::handle:vertical {{
    background: {BORDER};
    min-height: {s(28)}px;
    border: 2px solid {PANEL_ALT};
}}
QScrollBar::handle:vertical:hover {{
    background: {BORDER_HI};
}}
QScrollBar:horizontal {{
    background: {BG};
    height: {s(16)}px;
    border-top: 2px solid {BORDER};
}}
QScrollBar::handle:horizontal {{
    background: {BORDER};
    min-width: {s(28)}px;
    border: 2px solid {PANEL_ALT};
}}
QScrollBar::add-line, QScrollBar::sub-line {{
    height: 0; width: 0;
}}
QScrollBar::add-page, QScrollBar::sub-page {{
    background: none;
}}

QMenu {{
    background: {PANEL};
    border: 3px solid {ACCENT};
    padding: {s(4)}px;
}}
QMenu::item {{
    padding: {s(7)}px {s(20)}px;
}}
QMenu::item:selected {{
    background: {BORDER};
}}
QMenu::separator {{
    height: 2px;
    background: {BORDER};
    margin: {s(4)}px {s(2)}px;
}}

QToolTip {{
    background: {PANEL};
    color: {TEXT};
    border: 2px solid {ACCENT};
    padding: {s(4)}px;
}}
"""
