from __future__ import annotations

import sys
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest
from sidecar.stt.providers import faster_whisper_provider as faster_whisper_module
from sidecar.stt.providers.faster_whisper_provider import FasterWhisperSTTProvider


def test_faster_whisper_provider_lazy_import_and_fake_transcription(monkeypatch) -> None:
    sys.modules.pop("faster_whisper", None)
    monkeypatch.setattr(faster_whisper_module.os, "cpu_count", lambda: 16)
    cfg = STTProviderConfig(active_provider="faster_whisper", local_model_id="small", local_model_path_override="C:/cache/faster-whisper")
    provider = FasterWhisperSTTProvider(cfg)
    assert "faster_whisper" not in sys.modules
    constructor_calls: list[tuple[tuple, dict]] = []
    transcribe_inputs: list[object] = []

    class _WhisperModel:
        def __init__(self, *args, **kwargs) -> None:
            constructor_calls.append((args, kwargs))

        def transcribe(self, audio, *_args, **_kwargs):
            transcribe_inputs.append(audio)
            return [SimpleNamespace(text="hello local")], SimpleNamespace(language="en")

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=_WhisperModel))
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="faster_whisper"))

    assert result.text == "hello local"
    assert result.language == "en"
    assert constructor_calls[0][0][0] == "C:/cache/faster-whisper"
    assert constructor_calls[0][1]["device"] == "cpu"
    assert constructor_calls[0][1]["compute_type"] == "int8"
    assert constructor_calls[0][1]["cpu_threads"] == 8
    assert result.redacted_diagnostics["cpu_threads"] == "8"
    assert hasattr(transcribe_inputs[0], "read")
    assert transcribe_inputs[0].read() == b"wav"


def test_faster_whisper_provider_can_load_cuda_runtime(monkeypatch) -> None:
    sys.modules.pop("faster_whisper", None)
    monkeypatch.setattr(faster_whisper_module, "_missing_windows_cuda_libraries", lambda: [])
    cfg = STTProviderConfig(
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
        cuda_compute_type="float16",
    )
    provider = FasterWhisperSTTProvider(cfg)
    constructor_calls: list[tuple[tuple, dict]] = []

    class _WhisperModel:
        def __init__(self, *args, **kwargs) -> None:
            constructor_calls.append((args, kwargs))

        def transcribe(self, *_args, **_kwargs):
            return [SimpleNamespace(text="hello gpu")], SimpleNamespace(language="en")

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=_WhisperModel))
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="faster_whisper"))

    assert result.text == "hello gpu"
    assert constructor_calls[0][1]["device"] == "cuda"
    assert constructor_calls[0][1]["compute_type"] == "float16"
    assert "cpu_threads" not in constructor_calls[0][1]


def test_faster_whisper_cuda_runtime_validation_reports_load_failure(monkeypatch) -> None:
    sys.modules.pop("faster_whisper", None)
    monkeypatch.setattr(faster_whisper_module, "_missing_windows_cuda_libraries", lambda: [])
    cfg = STTProviderConfig(
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
        cuda_compute_type="float16",
    )
    provider = FasterWhisperSTTProvider(cfg)

    class _WhisperModel:
        def __init__(self, *_args, **_kwargs) -> None:
            raise RuntimeError("CUDA driver unavailable")

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=_WhisperModel))

    health = provider.validate_runtime()

    assert health.state == "external_service_failure"
    assert health.summary.startswith("faster-whisper CUDA runtime failed")
    assert health.redacted_diagnostics == {
        "error_type": "RuntimeError",
        "error_message": "CUDA driver unavailable",
        "runtime_device": "cuda",
        "compute_type": "float16",
    }


def test_faster_whisper_cuda_transcription_failure_reports_runtime_details(monkeypatch) -> None:
    sys.modules.pop("faster_whisper", None)
    monkeypatch.setattr(faster_whisper_module, "_missing_windows_cuda_libraries", lambda: [])
    cfg = STTProviderConfig(
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
        cuda_compute_type="float16",
    )
    provider = FasterWhisperSTTProvider(cfg)

    class _WhisperModel:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def transcribe(self, *_args, **_kwargs):
            raise RuntimeError("CUDA failed during decode")

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=_WhisperModel))

    try:
        provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="faster_whisper"))
    except STTProviderError as exc:
        health = exc.health()
    else:
        raise AssertionError("expected STTProviderError")

    assert health.summary.startswith("faster-whisper CUDA transcription failed")
    assert health.redacted_diagnostics == {
        "error_type": "RuntimeError",
        "error_message": "CUDA failed during decode",
        "runtime_device": "cuda",
        "compute_type": "float16",
    }


def test_faster_whisper_cuda_runtime_validation_reports_missing_windows_libraries(monkeypatch) -> None:
    sys.modules.pop("faster_whisper", None)
    monkeypatch.setattr(
        faster_whisper_module,
        "_missing_windows_cuda_libraries",
        lambda: ["cublas64_12.dll", "cublasLt64_12.dll", "cudnn64_9.dll"],
    )
    cfg = STTProviderConfig(
        active_provider="faster_whisper",
        local_model_id="small",
        local_model_path_override="C:/cache/faster-whisper",
        runtime_device="cuda",
        cuda_compute_type="float16",
    )
    provider = FasterWhisperSTTProvider(cfg)

    class _WhisperModel:
        def __init__(self, *_args, **_kwargs) -> None:
            raise AssertionError("CUDA library preflight should run before model load")

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=_WhisperModel))

    health = provider.validate_runtime()

    assert health.state == "external_service_failure"
    assert health.summary == "faster-whisper CUDA runtime is missing NVIDIA CUDA 12 libraries."
    assert health.redacted_diagnostics == {
        "missing_libraries": "cublas64_12.dll, cublasLt64_12.dll, cudnn64_9.dll",
        "runtime_device": "cuda",
        "compute_type": "float16",
    }
