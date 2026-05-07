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

## Deviations Log

- D-01: sidecar-side playback owns audio output; the renderer does not play Web Audio in the skeleton.
- D-09: let-finish plus queued next input replaces OLVT’s interrupt-and-abort path.
- D-14: `chain-end` timing follows audio drain completion rather than WS send completion.
