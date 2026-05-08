from sidecar.compositor.idle_driver import IdleDriver


def test_idle_driver_emits_head_and_eye_params_every_tick():
    out = IdleDriver(seed=1, breath_writeable=True).tick(1.0)

    assert "FaceAngleX" in out
    assert "FaceAngleY" in out
    assert "FaceAngleZ" in out
    assert "EyeLeftX" in out
    assert "EyeRightY" in out
    assert "Auto Breath" in out
