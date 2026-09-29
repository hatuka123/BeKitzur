"""Pixel-art clipboard icon, drawn from character grids so the app ships without image assets."""

import math
import struct

from PyQt6.QtCore import QBuffer, QByteArray, QIODevice, Qt
from PyQt6.QtGui import QColor, QIcon, QPainter, QPixmap

GRID_32 = [
    "................................",
    ".............kkkkkk.........y...",
    "............kppppppk........y...",
    "...........kccckkccck.....yypyy.",
    "......eeekkkccckkccckkkeee..y...",
    ".....ehhkppppppppppppppkhle.y...",
    "....ehwwkcccccccccccccckwwle....",
    "....ehwpkcccccccccccccckpwle....",
    "....ehwppkmmmmmmmmmmmmkppkle....",
    "....ehwpppkkkkkkkkkkkkpppkle....",
    "....ehwpyyyyyyyppppppppppkle....",
    "....ehwpyoooooydddddddpppkle....",
    "....ehwpyyyyyyydddddddpppkle....",
    "....ehwppppppppppppppppppkle....",
    "....ehwppppppppppppppppppkle....",
    "....ehwppddddddddddddddppkle....",
    "....ehwppddddddddddddddppkle....",
    "....ehwppppppppppppppppppkle....",
    "....ehwppppppppppppppppppkle....",
    "....ehwppddddddddddppppppkle....",
    "....ehwppddddddddddppppppkle....",
    "....ehwppppppppppppppppppkle....",
    "....ehwppppppppppppppppppkle....",
    "....ehwppddddddddppppppppkle....",
    "....ehwppddddddddppppppckkle....",
    "....ehwpppppppppppppppckkkle....",
    "....ehwppppppppppppppckkkwle....",
    "....ehwppppppppppppppkkkwwle....",
    "....elwwkkkkkkkkkkkkkkkwwwle....",
    ".....elllllllllllllllllllle.....",
    "......eeeeeeeeeeeeeeeeeeee......",
    "................................",
]

# Hand-drawn rather than downscaled: a 2:1 reduction of GRID_32 smears the text lines.
GRID_16 = [
    "......kkkk....y.",
    ".....kckkck..yyy",
    "...kcccccccck.y.",
    "...kmmmmmmmmk...",
    "..ehkkkkkkkkle..",
    "..ehpyyyddppke..",
    "..ehppppppppke..",
    "..ehpddddddpke..",
    "..ehppppppppke..",
    "..ehpddddpppke..",
    "..ehppppppppke..",
    "..ehpdddddppke..",
    "..ehpppppppkke..",
    "..ehppppppkwle..",
    "..ehwkkkkkkwle..",
    "...eeeeeeeeee...",
]

PALETTE = {
    "e": "#241205",
    "w": "#7a4a24",
    "h": "#9a6433",
    "l": "#5c3518",
    "k": "#0b200b",
    "p": "#d4ecae",
    "c": "#9bbc0f",
    "m": "#8bac0f",
    "d": "#306230",
    "y": "#f4d23a",
    "o": "#8a6d00",
}


def _paused(hex_color):
    lightness = QColor(hex_color).lightness()
    return QColor.fromHsl(90, 12, int(lightness * 0.8 + 20)).name()


PAUSED_PALETTE = {ch: _paused(c) for ch, c in PALETTE.items()}

ICO_SIZES = (16, 20, 24, 32, 40, 48, 64, 128, 256)


def _render(grid, cell, palette):
    side = len(grid) * cell
    pm = QPixmap(side, side)
    pm.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pm)
    painter.setPen(Qt.PenStyle.NoPen)
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            color = palette.get(ch)
            if color:
                painter.fillRect(x * cell, y * cell, cell, cell, QColor(color))
    painter.end()
    return pm


def pixmap(size=64, active=True):
    grid = GRID_16 if size < 28 else GRID_32
    palette = PALETTE if active else PAUSED_PALETTE
    cell = max(1, math.ceil(size / len(grid)))
    pm = _render(grid, cell, palette)
    if pm.width() != size:
        pm = pm.scaled(size, size, Qt.AspectRatioMode.IgnoreAspectRatio,
                       Qt.TransformationMode.SmoothTransformation)
    return pm


def icon(active=True):
    result = QIcon()
    for size in ICO_SIZES:
        result.addPixmap(pixmap(size, active))
    return result


def ico_bytes(sizes=ICO_SIZES):
    """A Windows .ico holding one PNG-compressed image per size."""
    images = []
    for size in sizes:
        data = QByteArray()
        buf = QBuffer(data)
        buf.open(QIODevice.OpenModeFlag.WriteOnly)
        pixmap(size).save(buf, "PNG")
        buf.close()
        images.append((size, bytes(data)))

    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    directory, payload = b"", b""
    for size, png in images:
        dim = 0 if size >= 256 else size
        directory += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(png), offset + len(payload))
        payload += png
    return header + directory + payload
