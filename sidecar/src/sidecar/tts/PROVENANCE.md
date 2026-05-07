# TTS Provenance

## OpenLLM_Vtuber Ports

- `stream_audio.py` port → `audio_payload_helpers.py`
  - Upstream: `OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py` at `12d42d7`
  - Adaptation: `_get_volume_by_chunks` is replaced with the D-12 numpy implementation, dropping `pydub` and FFmpeg while preserving the OLVT-shaped normalized RMS envelope.
  - Adaptation: `prepare_audio_payload` is ported to `synthesize_and_prepare_payload`, consuming Piper `voice.synthesize(...)` `AudioChunk`s directly so one synth pass produces raw PCM, the in-memory WAV envelope, and the same `volumes[]` data.
  - Adaptation: WAV assembly stays fully in memory via `wave` + `BytesIO`; no temp-file roundtrip.

- `piper_tts.py` reference → `tts_gateway.py`
  - Upstream: `OpenLLM_Vtuber/src/open_llm_vtuber/tts/piper_tts.py` at `12d42d7`
  - Note: the actual gateway owner/lifecycle port lands in Task 2.

- `tts_manager.py` port → `tts_manager.py`
  - Upstream: `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py` at `12d42d7`
  - Adaptation: sender-task ordering stays OLVT-style, but the sidecar sender publishes `SpeechEnvelopePayload`, sends the audio WS envelope, and then writes PCM to the long-lived `sounddevice.OutputStream`.
  - Adaptation: `wait_for_all_audio_complete()` adds payload-queue drain and `stream.latency + 0.020` sleep so sidecar-side playback drains before `chain-end` (D-14).
  - Adaptation: logging uses `[TTS-SYNTH-START]`, `[TTS-SYNTH-END]`, `[TTS-WRITE-START]`, `[TTS-WRITE-END]`, and `[TTS-DRAIN-END]` markers for SC #2 proof.

## Deviations Log

- D-01: sidecar-side playback owns audio output; the renderer does not play Web Audio in the skeleton.
- D-09: let-finish plus queued next input replaces OLVT’s interrupt-and-abort path.
- D-14: `chain-end` timing follows audio drain completion rather than WS send completion.

## piper_tts.py reference → tts_gateway.py

Upstream: `OpenLLM_Vtuber/src/open_llm_vtuber/tts/piper_tts.py` (commit `12d42d7`)

Adaptation per CONTEXT D-06/D-07/D-08:
- `PiperVoice.load` + `voice.synthesize` used; `voice.config.sample_rate` derived
  (NOT a yaml field per RESEARCH §Open Q1).
- Warmup is synth-and-discard against `"."` (D-08), not file synthesis.
- Long-lived `sounddevice.OutputStream` lifecycle (open at boot, close at
  shutdown) instead of per-sentence file writes (D-01 sidecar-side playback).
- LFS-pointer-file guard added per RESEARCH Pitfall 3.
