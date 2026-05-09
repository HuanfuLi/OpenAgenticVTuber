---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 05
subsystem: compositor
tags: [intent-driver, exp3, vts, param-frame, avt-08]

requires:
  - phase: 04-action-compositor-vts-bridge-body-sway-investigation
    provides: "Compositor merge path and expression intent queue"
provides:
  - "Expression ActionIntent rendering through exp3-backed ParamFrame set_params"
  - "300ms expression ramp-in and 600ms sentence-complete decay"
  - "Regression coverage forbidding expression hotkey requests"
affects: [phase-04, phase-05-verification, default-plugin-migration]

tech-stack:
  added: []
  patterns:
    - "Expression exp3 Parameters[] are cached by normalized intent name and emitted as set-param value/weight tuples"

key-files:
  created: []
  modified:
    - sidecar/src/sidecar/compositor/intent_driver.py
    - sidecar/src/sidecar/ws/server.py
    - sidecar/tests/compositor/test_intent_driver.py

key-decisions:
  - "Expression intents no longer use VTS hotkeys; HotkeyTriggerRequest remains reserved for DiscreteEvent AVT-09 in sidecar/src/sidecar/vts/discrete_dispatcher.py."
  - "IntentDriver resolves expression files from AvatarCapabilities plus avatar_dir, with a Teto Live2D fallback for checked-in dev assets."

patterns-established:
  - "Intent overlays produce dict[str, tuple[value, weight]] for ParamFrame.set_params."
  - "Sentence-complete starts expression ramp-out at the tick that drains the completion queue."

requirements-completed: [AVT-03, AVT-08]

duration: 4min
completed: 2026-05-08
---

# Phase 04 Plan 05: Expression Intent Blend Summary

**exp3-backed expression intents now emit weighted ParamFrame set_params with 300ms ramp-in, 600ms sentence-end decay, and no expression hotkey requests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-08T01:31:45Z
- **Completed:** 2026-05-08T01:35:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Replaced the old expression hotkey tests with weighted set-param tests using a temporary `joy.exp3.json`.
- Implemented `IntentDriver.tick()` output as `{param_id: (value, weight)}` with `RAMP_IN_MS = 300.0` and `RAMP_OUT_MS = 600.0`.
- Removed expression hotkey scheduling from `IntentDriver`; AVT-09 hotkeys remain isolated in `sidecar/src/sidecar/vts/discrete_dispatcher.py`.
- Wired the live server constructor to pass `avatar_dir=teto_dir` so expression files resolve through `Live2D`/avatar assets.

## Task Commits

1. **Task 1: Replace expression hotkey tests with weighted blend tests** - `b519067` (test)
2. **Task 2: Implement exp3-backed weighted set_params in IntentDriver** - `fa6a39e` (feat)

## Files Created/Modified

- `sidecar/tests/compositor/test_intent_driver.py` - Tests exp3-backed ParamJoy value/weight output, mid-ramp/full-ramp weights, sentence-end decay, and forbidden hotkey requests.
- `sidecar/src/sidecar/compositor/intent_driver.py` - Loads expression exp3 parameters, caches them by normalized name, computes ramp weights, and returns set-param tuples.
- `sidecar/src/sidecar/ws/server.py` - Passes `avatar_dir=teto_dir` into the compositor intent driver.

## Decisions Made

- Expression intents are continuous parameter overlays, not VTS expression/hotkey activations.
- Unknown expression names or missing exp3 files log warnings and emit no params, preserving compositor stability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected sentence-complete test timeline**
- **Found during:** Task 2 (Implement exp3-backed weighted set_params in IntentDriver)
- **Issue:** The RED test queued sentence-complete and immediately checked `end + 300ms`, which would make the driver drain the completion signal at the later timestamp.
- **Fix:** Added a `driver.tick(end)` step so ramp-out starts at the intended sentence-end time.
- **Files modified:** `sidecar/tests/compositor/test_intent_driver.py`
- **Verification:** `cd sidecar && uv run pytest tests/compositor/test_intent_driver.py -x -v`
- **Committed in:** `fa6a39e`

---

**Total deviations:** 1 auto-fixed bug
**Impact on plan:** Kept the TDD test aligned with the planned sentence-end decay semantics; no scope expansion.

## Issues Encountered

None beyond the corrected RED-test timing issue.

## Known Stubs

- `sidecar/src/sidecar/ws/server.py:47` has a pre-existing `TODO Phase 5` for Electron-main env-var handoff. It is unrelated to this plan and does not block expression intent blending.

## Verification

- `cd sidecar && uv run pytest tests/compositor/test_intent_driver.py -x -v` - **PASS**, 3 passed.
- `cd sidecar && uv run pytest tests/compositor/test_intent_driver.py tests/compositor/test_compositor.py tests/test_orchestrator_turn.py -x -v` - **PASS**, 30 passed.
- `cd sidecar && rg "requestTriggerHotKey|HotkeyTriggerRequest|ExpressionActivationRequest|requestActivateExpression" src/sidecar/compositor/intent_driver.py` - **PASS**, no matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

AVT-08 and the intent-overlay half of AVT-03 are code-supported for Phase 5 or milestone-2 verification. Live VTS visual verification still needs an operator-run rig session.

## Self-Check: PASSED

- Found modified files: `intent_driver.py`, `server.py`, `test_intent_driver.py`, and this summary.
- Found commits: `b519067`, `fa6a39e`.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-08*
