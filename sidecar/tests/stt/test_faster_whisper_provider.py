from __future__ import annotations

import sys
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTRequest
from sidecar.stt.providers.faster_whisper_provider import FasterWhisperSTTProvider


def test_faster_whisper_provider_lazy_import_and_fake_transcription(monkeypatch) -> None:
    sys.modules.pop("faster_whisper", None)
    cfg = STTProviderConfig(active_provider="faster_whisper", local_model_id="small", local_model_path_override="C:/cache/faster-whisper")
    provider = FasterWhisperSTTProvider(cfg)
    assert "faster_whisper" not in sys.modules
    constructor_calls: list[tuple[tuple, dict]] = []
    transcribe_inputs: list[object] = []

    class _WhisperModel:
        def __init__(self, *args, **kwargs) -> None:
            constructor_calls.append((args, kwargs))

        def transcribe(self, audio, *_args, **_kwargs):
            transcribe_inputs.append(audio)
            return [SimpleNamespace(text="hello local")], SimpleNamespace(language="en")

    monkeypatch.setitem(sys.modules, "faster_whisper", SimpleNamespace(WhisperModel=_WhisperModel))
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="faster_whisper"))

    assert result.text == "hello local"
    assert result.language == "en"
    assert constructor_calls[0][0][0] == "C:/cache/faster-whisper"
    assert hasattr(transcribe_inputs[0], "read")
    assert transcribe_inputs[0].read() == b"wav"
