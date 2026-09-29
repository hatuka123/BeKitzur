"""Generate build-time assets: the .ico and the Windows version resource for the exe."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PyQt6.QtGui import QGuiApplication

from shwordcut import __author__, __version__

VERSION_TEMPLATE = """VSVersionInfo(
  ffi=FixedFileInfo(
    filevers={tup}, prodvers={tup}, mask=0x3f, flags=0x0,
    OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
  kids=[
    StringFileInfo([StringTable('040904B0', [
      StringStruct('CompanyName', '{author}'),
      StringStruct('FileDescription', 'BeKitzur - text shortcuts'),
      StringStruct('FileVersion', '{ver}'),
      StringStruct('InternalName', 'BeKitzur'),
      StringStruct('LegalCopyright', 'Copyright (c) 2026 {author}. MIT License.'),
      StringStruct('OriginalFilename', 'BeKitzur.exe'),
      StringStruct('ProductName', 'BeKitzur'),
      StringStruct('ProductVersion', '{ver}')])]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
"""


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    app = QGuiApplication(sys.argv[:1])
    from shwordcut.ui.icon import ico_bytes, pixmap

    (out / "shwordcut.ico").write_bytes(ico_bytes())
    pixmap(256).save(str(out / "shwordcut-256.png"))

    parts = [int(p) for p in __version__.split(".")]
    tup = tuple((parts + [0, 0, 0, 0])[:4])
    (out / "version_info.txt").write_text(
        VERSION_TEMPLATE.format(tup=tup, ver=__version__, author=__author__), encoding="utf-8"
    )
    print(__author__)
    print(__version__)


if __name__ == "__main__":
    main(sys.argv[1])
