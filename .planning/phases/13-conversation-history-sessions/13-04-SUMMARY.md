---
phase: 13-conversation-history-sessions
plan: 04
subsystem: ui
tags: [history-sheet, animation, uat-gap, react, css]
requires:
  - phase: 13-conversation-history-sessions
    provides: Phase 13 History sheet implementation and UAT gap diagnosis
provides:
  - Title-first History rows without visible assistant-response preview
  - History sheet close/collapse animation
affects: [phase-13, history, chat]
tech-stack:
  added: []
  patterns: [hidden-preview-search-index, delayed-unmount-exit-animation]
key-files:
  created: []
  modified:
    - apps/renderer/src/chrome/HistorySheet.tsx
    - apps/renderer/src/index.css
    - apps/renderer/tests/HistorySheet.test.tsx
key-decisions:
  - "History search can still index preview text, but normal rows render title plus metadata only."
  - "History close paths route through one delayed close helper so slide-out animation can complete before unmount."
requirements-completed: [HIST-01, HIST-02]
duration: 15min
completed: 2026-05-09
gap_closure: true
---

# Phase 13 Plan 04: History Row and Collapse Animation Gap Closure

**History rows now show title-first session entries and the sheet animates on close**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-09T10:55:00-04:00
- **Completed:** 2026-05-09T11:10:00-04:00
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Removed visible assistant-response preview text from normal History rows.
- Preserved deterministic search by keeping title plus hidden preview text in the filter index.
- Added delayed close handling so the sheet applies a `.closing` state before unmount.
- Added CSS `slideOut` and overlay fade-out animations.
- Extended HistorySheet tests for hidden preview text, preview-backed search, and close animation before unmount.

## Task Commits

1. **Task 1: Make History rows title-first without visible assistant previews** - `20d8333` (fix/test)
2. **Task 2: Preserve useful search while hiding preview content** - `20d8333` (fix/test)
3. **Task 3: Add History sheet collapse animation** - `20d8333` (fix/test)

## Files Created/Modified

- `apps/renderer/src/chrome/HistorySheet.tsx` - Removes visible preview row, adds shared delayed close helper, disables interactions during closing.
- `apps/renderer/src/index.css` - Adds close animation and removes preview row styling.
- `apps/renderer/tests/HistorySheet.test.tsx` - Covers hidden preview text, preview-backed filtering, and close animation before unmount.

## Decisions Made

- Kept preview search indexing because it was already part of the Phase 13 search behavior and remains useful, but removed it from visible row presentation to match standard session-list UX.
- Used a short 200ms close animation, slightly faster than the 250ms open animation, so dismissal feels responsive while still visible.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope change.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 13 gap closure is implemented. A quick visual recheck should confirm the History rows no longer show assistant previews and the sheet collapses smoothly.

---
*Phase: 13-conversation-history-sessions*
*Completed: 2026-05-09*
