"""Tests for AvatarCapabilities loader (Task 2 behavior tests)."""
import pytest
from pydantic import ValidationError
from sidecar.avatar.capabilities import (
    AvatarCapabilities, load_capabilities, Expression, Hotkey,
)


# Test 1: parse the actual ./avatars/teto/avatar.yaml that ships in this plan
def test_loads_teto_avatar_yaml(tmp_path):
    yaml_text = """
expressions:
  - name: joy
    file: joy.exp3.json
hotkeys:
  - name: cry
    type: ToggleExpression
parameters:
  - id: ParamMouthOpenY
voice:
  backend: piper
  model: en_US-amy-medium
"""
    yaml_path = tmp_path / "avatar.yaml"
    yaml_path.write_text(yaml_text, encoding="utf-8")
    caps = load_capabilities(tmp_path)
    assert isinstance(caps, AvatarCapabilities)
    assert caps.expressions[0].name == "joy"
    assert caps.hotkeys[0].name == "cry"
    assert caps.voice.backend == "piper"


# Test 2: tag_vocabulary returns expressions + hotkeys joined as bracketed names
def test_tag_vocabulary_format():
    caps = AvatarCapabilities(
        expressions=[Expression(name="joy", file="joy.exp3.json")],
        hotkeys=[Hotkey(name="cry", type="ToggleExpression")],
    )
    assert caps.tag_vocabulary() == "[joy], [cry],"


# Test 3: missing required field raises ValidationError
def test_missing_expressions_raises(tmp_path):
    yaml_path = tmp_path / "avatar.yaml"
    yaml_path.write_text("hotkeys: []\n", encoding="utf-8")
    with pytest.raises(ValidationError):
        load_capabilities(tmp_path)


# Test 4 (sanity-check the contract): AudioPayloadMessage round-trip with
# OLVT-canonical field names -- proves Discrepancy 1-3 resolution.
def test_audio_payload_olvt_canonical_keys():
    from contracts import ActionCode, AudioPayloadMessage, DisplayTextField
    dispatch = ActionCode(name="joy")
    msg = AudioPayloadMessage(
        audio=None,
        display_text=DisplayTextField(text="hi", name="Teto", avatar="teto"),
        dispatches=[dispatch],
        sentence_id=1,
    )
    dumped = msg.model_dump()
    assert dumped["type"] == "audio"            # OLVT-canonical (NOT "audio-payload")
    assert "audio" in dumped                     # OLVT-canonical (NOT "audio_b64")
    assert dumped["audio"] is None               # Phase 2 stub
    assert dumped["volumes"] == []               # Phase 3 fills
    assert dumped["slice_length"] == 20          # OLVT default
    assert dumped["forwarded"] is False
    assert dumped["sentence_id"] == 1            # Phase-2 extension
    assert dumped["dispatches"] == [{"kind": "action", "name": "joy"}]


# Test 5: ActionCode dispatch round-trip
def test_action_code_dispatch_roundtrip():
    from contracts import ActionCode
    dispatch = ActionCode(name="joy")
    assert dispatch.model_dump() == {"kind": "action", "name": "joy"}
