---
phase: 10-cursor-polish-14-sc-re-verification
plan: 03
subsystem: default-plugin-action-dispatch
tags: [plugin, action-code, smirk, verification, gap-closure]

requires:
  - phase: 06-plugin-runtime-default-plugin
    provides: DefaultPlugin and PluginSupervisor runtime surfaces
  - phase: 07-three-category-code-parsing-dispatch
    provides: ActionCode dispatch records routed from bracket codes
provides:
  - Routed ActionCode(name="smirk") activates DefaultPlugin through the production supervisor path
  - Smirk fallback composition includes stronger VTS-visible face and mouth inputs
  - SC2-SMIRK-RENDERING is recorded as resolved after operator correction
affects: [phase-10, skeleton-verification, plugin-supervisor, default-plugin]

tech-stack:
  added: []
  patterns:
    - PluginSupervisor delegates action-code callbacks to the wrapped plugin
    - DefaultPlugin supports both raw sentence parsing and explicit ActionCode dispatch

key-files:
  created:
    - .planning/phases/10-cursor-polish-14-sc-re-verification/10-03-SUMMARY.md
  modified:
    - plugins/default/__init__.py
    - sidecar/src/sidecar/plugins/supervisor.py
    - sidecar/tests/plugins/test_default_plugin.py
    - sidecar/tests/plugins/test_supervisor.py
    - sidecar/tests/compositor/test_plugin_adapter.py
    - .planning/skeleton-verification.md
    - .planning/phases/10-cursor-polish-14-sc-re-verification/deferred-items.md

key-decisions:
  - "DefaultPlugin.on_action_code uses the same supported-action activation path as raw sentence parsing."
  - "Unsupported action codes, including joy for active Teto, remain ignored rather than resurrected."
  - "Smirk remains a ParamFrame composition; no pyvts calls, VTS hotkeys, or variant/event ownership changes were introduced."
  - "The production root cause was PluginSupervisor inheriting the base no-op on_action_code instead of delegating to the wrapped plugin."

requirements-completed: [VFY-03, VFY-04]

duration: 18 min
completed: 2026-05-09
---

# Phase 10 Plan 03: Smirk Gap Closure Summary

**Routed `[smirk]` now reaches the default plugin through the production wrapper path, and SC #2 is recorded as PASS after operator correction.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-09T07:25:00Z
- **Completed:** 2026-05-09T07:43:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added RED tests proving `ActionCode(name="smirk")` must activate `DefaultPlugin` directly and through `PluginAdapter`.
- Implemented `DefaultPlugin.on_action_code` and kept unsupported actions as no-ops, preserving active Teto's strict vocabulary where `joy` is invalid.
- Strengthened the fallback smirk composition with visible VTS input params: `FaceAngleZ`, `FaceAngleY`, `MouthSmile`, `EyeOpenLeft`, and `EyeOpenRight`.
- After an initial live false alarm, found the real production wrapper gap: production uses `PluginSupervisor`, and its inherited base `on_action_code` was a no-op. Added supervised dispatch regressions and delegated `PluginSupervisor.on_action_code` to the wrapped plugin.
- Updated `.planning/skeleton-verification.md` so SC #2 is PASS and removed `SC2-SMIRK-RENDERING` from the open visible-animation gap list.
- Recorded the separate blink/eye-visibility issue for Plan 10-04 instead of mixing it into the resolved smirk gap.

## Task Commits

1. **Task 1: Smirk action-code RED regression** - `134ed76` (test)
2. **Task 2: DefaultPlugin action dispatch and stronger smirk output** - `3733271` (fix)
3. **Task 2 follow-up: supervised production-path regression** - `8d9135f` (test)
4. **Task 2 follow-up: supervisor action-code delegation** - `b39511d` (fix)

## Root Cause

The parser/orchestrator path was working: logs showed `[DISPATCH] kind=action name=smirk`. The first implementation added `DefaultPlugin.on_action_code`, but live testing still appeared to fail until the operator corrected that smirk was visible.

The code investigation still found a real production-path issue: `PluginAdapter.enqueue_action_code()` calls `on_action_code` on the active plugin object, which is a `PluginSupervisor` in production. `PluginSupervisor` inherited the `BodyMotionPlugin` base no-op implementation, so explicit action-code callbacks did not delegate to the wrapped `DefaultPlugin`. Commit `b39511d` fixes that delegation.

## Verification

- RED proof before implementation: `cd sidecar && uv run pytest tests/plugins/test_default_plugin.py tests/compositor/test_plugin_adapter.py -q` failed on the new smirk action-code activation tests.
- RED proof before supervisor fix: `cd sidecar && uv run pytest tests/plugins/test_supervisor.py tests/compositor/test_plugin_adapter.py -q` failed on the supervised action-code delegation tests.
- `cd sidecar && uv run pytest tests/plugins/test_supervisor.py tests/compositor/test_plugin_adapter.py tests/plugins/test_default_plugin.py tests/test_orchestrator_turn.py tests/orchestrator/test_dispatch_routing.py tests/test_arch06_single_writer.py -q` -> 61 passed.
- Earlier focused gate: `cd sidecar && uv run pytest tests/plugins/test_default_plugin.py tests/compositor/test_plugin_adapter.py tests/test_orchestrator_turn.py tests/orchestrator/test_dispatch_routing.py -q` -> 52 passed.
- ARCH-06 gate: `cd sidecar && uv run pytest tests/test_arch06_single_writer.py -q` -> 3 passed.

## Live SC #2 Rerun Verdict

**PASS.** Operator initially reported no visible smirk, then corrected the report after seeing Teto's smirk face. `.planning/skeleton-verification.md` now records SC #2 as PASS.

## Deviations from Plan

- **[Rule 1 - Bug found during checkpoint] Production wrapper missed action-code delegation** — Found during SC #2 live false-alarm investigation. The original plan tested direct plugin and adapter paths, but production wraps the plugin in `PluginSupervisor`. Added a supervised regression and delegated `on_action_code` through the supervisor. Files modified: `sidecar/src/sidecar/plugins/supervisor.py`, `sidecar/tests/plugins/test_supervisor.py`, `sidecar/tests/compositor/test_plugin_adapter.py`. Verification: 61 focused tests passed.
- **Total deviations:** 1 auto-fixed.
- **Impact:** Positive; production path now matches the tested direct-plugin behavior.

## Issues Encountered

- Blink timing is a separate eye-visibility issue. `IdleDriver` can produce a 150ms eye closure with a 10% double-blink shortly after; with VTS smoothing this can make eye checks hard. This is now tracked as `BLINK-EYE-VISIBILITY` for Plan 10-04.

## Known Stubs

None found in files created or modified by this plan.

## User Setup Required

None.

## Next Phase Readiness

Ready for Plan 10-04: close `SC5-EYE-TRACKING`, including the blink/eye-visibility support issue.
