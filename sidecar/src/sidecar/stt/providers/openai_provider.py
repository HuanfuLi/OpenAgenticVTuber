from __future__ import annotations

import importlib
import tempfile
import time
from pathlib import Path

from contracts import AudioProviderHealth, STTProviderConfig
from sidecar.audio.redaction import redact_audio_diagnostics
from sidecar.stt.provider import STTProviderError, STTRequest, STTResult

DEFAULT_OPENAI_STT_MODEL = "gpt-4o-transcribe"


class OpenAISTTProvider:
    provider_id = "openai"

    def __init__(self, config: STTProviderConfig) -> None:
        self.config = config

    @property
    def _cloud(self):
        return self.config.cloud["openai"]

    def health(self) -> AudioProviderHealth:
        if not self._cloud.consent_granted:
            return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="misconfigured", summary="OpenAI STT consent is required.")
        if not self._cloud.api_key:
            return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="missing_credential", summary="OpenAI STT API key is required.")
        try:
            importlib.import_module("openai")
        except ImportError:
            return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="unavailable", summary="OpenAI SDK is not installed.", retryable=True)
        return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="ok", summary="OpenAI STT dependency and configuration are available.")

    def ensure_loaded(self) -> None:
        health = self.health()
        if health.state != "ok":
            raise STTProviderError(provider_id=self.provider_id, state=health.state, summary=health.summary, retryable=health.retryable)

    def transcribe(self, request: STTRequest) -> STTResult:
        self.ensure_loaded()
        started = time.perf_counter()
        audio_path: Path | None = None
        model_name = self._cloud.model_name or DEFAULT_OPENAI_STT_MODEL
        try:
            module = importlib.import_module("openai")
            client_kwargs = {"api_key": self._cloud.api_key}
            if self._cloud.endpoint_url:
                client_kwargs["base_url"] = self._cloud.endpoint_url
            client = module.OpenAI(**client_kwargs)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as audio_file:
                audio_file.write(request.audio_bytes)
                audio_path = Path(audio_file.name)
            with audio_path.open("rb") as audio_file:
                kwargs = {
                    "model": model_name,
                    "file": audio_file,
                    "response_format": "json",
                }
                if request.language_mode != "auto":
                    kwargs["language"] = request.language_mode
                response = client.audio.transcriptions.create(**kwargs)
        except Exception as exc:
            diagnostics = _redacted_openai_error(exc, model_name)
            raise STTProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary=_openai_failure_summary(diagnostics),
                retryable=True,
                redacted_diagnostics=diagnostics,
            ) from exc
        finally:
            if audio_path is not None:
                audio_path.unlink(missing_ok=True)
        text = str(getattr(response, "text", "") or "").strip()
        if not text:
            raise STTProviderError(provider_id=self.provider_id, state="misconfigured", summary="OpenAI STT returned an empty transcript.")
        return STTResult(text=text, language=None, latency_ms=(time.perf_counter() - started) * 1000, provider_id=self.provider_id)

    def shutdown(self) -> None:
        return None


def _redacted_openai_error(exc: Exception, model_name: str) -> dict[str, str]:
    diagnostics = {
        "provider": "openai",
        "model": model_name,
        "file_format": "wav",
        "error_type": type(exc).__name__,
    }
    status_code = getattr(exc, "status_code", None)
    if status_code is not None:
        diagnostics["status_code"] = str(status_code)
    code = getattr(exc, "code", None)
    if code:
        diagnostics["error_code"] = str(code)
    request_id = getattr(exc, "request_id", None)
    if request_id:
        diagnostics["request_id"] = str(request_id)
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            body_code = error.get("code")
            body_message = error.get("message")
            body_type = error.get("type")
            if body_code and "error_code" not in diagnostics:
                diagnostics["error_code"] = str(body_code)
            if body_type:
                diagnostics["error_kind"] = str(body_type)
            if body_message:
                diagnostics["message"] = _safe_openai_message(str(body_message))
    if "message" not in diagnostics:
        diagnostics["message"] = _safe_openai_message(str(exc))
    return diagnostics


def _safe_openai_message(message: str) -> str:
    redacted = str(redact_audio_diagnostics(message))
    return " ".join(redacted.split())[:240]


def _openai_failure_summary(diagnostics: dict[str, str]) -> str:
    parts = ["OpenAI STT transcription failed"]
    if diagnostics.get("status_code"):
        parts.append(f"status {diagnostics['status_code']}")
    if diagnostics.get("error_code"):
        parts.append(diagnostics["error_code"])
    elif diagnostics.get("error_kind"):
        parts.append(diagnostics["error_kind"])
    elif diagnostics.get("message"):
        parts.append(diagnostics["message"])
    return parts[0] if len(parts) == 1 else f"{parts[0]}: {' · '.join(parts[1:])}"
