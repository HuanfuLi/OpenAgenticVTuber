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


def test_idle_driver_never_emits_eye_open_blinks():
    driver = IdleDriver(seed=1)

    samples = [driver.tick(now / 10.0) for now in range(0, 120)]

    assert all("EyeOpenLeft" not in sample for sample in samples)
    assert all("EyeOpenRight" not in sample for sample in samples)
