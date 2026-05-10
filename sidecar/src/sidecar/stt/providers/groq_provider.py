from __future__ import annotations

import importlib
from io import BytesIO
import time

from contracts import AudioProviderHealth, STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest, STTResult


class GroqSTTProvider:
    provider_id = "groq"

    def __init__(self, config: STTProviderConfig) -> None:
        self.config = config

    @property
    def _cloud(self):
        return self.config.cloud["groq"]

    def health(self) -> AudioProviderHealth:
        if not self._cloud.consent_granted:
            return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="misconfigured", summary="Groq STT consent is required.")
        if not self._cloud.api_key:
            return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="missing_credential", summary="Groq STT API key is required.")
        try:
            importlib.import_module("groq")
        except ImportError:
            return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="unavailable", summary="Groq SDK is not installed.", retryable=True)
        return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="ok", summary="Groq STT dependency and configuration are available.")

    def ensure_loaded(self) -> None:
        health = self.health()
        if health.state != "ok":
            raise STTProviderError(provider_id=self.provider_id, state=health.state, summary=health.summary, retryable=health.retryable)

    def transcribe(self, request: STTRequest) -> STTResult:
        self.ensure_loaded()
        started = time.perf_counter()
        try:
            module = importlib.import_module("groq")
            client = module.Groq(api_key=self._cloud.api_key, base_url=self._cloud.endpoint_url)
            response = client.audio.transcriptions.create(
                model=self._cloud.model_name or "whisper-large-v3-turbo",
                file=("settings-test.wav", BytesIO(request.audio_bytes), "audio/wav"),
            )
        except Exception as exc:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary="Groq STT transcription failed.",
                retryable=True,
                redacted_diagnostics={"error_type": type(exc).__name__},
            ) from exc
        text = str(getattr(response, "text", "") or "").strip()
        if not text:
            raise STTProviderError(provider_id=self.provider_id, state="misconfigured", summary="Groq STT returned an empty transcript.")
        return STTResult(text=text, language=None, latency_ms=(time.perf_counter() - started) * 1000, provider_id=self.provider_id)

    def shutdown(self) -> None:
        return None

