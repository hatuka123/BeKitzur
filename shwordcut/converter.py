"""Fixes text typed in the wrong keyboard layout (Hebrew <-> English)."""

import re
import time

from . import layout, winapi
from .expander import LTR_FIRST, RTL_FIRST, SELECT_SETTLE, TextAction

# Most apps leave the clipboard alone when Ctrl+C has nothing to copy, so the
# selection probe always waits this long when there is no selection.
PROBE_TIMEOUT = 0.15
# Punctuation that is a letter on the other layout (, . ; ') splits words for
# Ctrl+Left, so a mistyped word can take several jumps to cover.
MAX_EXTEND = 8

_LAST_TOKEN = re.compile(r"\S+$")


def _caret_steps(text):
    """Arrow presses needed to cross text: a line break is one caret position."""
    return len(text) - text.count("\r\n")


class LayoutConverter(TextAction):
    def __init__(self, settings):
        super().__init__(settings)
        self._preferred = LTR_FIRST

    def _run(self):
        if not self.settings["convert_enabled"]:
            return

        preserve = self.settings["preserve_clipboard"]
        saved = winapi.get_clipboard_text() if preserve else None
        winapi.release_modifiers()

        selected = self._selection()
        if selected is not None:
            if self._replace(selected, "", saved, preserve):
                return
        else:
            found = self._word_before_caret()
            if found:
                word, trail, shrink_key = found
                if self._replace(word, trail, saved, preserve):
                    return
                self._shrink(shrink_key, word + trail)

        self._restore(saved, preserve)
        self.notify.emit("toast_convert_empty", False)

    def _replace(self, text, trail, saved, preserve):
        typed_in_hebrew = winapi.foreground_layout_lang() == winapi.LANG_HEBREW
        converted, target = layout.convert(text, typed_in_hebrew)
        if converted == text:
            return False
        self._insert(converted + trail, saved, preserve)
        if self.settings["convert_switch_layout"]:
            winapi.switch_layout(target)
        return True

    def _selection(self):
        text = self._copy_selection(PROBE_TIMEOUT)
        if not text or winapi.clipboard_is_line_copy():
            return None
        return text

    def _word_before_caret(self):
        """Select the whitespace-delimited word before the caret.

        Returns (word, trailing whitespace, shrink key) with exactly word + trailing
        whitespace selected, or None with nothing selected.
        """
        first = self._preferred
        for select_key, shrink_key in (first, RTL_FIRST if first == LTR_FIRST else LTR_FIRST):
            text = self._grab(select_key)
            if not text:
                continue
            if not text.strip():
                self._shrink(shrink_key, text)
                continue

            # Keep extending until the selection reaches past the word's start.
            for _ in range(MAX_EXTEND):
                if any(c.isspace() for c in text.rstrip()):
                    break
                more = self._grab(select_key)
                if not more or len(more) <= len(text):
                    break  # start of the field
                text = more

            body = text.rstrip()
            trail = text[len(body):]
            if "\n" in trail:
                # Caret sits at the start of a line; the word belongs to the line above.
                self._shrink(shrink_key, text)
                return None

            word = _LAST_TOKEN.search(body).group()
            self._shrink(shrink_key, body[: len(body) - len(word)])
            self._preferred = (select_key, shrink_key)
            return word, trail, shrink_key
        return None

    def _shrink(self, shrink_key, text):
        """Move the selection's far edge back over text, keeping the rest selected."""
        steps = _caret_steps(text)
        if steps:
            winapi.send_key(shrink_key, times=steps, shift=True)
            time.sleep(SELECT_SETTLE)
