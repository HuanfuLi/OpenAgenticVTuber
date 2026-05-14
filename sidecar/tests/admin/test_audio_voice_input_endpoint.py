from __future__ import annotations

import base64
import time
import wave
from io import BytesIO

from fastapi import FastAPI
from fastapi.testclient import TestClient

from contracts import AudioProviderHealth, STTProviderConfig, STTProviderReadiness
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


def _voice_payload(config: dict[str, object], mode: str = "final") -> dict[str, object]:
    return {
        "config": config,
        "audio_base64_wav": _wav_base64(),
        "duration_ms": 600,
        "sequence_id": f"{mode}-1",
        "mode": mode,
        "session_id": "session-1",
    }


def _clear_stt_provider_cache() -> None:
    with audio_module._STT_PROVIDER_CACHE_LOCK:
        audio_module._STT_PROVIDER_CACHE.clear()
        audio_module._STT_PROVIDER_TRANSCRIBE_LOCKS.clear()
        audio_module._STT_PROVIDER_WARMUP_KEYS.clear()


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


def test_voice_input_transcription_allows_untested_config_when_required_inputs_exist(monkeypatch) -> None:
    built_provider_ids: list[str] = []

    class _Provider:
        def transcribe(self, request):
            built_provider_ids.append(request.provider_id)
            return STTResult(
                text="untested provider transcript",
                language="en",
                latency_ms=9.0,
                provider_id=request.provider_id,
            )

    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", lambda _self, _config: _Provider())
    cfg = STTProviderConfig(enabled=True, active_provider="groq")
    cfg.cloud["groq"].consent_granted = True
    cfg.cloud["groq"].api_key = "secret-test-key"

    with _client() as client:
        body = client.post("/admin/audio/voice-input", json=_voice_payload(cfg.model_dump(), "final")).json()

    assert built_provider_ids == ["groq"]
    assert body["ok"] is True
    assert body["mode"] == "final"
    assert body["is_final"] is True
    assert body["transcript"] == "untested provider transcript"


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
        body = client.post("/admin/audio/voice-input", json=_voice_payload(_ready_config("groq"), "final")).json()

    assert built_provider_ids == ["groq"]
    assert body["ok"] is True
    assert body["provider_id"] == "groq"
    assert body["transcript"] == "selected provider transcript"
    assert body["is_final"] is True
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


def test_local_voice_input_reuses_cached_provider_for_same_runtime(monkeypatch) -> None:
    _clear_stt_provider_cache()
    build_count = 0
    request_provider_ids: list[str] = []

    class _Provider:
        def transcribe(self, request):
            request_provider_ids.append(request.provider_id)
            return STTResult(
                text="cached transcript",
                language="en",
                latency_ms=5.0,
                provider_id=request.provider_id,
            )

    def _build_provider(_self, _config):
        nonlocal build_count
        build_count += 1
        return _Provider()

    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", _build_provider)
    cfg = STTProviderConfig(
        enabled=True,
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
    )
    request = audio_module.STTRequest(
        audio_bytes=b"wav",
        sample_rate_hz=16000,
        duration_ms=500,
        provider_id="faster_whisper",
    )

    first = audio_module._transcribe_with_provider(cfg, request)
    second = audio_module._transcribe_with_provider(cfg, request)

    assert first.text == "cached transcript"
    assert second.text == "cached transcript"
    assert build_count == 1
    assert request_provider_ids == ["faster_whisper", "faster_whisper"]
    _clear_stt_provider_cache()


def test_local_stt_warmup_reuses_cached_provider_after_explicit_readiness(monkeypatch) -> None:
    _clear_stt_provider_cache()
    monkeypatch.setattr(audio_module, "_local_model_status", lambda _request, _config: "downloaded")
    built = 0
    validated = 0

    class _Thread:
        def __init__(self, target, *_args, **_kwargs) -> None:
            self._target = target

        def start(self) -> None:
            self._target()

    class _Provider:
        def validate_runtime(self):
            nonlocal validated
            validated += 1
            return AudioProviderHealth(provider_id="faster_whisper", kind="stt", state="ok", summary="warm")

    def _build_provider(_self, _config):
        nonlocal built
        built += 1
        return _Provider()

    monkeypatch.setattr(audio_module.threading, "Thread", _Thread)
    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", _build_provider)
    cfg = STTProviderConfig(
        enabled=True,
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
    )

    with _client() as client:
        body = client.post(
            "/admin/audio/voice-input/readiness",
            json={"config": cfg.model_dump(), "permission_state": "granted"},
        ).json()

    assert body["ready"] is True
    assert built == 1
    assert validated == 1
    with audio_module._STT_PROVIDER_CACHE_LOCK:
        assert len(audio_module._STT_PROVIDER_CACHE) == 1
    _clear_stt_provider_cache()


def test_local_stt_test_reports_cuda_runtime_validation_before_transcription(monkeypatch) -> None:
    _clear_stt_provider_cache()
    monkeypatch.setattr(audio_module, "_local_model_status", lambda _request, _config: "downloaded")

    class _Provider:
        def validate_runtime(self):
            return AudioProviderHealth(
                provider_id="faster_whisper",
                kind="stt",
                state="external_service_failure",
                summary="faster-whisper CUDA runtime failed.",
                retryable=True,
                redacted_diagnostics={"runtime_device": "cuda", "compute_type": "float16"},
            )

        def transcribe(self, _request):
            raise AssertionError("transcribe should not run when runtime validation fails")

    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", lambda _self, _config: _Provider())
    cfg = STTProviderConfig(
        enabled=True,
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
    )

    with _client() as client:
        body = client.post(
            "/admin/audio/stt/test",
            json={
                "config": cfg.model_dump(),
                "audio_base64_wav": _wav_base64(),
                "duration_ms": 600,
                "sample_label": "settings-diagnostics",
            },
        ).json()

    assert body["ok"] is False
    assert body["summary"] == "faster-whisper CUDA runtime failed."
    assert body["failure"]["redacted_diagnostics"]["runtime_device"] == "cuda"
    assert body["readiness"]["invalidation_reason"] == "test_failed"
    _clear_stt_provider_cache()


def test_local_stt_test_times_out_stuck_cuda_runtime_validation(monkeypatch) -> None:
    _clear_stt_provider_cache()
    monkeypatch.setattr(audio_module, "_local_model_status", lambda _request, _config: "downloaded")
    monkeypatch.setattr(audio_module, "_stt_operation_timeout_seconds", lambda _config: 0.001)

    class _Provider:
        def validate_runtime(self):
            time.sleep(0.05)
            return AudioProviderHealth(provider_id="faster_whisper", kind="stt", state="ok", summary="late")

        def transcribe(self, _request):
            raise AssertionError("transcribe should not run when runtime validation times out")

    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", lambda _self, _config: _Provider())
    cfg = STTProviderConfig(
        enabled=True,
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
    )

    with _client() as client:
        body = client.post(
            "/admin/audio/stt/test",
            json={
                "config": cfg.model_dump(),
                "audio_base64_wav": _wav_base64(),
                "duration_ms": 600,
                "sample_label": "settings-diagnostics",
            },
        ).json()

    assert body["ok"] is False
    assert body["failure"]["state"] == "timeout"
    assert body["failure"]["redacted_diagnostics"]["runtime_device"] == "cuda"
    assert body["summary"].startswith("faster-whisper CUDA runtime validation timed out")
    _clear_stt_provider_cache()


def test_voice_input_times_out_stuck_cuda_runtime_validation(monkeypatch) -> None:
    _clear_stt_provider_cache()
    monkeypatch.setattr(audio_module, "_local_model_status", lambda _request, _config: "downloaded")
    monkeypatch.setattr(audio_module, "_stt_operation_timeout_seconds", lambda _config: 0.001)

    class _Provider:
        def validate_runtime(self):
            time.sleep(0.05)
            return AudioProviderHealth(provider_id="faster_whisper", kind="stt", state="ok", summary="late")

        def transcribe(self, _request):
            raise AssertionError("transcribe should not run when runtime validation times out")

    monkeypatch.setattr(audio_module.STTProviderRegistry, "build_provider", lambda _self, _config: _Provider())
    cfg = STTProviderConfig(
        enabled=True,
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
    ).model_dump()

    with _client() as client:
        body = client.post("/admin/audio/voice-input", json=_voice_payload(cfg, "final")).json()

    assert body["ok"] is False
    assert body["failure"]["state"] == "timeout"
    assert body["summary"].startswith("faster-whisper CUDA runtime validation timed out")
    assert body["readiness"]["readiness"]["invalidation_reason"] == "runtime_failure"
    _clear_stt_provider_cache()
