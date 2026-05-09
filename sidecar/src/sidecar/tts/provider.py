from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from contracts import AudioProviderHealth


@dataclass(frozen=True)
class TTSSynthesisRequest:
    text: str
    sentence_id: int


@dataclass(frozen=True)
class TTSSynthesisResult:
    pcm_int16: bytes
    sample_rate: int
    provider_id: str = "piper"


class TTSProviderError(RuntimeError):
    def __init__(
        self,
        *,
        provider_id: str,
        state: str,
        summary: str,
        retryable: bool = False,
        detail: str | None = None,
    ) -> None:
        super().__init__(summary)
        self.provider_id = provider_id
        self.state = state
        self.summary = summary
        self.retryable = retryable
        self.detail = detail

    def health(self) -> AudioProviderHealth:
        return AudioProviderHealth(
            provider_id=self.provider_id,
            kind="tts",
            state=self.state,
            summary=self.summary,
            detail=self.detail,
            retryable=self.retryable,
        )


class TTSProvider(Protocol):
    provider_id: str
    sample_rate: int

    def boot(self) -> None:
        ...

    def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
        ...

    def health(self) -> AudioProviderHealth:
        ...

    def shutdown(self) -> None:
        ...
