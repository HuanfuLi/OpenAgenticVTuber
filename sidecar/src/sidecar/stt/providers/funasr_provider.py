from __future__ import annotations

import importlib
import time

from contracts import AudioProviderHealth, STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest, STTResult


class FunASRSTTProvider:
    provider_id = "funasr"

    def __init__(self, config: STTProviderConfig) -> None:
        self.config = config
        self._model = None

    def health(self) -> AudioProviderHealth:
        try:
            importlib.import_module("funasr")
        except ImportError:
            return AudioProviderHealth(
                provider_id=self.provider_id,
                kind="stt",
                state="unavailable",
                summary="FunASR is not installed.",
                retryable=True,
                redacted_diagnostics={"dependency": "funasr"},
            )
        return AudioProviderHealth(
            provider_id=self.provider_id,
            kind="stt",
            state="ok",
            summary="FunASR dependency is available.",
            retryable=False,
        )

    def ensure_loaded(self) -> None:
        if self._model is not None:
            return
        try:
            module = importlib.import_module("funasr")
        except ImportError as exc:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="unavailable",
                summary="FunASR is not installed.",
                retryable=True,
                redacted_diagnostics={"dependency": "funasr"},
            ) from exc
        auto_model = getattr(module, "AutoModel", None)
        if auto_model is None:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="misconfigured",
                summary="FunASR AutoModel is unavailable.",
                retryable=False,
            )
        model_path = self.config.local_model_path_override
        if not model_path:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="misconfigured",
                summary="FunASR local model path is not configured.",
                retryable=False,
            )
        self._model = auto_model(model=model_path)

    def transcribe(self, request: STTRequest) -> STTResult:
        if not request.audio_bytes:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="misconfigured",
                summary="STT test audio is empty.",
                retryable=False,
            )
        self.ensure_loaded()
        started = time.perf_counter()
        try:
            generated = self._model.generate(input=request.audio_bytes, language=request.language_mode)
        except Exception as exc:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary="FunASR transcription failed.",
                retryable=True,
                redacted_diagnostics={"error_type": type(exc).__name__},
            ) from exc
        text = _extract_text(generated)
        if not text:
            raise STTProviderError(
                provider_id=self.provider_id,
                state="misconfigured",
                summary="FunASR returned an empty transcript.",
                retryable=True,
            )
        return STTResult(
            text=text,
            language=request.language_mode if request.language_mode != "auto" else None,
            latency_ms=(time.perf_counter() - started) * 1000,
            provider_id=self.provider_id,
            model_id=request.model_id,
            redacted_diagnostics={"provider": self.provider_id},
        )

    def shutdown(self) -> None:
        self._model = None


def _extract_text(value: object) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, dict):
                parts.append(str(item.get("text", "")).strip())
            elif isinstance(item, str):
                parts.append(item.strip())
        return " ".join(part for part in parts if part).strip()
    if isinstance(value, dict):
        return str(value.get("text", "")).strip()
    return ""
