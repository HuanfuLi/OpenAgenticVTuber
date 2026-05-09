"""Audio provider config and health contracts for v3.0.

The app stays Piper-first in Phase 16. These contracts define the shared shape
for provider configuration and diagnostics without implementing future
providers.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


AudioProviderKind = Literal["tts", "stt"]
AudioProviderId = Literal[
    "piper",
    "gpt_sovits",
    "funasr",
    "faster_whisper",
    "openai",
    "groq",
]
AudioHealthState = Literal[
    "ok",
    "unavailable",
    "missing_credential",
    "external_service_failure",
    "timeout",
    "misconfigured",
]


class AudioProviderHealth(BaseModel):
    provider_id: AudioProviderId
    kind: AudioProviderKind
    state: AudioHealthState
    summary: str
    detail: Optional[str] = None
    retryable: bool = False
    latency_ms: Optional[float] = None
    redacted_diagnostics: Optional[dict[str, str]] = None


class PiperTTSConfig(BaseModel):
    provider_id: Literal["piper"] = "piper"
    voice_model: str = "en_US-amy-medium"
    output_device: Optional[str] = None
    synthesis_timeout_ms: int = Field(default=30_000, ge=1_000)
    execution: Literal["off_event_loop"] = "off_event_loop"
    ordered_playback: bool = True
    rms_lipsync: bool = True


class FutureTTSProviderConfig(BaseModel):
    provider_id: Literal["gpt_sovits"] = "gpt_sovits"
    enabled: bool = False


class TTSProviderConfig(BaseModel):
    active_provider: Literal["piper", "gpt_sovits"] = "piper"
    piper: PiperTTSConfig = PiperTTSConfig()
    gpt_sovits: Optional[FutureTTSProviderConfig] = None


class STTProviderConfig(BaseModel):
    enabled: bool = False
    active_provider: Optional[Literal["funasr", "faster_whisper", "openai", "groq"]] = None
    capture_timeout_ms: int = Field(default=30_000, ge=1_000)
    execution: Literal["off_event_loop"] = "off_event_loop"


class AudioConfig(BaseModel):
    schema_version: Literal[1] = 1
    tts: TTSProviderConfig = TTSProviderConfig()
    stt: STTProviderConfig = STTProviderConfig()
