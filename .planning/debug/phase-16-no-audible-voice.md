---
status: diagnosed
phase: 16-audio-contracts-tts-provider-shell
created: 2026-05-09T19:05:00-04:00
updated: 2026-05-09T19:05:00-04:00
source: .planning/phases/16-audio-contracts-tts-provider-shell/16-UAT.md
---

# Phase 16 No Audible Voice Diagnosis

## Symptom

User reported: "No voice at all, but lipsync is working."

## Evidence

- `apps/renderer/src/ws/store.ts` handles `AudioPayloadMessage` by appending text and setting speaking state, but ignores `msg.audio`.
- `sidecar/src/sidecar/tts/tts_manager.py` queues the `SpeechEnvelopePayload` before sidecar `stream.write()`. That means VTS mouth/lipsync can work even if local sidecar audio output is muted, routed to the wrong device, or fails after the envelope is queued.
- `sidecar/src/sidecar/tts/PROVENANCE.md` documents the current skeleton decision that the renderer does not play Web Audio. This makes sidecar-local `sounddevice.OutputStream` the only audible path.

## Diagnosis

Phase 16 preserved the prior sidecar-owned playback model, but UAT shows that model is not sufficient as the only audible output path on the user's machine. The app already sends a base64 WAV in each non-silent `AudioPayloadMessage`; the renderer should use that payload for audible playback, or at least provide a fallback path when sidecar-local playback is not audible.

## Fix Direction

Add a renderer audio playback helper for `AudioPayloadMessage.audio` and call it from the WS audio handler. Keep silent/action-only payloads silent. Keep RMS/lipsync unchanged. Avoid adding Phase 17/18 rich voice controls.
