"""Audio provider status and reference-audio validation endpoints."""

from __future__ import annotations

import base64
import os
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
    VoicePreset,
)
from sidecar.audio.redaction import redact_audio_diagnostics
from sidecar.stt import STTModelCache, STTProviderRegistry
from sidecar.stt.readiness import compute_stt_readiness_fingerprint, validate_stt_readiness
from sidecar.tts.gpt_sovits_provider import GptSoVitsProvider
from sidecar.tts.provider import TTSProviderError, TTSSynthesisRequest


router = APIRouter(prefix="/admin/audio")

SUPPORTED_REFERENCE_AUDIO_FORMATS = {"wav", "flac", "mp3", "ogg"}
MIN_REFERENCE_AUDIO_SECONDS = 1.0
MAX_REFERENCE_AUDIO_SECONDS = 30.0
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
                summary="Cloud STT API key is required before any test request can run.",
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
async def post_stt_test(payload: STTTestRequest) -> dict[str, object]:
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
        redacted_diagnostics=redacted_diagnostics,
    ).model_dump()


@router.post("/stt/health")
async def post_stt_health(payload: STTTestRequest) -> dict[str, object]:
    health = _stt_provider_health(payload.config)
    return health.model_dump()


@router.post("/stt/readiness")
async def post_stt_readiness(payload: STTTestRequest) -> dict[str, object]:
    return validate_stt_readiness(payload.config).model_dump()


@router.post("/stt/enable")
async def post_stt_enable(payload: STTTestRequest) -> dict[str, object]:
    readiness = validate_stt_readiness(payload.config)
    if not readiness.active_allowed:
        return STTProviderReadiness(
            health_check_passed=readiness.health_check_passed,
            test_transcription_passed=readiness.test_transcription_passed,
            last_health_checked_at=readiness.last_health_checked_at,
            last_test_transcription_at=readiness.last_test_transcription_at,
            fingerprint=readiness.fingerprint,
            active_allowed=False,
            invalidation_reason=readiness.invalidation_reason,
        ).model_dump()
    return readiness.model_dump()


@router.post("/stt/models")
async def post_stt_models(request: Request, payload: STTTestRequest) -> dict[str, object]:
    return _stt_model_cache(request, payload.config).catalog().model_dump()


@router.post("/stt/models/download")
async def post_stt_model_download(request: Request, payload: STTModelCacheOperationRequest) -> dict[str, object]:
    return _stt_model_cache(request).download_placeholder(payload.provider_id, payload.model_id).model_dump()


@router.post("/stt/models/remove")
async def post_stt_model_remove(request: Request, payload: STTModelCacheOperationRequest) -> dict[str, object]:
    return _stt_model_cache(request).remove(payload.provider_id, payload.model_id).model_dump()


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
