import sys
from unittest import mock

from sidecar.vts import window_detect


def test_non_windows_platform_returns_none(monkeypatch):
    monkeypatch.setattr(window_detect, "_WINDOWS", False)
    monkeypatch.setattr(window_detect, "_cached_hwnd", None)
    assert window_detect.find_vts_hwnd() is None
    assert window_detect.get_cursor_pos() == (0, 0)
    assert window_detect.get_vts_rect(0) is None


def test_title_prefix_match_finds_vts(monkeypatch):
    monkeypatch.setattr(window_detect, "_WINDOWS", True)
    monkeypatch.setattr(window_detect, "_cached_hwnd", None)
    monkeypatch.setattr(window_detect, "_last_enum_at", 0.0)

    fake_win32gui = mock.MagicMock()

    def fake_enum(cb, _extra):
        cb(101, None)
        cb(102, None)
        cb(103, None)

    fake_win32gui.EnumWindows = fake_enum
    fake_win32gui.IsWindowVisible.return_value = True
    fake_win32gui.GetWindowText.side_effect = lambda h: {
        101: "VTube Studio",
        102: "Notepad",
        103: "Unity Hub",
    }[h]

    with mock.patch.dict("sys.modules", {"win32gui": fake_win32gui}):
        hwnd = window_detect.find_vts_hwnd(force_reprobe=True)
    assert hwnd == 101


def test_cache_avoids_reprobe_within_interval(monkeypatch):
    monkeypatch.setattr(window_detect, "_WINDOWS", True)
    monkeypatch.setattr(window_detect, "_cached_hwnd", 999)
    monkeypatch.setattr(window_detect, "_last_enum_at", window_detect.time.monotonic())

    fake_win32gui = mock.MagicMock()
    with mock.patch.dict("sys.modules", {"win32gui": fake_win32gui}):
        assert window_detect.find_vts_hwnd() == 999

    fake_win32gui.EnumWindows.assert_not_called()


def test_force_reprobe_ignores_cached_hwnd_and_finds_new_vts_window(monkeypatch):
    monkeypatch.setattr(window_detect, "_WINDOWS", True)
    monkeypatch.setattr(window_detect, "_cached_hwnd", 999)
    monkeypatch.setattr(window_detect, "_last_enum_at", window_detect.time.monotonic())

    fake_win32gui = mock.MagicMock()

    def fake_enum(cb, _extra):
        cb(1234, None)

    fake_win32gui.EnumWindows = fake_enum
    fake_win32gui.IsWindowVisible.return_value = True
    fake_win32gui.GetWindowText.return_value = "VTube Studio - Reopened"

    with mock.patch.dict("sys.modules", {"win32gui": fake_win32gui}):
        assert window_detect.find_vts_hwnd(force_reprobe=True) == 1234


def test_primary_monitor_rect_returns_screen_size_on_windows(monkeypatch):
    monkeypatch.setattr(window_detect, "_WINDOWS", True)
    fake_win32api = mock.MagicMock()
    # SM_CXSCREEN=0 -> 1920, SM_CYSCREEN=1 -> 1080
    fake_win32api.GetSystemMetrics.side_effect = lambda idx: {0: 1920, 1: 1080}[idx]
    with mock.patch.dict("sys.modules", {"win32api": fake_win32api}):
        rect = window_detect.get_primary_monitor_rect()
    assert rect == (0, 0, 1920, 1080)


def test_primary_monitor_rect_returns_none_on_non_windows(monkeypatch):
    monkeypatch.setattr(window_detect, "_WINDOWS", False)
    assert window_detect.get_primary_monitor_rect() is None


def test_primary_monitor_rect_returns_none_when_pywin32_unavailable(monkeypatch):
    # Per W7 review: setting sys.modules['win32api'] = None guarantees
    # `import win32api` raises ImportError regardless of whether pywin32
    # is installed on the dev machine. This is more robust than patching
    # builtins.__import__, which can be bypassed by sys.modules cache hits.
    monkeypatch.setattr(window_detect, "_WINDOWS", True)
    monkeypatch.setitem(sys.modules, "win32api", None)
    assert window_detect.get_primary_monitor_rect() is None


def test_primary_monitor_rect_returns_none_when_get_system_metrics_returns_zero(monkeypatch):
    monkeypatch.setattr(window_detect, "_WINDOWS", True)
    fake_win32api = mock.MagicMock()
    fake_win32api.GetSystemMetrics.return_value = 0
    with mock.patch.dict("sys.modules", {"win32api": fake_win32api}):
        assert window_detect.get_primary_monitor_rect() is None
