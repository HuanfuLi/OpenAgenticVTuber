---
phase: 17-gpt-sovits-provider-voice-presets
plan: 12
subsystem: tts-runtime
tags: [gpt-sovits, lipsync, latency, olvt-parity]

requires:
  - phase: 17-gpt-sovits-provider-voice-presets
    provides: GPT-SoVITS provider and sidecar/rendered audio path
provides:
  - Ordered websocket audio delivery no longer blocked by local sidecar playback
  - Serial renderer audio playback queue to prevent sentence overlap after faster delivery
  - Dampened speech-driver mouth movement for normalized GPT-SoVITS RMS envelopes
affects: [phase-17-uat, gpt-sovits, tts-manager, speech-driver, renderer-audio]

key-files:
  created:
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-12-SUMMARY.md
  modified:
    - sidecar/src/sidecar/tts/tts_manager.py
    - sidecar/src/sidecar/compositor/speech_driver.py
    - sidecar/tests/test_tts_manager.py
    - sidecar/tests/compositor/test_speech_driver.py
    - apps/renderer/src/ws/audio-player.ts
    - apps/renderer/tests/ws-audio-player.test.ts
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md

key-decisions:
  - "Match OLVT's ordered delivery behavior: send synthesized sentence payloads as soon as their sequence is ready instead of waiting for backend playback to finish."
  - "Keep local sidecar playback serialized on a separate queue so VTS lipsync timing remains deterministic while websocket delivery stays low-latency."
  - "Queue renderer audio playback because faster backend delivery would otherwise create overlapping `new Audio(...)` playback."
  - "Drive mouth motion from smoothed RMS with lower gain/attack so GPT-SoVITS per-sentence normalized RMS does not produce overly fast mouth flapping."

patterns-established:
  - "TTS synthesis, websocket delivery, renderer playback, and local sidecar playback are separate pipeline stages; only synthesis order gates websocket delivery."

requirements-completed: [TTS-03, TTS-04]

duration: 34min
completed: 2026-05-10
---

# Phase 17 Plan 12: Lipsync Velocity and Sentence Latency Summary

**GPT-SoVITS sentence payload delivery now follows OLVT's low-latency pattern, and mouth movement is damped for normalized RMS envelopes.**

## Root Cause

- OLVT's `TTSTaskManager._process_payload_queue` sends ordered audio payloads immediately after synthesis. It does not wait for backend playback between sentences.
- This app sent the websocket payload, then blocked `_next_sequence_to_send` on `sounddevice.OutputStream.write(...)`. Sentence N+1 could not reach the renderer until sentence N finished local playback.
- GPT-SoVITS RMS envelopes are normalized per sentence, which can produce frequent local peaks near `1.0`. The sidecar mouth driver used raw RMS with high gain/attack, making duration correct but lip movement too fast.

## Fix

- Split sidecar TTS into ordered websocket send and ordered local playback queues.
- Websocket payloads now advance sequence immediately after send; local playback writes run serially in a separate task.
- Speech envelopes are emitted when local playback begins, preserving sidecar/VTS timing.
- Renderer audio playback now queues audio payloads so faster delivery does not overlap browser audio.
- SpeechDriver now maps mouth movement from smoothed RMS and uses lower mouth gain, max-open, attack, and release constants.

## Verification

- `uv run --project sidecar python -m pytest sidecar/tests/test_tts_manager.py sidecar/tests/compositor/test_speech_driver.py -q` - PASS, 21 tests.
- `uv run --project sidecar python -m pytest sidecar/tests/test_audio_payload_helpers.py sidecar/tests/test_tts_gateway.py sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py -q` - PASS, 33 tests.
- `npm --workspace apps/renderer run test -- --run ws-audio-player.test.ts ws-store-audio.test.ts ChatStreaming.test.tsx` - PASS, 16 tests.
- `npm --workspace apps/renderer run typecheck` - PASS.
- `npm run build` - PASS.

## Remaining Live UAT

- Confirm GPT-SoVITS mouth movement is no longer too fast during a normal chat turn.
- Confirm sentence-to-sentence audio latency is close to OLVT, without long gaps and without overlapping browser audio.
