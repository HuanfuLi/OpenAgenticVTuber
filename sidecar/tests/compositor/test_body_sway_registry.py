from pathlib import Path

import pytest

from sidecar.avatar.overrides import TetoOverrides
from sidecar.compositor.body_sway import (
    Exp3ModulationStrategy,
    HeadOnlyStrategy,
    ProxyParamStrategy,
    STRATEGY_NAMES,
    build_strategy,
)
from sidecar.compositor.body_sway import exp3_modulation


def test_strategy_names_exclude_physics_chain():
    assert STRATEGY_NAMES == ("head_only", "proxy_param", "exp3_modulation")
    assert "physics_chain" not in STRATEGY_NAMES


def test_build_strategy_variants(tmp_path):
    overrides = TetoOverrides(proxy_body_param="Lean Forward")
    assert isinstance(build_strategy("head_only", overrides, tmp_path), HeadOnlyStrategy)
    assert isinstance(build_strategy("proxy_param", overrides, tmp_path), ProxyParamStrategy)
    assert isinstance(build_strategy("exp3_modulation", overrides, tmp_path), Exp3ModulationStrategy)


def test_build_strategy_unknown_raises(tmp_path):
    with pytest.raises(ValueError):
        build_strategy("unknown", TetoOverrides(), tmp_path)


def test_proxy_param_uses_overrides_param(tmp_path):
    strategy = build_strategy(
        "proxy_param",
        TetoOverrides(proxy_body_param="Lean Forward"),
        tmp_path,
    )
    assert strategy.tick(0.5, 0.0) == {"Lean Forward": 0.5}


def test_exp3_modulation_loads_parameters(tmp_path):
    exp3 = tmp_path / "body.exp3.json"
    exp3.write_text(
        '{"Parameters":[{"Id":"ParamBodyAngleX","Value":2.0},{"Id":"ParamAngleZ","Value":-1.0}]}',
        encoding="utf-8",
    )
    strategy = Exp3ModulationStrategy(exp3)
    assert strategy.tick(0.5, 0.0) == {"ParamBodyAngleX": 1.0, "ParamAngleZ": -0.5}


def test_exp3_modulation_documents_pitfall_18():
    source = Path(exp3_modulation.__file__).read_text(encoding="utf-8")
    assert "Pitfall 18" in source
    assert "do NOT use ExpressionActivationRequest" in source
    assert "requestActivateExpression" not in source
    assert "requestExpressionActivation" not in source
