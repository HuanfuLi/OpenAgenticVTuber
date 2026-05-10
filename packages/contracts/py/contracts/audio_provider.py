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
AudioProviderCapability = Literal[
    "local",
    "cloud",
    "requires_api_key",
    "requires_external_service",
    "requires_local_model",
    "test_synthesis",
    "test_transcription",
    "chinese_english",
]
STTInputMode = Literal["push_to_talk", "vad"]
STTLanguageMode = Literal["auto", "zh", "en"]


class AudioProviderHealth(BaseModel):
    provider_id: AudioProviderId
    kind: AudioProviderKind
    state: AudioHealthState
    summary: str
    detail: Optional[str] = None
    retryable: bool = False
    latency_ms: Optional[float] = None
    redacted_diagnostics: Optional[dict[str, str]] = None


class AudioProviderCatalogEntry(BaseModel):
    provider_id: AudioProviderId
    kind: AudioProviderKind
    display_name: str
    capabilities: list[AudioProviderCapability] = Field(default_factory=list)
    local: bool
    requires_api_key: bool = False
    requires_consent: bool = False
    enabled: bool = True
    summary: str


class AudioProviderCatalog(BaseModel):
    providers: list[AudioProviderCatalogEntry] = Field(default_factory=list)


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
    input_mode: STTInputMode = "push_to_talk"
    language_mode: STTLanguageMode = "auto"
    capture_timeout_ms: int = Field(default=30_000, ge=1_000)
    execution: Literal["off_event_loop"] = "off_event_loop"
    cloud: dict[Literal["openai", "groq"], "CloudSTTProviderSettings"] = Field(
        default_factory=lambda: {
            "openai": CloudSTTProviderSettings(provider_id="openai"),
            "groq": CloudSTTProviderSettings(provider_id="groq"),
        }
    )


class CloudSTTProviderSettings(BaseModel):
    provider_id: Literal["openai", "groq"]
    consent_granted: bool = False
    api_key: Optional[str] = None
    endpoint_url: Optional[str] = None
    model_name: Optional[str] = None


class AudioDiagnosticsConfig(BaseModel):
    redact_diagnostics: bool = True


class STTTestRequest(BaseModel):
    config: STTProviderConfig
    sample_label: Optional[str] = None


class STTTestResult(BaseModel):
    ok: bool
    provider_id: Literal["funasr", "faster_whisper", "openai", "groq"]
    summary: str
    failure: Optional[AudioProviderHealth] = None
    redacted_diagnostics: Optional[dict[str, str]] = None


class AudioConfig(BaseModel):
    schema_version: Literal[1] = 1
    tts: TTSProviderConfig = TTSProviderConfig()
    stt: STTProviderConfig = STTProviderConfig()
    diagnostics: AudioDiagnosticsConfig = AudioDiagnosticsConfig()


class AudioProviderContracts(BaseModel):
    audio_config: AudioConfig = AudioConfig()
    audio_provider_catalog: AudioProviderCatalog = AudioProviderCatalog()
    gpt_sovits_health_request: Optional[GptSoVitsHealthRequest] = None
    gpt_sovits_test_synthesis_request: Optional[GptSoVitsTestSynthesisRequest] = None
    gpt_sovits_test_synthesis_result: Optional[GptSoVitsTestSynthesisResult] = None
    stt_test_request: Optional[STTTestRequest] = None
    stt_test_result: Optional[STTTestResult] = None


from .voice_preset import VoicePreset  # noqa: E402

GptSoVitsTestSynthesisRequest.model_rebuild()
GptSoVitsHealthRequest.model_rebuild()
STTProviderConfig.model_rebuild()
AudioProviderContracts.model_rebuild()
