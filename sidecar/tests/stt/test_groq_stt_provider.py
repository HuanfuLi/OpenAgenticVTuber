from __future__ import annotations

import sys
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTRequest
from sidecar.stt.providers.groq_provider import GroqSTTProvider


def test_groq_provider_blocks_without_consent_or_key() -> None:
    cfg = STTProviderConfig(active_provider="groq")
    provider = GroqSTTProvider(cfg)

    assert provider.health().state == "misconfigured"
    cfg.cloud["groq"].consent_granted = True
    assert provider.health().state == "missing_credential"


def test_groq_provider_uses_transcription_endpoint(monkeypatch) -> None:
    calls: list[dict] = []

    class _Transcriptions:
        def create(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(text="groq transcript")

    class _Groq:
        def __init__(self, **_kwargs) -> None:
            self.audio = SimpleNamespace(transcriptions=_Transcriptions())

    monkeypatch.setitem(sys.modules, "groq", SimpleNamespace(Groq=_Groq))
    cfg = STTProviderConfig(active_provider="groq")
    cfg.cloud["groq"].consent_granted = True
    cfg.cloud["groq"].api_key = "gsk-secret"
    provider = GroqSTTProvider(cfg)
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="groq"))

    assert result.text == "groq transcript"
    assert calls[0]["model"] == "whisper-large-v3-turbo"

