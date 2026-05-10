"""Tests for SpeechEnvelopePayload and TTS audio payload helpers."""

from __future__ import annotations

import base64
from io import BytesIO
import wave
from pathlib import Path

import numpy as np
import pytest

from contracts import ActionCode, Dispatch, DisplayTextField, SpeechEnvelopePayload
from sidecar.tts.audio_payload_helpers import (
    get_volume_by_chunks,
    prepare_payload_from_pcm,
    synthesize_and_prepare_payload,
)

_MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "piper" / "en_US-amy-medium.onnx"


def _display_text() -> DisplayTextField:
    return DisplayTextField(text="Hello", name="Teto", avatar="teto")


def _dispatches() -> list[Dispatch]:
    return [ActionCode(name="joy")]


def _decode_wav(audio_b64: str) -> tuple[int, int, bytes]:
    decoded = base64.b64decode(audio_b64)
    with wave.open(BytesIO(decoded), "rb") as wf:
        return wf.getframerate(), wf.getnframes(), wf.readframes(wf.getnframes())


def test_speech_envelope_payload_roundtrip():
    payload = SpeechEnvelopePayload(
        sentence_id=1,
        volumes=[0.5, 0.7, 1.0],
        slice_length=20,
        started_at=1.234,
    )
    dumped = payload.model_dump()
    restored = SpeechEnvelopePayload.model_validate(dumped)
    assert restored == payload


def test_empty_bytes_returns_empty_list():
    assert get_volume_by_chunks(b"", 22050) == []


def test_silent_samples_returns_zeros():
    pcm = (np.zeros(22050, dtype=np.int16)).tobytes()
    volumes = get_volume_by_chunks(pcm, 22050, 20)
    assert len(volumes) == 50
    assert volumes == [0.0] * 50


@pytest.mark.parametrize(
    ("pcm", "expected"),
    [
        ((np.array([1000, -1000, 1000], dtype=np.int16)).tobytes(), [1.0]),
        ((np.zeros(3, dtype=np.int16)).tobytes(), [0.0]),
    ],
)
def test_short_sub_chunk_returns_single_value(pcm: bytes, expected: list[float]):
    assert get_volume_by_chunks(pcm, 22050, 20) == expected


def test_constant_sin_wave_returns_uniform_volumes():
    t = np.arange(22050 * 2) / 22050
    samples = (0.7 * np.sin(2 * np.pi * 220 * t) * 32767).astype(np.int16)
    volumes = get_volume_by_chunks(samples.tobytes(), 22050, 20)
    assert len(volumes) == 100
    assert all(abs(v - 1.0) <= 0.05 for v in volumes)


def test_linear_ramp_returns_ascending_volumes():
    samples = np.linspace(0, 32767, 22050, dtype=np.int16)
    volumes = get_volume_by_chunks(samples.tobytes(), 22050, 20)
    assert len(volumes) == 50
    assert volumes == sorted(volumes)
    assert volumes[-1] == pytest.approx(1.0, abs=0.05)


def test_prepare_payload_from_pcm_builds_existing_audio_shape():
    pcm = (np.array([1000, -1000, 1000, -1000] * 200, dtype=np.int16)).tobytes()
    msg, pcm_int16, sample_rate = prepare_payload_from_pcm(
        pcm,
        22050,
        _display_text(),
        _dispatches(),
        sentence_id=11,
    )

    assert pcm_int16 == pcm
    assert sample_rate == 22050
    assert msg.audio is not None
    assert msg.slice_length == 20
    assert msg.sentence_id == 11
    assert msg.volumes
    decoded = base64.b64decode(msg.audio)
    assert decoded[:4] == b"RIFF"


def test_prepare_payload_resamples_to_target_sample_rate_for_wav_rms_and_write_bytes():
    source_rate = 32000
    target_rate = 24000
    source_samples = (np.sin(2 * np.pi * 220 * np.arange(source_rate // 10) / source_rate) * 20000).astype(np.int16)

    msg, pcm_int16, sample_rate = prepare_payload_from_pcm(
        source_samples.tobytes(),
        source_rate,
        _display_text(),
        _dispatches(),
        sentence_id=12,
        target_sample_rate=target_rate,
    )

    assert sample_rate == target_rate
    assert len(np.frombuffer(pcm_int16, dtype=np.int16)) == target_rate // 10
    assert len(msg.volumes) == 5
    assert msg.audio is not None
    wav_rate, wav_frames, wav_pcm = _decode_wav(msg.audio)
    assert wav_rate == target_rate
    assert wav_frames == target_rate // 10
    assert wav_pcm == pcm_int16


def test_prepare_payload_resamples_non_integer_ratio_to_target_rate():
    source_rate = 48000
    target_rate = 22050
    source_samples = (np.sin(2 * np.pi * 440 * np.arange(source_rate // 5) / source_rate) * 18000).astype(np.int16)

    msg, pcm_int16, sample_rate = prepare_payload_from_pcm(
        source_samples.tobytes(),
        source_rate,
        _display_text(),
        _dispatches(),
        sentence_id=13,
        target_sample_rate=target_rate,
    )

    expected_samples = round(len(source_samples) * target_rate / source_rate)
    assert sample_rate == target_rate
    assert len(np.frombuffer(pcm_int16, dtype=np.int16)) == expected_samples
    assert msg.audio is not None
    wav_rate, wav_frames, _wav_pcm = _decode_wav(msg.audio)
    assert wav_rate == target_rate
    assert wav_frames == expected_samples


def test_prepare_payload_target_sample_rate_noop_preserves_bytes():
    pcm = (np.array([1000, -1000, 2000, -2000] * 200, dtype=np.int16)).tobytes()

    msg, pcm_int16, sample_rate = prepare_payload_from_pcm(
        pcm,
        22050,
        _display_text(),
        _dispatches(),
        sentence_id=14,
        target_sample_rate=22050,
    )

    assert pcm_int16 == pcm
    assert sample_rate == 22050
    assert msg.audio is not None
    wav_rate, _wav_frames, wav_pcm = _decode_wav(msg.audio)
    assert wav_rate == 22050
    assert wav_pcm == pcm


def test_silent_payload_fast_path():
    class _NoSynthVoice:
        class config:
            sample_rate = 22050

        def synthesize(self, _text):
            raise AssertionError("synthesize should not be called for silent payloads")

    msg, pcm_int16, sample_rate = synthesize_and_prepare_payload(
        _NoSynthVoice(),
        "   。！？  ",
        _display_text(),
        _dispatches(),
        sentence_id=7,
    )

    assert msg.audio is None
    assert msg.volumes == []
    assert msg.slice_length == 20
    assert msg.sentence_id == 7
    assert msg.dispatches == _dispatches()
    assert pcm_int16 == b""
    assert sample_rate == 22050


def test_synthesize_and_prepare_payload_real_voice():
    piper = pytest.importorskip("piper")
    model_path = _MODEL_PATH
    if not model_path.exists():
        pytest.skip("piper voice not present")

    voice = piper.PiperVoice.load(str(model_path))
    msg, pcm_int16, sample_rate = synthesize_and_prepare_payload(
        voice,
        "Hello world.",
        _display_text(),
        _dispatches(),
        sentence_id=3,
    )

    assert pcm_int16
    assert sample_rate == voice.config.sample_rate
    assert msg.audio is not None
    decoded = base64.b64decode(msg.audio)
    with wave.open(BytesIO(decoded), "rb") as wf:
        assert wf.getframerate() == sample_rate
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2
    assert decoded[:4] == b"RIFF"
    assert len(msg.volumes) > 0
    assert msg.dispatches == _dispatches()
