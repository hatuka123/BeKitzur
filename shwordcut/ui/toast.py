"""Small fading pixel notification that never takes focus."""

from PyQt6.QtCore import QEasingCurve, QPropertyAnimation, Qt, QTimer
from PyQt6.QtGui import QCursor
from PyQt6.QtWidgets import QApplication, QHBoxLayout, QLabel, QWidget

from . import theme

HOLD_MS = 1300
FADE_MS = 400


class Toast(QWidget):
    def __init__(self):
        super().__init__(
            None,
            Qt.WindowType.FramelessWindowHint
            | Qt.WindowType.Tool
            | Qt.WindowType.WindowStaysOnTopHint
            | Qt.WindowType.WindowDoesNotAcceptFocus,
        )
        self.setAttribute(Qt.WidgetAttribute.WA_ShowWithoutActivating)
        self.setFocusPolicy(Qt.FocusPolicy.NoFocus)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(14, 10, 14, 10)
        self.label = QLabel("")
        layout.addWidget(self.label)

        self._hold = QTimer(self)
        self._hold.setSingleShot(True)
        self._hold.timeout.connect(self._fade_out)

        self._fade = QPropertyAnimation(self, b"windowOpacity", self)
        self._fade.setDuration(FADE_MS)
        self._fade.setEasingCurve(QEasingCurve.Type.InQuad)
        self._fade.finished.connect(self.hide)

    def _style(self, good):
        edge = theme.ACCENT if good else theme.WARN
        self.setStyleSheet(
            f"QWidget {{ background: {theme.PANEL}; border: 3px solid {edge}; }}"
            f"QLabel {{ color: {edge}; border: none; font-family: {theme.FONT_STACK};"
            f" font-size: 14px; font-weight: bold; }}"
        )

    def show_message(self, text, good, at_cursor=True):
        self._hold.stop()
        self._fade.stop()
        self.label.setText(text)
        self._style(good)
        self.adjustSize()

        screen = QApplication.screenAt(QCursor.pos()) or QApplication.primaryScreen()
        area = screen.availableGeometry()
        if at_cursor:
            pos = QCursor.pos()
            x, y = pos.x() + 18, pos.y() + 24
        else:
            x = area.right() - self.width() - 24
            y = area.bottom() - self.height() - 24
        x = max(area.left(), min(x, area.right() - self.width()))
        y = max(area.top(), min(y, area.bottom() - self.height()))

        self.move(x, y)
        self.setWindowOpacity(1.0)
        self.show()
        self.raise_()
        self._hold.start(HOLD_MS)

    def _fade_out(self):
        self._fade.setStartValue(1.0)
        self._fade.setEndValue(0.0)
        self._fade.start()
