from __future__ import annotations

import sys
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTRequest
from sidecar.stt.providers.faster_whisper_provider import FasterWhisperSTTProvider


def test_faster_whisper_provider_lazy_import_and_fake_transcription(monkeypatch) -> None:
    sys.modules.pop("faster_whisper", None)
    provider = FasterWhisperSTTProvider(STTProviderConfig(active_provider="faster_whisper", local_model_id="small"))
    assert "faster_whisper" not in sys.modules

    class _WhisperModel:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def transcribe(self, *_args, **_kwargs):
            return [SimpleNamespace(text="hello local")], SimpleNamespace(language="en")

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=_WhisperModel))
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="faster_whisper"))

    assert result.text == "hello local"
    assert result.language == "en"

