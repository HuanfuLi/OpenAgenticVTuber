from copy import deepcopy
from pathlib import Path
import sys

from pydantic import TypeAdapter

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages/contracts/py"))
sys.path.insert(0, str(ROOT / "packages/contracts/scripts"))

from codegen import force_required  # noqa: E402
from contracts import ActionIntent, AudioPayloadMessage, WSMessage  # noqa: E402


def test_audio_payload_all_fields_required() -> None:
    schema = AudioPayloadMessage.model_json_schema()

    force_required(schema)

    assert set(schema["required"]) == {
        "type",
        "audio",
        "volumes",
        "actions",
        "forwarded",
        "display_text",
        "sentence_id",
        "slice_length",
    }


def test_action_intent_defaulted_and_nullable_fields_required() -> None:
    schema = ActionIntent.model_json_schema()

    force_required(schema)

    assert set(schema["required"]) == {
        "kind",
        "name",
        "strength",
        "duration_ms",
        "avatar_id",
    }


def test_wsmessage_recurses_into_defs() -> None:
    schema = TypeAdapter(WSMessage).json_schema()

    force_required(schema)

    for variant in schema["$defs"].values():
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
    schema = ActionIntent.model_json_schema()

    force_required(schema)

    assert schema["required"] == sorted(schema["required"])
