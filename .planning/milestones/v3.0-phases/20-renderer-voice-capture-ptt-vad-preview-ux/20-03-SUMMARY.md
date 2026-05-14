---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
plan: 20-03
subsystem: audio-input
tags: [renderer, chat, ptt, voice-input, transcript-preview, queueing]
requires:
  - phase: 20-02
    provides: Renderer VoiceCapture controller, voice input store, transient preview/final candidates, queued final slot, and Settings-backed PTT shortcut.
provides:
  - Chat-visible push-to-talk mic control with readiness/setup/permission/error states.
  - Transient transcript preview outside chat bubbles.
  - Final voice transcript submission through the existing text-input WebSocket path with session history.
  - One queued final transcript that auto-submits after the active turn/speaking state clears.
affects: [20-04, Chat voice input, VAD auto-submit, renderer voice UX]
tech-stack:
  added: []
  patterns: [shared Chat final-text submit helper, Chat-local VoiceInputControl, store-backed one-slot voice queue]
key-files:
  created:
    - apps/renderer/src/screens/Chat/VoiceInputControl.tsx
    - apps/renderer/tests/ChatVoiceInput.test.tsx
  modified:
    - apps/renderer/src/screens/Chat/Chat.tsx
    - apps/renderer/src/state/voice-input-store.ts
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/src/lib/icons.tsx
    - apps/renderer/src/index.css
key-decisions:
  - "Typed chat and final voice transcripts now share the same Chat submit helper so voice text uses the unchanged text-input envelope and history mapping."
  - "Queued voice input remains a one-slot store state and is consumed by Chat only after input-disabled/speaking state clears; no barge-in or TTS cancellation was added."
patterns-established:
  - "VoiceInputControl owns mic/shortcut UI and VoiceCapture lifecycle, while Chat owns final transcript submission."
  - "Preview and finalizing UI render near the input row and never call conversation history commit APIs."
requirements-completed: [VIN-01, VIN-02, VIN-04, VIN-05, VIN-06]
duration: 10min
completed: 2026-05-11
---

# Phase 20 Plan 20-03: Chat PTT Preview, Final Submit, And Safe Queue Summary

**Chat push-to-talk voice input with transient preview, unchanged final text-input submission, and safe one-slot queueing during active turns.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-11T05:19:29Z
- **Completed:** 2026-05-11T05:28:54Z
- **Tasks:** 6
- **Files modified:** 7

## Accomplishments

- Extracted Chat final-text submission so typed input and final voice transcripts share the same `text-input` WebSocket path, active session id, and active session history.
- Added a visible Chat mic/PTT control with readiness/setup/error states, first-use microphone permission request, configured shortcut handling, and preview/finalizing/queued rendering.
- Kept preview transcript outside chat bubbles and out of conversation history; only final transcript candidates append local user bubbles and enter the existing dispatcher/history flow.
- Added one-slot queued final transcript behavior that waits for active turn/speaking/input-disabled state to clear, with cancel support and no TTS/playback interruption.
- Added focused Chat voice tests for disabled setup, setup routing, hold-to-talk, configured shortcut, permission request, preview isolation, unchanged mixed-language final submit, history inclusion, queue send, and queue cancel.

## Task Commits

1. **Tasks 1-6: Chat voice input control, final submit helper, preview rendering, queueing, and tests** - `db9fa93` (feat)

## Files Created/Modified

- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx` - Chat mic/PTT control, keyboard shortcut handling, permission readiness flow, preview/finalizing/queued/error UI, and capture lifecycle ownership.
- `apps/renderer/src/screens/Chat/Chat.tsx` - Shared final-text submit helper plus voice final/queued candidate consumption through the existing typed chat path.
- `apps/renderer/src/state/voice-input-store.ts` - Queue/cancel helpers and visible replacement state for one queued final transcript.
- `apps/renderer/src/lib/copy.ts` - Chat voice input labels and setup/queue/error copy.
- `apps/renderer/src/lib/icons.tsx` - Mic icon for the Chat voice control.
- `apps/renderer/src/index.css` - Compact input-row-adjacent voice control, preview, queued, and error styling.
- `apps/renderer/tests/ChatVoiceInput.test.tsx` - Focused regression coverage for Chat voice input behavior.

## Verification

- `npm --workspace apps/renderer run test -- --run ChatVoiceInput` - PASS, 9 tests
- `npm --workspace apps/renderer run test -- --run Chat` - PASS, 28 tests
- `npm --workspace apps/renderer run test -- --run ChatStreaming` - PASS, 8 tests
- `npm --workspace apps/renderer run typecheck` - PASS

## Decisions Made

- Kept final voice submission in Chat rather than inside `VoiceInputControl`, because Chat already owns active session history and the typed input path.
- Reused the existing store one-slot queue and made replacement visible with a queue replacement error state instead of adding a broader queueing service.
- Disposed/recreated the capture controller when the active session id changes so final transcription requests cannot keep a stale session id.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented stale session id use in voice capture**
- **Found during:** Task 2 (Add Chat Voice Input Control)
- **Issue:** A long-lived `VoiceCapture` instance could retain the session id it was created with if the active session changed after Chat hydration or session switching.
- **Fix:** `VoiceInputControl` now disposes and recreates its capture controller when `sessionId` changes.
- **Files modified:** `apps/renderer/src/screens/Chat/VoiceInputControl.tsx`
- **Verification:** `npm --workspace apps/renderer run test -- --run ChatVoiceInput`; `npm --workspace apps/renderer run typecheck`
- **Committed in:** `db9fa93`

---

**Total deviations:** 1 auto-fixed bug
**Impact on plan:** The fix preserves the plan's active session/history requirement without changing architecture or scope.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: microphone-capture-ui | apps/renderer/src/screens/Chat/VoiceInputControl.tsx | Chat now exposes microphone capture controls, gated by 20-01/20-02 readiness and permission flows, with explicit hold/shortcut activation and cleanup on unmount/session change. |

## Issues Encountered

- `gsd-sdk query` is unavailable in this checkout, so planning state updates were applied manually.
- The new Chat voice tests initially applied final transcript state before async conversation history hydration; tests now wait for session hydration before asserting active-session history envelopes.

## User Setup Required

None - no external service configuration required by this plan. Runtime transcription still depends on the Phase 19 selected STT provider being ready and the 20-01 preload bridge being available.

## Next Phase Readiness

Plan 20-04 can consume Chat's visible mic control, preview/final state rendering, shared final submit helper, and one-slot queue behavior to add VAD auto-submit controls, conservative safety states, final regression, and UAT evidence.

## Self-Check: PASSED

- Created files exist: `apps/renderer/src/screens/Chat/VoiceInputControl.tsx`, `apps/renderer/tests/ChatVoiceInput.test.tsx`, `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-03-SUMMARY.md`.
- Commit exists: `db9fa93`.
- Verification commands above passed.

---
*Phase: 20-renderer-voice-capture-ptt-vad-preview-ux*
*Completed: 2026-05-11*
