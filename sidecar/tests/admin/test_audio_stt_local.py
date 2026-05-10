from __future__ import annotations

import base64
import sys
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from sidecar.admin import audio as audio_module


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(audio_module.router)
    return TestClient(app)


def test_local_stt_missing_model_blocks_test(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_USER_DATA", str(tmp_path))
    payload = {
        "config": {
            "enabled": True,
            "active_provider": "funasr",
            "input_mode": "push_to_talk",
            "language_mode": "auto",
            "local_model_id": "iic/SenseVoiceSmall",
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
                "openai": {"provider_id": "openai", "consent_granted": False, "api_key": None, "endpoint_url": None, "model_name": None},
                "groq": {"provider_id": "groq", "consent_granted": False, "api_key": None, "endpoint_url": None, "model_name": None},
            },
        },
        "audio_base64_wav": base64.b64encode(b"wav").decode("ascii"),
        "duration_ms": 500,
        "sample_label": "settings",
    }

    with _client() as client:
        body = client.post("/admin/audio/stt/test", json=payload).json()

    assert body["ok"] is False
    assert body["failure"]["summary"].startswith("Local STT model")


def test_local_stt_success_marks_readiness(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_USER_DATA", str(tmp_path))

    class _AutoModel:
        def __init__(self, **_kwargs) -> None:
            pass

        def generate(self, **_kwargs):
            return [{"text": "ready transcript"}]

    monkeypatch.setitem(sys.modules, "funasr", SimpleNamespace(AutoModel=_AutoModel))
    with _client() as client:
        client.post("/admin/audio/stt/models/download", json={"provider_id": "funasr", "model_id": "iic/SenseVoiceSmall"})
        payload = {
            "config": {
                "enabled": True,
                "active_provider": "funasr",
                "input_mode": "push_to_talk",
                "language_mode": "auto",
                "local_model_id": "iic/SenseVoiceSmall",
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
                    "openai": {"provider_id": "openai", "consent_granted": False, "api_key": None, "endpoint_url": None, "model_name": None},
                    "groq": {"provider_id": "groq", "consent_granted": False, "api_key": None, "endpoint_url": None, "model_name": None},
                },
            },
            "audio_base64_wav": base64.b64encode(b"wav").decode("ascii"),
            "duration_ms": 500,
            "sample_label": "settings",
        }
        body = client.post("/admin/audio/stt/test", json=payload).json()

    assert body["ok"] is True
    assert body["transcript"] == "ready transcript"
    assert body["readiness"]["active_allowed"] is True

