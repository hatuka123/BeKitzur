"""Hebrew <-> English keyboard layout mapping (standard Israeli SI-1452 layout)."""

from . import winapi

# Each English key and the character the same key produces on the Hebrew layout.
_EN_KEYS = "qwertyuiop" "asdfghjkl;'" "zxcvbnm,./"
_HE_KEYS = "/'קראטוןםפ" "שדגכעיחלךף," "זסבהנמצתץ."

EN_TO_HE = dict(zip(_EN_KEYS, _HE_KEYS))
HE_TO_EN = dict(zip(_HE_KEYS, _EN_KEYS))


def _is_hebrew_letter(ch):
    return "א" <= ch <= "ת"


def _is_latin_letter(ch):
    return ch.isascii() and ch.isalpha()


def convert(text, typed_in_hebrew=False):
    """Retype text as if the same keys had been pressed on the other layout.

    Returns (converted, target_language). Letters decide the direction; text made
    only of punctuation falls back to the layout it was typed in.
    """
    if any(_is_hebrew_letter(c) for c in text):
        to_english = True
    elif any(_is_latin_letter(c) for c in text):
        to_english = False
    else:
        to_english = typed_in_hebrew

    if to_english:
        converted = "".join(HE_TO_EN.get(c, c) for c in text)
        return converted, winapi.LANG_ENGLISH
    converted = "".join(EN_TO_HE.get(c.lower(), c) for c in text)
    return converted, winapi.LANG_HEBREW
