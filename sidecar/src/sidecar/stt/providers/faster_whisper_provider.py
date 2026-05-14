from __future__ import annotations

import ctypes
import importlib
from io import BytesIO
import os
import sys
import time

from contracts import AudioProviderHealth, STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest, STTResult


def _diagnostic_message(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        return type(exc).__name__
    return message[:500]


def _missing_windows_cuda_libraries() -> list[str]:
    if sys.platform != "win32":
        return []
    missing: list[str] = []
    for dll_name in ("cublas64_12.dll", "cublasLt64_12.dll", "cudnn64_9.dll"):
        try:
            ctypes.WinDLL(dll_name)
        except OSError:
            missing.append(dll_name)
    return missing


def _bounded_cpu_threads() -> int:
    return max(1, min(os.cpu_count() or 1, 8))


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
        model_path = self.config.local_model_path_override
        if not model_path:
            raise STTProviderError(provider_id=self.provider_id, state="misconfigured", summary="faster-whisper local model path is not configured.")
        device = self.config.runtime_device
        compute_type = "int8" if device == "cpu" else self.config.cuda_compute_type
        cpu_threads = _bounded_cpu_threads() if device == "cpu" else None
        if device == "cuda":
            missing_libraries = _missing_windows_cuda_libraries()
            if missing_libraries:
                raise STTProviderError(
                    provider_id=self.provider_id,
                    state="external_service_failure",
                    summary="faster-whisper CUDA runtime is missing NVIDIA CUDA 12 libraries.",
                    retryable=True,
                    redacted_diagnostics={
                        "missing_libraries": ", ".join(missing_libraries),
                        "runtime_device": device,
                        "compute_type": compute_type,
                    },
                )
        try:
            kwargs = {"device": device, "compute_type": compute_type}
            if cpu_threads is not None:
                kwargs["cpu_threads"] = cpu_threads
            self._model = whisper_model(model_path, **kwargs)
        except Exception as exc:
            summary = (
                "faster-whisper CUDA runtime failed. Check NVIDIA driver, CUDA availability, and ctranslate2 GPU support."
                if device == "cuda"
                else "faster-whisper model load failed."
            )
            raise STTProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary=summary,
                retryable=True,
                redacted_diagnostics={
                    "error_type": type(exc).__name__,
                    "error_message": _diagnostic_message(exc),
                    "runtime_device": device,
                    "compute_type": compute_type,
                    **({"cpu_threads": str(cpu_threads)} if cpu_threads is not None else {}),
                },
            ) from exc

    def validate_runtime(self) -> AudioProviderHealth:
        try:
            self.ensure_loaded()
        except STTProviderError as exc:
            return exc.health()
        device = self.config.runtime_device
        compute_type = "int8" if device == "cpu" else self.config.cuda_compute_type
        return AudioProviderHealth(
            provider_id=self.provider_id,
            kind="stt",
            state="ok",
            summary=(
                "faster-whisper CUDA runtime is available."
                if device == "cuda"
                else "faster-whisper CPU runtime is available."
            ),
            retryable=False,
            redacted_diagnostics={
                "runtime_device": device,
                "compute_type": compute_type,
                **({"cpu_threads": str(_bounded_cpu_threads())} if device == "cpu" else {}),
            },
        )

    def transcribe(self, request: STTRequest) -> STTResult:
        if not request.audio_bytes:
            raise STTProviderError(provider_id=self.provider_id, state="misconfigured", summary="STT test audio is empty.")
        self.ensure_loaded()
        started = time.perf_counter()
        try:
            segments, info = self._model.transcribe(
                BytesIO(request.audio_bytes),
                language=None if request.language_mode == "auto" else request.language_mode,
                condition_on_previous_text=False,
            )
        except Exception as exc:
            device = self.config.runtime_device
            compute_type = "int8" if device == "cpu" else self.config.cuda_compute_type
            cpu_threads = _bounded_cpu_threads() if device == "cpu" else None
            raise STTProviderError(
                provider_id=self.provider_id,
                state="external_service_failure",
                summary=(
                    "faster-whisper CUDA transcription failed. Check NVIDIA driver, CUDA availability, and ctranslate2 GPU support."
                    if device == "cuda"
                    else "faster-whisper transcription failed."
                ),
                retryable=True,
                redacted_diagnostics={
                    "error_type": type(exc).__name__,
                    "error_message": _diagnostic_message(exc),
                    "runtime_device": device,
                    "compute_type": compute_type,
                    **({"cpu_threads": str(cpu_threads)} if cpu_threads is not None else {}),
                },
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
            redacted_diagnostics={
                "provider": self.provider_id,
                **({"cpu_threads": str(_bounded_cpu_threads())} if self.config.runtime_device == "cpu" else {}),
            },
        )

    def shutdown(self) -> None:
        self._model = None
