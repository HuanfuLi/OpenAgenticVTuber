---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
plan: 20-02
subsystem: audio-input
tags: [renderer, microphone, ptt, vad, mediarecorder, settings]
requires:
  - phase: 20-01
    provides: Voice input readiness, microphone permission state, and preload-mediated runtime transcription bridge.
provides:
  - Renderer voice input state store with readiness, capture status, transient preview, final candidate, and one queued final slot.
  - Renderer getUserMedia/MediaRecorder voice capture controller with cleanup, sequence IDs, preview transcription, and final transcription.
  - In-memory WAV/base64 encoder helper for runtime voice transcription payloads.
  - Settings-only push-to-talk shortcut and conservative VAD preference controls.
affects: [20-03, 20-04, Chat voice input, renderer Settings]
tech-stack:
  added: []
  patterns: [renderer-local voice input settings, preload-mediated voice transcription, sequence-gated preview updates]
key-files:
  created:
    - apps/renderer/src/audio/voice-capture.ts
    - apps/renderer/src/audio/wav-encoder.ts
    - apps/renderer/src/state/audio-settings.ts
    - apps/renderer/src/state/voice-input-store.ts
    - apps/renderer/src/screens/Settings/VoiceInputSection.tsx
    - apps/renderer/tests/voice-capture.test.ts
    - apps/renderer/tests/voice-input-store.test.ts
  modified:
    - apps/renderer/src/screens/Settings/Settings.tsx
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/tests/Settings.test.tsx
key-decisions:
  - "PTT and VAD UI preferences are stored in a renderer-local audio settings module instead of changing generated STT provider contracts."
  - "Voice capture uses preload-mediated transcribeVoiceInput only; renderer code does not call sidecar URLs directly."
  - "Preview transcripts remain transient store state and final transcript submission is deferred to 20-03."
patterns-established:
  - "VoiceCapture owns all MediaStream/MediaRecorder cleanup paths and stops tracks on stop, cancel, recorder error, and sidecar reconnect."
  - "Preview transcription results carry sequence IDs and stale preview results are ignored."
requirements-completed: [VIN-01, VIN-02, VIN-03, VIN-04]
duration: 15min
completed: 2026-05-11
---

# Phase 20 Plan 20-02: Renderer Voice Capture Controller And Settings Hotkey Summary

**Renderer microphone capture foundation with PTT/VAD settings, transient preview state, sequence-gated transcription, and explicit track cleanup.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-11T05:01:30Z
- **Completed:** 2026-05-11T05:16:21Z
- **Tasks:** 6
- **Files modified:** 10

## Accomplishments

- Added a renderer voice input store exposing readiness, permission state, capture status, transient preview transcript, final transcript candidate, and one queued final slot.
- Added a `VoiceCapture` controller that starts microphone capture only after explicit action, uses best-effort mono/noise-suppression constraints, stops tracks on every cleanup path, and sends preview/final audio through the 20-01 preload transcription bridge.
- Added an in-memory audio encoder that decodes captured blobs and emits 16 kHz mono WAV base64 with typed empty/too-short/decode errors.
- Added Settings-only PTT shortcut and conservative VAD preference controls with reserved shortcut validation and persistent renderer settings.
- Added focused tests for getUserMedia timing, permission/no-device state, track cleanup, stale preview suppression, transient preview persistence boundaries, one-slot final queueing, Settings persistence, and VAD defaults.

## Task Commits

1. **Tasks 1-6: Renderer voice store, capture controller, WAV helper, Settings PTT/VAD controls, and focused tests** - `cc4fdba` (feat)

## Files Created/Modified

- `apps/renderer/src/audio/voice-capture.ts` - Renderer `getUserMedia`/`MediaRecorder` capture controller with cleanup, sequence IDs, preview transcription, final transcription, and sidecar reconnect cancellation.
- `apps/renderer/src/audio/wav-encoder.ts` - In-memory captured-blob to mono WAV/base64 helper with duration and typed encoding errors.
- `apps/renderer/src/state/audio-settings.ts` - Renderer-local PTT shortcut and VAD preference defaults, normalization, validation, persistence, and subscription.
- `apps/renderer/src/state/voice-input-store.ts` - Voice input state machine/store for readiness, capture status, preview, final candidate, queue slot, settings, and errors.
- `apps/renderer/src/screens/Settings/VoiceInputSection.tsx` - Settings controls for push-to-talk shortcut, VAD opt-in, sensitivity, and silence timeout.
- `apps/renderer/src/screens/Settings/Settings.tsx` - Wired voice settings controls into the existing Voice in section and save flow.
- `apps/renderer/src/lib/copy.ts` - Added PTT/VAD labels, conservative VAD copy, and updated Voice in help text.
- `apps/renderer/tests/voice-capture.test.ts` - Focused capture controller tests.
- `apps/renderer/tests/voice-input-store.test.ts` - Focused voice input state/settings tests.
- `apps/renderer/tests/Settings.test.tsx` - Settings coverage for PTT/VAD persistence and reserved shortcut validation.

## Verification

- `npm --workspace apps/renderer run test -- --run voice-capture` - PASS, 5 tests
- `npm --workspace apps/renderer run test -- --run voice-input-store` - PASS, 4 tests
- `npm --workspace apps/renderer run test -- --run Settings` - PASS, 61 tests
- `npm --workspace apps/renderer run typecheck` - PASS

## Decisions Made

- Kept PTT/VAD preferences in a renderer-local `audio-settings.ts` module because the plan-referenced file did not exist and these UI preferences should not mutate generated Phase 19/20 STT provider contracts.
- Kept Chat untouched; inline shortcut editing, mic UI, final submission, and active-turn queue consumption remain 20-03 scope.
- Made `VoiceCapture.stop()` resolve only after final transcription state is applied, so later Chat integration can treat stop/finalize as a completed async operation.

## Deviations from Plan

None - plan scope was implemented as written. The missing `audio-settings.ts` file was created as the plan requested.

## Known Stubs

None. VAD auto-submit execution remains intentionally deferred to 20-04 per the plan.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: microphone-capture | apps/renderer/src/audio/voice-capture.ts | New renderer microphone capture surface uses explicit start, preload-mediated transcription, in-memory audio handling, sequence IDs, and track cleanup on stop/cancel/error/reconnect. |

## Issues Encountered

- `gsd-sdk query` is unavailable in this checkout, so planning state updates were applied manually.
- The renderer WebSocket client has an existing module-load connection side effect; the capture controller tests mock `@/ws/client` to isolate sidecar reconnect subscription behavior.

## User Setup Required

None - no external service configuration required by this plan. Runtime transcription still depends on Phase 19 provider readiness and 20-01 preload bridge readiness.

## Next Phase Readiness

Plan 20-03 can consume `VoiceCapture`, `useVoiceInput`, `refreshVoiceInputReadiness`, final candidate state, queued final slot state, and Settings-backed PTT/VAD preferences to build the Chat mic control, transient preview UI, final text submission, and queue consumption.

## Self-Check: PASSED

- Created files exist: `apps/renderer/src/audio/voice-capture.ts`, `apps/renderer/src/audio/wav-encoder.ts`, `apps/renderer/src/state/audio-settings.ts`, `apps/renderer/src/state/voice-input-store.ts`, `apps/renderer/src/screens/Settings/VoiceInputSection.tsx`, `apps/renderer/tests/voice-capture.test.ts`, `apps/renderer/tests/voice-input-store.test.ts`.
- Commit exists: `cc4fdba`.
- Verification commands above passed.

---
*Phase: 20-renderer-voice-capture-ptt-vad-preview-ux*
*Completed: 2026-05-11*
