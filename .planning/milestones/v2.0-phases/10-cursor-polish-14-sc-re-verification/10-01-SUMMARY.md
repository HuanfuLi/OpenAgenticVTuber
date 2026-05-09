---
phase: 10-cursor-polish-14-sc-re-verification
plan: 01
subsystem: cursor-tracking
tags: [cursor, vts, pywin32, compositor, verification]

requires:
  - phase: 06-plugin-runtime-default-plugin
    provides: ARCH-05 compositor merge order and ARCH-06 single-writer invariant
  - phase: 09-slider-hud-per-param-lock
    provides: current compositor lock/filter integration to preserve during cursor fix
provides:
  - CursorDriver emits VTS tracking-input names instead of Cubism parameter names
  - Cursor projection continues outside the VTS window rectangle
  - Primary-monitor synthetic-canvas fallback when VTS window bounds are unavailable
  - Regression coverage for cursor namespace, fallback, dead-zone, and ARCH-06 carry-through
affects: [phase-10, skeleton-verification, cursor-tracking, arch-06]

tech-stack:
  added: []
  patterns:
    - Driver-edge Cubism-to-VTS tracking-input translation through resolve_param_id
    - Synthetic primary-monitor canvas fallback via window_detect helper

key-files:
  created:
    - sidecar/tests/compositor/test_cursor_driver_namespace.py
    - .planning/phases/10-cursor-polish-14-sc-re-verification/deferred-items.md
  modified:
    - sidecar/src/sidecar/compositor/cursor_driver.py
    - sidecar/src/sidecar/vts/window_detect.py
    - sidecar/tests/compositor/test_cursor_driver.py
    - sidecar/tests/vts/test_window_detect.py

key-decisions:
  - "Cursor translation is applied at the CursorDriver edge with resolve_param_id rather than at the compositor merge."
  - "The in-VTS-window gate is removed; outside-rect cursor positions project and clamp instead of returning empty."
  - "When VTS bounds are unavailable, CursorDriver projects against the primary monitor synthetic canvas when available."
  - "The legacy ease-back state remains in cursor_driver.py for diff continuity but is no longer reachable from normal tick() flow after the gate removal."

patterns-established:
  - "Cursor output keys are asserted against VTS_TRACKING_INPUT_PARAM_IDS so Cubism-name regressions fail fast."
  - "ARCH-06 is verified both by pytest and direct pyvts import-count grep for cursor changes."

requirements-completed: [VFY-01, VFY-02]

duration: 5 min
completed: 2026-05-09
---

# Phase 10 Plan 01: Cursor Fix Summary

**Cursor tracking now emits VTS tracking-input names with outside-window projection and primary-monitor fallback.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-09T06:18:23Z
- **Completed:** 2026-05-09T06:23:46Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Confirmed the 4-hypothesis cursor investigation outcome from research: window detection was not the primary blocker, real boot wiring was intact, Win32 permissions were not implicated, and the confirmed root cause was cursor output using Cubism names instead of VTS tracking-input names.
- Added `get_primary_monitor_rect()` and tests so cursor tracking can project against a synthetic primary-monitor canvas when VTS bounds are unavailable.
- Fixed `CursorDriver` to translate output keys through `resolve_param_id(..., "vts")`, drop the old in-window gate, and preserve dead-zone behavior with translated keys.
- Added namespace regression coverage proving cursor output keys are in `VTS_TRACKING_INPUT_PARAM_IDS` and do not leak `ParamAngleX/Y/Z` or `ParamEyeBallX/Y`.
- Verified ARCH-06 carry-through: direct pyvts import grep returned exactly one file, `sidecar/src/sidecar/vts/pyvts_writer.py`.

## Task Commits

1. **Task 1: Wave 0 helper and RED namespace scaffold** - `33d2ad0` (test)
2. **Task 2: Cursor namespace fix, gate removal, fallback tests** - `3fcc667` (fix)
3. **Task 3: Validation gates and deferred full-suite note** - `8461f01` (test)

## Files Created/Modified

- `sidecar/tests/compositor/test_cursor_driver_namespace.py` - New regression test for VTS tracking-input-only cursor output.
- `sidecar/src/sidecar/vts/window_detect.py` - Added primary monitor rect helper for synthetic-canvas fallback.
- `sidecar/tests/vts/test_window_detect.py` - Added four primary-monitor helper tests.
- `sidecar/src/sidecar/compositor/cursor_driver.py` - Added VTS input-key translation, removed in-window gate, and wired primary-monitor fallback.
- `sidecar/tests/compositor/test_cursor_driver.py` - Flipped assertions to VTS tracking-input names, replaced old outside-window empty behavior, and added synthetic-canvas fallback coverage.
- `.planning/phases/10-cursor-polish-14-sc-re-verification/deferred-items.md` - Documents unrelated full-suite failures discovered during Task 3.

## Decisions Made

- Driver-edge translation was chosen because every other active driver already emits VTS tracking-input names; cursor was the only outlier.
- Outside-window cursor positions now clamp to the rectangle boundary instead of starting ease-back, because Phase 10 requires desktop-wide tracking behavior.
- Synthetic fallback uses raw primary-monitor pixel bounds; DPI and multi-monitor handling remain explicitly deferred by VFY-02.

## Verification

- `cd sidecar && uv run pytest tests/vts/test_window_detect.py -x -q` -> 8 passed.
- RED proof: `cd sidecar && uv run pytest tests/compositor/test_cursor_driver_namespace.py -x -q` failed before Task 2 with leaked Cubism names.
- `cd sidecar && uv run pytest tests/compositor/test_cursor_driver_namespace.py -x -q` -> 2 passed after Task 2.
- `cd sidecar && uv run pytest tests/test_arch06_single_writer.py -x -q` -> 3 passed.
- `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py -x -q` -> 21 passed.
- Direct grep gate: `^import pyvts|^from pyvts` under `sidecar/src/sidecar/**/*.py` -> count 1, only `sidecar/src/sidecar/vts/pyvts_writer.py`.
- Final focused phase gate: `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py tests/compositor/test_compositor.py -x -v` -> 28 passed.
- Full suite: `cd sidecar && uv run pytest -q` -> 348 passed, 2 skipped, 2 failed in out-of-scope stale `ActionIntent` tests. See Issues Encountered.

## Deviations from Plan

None for cursor implementation - plan changes were applied as written.

## Issues Encountered

Full sidecar suite did not pass because `tests/test_avatar_capabilities.py` still imports deleted `ActionIntent` symbols from `contracts`. This is unrelated to 10-01 cursor/window changes and is logged in `deferred-items.md` per the GSD scope-boundary rule.

## Known Stubs

None found in files created or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 10-02 can proceed to the operator ceremony. Cursor SC #5 now has code evidence for VTS tracking-input namespace, outside-window projection, synthetic-canvas fallback, and ARCH-06 preservation; these are the inputs for `skeleton-verification.md` section "§14 SC #5".

## Self-Check: PASSED

- Confirmed created/modified files listed in this summary exist on disk.
- Confirmed task commits `33d2ad0`, `3fcc667`, and `8461f01` exist in git history.

---
*Phase: 10-cursor-polish-14-sc-re-verification*
*Completed: 2026-05-09*
