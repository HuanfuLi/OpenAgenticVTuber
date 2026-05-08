---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 06
subsystem: compositor
tags: [avt-10, cursor, vts, win32, pytest]

requires:
  - phase: 04-action-compositor-vts-bridge-body-sway-investigation
    provides: D-09/D-11 sidecar Win32 cursor/window polling decision
provides:
  - AVT-10 regression coverage for sidecar Win32 cursor/window samples
  - Cached VTS HWND reuse and force-reprobe tests
  - Cursor driver documentation for the accepted sidecar-only contract
affects: [phase-04, phase-10, avt-10, cursor-tracking]

tech-stack:
  added: []
  patterns:
    - Sidecar patches get_cursor_and_rect directly in cursor tests
    - Window detection tests mock win32gui and avoid a real VTS process

key-files:
  created:
    - .planning/phases/04-action-compositor-vts-bridge-body-sway-investigation/04-06-SUMMARY.md
  modified:
    - sidecar/src/sidecar/compositor/cursor_driver.py
    - sidecar/src/sidecar/vts/window_detect.py
    - sidecar/tests/compositor/test_cursor_driver.py
    - sidecar/tests/vts/test_window_detect.py

key-decisions:
  - "Stale renderer-overlay verification wording is superseded by the locked D-09/D-11 sidecar Win32 cursor contract."
  - "CursorDriver emits ParamAngle/ParamEyeBall IDs for AVT-10 cursor output while preserving the existing 80px dead zone and 800ms cubic ease-back."

patterns-established:
  - "AVT-10 cursor tests patch sidecar.compositor.cursor_driver.get_cursor_and_rect directly, proving no renderer event path is required."
  - "VTS HWND cache behavior is tested by mocking win32gui.EnumWindows rather than requiring a real VTube Studio process."

requirements-completed: [AVT-10]

duration: 4min
completed: 2026-05-08
---

# Phase 04 Plan 06: AVT-10 Cursor Contract Summary

**Sidecar Win32 VTS bounds plus cursor polling is now tested and documented as the accepted AVT-10 contract.**

## Performance

- **Duration:** 4min
- **Started:** 2026-05-08T05:31:45Z
- **Completed:** 2026-05-08T05:35:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added focused CursorDriver tests proving sidecar Win32 samples drive `ParamAngleX`, `ParamAngleY`, `ParamEyeBallX`, and `ParamEyeBallY` without renderer events.
- Tightened dead-zone and ease-back coverage: inside the 80px face-center dead zone returns zeros for all four cursor params, and cursor exit eases back before expiring to `{}` after `EASE_BACK_DURATION_S`.
- Added VTS window-detection tests for cached HWND reuse and `force_reprobe=True` refresh behavior without requiring a live VTS process.
- Documented that stale renderer-overlay verification wording is superseded by locked D-09/D-11 sidecar Win32 cursor polling.

## Task Commits

1. **Task 1 RED: Lock AVT-10 sidecar-only cursor contract in tests** - `97d7b5f` (test)
2. **Task 1 GREEN: Implement AVT-10 cursor param contract** - `1f5489d` (feat)
3. **Task 2: Document the accepted AVT-10 equivalent in sidecar code** - `ba72994` (docs)

## Files Created/Modified

- `sidecar/tests/compositor/test_cursor_driver.py` - Added sidecar Win32 sample contract, complete dead-zone param, and exit/ease-back assertions.
- `sidecar/tests/vts/test_window_detect.py` - Added cached-HWND no-reprobe and force-reprobe regression tests.
- `sidecar/src/sidecar/compositor/cursor_driver.py` - Emits `ParamAngle*` and `ParamEyeBall*` IDs for cursor output and documents the sidecar-only contract.
- `sidecar/src/sidecar/vts/window_detect.py` - Documents authoritative sidecar VTS bounds refresh and cursor sample behavior.

## Verification

- `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/vts/test_window_detect.py -x -v` - PASS, 13 passed.
- `rg "cursor-reaction|CursorReactionMessage|AvatarCursorOverlay|apply_reaction_intent" sidecar/src/sidecar/compositor/cursor_driver.py sidecar/src/sidecar/vts/window_detect.py sidecar/tests/compositor/test_cursor_driver.py sidecar/tests/vts/test_window_detect.py` - PASS, no matches.
- `rg "sidecar Win32 sample contract|force_reprobe" sidecar/tests/compositor/test_cursor_driver.py sidecar/tests/vts/test_window_detect.py` - PASS, expected matches found.

## Decisions Made

Stale renderer-overlay verification wording was treated as superseded by the locked D-09/D-11 sidecar Win32 cursor contract. No renderer overlay, renderer WS cursor message, or renderer-authoritative cursor event path was introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cursor driver emitted legacy internal param names**
- **Found during:** Task 1 GREEN
- **Issue:** New AVT-10 tests failed because `_cursor_to_param_angles()` emitted `FaceAngleX`, `FaceAngleY`, `EyeLeftX`, and `EyeRightY` while the accepted cursor contract expects `ParamAngleX`, `ParamAngleY`, `ParamEyeBallX`, and `ParamEyeBallY`.
- **Fix:** Updated CursorDriver output keys while preserving the existing cursor math, 80px dead zone, and 800ms cubic ease-back.
- **Files modified:** `sidecar/src/sidecar/compositor/cursor_driver.py`
- **Verification:** Targeted pytest command passed with 13 tests.
- **Committed in:** `1f5489d`

---

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The bug fix was required for the AVT-10 accepted contract and stayed inside the plan-owned cursor driver.

## Issues Encountered

None beyond the planned TDD red failure and the auto-fixed cursor param-name bug.

## Known Stubs

None found in files created or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

AVT-10 is closed at the sidecar contract level. Later live verification can focus on visible VTS avatar motion rather than re-litigating renderer cursor ownership.

## Self-Check: PASSED

- Files exist: `cursor_driver.py`, `window_detect.py`, `test_cursor_driver.py`, `test_window_detect.py`, and this summary.
- Commits exist: `97d7b5f`, `1f5489d`, `ba72994`.
- Verification passed: targeted pytest suite reports 13 passed.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-08*
