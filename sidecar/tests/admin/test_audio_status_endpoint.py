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


def test_audio_provider_catalog_exposes_tts_and_stt_privacy_labels() -> None:
    with _client() as client:
        body = client.get("/admin/audio/providers").json()

    providers = {provider["provider_id"]: provider for provider in body["providers"]}
    assert providers["piper"]["local"] is True
    assert providers["gpt_sovits"]["requires_consent"] is False
    assert providers["funasr"]["kind"] == "stt"
    assert providers["openai"]["requires_consent"] is True
    assert providers["openai"]["requires_api_key"] is True


def test_stt_test_blocks_cloud_without_consent_or_credential() -> None:
    payload = {
        "config": {
            "enabled": True,
            "active_provider": "openai",
            "input_mode": "push_to_talk",
            "language_mode": "auto",
            "capture_timeout_ms": 30000,
            "execution": "off_event_loop",
            "cloud": {
                "openai": {
                    "provider_id": "openai",
                    "consent_granted": False,
                    "api_key": "sk-secret-value",
                    "endpoint_url": None,
                    "model_name": None,
                },
                "groq": {
                    "provider_id": "groq",
                    "consent_granted": False,
                    "api_key": None,
                    "endpoint_url": None,
                    "model_name": None,
                },
            },
        },
        "sample_label": "C:\\Users\\alice\\private\\sample.wav",
    }

    with _client() as client:
        body = client.post("/admin/audio/stt/test", json=payload).json()

    assert body["ok"] is False
    assert body["provider_id"] == "openai"
    assert body["failure"]["state"] == "misconfigured"
    rendered = str(body)
    assert "sk-secret-value" not in rendered
    assert "alice" not in rendered
