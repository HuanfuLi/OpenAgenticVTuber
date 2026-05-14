from __future__ import annotations

import importlib
from dataclasses import dataclass
from typing import Callable

from contracts import AudioProviderCatalog, AudioProviderCatalogEntry, AudioProviderHealth, STTProviderConfig


ProviderFactory = Callable[[STTProviderConfig], object]


@dataclass(frozen=True)
class STTProviderDefinition:
    provider_id: str
    display_name: str
    local: bool
    recommended: bool
    default_model_id: str | None
    supported_language_modes: list[str]
    import_path: str
    class_name: str
    summary: str
    evidence_capabilities: list[str] | None = None

    @property
    def capabilities(self) -> list[str]:
        base = ["test_transcription"]
        if self.local:
            base.extend(["local", "requires_local_model"])
        else:
            base.extend(["cloud", "requires_api_key"])
        if "zh" in self.supported_language_modes and "en" in self.supported_language_modes:
            base.append("chinese_english")
        if self.evidence_capabilities:
            base.extend(self.evidence_capabilities)
        return base


PROVIDER_DEFINITIONS: dict[str, STTProviderDefinition] = {
    "funasr": STTProviderDefinition(
        provider_id="funasr",
        display_name="FunASR / SenseVoiceSmall",
        local=True,
        recommended=True,
        default_model_id="iic/SenseVoiceSmall",
        supported_language_modes=["auto", "zh", "en"],
        import_path="sidecar.stt.providers.funasr_provider",
        class_name="FunASRSTTProvider",
        summary="Recommended local provider for Chinese and English. Phase 21 scorecard evidence is tracked separately.",
    ),
    "faster_whisper": STTProviderDefinition(
        provider_id="faster_whisper",
        display_name="faster-whisper",
        local=True,
        recommended=False,
        default_model_id="small",
        supported_language_modes=["auto", "en"],
        import_path="sidecar.stt.providers.faster_whisper_provider",
        class_name="FasterWhisperSTTProvider",
        summary="Local fallback provider with CPU or NVIDIA CUDA runtime options.",
        evidence_capabilities=["limited_code_switch", "cuda_optional"],
    ),
    "openai": STTProviderDefinition(
        provider_id="openai",
        display_name="OpenAI STT",
        local=False,
        recommended=False,
        default_model_id="gpt-4o-transcribe",
        supported_language_modes=["auto", "zh", "en"],
        import_path="sidecar.stt.providers.openai_provider",
        class_name="OpenAISTTProvider",
        summary="Explicit opt-in cloud transcription provider.",
    ),
    "groq": STTProviderDefinition(
        provider_id="groq",
        display_name="Groq STT",
        local=False,
        recommended=False,
        default_model_id="whisper-large-v3-turbo",
        supported_language_modes=["auto", "zh", "en"],
        import_path="sidecar.stt.providers.groq_provider",
        class_name="GroqSTTProvider",
        summary="Explicit opt-in cloud transcription provider.",
    ),
}


class STTProviderRegistry:
    def __init__(self, definitions: dict[str, STTProviderDefinition] | None = None) -> None:
        self.definitions = definitions or PROVIDER_DEFINITIONS

    def catalog(self) -> AudioProviderCatalog:
        providers = [
            AudioProviderCatalogEntry(
                provider_id=definition.provider_id,
                kind="stt",
                display_name=definition.display_name,
                capabilities=definition.capabilities,
                local=definition.local,
                requires_api_key=not definition.local,
                requires_consent=not definition.local,
                enabled=True,
                recommended=definition.recommended,
                default_model_id=definition.default_model_id,
                supported_language_modes=definition.supported_language_modes,
                summary=definition.summary,
            )
            for definition in self.definitions.values()
        ]
        return AudioProviderCatalog(providers=providers)

    def health(self, config: STTProviderConfig) -> AudioProviderHealth:
        provider_id = config.active_provider or "funasr"
        definition = self.definitions.get(provider_id)
        if definition is None:
            return AudioProviderHealth(
                provider_id="funasr",
                kind="stt",
                state="misconfigured",
                summary=f"Unknown STT provider: {provider_id}",
                retryable=False,
            )
        if not definition.local:
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
                    summary="Cloud STT API key is required before transcription can run.",
                    retryable=False,
                    redacted_diagnostics={"provider": provider_id, "credential": "missing"},
                )
        return AudioProviderHealth(
            provider_id=provider_id,
            kind="stt",
            state="unavailable",
            summary="STT provider adapter is not loaded. Run an explicit health/test action first.",
            retryable=True,
            redacted_diagnostics={"provider": provider_id, "adapter": "lazy"},
        )

    def build_provider(self, config: STTProviderConfig) -> object:
        provider_id = config.active_provider or "funasr"
        definition = self.definitions[provider_id]
        module = importlib.import_module(definition.import_path)
        provider_cls = getattr(module, definition.class_name)
        return provider_cls(config)
