"""VTS window-bounds detection (D-09 + Pitfall 20).

Pitfall 20: Unity windows use generic classes; use title-prefix enumeration
instead of FindWindow by class.

The sidecar re-polls VTube Studio Win32 bounds with GetWindowRect so moving or
resizing the VTS window remains authoritative without renderer-side input.
"""

from __future__ import annotations

import sys
import time

from loguru import logger


_WINDOWS = sys.platform == "win32"
_cached_hwnd: int | None = None
_last_enum_at = 0.0
ENUM_REPROBE_INTERVAL_S = 30.0


def find_vts_hwnd(force_reprobe: bool = False) -> int | None:
    """Find and cache the VTS HWND; force_reprobe refreshes sidecar authority."""
    global _cached_hwnd, _last_enum_at
    if not _WINDOWS:
        return None
    now = time.monotonic()
    if (
        not force_reprobe
        and _cached_hwnd is not None
        and (now - _last_enum_at) < ENUM_REPROBE_INTERVAL_S
    ):
        return _cached_hwnd
    try:
        import win32gui
    except ImportError:
        logger.warning("[WINDOW-DETECT] pywin32 not installed")
        return None

    found: list[int] = []

    def cb(hwnd: int, _extra) -> bool:
        if not win32gui.IsWindowVisible(hwnd):
            return True
        try:
            title = win32gui.GetWindowText(hwnd)
        except Exception:
            return True
        if title.startswith("VTube Studio"):
            found.append(hwnd)
        return True

    try:
        win32gui.EnumWindows(cb, None)
    except Exception as exc:
        logger.warning(f"[WINDOW-DETECT] EnumWindows failed: {exc!r}")
        return None

    _last_enum_at = now
    _cached_hwnd = found[0] if found else None
    return _cached_hwnd


def get_vts_rect(hwnd: int) -> tuple[int, int, int, int] | None:
    if not _WINDOWS or hwnd is None:
        return None
    try:
        import win32gui

        return win32gui.GetWindowRect(hwnd)
    except Exception as exc:
        logger.debug(f"[WINDOW-DETECT] GetWindowRect failed for hwnd={hwnd!r}: {exc!r}")
        return None


def get_cursor_pos() -> tuple[int, int]:
    if not _WINDOWS:
        return (0, 0)
    try:
        import win32gui

        return win32gui.GetCursorPos()
    except Exception:
        return (0, 0)


def get_cursor_and_rect() -> tuple[tuple[int, int], tuple[int, int, int, int] | None]:
    """Return the sidecar Win32 cursor sample plus current authoritative VTS rect."""
    global _cached_hwnd
    hwnd = find_vts_hwnd()
    if hwnd is None:
        return get_cursor_pos(), None
    rect = get_vts_rect(hwnd)
    if rect is None:
        _cached_hwnd = None
    return get_cursor_pos(), rect
