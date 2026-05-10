from __future__ import annotations

import sys
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTRequest
from sidecar.stt.providers.funasr_provider import FunASRSTTProvider


def test_funasr_provider_lazy_import_and_fake_transcription(monkeypatch) -> None:
    sys.modules.pop("funasr", None)
    provider = FunASRSTTProvider(STTProviderConfig(active_provider="funasr", local_model_id="iic/SenseVoiceSmall"))
    assert "funasr" not in sys.modules

    class _AutoModel:
        def __init__(self, **kwargs) -> None:
            self.kwargs = kwargs

        def generate(self, **_kwargs):
            return [{"text": "你好 hello"}]

    monkeypatch.setitem(sys.modules, "funasr", SimpleNamespace(AutoModel=_AutoModel))
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="funasr"))

    assert result.text == "你好 hello"
    assert result.provider_id == "funasr"

