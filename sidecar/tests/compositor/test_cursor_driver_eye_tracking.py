import pytest

from sidecar.compositor.cursor_driver import _cursor_to_param_angles


FULL_EYE_SURFACE = {"EyeLeftX", "EyeRightX", "EyeLeftY", "EyeRightY"}


def test_cursor_outputs_full_vts_eye_surface_for_horizontal_and_vertical_motion():
    out = _cursor_to_param_angles((300, 100), (100, 100, 300, 300))

    assert FULL_EYE_SURFACE <= set(out)
    assert out["EyeLeftX"] == pytest.approx(out["EyeRightX"])
    assert out["EyeLeftY"] == pytest.approx(out["EyeRightY"])
    assert out["EyeLeftX"] > 0.0
    assert out["EyeLeftY"] > 0.0


def test_cursor_dead_zone_zeroes_full_eye_surface():
    out = _cursor_to_param_angles((210, 210), (100, 100, 300, 300))

    assert FULL_EYE_SURFACE <= set(out)
    assert {key: out[key] for key in FULL_EYE_SURFACE} == {
        "EyeLeftX": 0.0,
        "EyeRightX": 0.0,
        "EyeLeftY": 0.0,
        "EyeRightY": 0.0,
    }
