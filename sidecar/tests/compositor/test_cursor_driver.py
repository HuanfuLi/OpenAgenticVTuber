import pytest

from sidecar.compositor.cursor_driver import (
    EASE_BACK_DURATION_S,
    HEAD_MAX_DEFLECTION_DEG,
    CursorDriver,
    _cursor_to_param_angles,
)


def test_cursor_outside_canvas_returns_empty():
    assert _cursor_to_param_angles((50, 50), (100, 100, 200, 200)) == {}


def test_cursor_inside_dead_zone_returns_zeros():
    out = _cursor_to_param_angles((210, 210), (100, 100, 300, 300))
    assert out["ParamAngleX"] == 0.0
    assert out["ParamAngleY"] == 0.0


def test_cursor_at_right_edge_clamps_to_max_deflection():
    out = _cursor_to_param_angles((300, 200), (100, 100, 300, 300))
    assert out["ParamAngleX"] == HEAD_MAX_DEFLECTION_DEG


def test_cursor_at_left_edge_negative_max():
    out = _cursor_to_param_angles((100, 200), (100, 100, 300, 300))
    assert out["ParamAngleX"] == -HEAD_MAX_DEFLECTION_DEG


def test_cursor_y_axis_inverted():
    out = _cursor_to_param_angles((200, 100), (100, 100, 300, 300))
    assert out["ParamAngleY"] > 0


def test_driver_returns_empty_when_vts_rect_none(monkeypatch):
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((100, 100), None),
    )
    assert CursorDriver().tick(0.0) == {}


def test_driver_eases_back_after_cursor_exits_canvas(monkeypatch):
    drv = CursorDriver()
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((300, 200), (100, 100, 300, 300)),
    )
    out_in = drv.tick(0.0)
    assert out_in["ParamAngleX"] == HEAD_MAX_DEFLECTION_DEG

    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((50, 50), (100, 100, 300, 300)),
    )
    out_leave = drv.tick(0.5)
    assert out_leave["ParamAngleX"] == pytest.approx(HEAD_MAX_DEFLECTION_DEG)

    out_mid = drv.tick(0.5 + (EASE_BACK_DURATION_S / 2.0))
    assert out_mid["ParamAngleX"] == pytest.approx(HEAD_MAX_DEFLECTION_DEG * 0.125)

    assert drv.tick(0.5 + 0.900) == {}


def test_driver_re_enters_canvas_during_ease_back(monkeypatch):
    drv = CursorDriver()
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((300, 200), (100, 100, 300, 300)),
    )
    drv.tick(0.0)
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((50, 50), (100, 100, 300, 300)),
    )
    drv.tick(0.1)
    monkeypatch.setattr(
        "sidecar.compositor.cursor_driver.get_cursor_and_rect",
        lambda: ((100, 200), (100, 100, 300, 300)),
    )
    out_back = drv.tick(0.2)
    assert out_back["ParamAngleX"] == -HEAD_MAX_DEFLECTION_DEG
