---
phase: 16-audio-contracts-tts-provider-shell
plan: 16-04
subsystem: renderer-audio
tags: [tts, renderer, websocket, audio-payload, vitest]
requires:
  - phase: 16-02
    provides: Audio payload WAV envelopes and ordered TTS manager
  - phase: 16-03
    provides: Phase 16 UAT blocker diagnosis
provides:
  - Renderer playback helper for base64 WAV audio payloads
  - WS dispatcher playback invocation for non-silent audio envelopes
  - Gap-closure tests for audible renderer playback and silent envelopes
affects: [chat, phase-16-uat, phase-17, phase-18]
tech-stack:
  added: []
  patterns:
    - Browser-native Audio and Blob playback for sidecar WAV payloads
key-files:
  created:
    - apps/renderer/src/ws/audio-player.ts
    - apps/renderer/tests/ws-audio-player.test.ts
    - apps/renderer/tests/ws-store-audio.test.ts
  modified:
    - apps/renderer/src/ws/store.ts
    - .planning/phases/16-audio-contracts-tts-provider-shell/16-UAT.md
    - sidecar/src/sidecar/tts/PROVENANCE.md
key-decisions:
  - "Renderer playback is limited to non-empty AudioPayloadMessage.audio strings; silent/action-only envelopes remain silent."
  - "Playback failures are logged and swallowed so WS dispatch, chat text, and VTS lipsync state continue."
patterns-established:
  - "Renderer WS side effects should stay isolated behind small non-React helpers with focused Vitest coverage."
requirements-completed: [AUDIO-04, TTS-05]
duration: same-session
completed: 2026-05-09
---

# Phase 16 Plan 04: Restore Audible Voice Playback Summary

**Renderer WAV playback for sidecar audio payloads with preserved chat streaming and VTS lipsync state**

## Performance

- **Duration:** same session
- **Started:** 2026-05-09T19:02:00-04:00
- **Completed:** 2026-05-09T19:08:00-04:00
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `playAudioPayload()` to decode base64 WAV payloads into a browser `Blob`, create an object URL, and play through `Audio`.
- Kept active audio elements retained until `ended`, `error`, or rejected playback cleanup.
- Wired the WS audio dispatcher to call playback only for non-empty `msg.audio`.
- Preserved assistant text merging and speaking-state updates in the existing audio branch.
- Added renderer tests for helper behavior, dispatcher wiring, silent envelopes, and playback failure cleanup.
- Added focused Phase 16 UAT retest evidence for the no-audible-voice blocker.

## Task Commits

1. **Task 1 RED: Audio playback tests** - `ae8da64` (`test(16-04)`)
2. **Tasks 1-2 GREEN: Helper and dispatcher wiring** - `e21bf69` (`feat(16-04)`)
3. **Task 3: UAT and summary metadata** - committed with this summary

## Files Created/Modified

- `apps/renderer/src/ws/audio-player.ts` - Renderer-owned WAV playback helper.
- `apps/renderer/src/ws/store.ts` - Calls playback for non-empty audio payloads.
- `apps/renderer/tests/ws-audio-player.test.ts` - Helper coverage for play, cleanup, skips, invalid payloads, and rejected playback.
- `apps/renderer/tests/ws-store-audio.test.ts` - Dispatcher coverage for non-silent and silent audio envelopes.
- `.planning/phases/16-audio-contracts-tts-provider-shell/16-UAT.md` - Gap closure retest evidence.
- `sidecar/src/sidecar/tts/PROVENANCE.md` - Updated audio-output provenance after renderer playback was added.

## Decisions Made

Renderer playback is intentionally narrow: it does not add provider switching, test synthesis, presets, or rich audio settings. It only consumes the WAV payload the sidecar already emits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added a dedicated WS dispatcher test file**
- **Found during:** Task 2
- **Issue:** `Chat.test.tsx` mocks `@/ws/store`, so it cannot exercise the real WS dispatcher branch without destabilizing existing Chat UI tests.
- **Fix:** Added `apps/renderer/tests/ws-store-audio.test.ts` to load the real dispatcher with mocked WS client and playback helper.
- **Files modified:** `apps/renderer/tests/ws-store-audio.test.ts`
- **Verification:** `npm --workspace apps/renderer run test -- --run Chat.test.tsx ws-audio-player.test.ts ws-store-audio.test.ts`
- **Committed in:** `ae8da64`

**2. [Rule 2 - Missing Critical] Updated TTS provenance after renderer playback changed the audio path**
- **Found during:** Task 3
- **Issue:** `sidecar/src/sidecar/tts/PROVENANCE.md` still stated that the renderer does not play Web Audio.
- **Fix:** Updated D-01 to record renderer playback of emitted audio payloads while sidecar still owns stream ordering/timing and RMS lipsync.
- **Files modified:** `sidecar/src/sidecar/tts/PROVENANCE.md`
- **Verification:** `rg -n "renderer playback|AudioPayloadMessage.audio" sidecar/src/sidecar/tts/PROVENANCE.md`
- **Committed in:** this summary commit

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both changes keep the gap closure accurate and testable without expanding into Phase 17/18 voice settings work.

## Issues Encountered

The first GREEN run showed the dispatcher should not call the helper for `audio: null`, and the playback rejection test needed to configure rejection before `Audio.play()` was called. Both were fixed before commit.

## User Setup Required

None.

## Next Phase Readiness

Phase 16 needs focused human retest for audible voice output with VTS running. Phase 17 can build GPT-SoVITS provider support on the same payload contract without changing chat reducer semantics.

---
*Phase: 16-audio-contracts-tts-provider-shell*
*Completed: 2026-05-09*
