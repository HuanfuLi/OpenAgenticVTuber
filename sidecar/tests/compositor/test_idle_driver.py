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


def test_idle_blink_reopens_after_short_closure_window():
    driver = IdleDriver(seed=1)
    driver._next_blink_at = 1.0

    assert driver.tick(1.0)["EyeOpenLeft"] == 0.05
    assert driver.tick(1.08)["EyeOpenLeft"] == 0.55
    assert "EyeOpenLeft" not in driver.tick(1.30)
