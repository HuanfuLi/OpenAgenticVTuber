"""Tests for TTSGateway boot, pointer guards, and shutdown behavior."""

from __future__ import annotations

from pathlib import Path

import pytest

from contracts import AudioConfig, GptSoVitsActivationGate, GptSoVitsProviderConfig, GptSoVitsPresetConfig, VoicePreset
from sidecar.tts.tts_gateway import TTSGateway
from sidecar.tts.tts_gateway import build_tts_gateway
from sidecar.tts.gpt_sovits_provider import GptSoVitsProvider


def _model_path() -> Path:
    return Path(__file__).resolve().parents[1] / "models" / "piper" / "en_US-amy-medium.onnx"


def _is_lfs_pointer(path: Path) -> bool:
    if not path.exists():
        return False
    with path.open("rb") as f:
        return f.read(64).startswith(b"version https://git-lfs.github.com/spec/v1")


def test_boot_raises_filenotfound_for_missing_path():
    gateway = TTSGateway(Path("does/not/exist.onnx"))
    with pytest.raises(FileNotFoundError, match="piper.download_voices"):
        gateway.boot()


def test_boot_raises_runtimeerror_for_lfs_pointer(tmp_path: Path):
    pointer_path = tmp_path / "pointer.onnx"
    pointer_path.write_bytes(
        b"version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 100\n"
    )

    gateway = TTSGateway(pointer_path)
    with pytest.raises(RuntimeError, match="git lfs install && git lfs pull"):
        gateway.boot()


def test_shutdown_idempotent_when_stream_none():
    gateway = TTSGateway(Path("does/not/exist.onnx"))
    gateway.shutdown()
    gateway.shutdown()


def test_build_tts_gateway_allows_untested_gpt_sovits_when_required_inputs_exist(tmp_path: Path):
    audio_config = AudioConfig()
    audio_config.tts.active_provider = "gpt_sovits"
    audio_config.tts.gpt_sovits = GptSoVitsProviderConfig(
        enabled=True,
        activation=GptSoVitsActivationGate(
            health_check_passed=True,
            test_synthesis_passed=False,
            active_allowed=False,
        ),
    )
    reference = tmp_path / "ref.wav"
    reference.write_bytes(b"RIFF")
    preset = VoicePreset(
        preset_id="preset-1",
        name="GPT",
        provider_id="gpt_sovits",
        gpt_sovits=GptSoVitsPresetConfig(prompt_text="hello", prompt_lang="en", text_lang="en"),
    )

    gateway = build_tts_gateway(
        audio_config=audio_config,
        repo_root=tmp_path,
        avatar_voice_model="en_US-amy-medium",
        active_voice_preset=preset,
        reference_audio_path=reference,
    )

    assert isinstance(gateway.provider, GptSoVitsProvider)


def test_build_tts_gateway_requires_gpt_sovits_reference_inputs(tmp_path: Path):
    audio_config = AudioConfig()
    audio_config.tts.active_provider = "gpt_sovits"
    audio_config.tts.gpt_sovits = GptSoVitsProviderConfig(enabled=True)

    with pytest.raises(ValueError, match="active voice preset and reference audio"):
        build_tts_gateway(audio_config=audio_config, repo_root=tmp_path, avatar_voice_model="en_US-amy-medium")


def test_build_tts_gateway_constructs_gpt_sovits_provider_when_gates_pass(tmp_path: Path):
    audio_config = AudioConfig()
    audio_config.tts.active_provider = "gpt_sovits"
    audio_config.tts.gpt_sovits = GptSoVitsProviderConfig(
        enabled=True,
        activation=GptSoVitsActivationGate(
            health_check_passed=True,
            test_synthesis_passed=True,
            active_allowed=True,
        ),
    )
    reference = tmp_path / "ref.wav"
    reference.write_bytes(b"RIFF")
    preset = VoicePreset(
        preset_id="preset-1",
        name="GPT",
        provider_id="gpt_sovits",
        gpt_sovits=GptSoVitsPresetConfig(prompt_text="hello", prompt_lang="en", text_lang="en"),
    )

    gateway = build_tts_gateway(
        audio_config=audio_config,
        repo_root=tmp_path,
        avatar_voice_model="en_US-amy-medium",
        active_voice_preset=preset,
        reference_audio_path=reference,
    )

    assert isinstance(gateway.provider, GptSoVitsProvider)


@pytest.mark.skipif(
    not _model_path().exists() or _is_lfs_pointer(_model_path()),
    reason="model not pulled",
)
def test_real_voice_boot():
    gateway = TTSGateway(_model_path())
    try:
        gateway.boot()
        assert gateway.voice is not None
        assert gateway.sample_rate == 22050
        assert gateway.stream is not None
        assert gateway.stream.active is True
    finally:
        gateway.shutdown()
