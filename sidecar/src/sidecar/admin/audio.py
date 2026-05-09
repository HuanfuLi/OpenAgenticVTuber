"""Audio provider status endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from contracts import AudioProviderHealth


router = APIRouter(prefix="/admin/audio")


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
