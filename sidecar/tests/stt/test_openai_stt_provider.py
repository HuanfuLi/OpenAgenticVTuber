from __future__ import annotations

import sys
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTRequest
from sidecar.stt.providers.openai_provider import OpenAISTTProvider


def test_openai_provider_blocks_without_consent_or_key() -> None:
    cfg = STTProviderConfig(active_provider="openai")
    provider = OpenAISTTProvider(cfg)

    assert provider.health().state == "misconfigured"
    cfg.cloud["openai"].consent_granted = True
    assert provider.health().state == "missing_credential"


def test_openai_provider_uses_transcription_endpoint(monkeypatch) -> None:
    calls: list[dict] = []

    class _Transcriptions:
        def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(text="cloud transcript")

    class _OpenAI:
        def __init__(self, **_kwargs) -> None:
            self.audio = SimpleNamespace(transcriptions=_Transcriptions())

    monkeypatch.setitem(sys.modules, "openai", SimpleNamespace(OpenAI=_OpenAI))
    cfg = STTProviderConfig(active_provider="openai")
    cfg.cloud["openai"].consent_granted = True
    cfg.cloud["openai"].api_key = "sk-secret"
    provider = OpenAISTTProvider(cfg)
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="openai"))

    assert result.text == "cloud transcript"
    assert calls[0]["model"] == "gpt-4o-mini-transcribe"

