from __future__ import annotations

import base64
import wave
from io import BytesIO

import numpy as np

from contracts import AudioPayloadMessage, Dispatch, DisplayTextField


def get_volume_by_chunks(
    pcm_int16: bytes, sample_rate: int, chunk_length_ms: int = 20
) -> list[float]:
    """OLVT-shape RMS envelope: one float per chunk_length_ms slice,
    normalized to max RMS in the sentence. Replaces OLVT's pydub-based
    _get_volume_by_chunks (drops pydub + FFmpeg dep). ~12 LOC of math.

    Args:
        pcm_int16: raw int16 PCM bytes (mono) from
                   piper AudioChunk.audio_int16_bytes.
        sample_rate: 22050 for amy-medium.
        chunk_length_ms: 20 (OLVT default, locked by Phase 2 D-02 + Amendment).

    Returns:
        list[float] of normalized volumes in [0.0, 1.0]. Empty list if
        pcm_int16 is empty (mirrors the dict-empty edge case OLVT raises on,
        but caller can decide — silent payload uses volumes=[]).
    """
    if not pcm_int16:
        return []

    samples = np.frombuffer(pcm_int16, dtype=np.int16)
    samples_per_chunk = int(sample_rate * chunk_length_ms / 1000)  # = 441 @ 22050+20ms
    if samples_per_chunk <= 0 or len(samples) < samples_per_chunk:
        # Sentence shorter than one chunk — return one RMS over whatever exists.
        rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2))) or 0.0
        return [1.0] if rms > 0.0 else [0.0]

    # Truncate to whole chunks (OLVT pydub.make_chunks discards trailing partial).
    n_chunks = len(samples) // samples_per_chunk
    truncated = samples[: n_chunks * samples_per_chunk]
    chunks = truncated.reshape(n_chunks, samples_per_chunk).astype(np.float64)
    rms_per_chunk = np.sqrt(np.mean(chunks ** 2, axis=1))
    max_rms = float(rms_per_chunk.max())
    if max_rms == 0.0:
        return [0.0] * n_chunks  # silent sentence — don't divide by zero
    return (rms_per_chunk / max_rms).tolist()


def _resample_mono_int16(pcm_int16: bytes, source_rate: int, target_rate: int) -> bytes:
    if not pcm_int16 or source_rate <= 0 or target_rate <= 0 or source_rate == target_rate:
        return pcm_int16

    samples = np.frombuffer(pcm_int16, dtype=np.int16)
    if len(samples) == 0:
        return pcm_int16
    target_len = max(1, int(round(len(samples) * target_rate / source_rate)))
    if target_len == len(samples):
        return pcm_int16

    source_positions = np.arange(len(samples), dtype=np.float64)
    target_positions = np.linspace(0, len(samples) - 1, target_len, dtype=np.float64)
    resampled = np.interp(target_positions, source_positions, samples.astype(np.float64))
    return np.clip(np.rint(resampled), -32768, 32767).astype(np.int16).tobytes()


def prepare_payload_from_pcm(
    pcm_int16: bytes,
    sample_rate: int,
    display_text: DisplayTextField,
    dispatches: list[Dispatch],
    sentence_id: int,
    chunk_length_ms: int = 20,
    target_sample_rate: int | None = None,
) -> tuple[AudioPayloadMessage, bytes, int]:
    """Build the existing audio envelope from provider-neutral PCM output."""
    output_sample_rate = target_sample_rate if target_sample_rate and target_sample_rate > 0 else sample_rate
    if not pcm_int16:
        msg = AudioPayloadMessage(
            audio=None, volumes=[], slice_length=chunk_length_ms,
            display_text=display_text, dispatches=dispatches, sentence_id=sentence_id,
            forwarded=False,
        )
        return msg, b"", output_sample_rate

    output_pcm_int16 = _resample_mono_int16(pcm_int16, sample_rate, output_sample_rate)

    # Volumes: numpy chunk-RMS over the same bytes.
    volumes = get_volume_by_chunks(output_pcm_int16, output_sample_rate, chunk_length_ms)

    # base64 WAV: assemble header in-memory via stdlib wave.
    wav_buf = BytesIO()
    with wave.open(wav_buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)        # int16 = 2 bytes
        wf.setframerate(output_sample_rate)
        wf.writeframes(output_pcm_int16)
    audio_b64 = base64.b64encode(wav_buf.getvalue()).decode("utf-8")

    msg = AudioPayloadMessage(
        audio=audio_b64,
        volumes=volumes,
        slice_length=chunk_length_ms,
        display_text=display_text,
        dispatches=dispatches,
        sentence_id=sentence_id,
        forwarded=False,
    )
    return msg, output_pcm_int16, output_sample_rate


def synthesize_and_prepare_payload(
    voice,
    tts_text: str,
    display_text: DisplayTextField,
    dispatches: list[Dispatch],
    sentence_id: int,
    chunk_length_ms: int = 20,
) -> tuple[AudioPayloadMessage, bytes, int]:
    """Compatibility wrapper for tests and older call sites."""
    import re
    if len(re.sub(r'[\s.,!?，。！？\'"』」）】\s]+', "", tts_text)) == 0:
        return prepare_payload_from_pcm(
            b"",
            voice.config.sample_rate,
            display_text,
            dispatches,
            sentence_id,
            chunk_length_ms,
        )

    pcm_chunks: list[bytes] = []
    sample_rate: int = voice.config.sample_rate
    for chunk in voice.synthesize(tts_text):
        pcm_chunks.append(chunk.audio_int16_bytes)
        sample_rate = chunk.sample_rate
    return prepare_payload_from_pcm(
        b"".join(pcm_chunks),
        sample_rate,
        display_text,
        dispatches,
        sentence_id,
        chunk_length_ms,
    )
