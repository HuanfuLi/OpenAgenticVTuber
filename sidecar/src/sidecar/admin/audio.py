"""Audio provider status and reference-audio validation endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
import soundfile

from contracts import AudioProviderHealth


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


@router.post("/reference-audio/validate")
async def validate_reference_audio(
    payload: ReferenceAudioValidationRequest,
) -> dict[str, object]:
    candidate = Path(payload.managed_path)
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
