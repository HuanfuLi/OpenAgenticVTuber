from __future__ import annotations

import json

from contracts import AudioConfig
from sidecar.audio.config import AUDIO_CONFIG_ENV, load_audio_config_from_env
from sidecar.tts.tts_gateway import build_tts_gateway


def test_audio_config_env_missing_or_malformed_falls_back_to_piper(monkeypatch):
    monkeypatch.delenv(AUDIO_CONFIG_ENV, raising=False)
    missing = load_audio_config_from_env()

    monkeypatch.setenv(AUDIO_CONFIG_ENV, "{not-json")
    malformed = load_audio_config_from_env()

    for cfg in (missing, malformed):
        assert cfg.tts.active_provider == "piper"
        assert cfg.tts.piper.voice_model == "en_US-amy-medium"
        assert cfg.tts.piper.ordered_playback is True
        assert cfg.tts.piper.rms_lipsync is True


def test_audio_config_env_accepts_valid_audio_config(monkeypatch):
    raw = AudioConfig().model_dump()
    raw["tts"]["piper"]["voice_model"] = "en_US-test-voice"
    monkeypatch.setenv(AUDIO_CONFIG_ENV, json.dumps(raw))

    cfg = load_audio_config_from_env()

    assert cfg.tts.active_provider == "piper"
    assert cfg.tts.piper.voice_model == "en_US-test-voice"


def test_build_tts_gateway_uses_avatar_default_or_configured_voice(tmp_path):
    default_cfg = AudioConfig()
    default_gateway = build_tts_gateway(
        audio_config=default_cfg,
        repo_root=tmp_path,
        avatar_voice_model="avatar-voice",
    )

    custom_cfg = AudioConfig()
    custom_cfg.tts.piper.voice_model = "configured-voice"
    custom_gateway = build_tts_gateway(
        audio_config=custom_cfg,
        repo_root=tmp_path,
        avatar_voice_model="avatar-voice",
    )

    assert default_gateway.model_path == tmp_path / "sidecar/models/piper/avatar-voice.onnx"
    assert custom_gateway.model_path == tmp_path / "sidecar/models/piper/configured-voice.onnx"


def test_build_tts_gateway_rejects_unsupported_phase_16_provider(tmp_path):
    cfg = AudioConfig()
    cfg.tts.active_provider = "gpt_sovits"

    try:
        build_tts_gateway(
            audio_config=cfg,
            repo_root=tmp_path,
            avatar_voice_model="avatar-voice",
        )
    except ValueError as exc:
        assert "Unsupported TTS provider for Phase 16" in str(exc)
    else:
        raise AssertionError("unsupported provider should fail loudly")
