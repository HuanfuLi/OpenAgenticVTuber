from __future__ import annotations

import wave
from io import BytesIO
from pathlib import Path

import httpx
import pytest

from contracts import GptSoVitsProviderConfig, GptSoVitsPresetConfig, VoicePreset
from sidecar.tts.gpt_sovits_provider import GptSoVitsProvider
from sidecar.tts.provider import TTSProviderError, TTSSynthesisRequest


def _wav_bytes(sample_rate: int = 24_000, pcm: bytes = b"\x01\x00\x02\x00") -> bytes:
    buf = BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def _preset(
    *,
    text_lang: str = "ja",
    prompt_lang: str = "ja",
    gpt_weights_path: str | None = None,
    sovits_weights_path: str | None = None,
) -> VoicePreset:
    return VoicePreset(
        preset_id="preset-1",
        name="Teto GPT",
        provider_id="gpt_sovits",
        gpt_sovits=GptSoVitsPresetConfig(
            prompt_text="今日も一緒に頑張ろうね。",
            prompt_lang=prompt_lang,
            text_lang=text_lang,
            gpt_weights_path=gpt_weights_path,
            sovits_weights_path=sovits_weights_path,
            top_k=15,
            top_p=1.0,
            temperature=1.0,
            text_split_method="cut5",
            batch_size=1,
            speed_factor=1.0,
            repetition_penalty=1.35,
        ),
    )


def _config(base_url: str = "http://127.0.0.1:9880/base/") -> GptSoVitsProviderConfig:
    return GptSoVitsProviderConfig(base_url=base_url, request_timeout_ms=1_000)


def test_provider_derives_post_tts_from_base_url(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())
    seen_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        return httpx.Response(200, content=_wav_bytes(), headers={"content-type": "audio/wav"})

    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(),
        reference_audio=reference,
        transport=httpx.MockTransport(handler),
    )

    provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=7))

    assert seen_urls == ["http://127.0.0.1:9880/base/tts"]


def test_success_wav_decodes_to_gpt_sovits_result(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())
    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(),
        reference_audio=reference,
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(200, content=_wav_bytes(), headers={"content-type": "audio/wav"})
        ),
    )

    result = provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=7))

    assert result.provider_id == "gpt_sovits"
    assert result.sample_rate == 24_000
    assert result.pcm_int16 == b"\x01\x00\x02\x00"


def test_failure_mapping_json_400_timeout_bad_url_and_unreadable_reference(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())

    json_provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(),
        reference_audio=reference,
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(400, json={"message": "bad language value"})
        ),
    )
    with pytest.raises(TTSProviderError) as json_error:
        json_provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=1))
    assert json_error.value.state == "external_service_failure"
    assert "GPT-SoVITS synthesis failed" in json_error.value.summary
    assert "bad language" in (json_error.value.detail or "")

    timeout_provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(),
        reference_audio=reference,
        transport=httpx.MockTransport(lambda _request: (_ for _ in ()).throw(httpx.TimeoutException("slow"))),
    )
    with pytest.raises(TTSProviderError) as timeout_error:
        timeout_provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=1))
    assert timeout_error.value.state == "timeout"

    with pytest.raises(TTSProviderError) as url_error:
        GptSoVitsProvider(config=_config("ftp://example.com"), preset=_preset(), reference_audio=reference)
    assert url_error.value.state == "misconfigured"

    missing = tmp_path / "missing.wav"
    unreadable_provider = GptSoVitsProvider(config=_config(), preset=_preset(), reference_audio=missing)
    with pytest.raises(TTSProviderError) as ref_error:
        unreadable_provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=1))
    assert ref_error.value.state == "external_service_failure"
    assert "GPT-SoVITS could not read the copied reference audio" in ref_error.value.summary


def test_payload_includes_required_gpt_sovits_fields(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())
    seen_payloads: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_payloads.append(dict(request.read() and __import__("json").loads(request.content)))
        return httpx.Response(200, content=_wav_bytes(), headers={"content-type": "audio/wav"})

    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(),
        reference_audio=reference,
        transport=httpx.MockTransport(handler),
    )

    provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=7))

    assert seen_payloads == [
        {
            "text": "こんにちは",
            "text_lang": "ja",
            "ref_audio_path": str(reference),
            "prompt_text": "今日も一緒に頑張ろうね。",
            "prompt_lang": "ja",
            "top_k": 15,
            "top_p": 1.0,
            "temperature": 1.0,
            "text_split_method": "cut5",
            "batch_size": 1,
            "speed_factor": 1.0,
            "media_type": "wav",
            "streaming_mode": False,
            "repetition_penalty": 1.35,
        }
    ]


def test_payload_preserves_olvt_language_split(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())
    seen_payloads: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_payloads.append(__import__("json").loads(request.content))
        return httpx.Response(200, content=_wav_bytes(), headers={"content-type": "audio/wav"})

    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(text_lang="zh", prompt_lang="ja"),
        reference_audio=reference,
        transport=httpx.MockTransport(handler),
    )

    provider.synthesize(TTSSynthesisRequest(text="你好", sentence_id=7))

    assert seen_payloads[0]["text_lang"] == "zh"
    assert seen_payloads[0]["prompt_lang"] == "ja"


def test_provider_applies_configured_weights_before_synthesis_and_skips_redundant_repeat(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        if request.url.path.endswith("/tts"):
            return httpx.Response(200, content=_wav_bytes(), headers={"content-type": "audio/wav"})
        return httpx.Response(200, json={"ok": True})

    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(
            gpt_weights_path="GPT_weights_v2Pro/teto_v1-e15.ckpt",
            sovits_weights_path="SoVITS_weights_v2Pro/teto_v1_e8_s160.pth",
        ),
        reference_audio=reference,
        transport=httpx.MockTransport(handler),
    )

    provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=1))
    provider.synthesize(TTSSynthesisRequest(text="もう一回", sentence_id=2))

    assert seen == [
        "http://127.0.0.1:9880/base/set_gpt_weights?weights_path=GPT_weights_v2Pro%2Fteto_v1-e15.ckpt",
        "http://127.0.0.1:9880/base/set_sovits_weights?weights_path=SoVITS_weights_v2Pro%2Fteto_v1_e8_s160.pth",
        "http://127.0.0.1:9880/base/tts",
        "http://127.0.0.1:9880/base/tts",
    ]


def test_weight_selection_failures_fail_health_and_synthesis(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())

    def failing_gpt_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/set_gpt_weights"):
            return httpx.Response(500, json={"message": "missing GPT weights"})
        return httpx.Response(200, content=_wav_bytes(), headers={"content-type": "audio/wav"})

    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(gpt_weights_path="missing.ckpt"),
        reference_audio=reference,
        transport=httpx.MockTransport(failing_gpt_handler),
    )

    health = provider.health()
    assert health.state == "external_service_failure"
    assert "GPT weight selection failed" in health.summary
    assert "missing GPT weights" in (health.detail or "")

    with pytest.raises(TTSProviderError) as exc_info:
        provider.synthesize(TTSSynthesisRequest(text="こんにちは", sentence_id=1))
    assert exc_info.value.state == "external_service_failure"
    assert "GPT weight selection failed" in exc_info.value.summary


def test_sovits_weight_selection_failure_reports_sovits_label(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())

    def failing_sovits_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/set_sovits_weights"):
            return httpx.Response(404, json={"detail": "missing SoVITS weights"})
        return httpx.Response(200, json={"ok": True})

    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(sovits_weights_path="missing.pth"),
        reference_audio=reference,
        transport=httpx.MockTransport(failing_sovits_handler),
    )

    health = provider.health()

    assert health.state == "external_service_failure"
    assert "SoVITS weight selection failed" in health.summary
    assert "missing SoVITS weights" in (health.detail or "")


def test_health_requires_successful_docs_response(tmp_path: Path) -> None:
    reference = tmp_path / "ref.wav"
    reference.write_bytes(_wav_bytes())
    provider = GptSoVitsProvider(
        config=_config(),
        preset=_preset(),
        reference_audio=reference,
        transport=httpx.MockTransport(lambda _request: httpx.Response(404, text="not GPT-SoVITS")),
    )

    health = provider.health()

    assert health.state == "external_service_failure"
    assert "HTTP 404" in health.summary
