"""Shared pixel-styled widget helpers."""

from PyQt6.QtWidgets import QFrame, QLabel, QPushButton


def pixel_button(text, role=None):
    button = QPushButton(text)
    if role:
        button.setObjectName(role)
    button.setCursor(button.cursor())
    return button


def section_label(text):
    label = QLabel(f"■ {text}")
    label.setObjectName("SectionHead")
    return label


def divider():
    line = QFrame()
    line.setObjectName("Divider")
    line.setFrameShape(QFrame.Shape.NoFrame)
    return line


def hint_label(text):
    label = QLabel(text)
    label.setObjectName("Hint")
    label.setWordWrap(True)
    return label
