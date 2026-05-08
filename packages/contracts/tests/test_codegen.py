from __future__ import annotations

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "packages/contracts/py"))

from contracts import AvatarImportPlan, AvatarOverrides, DefaultPluginActionBinding, RigCapabilities  # noqa: E402


def test_default_plugin_action_binding_defaults() -> None:
    binding = DefaultPluginActionBinding(action_code="joy", expression_index=3)

    assert binding.plugin_name == "default"
    assert binding.action_code == "joy"
    assert binding.expression_index == 3
    assert binding.expression_name == ""
    assert binding.source == "olvt_emotionMap"


@pytest.mark.parametrize(
    "payload",
    [
        {"action_code": "Joy", "expression_index": 3},
        {"action_code": "joy_", "expression_index": 3},
        {"action_code": "joy", "expression_index": -1},
        {"plugin_name": "custom", "action_code": "joy", "expression_index": 3},
    ],
)
def test_default_plugin_action_binding_rejects_invalid_values(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        DefaultPluginActionBinding(**payload)


def test_default_plugin_action_bindings_serialize_on_owner_contracts() -> None:
    binding = DefaultPluginActionBinding(action_code="joy", expression_index=3, expression_name="Joy")
    expected = [binding.model_dump()]

    overrides = AvatarOverrides(default_plugin_action_bindings=[binding])
    import_plan = AvatarImportPlan(detected_type="olvt", default_plugin_action_bindings=[binding])
    rig_capabilities = RigCapabilities(default_plugin_action_bindings=[binding])

    assert overrides.model_dump()["default_plugin_action_bindings"] == expected
    assert import_plan.model_dump()["default_plugin_action_bindings"] == expected
    assert rig_capabilities.model_dump()["default_plugin_action_bindings"] == expected
