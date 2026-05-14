"""Audio provider status and reference-audio validation endpoints."""

from __future__ import annotations

import base64
import asyncio
import os
import threading
import wave
from io import BytesIO
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
import soundfile

from contracts import (
    AudioProviderCatalog,
    AudioProviderCatalogEntry,
    AudioProviderHealth,
    GptSoVitsProviderConfig,
    STTModelCacheOperationRequest,
    STTProviderReadiness,
    STTProviderConfig,
    STTTestRequest,
    STTTestResult,
    VoiceInputReadiness,
    VoiceInputReadinessRequest,
    VoiceInputTranscriptionRequest,
    VoiceInputTranscriptionResult,
    VoicePreset,
)
from sidecar.audio.redaction import redact_audio_diagnostics
from sidecar.stt import STTModelCache, STTProviderRegistry
from sidecar.stt.provider import STTProviderError, STTRequest
from sidecar.stt.readiness import readiness_from_test_result
from sidecar.stt.readiness import compute_stt_readiness_fingerprint, validate_stt_readiness
from sidecar.tts.gpt_sovits_provider import GptSoVitsProvider
from sidecar.tts.provider import TTSProviderError, TTSSynthesisRequest


router = APIRouter(prefix="/admin/audio")

SUPPORTED_REFERENCE_AUDIO_FORMATS = {"wav", "flac", "mp3", "ogg"}
MIN_REFERENCE_AUDIO_SECONDS = 1.0
MAX_REFERENCE_AUDIO_SECONDS = 30.0
LOCAL_STT_PROVIDER_IDS = {"funasr", "faster_whisper"}
_STT_PROVIDER_CACHE_LOCK = threading.Lock()
_STT_PROVIDER_CACHE: dict[tuple[str, str, str, str, str], object] = {}
_STT_PROVIDER_TRANSCRIBE_LOCKS: dict[tuple[str, str, str, str, str], threading.Lock] = {}
_STT_PROVIDER_WARMUP_KEYS: set[tuple[str, str, str, str, str]] = set()
ReferenceAudioErrorCode = Literal[
    "missing_file",
    "unsupported_format",
    "unreadable_file",
    "unreadable_metadata",
    "duration_too_short",
    "duration_too_long",
]


class ReferenceAudioValidationRequest(BaseModel):
    managed_path: str = Field(min_length=1)
    display_basename: str = Field(min_length=1)
    transcript_text: str = Field(min_length=1)
    language: str = Field(min_length=1)


class ReferenceAudioValidationError(BaseModel):
    code: ReferenceAudioErrorCode
    message: str


class ReferenceAudioValidationResponse(BaseModel):
    ok: bool
    format: str | None = None
    duration_seconds: float | None = None
    sample_rate: int | None = None
    channels: int | None = None
    errors: list[ReferenceAudioValidationError] = Field(default_factory=list)
    redacted_diagnostics: str


class GptSoVitsCandidateRequest(BaseModel):
    config: GptSoVitsProviderConfig
    preset: VoicePreset
    reference_audio_path: str = Field(min_length=1)
    text: str = Field(default="hello", min_length=1)


class GptSoVitsHealthCandidateRequest(BaseModel):
    config: GptSoVitsProviderConfig
    preset: VoicePreset


def _redacted_diagnostics(display_basename: str, summary: str) -> str:
    return f"reference_audio={Path(display_basename).name}; {summary}"


def _error_response(
    *,
    display_basename: str,
    code: ReferenceAudioErrorCode,
    message: str,
    diagnostic: str,
    audio_format: str | None = None,
) -> dict[str, object]:
    return ReferenceAudioValidationResponse(
        ok=False,
        format=audio_format,
        errors=[ReferenceAudioValidationError(code=code, message=message)],
        redacted_diagnostics=_redacted_diagnostics(display_basename, diagnostic),
    ).model_dump()


def _duration_seconds(info: object) -> float | None:
    duration = getattr(info, "duration", None)
    if isinstance(duration, int | float):
        return float(duration)
    frames = getattr(info, "frames", None)
    samplerate = getattr(info, "samplerate", None)
    if isinstance(frames, int) and isinstance(samplerate, int) and samplerate > 0:
        return frames / samplerate
    return None


def _fallback_health(request: Request) -> AudioProviderHealth:
    startup_error = getattr(request.app.state, "startup_error_message", None)
    return AudioProviderHealth(
        provider_id="piper",
        kind="tts",
        state="unavailable" if startup_error else "misconfigured",
        summary=startup_error or "TTS provider is not configured.",
        retryable=True,
    )


def _provider_catalog() -> AudioProviderCatalog:
    stt_catalog = STTProviderRegistry().catalog()
    return AudioProviderCatalog(
        providers=[
            AudioProviderCatalogEntry(
                provider_id="piper",
                kind="tts",
                display_name="Piper local TTS",
                capabilities=["local", "requires_local_model", "test_synthesis"],
                local=True,
                summary="Local baseline TTS provider.",
            ),
            AudioProviderCatalogEntry(
                provider_id="gpt_sovits",
                kind="tts",
                display_name="GPT-SoVITS",
                capabilities=["local", "requires_external_service", "test_synthesis", "chinese_english"],
                local=True,
                summary="External or app-launched voice synthesis server.",
            ),
            *stt_catalog.providers,
        ]
    )


def _stt_provider_health(config: STTProviderConfig) -> AudioProviderHealth:
    registry = STTProviderRegistry()
    registry_health = registry.health(config)
    if registry_health.state != "unavailable" or config.active_provider in {"openai", "groq"}:
        return registry_health
    provider_id = config.active_provider or "funasr"
    if provider_id in {"openai", "groq"}:
        cloud = config.cloud.get(provider_id)
        if cloud is None or not cloud.consent_granted:
            return AudioProviderHealth(
                provider_id=provider_id,
                kind="stt",
                state="misconfigured",
                summary="Cloud STT is blocked until explicit consent is saved.",
                retryable=False,
                redacted_diagnostics={"provider": provider_id, "consent": "missing"},
            )
        if not cloud.api_key:
            return AudioProviderHealth(
                provider_id=provider_id,
                kind="stt",
                state="missing_credential",
                summary="Cloud STT API key is required for this diagnostic request.",
                retryable=False,
                redacted_diagnostics={"provider": provider_id, "credential": "missing"},
            )
        return AudioProviderHealth(
            provider_id=provider_id,
            kind="stt",
            state="unavailable",
            summary="Cloud STT adapter is planned for Phase 19; no network request was sent.",
            retryable=True,
            redacted_diagnostics={"provider": provider_id, "network": "not_attempted"},
        )
    return AudioProviderHealth(
        provider_id=provider_id,
        kind="stt",
        state="unavailable",
        summary="Local STT adapter is planned for Phase 19.",
        retryable=True,
        redacted_diagnostics={"provider": provider_id, "adapter": "not_implemented"},
    )


def _stt_model_cache(request: Request, config: STTProviderConfig | None = None) -> STTModelCache:
    user_data = os.environ.get("AGENTICLLMVTUBER_USER_DATA")
    return STTModelCache(cache_root=config.cache_root if config else None, user_data=user_data)


def _local_model_status(request: Request, config: STTProviderConfig) -> str:
    provider_id = config.active_provider
    if provider_id not in {"funasr", "faster_whisper"}:
        return "downloaded"
    if config.local_model_path_override:
        return STTModelCache.model_status_for_path(config.local_model_path_override)
    model_id = config.local_model_id or ("iic/SenseVoiceSmall" if provider_id == "funasr" else "small")
    catalog = _stt_model_cache(request, config).catalog()
    model = next((item for item in catalog.models if item.provider_id == provider_id and item.model_id == model_id), None)
    return model.status if model else "missing"


def _local_model_id(config: STTProviderConfig) -> str:
    provider_id = config.active_provider
    return config.local_model_id or ("iic/SenseVoiceSmall" if provider_id == "funasr" else "small")


def _resolve_local_model_path(request: Request, config: STTProviderConfig) -> Path | None:
    provider_id = config.active_provider
    if provider_id not in {"funasr", "faster_whisper"}:
        return None
    if config.local_model_path_override:
        candidate = Path(config.local_model_path_override).resolve()
        return candidate if STTModelCache.model_status_for_path(candidate) == "downloaded" else None
    model_id = _local_model_id(config)
    cache = _stt_model_cache(request, config)
    candidate = cache.model_path(provider_id, model_id)
    return candidate if cache.model_status_for_path(candidate) == "downloaded" else None


def _config_with_resolved_local_model_path(request: Request, config: STTProviderConfig) -> STTProviderConfig:
    path = _resolve_local_model_path(request, config)
    if path is None:
        return config
    return config.model_copy(update={"local_model_path_override": str(path)})


def _decode_wav_payload(payload: STTTestRequest | VoiceInputTranscriptionRequest) -> tuple[bytes, int, int]:
    audio_b64 = payload.audio_base64_wav
    if not audio_b64:
        raise ValueError("missing_audio")
    try:
        audio_bytes = base64.b64decode(audio_b64)
        with wave.open(BytesIO(audio_bytes), "rb") as wav:
            sample_rate = wav.getframerate()
            frames = wav.getnframes()
            if sample_rate <= 0 or frames <= 0:
                raise ValueError("empty_wav")
            duration_ms = int(frames / sample_rate * 1000)
    except Exception as exc:
        raise ValueError("invalid_wav") from exc
    return audio_bytes, sample_rate, duration_ms


def _invalid_wav_health(provider_id: str) -> AudioProviderHealth:
    return AudioProviderHealth(
        provider_id=provider_id,
        kind="stt",
        state="misconfigured",
        summary="STT test audio must be a valid non-empty WAV payload.",
        retryable=False,
        redacted_diagnostics={"audio": "invalid_wav"},
    )


def _local_stt_provider_cache_key(config: STTProviderConfig) -> tuple[str, str, str, str, str] | None:
    provider_id = config.active_provider or "funasr"
    if provider_id not in LOCAL_STT_PROVIDER_IDS:
        return None
    return (
        provider_id,
        config.local_model_id or "",
        config.local_model_path_override or "",
        config.runtime_device,
        config.cuda_compute_type,
    )


def _build_or_get_stt_provider(config: STTProviderConfig):
    cache_key = _local_stt_provider_cache_key(config)
    if cache_key is None:
        return STTProviderRegistry().build_provider(config), None
    with _STT_PROVIDER_CACHE_LOCK:
        provider = _STT_PROVIDER_CACHE.get(cache_key)
        if provider is None:
            provider = STTProviderRegistry().build_provider(config)
            _STT_PROVIDER_CACHE[cache_key] = provider
        transcribe_lock = _STT_PROVIDER_TRANSCRIBE_LOCKS.setdefault(cache_key, threading.Lock())
    return provider, transcribe_lock


def _evict_stt_provider(config: STTProviderConfig) -> None:
    cache_key = _local_stt_provider_cache_key(config)
    if cache_key is None:
        return
    with _STT_PROVIDER_CACHE_LOCK:
        provider = _STT_PROVIDER_CACHE.pop(cache_key, None)
        _STT_PROVIDER_TRANSCRIBE_LOCKS.pop(cache_key, None)
    shutdown = getattr(provider, "shutdown", None)
    if shutdown is not None:
        try:
            shutdown()
        except Exception:
            pass


def _transcribe_with_provider(config: STTProviderConfig, request: STTRequest):
    provider, transcribe_lock = _build_or_get_stt_provider(config)
    if transcribe_lock is None:
        return provider.transcribe(request)
    with transcribe_lock:
        return provider.transcribe(request)


def _validate_stt_runtime(config: STTProviderConfig) -> AudioProviderHealth | None:
    provider_id = config.active_provider or "funasr"
    if provider_id not in LOCAL_STT_PROVIDER_IDS:
        return None
    provider, transcribe_lock = _build_or_get_stt_provider(config)
    validate_runtime = getattr(provider, "validate_runtime", None)
    if validate_runtime is None:
        return None
    if transcribe_lock is None:
        health = validate_runtime()
    else:
        with transcribe_lock:
            health = validate_runtime()
    return health if health.state != "ok" else None


def _schedule_local_stt_warmup(request: Request, config: STTProviderConfig) -> None:
    provider_id = config.active_provider or "funasr"
    if not config.enabled or provider_id not in LOCAL_STT_PROVIDER_IDS:
        return
    if _local_model_status(request, config) != "downloaded":
        return
    provider_config = _config_with_resolved_local_model_path(request, config)
    cache_key = _local_stt_provider_cache_key(provider_config)
    if cache_key is None:
        return
    with _STT_PROVIDER_CACHE_LOCK:
        if cache_key in _STT_PROVIDER_WARMUP_KEYS:
            return
        _STT_PROVIDER_WARMUP_KEYS.add(cache_key)

    def warmup() -> None:
        try:
            _validate_stt_runtime(provider_config)
        except Exception:
            pass
        finally:
            with _STT_PROVIDER_CACHE_LOCK:
                _STT_PROVIDER_WARMUP_KEYS.discard(cache_key)

    threading.Thread(target=warmup, name=f"stt-warmup-{provider_id}", daemon=True).start()


def _stt_operation_timeout_seconds(config: STTProviderConfig) -> float:
    return max(config.capture_timeout_ms / 1000.0, 1.0)


async def _run_stt_worker(config: STTProviderConfig, func, *args):
    return await asyncio.wait_for(
        asyncio.to_thread(func, *args),
        timeout=_stt_operation_timeout_seconds(config),
    )


def _stt_timeout_health(config: STTProviderConfig, operation: Literal["runtime", "transcription"]) -> AudioProviderHealth:
    provider_id = config.active_provider or "funasr"
    diagnostics = {
        "provider": provider_id,
        "operation": operation,
        "timeout_ms": str(config.capture_timeout_ms),
    }
    if provider_id == "faster_whisper":
        diagnostics.update({
            "runtime_device": config.runtime_device,
            "compute_type": "int8" if config.runtime_device == "cpu" else config.cuda_compute_type,
            **({"cpu_threads": str(max(1, min(os.cpu_count() or 1, 8)))} if config.runtime_device == "cpu" else {}),
        })
    if provider_id == "faster_whisper" and config.runtime_device == "cuda":
        summary = (
            "faster-whisper CUDA runtime validation timed out. Switch runtime to CPU or check NVIDIA/CUDA/CTranslate2 compatibility."
            if operation == "runtime"
            else "faster-whisper CUDA transcription timed out. Switch runtime to CPU or check NVIDIA/CUDA/CTranslate2 compatibility."
        )
    else:
        summary = "STT runtime validation timed out." if operation == "runtime" else "STT transcription timed out."
    return AudioProviderHealth(
        provider_id=provider_id,
        kind="stt",
        state="timeout",
        summary=summary,
        retryable=True,
        redacted_diagnostics=diagnostics,
    )


def _stt_failure_result(payload: STTTestRequest, health: AudioProviderHealth, diagnostics: dict[str, str] | None = None) -> STTTestResult:
    return STTTestResult(
        ok=False,
        provider_id=health.provider_id,
        transcript=None,
        language=None,
        latency_ms=None,
        duration_ms=payload.duration_ms,
        model_cache_state="not_downloaded" if health.provider_id in {"funasr", "faster_whisper"} else None,
        readiness=payload.config.readiness.model_copy(
            update={
                "active_allowed": False,
                "health_check_passed": health.state == "ok",
                "test_transcription_passed": False,
                "fingerprint": compute_stt_readiness_fingerprint(payload.config),
                "invalidation_reason": "test_failed",
            }
        ),
        summary=health.summary,
        failure=health,
        redacted_diagnostics=diagnostics,
    )


def _cloud_stt_required_input_health(config: STTProviderConfig, provider_id: str) -> AudioProviderHealth | None:
    if provider_id not in {"openai", "groq"}:
        return None
    cloud = config.cloud.get(provider_id)
    if cloud is None or not cloud.consent_granted:
        return AudioProviderHealth(
            provider_id=provider_id,
            kind="stt",
            state="misconfigured",
            summary="Cloud STT is blocked until explicit consent is saved.",
            retryable=False,
            redacted_diagnostics={"provider": provider_id, "consent": "missing"},
        )
    if not cloud.api_key:
        return AudioProviderHealth(
            provider_id=provider_id,
            kind="stt",
            state="missing_credential",
            summary="Cloud STT API key is required before voice input can run.",
            retryable=False,
            redacted_diagnostics={"provider": provider_id, "credential": "missing"},
        )
    return None


def _inactive_stt_readiness(config: STTProviderConfig, reason: str) -> STTProviderReadiness:
    readiness = validate_stt_readiness(config)
    return readiness.model_copy(
        update={
            "active_allowed": False,
            "health_check_passed": False if reason == "runtime_failure" else readiness.health_check_passed,
            "test_transcription_passed": False if reason == "runtime_failure" else readiness.test_transcription_passed,
            "fingerprint": compute_stt_readiness_fingerprint(config),
            "invalidation_reason": reason,
        }
    )


def _missing_local_model_health(provider_id: str) -> AudioProviderHealth:
    return AudioProviderHealth(
        provider_id=provider_id,
        kind="stt",
        state="misconfigured",
        summary="Local STT model is not downloaded in the app-managed cache.",
        retryable=False,
        redacted_diagnostics={"model_cache": "not_downloaded"},
    )


def _voice_input_readiness(request: Request, payload: VoiceInputReadinessRequest) -> VoiceInputReadiness:
    config = payload.config
    provider_id = config.active_provider
    permission_state = payload.permission_state
    if permission_state == "denied":
        return VoiceInputReadiness(
            ready=False,
            capture_status="permission_needed",
            stt_enabled=config.enabled,
            provider_id=provider_id,
            blocked_reason="permission_needed",
            setup_destination="microphone_permission",
            permission_state=permission_state,
            readiness=validate_stt_readiness(config),
            summary="Microphone permission is denied.",
        )
    if permission_state in {"unavailable", "no_input_device"}:
        return VoiceInputReadiness(
            ready=False,
            capture_status="error",
            stt_enabled=config.enabled,
            provider_id=provider_id,
            blocked_reason="microphone_unavailable",
            setup_destination="microphone_permission",
            permission_state=permission_state,
            readiness=validate_stt_readiness(config),
            summary="Microphone input is unavailable.",
        )
    if permission_state == "unexpected_failure":
        return VoiceInputReadiness(
            ready=False,
            capture_status="error",
            stt_enabled=config.enabled,
            provider_id=provider_id,
            blocked_reason="unexpected_failure",
            setup_destination="microphone_permission",
            permission_state=permission_state,
            readiness=validate_stt_readiness(config),
            summary="Microphone permission status could not be checked.",
        )
    if permission_state == "prompt":
        return VoiceInputReadiness(
            ready=False,
            capture_status="permission_needed",
            stt_enabled=config.enabled,
            provider_id=provider_id,
            blocked_reason="permission_denied",
            setup_destination="microphone_permission",
            permission_state=permission_state,
            readiness=validate_stt_readiness(config),
            summary="Microphone permission is required before voice input can start.",
        )
    if not config.enabled:
        return VoiceInputReadiness(
            ready=False,
            capture_status="idle",
            stt_enabled=False,
            provider_id=provider_id,
            blocked_reason="stt_disabled",
            setup_destination="voice_settings",
            permission_state=permission_state,
            readiness=validate_stt_readiness(config),
            summary="Voice input is disabled in Voice settings.",
        )
    if provider_id is None:
        return VoiceInputReadiness(
            ready=False,
            capture_status="idle",
            stt_enabled=True,
            provider_id=None,
            blocked_reason="provider_not_selected",
            setup_destination="voice_settings",
            permission_state=permission_state,
            readiness=validate_stt_readiness(config),
            summary="Select an STT provider before using voice input.",
        )
    readiness = validate_stt_readiness(config)
    if provider_id in {"funasr", "faster_whisper"} and _local_model_status(request, config) != "downloaded":
        missing_model = _missing_local_model_health(provider_id)
        return VoiceInputReadiness(
            ready=False,
            capture_status="idle",
            stt_enabled=True,
            provider_id=provider_id,
            blocked_reason="readiness_not_active",
            setup_destination="voice_settings",
            permission_state=permission_state,
            readiness=_inactive_stt_readiness(config, "missing_model"),
            summary=missing_model.summary,
        )
    cloud_required_health = _cloud_stt_required_input_health(config, provider_id)
    if cloud_required_health is not None:
        return VoiceInputReadiness(
            ready=False,
            capture_status="idle",
            stt_enabled=True,
            provider_id=provider_id,
            blocked_reason="readiness_not_active",
            setup_destination="voice_settings",
            permission_state=permission_state,
            readiness=_inactive_stt_readiness(
                config,
                "missing_credential" if cloud_required_health.state == "missing_credential" else "config_changed",
            ),
            summary=cloud_required_health.summary,
        )
    return VoiceInputReadiness(
        ready=True,
        capture_status="idle",
        stt_enabled=True,
        provider_id=provider_id,
        blocked_reason=None,
        setup_destination=None,
        permission_state=permission_state,
        readiness=readiness,
        summary="Voice input is ready.",
    )


def _voice_input_failure_result(
    payload: VoiceInputTranscriptionRequest,
    readiness: VoiceInputReadiness,
    health: AudioProviderHealth | None = None,
    diagnostics: dict[str, str] | None = None,
) -> VoiceInputTranscriptionResult:
    return VoiceInputTranscriptionResult(
        ok=False,
        mode=payload.mode,
        sequence_id=payload.sequence_id,
        transcript=None,
        is_final=payload.mode == "final",
        provider_id=payload.config.active_provider,
        duration_ms=payload.duration_ms,
        latency_ms=None,
        readiness=readiness,
        summary=health.summary if health else readiness.summary,
        failure=health,
        redacted_diagnostics=diagnostics,
    )


def _pcm_to_wav_base64(pcm_int16: bytes, sample_rate: int) -> tuple[str, int]:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_int16)
    duration_ms = int((len(pcm_int16) / 2) / sample_rate * 1000) if sample_rate > 0 else 0
    return base64.b64encode(buf.getvalue()).decode("utf-8"), duration_ms


def _managed_reference_root() -> Path | None:
    user_data = os.environ.get("AGENTICLLMVTUBER_USER_DATA")
    if not user_data:
        return None
    return (Path(user_data) / "reference-audio").resolve()


def _is_under_root(candidate: Path, root: Path) -> bool:
    try:
        candidate.resolve().relative_to(root)
        return True
    except ValueError:
        return False


def _validate_managed_reference_path(candidate: Path) -> dict[str, object] | None:
    root = _managed_reference_root()
    if root is None:
        return None
    if not _is_under_root(candidate, root):
        return _error_response(
            display_basename=candidate.name,
            code="unreadable_file",
            message="Reference audio path is outside managed storage.",
            diagnostic="managed path token rejected",
            audio_format=candidate.suffix.lower().lstrip(".") or None,
        )
    return None


@router.get("/status")
async def get_audio_status(request: Request) -> dict[str, object]:
    health = getattr(request.app.state, "audio_provider_health", None)
    if isinstance(health, AudioProviderHealth):
        return health.model_dump()
    gateway = getattr(request.app.state, "tts_gateway", None)
    provider = getattr(gateway, "provider", None)
    if provider is not None and hasattr(provider, "health"):
        return provider.health().model_dump()
    return _fallback_health(request).model_dump()


@router.get("/providers")
async def get_audio_providers() -> dict[str, object]:
    return _provider_catalog().model_dump()


@router.post("/stt/test")
async def post_stt_test(request: Request, payload: STTTestRequest) -> dict[str, object]:
    health = _stt_provider_health(payload.config)
    diagnostics = redact_audio_diagnostics(
        {
            "provider": health.provider_id,
            "sample_label": payload.sample_label or "none",
            "summary": health.summary,
            "api_key": payload.config.cloud.get(health.provider_id).api_key
            if health.provider_id in {"openai", "groq"} and payload.config.cloud.get(health.provider_id)
            else "",
        }
    )
    redacted_diagnostics = {str(key): str(value) for key, value in diagnostics.items()}
    if health.state not in {"ok", "unavailable"} and health.provider_id in {"openai", "groq"}:
        return _stt_failure_result(payload, health, redacted_diagnostics).model_dump()
    if not payload.audio_base64_wav:
        return _stt_failure_result(payload, health, redacted_diagnostics).model_dump()
    provider_id = payload.config.active_provider or "funasr"
    if provider_id in {"funasr", "faster_whisper"} and _local_model_status(request, payload.config) != "downloaded":
        missing_model = AudioProviderHealth(
            provider_id=provider_id,
            kind="stt",
            state="misconfigured",
            summary="Local STT model is not downloaded in the app-managed cache.",
            retryable=False,
            redacted_diagnostics={"model_cache": "not_downloaded"},
        )
        return _stt_failure_result(payload, missing_model, redacted_diagnostics).model_dump()
    try:
        provider_config = _config_with_resolved_local_model_path(request, payload.config)
        try:
            runtime_health = await _run_stt_worker(payload.config, _validate_stt_runtime, provider_config)
        except asyncio.TimeoutError:
            _evict_stt_provider(provider_config)
            failure = _stt_timeout_health(payload.config, "runtime")
            return _stt_failure_result(payload, failure, failure.redacted_diagnostics).model_dump()
        if runtime_health is not None:
            return _stt_failure_result(payload, runtime_health, runtime_health.redacted_diagnostics).model_dump()
        audio_bytes, sample_rate, duration_ms = _decode_wav_payload(payload)
        stt_result = await _run_stt_worker(
            payload.config,
            _transcribe_with_provider,
            provider_config,
            STTRequest(
                audio_bytes=audio_bytes,
                sample_rate_hz=sample_rate,
                duration_ms=payload.duration_ms or duration_ms,
                language_mode=payload.config.language_mode,
                provider_id=provider_id,
                model_id=_local_model_id(payload.config) if provider_id in {"funasr", "faster_whisper"} else None,
            ),
        )
        result = STTTestResult(
            ok=True,
            provider_id=provider_id,
            transcript=stt_result.text,
            language=stt_result.language,
            latency_ms=stt_result.latency_ms,
            duration_ms=payload.duration_ms,
            model_cache_state=_local_model_status(request, payload.config) if provider_id in {"funasr", "faster_whisper"} else None,
            summary="STT test transcription succeeded.",
            failure=None,
            redacted_diagnostics=stt_result.redacted_diagnostics,
        )
        result.readiness = readiness_from_test_result(payload.config, result)
        return result.model_dump()
    except ValueError:
        return _stt_failure_result(payload, _invalid_wav_health(provider_id), redacted_diagnostics).model_dump()
    except asyncio.TimeoutError:
        _evict_stt_provider(provider_config)
        failure = _stt_timeout_health(payload.config, "transcription")
        return _stt_failure_result(payload, failure, failure.redacted_diagnostics).model_dump()
    except STTProviderError as exc:
        return _stt_failure_result(payload, exc.health(), exc.redacted_diagnostics).model_dump()
    except Exception as exc:
        failure = AudioProviderHealth(
            provider_id=provider_id,
            kind="stt",
            state="external_service_failure",
            summary="STT test transcription failed.",
            retryable=True,
            redacted_diagnostics={"error_type": type(exc).__name__},
        )
        return _stt_failure_result(payload, failure, failure.redacted_diagnostics).model_dump()


@router.post("/stt/health")
async def post_stt_health(payload: STTTestRequest) -> dict[str, object]:
    health = _stt_provider_health(payload.config)
    return health.model_dump()


@router.post("/stt/readiness")
async def post_stt_readiness(request: Request, payload: STTTestRequest) -> dict[str, object]:
    readiness = validate_stt_readiness(payload.config)
    if readiness.active_allowed:
        _schedule_local_stt_warmup(request, payload.config)
    return readiness.model_dump()


@router.post("/stt/enable")
async def post_stt_enable(request: Request, payload: STTTestRequest) -> dict[str, object]:
    readiness = validate_stt_readiness(payload.config)
    provider_id = payload.config.active_provider or "funasr"
    cloud_required_health = _cloud_stt_required_input_health(payload.config, provider_id)
    enabled_readiness = readiness.model_copy(
        update={
            "fingerprint": compute_stt_readiness_fingerprint(payload.config),
            "active_allowed": cloud_required_health is None,
            "invalidation_reason": "ready" if cloud_required_health is None else "config_changed",
        }
    )
    if enabled_readiness.active_allowed:
        _schedule_local_stt_warmup(request, payload.config)
    return enabled_readiness.model_dump()


@router.post("/voice-input/readiness")
async def post_voice_input_readiness(request: Request, payload: VoiceInputReadinessRequest) -> dict[str, object]:
    readiness = _voice_input_readiness(request, payload)
    if readiness.ready:
        _schedule_local_stt_warmup(request, payload.config)
    return readiness.model_dump()


@router.post("/voice-input")
async def post_voice_input(request: Request, payload: VoiceInputTranscriptionRequest) -> dict[str, object]:
    readiness = _voice_input_readiness(
        request,
        VoiceInputReadinessRequest(config=payload.config, permission_state="granted")
    )
    if not readiness.ready:
        return _voice_input_failure_result(payload, readiness).model_dump()
    provider_id = payload.config.active_provider or "funasr"
    if provider_id in {"funasr", "faster_whisper"} and _local_model_status(request, payload.config) != "downloaded":
        missing_model = _missing_local_model_health(provider_id)
        blocked = readiness.model_copy(
            update={
                "ready": False,
                "capture_status": "error",
                "blocked_reason": "readiness_not_active",
                "setup_destination": "voice_settings",
                "readiness": _inactive_stt_readiness(payload.config, "missing_model"),
                "summary": missing_model.summary,
            }
        )
        return _voice_input_failure_result(payload, blocked, missing_model, missing_model.redacted_diagnostics).model_dump()
    try:
        provider_config = _config_with_resolved_local_model_path(request, payload.config)
        try:
            runtime_health = await _run_stt_worker(payload.config, _validate_stt_runtime, provider_config)
        except asyncio.TimeoutError:
            _evict_stt_provider(provider_config)
            failure = _stt_timeout_health(payload.config, "runtime")
            failed_readiness = readiness.model_copy(
                update={
                    "ready": False,
                    "capture_status": "error",
                    "blocked_reason": "unexpected_failure",
                    "setup_destination": "voice_settings",
                    "readiness": _inactive_stt_readiness(payload.config, "runtime_failure"),
                    "summary": failure.summary,
                }
            )
            return _voice_input_failure_result(payload, failed_readiness, failure, failure.redacted_diagnostics).model_dump()
        if runtime_health is not None:
            failed_readiness = readiness.model_copy(
                update={
                    "ready": False,
                    "capture_status": "error",
                    "blocked_reason": "unexpected_failure",
                    "setup_destination": "voice_settings",
                    "readiness": _inactive_stt_readiness(payload.config, "runtime_failure"),
                    "summary": runtime_health.summary,
                }
            )
            return _voice_input_failure_result(payload, failed_readiness, runtime_health, runtime_health.redacted_diagnostics).model_dump()
        audio_bytes, sample_rate, duration_ms = _decode_wav_payload(payload)
        stt_result = await _run_stt_worker(
            payload.config,
            _transcribe_with_provider,
            provider_config,
            STTRequest(
                audio_bytes=audio_bytes,
                sample_rate_hz=sample_rate,
                duration_ms=payload.duration_ms or duration_ms,
                language_mode=payload.config.language_mode,
                provider_id=provider_id,
                model_id=_local_model_id(payload.config) if provider_id in {"funasr", "faster_whisper"} else None,
            ),
        )
        return VoiceInputTranscriptionResult(
            ok=True,
            mode=payload.mode,
            sequence_id=payload.sequence_id,
            transcript=stt_result.text,
            is_final=payload.mode == "final",
            provider_id=provider_id,
            duration_ms=payload.duration_ms,
            latency_ms=stt_result.latency_ms,
            readiness=readiness,
            summary="Voice input transcription succeeded.",
            failure=None,
            redacted_diagnostics=stt_result.redacted_diagnostics,
        ).model_dump()
    except ValueError:
        failure = _invalid_wav_health(provider_id)
        failed_readiness = readiness.model_copy(
            update={
                "ready": False,
                "capture_status": "error",
                "blocked_reason": "unexpected_failure",
                "setup_destination": "voice_settings",
                "readiness": _inactive_stt_readiness(payload.config, "test_failed"),
                "summary": failure.summary,
            }
        )
        return _voice_input_failure_result(payload, failed_readiness, failure, failure.redacted_diagnostics).model_dump()
    except asyncio.TimeoutError:
        _evict_stt_provider(provider_config)
        failure = _stt_timeout_health(payload.config, "transcription")
        failed_readiness = readiness.model_copy(
            update={
                "ready": False,
                "capture_status": "error",
                "blocked_reason": "unexpected_failure",
                "setup_destination": "voice_settings",
                "readiness": _inactive_stt_readiness(payload.config, "runtime_failure"),
                "summary": failure.summary,
            }
        )
        return _voice_input_failure_result(payload, failed_readiness, failure, failure.redacted_diagnostics).model_dump()
    except STTProviderError as exc:
        failed_readiness = readiness.model_copy(
            update={
                "ready": False,
                "capture_status": "error",
                "blocked_reason": "unexpected_failure",
                "setup_destination": "voice_settings",
                "readiness": _inactive_stt_readiness(payload.config, "runtime_failure"),
                "summary": exc.summary,
            }
        )
        return _voice_input_failure_result(payload, failed_readiness, exc.health(), exc.redacted_diagnostics).model_dump()
    except Exception as exc:
        failure = AudioProviderHealth(
            provider_id=provider_id,
            kind="stt",
            state="external_service_failure",
            summary="Voice input transcription failed.",
            retryable=True,
            redacted_diagnostics={"error_type": type(exc).__name__},
        )
        failed_readiness = readiness.model_copy(
            update={
                "ready": False,
                "capture_status": "error",
                "blocked_reason": "unexpected_failure",
                "setup_destination": "voice_settings",
                "readiness": _inactive_stt_readiness(payload.config, "runtime_failure"),
                "summary": failure.summary,
            }
        )
        return _voice_input_failure_result(payload, failed_readiness, failure, failure.redacted_diagnostics).model_dump()


@router.post("/stt/models")
async def post_stt_models(request: Request, payload: STTTestRequest) -> dict[str, object]:
    return _stt_model_cache(request, payload.config).catalog().model_dump()


@router.post("/stt/models/download")
async def post_stt_model_download(request: Request, payload: STTModelCacheOperationRequest) -> dict[str, object]:
    result = await asyncio.to_thread(STTModelCache(cache_root=payload.cache_root).download, payload.provider_id, payload.model_id)
    return result.model_dump()


@router.post("/stt/models/remove")
async def post_stt_model_remove(request: Request, payload: STTModelCacheOperationRequest) -> dict[str, object]:
    return STTModelCache(cache_root=payload.cache_root).remove(payload.provider_id, payload.model_id).model_dump()


@router.post("/gpt-sovits/health")
async def post_gpt_sovits_health(payload: GptSoVitsHealthCandidateRequest) -> dict[str, object]:
    try:
        provider = GptSoVitsProvider(
            config=payload.config,
            preset=payload.preset,
            reference_audio="health-check.wav",
        )
    except TTSProviderError as exc:
        return exc.health().model_dump()
    return provider.health().model_dump()


@router.post("/test-synthesis")
async def post_test_synthesis(payload: GptSoVitsCandidateRequest) -> dict[str, object]:
    path_guard = _validate_managed_reference_path(Path(payload.reference_audio_path))
    if path_guard is not None:
        return {
            "provider_id": "gpt_sovits",
            "ok": False,
            "activation_allowed": False,
            "audio_base64": None,
            "media_type": "wav",
            "sample_rate_hz": None,
            "duration_ms": None,
            "summary": "GPT-SoVITS could not read the copied reference audio.",
            "failure": AudioProviderHealth(
                provider_id="gpt_sovits",
                kind="tts",
                state="misconfigured",
                summary="Reference audio path is outside managed storage.",
                retryable=False,
            ).model_dump(),
        }
    try:
        provider = GptSoVitsProvider(
            config=payload.config,
            preset=payload.preset,
            reference_audio=payload.reference_audio_path,
        )
        result = provider.synthesize(
            TTSSynthesisRequest(text=payload.text, sentence_id=-1)
        )
        audio_base64, duration_ms = _pcm_to_wav_base64(result.pcm_int16, result.sample_rate)
        return {
            "provider_id": "gpt_sovits",
            "ok": True,
            "activation_allowed": True,
            "audio_base64": audio_base64,
            "media_type": "wav",
            "sample_rate_hz": result.sample_rate,
            "duration_ms": duration_ms,
            "summary": "GPT-SoVITS test synthesis succeeded.",
            "failure": None,
        }
    except TTSProviderError as exc:
        return {
            "provider_id": "gpt_sovits",
            "ok": False,
            "activation_allowed": False,
            "audio_base64": None,
            "media_type": "wav",
            "sample_rate_hz": None,
            "duration_ms": None,
            "summary": exc.summary,
            "failure": exc.health().model_dump(),
        }


@router.post("/reference-audio/validate")
async def validate_reference_audio(
    payload: ReferenceAudioValidationRequest,
) -> dict[str, object]:
    candidate = Path(payload.managed_path)
    path_guard = _validate_managed_reference_path(candidate)
    if path_guard is not None:
        return path_guard
    audio_format = candidate.suffix.lower().lstrip(".")
    display_basename = Path(payload.display_basename).name

    if audio_format not in SUPPORTED_REFERENCE_AUDIO_FORMATS:
        return _error_response(
            display_basename=display_basename,
            code="unsupported_format",
            message="Reference audio format must be one of: wav, flac, mp3, ogg.",
            diagnostic=f"unsupported format {audio_format or '<none>'}",
            audio_format=audio_format or None,
        )
    if not candidate.exists():
        return _error_response(
            display_basename=display_basename,
            code="missing_file",
            message="Reference audio file does not exist.",
            diagnostic="managed file is missing",
            audio_format=audio_format,
        )
    if not candidate.is_file():
        return _error_response(
            display_basename=display_basename,
            code="unreadable_file",
            message="Reference audio path is not a readable file.",
            diagnostic="managed path is not a file",
            audio_format=audio_format,
        )
    try:
        info = soundfile.info(str(candidate))
    except Exception as exc:  # soundfile wraps libsndfile errors by platform.
        return _error_response(
            display_basename=display_basename,
            code="unreadable_metadata",
            message="Reference audio metadata could not be read.",
            diagnostic=f"soundfile.info failed: {type(exc).__name__}",
            audio_format=audio_format,
        )

    duration = _duration_seconds(info)
    sample_rate = getattr(info, "samplerate", None)
    channels = getattr(info, "channels", None)
    if duration is None or not isinstance(sample_rate, int) or not isinstance(channels, int):
        return _error_response(
            display_basename=display_basename,
            code="unreadable_metadata",
            message="Reference audio duration, sample rate, or channels could not be read.",
            diagnostic="soundfile metadata incomplete",
            audio_format=audio_format,
        )
    if duration < MIN_REFERENCE_AUDIO_SECONDS:
        return _error_response(
            display_basename=display_basename,
            code="duration_too_short",
            message="Reference audio must be at least 1 second long.",
            diagnostic=f"duration={duration:.3f}s below minimum",
            audio_format=audio_format,
        )
    if duration > MAX_REFERENCE_AUDIO_SECONDS:
        return _error_response(
            display_basename=display_basename,
            code="duration_too_long",
            message="Reference audio must be no longer than 30 seconds.",
            diagnostic=f"duration={duration:.3f}s above maximum",
            audio_format=audio_format,
        )

    return ReferenceAudioValidationResponse(
        ok=True,
        format=audio_format,
        duration_seconds=round(duration, 3),
        sample_rate=sample_rate,
        channels=channels,
        redacted_diagnostics=_redacted_diagnostics(
            display_basename,
            f"validated {audio_format}; duration={duration:.3f}s; sample_rate={sample_rate}; channels={channels}",
        ),
    ).model_dump()
