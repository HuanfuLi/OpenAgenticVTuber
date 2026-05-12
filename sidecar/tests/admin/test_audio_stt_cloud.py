from __future__ import annotations

import base64
import wave
from io import BytesIO

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin import audio as audio_module


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(audio_module.router)
    return TestClient(app)


def _wav_base64() -> str:
    buf = BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x00\x00" * 160)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _payload(consent: bool, api_key: str | None) -> dict:
    return {
        "config": {
            "enabled": True,
            "active_provider": "openai",
            "input_mode": "push_to_talk",
            "language_mode": "auto",
            "local_model_id": None,
            "local_model_path_override": None,
            "cache_root": None,
            "readiness": {
                "health_check_passed": False,
                "test_transcription_passed": False,
                "last_health_checked_at": None,
                "last_test_transcription_at": None,
                "fingerprint": None,
                "active_allowed": False,
                "invalidation_reason": "never_tested",
            },
            "capture_timeout_ms": 30000,
            "execution": "off_event_loop",
            "cloud": {
                "openai": {"provider_id": "openai", "consent_granted": consent, "api_key": api_key, "endpoint_url": None, "model_name": None},
                "groq": {"provider_id": "groq", "consent_granted": False, "api_key": None, "endpoint_url": None, "model_name": None},
            },
        },
        "audio_base64_wav": _wav_base64(),
        "duration_ms": 500,
        "sample_label": "settings",
    }


def test_cloud_stt_blocks_before_provider_call_without_consent_or_key(monkeypatch) -> None:
    called = False

    def fake_build_provider(_config):
        nonlocal called
        called = True
        raise AssertionError("network provider should not be built")

    monkeypatch.setattr("sidecar.admin.audio.STTProviderRegistry.build_provider", fake_build_provider)
    with _client() as client:
        no_consent = client.post("/admin/audio/stt/test", json=_payload(False, "sk-secret")).json()
        no_key = client.post("/admin/audio/stt/test", json=_payload(True, None)).json()

    assert no_consent["failure"]["state"] == "misconfigured"
    assert no_key["failure"]["state"] == "missing_credential"
    assert called is False
    assert "sk-secret" not in str(no_consent)
