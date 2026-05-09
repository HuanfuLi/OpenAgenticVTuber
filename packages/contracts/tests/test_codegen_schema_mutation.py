from copy import deepcopy
from pathlib import Path
import sys

from pydantic import TypeAdapter

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages/contracts/py"))
sys.path.insert(0, str(ROOT / "packages/contracts/scripts"))

from codegen import force_required  # noqa: E402
from contracts import ActionCode, AudioPayloadMessage, EventFire, VariantToggle, WSMessage  # noqa: E402


def test_audio_payload_all_fields_required() -> None:
    schema = AudioPayloadMessage.model_json_schema()

    force_required(schema)

    assert set(schema["required"]) == {
        "type",
        "audio",
        "volumes",
        "dispatches",
        "forwarded",
        "display_text",
        "sentence_id",
        "slice_length",
    }


def test_action_code_defaulted_fields_required() -> None:
    schema = ActionCode.model_json_schema()

    force_required(schema)

    assert set(schema["required"]) == {"kind", "name"}


def test_dispatch_variant_fields_required() -> None:
    variant_schema = VariantToggle.model_json_schema()
    event_schema = EventFire.model_json_schema()

    force_required(variant_schema)
    force_required(event_schema)

    assert set(variant_schema["required"]) == {"kind", "name", "hotkey_id"}
    assert set(event_schema["required"]) == {
        "kind",
        "name",
        "hotkey_id",
        "duration_ms",
    }


def test_wsmessage_recurses_into_defs() -> None:
    schema = TypeAdapter(WSMessage).json_schema()

    force_required(schema)

    variants = [
        schema["$defs"][choice["$ref"].rsplit("/", 1)[-1]]
        for choice in schema["oneOf"]
    ]
    for variant in variants:
        assert "type" in variant["required"]


def test_force_required_idempotent() -> None:
    schema = AudioPayloadMessage.model_json_schema()

    force_required(schema)
    once = deepcopy(schema["required"])
    force_required(schema)

    assert schema["required"] == once
    assert len(schema["required"]) == len(set(schema["required"]))


def test_force_required_recurses_into_nested_defs() -> None:
    schema = AudioPayloadMessage.model_json_schema()

    force_required(schema)

    display_text = schema["$defs"]["DisplayTextField"]
    assert set(display_text["required"]) == {"text", "name", "avatar"}


def test_force_required_preserves_existing_required_order_deterministically() -> None:
    schema = EventFire.model_json_schema()

    force_required(schema)

    assert schema["required"] == sorted(schema["required"])
