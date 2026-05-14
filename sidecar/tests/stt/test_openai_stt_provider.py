from __future__ import annotations

import sys
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest
from sidecar.stt.providers.openai_provider import OpenAISTTProvider


def test_openai_provider_blocks_without_consent_or_key() -> None:
    cfg = STTProviderConfig(active_provider="openai")
    provider = OpenAISTTProvider(cfg)

    assert provider.health().state == "misconfigured"
    cfg.cloud["openai"].consent_granted = True
    assert provider.health().state == "missing_credential"


def test_openai_provider_uses_transcription_endpoint(monkeypatch) -> None:
    calls: list[dict] = []
    client_kwargs: list[dict] = []

    class _Transcriptions:
        def create(self, **kwargs):
            calls.append({
                "model": kwargs["model"],
                "language": kwargs.get("language"),
                "response_format": kwargs["response_format"],
                "file_name": kwargs["file"].name,
                "file_bytes": kwargs["file"].read(),
            })
            return SimpleNamespace(text="cloud transcript")

    class _OpenAI:
        def __init__(self, **kwargs) -> None:
            client_kwargs.append(kwargs)
            self.audio = SimpleNamespace(transcriptions=_Transcriptions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=_OpenAI))
    cfg = STTProviderConfig(active_provider="openai")
    cfg.cloud["openai"].consent_granted = True
    cfg.cloud["openai"].api_key = "sk-secret"
    cfg.language_mode = "zh"
    provider = OpenAISTTProvider(cfg)
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="openai", language_mode="zh"))

    assert result.text == "cloud transcript"
    assert calls[0]["model"] == "gpt-4o-transcribe"
    assert calls[0]["language"] == "zh"
    assert calls[0]["response_format"] == "json"
    assert calls[0]["file_name"].endswith(".wav")
    assert calls[0]["file_bytes"] == b"wav"
    assert "base_url" not in client_kwargs[0]


def test_openai_provider_omits_language_in_auto_mode(monkeypatch) -> None:
    calls: list[dict] = []

    class _Transcriptions:
        def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(text="cloud transcript")

    class _OpenAI:
        def __init__(self, **_kwargs) -> None:
            self.audio = SimpleNamespace(transcriptions=_Transcriptions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=_OpenAI))
    cfg = STTProviderConfig(active_provider="openai")
    cfg.cloud["openai"].consent_granted = True
    cfg.cloud["openai"].api_key = "sk-secret"
    provider = OpenAISTTProvider(cfg)
    provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="openai", language_mode="auto"))

    assert "language" not in calls[0]


def test_openai_provider_reports_redacted_api_failure_diagnostics(monkeypatch) -> None:
    class _OpenAIError(Exception):
        status_code = 404
        code = "model_not_found"
        request_id = "req_123"

    class _Transcriptions:
        def create(self, **_kwargs):
            raise _OpenAIError("model was not found")

    class _OpenAI:
        def __init__(self, **_kwargs) -> None:
            self.audio = SimpleNamespace(transcriptions=_Transcriptions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=_OpenAI))
    cfg = STTProviderConfig(active_provider="openai")
    cfg.cloud["openai"].consent_granted = True
    cfg.cloud["openai"].api_key = "sk-secret"
    provider = OpenAISTTProvider(cfg)

    try:
        provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="openai"))
    except STTProviderError as exc:
        assert exc.summary == "OpenAI STT transcription failed: status 404 · model_not_found"
        assert exc.redacted_diagnostics == {
            "provider": "openai",
            "model": "gpt-4o-transcribe",
            "file_format": "wav",
            "error_type": "_OpenAIError",
            "status_code": "404",
            "error_code": "model_not_found",
            "request_id": "req_123",
            "message": "model was not found",
        }
        assert "sk-secret" not in str(exc.redacted_diagnostics)
    else:
        raise AssertionError("OpenAI API failure should be mapped to STTProviderError")


def test_openai_provider_extracts_redacted_error_body_message(monkeypatch) -> None:
    class _OpenAIError(Exception):
        status_code = 400
        code = None
        body = {
            "error": {
                "message": "Invalid file format for sk-secret-value",
                "type": "invalid_request_error",
                "code": "invalid_file_format",
            }
        }

    class _Transcriptions:
        def create(self, **_kwargs):
            raise _OpenAIError("bad request")

    class _OpenAI:
        def __init__(self, **_kwargs) -> None:
            self.audio = SimpleNamespace(transcriptions=_Transcriptions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=_OpenAI))
    cfg = STTProviderConfig(active_provider="openai")
    cfg.cloud["openai"].consent_granted = True
    cfg.cloud["openai"].api_key = "sk-secret"
    provider = OpenAISTTProvider(cfg)

    try:
        provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="openai"))
    except STTProviderError as exc:
        assert exc.summary == "OpenAI STT transcription failed: status 400 · invalid_file_format"
        assert exc.redacted_diagnostics["message"] == "Invalid file format for [redacted]"
        assert exc.redacted_diagnostics["error_kind"] == "invalid_request_error"
    else:
        raise AssertionError("OpenAI API failure should be mapped to STTProviderError")
