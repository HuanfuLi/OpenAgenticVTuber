from __future__ import annotations

import base64
import wave
from io import BytesIO

from fastapi import FastAPI
from fastapi.testclient import TestClient

from contracts import AudioConfig, AudioProviderHealth
from sidecar.admin import audio as audio_module
from sidecar.tts.provider import TTSProviderError, TTSSynthesisResult


def _wav_pcm() -> bytes:
    return b"\x01\x00\x02\x00"


def _request(reference_audio_path: str = "C:/managed/ref.wav") -> dict:
    return {
        "config": {
            "provider_id": "gpt_sovits",
            "enabled": True,
            "base_url": "http://127.0.0.1:9880",
            "request_timeout_ms": 1000,
            "activation": {"health_check_passed": False, "test_synthesis_passed": False, "active_allowed": False},
        },
        "preset": {
            "preset_id": "preset-1",
            "name": "Teto GPT",
            "provider_id": "gpt_sovits",
            "gpt_sovits": {
                "reference_audio_id": "ref-1",
                "prompt_text": "hello reference",
                "prompt_lang": "en",
                "text_lang": "en",
            },
        },
        "reference_audio_path": reference_audio_path,
        "text": "hello there",
    }


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(audio_module.router)
    return TestClient(app)


def test_gpt_sovits_health_returns_candidate_health_without_activation(monkeypatch) -> None:
    class _Provider:
        def __init__(self, **_kwargs) -> None:
            pass

        def health(self) -> AudioProviderHealth:
            return AudioProviderHealth(
                provider_id="gpt_sovits",
                kind="tts",
                state="ok",
                summary="GPT-SoVITS service is reachable.",
            )

    monkeypatch.setattr(audio_module, "GptSoVitsProvider", _Provider)
    with _client() as client:
        client.app.state.audio_config = AudioConfig()
        before = client.app.state.audio_config.model_dump()
        body = client.post("/admin/audio/gpt-sovits/health", json=_request()).json()
        after = client.app.state.audio_config.model_dump()

    assert body["provider_id"] == "gpt_sovits"
    assert body["state"] == "ok"
    assert before == after


def test_test_synthesis_returns_wav_metadata_without_chat_history_or_activation(monkeypatch) -> None:
    class _Provider:
        def __init__(self, **_kwargs) -> None:
            pass

        def synthesize(self, _request) -> TTSSynthesisResult:
            return TTSSynthesisResult(pcm_int16=_wav_pcm(), sample_rate=24_000, provider_id="gpt_sovits")

    monkeypatch.setattr(audio_module, "GptSoVitsProvider", _Provider)
    with _client() as client:
        client.app.state.audio_config = AudioConfig()
        client.app.state.history_writes = []
        body = client.post("/admin/audio/test-synthesis", json=_request()).json()
        active_provider = client.app.state.audio_config.tts.active_provider

    assert body["ok"] is True
    assert body["provider_id"] == "gpt_sovits"
    assert body["media_type"] == "wav"
    assert base64.b64decode(body["audio_base64"])
    assert body["sample_rate_hz"] == 24_000
    assert body["duration_ms"] >= 0
    assert active_provider == "piper"

    with wave.open(BytesIO(base64.b64decode(body["audio_base64"])), "rb") as wf:
        assert wf.getframerate() == 24_000
        assert wf.readframes(2) == _wav_pcm()


def test_failed_test_synthesis_does_not_activate_candidate(monkeypatch) -> None:
    class _Provider:
        def __init__(self, **_kwargs) -> None:
            pass

        def synthesize(self, _request) -> TTSSynthesisResult:
            raise TTSProviderError(
                provider_id="gpt_sovits",
                state="external_service_failure",
                summary="GPT-SoVITS could not read the copied reference audio.",
                retryable=False,
            )

    monkeypatch.setattr(audio_module, "GptSoVitsProvider", _Provider)
    with _client() as client:
        client.app.state.audio_config = AudioConfig()
        body = client.post("/admin/audio/test-synthesis", json=_request()).json()
        active_provider = client.app.state.audio_config.tts.active_provider

    assert body["ok"] is False
    assert body["activation_allowed"] is False
    assert body["failure"]["provider_id"] == "gpt_sovits"
    assert active_provider == "piper"
