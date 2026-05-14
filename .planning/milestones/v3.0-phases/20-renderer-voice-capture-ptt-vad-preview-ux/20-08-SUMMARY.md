---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
plan: 20-08
status: implemented
completed: 2026-05-13T00:53:54-04:00
gap_closure: true
---

# 20-08 Summary: VAD Detection And Observability

## Outcome

Implemented the Phase 20 live-UAT gap closure for VAD detection and debugging visibility. The app now exposes VAD microphone level diagnostics from the controller through renderer state and shows a compact live VAD meter/status in Chat while VAD is enabled.

## Changes

- Recalibrated VAD RMS thresholds lower for opt-in near-field speech while preserving disabled-by-default VAD.
- Added VAD diagnostics for level, threshold, sensitivity, speech detected, monitoring, recording, and active-turn ignored reason.
- Added Chat VAD feedback for starting, quiet/below threshold, voice detected, recording, finalizing, and active-turn paused states.
- Synchronized Settings STT `input_mode = vad` with the renderer-local VAD enablement setting used by Chat.
- Added regression coverage for below-threshold diagnostics, speech detection, active-turn blocking feedback, live Chat meter rendering, and Settings VAD/input-mode synchronization.

## Verification

- `npm --workspace apps/renderer run test -- --run vad-controller ChatVoiceInput Settings` passed.
- `npm --workspace apps/renderer run typecheck` passed.
- `npm --workspace apps/renderer run test -- --run voice-input-store` passed.

## Human Retest

Run Phase 20 Human UAT Test 2 again in the live app. Expected behavior: normal speech crosses the visible VAD threshold, recording starts, silence finalizes capture, and one final transcript is submitted through the normal chat path.
