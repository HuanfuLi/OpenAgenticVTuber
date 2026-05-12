from __future__ import annotations

import base64
import sys
import wave
from io import BytesIO
from types import SimpleNamespace

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
        "audio_base64_wav": _wav_base64(),
        "duration_ms": 500,
        "sample_label": "settings",
    }

    with _client() as client:
        body = client.post("/admin/audio/stt/test", json=payload).json()

    assert body["ok"] is False
    assert body["failure"]["summary"].startswith("Local STT model")


def test_local_stt_success_marks_readiness(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_USER_DATA", str(tmp_path))

    constructor_calls: list[dict] = []

    class _AutoModel:
        def __init__(self, **kwargs) -> None:
            constructor_calls.append(kwargs)
            self.kwargs = kwargs

        def generate(self, **_kwargs):
            return [{"text": "ready transcript"}]

    monkeypatch.setitem(sys.modules, "funasr", SimpleNamespace(AutoModel=_AutoModel))
    with _client() as client:
        model_path = tmp_path / "stt-models" / "funasr" / "iic__SenseVoiceSmall"
        model_path.mkdir(parents=True)
        (model_path / "model.bin").write_bytes(b"model")
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
            "audio_base64_wav": _wav_base64(),
            "duration_ms": 500,
            "sample_label": "settings",
        }
        body = client.post("/admin/audio/stt/test", json=payload).json()

    assert body["ok"] is True
    assert body["transcript"] == "ready transcript"
    assert body["readiness"]["active_allowed"] is True
    assert body["readiness"]["invalidation_reason"] == "ready"
    assert constructor_calls[0]["model"] == str(model_path.resolve())


def test_stt_model_download_uses_real_download_and_catalog_state(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_USER_DATA", str(tmp_path))

    def fake_download(provider_id: str, model_id: str, destination) -> None:
        assert provider_id == "funasr"
        assert model_id == "iic/SenseVoiceSmall"
        destination.mkdir(parents=True)
        (destination / "model.bin").write_bytes(b"model")

    monkeypatch.setattr("sidecar.stt.model_cache.download_local_stt_model", fake_download)
    with _client() as client:
        body = client.post(
            "/admin/audio/stt/models/download",
            json={"provider_id": "funasr", "model_id": "iic/SenseVoiceSmall"},
        ).json()
        catalog = client.post(
            "/admin/audio/stt/models",
            json={
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
                "audio_base64_wav": None,
                "duration_ms": None,
                "sample_label": "settings",
            },
        ).json()

    assert body["ok"] is True
    assert body["status"] == "downloaded"
    assert "downloaded" in body["summary"]
    assert catalog["models"][0]["status"] == "downloaded"


def test_stt_model_operations_honor_custom_cache_root(tmp_path, monkeypatch) -> None:
    default_root = tmp_path / "default-user-data"
    custom_root = tmp_path / "custom-stt-cache"
    monkeypatch.setenv("AGENTICLLMVTUBER_USER_DATA", str(default_root))

    def fake_download(_provider_id: str, _model_id: str, destination) -> None:
        destination.mkdir(parents=True)
        (destination / "model.bin").write_bytes(b"model")

    monkeypatch.setattr("sidecar.stt.model_cache.download_local_stt_model", fake_download)
    with _client() as client:
        body = client.post(
            "/admin/audio/stt/models/download",
            json={"provider_id": "funasr", "model_id": "iic/SenseVoiceSmall", "cache_root": str(custom_root)},
        ).json()
        catalog = client.post(
            "/admin/audio/stt/models",
            json={
                "config": {
                    "enabled": True,
                    "active_provider": "funasr",
                    "input_mode": "push_to_talk",
                    "language_mode": "auto",
                    "local_model_id": "iic/SenseVoiceSmall",
                    "local_model_path_override": None,
                    "cache_root": str(custom_root),
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
                        "openai": {"provider_id": "openai", "consent_granted": False, "api_key": "secret", "endpoint_url": None, "model_name": None},
                        "groq": {"provider_id": "groq", "consent_granted": False, "api_key": None, "endpoint_url": None, "model_name": None},
                    },
                },
                "audio_base64_wav": None,
                "duration_ms": None,
                "sample_label": "settings",
            },
        ).json()
        removed = client.post(
            "/admin/audio/stt/models/remove",
            json={"provider_id": "funasr", "model_id": "iic/SenseVoiceSmall", "cache_root": str(custom_root)},
        ).json()

    assert body["ok"] is True
    assert str(custom_root) in body["cache_path_display"]
    assert catalog["cache_root_display"] == str(custom_root.resolve())
    assert catalog["models"][0]["status"] == "downloaded"
    assert not (default_root / "stt-models").exists()
    assert removed["ok"] is True
    assert removed["status"] == "not_downloaded"
    assert not (custom_root / "funasr" / "iic__SenseVoiceSmall").exists()


def test_local_stt_rejects_invalid_wav_payload(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_USER_DATA", str(tmp_path))
    model_path = tmp_path / "stt-models" / "funasr" / "iic__SenseVoiceSmall"
    model_path.mkdir(parents=True)
    (model_path / "model.bin").write_bytes(b"model")
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
        "audio_base64_wav": base64.b64encode(b"not wav").decode("ascii"),
        "duration_ms": 500,
        "sample_label": "settings",
    }

    with _client() as client:
        body = client.post("/admin/audio/stt/test", json=payload).json()

    assert body["ok"] is False
    assert body["failure"]["summary"].startswith("STT test audio must be a valid")
