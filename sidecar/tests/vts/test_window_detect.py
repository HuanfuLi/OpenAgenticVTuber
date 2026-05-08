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
