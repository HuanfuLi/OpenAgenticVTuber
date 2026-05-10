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
GptSoVitsLanguage = Literal["zh", "en", "ja", "ko", "yue", "auto"]


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


class GptSoVitsLaunchConfig(BaseModel):
    mode: Literal["external", "app_managed"] = "external"
    command: Optional[str] = None
    working_directory: Optional[str] = None
    auto_start: bool = False


class GptSoVitsActivationGate(BaseModel):
    health_check_passed: bool = False
    test_synthesis_passed: bool = False
    last_health_checked_at: Optional[str] = None
    last_test_synthesis_at: Optional[str] = None
    active_allowed: bool = False


class GptSoVitsProviderConfig(BaseModel):
    provider_id: Literal["gpt_sovits"] = "gpt_sovits"
    enabled: bool = False
    base_url: str = Field(default="http://127.0.0.1:9880", min_length=1)
    request_timeout_ms: int = Field(default=30_000, ge=1_000)
    launch: GptSoVitsLaunchConfig = GptSoVitsLaunchConfig()
    activation: GptSoVitsActivationGate = GptSoVitsActivationGate()


class GptSoVitsHealthRequest(BaseModel):
    config: GptSoVitsProviderConfig
    preset: "VoicePreset"


class GptSoVitsTestSynthesisRequest(BaseModel):
    config: GptSoVitsProviderConfig
    preset: "VoicePreset"
    text: str = Field(min_length=1)


class GptSoVitsTestSynthesisResult(BaseModel):
    provider_id: Literal["gpt_sovits"] = "gpt_sovits"
    ok: bool
    audio_base64: Optional[str] = None
    media_type: Literal["wav"] = "wav"
    sample_rate_hz: Optional[int] = Field(default=None, ge=1)
    duration_ms: Optional[int] = Field(default=None, ge=0)
    summary: str
    failure: Optional[AudioProviderHealth] = None


class TTSProviderConfig(BaseModel):
    active_provider: Literal["piper", "gpt_sovits"] = "piper"
    piper: PiperTTSConfig = PiperTTSConfig()
    gpt_sovits: Optional[GptSoVitsProviderConfig] = None


class STTProviderConfig(BaseModel):
    enabled: bool = False
    active_provider: Optional[Literal["funasr", "faster_whisper", "openai", "groq"]] = None
    capture_timeout_ms: int = Field(default=30_000, ge=1_000)
    execution: Literal["off_event_loop"] = "off_event_loop"


class AudioConfig(BaseModel):
    schema_version: Literal[1] = 1
    tts: TTSProviderConfig = TTSProviderConfig()
    stt: STTProviderConfig = STTProviderConfig()


class AudioProviderContracts(BaseModel):
    audio_config: AudioConfig = AudioConfig()
    gpt_sovits_health_request: Optional[GptSoVitsHealthRequest] = None
    gpt_sovits_test_synthesis_request: Optional[GptSoVitsTestSynthesisRequest] = None
    gpt_sovits_test_synthesis_result: Optional[GptSoVitsTestSynthesisResult] = None


from .voice_preset import VoicePreset  # noqa: E402

GptSoVitsTestSynthesisRequest.model_rebuild()
GptSoVitsHealthRequest.model_rebuild()
AudioProviderContracts.model_rebuild()
