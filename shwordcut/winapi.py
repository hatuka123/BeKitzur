"""Win32 interop: low-level keyboard hook, synthetic input, clipboard."""

import ctypes
import threading
import time
from ctypes import wintypes

user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

if ctypes.sizeof(ctypes.c_void_p) == 8:
    ULONG_PTR = ctypes.c_uint64
else:
    ULONG_PTR = ctypes.c_uint32

LRESULT = ctypes.c_ssize_t

WH_KEYBOARD_LL = 13
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
WM_SYSKEYDOWN = 0x0104
WM_SYSKEYUP = 0x0105
WM_QUIT = 0x0012

VK_CAPITAL = 0x14
VK_CONTROL = 0x11
VK_LCONTROL = 0xA2
VK_SHIFT = 0x10
VK_MENU = 0x12
VK_LWIN = 0x5B
VK_RWIN = 0x5C
VK_LEFT = 0x25
VK_RIGHT = 0x27
VK_C = 0x43
VK_V = 0x56

INPUT_KEYBOARD = 1
KEYEVENTF_EXTENDEDKEY = 0x0001
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004
MAPVK_VK_TO_VSC = 0

# Keys that live on the extended scan-code page; without the flag Windows reads
# the arrows as their numpad twins.
EXTENDED_KEYS = frozenset({
    0x21, 0x22, 0x23, 0x24,  # PgUp PgDn End Home
    0x25, 0x26, 0x27, 0x28,  # arrows
    0x2D, 0x2E,              # Insert Delete
    0x5B, 0x5C,              # Win
    0x6F, 0x90,              # Divide NumLock
    0xA3, 0xA5,              # RControl RMenu
})

CF_UNICODETEXT = 13
GMEM_MOVEABLE = 0x0002

WM_INPUTLANGCHANGEREQUEST = 0x0050
LANG_ENGLISH = 0x09
LANG_HEBREW = 0x0D

# Tags input we inject ourselves so the hook can ignore it.
SIGNATURE = 0x50585350


class KBDLLHOOKSTRUCT(ctypes.Structure):
    _fields_ = [
        ("vkCode", wintypes.DWORD),
        ("scanCode", wintypes.DWORD),
        ("flags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ULONG_PTR),
    ]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [
        ("uMsg", wintypes.DWORD),
        ("wParamL", wintypes.WORD),
        ("wParamH", wintypes.WORD),
    ]


class _INPUTUNION(ctypes.Union):
    _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT), ("hi", HARDWAREINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("u", _INPUTUNION)]


HOOKPROC = ctypes.CFUNCTYPE(LRESULT, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)

user32.SetWindowsHookExW.argtypes = [ctypes.c_int, HOOKPROC, wintypes.HINSTANCE, wintypes.DWORD]
user32.SetWindowsHookExW.restype = wintypes.HHOOK
user32.CallNextHookEx.argtypes = [wintypes.HHOOK, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
user32.CallNextHookEx.restype = LRESULT
user32.UnhookWindowsHookEx.argtypes = [wintypes.HHOOK]
user32.UnhookWindowsHookEx.restype = wintypes.BOOL
user32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int]
user32.SendInput.restype = wintypes.UINT
user32.GetMessageW.argtypes = [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]
user32.GetMessageW.restype = wintypes.BOOL
user32.PostThreadMessageW.argtypes = [wintypes.DWORD, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user32.PostThreadMessageW.restype = wintypes.BOOL
user32.GetClipboardSequenceNumber.restype = wintypes.DWORD
user32.OpenClipboard.argtypes = [wintypes.HWND]
user32.OpenClipboard.restype = wintypes.BOOL
user32.CloseClipboard.argtypes = []
user32.CloseClipboard.restype = wintypes.BOOL
user32.EmptyClipboard.argtypes = []
user32.EmptyClipboard.restype = wintypes.BOOL
user32.GetClipboardData.argtypes = [wintypes.UINT]
user32.GetClipboardData.restype = wintypes.HANDLE
user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
user32.SetClipboardData.restype = wintypes.HANDLE
user32.GetKeyState.argtypes = [ctypes.c_int]
user32.GetKeyState.restype = ctypes.c_short
user32.GetAsyncKeyState.argtypes = [ctypes.c_int]
user32.GetAsyncKeyState.restype = ctypes.c_short
user32.MapVirtualKeyW.argtypes = [wintypes.UINT, wintypes.UINT]
user32.MapVirtualKeyW.restype = wintypes.UINT
user32.EnumClipboardFormats.argtypes = [wintypes.UINT]
user32.EnumClipboardFormats.restype = wintypes.UINT
user32.GetClipboardFormatNameW.argtypes = [wintypes.UINT, wintypes.LPWSTR, ctypes.c_int]
user32.GetClipboardFormatNameW.restype = ctypes.c_int
user32.GetForegroundWindow.argtypes = []
user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD
user32.GetKeyboardLayout.argtypes = [wintypes.DWORD]
user32.GetKeyboardLayout.restype = wintypes.HKL
user32.GetKeyboardLayoutList.argtypes = [ctypes.c_int, ctypes.POINTER(wintypes.HKL)]
user32.GetKeyboardLayoutList.restype = ctypes.c_int
user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
user32.PostMessageW.restype = wintypes.BOOL
kernel32.GetCurrentThreadId.restype = wintypes.DWORD
kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalLock.restype = wintypes.LPVOID
kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalUnlock.restype = wintypes.BOOL
kernel32.GlobalFree.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalFree.restype = wintypes.HGLOBAL
kernel32.GlobalSize.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalSize.restype = ctypes.c_size_t
kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
kernel32.GetModuleHandleW.restype = wintypes.HMODULE


def _make_input(vk=0, scan=0, flags=0):
    inp = INPUT()
    inp.type = INPUT_KEYBOARD
    inp.u.ki = KEYBDINPUT(wVk=vk, wScan=scan, dwFlags=flags, time=0, dwExtraInfo=SIGNATURE)
    return inp


def _send(inputs):
    if not inputs:
        return
    arr = (INPUT * len(inputs))(*inputs)
    user32.SendInput(len(inputs), arr, ctypes.sizeof(INPUT))


def _key_input(vk, up=False):
    """Virtual-key event carrying its real scan code, which many apps read instead of wVk."""
    flags = KEYEVENTF_KEYUP if up else 0
    if vk in EXTENDED_KEYS:
        flags |= KEYEVENTF_EXTENDEDKEY
    scan = user32.MapVirtualKeyW(vk, MAPVK_VK_TO_VSC)
    return _make_input(vk=vk, scan=scan, flags=flags)


def send_chord(*vks):
    """Press vks in order, release in reverse. e.g. send_chord(VK_CONTROL, VK_C)."""
    seq = [_key_input(v) for v in vks]
    seq += [_key_input(v, up=True) for v in reversed(vks)]
    _send(seq)


def send_key(vk, times=1, shift=False):
    seq = [_key_input(VK_SHIFT)] if shift else []
    for _ in range(times):
        seq.append(_key_input(vk))
        seq.append(_key_input(vk, up=True))
    if shift:
        seq.append(_key_input(VK_SHIFT, up=True))
    _send(seq)


def type_text(text):
    """Type text as Unicode, bypassing keyboard layout and Caps Lock state."""
    seq = []
    encoded = text.encode("utf-16-le")
    for i in range(0, len(encoded), 2):
        code = encoded[i] | (encoded[i + 1] << 8)
        seq.append(_make_input(scan=code, flags=KEYEVENTF_UNICODE))
        seq.append(_make_input(scan=code, flags=KEYEVENTF_UNICODE | KEYEVENTF_KEYUP))
    # SendInput caps out on very large batches; chunk to stay safe.
    for i in range(0, len(seq), 200):
        _send(seq[i:i + 200])


def release_modifiers():
    """Drop any modifier the user is physically holding, so it can't corrupt injected keys."""
    seq = []
    for vk in (VK_CONTROL, VK_SHIFT, VK_MENU, VK_LWIN, VK_RWIN):
        if user32.GetAsyncKeyState(vk) & 0x8000:
            seq.append(_key_input(vk, up=True))
    _send(seq)


EVENT_MODIFY_STATE = 0x0002
SYNCHRONIZE = 0x00100000
INFINITE = 0xFFFFFFFF
WAIT_OBJECT_0 = 0

kernel32.CreateEventW.argtypes = [wintypes.LPVOID, wintypes.BOOL, wintypes.BOOL, wintypes.LPCWSTR]
kernel32.CreateEventW.restype = wintypes.HANDLE
kernel32.OpenEventW.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.LPCWSTR]
kernel32.OpenEventW.restype = wintypes.HANDLE
kernel32.SetEvent.argtypes = [wintypes.HANDLE]
kernel32.SetEvent.restype = wintypes.BOOL
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.CloseHandle.restype = wintypes.BOOL
kernel32.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
kernel32.WaitForSingleObject.restype = wintypes.DWORD


def create_event(name):
    return kernel32.CreateEventW(None, False, False, name)


def open_event(name):
    return kernel32.OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, False, name)


def set_event(handle):
    return bool(kernel32.SetEvent(handle))


def wait_event(handle, timeout_ms=INFINITE):
    return kernel32.WaitForSingleObject(handle, timeout_ms) == WAIT_OBJECT_0


def close_handle(handle):
    if handle:
        kernel32.CloseHandle(handle)


def clipboard_sequence():
    return user32.GetClipboardSequenceNumber()


def _open_clipboard(retries=12, delay=0.02):
    for _ in range(retries):
        if user32.OpenClipboard(None):
            return True
        time.sleep(delay)
    return False


def get_clipboard_text():
    if not _open_clipboard():
        return None
    try:
        handle = user32.GetClipboardData(CF_UNICODETEXT)
        if not handle:
            return None
        ptr = kernel32.GlobalLock(handle)
        if not ptr:
            return None
        try:
            return ctypes.c_wchar_p(ptr).value
        finally:
            kernel32.GlobalUnlock(handle)
    finally:
        user32.CloseClipboard()


def set_clipboard_text(text):
    if text is None:
        return False
    if not _open_clipboard():
        return False
    try:
        user32.EmptyClipboard()
        data = ctypes.create_unicode_buffer(text)
        size = ctypes.sizeof(data)
        handle = kernel32.GlobalAlloc(GMEM_MOVEABLE, size)
        if not handle:
            return False
        ptr = kernel32.GlobalLock(handle)
        ctypes.memmove(ptr, data, size)
        kernel32.GlobalUnlock(handle)
        if not user32.SetClipboardData(CF_UNICODETEXT, handle):
            # Ownership only transfers on success, so the block is still ours to free.
            kernel32.GlobalFree(handle)
            return False
        return True
    finally:
        user32.CloseClipboard()


# Editors such as VS Code copy the whole line when nothing is selected. They tag
# that copy so their own paste can tell it apart, and so can we.
_LINE_COPY_FORMATS = ("vscode-editor-data", "chromium web custom mime data format")
_LINE_COPY_MARKS = tuple(
    '"isFromEmptySelection":true'.encode(enc) for enc in ("utf-8", "utf-16-le")
)


def _clipboard_bytes(fmt):
    handle = user32.GetClipboardData(fmt)
    if not handle:
        return None
    ptr = kernel32.GlobalLock(handle)
    if not ptr:
        return None
    try:
        return ctypes.string_at(ptr, kernel32.GlobalSize(handle))
    finally:
        kernel32.GlobalUnlock(handle)


def clipboard_is_line_copy():
    """True when the clipboard holds an editor's whole-line copy of an empty selection."""
    if not _open_clipboard():
        return False
    try:
        name = ctypes.create_unicode_buffer(128)
        fmt = user32.EnumClipboardFormats(0)
        while fmt:
            if user32.GetClipboardFormatNameW(fmt, name, len(name)):
                if name.value.lower() in _LINE_COPY_FORMATS:
                    data = _clipboard_bytes(fmt)
                    if data and any(mark in data for mark in _LINE_COPY_MARKS):
                        return True
            fmt = user32.EnumClipboardFormats(fmt)
        return False
    finally:
        user32.CloseClipboard()


def _primary_lang(hkl):
    return (hkl or 0) & 0x3FF


def foreground_layout_lang():
    """Primary language id of the keyboard layout active in the foreground window."""
    thread = user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), None)
    return _primary_lang(user32.GetKeyboardLayout(thread))


def switch_layout(lang):
    """Ask the foreground window to switch to an installed layout of the given language."""
    hwnd = user32.GetForegroundWindow()
    if not hwnd or foreground_layout_lang() == lang:
        return False
    count = user32.GetKeyboardLayoutList(0, None)
    layouts = (wintypes.HKL * count)()
    user32.GetKeyboardLayoutList(count, layouts)
    for hkl in layouts:
        if _primary_lang(hkl) == lang:
            # HKLs can be sign-extended; wrap into LPARAM's signed range.
            lparam = ctypes.c_ssize_t(hkl).value
            return bool(user32.PostMessageW(hwnd, WM_INPUTLANGCHANGEREQUEST, 0, lparam))
    return False


class KeyboardHook:
    """Runs a WH_KEYBOARD_LL hook on its own thread with a dedicated message loop.

    A private thread keeps the callback off the Qt loop: Windows silently drops hooks
    whose callback exceeds LowLevelHooksTimeout (300ms by default).
    """

    def __init__(self, on_event):
        self._on_event = on_event
        self._thread = None
        self._thread_id = None
        self._hook = None
        self._proc = None
        self._ready = threading.Event()

    @property
    def installed(self):
        return bool(self._hook)

    def start(self):
        if self._thread:
            return
        self._thread = threading.Thread(target=self._run, daemon=True, name="shwordcut-hook")
        self._thread.start()
        self._ready.wait(timeout=3)

    def stop(self):
        if self._thread_id:
            user32.PostThreadMessageW(self._thread_id, WM_QUIT, 0, 0)
        if self._thread:
            self._thread.join(timeout=2)
        self._thread = None
        self._thread_id = None

    def _run(self):
        self._thread_id = kernel32.GetCurrentThreadId()

        def callback(code, wparam, lparam):
            if code == 0:
                data = ctypes.cast(lparam, ctypes.POINTER(KBDLLHOOKSTRUCT)).contents
                if data.dwExtraInfo != SIGNATURE:
                    is_down = wparam in (WM_KEYDOWN, WM_SYSKEYDOWN)
                    try:
                        self._on_event(data.vkCode, is_down)
                    except Exception:
                        pass
            return user32.CallNextHookEx(None, code, wparam, lparam)

        self._proc = HOOKPROC(callback)
        self._hook = user32.SetWindowsHookExW(
            WH_KEYBOARD_LL, self._proc, kernel32.GetModuleHandleW(None), 0
        )
        self._ready.set()
        if not self._hook:
            return

        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            pass
        user32.UnhookWindowsHookEx(self._hook)
        self._hook = None
