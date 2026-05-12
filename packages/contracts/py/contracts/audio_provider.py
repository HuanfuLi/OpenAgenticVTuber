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
STTModelCacheStatus = Literal[
    "not_downloaded",
    "downloaded",
    "missing",
    "incomplete",
    "manual_path_required",
    "operation_pending",
]
STTReadinessInvalidationReason = Literal[
    "ready",
    "never_tested",
    "config_changed",
    "health_failed",
    "test_failed",
    "runtime_failure",
    "missing_model",
    "missing_credential",
    "missing_consent",
]
VoiceInputCaptureStatus = Literal[
    "idle",
    "permission_needed",
    "listening",
    "recording",
    "previewing",
    "finalizing",
    "queued",
    "error",
]
VoiceInputPermissionState = Literal[
    "unknown",
    "granted",
    "prompt",
    "denied",
    "unavailable",
    "no_input_device",
    "unexpected_failure",
]
VoiceInputBlockedReason = Literal[
    "stt_disabled",
    "provider_not_selected",
    "readiness_not_active",
    "permission_needed",
    "permission_denied",
    "microphone_unavailable",
    "sidecar_unavailable",
    "unexpected_failure",
]
VoiceInputTranscriptionMode = Literal["preview", "final"]


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
    recommended: bool = False
    default_model_id: Optional[str] = None
    supported_language_modes: list[STTLanguageMode] = Field(default_factory=list)
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
    local_model_id: Optional[str] = None
    local_model_path_override: Optional[str] = None
    cache_root: Optional[str] = None
    readiness: "STTProviderReadiness" = Field(default_factory=lambda: STTProviderReadiness())
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


class STTProviderReadiness(BaseModel):
    health_check_passed: bool = False
    test_transcription_passed: bool = False
    last_health_checked_at: Optional[str] = None
    last_test_transcription_at: Optional[str] = None
    fingerprint: Optional[str] = None
    active_allowed: bool = False
    invalidation_reason: STTReadinessInvalidationReason = "never_tested"


class STTModelCatalogEntry(BaseModel):
    provider_id: Literal["funasr", "faster_whisper"]
    model_id: str
    display_name: str
    source_label: str
    size_label: Optional[str] = None
    size_bytes: Optional[int] = Field(default=None, ge=0)
    cache_path_display: Optional[str] = None
    status: STTModelCacheStatus = "not_downloaded"
    app_managed: bool = True
    removable: bool = False
    loaded: bool = False
    recommended: bool = False
    summary: str


class STTModelCacheCatalog(BaseModel):
    cache_root_display: str
    models: list[STTModelCatalogEntry] = Field(default_factory=list)


class STTModelCacheOperationRequest(BaseModel):
    provider_id: Literal["funasr", "faster_whisper"]
    model_id: str
    cache_root: Optional[str] = None


class STTModelCacheOperationResult(BaseModel):
    ok: bool
    provider_id: Literal["funasr", "faster_whisper"]
    model_id: str
    status: STTModelCacheStatus
    summary: str
    cache_path_display: Optional[str] = None


class STTTestRequest(BaseModel):
    config: STTProviderConfig
    audio_base64_wav: Optional[str] = None
    duration_ms: Optional[int] = Field(default=None, ge=0)
    sample_label: Optional[str] = None


class STTTestResult(BaseModel):
    ok: bool
    provider_id: Literal["funasr", "faster_whisper", "openai", "groq"]
    transcript: Optional[str] = None
    language: Optional[str] = None
    latency_ms: Optional[float] = Field(default=None, ge=0)
    duration_ms: Optional[int] = Field(default=None, ge=0)
    model_cache_state: Optional[STTModelCacheStatus] = None
    readiness: Optional[STTProviderReadiness] = None
    summary: str
    failure: Optional[AudioProviderHealth] = None
    redacted_diagnostics: Optional[dict[str, str]] = None


class VoiceInputReadinessRequest(BaseModel):
    config: STTProviderConfig
    permission_state: VoiceInputPermissionState = "unknown"


class VoiceInputReadiness(BaseModel):
    ready: bool
    capture_status: VoiceInputCaptureStatus = "idle"
    stt_enabled: bool
    provider_id: Optional[Literal["funasr", "faster_whisper", "openai", "groq"]] = None
    blocked_reason: Optional[VoiceInputBlockedReason] = None
    setup_destination: Optional[Literal["voice_settings", "microphone_permission"]] = None
    permission_state: VoiceInputPermissionState = "unknown"
    readiness: Optional[STTProviderReadiness] = None
    summary: str


class VoiceInputTranscriptionRequest(BaseModel):
    config: STTProviderConfig
    audio_base64_wav: str = Field(min_length=1)
    duration_ms: int = Field(ge=0)
    sequence_id: str = Field(min_length=1)
    mode: VoiceInputTranscriptionMode
    session_id: Optional[str] = None


class VoiceInputTranscriptionResult(BaseModel):
    ok: bool
    mode: VoiceInputTranscriptionMode
    sequence_id: str
    transcript: Optional[str] = None
    is_final: bool
    provider_id: Optional[Literal["funasr", "faster_whisper", "openai", "groq"]] = None
    duration_ms: Optional[int] = Field(default=None, ge=0)
    latency_ms: Optional[float] = Field(default=None, ge=0)
    readiness: Optional[VoiceInputReadiness] = None
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
    stt_model_cache_catalog: STTModelCacheCatalog = STTModelCacheCatalog(cache_root_display="")
    stt_model_cache_operation_request: Optional[STTModelCacheOperationRequest] = None
    stt_model_cache_operation_result: Optional[STTModelCacheOperationResult] = None
    gpt_sovits_health_request: Optional[GptSoVitsHealthRequest] = None
    gpt_sovits_test_synthesis_request: Optional[GptSoVitsTestSynthesisRequest] = None
    gpt_sovits_test_synthesis_result: Optional[GptSoVitsTestSynthesisResult] = None
    stt_test_request: Optional[STTTestRequest] = None
    stt_test_result: Optional[STTTestResult] = None
    voice_input_readiness_request: Optional[VoiceInputReadinessRequest] = None
    voice_input_readiness: Optional[VoiceInputReadiness] = None
    voice_input_transcription_request: Optional[VoiceInputTranscriptionRequest] = None
    voice_input_transcription_result: Optional[VoiceInputTranscriptionResult] = None


from .voice_preset import VoicePreset  # noqa: E402

GptSoVitsTestSynthesisRequest.model_rebuild()
GptSoVitsHealthRequest.model_rebuild()
STTProviderConfig.model_rebuild()
STTTestRequest.model_rebuild()
STTTestResult.model_rebuild()
VoiceInputReadinessRequest.model_rebuild()
VoiceInputReadiness.model_rebuild()
VoiceInputTranscriptionRequest.model_rebuild()
VoiceInputTranscriptionResult.model_rebuild()
AudioProviderContracts.model_rebuild()
