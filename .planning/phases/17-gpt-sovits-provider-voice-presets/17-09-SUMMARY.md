---
phase: 17-gpt-sovits-provider-voice-presets
plan: 09
subsystem: renderer
tags: [react, vitest, websocket, hmr, gpt-sovits, chat-streaming]

requires:
  - phase: 17-gpt-sovits-provider-voice-presets
    provides: GPT-SoVITS chat audio payloads and failed-audio UI semantics
provides:
  - Idempotent, HMR-safe renderer WebSocket store subscription registration
  - Duplicate-dispatch regression coverage for normal and failed GPT-SoVITS audio payloads
  - UAT evidence that keeps live Test 6 awaiting user retest
affects: [phase-17-uat, renderer-chat, websocket-dispatch, gpt-sovits]

tech-stack:
  added: []
  patterns:
    - Retain unsubscribe handles for singleton WebSocket store listeners
    - Export testable ensure/dispose subscription lifecycle helpers while preserving module-load registration

key-files:
  created:
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-09-SUMMARY.md
  modified:
    - apps/renderer/src/ws/store.ts
    - apps/renderer/tests/ChatStreaming.test.tsx
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md

key-decisions:
  - "Fixed duplicated GPT-SoVITS chat text at the renderer WS store subscription boundary instead of adding text dedupe in chat state or changing sidecar/provider behavior."
  - "Kept UAT Test 6 marked issue/pending retest until the user confirms live active GPT-SoVITS chat behavior."

patterns-established:
  - "Renderer singleton subscriptions should own unsubscribe handles and expose idempotent ensure/dispose helpers when module re-evaluation is possible."

requirements-completed: [TTS-01, TTS-04, TTS-06]

duration: 8min
completed: 2026-05-10
---

# Phase 17 Plan 09: Duplicate GPT-SoVITS Chat Text Gap Summary

**HMR-safe renderer WebSocket store subscriptions prevent one GPT-SoVITS audio payload from duplicating visible assistant text.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-10T00:03:00Z
- **Completed:** 2026-05-10T00:05:16Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Added failing-first regression coverage for duplicate store registration/HMR simulation, normal first audio after Thinking, and failed GPT-SoVITS audio payloads.
- Refactored `apps/renderer/src/ws/store.ts` so the store owns message/reconnect unsubscribe handles, exposes idempotent `ensureWSStoreSubscriptions()` and `disposeWSStoreSubscriptions()`, and disposes on Vite HMR replacement.
- Recorded Plan 17-09 automated UAT evidence while explicitly leaving live Test 6 as awaiting user retest.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing duplicate-dispatch regression tests** - `ab1773e` (test)
2. **Task 2: Make WS store dispatcher registration idempotent and HMR-safe** - `e230370` (fix)
3. **Task 3: Record gap-fix evidence without claiming live UAT pass** - `a63a8d3` (docs)

**Plan metadata:** pending final commit

## Files Created/Modified

- `apps/renderer/src/ws/store.ts` - Wraps WS message routing in named dispatchers, retains unsubscribe handles, guards registration, and disposes on HMR.
- `apps/renderer/tests/ChatStreaming.test.tsx` - Retains mocked WS listeners with unsubscribe behavior and covers duplicate-registration normal/failed audio regressions.
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md` - Records Plan 17-09 evidence and keeps Test 6 pending user retest.
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-09-SUMMARY.md` - This execution summary.

## Verification

- `npm --workspace apps/renderer run test -- --run ChatStreaming.test.tsx` - PASS, 8 tests.
- `npm --workspace apps/renderer run typecheck` - PASS.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - PASS, 62 tests.

## TDD Gate Compliance

- RED: `ab1773e` added tests that failed against the old `store.ts` because `ensureWSStoreSubscriptions` did not exist and duplicate registration was unguarded.
- GREEN: `e230370` implemented idempotent store subscriptions and made the focused regression tests pass.
- REFACTOR: No separate cleanup commit was needed.

## Decisions Made

- Fixed the root cause at the WebSocket store subscription boundary because sidecar duplicate emission, GPT-SoVITS text mutation, and TTS manager double-sending had already been ruled out.
- Preserved automatic module-load registration for production/runtime imports while adding exported lifecycle helpers for tests and HMR cleanup.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None found in files created or modified by this plan.

## Issues Encountered

- The red test commit intentionally failed before implementation as part of the TDD cycle.
- The mocked WS client needed retained listener/unsubscribe state so tests could simulate duplicate registration without bypassing the real `store.ts` dispatcher path.

## User Setup Required

None - no external service configuration required for the automated regression fix.

## Remaining Blockers

- UAT Test 6 is not marked passed. A user must retest a live active GPT-SoVITS chat turn and confirm visible assistant text no longer duplicates.

## Next Phase Readiness

Phase 17 remains suitable for Phase 18 planning/execution after the live Test 6 retest is completed or carried as explicit pending UAT evidence.

## Self-Check: PASSED

- Found `apps/renderer/src/ws/store.ts`.
- Found `apps/renderer/tests/ChatStreaming.test.tsx`.
- Found `.planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md`.
- Found commits `ab1773e`, `e230370`, and `a63a8d3` in git history.

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-10*
