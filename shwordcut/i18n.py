"""Hebrew / English interface strings."""

STRINGS = {
    "app_title": ("ShWordCut - קיצורי טקסט", "ShWordCut - Text Shortcuts"),
    "manager": ("ניהול קיצורים", "Shortcut Manager"),
    "credit": ("גרסה {version} · מאת {author}", "v{version} · by {author}"),
    "search": ("חיפוש...", "Search..."),
    "add": ("הוסף", "ADD"),
    "edit": ("ערוך", "EDIT"),
    "delete": ("מחק", "DELETE"),
    "save": ("שמור", "SAVE"),
    "cancel": ("בטל", "CANCEL"),
    "settings": ("הגדרות", "SETTINGS"),
    "close": ("סגור", "CLOSE"),
    "quit": ("יציאה", "QUIT"),
    "col_trigger": ("קיצור", "TRIGGER"),
    "col_value": ("טקסט מלא", "EXPANDS TO"),
    "col_category": ("קטגוריה", "CATEGORY"),
    "col_uses": ("שימושים", "USES"),
    "col_on": ("פעיל", "ON"),
    "all_categories": ("כל הקטגוריות", "All categories"),
    "no_category": ("ללא קטגוריה", "Uncategorized"),
    "empty_hint": (
        "אין עדיין קיצורים. לחץ ADD כדי להוסיף את הראשון.",
        "No shortcuts yet. Press ADD to create your first one.",
    ),
    "editor_new": ("קיצור חדש", "New Shortcut"),
    "editor_edit": ("עריכת קיצור", "Edit Shortcut"),
    "field_trigger": ("המילה שתקליד", "Word you type"),
    "field_value": ("הטקסט שיופיע במקום", "Text that replaces it"),
    "field_category": ("קטגוריה (אופציונלי)", "Category (optional)"),
    "field_case": ("רגישות לאותיות גדולות/קטנות", "Case sensitivity"),
    "case_inherit": ("כמו בהגדרות הכלליות", "Use global default"),
    "case_yes": ("מדויק - mail ≠ Mail", "Exact - mail ≠ Mail"),
    "case_no": ("לא משנה - mail = Mail", "Ignore - mail = Mail"),
    "field_enabled": ("קיצור פעיל", "Shortcut enabled"),
    "err_trigger_empty": ("חובה למלא מילת קיצור", "Trigger word is required"),
    "err_trigger_space": (
        "מילת הקיצור לא יכולה להכיל רווח",
        "Trigger word cannot contain spaces",
    ),
    "err_value_empty": ("חובה למלא טקסט מחליף", "Replacement text is required"),
    "err_conflict": ("קיצור בשם זה כבר קיים", "A shortcut with this trigger already exists"),
    "confirm_delete_title": ("מחיקת קיצור", "Delete Shortcut"),
    "confirm_delete_body": (
        "למחוק את הקיצור הזה?",
        "Delete this shortcut?",
    ),
    "yes": ("כן", "YES"),
    "no": ("לא", "NO"),
    "set_general": ("כללי", "GENERAL"),
    "set_language": ("שפת ממשק", "Interface language"),
    "set_enabled": ("החלפות פעילות", "Expansion enabled"),
    "set_autostart": ("הפעלה אוטומטית עם Windows", "Start with Windows"),
    "set_trigger": ("טריגר", "TRIGGER"),
    "set_double_tap": (
        "חלון זמן ללחיצה כפולה (מילישניות)",
        "Double-tap window (milliseconds)",
    ),
    "set_trigger_hint": (
        "לחץ פעמיים מהר על Caps Lock כדי להחליף את המילה שלפני הסמן",
        "Tap Caps Lock twice quickly to expand the word before the cursor",
    ),
    "set_behavior": ("התנהגות", "BEHAVIOR"),
    "set_case_default": (
        "ברירת מחדל לרגישות אותיות",
        "Default case sensitivity",
    ),
    "set_clipboard": (
        "לשמור ולהחזיר את תוכן ה-clipboard",
        "Preserve and restore clipboard contents",
    ),
    "set_clipboard_hint": (
        "מונע מהתוכנה לדרוס את מה שהעתקת. מוסיף כ-50ms לכל החלפה.",
        "Stops the app from overwriting what you copied. Adds ~50ms per expansion.",
    ),
    "set_insert_mode": ("אופן ההוספה", "Insertion method"),
    "insert_type": ("הקלדה (עובד בכל מקום)", "Type (works everywhere)"),
    "insert_paste": ("הדבקה (מהיר יותר)", "Paste (faster)"),
    "set_notifications": ("התראות", "NOTIFICATIONS"),
    "set_toast_miss": (
        "להציג הודעה כשאין התאמה",
        "Show a message when no shortcut matches",
    ),
    "set_toast_hit": (
        "להציג הודעה בהחלפה מוצלחת",
        "Show a message on successful expansion",
    ),
    "toast_miss": ("אין קיצור למילה הזו", "No shortcut for that word"),
    "toast_empty": ("אין מילה לפני הסמן", "No word before the cursor"),
    "toast_disabled": ("ההחלפות מכובות", "Expansion is off"),
    "tray_open": ("פתח ניהול", "Open Manager"),
    "tray_toggle_on": ("הפעל החלפות", "Enable Expansion"),
    "tray_toggle_off": ("כבה החלפות", "Disable Expansion"),
    "status_on": ("פעיל", "ACTIVE"),
    "status_off": ("מכובה", "PAUSED"),
    "count_label": ("קיצורים", "shortcuts"),
    "hook_failed": (
        "לא ניתן להתחבר למקלדת. נסה להפעיל כמנהל.",
        "Could not hook the keyboard. Try running as administrator.",
    ),
}


class Translator:
    def __init__(self, settings):
        self.settings = settings

    @property
    def lang(self):
        return self.settings["language"]

    @property
    def is_rtl(self):
        return self.lang == "he"

    def __call__(self, key):
        pair = STRINGS.get(key)
        if not pair:
            return key
        return pair[0] if self.lang == "he" else pair[1]
