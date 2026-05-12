from __future__ import annotations

import os
from pathlib import Path

import pytest

from contracts import STTProviderConfig
from sidecar.stt.model_downloader import download_local_stt_model
from sidecar.stt.provider import STTRequest
from sidecar.stt.providers.faster_whisper_provider import FasterWhisperSTTProvider
from sidecar.stt.providers.funasr_provider import FunASRSTTProvider


def _env_path(name: str) -> Path | None:
    value = os.environ.get(name)
    return Path(value) if value else None


@pytest.mark.live_stt
def test_live_local_stt_provider_transcribes_user_supplied_wav() -> None:
    provider_id = os.environ.get("AGENTICLLMVTUBER_LIVE_STT_PROVIDER")
    model_path = _env_path("AGENTICLLMVTUBER_LIVE_STT_MODEL_PATH")
    wav_path = _env_path("AGENTICLLMVTUBER_LIVE_STT_AUDIO_WAV")
    if not provider_id or model_path is None or wav_path is None:
        pytest.skip(
            "Set AGENTICLLMVTUBER_LIVE_STT_PROVIDER, "
            "AGENTICLLMVTUBER_LIVE_STT_MODEL_PATH, and "
            "AGENTICLLMVTUBER_LIVE_STT_AUDIO_WAV to run live local STT acceptance."
        )
    if provider_id not in {"funasr", "faster_whisper"}:
        pytest.fail("AGENTICLLMVTUBER_LIVE_STT_PROVIDER must be funasr or faster_whisper.")
    if not model_path.exists():
        pytest.fail(f"Live STT model path does not exist: {model_path}")
    if not wav_path.exists():
        pytest.fail(f"Live STT WAV path does not exist: {wav_path}")

    cfg = STTProviderConfig(
        active_provider=provider_id,
        local_model_id="live",
        local_model_path_override=str(model_path),
    )
    provider = (
        FunASRSTTProvider(cfg)
        if provider_id == "funasr"
        else FasterWhisperSTTProvider(cfg)
    )
    audio_bytes = wav_path.read_bytes()
    result = provider.transcribe(
        STTRequest(
            audio_bytes=audio_bytes,
            sample_rate_hz=16000,
            duration_ms=1,
            provider_id=provider_id,
            model_id="live",
            language_mode="auto",
        )
    )

    assert result.text.strip()


@pytest.mark.live_stt
def test_live_local_stt_model_download_populates_destination(tmp_path: Path) -> None:
    if os.environ.get("AGENTICLLMVTUBER_LIVE_STT_DOWNLOAD") != "1":
        pytest.skip("Set AGENTICLLMVTUBER_LIVE_STT_DOWNLOAD=1 to run live model download acceptance.")
    provider_id = os.environ.get("AGENTICLLMVTUBER_LIVE_STT_DOWNLOAD_PROVIDER", "faster_whisper")
    model_id = os.environ.get("AGENTICLLMVTUBER_LIVE_STT_DOWNLOAD_MODEL_ID", "tiny")
    if provider_id not in {"funasr", "faster_whisper"}:
        pytest.fail("AGENTICLLMVTUBER_LIVE_STT_DOWNLOAD_PROVIDER must be funasr or faster_whisper.")

    destination = tmp_path / "downloaded-model"
    download_local_stt_model(provider_id, model_id, destination)

    files = [path for path in destination.rglob("*") if path.is_file()]
    assert files
