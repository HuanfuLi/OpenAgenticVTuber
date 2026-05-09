---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 01
subsystem: vts-compositor-foundation
tags: [vts, pyvts, asyncio, contracts, dpi, hotkeys, compositor]
requires:
  - phase: 04-00
    provides: TetoOverrides and discovered hotkeys for dispatcher lookup
provides:
  - PyvtsSafeWriter single-recv-loop wrapper for concurrent VTS requests
  - Non-blocking VTS connect/auth handshake coroutine
  - ParamFrame and DiscreteEvent Python/TypeScript contracts
  - Renderer-aware ParamID resolver for VTS input-layer names
  - DiscreteDispatcher HotkeyTriggerRequest path with meta-hotkey guard
  - Windows DPI-awareness setup before sidecar imports
affects: [04-02-compositor, 04-03-cursor-discrete-demo, phase-5-codegen]
tech-stack:
  added:
    - pywin32==311 ; sys_platform == "win32"
    - opensimplex==0.4.5.1
    - numpy>=1.26
  patterns:
    - single websocket recv loop with requestID future dispatch
    - VTS input-layer param resolver pass-through
    - sparse DiscreteEvent hotkey dispatch beside 60Hz ParamFrame path
key-files:
  created:
    - packages/contracts/py/contracts/param_frame.py
    - packages/contracts/py/contracts/discrete_event.py
    - packages/contracts/ts/param-frame.ts
    - packages/contracts/ts/discrete-event.ts
    - sidecar/src/sidecar/vts/pyvts_writer.py
    - sidecar/src/sidecar/vts/handshake.py
    - sidecar/src/sidecar/vts/discrete_dispatcher.py
    - sidecar/src/sidecar/compositor/param_id_resolver.py
    - sidecar/src/sidecar/compositor/param_frame.py
    - sidecar/tests/vts/conftest.py
    - sidecar/tests/vts/test_pyvts_writer.py
    - sidecar/tests/vts/test_discrete_dispatcher.py
    - sidecar/tests/compositor/test_param_id_resolver.py
  modified:
    - sidecar/src/sidecar/__main__.py
    - sidecar/src/sidecar/vts/__init__.py
    - sidecar/src/sidecar/compositor/__init__.py
    - sidecar/pyproject.toml
    - sidecar/uv.lock
    - sidecar/vendor/pyvts/PROVENANCE.md
    - packages/contracts/py/contracts/__init__.py
key-decisions:
  - "Kept vendored pyvts source unchanged and implemented issue-#51 mitigation in project code via PyvtsSafeWriter."
  - "VTS ParamID resolution returns input-layer names verbatim; non-VTS renderers remain explicit NotImplementedError stubs."
  - "DiscreteDispatcher refuses meta hotkeys by default; force=True is required for operator-only meta actions."
patterns-established:
  - "Only PyvtsSafeWriter._recv_loop calls websocket.recv; concurrent callers await requestID-correlated futures."
  - "DPI awareness is set in sidecar.__main__ before importing sidecar.main."
requirements-completed: [AVT-04, AVT-05, AVT-09]
duration: 2h 15min
completed: 2026-05-07
---

# Phase 04 Plan 01: VTS Infrastructure Summary

**Safe VTS writer, compositor contracts, dispatcher path, and DPI-aware sidecar bootstrap for Phase 4**

## Performance

- **Duration:** 2h 15min
- **Started:** 2026-05-07T22:50:00Z
- **Completed:** 2026-05-08T01:05:00Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added `ParamFrame`, `ParamMode`, and `DiscreteEvent` Python contracts plus TypeScript mirrors.
- Added `PyvtsSafeWriter`, which centralizes VTS websocket receive handling in a single `_recv_loop` and dispatches replies by `requestID`.
- Added `connect_and_authenticate(writer)` so sidecar boot can start VTS auth as a background task after `[READY]`.
- Added VTS ParamID resolver and `DiscreteDispatcher` with `fire()` and `fire_by_name()` paths backed by `TetoOverrides`.
- Added Windows DPI-awareness call at sidecar process entry before importing sidecar internals.

## Task Commits

1. **Task 1 RED: bootstrap and contract tests** - `a0074e3` (test)
2. **Task 1 GREEN: contracts, deps, and DPI bootstrap** - `c8436a8` (feat)
3. **Task 2 GREEN: safe writer and handshake** - `c741f1b` (feat)
4. **Task 3 RED: resolver and dispatcher tests** - `1252aa0` (test)
5. **Task 3 GREEN: resolver and dispatcher** - `fb4dbb6` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/vts/pyvts_writer.py` - Single-writer safe VTS request wrapper with one websocket recv loop.
- `sidecar/src/sidecar/vts/handshake.py` - Connect/auth coroutine for non-blocking VTS startup integration.
- `sidecar/src/sidecar/vts/discrete_dispatcher.py` - HotkeyTriggerRequest dispatcher and name lookup from overrides.
- `sidecar/src/sidecar/compositor/param_id_resolver.py` - VTS pass-through resolver and explicit non-VTS stubs.
- `packages/contracts/py/contracts/param_frame.py` - 60Hz compositor frame contract.
- `packages/contracts/py/contracts/discrete_event.py` - Sparse hotkey event contract.
- `packages/contracts/ts/param-frame.ts` and `packages/contracts/ts/discrete-event.ts` - Hand-written TS mirrors.
- `sidecar/src/sidecar/__main__.py` - DPI awareness call at line 9 before sidecar imports.
- `sidecar/vendor/pyvts/PROVENANCE.md` - Wrapper-not-patch decision for issue #51.

## Decisions Made

- `inspect.getsource(PyvtsSafeWriter).count("websocket.recv") == 1`; only `_recv_loop` receives from the socket.
- Vendored `pyvts/vts.py` was not patched. The mitigation lives in `sidecar/src/sidecar/vts/pyvts_writer.py`, minimizing vendor drift.
- `inject_params()` sends one add bucket and one request per set-param entry. This is stricter than raw concurrent pyvts and is covered by tests.
- `AVT-02` is not marked complete here. This plan provides foundations; the idle baseline driver itself lands in `04-02`.

## Deviations from Plan

### Auto-fixed Issues

None - plan implementation scope was preserved.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No implementation scope expansion.

## Issues Encountered

- The spawned executor did not return a completion signal and was shut down after it drifted into unrelated Phase 5 planning/research commits. The `04-01` implementation commits were kept and verified locally.
- The executor created unrelated Phase 5 commits (`a72f5a7`, `c80d5e2`, `3772ab7`, `799cde7`). They are outside this plan and were not reverted.
- `uv` checks required escalated execution because the sandbox cannot access the global uv cache in `AppData\Local\uv\cache`.

## Verification

- `cmd /c uv run pytest tests/vts/ tests/compositor/test_param_id_resolver.py -x -v` - 12 passed.
- `cmd /c uv run python -c "from contracts import ParamFrame, DiscreteEvent; from sidecar.vts import PyvtsSafeWriter, connect_and_authenticate; from sidecar.compositor import resolve_param_id; from sidecar.vts.discrete_dispatcher import DiscreteDispatcher; print('all imports OK')"` - passed.
- `cmd /c uv run python -c "import opensimplex; print(opensimplex.__version__)"` - `0.4.5.1`.
- `cmd /c uv run python -c "import win32gui; print('pywin32 OK')"` - passed on Windows.
- `cmd /c npx tsc --noEmit -p apps/renderer/tsconfig.json` - passed.
- `Select-String` confirmed exactly one `websocket.recv` call in `sidecar/src/sidecar/vts/pyvts_writer.py`.
- `SetProcessDpiAwareness(2)` appears at `sidecar/src/sidecar/__main__.py:9`, before `from .main import main`.

## User Setup Required

None - no new external setup required.

## Next Phase Readiness

04-02 can consume `ParamFrame`, `PyvtsSafeWriter.inject_params()`, and `resolve_param_id()` to build the 60Hz compositor and drivers. 04-03 can use `DiscreteDispatcher.fire_by_name()` with `avatars/teto/teto_overrides.yaml` for the visible hotkey demo.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-07*
