from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

from contracts import STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest
from sidecar.stt.providers.funasr_provider import FunASRSTTProvider, _extract_text


def test_funasr_provider_lazy_import_and_fake_transcription(monkeypatch) -> None:
    sys.modules.pop("funasr", None)
    cfg = STTProviderConfig(active_provider="funasr", local_model_id="iic/SenseVoiceSmall", local_model_path_override="C:/cache/funasr")
    provider = FunASRSTTProvider(cfg)
    assert "funasr" not in sys.modules
    constructor_calls: list[dict] = []
    generate_inputs: list[str] = []

    class _AutoModel:
        def __init__(self, **kwargs) -> None:
            constructor_calls.append(kwargs)
            self.kwargs = kwargs

        def generate(self, **kwargs):
            path = str(kwargs["input"])
            generate_inputs.append(path)
            assert Path(path).read_bytes() == b"wav"
            return [{"text": "你好 hello"}]

    monkeypatch.setitem(sys.modules, "funasr", SimpleNamespace(AutoModel=_AutoModel))
    result = provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="funasr"))

    assert result.text == "你好 hello"
    assert result.provider_id == "funasr"
    assert constructor_calls[0]["model"] == "C:/cache/funasr"
    assert generate_inputs
    assert not Path(generate_inputs[0]).exists()


def test_funasr_provider_strips_sensevoice_metadata_tokens() -> None:
    transcript = _extract_text([
        {"text": "<|en|><|EMO_UNKNOWN|><|BGM|><|woitn|>tell me a different story about france."}
    ])

    assert transcript == "tell me a different story about france."


def test_funasr_provider_rejects_metadata_only_transcript(monkeypatch) -> None:
    sys.modules.pop("funasr", None)
    cfg = STTProviderConfig(active_provider="funasr", local_model_id="iic/SenseVoiceSmall", local_model_path_override="C:/cache/funasr")
    provider = FunASRSTTProvider(cfg)

    class _AutoModel:
        def __init__(self, **_kwargs) -> None:
            pass

        def generate(self, **_kwargs):
            return [{"text": "<|en|><|EMO_UNKNOWN|><|BGM|><|woitn|>"}]

    monkeypatch.setitem(sys.modules, "funasr", SimpleNamespace(AutoModel=_AutoModel))

    try:
        provider.transcribe(STTRequest(audio_bytes=b"wav", sample_rate_hz=16000, duration_ms=500, provider_id="funasr"))
    except STTProviderError as exc:
        assert exc.summary == "FunASR detected no speech."
        assert exc.redacted_diagnostics == {"transcript_content": "metadata_only_or_empty"}
    else:
        raise AssertionError("metadata-only FunASR output should not be accepted as speech")
