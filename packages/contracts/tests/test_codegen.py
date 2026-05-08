from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError
import json

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


def test_generated_outputs_export_default_plugin_action_binding() -> None:
    required = {
        "packages/contracts/generated/json-schema/action-binding.schema.json": "DefaultPluginActionBinding",
        "packages/contracts/ts/action-binding.ts": "DefaultPluginActionBinding",
        "packages/contracts/ts/index.ts": "DefaultPluginActionBinding",
    }

    for rel_path, pattern in required.items():
        path = REPO_ROOT / rel_path
        assert path.exists(), f"missing generated file: {rel_path}"
        assert pattern in path.read_text(encoding="utf-8")


def test_sidecar_avatar_overrides_schema_validates_default_plugin_action_bindings() -> None:
    schema_path = REPO_ROOT / "sidecar/schemas/avatar_overrides.schema.json"
    schema: dict[str, Any] = json.loads(schema_path.read_text(encoding="utf-8"))

    field = schema["properties"]["default_plugin_action_bindings"]
    item = field["items"]

    assert field["type"] == "array"
    assert field["default"] == []
    assert item["additionalProperties"] is False
    assert item["required"] == [
        "plugin_name",
        "action_code",
        "expression_index",
        "expression_name",
        "source",
    ]
    assert item["properties"]["plugin_name"]["enum"] == ["default"]
    assert item["properties"]["action_code"]["pattern"] == "^[a-z][a-z0-9-]{0,30}$"
    assert item["properties"]["action_code"]["not"]["enum"] == [
        "think",
        "thinking",
        "function_call",
        "function_calls",
        "tool_call",
        "tool_calls",
        "system",
    ]
    assert item["properties"]["expression_index"]["minimum"] == 0
    assert item["properties"]["expression_name"]["default"] == ""
    assert item["properties"]["source"]["enum"] == ["olvt_emotionMap", "manual"]
