from __future__ import annotations

import base64
import wave
from io import BytesIO

from fastapi import FastAPI
from fastapi.testclient import TestClient

from contracts import STTProviderConfig, STTProviderReadiness
from sidecar.admin import audio as audio_module
from sidecar.stt.provider import STTResult
from sidecar.stt.readiness import compute_stt_readiness_fingerprint


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


def _ready_config(provider_id: str = "funasr") -> dict[str, object]:
    cfg = STTProviderConfig(enabled=True, active_provider=provider_id)
    cfg.readiness = STTProviderReadiness(
        health_check_passed=True,
        test_transcription_passed=True,
        last_health_checked_at="2026-05-10T00:00:00Z",
        last_test_transcription_at="2026-05-10T00:00:00Z",
        fingerprint=compute_stt_readiness_fingerprint(cfg),
        active_allowed=True,
        invalidation_reason="ready",
    )
    if provider_id in {"openai", "groq"}:
        cfg.cloud[provider_id].consent_granted = True
        cfg.cloud[provider_id].api_key = "secret-test-key"
        cfg.readiness.fingerprint = compute_stt_readiness_fingerprint(cfg)
    return cfg.model_dump()


def _voice_payload(config: dict[str, object], mode: str = "preview") -> dict[str, object]:
    return {
        "config": config,
        "audio_base64_wav": _wav_base64(),
        "duration_ms": 600,
        "sequence_id": f"{mode}-1",
        "mode": mode,
        "session_id": "session-1",
    }


def test_voice_input_readiness_refuses_disabled_stt() -> None:
    cfg = STTProviderConfig(enabled=False, active_provider="funasr").model_dump()

    with _client() as client:
        body = client.post(
            "/admin/audio/voice-input/readiness",
            json={"config": cfg, "permission_state": "granted"},
        ).json()

    assert body["ready"] is False
    assert body["blocked_reason"] == "stt_disabled"
    assert body["setup_destination"] == "voice_settings"


def test_voice_input_transcription_refuses_unready_stt(monkeypatch) -> None:
    called = False

    def _unexpected_build(*_args, **_kwargs):
        nonlocal called
        called = True
        raise AssertionError("provider should not be constructed when readiness is inactive")

    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", _unexpected_build)
    cfg = STTProviderConfig(enabled=True, active_provider="funasr").model_dump()

    with _client() as client:
        body = client.post("/admin/audio/voice-input", json=_voice_payload(cfg, "final")).json()

    assert called is False
    assert body["ok"] is False
    assert body["mode"] == "final"
    assert body["is_final"] is True
    assert body["readiness"]["blocked_reason"] == "readiness_not_active"


def test_voice_input_readiness_rechecks_missing_local_model(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENTICLLMVTUBER_USER_DATA", str(tmp_path))

    with _client() as client:
        body = client.post(
            "/admin/audio/voice-input/readiness",
            json={"config": _ready_config("funasr"), "permission_state": "granted"},
        ).json()

    assert body["ready"] is False
    assert body["blocked_reason"] == "readiness_not_active"
    assert body["setup_destination"] == "voice_settings"
    assert body["summary"].startswith("Local STT model is not downloaded")
    assert body["readiness"]["invalidation_reason"] == "missing_model"


def test_voice_input_transcription_uses_selected_provider_without_fallback(monkeypatch) -> None:
    built_provider_ids: list[str] = []

    class _Provider:
        def transcribe(self, request):
            built_provider_ids.append(request.provider_id)
            return STTResult(
                text="selected provider transcript",
                language="en",
                latency_ms=13.0,
                provider_id=request.provider_id,
                redacted_diagnostics={"provider": request.provider_id},
            )

    monkeypatch.setattr(
        audio_module.STTProviderRegistry,
        "build_provider",
        lambda _self, config: _Provider(),
    )

    with _client() as client:
        body = client.post("/admin/audio/voice-input", json=_voice_payload(_ready_config("groq"), "preview")).json()

    assert built_provider_ids == ["groq"]
    assert body["ok"] is True
    assert body["provider_id"] == "groq"
    assert body["transcript"] == "selected provider transcript"
    assert body["is_final"] is False
    assert "audio_base64" not in body
    assert "history" not in body


def test_voice_input_runtime_failure_returns_redacted_inactive_readiness(monkeypatch) -> None:
    def _build_provider(_self, config):
        from sidecar.stt.provider import STTProviderError

        raise STTProviderError(
            provider_id=config.active_provider,
            state="external_service_failure",
            summary="Runtime provider failed.",
            retryable=True,
            redacted_diagnostics={"error_type": "ProviderError"},
        )

    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", _build_provider)

    with _client() as client:
        body = client.post("/admin/audio/voice-input", json=_voice_payload(_ready_config("openai"), "final")).json()

    assert body["ok"] is False
    assert body["failure"]["state"] == "external_service_failure"
    assert body["readiness"]["readiness"]["invalidation_reason"] == "runtime_failure"
    assert "secret-test-key" not in str(body)
