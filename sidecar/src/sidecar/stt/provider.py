from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from contracts import AudioHealthState, AudioProviderHealth


@dataclass(frozen=True)
class STTRequest:
    audio_bytes: bytes
    sample_rate_hz: int
    duration_ms: int
    language_mode: str = "auto"
    provider_id: str = "funasr"
    model_id: str | None = None
    prompt: str | None = None


@dataclass(frozen=True)
class STTResult:
    text: str
    language: str | None
    latency_ms: float | None
    provider_id: str
    model_id: str | None = None
    redacted_diagnostics: dict[str, str] = field(default_factory=dict)


class STTProviderError(Exception):
    def __init__(
        self,
        *,
        provider_id: str,
        state: AudioHealthState,
        summary: str,
        retryable: bool = False,
        redacted_diagnostics: dict[str, str] | None = None,
    ) -> None:
        super().__init__(summary)
        self.provider_id = provider_id
        self.state = state
        self.summary = summary
        self.retryable = retryable
        self.redacted_diagnostics = redacted_diagnostics or {}

    def health(self) -> AudioProviderHealth:
        return AudioProviderHealth(
            provider_id=self.provider_id,
            kind="stt",
            state=self.state,
            summary=self.summary,
            retryable=self.retryable,
            redacted_diagnostics=self.redacted_diagnostics or None,
        )


class STTProvider(Protocol):
    provider_id: str

    def health(self) -> AudioProviderHealth:
        ...

    def ensure_loaded(self) -> None:
        ...

    def transcribe(self, request: STTRequest) -> STTResult:
        ...

    def shutdown(self) -> None:
        ...

