from sidecar.compositor.idle_driver import IdleDriver


def test_idle_driver_emits_head_and_eye_params_every_tick():
    out = IdleDriver(seed=1, breath_writeable=True).tick(1.0)

    assert "FaceAngleX" in out
    assert "FaceAngleY" in out
    assert "FaceAngleZ" in out
    assert "EyeLeftX" in out
    assert "EyeRightX" in out
    assert "EyeLeftY" in out
    assert "EyeRightY" in out
    assert "Auto Breath" in out


def test_idle_blink_does_not_hold_eyes_closed_past_short_closure_window():
    driver = IdleDriver(seed=1)
    driver._next_blink_at = 1.0

    assert "EyeOpenLeft" in driver.tick(1.0)
    assert "EyeOpenLeft" not in driver.tick(1.11)
