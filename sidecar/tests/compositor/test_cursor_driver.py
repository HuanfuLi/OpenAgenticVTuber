import pytest

from sidecar.compositor.cursor_driver import (
    HEAD_MAX_DEFLECTION_DEG,
    CursorDriver,
    _cursor_to_param_angles,
)


def test_cursor_outside_canvas_still_projects_clamped_deflection():
    # Per VFY-02 / Phase 10: in-VTS-window gate dropped; cursor outside rect
    # produces deflection clamped to [-1, 1] in normalized space.
    out = _cursor_to_param_angles((50, 50), (100, 100, 200, 200))
    assert out, "outside-rect cursor should still produce deflection (gate dropped)"
    # Cursor at (50, 50), face center at (150, 150) -> dx=-100, dy=-100,
    # nx=-100/(100*0.5)=-2.0 -> clamped to -1.0, ny same -> clamped to -1.0.
    assert out["FaceAngleX"] == -HEAD_MAX_DEFLECTION_DEG
    # y-axis inverted in the math: -ny * head_max_deg
    assert out["FaceAngleY"] == HEAD_MAX_DEFLECTION_DEG
    # No Cubism names should leak
    assert "ParamAngleX" not in out
    assert "ParamEyeBallX" not in out


def test_cursor_inside_dead_zone_returns_zeros():
    out = _cursor_to_param_angles((210, 210), (100, 100, 300, 300))
    assert out == {
        "FaceAngleX": 0.0,
        "FaceAngleY": 0.0,
        "EyeLeftX": 0.0,
        "EyeRightX": 0.0,
        "EyeLeftY": 0.0,
        "EyeRightY": 0.0,
    }


def test_cursor_at_right_edge_clamps_to_max_deflection():
    out = _cursor_to_param_angles((300, 200), (100, 100, 300, 300))
    assert out["FaceAngleX"] == HEAD_MAX_DEFLECTION_DEG


def test_cursor_at_left_edge_negative_max():
    out = _cursor_to_param_angles((100, 200), (100, 100, 300, 300))
    assert out["FaceAngleX"] == -HEAD_MAX_DEFLECTION_DEG


def test_cursor_y_axis_inverted():
    out = _cursor_to_param_angles((200, 100), (100, 100, 300, 300))
    assert out["FaceAngleY"] > 0


def test_driver_uses_sidecar_win32_sample_contract_without_renderer_event(monkeypatch):
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((300, 200), (100, 100, 300, 300)),
    )

    out = CursorDriver().tick(0.0)

    assert out["FaceAngleX"] == HEAD_MAX_DEFLECTION_DEG, (
        "sidecar Win32 sample contract should drive right-edge head deflection"
    )
    assert out["FaceAngleY"] == pytest.approx(0.0), (
        "sidecar Win32 sample contract should center vertical head deflection"
    )
    assert out["EyeLeftX"] > 0.0, (
        "sidecar Win32 sample contract should drive eye tracking"
    )
    assert out["EyeRightX"] > 0.0, (
        "sidecar Win32 sample contract should drive both eyes horizontally"
    )
    assert out["EyeLeftY"] == pytest.approx(0.0), (
        "sidecar Win32 sample contract should center vertical eye tracking"
    )
    assert out["EyeRightY"] == pytest.approx(0.0), (
        "sidecar Win32 sample contract should center vertical eye tracking"
    )


def test_driver_returns_empty_when_neither_vts_nor_primary_monitor_rect_available(monkeypatch):
    # Simulates non-Windows or pywin32-unavailable platform: both rect sources None.
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((100, 100), None),
    )
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_primary_monitor_rect",
        lambda: None,
    )
    assert CursorDriver().tick(0.0) == {}


# Note: ease-back tests deleted in Phase 10 (10-01 T2). Post-VFY-02 the
# in-VTS-window gate at cursor_driver.py:30-32 is dropped and the
# synthetic-canvas fallback always returns coverage. The legacy
# _cursor_left_canvas_at / _last_in_canvas_output / EASE_BACK_DURATION_S
# ease-back state is unreachable from the public tick() API. Future
# milestones may rewire this state if the synthetic-canvas fallback
# is removed; until then ease-back is dead code retained for
# diff-readability of the 10-01 fix.
def test_driver_uses_synthetic_canvas_fallback_when_vts_rect_none(monkeypatch):
    # Per VFY-02: when VTS is not running but primary-monitor rect is available,
    # cursor still drives head/eye tracking against the synthetic canvas.
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((1920, 540), None),
    )
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_primary_monitor_rect",
        lambda: (0, 0, 1920, 1080),
    )
    out = CursorDriver().tick(0.0)
    assert out, "synthetic-canvas fallback must produce non-empty output"
    assert out["FaceAngleX"] == HEAD_MAX_DEFLECTION_DEG, (
        "right-edge cursor should drive max head X"
    )
    assert "ParamAngleX" not in out
