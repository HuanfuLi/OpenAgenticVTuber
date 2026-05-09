---
phase: 13-conversation-history-sessions
plan: 02
subsystem: chat-ui
tags: [chat, history-sheet, streaming, local-history, react]
requires:
  - phase: 13-conversation-history-sessions
    provides: Plan 13-01 conversation store, IPC bridge, and renderer provider
provides:
  - Real History sheet session manager
  - Chat hydration from active local session
  - Complete-turn persistence on conversation-chain-end
affects: [phase-13, phase-14, chat, history]
tech-stack:
  added: []
  patterns: [complete-turn-boundary, dispatcher-registered-commit, real-history-manager]
key-files:
  created:
    - apps/renderer/tests/HistorySheet.test.tsx
  modified:
    - apps/renderer/src/screens/Chat/Chat.tsx
    - apps/renderer/src/screens/Chat/useStreamingMessages.ts
    - apps/renderer/src/ws/store.ts
    - apps/renderer/src/chrome/HistorySheet.tsx
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/src/index.css
    - apps/renderer/tests/Chat.test.tsx
    - apps/renderer/tests/useStreamingMessages.test.ts
key-decisions:
  - "Persistence commits only one complete user/assistant turn on conversation-chain-end."
  - "Failed turns are invalidated at the streaming reducer and never exposed for persistence."
  - "Session id is captured when the user sends a message so an in-flight turn cannot commit to a later-selected session."
requirements-completed: [HIST-01, HIST-02, HIST-03, HIST-05]
duration: 45min
completed: 2026-05-09
---

# Phase 13 Plan 02: Chat and History Integration Summary

**Chat restores local transcripts and the History sheet manages real sessions instead of placeholder threads**

## Performance

- **Duration:** 45 min
- **Started:** 2026-05-09T09:06:00-04:00
- **Completed:** 2026-05-09T09:51:00-04:00
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Extended the streaming reducer with a one-shot completed-turn candidate, consumed-turn cleanup, and failed-turn invalidation.
- Wired `conversation-chain-end` to commit complete turns through the conversation-history provider while preserving existing input, speaking, Thinking, and force-new behavior.
- Hydrated Chat from the active persisted session before live streaming bubbles.
- Replaced `PLACEHOLDER_THREADS` History rendering with a real searchable session manager supporting create, switch, rename, and delete.
- Added History and streaming regression tests for real sessions, search/filtering, completed-turn extraction, and failed-turn skip.

## Task Commits

1. **Task 1: Add an explicit completed-turn boundary to streaming chat** - `4962de1` (feat/test)
2. **Task 2: Hydrate Chat from the active session and commit complete turns** - `4962de1` (feat/test)
3. **Task 3: Replace placeholder History sheet with real session manager** - `4962de1` (feat/test)

## Files Created/Modified

- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` - Completed-turn candidate, consumed cleanup, and failed-turn skip state.
- `apps/renderer/src/ws/store.ts` - Chain-end commit routing to conversation history.
- `apps/renderer/src/screens/Chat/Chat.tsx` - Persisted active-session transcript rendering and session-id capture on send.
- `apps/renderer/src/chrome/HistorySheet.tsx` - Real local session list/search/create/select/rename/delete manager.
- `apps/renderer/src/lib/copy.ts` - Real local history copy.
- `apps/renderer/src/index.css` - Dense History row/search/action styling.
- `apps/renderer/tests/HistorySheet.test.tsx` - Session manager regression tests.
- `apps/renderer/tests/Chat.test.tsx` and `apps/renderer/tests/useStreamingMessages.test.ts` - Hydration and turn-boundary coverage.

## Decisions Made

- History session management lives in the History sheet, not Settings.
- Chat clears consumed streaming bubbles after a successful history commit so the persisted transcript does not double-render.
- Normal History sheet code no longer imports `PLACEHOLDER_THREADS`; the dev scripted conversation path remains isolated to the existing dev event.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

One HistorySheet test initially queried a non-unique Delete button. The test was tightened to act within the intended session row.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 13-03 can surface real counts/reset in Settings and document restart UAT against the now-wired local transcript path.

---
*Phase: 13-conversation-history-sessions*
*Completed: 2026-05-09*
