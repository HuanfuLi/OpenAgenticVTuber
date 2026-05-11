---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
plan: 20-04
subsystem: audio-input
tags: [renderer, vad, microphone, chat, settings, uat]
requires:
  - phase: 20-03
    provides: Chat PTT control, transient preview rendering, unchanged final transcript submission, and one-slot active-turn queueing.
provides:
  - Conservative opt-in renderer VAD controller using Web Audio analyser RMS levels.
  - Chat VAD monitoring wired into existing VoiceCapture finalization, final text submission, and queueing paths.
  - Settings and Chat copy for VAD state, conservative defaults, and Phase 22 no-headphones/AEC deferral.
  - Final Phase 20 automated regression evidence and UAT checklist.
affects: [Phase 21 code-switch verification, Phase 22 AEC/no-headphones decision, renderer voice UX]
tech-stack:
  added: []
  patterns: [opt-in Web Audio VAD gate, latest-state refs for async voice callbacks, automated-plus-manual UAT evidence]
key-files:
  created:
    - apps/renderer/src/audio/vad-controller.ts
    - apps/renderer/tests/vad-controller.test.ts
    - .planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-UAT.md
  modified:
    - apps/renderer/src/screens/Chat/VoiceInputControl.tsx
    - apps/renderer/src/state/audio-settings.ts
    - apps/renderer/src/screens/Settings/VoiceInputSection.tsx
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/src/index.css
    - apps/renderer/tests/ChatVoiceInput.test.tsx
    - apps/renderer/tests/Settings.test.tsx
    - apps/renderer/tests/voice-input-store.test.ts
key-decisions:
  - "VAD defaults are conservative for Phase 20: disabled by default, low sensitivity, and a 1800 ms silence timeout."
  - "VAD reuses VoiceCapture and Chat's existing final transcript path instead of adding a parallel submit or queueing service."
  - "Phase 20 copy explicitly defers no-headphones echo handling to Phase 22 and does not claim AEC support."
patterns-established:
  - "VAD controller owns only speech/silence decisions; capture, transcription, final submit, and queueing stay in existing Phase 20 modules."
  - "Async VAD callbacks read latest voice state via refs so queued/finalizing states are respected after monitoring starts."
requirements-completed: [VIN-01, VIN-02, VIN-03, VIN-04, VIN-05, VIN-06]
duration: 18min
completed: 2026-05-11
---

# Phase 20 Plan 20-04: VAD Auto-Submit, Conservative Safety, And Final UAT Summary

**Opt-in conservative renderer VAD auto-submit wired through the existing VoiceCapture, Chat final-text submission, and active-turn queueing paths.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-11T05:21:30Z
- **Completed:** 2026-05-11T05:39:32Z
- **Tasks:** 6
- **Files modified:** 14

## Accomplishments

- Added `VadController`, a lightweight Web Audio analyser/RMS gate that starts recording on threshold crossing and finalizes after the configured silence timeout.
- Made VAD explicit opt-in with conservative defaults: disabled, low sensitivity, and 1800 ms silence timeout.
- Wired VAD into `VoiceInputControl` so it reuses `VoiceCapture`, preview/final transcription, Chat's unchanged `text-input` submit path, and one-slot active-turn queueing.
- Added concise Chat and Settings state/safety copy, including a Phase 22 no-headphones/AEC deferral instead of a support claim.
- Added VAD unit tests and Chat/Settings/store regression coverage, plus final `20-UAT.md` evidence/status tracking.

## Task Commits

1. **Tasks 1-5: VAD controller, Chat/Settings integration, conservative copy, and tests** - `7fd4ff8` (feat)
2. **Task 6: Phase 20 UAT, summary, and planning state updates** - this docs commit

## Files Created/Modified

- `apps/renderer/src/audio/vad-controller.ts` - Web Audio RMS VAD controller with sensitivity thresholds, silence timeout finalization, active-speaking block, and cleanup.
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx` - Starts VAD monitoring after STT readiness and mic permission, reuses PTT capture/finalization, and shows VAD state/safety copy.
- `apps/renderer/src/state/audio-settings.ts` - Sets conservative VAD defaults.
- `apps/renderer/src/screens/Settings/VoiceInputSection.tsx` - Adds VAD safety copy near opt-in controls.
- `apps/renderer/src/lib/copy.ts` - Adds Chat VAD state labels and conservative Phase 22 deferral copy.
- `apps/renderer/src/index.css` - Adds compact VAD chip layout.
- `apps/renderer/tests/vad-controller.test.ts` - Covers thresholds, RMS, threshold start, silence finalization, sensitivity/timeout behavior, speaking block, and no wake-word surface.
- `apps/renderer/tests/ChatVoiceInput.test.tsx` - Covers disabled-by-default VAD, readiness-gated VAD monitoring, visible VAD state, and speaking block copy.
- `apps/renderer/tests/Settings.test.tsx` - Updates conservative default expectation.
- `apps/renderer/tests/voice-input-store.test.ts` - Updates conservative default expectation.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-UAT.md` - Automated evidence plus manual live-check status matrix.

## Verification

- `npm --workspace apps/renderer run test -- --run voice-capture` - PASS, 5 tests
- `npm --workspace apps/renderer run test -- --run vad-controller` - PASS, 7 tests
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput` - PASS, 13 tests
- `npm --workspace apps/renderer run test -- --run ChatStreaming` - PASS, 8 tests
- `npm --workspace apps/renderer run test -- --run Settings` - PASS, 61 tests
- `npm --workspace apps/renderer run typecheck` - PASS
- `npm --workspace apps/electron-main run build` - PASS
- `cd sidecar; uv run pytest tests/admin/test_audio_voice_input_endpoint.py tests/stt -q` - PASS, 15 tests

## Decisions Made

- Changed the existing VAD default sensitivity from `medium` to `low` and silence timeout from `1200` to `1800` to satisfy the plan's conservative Phase 20 requirement.
- Kept VAD as a controller layered above `VoiceCapture`, not inside the transcription or Chat submit logic, so final transcripts continue through the same PTT path.
- Kept no-headphones support as a warning/deferral only; Phase 20 does not claim AEC success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed VAD callback stale voice state**
- **Found during:** Task 2 (Wire VAD to existing capture and submit paths)
- **Issue:** VAD callbacks created when monitoring started could read stale `voice.captureStatus`, which risked missing later queued/finalizing state changes.
- **Fix:** `VoiceInputControl` now keeps latest voice state in a ref and VAD callbacks read from that ref.
- **Files modified:** `apps/renderer/src/screens/Chat/VoiceInputControl.tsx`
- **Verification:** `npm --workspace apps/renderer run test -- --run ChatVoiceInput`; `npm --workspace apps/renderer run typecheck`
- **Committed in:** `7fd4ff8`

---

**Total deviations:** 1 auto-fixed bug
**Impact on plan:** The fix preserves the planned active-turn and finalization safety without expanding scope.

## Known Stubs

None in the Phase 20 VAD implementation. `20-UAT.md` intentionally marks live microphone/manual playback checks as pending because this executor is headless.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: microphone-monitoring | apps/renderer/src/audio/vad-controller.ts | VAD opens a renderer microphone monitoring stream only after explicit opt-in, STT readiness, and microphone permission; tracks are stopped on controller stop/error. |

## Issues Encountered

- `gsd-sdk query` is unavailable in this checkout, so planning state, roadmap, and requirements updates were applied manually.
- Renderer typecheck initially rejected a generic `Uint8Array<ArrayBufferLike>` argument for `AnalyserNode.getByteTimeDomainData`; the VAD sample buffer now uses an explicit `ArrayBuffer`.

## User Setup Required

Live UAT still requires a real app session with a microphone and a ready STT provider. The manual checklist and statuses are in `20-UAT.md`.

## Next Phase Readiness

Phase 21 can use the completed Phase 20 voice input path for code-switch quality evaluation. Phase 22 remains responsible for empirical AEC/no-headphones behavior and any stronger no-headphones support copy.

## Self-Check: PASSED

- Created files exist: `apps/renderer/src/audio/vad-controller.ts`, `apps/renderer/tests/vad-controller.test.ts`, `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-UAT.md`, `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-04-SUMMARY.md`.
- Commit exists: `7fd4ff8`.
- Verification commands above passed.

---
*Phase: 20-renderer-voice-capture-ptt-vad-preview-ux*
*Completed: 2026-05-11*
