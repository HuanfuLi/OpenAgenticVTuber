from __future__ import annotations

import importlib
import time

from contracts import AudioProviderHealth, STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest, STTResult


class FasterWhisperSTTProvider:
    provider_id = "faster_whisper"

    def __init__(self, config: STTProviderConfig) -> None:
        self.config = config
        self._model = None

    def health(self) -> AudioProviderHealth:
        try:
            importlib.import_module("faster_whisper")
        except ImportError:
            return AudioProviderHealth(
                provider_id=self.provider_id,
                kind="stt",
                state="unavailable",
                summary="faster-whisper is not installed.",
                retryable=True,
                redacted_diagnostics={"dependency": "faster_whisper"},
            )
        return AudioProviderHealth(provider_id=self.provider_id, kind="stt", state="ok", summary="faster-whisper dependency is available.")

    def ensure_loaded(self) -> None:
        if self._model is not None:
            return
        try:
            module = importlib.import_module("faster_whisper")
        except ImportError as exc:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="unavailable",
                summary="faster-whisper is not installed.",
                retryable=True,
                redacted_diagnostics={"dependency": "faster_whisper"},
            ) from exc
        whisper_model = getattr(module, "WhisperModel", None)
        if whisper_model is None:
            raise STTProviderError(provider_id=self.provider_id, state="misconfigured", summary="WhisperModel is unavailable.")
        self._model = whisper_model(self.config.local_model_path_override or self.config.local_model_id or "small", device="cpu", compute_type="int8")

    def transcribe(self, request: STTRequest) -> STTResult:
        if not request.audio_bytes:
            raise STTProviderError(provider_id=self.provider_id, state="misconfigured", summary="STT test audio is empty.")
        self.ensure_loaded()
        started = time.perf_counter()
        try:
            segments, info = self._model.transcribe(
                request.audio_bytes,
                language=None if request.language_mode == "auto" else request.language_mode,
                condition_on_previous_text=False,
            )
        except Exception as exc:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary="faster-whisper transcription failed.",
                retryable=True,
                redacted_diagnostics={"error_type": type(exc).__name__},
            ) from exc
        text = " ".join(str(getattr(segment, "text", "")).strip() for segment in segments).strip()
        if not text:
            raise STTProviderError(provider_id=self.provider_id, state="misconfigured", summary="faster-whisper returned an empty transcript.", retryable=True)
        language = getattr(info, "language", None)
        return STTResult(
            text=text,
            language=language,
            latency_ms=(time.perf_counter() - started) * 1000,
            provider_id=self.provider_id,
            model_id=request.model_id,
            redacted_diagnostics={"provider": self.provider_id},
        )

    def shutdown(self) -> None:
        self._model = None

