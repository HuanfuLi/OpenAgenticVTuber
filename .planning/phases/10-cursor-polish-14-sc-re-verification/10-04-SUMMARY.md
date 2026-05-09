---
phase: 10-cursor-polish-14-sc-re-verification
plan: 04
subsystem: cursor-eye-tracking
tags: [cursor, eyes, blink, vts, verification, gap-closure]

requires:
  - phase: 10-cursor-polish-14-sc-re-verification
    plan: 01
    provides: CursorDriver VTS namespace fix and outside-window tracking
  - phase: 10-cursor-polish-14-sc-re-verification
    plan: 03
    provides: SC2 resolved so final §14 close decision can be recomputed
provides:
  - CursorDriver emits full VTS eye input surface
  - Teto horizontal eye tracking uses the correct sign for the rig's inverted X mapping
  - IdleDriver no longer emits routine blink params; VTS owns normal blinking
  - SC5-EYE-TRACKING and BLINK-EYE-VISIBILITY resolved by live UAT
affects: [phase-10, skeleton-verification, cursor-tracking, idle-motion, arch-06]

tech-stack:
  added: []
  patterns:
    - Full VTS eye input surface for cursor gaze
    - Rig-informed sign correction for Teto eye X mapping
    - VTS-owned normal blink; app-owned eye gestures only when explicit and bounded

key-files:
  created:
    - sidecar/tests/compositor/test_cursor_driver_eye_tracking.py
    - .planning/phases/10-cursor-polish-14-sc-re-verification/10-04-SUMMARY.md
  modified:
    - sidecar/src/sidecar/compositor/cursor_driver.py
    - sidecar/src/sidecar/compositor/idle_driver.py
    - sidecar/src/sidecar/compositor/compositor.py
    - sidecar/tests/compositor/test_cursor_driver.py
    - sidecar/tests/compositor/test_cursor_driver_namespace.py
    - sidecar/tests/compositor/test_idle_driver.py
    - sidecar/tests/compositor/test_compositor.py
    - .planning/skeleton-verification.md
    - .planning/phases/10-cursor-polish-14-sc-re-verification/deferred-items.md

key-decisions:
  - "Cursor eye tracking emits EyeLeftX, EyeRightX, EyeLeftY, and EyeRightY rather than only EyeLeftX plus EyeRightY."
  - "Teto's horizontal eye input is inverted because EyeLeftX maps input -0.6..0.6 to ParamEyeBallX output 1..-1."
  - "VTube Studio owns normal idle blinking; IdleDriver must not emit EyeOpenLeft/EyeOpenRight routine blink pulses."
  - "Future deliberate eye gestures such as wink remain allowed as explicit plugin/action/variant output with bounded duration."

requirements-completed: [VFY-01, VFY-02, VFY-03, VFY-04]

duration: 35 min
completed: 2026-05-09
---

# Phase 10 Plan 04: Cursor Eye Tracking Summary

**Cursor head and eye tracking now pass live UAT, and app-owned idle blinking was removed to stop fighting VTS blinking.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-09T07:45:00Z
- **Completed:** 2026-05-09T08:20:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Added regressions for full cursor eye-output surface and blink ownership.
- Changed cursor output from a split two-key eye path to the full VTS eye input surface: `EyeLeftX`, `EyeRightX`, `EyeLeftY`, `EyeRightY`.
- Increased cursor eye deflection enough for visible UAT.
- Fixed Teto horizontal eye direction by inverting eye X after reading the rig's `.vtube.json` mapping.
- Removed app-owned idle blinking entirely after live UAT showed it fought VTS/model-owned blinking and caused half-blinks / long closed holds.
- Documented the ownership rule: VTS owns normal idle blinking; plugins/actions may still implement intentional bounded eye gestures such as wink.
- Updated `.planning/skeleton-verification.md` so SC #5 is PASS and the final Phase 10 §14 verdict is PASS.

## Task Commits

1. **Task 1: Cursor eye and blink RED regressions** - `e78cdd3` (test)
2. **Task 2: Full eye surface and first blink reduction** - `973c74e` (fix)
3. **Task 2: Teto eye-X inversion and reopen pulse** - `989a374` (fix)
4. **Task 2: Absolute blink set attempt** - `16d5d00` (fix)
5. **Task 2 final: remove app-owned idle blinking** - `867c104` (fix)

## Root Cause

SC5 initially failed because the cursor path did not produce visibly correct eye tracking. The first issue was an incomplete eye surface: cursor output represented horizontal and vertical intent with only `EyeLeftX` and `EyeRightY`. The second issue was Teto-specific: the VTS mapping for `EyeLeftX` reverses input to `ParamEyeBallX` output, so horizontal eye movement needed sign inversion.

The blink issue was separate from cursor tracking. VTS/model tracking already owns normal blinking, while `IdleDriver` also emitted app-owned `EyeOpenLeft` / `EyeOpenRight` pulses. Those overlapping blink systems fought VTS smoothing and produced half-blinks, open-to-close flicker, and long closed holds. The robust fix is no app-owned idle blink.

## Verification

- RED proof: `cd sidecar && uv run pytest tests/compositor/test_cursor_driver_eye_tracking.py tests/compositor/test_idle_driver.py -q` failed before implementation.
- Focused cursor/idle gate after final fix: `cd sidecar && uv run pytest tests/compositor/test_idle_driver.py tests/compositor/test_compositor.py tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/compositor/test_cursor_driver_eye_tracking.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py -q` -> 32 passed.
- Earlier full cursor/blink support gate: `cd sidecar && uv run pytest tests/compositor/test_idle_driver.py tests/compositor/test_compositor.py tests/compositor/test_clamp_lock_filter.py tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py tests/compositor/test_cursor_driver_eye_tracking.py tests/vts/test_window_detect.py tests/test_arch06_single_writer.py -q` -> 39 passed.

## Live SC #5 Rerun Verdict

**PASS.** Operator confirmed eye tracking now works with no problem. Operator also confirmed blink behavior passes after app-owned idle blinking was removed and VTS owns normal blinking.

## Deviations from Plan

- **[Rule 1 - Bug found during human verification] Teto horizontal eye sign inversion** — Live UAT showed vertical eye tracking worked but horizontal looked reversed. The `.vtube.json` mapping confirmed `EyeLeftX` input maps to `ParamEyeBallX` output in reverse, so cursor eye X now inverts sign.
- **[Rule 1 - Bug found during human verification] App-owned idle blink conflicts with VTS blinking** — Live UAT showed half-blinks and long closed holds. Removed idle blink output entirely and documented VTS ownership of normal blinking.
- **Total deviations:** 2 auto-fixed.
- **Impact:** Positive; cursor eyes and normal blinking now match live rig behavior.

## Issues Encountered

None remaining for SC #5. DPI awareness and multi-monitor synthetic-canvas projection remain future robustness improvements, not Phase 10 blockers.

## Known Stubs

None found in files created or modified by this plan.

## User Setup Required

None.

## Next Phase Readiness

Phase 10 gap closure is complete. All six §14 success criteria are PASS in `.planning/skeleton-verification.md`.
