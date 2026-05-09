from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from contracts import AudioProviderHealth
from sidecar.admin import audio as audio_module


class _Provider:
    def health(self) -> AudioProviderHealth:
        return AudioProviderHealth(
            provider_id="piper",
            kind="tts",
            state="ok",
            summary="Piper provider ready.",
            detail="voice=en_US-amy-medium",
        )


class _Gateway:
    provider = _Provider()


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(audio_module.router)
    return TestClient(app)


def test_audio_status_ready_provider() -> None:
    with _client() as client:
        client.app.state.tts_gateway = _Gateway()
        body = client.get("/admin/audio/status").json()

    assert body["provider_id"] == "piper"
    assert body["kind"] == "tts"
    assert body["state"] == "ok"
    assert body["detail"] == "voice=en_US-amy-medium"


def test_audio_status_uses_startup_error_when_unconfigured() -> None:
    with _client() as client:
        client.app.state.startup_error_message = "TTS failed to initialize."
        body = client.get("/admin/audio/status").json()

    assert body["state"] == "unavailable"
    assert body["summary"] == "TTS failed to initialize."
    assert body["retryable"] is True


def test_audio_status_returns_stored_health_for_startup_failure() -> None:
    with _client() as client:
        client.app.state.audio_provider_health = AudioProviderHealth(
            provider_id="piper",
            kind="tts",
            state="misconfigured",
            summary="Unsupported TTS provider for Phase 16.",
            retryable=False,
        )
        body = client.get("/admin/audio/status").json()

    assert body["state"] == "misconfigured"
    assert "Unsupported" in body["summary"]
