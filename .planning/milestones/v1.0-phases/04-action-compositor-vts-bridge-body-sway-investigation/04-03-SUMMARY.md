---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 03
subsystem: cursor-discrete-demo
tags: [cursor-tracking, win32, vts, discrete-event, hotkey]
requires:
  - phase: 04-00
    provides: Teto hotkey inventory and Star Eye demo target
  - phase: 04-01
    provides: DiscreteDispatcher and PyvtsSafeWriter
  - phase: 04-02
    provides: Compositor cursor_driver slot and control handler skeleton
provides:
  - VTS window detection via EnumWindows title-prefix match
  - CursorDriver with 80px dead-zone and 800ms cubic ease-back
  - Compositor lifespan wiring for CursorDriver
  - WS control envelope for fire-discrete-event:<hotkey name>
affects: [04-04-body-sway-investigation, phase-5-verification]
tech-stack:
  added: []
  patterns:
    - sidecar-side Win32 cursor polling
    - sparse hotkey trigger over existing control envelope
key-files:
  created:
    - sidecar/src/sidecar/vts/window_detect.py
    - sidecar/src/sidecar/compositor/cursor_driver.py
    - sidecar/tests/vts/test_window_detect.py
    - sidecar/tests/compositor/test_cursor_driver.py
  modified:
    - sidecar/src/sidecar/compositor/__init__.py
    - sidecar/src/sidecar/ws/server.py
    - sidecar/src/sidecar/ws/handlers.py
key-decisions:
  - "DiscreteEvent demo target locked to Star Eye [7] / ebd026ebc2f64dd0835ded46b7170166."
  - "Cursor tracking remains sidecar-side Win32 polling; no renderer overlay was introduced."
patterns-established:
  - "Win32 window discovery uses EnumWindows + title.startswith('VTube Studio'), not FindWindow by Unity class."
requirements-completed: [AVT-09, AVT-10]
duration: 45min
completed: 2026-05-07
---

# Phase 04 Plan 03: Cursor Tracking And Discrete Demo Summary

**Sidecar-side cursor tracking with Win32 window detection and Star Eye discrete hotkey demo trigger**

## Performance

- **Duration:** 45 min
- **Started:** 2026-05-08T03:15:00Z
- **Completed:** 2026-05-08T04:00:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `window_detect.py` with cross-platform no-op behavior and Windows `EnumWindows` title-prefix detection for VTube Studio.
- Added `CursorDriver` implementing 80px dead-zone, ±15 degree head deflection, normalized eye deflection, and 800ms cubic ease-back.
- Replaced `cursor_driver=None` in sidecar lifespan with a real `CursorDriver()` passed as `cursor_driver=cursor_drv`.
- Added `fire-discrete-event:<name>` control branch that calls `DiscreteDispatcher.fire_by_name`.

## Task Commits

1. **Tasks 1-3: window detection, cursor driver, and discrete-event control wiring** - `5146a97` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/vts/window_detect.py` - VTS HWND, rect, and cursor-position helpers.
- `sidecar/src/sidecar/compositor/cursor_driver.py` - Cursor-to-param math and ease-back state machine.
- `sidecar/src/sidecar/ws/server.py` - Creates `CursorDriver` and `DiscreteDispatcher`, stores dispatcher in app state.
- `sidecar/src/sidecar/ws/handlers.py` - Adds `fire-discrete-event:` branch.

## Decisions Made

- Locked DiscreteEvent demo target: `Star Eye [7]`.
- Hotkey ID: `ebd026ebc2f64dd0835ded46b7170166`.
- WS envelope to fire demo:

```json
{"type":"control","text":"fire-discrete-event:Star Eye [7]"}
```

- `SetProcessDpiAwareness(2)` from 04-01 remains at `sidecar/src/sidecar/__main__.py:9`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification

- `cmd /c uv run pytest tests/compositor/test_cursor_driver.py tests/vts/test_window_detect.py -x -v` - 11 passed.
- `cmd /c uv run pytest tests/compositor/ tests/vts/ -x -v` - 39 passed.
- `cmd /c uv run python -c "from sidecar.compositor.cursor_driver import CursorDriver, DEAD_ZONE_PX, EASE_BACK_DURATION_S, HEAD_MAX_DEFLECTION_DEG; ..."` - D-10 constants verified.
- `window_detect.py` contains `title.startswith("VTube Studio")` and no `FindWindow` use.
- `ws/server.py` contains `CursorDriver()`, `cursor_driver=cursor_drv`, and `app.state.discrete_dispatcher`.
- `ws/handlers.py` contains `fire-discrete-event:` and `fire_by_name`.

## Cross-Platform Behavior

- Windows: cursor tracker polls `GetCursorPos` and `GetWindowRect` against the VTube Studio window.
- Non-Windows: `window_detect` returns sentinel values and `CursorDriver.tick()` returns `{}`.

## Next Phase Readiness

04-04 can use the running compositor, dev-panel body-sway hot-switch, and cursor/discrete demo wiring while capturing operator evidence. Phase 5 can verify the discrete demo by launching sidecar + VTS + Teto and sending the WS envelope above.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-07*
