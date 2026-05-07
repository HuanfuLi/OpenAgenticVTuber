import pytest

from sidecar.compositor.param_id_resolver import resolve_param_id


def test_vts_returns_input_layer_name():
    assert resolve_param_id("ParamAngleX", "vts") == "ParamAngleX"
    assert resolve_param_id("ParamMouthOpenY", "vts") == "ParamMouthOpenY"
    assert resolve_param_id("Lean Forward", "vts") == "Lean Forward"


def test_pixi_raises_not_implemented():
    with pytest.raises(NotImplementedError, match="post-MVP exploratory"):
        resolve_param_id("ParamAngleX", "pixi")


def test_cubism_native_raises_not_implemented():
    with pytest.raises(NotImplementedError):
        resolve_param_id("ParamAngleX", "cubism_native")


def test_vts_does_not_remap_to_in_twin():
    assert "IN" not in resolve_param_id("ParamAngleX", "vts")
    assert "IN" not in resolve_param_id("ParamAngleY", "vts")
