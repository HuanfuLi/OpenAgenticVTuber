from sidecar.compositor.idle_driver import IdleDriver


def test_idle_driver_emits_head_and_eye_params_every_tick():
    out = IdleDriver(seed=1, breath_writeable=True).tick(1.0)

    assert "ParamAngleX" in out
    assert "ParamAngleY" in out
    assert "ParamAngleZ" in out
    assert "ParamEyeBallX" in out
    assert "ParamEyeBallY" in out
    assert "Auto Breath" in out
