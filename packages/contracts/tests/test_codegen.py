from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError
import json

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT / "packages/contracts/py"))

from contracts import (  # noqa: E402
    AudioConfig,
    AudioPayloadMessage,
    AudioProviderHealth,
    AvatarImportPlan,
    AvatarOverrides,
    DefaultPluginActionBinding,
    GptSoVitsHealthRequest,
    GptSoVitsProviderConfig,
    GptSoVitsTestSynthesisRequest,
    GptSoVitsTestSynthesisResult,
    ReferenceAudioAsset,
    RigCapabilities,
    VoicePreset,
    VoicePresetLibrary,
)


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


def test_hud_message_generated_outputs_exist() -> None:
    required = {
        "packages/contracts/generated/json-schema/hud-message-s2c.schema.json": "HudMessageS2C",
        "packages/contracts/generated/json-schema/hud-message-c2s.schema.json": "HudMessageC2S",
        "packages/contracts/ts/hud-message-s2c.ts": "HudMessageS2C",
        "packages/contracts/ts/hud-message-c2s.ts": "HudMessageC2S",
        "packages/contracts/ts/index.ts": "HudMessageS2C",
    }
    for rel_path, pattern in required.items():
        path = REPO_ROOT / rel_path
        assert path.exists(), f"missing generated file: {rel_path}"
        assert pattern in path.read_text(encoding="utf-8")


def test_audio_provider_defaults_and_health_validation() -> None:
    cfg = AudioConfig()

    assert cfg.tts.active_provider == "piper"
    assert cfg.tts.piper.voice_model == "en_US-amy-medium"
    assert cfg.tts.piper.ordered_playback is True
    assert cfg.tts.piper.rms_lipsync is True
    assert cfg.tts.piper.execution == "off_event_loop"
    assert cfg.stt.enabled is False

    health = AudioProviderHealth(
        provider_id="piper",
        kind="tts",
        state="ok",
        summary="Piper ready.",
        retryable=False,
        latency_ms=12.5,
    )
    assert health.provider_id == "piper"

    with pytest.raises(ValidationError):
        AudioProviderHealth(
            provider_id="piper",
            kind="tts",
            state="unknown",
            summary="bad",
        )

    with pytest.raises(ValidationError):
        AudioProviderHealth(
            provider_id="elevenlabs",
            kind="tts",
            state="ok",
            summary="bad",
        )


def test_audio_provider_generated_outputs_exist() -> None:
    required = {
        "packages/contracts/generated/json-schema/audio-provider.schema.json": "AudioConfig",
        "packages/contracts/generated/json-schema/audio-provider-health.schema.json": "AudioProviderHealth",
        "packages/contracts/ts/audio-provider.ts": "AudioConfig",
        "packages/contracts/ts/audio-provider-health.ts": "AudioProviderHealth",
        "packages/contracts/ts/index.ts": "AudioProviderHealth",
    }
    for rel_path, pattern in required.items():
        path = REPO_ROOT / rel_path
        assert path.exists(), f"missing generated file: {rel_path}"
        assert pattern in path.read_text(encoding="utf-8")


def test_gpt_sovits_provider_config_uses_one_base_url_and_activation_gates() -> None:
    cfg = GptSoVitsProviderConfig(base_url="http://127.0.0.1:9880")

    assert cfg.provider_id == "gpt_sovits"
    assert cfg.base_url == "http://127.0.0.1:9880"
    assert cfg.launch.command is None
    assert cfg.launch.working_directory is None
    assert cfg.activation.health_check_passed is False
    assert cfg.activation.test_synthesis_passed is False
    assert "tts_url" not in cfg.model_dump()
    assert "health_url" not in cfg.model_dump()

    health = GptSoVitsHealthRequest(
        config=cfg,
        preset=VoicePreset(preset_id="preset_teto", name="Teto", provider_id="gpt_sovits"),
    )
    assert health.config.base_url == "http://127.0.0.1:9880"

    with pytest.raises(ValidationError):
        GptSoVitsProviderConfig(provider_id="piper", base_url="http://127.0.0.1:9880")


def test_stt_provider_config_tracks_cache_and_readiness_defaults() -> None:
    cfg = AudioConfig()

    assert cfg.stt.active_provider is None
    assert cfg.stt.language_mode == "auto"
    assert cfg.stt.cache_root is None
    assert cfg.stt.local_model_id is None
    assert cfg.stt.readiness.active_allowed is False
    assert cfg.stt.readiness.invalidation_reason == "never_tested"
    assert cfg.stt.cloud["openai"].consent_granted is False
    assert cfg.stt.cloud["openai"].api_key is None


def test_voice_preset_keeps_gpt_sovits_knobs_without_connection_fields() -> None:
    preset = VoicePreset(
        preset_id="preset_teto",
        name="Teto bright",
        provider_id="gpt_sovits",
        gpt_sovits={
            "reference_audio_id": "ref_teto",
            "prompt_text": "今日も一緒に頑張ろうね。",
            "prompt_lang": "ja",
            "text_lang": "ja",
        },
    )

    dumped = preset.model_dump()
    assert dumped["gpt_sovits"]["top_k"] == 15
    assert dumped["gpt_sovits"]["top_p"] == 1.0
    assert dumped["gpt_sovits"]["temperature"] == 1.0
    assert dumped["gpt_sovits"]["text_split_method"] == "cut5"
    assert dumped["gpt_sovits"]["batch_size"] == 1
    assert dumped["gpt_sovits"]["speed_factor"] == 1.0
    assert dumped["gpt_sovits"]["repetition_penalty"] == 1.35
    assert dumped["gpt_sovits"]["media_type"] == "wav"
    assert dumped["gpt_sovits"]["streaming_mode"] is False
    assert "base_url" not in str(dumped)
    assert "launch" not in str(dumped)
    assert "credentials" not in str(dumped)

    with pytest.raises(ValidationError):
        VoicePreset(preset_id="bad", name="Bad", provider_id="openai")
    with pytest.raises(ValidationError):
        VoicePreset(
            preset_id="bad_lang",
            name="Bad lang",
            provider_id="gpt_sovits",
            gpt_sovits={"prompt_lang": "klingon", "text_lang": "ja"},
        )


def test_reference_audio_asset_tracks_sanitized_managed_metadata() -> None:
    asset = ReferenceAudioAsset(
        asset_id="ref_teto_001",
        managed_path_token="reference-audio/ref_teto_001.wav",
        display_basename="Teto Sample.wav",
        duration_ms=3200,
        format="wav",
        transcript_text="今日も一緒に頑張ろうね。",
        language="ja",
    )

    assert asset.asset_id == "ref_teto_001"
    assert asset.managed_path_token == "reference-audio/ref_teto_001.wav"
    assert asset.display_basename == "Teto Sample.wav"
    assert asset.duration_ms == 3200

    with pytest.raises(ValidationError):
        ReferenceAudioAsset(
            asset_id="ref_bad",
            managed_path_token="../secret.wav",
            display_basename="secret.wav",
            duration_ms=1000,
            format="wav",
            transcript_text="hello",
            language="en",
        )
    with pytest.raises(ValidationError):
        ReferenceAudioAsset(
            asset_id="ref_bad_lang",
            managed_path_token="reference-audio/ref_bad.wav",
            display_basename="bad.wav",
            duration_ms=1000,
            format="wav",
            transcript_text="hello",
            language="klingon",
        )


def test_test_synthesis_and_failed_audio_payload_serialize() -> None:
    cfg = GptSoVitsProviderConfig(base_url="http://127.0.0.1:9880")
    preset = VoicePreset(preset_id="preset_teto", name="Teto", provider_id="gpt_sovits")
    request = GptSoVitsTestSynthesisRequest(
        config=cfg,
        preset=preset,
        text="Preview voice line.",
    )
    result = GptSoVitsTestSynthesisResult(
        ok=True,
        audio_base64="UklGRg==",
        media_type="wav",
        sample_rate_hz=48000,
        duration_ms=420,
        summary="Test synthesis succeeded.",
    )

    assert request.text == "Preview voice line."
    assert result.model_dump()["audio_base64"] == "UklGRg=="

    payload = AudioPayloadMessage(
        audio=None,
        volumes=[],
        slice_length=20,
        display_text={"text": "Still show this sentence."},
        dispatches=[],
        sentence_id=7,
        failed_audio={
            "provider_id": "gpt_sovits",
            "state": "external_service_failure",
            "summary": "GPT-SoVITS synthesis failed.",
            "retryable": True,
            "redacted_diagnostics": {"status": "400"},
        },
    )

    dumped = payload.model_dump()
    assert dumped["display_text"]["text"] == "Still show this sentence."
    assert dumped["failed_audio"]["provider_id"] == "gpt_sovits"


def test_voice_preset_library_serializes_active_associations() -> None:
    library = VoicePresetLibrary(
        presets=[VoicePreset(preset_id="preset_teto", name="Teto", provider_id="gpt_sovits")],
        reference_audio_assets=[
            ReferenceAudioAsset(
                asset_id="ref_teto_001",
                managed_path_token="reference-audio/ref_teto_001.wav",
                display_basename="Teto Sample.wav",
                duration_ms=3200,
                format="wav",
                transcript_text="今日も一緒に頑張ろうね。",
                language="ja",
            )
        ],
        active_associations=[
            {
                "scope": "avatar_session",
                "avatar_id": "teto",
                "session_id": "session-1",
                "preset_id": "preset_teto",
            }
        ],
    )

    assert library.schema_version == 1
    assert library.active_associations[0].preset_id == "preset_teto"


def test_hud_message_pydantic_discriminator_validates() -> None:
    from contracts import HudMessageC2S, HudMessageS2C
    from pydantic import TypeAdapter

    s2c = TypeAdapter(HudMessageS2C)
    c2s = TypeAdapter(HudMessageC2S)

    assert s2c.validate_python(
        {"kind": "param-frame", "tick_n": 1, "params": {"ParamAngleX": 0.5}, "locked_ids": []}
    ).kind == "param-frame"
    assert s2c.validate_python(
        {"kind": "lock-confirmed", "param_id": "ParamAngleX", "value": 0.5}
    ).kind == "lock-confirmed"
    assert s2c.validate_python(
        {"kind": "lock-rejected", "param_id": "X", "reason": "test"}
    ).kind == "lock-rejected"

    assert c2s.validate_python(
        {"kind": "set-lock", "param_id": "ParamAngleX", "value": 0.5}
    ).kind == "set-lock"
    assert c2s.validate_python(
        {"kind": "clear-lock", "param_id": "ParamAngleX"}
    ).kind == "clear-lock"

    with pytest.raises(Exception):
        s2c.validate_python({"kind": "set-lock", "param_id": "X", "value": 0.5})
    with pytest.raises(Exception):
        c2s.validate_python({"kind": "param-frame", "tick_n": 1, "params": {}, "locked_ids": []})


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
