---
phase: 09-slider-hud-per-param-lock
plan: 01
subsystem: sidecar
tags: [fastapi, websocket, pydantic, contracts, compositor, hud]

requires:
  - phase: 05-polish-contracts-codegen-14-verification
    provides: Pydantic-to-TS contract codegen and drift gate
  - phase: 06-plugin-runtime-default-plugin
    provides: compositor plugin adapter and single-writer VTS path
  - phase: 08-avatar-import-catalogs
    provides: RigCapabilities contract and active rig capability payload
provides:
  - HudMessageS2C and HudMessageC2S Pydantic contracts with generated TS/schema mirrors
  - HUD exclusion helper derived from SYSTEM_PRIMITIVE_OVERRIDES with resolver mapping
  - Compositor lock_state merge applied last plus 15 Hz HudTap fanout
  - GET /admin/rig-capabilities endpoint with hud_excluded_param_ids
  - /hud/ws endpoint for param-frame snapshots and set-lock/clear-lock routing
affects: [09-slider-hud-per-param-lock, renderer-hud, contracts, sidecar-compositor]

tech-stack:
  added: []
  patterns:
    - Constructor-injected in-memory lock_state shared by FastAPI app.state and Compositor
    - Non-blocking HudTap subscriber queues with oldest-frame drop on backpressure
    - Direction-split HUD WebSocket message unions generated from Pydantic

key-files:
  created:
    - packages/contracts/py/contracts/hud_message.py
    - packages/contracts/generated/json-schema/hud-message-s2c.schema.json
    - packages/contracts/generated/json-schema/hud-message-c2s.schema.json
    - packages/contracts/ts/hud-message-s2c.ts
    - packages/contracts/ts/hud-message-c2s.ts
    - sidecar/src/sidecar/compositor/hud_tap.py
    - sidecar/src/sidecar/admin/rig_capabilities.py
    - sidecar/src/sidecar/ws/hud_handlers.py
    - sidecar/tests/compositor/test_lock_filter.py
    - sidecar/tests/compositor/test_hud_tap.py
    - sidecar/tests/admin/test_rig_capabilities_endpoint.py
    - sidecar/tests/ws/test_hud_ws.py
    - sidecar/tests/ws/test_hud_lock_roundtrip.py
    - sidecar/tests/ws/test_hud_session_only.py
  modified:
    - packages/contracts/py/contracts/__init__.py
    - packages/contracts/scripts/codegen.py
    - packages/contracts/tests/test_codegen.py
    - packages/contracts/ts/index.ts
    - sidecar/src/sidecar/compositor/lock_filter.py
    - sidecar/src/sidecar/compositor/compositor.py
    - sidecar/src/sidecar/compositor/__init__.py
    - sidecar/src/sidecar/admin/__init__.py
    - sidecar/src/sidecar/ws/server.py
    - sidecar/tests/compositor/test_compositor.py

key-decisions:
  - "HUD locks are sidecar process-memory only and are shared by reference between /hud/ws handlers and the Compositor."
  - "Mouth-related HUD exclusion stays derived from SYSTEM_PRIMITIVE_OVERRIDES; ParamMouthOpenY is excluded by resolver mapping instead of adding a second override key."
  - "The HUD WebSocket pre-filters system-primitive params from param-frame payloads so the renderer does not duplicate exclusion logic."
  - "The contract codegen needed HUD-specific union title and alias handling for Annotated discriminated unions."

patterns-established:
  - "HudTap: publish snapshots from the compositor without blocking on WebSocket I/O."
  - "Lock merge: set locked params after idle/speech/plugin/cursor and before clamp_and_validate/inject_params."
  - "Admin rig capabilities: return the RigCapabilities payload plus sidecar-derived HUD metadata."

requirements-completed: [HUD-01, HUD-02, HUD-05, HUD-06, HUD-07, HUD-08]

duration: 24min
completed: 2026-05-09
---

# Phase 09 Plan 01: Sidecar Slider HUD Surface Summary

**Sidecar HUD contract surface with generated HudMessage types, 15 Hz compositor tap, session-only param locks, and rig capability metadata for renderer consumption**

## Performance

- **Duration:** 24 min
- **Started:** 2026-05-09T04:19:21Z
- **Completed:** 2026-05-09T04:43:16Z
- **Tasks:** 5
- **Files modified:** 24

## Accomplishments

- Added `HudMessageS2C` and `HudMessageC2S` Pydantic unions, generated JSON Schema/TS mirrors, and package exports.
- Added resolver-aware `hud_excluded_param_ids()` so both `MouthOpen` and `ParamMouthOpenY` are hidden while `SYSTEM_PRIMITIVE_OVERRIDES` remains one key.
- Added `HudTap` and compositor lock integration: locks apply last, skip system primitives, and publish every fourth 60 Hz tick.
- Added `GET /admin/rig-capabilities` returning the active `RigCapabilities` payload plus sorted `hud_excluded_param_ids`.
- Added `/hud/ws` for `param-frame` push snapshots plus `set-lock` confirmation and `clear-lock` mutation.

## Task Commits

1. **Task 1 RED: HudMessage contract tests** - `203d419` (test)
2. **Task 1 GREEN: HudMessage contracts and codegen** - `5239609` (feat)
3. **Task 2 RED: HUD exclusion tests** - `95dccd6` (test)
4. **Task 2 GREEN: HUD exclusion helper** - `e23a5e1` (feat)
5. **Task 3 RED: HudTap/compositor tests** - `58607f8` (test)
6. **Task 3 GREEN: HudTap and lock merge** - `f04fb76` (feat)
7. **Task 4 RED: rig capabilities endpoint tests** - `688d37e` (test)
8. **Task 4 GREEN: rig capabilities endpoint** - `49533ce` (feat)
9. **Task 5 RED: HUD WebSocket tests** - `e3b72a5` (test)
10. **Task 5 GREEN: HUD WebSocket endpoint** - `b74956e` (feat)

## Verification

- `cd sidecar && uv run pytest tests/compositor tests/ws tests/admin -x` - 79 passed
- `cd packages/contracts && uv run --project py --with pytest pytest tests/test_codegen.py -x` - 10 passed
- `npm run check:contracts` - passed
- `cd packages/contracts && uv run --project py python -c "from contracts import HudMessageS2C, HudMessageC2S, HudParamFrameMessage, HudSetLockMessage; print('ok')"` - printed `ok`
- `rg -n "import pyvts" sidecar/src` - exactly 1 match in `sidecar/src/sidecar/vts/pyvts_writer.py`

## Decisions Made

- `lock_state` is a plain `dict[str, float]` seeded in FastAPI lifespan and passed by reference to `Compositor`.
- `/hud/ws` sends `lock-confirmed` only for `set-lock`; `clear-lock` mutates state and relies on the next `param-frame.locked_ids`.
- Param-frame payloads are sidecar-filtered for `SYSTEM_PRIMITIVE_OVERRIDES`, matching the Open Question 1 recommendation.
- `packages/contracts/ts/index.ts` was updated explicitly because this repository's codegen script does not currently rewrite the TS barrel file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added HUD union title and TS alias generation**
- **Found during:** Task 1 (HudMessage Pydantic source + codegen pipeline integration)
- **Issue:** `TypeAdapter(...).json_schema()` for annotated unions produced no top-level title, and `json-schema-to-typescript` emitted only member interfaces, not `HudMessageS2C` / `HudMessageC2S` aliases.
- **Fix:** Added HUD-specific schema title assignment and TS union alias post-processing in `packages/contracts/scripts/codegen.py`.
- **Files modified:** `packages/contracts/scripts/codegen.py`
- **Verification:** HUD contract tests pass; `npm run check:contracts` passes.
- **Committed in:** `5239609`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for generated schemas/TS to expose the planned public contract names. No architecture or dependency changes.

## Known Stubs

None. Stub scan found only intentional empty dict/list defaults, existing unrelated TODO text in `server.py`, and test assertions for expected empty payloads.

## Issues Encountered

- The exact `cd packages/contracts && uv run pytest ...` command is not usable in this repo because `packages/contracts` has no root `pyproject.toml` with pytest. Verification used `uv run --project py --with pytest pytest ...` from `packages/contracts`, which exercises the same tests.
- Concurrent planning commits for Phase 10 appeared while this plan was running. They were left untouched.

## User Setup Required

None - no external service configuration required.

## Carry-Forward for Plan 09-02

- Renderer should fetch `/admin/rig-capabilities` on HUD mount and use `hud_excluded_param_ids` directly; it does not need to reimplement mouth filtering.
- Renderer `/hud/ws` reconnect cadence should match the main `/ws` backoff expectation: 1.5s.
- HUD row labels should cascade through `cdi3_display_names` and fall back to raw param IDs.
- Sidecar pre-filters `MouthOpen`, so the renderer's normal slider list should never show mouth-related rows when using the endpoint payload.

## Self-Check: PASSED

- Created-file check passed for summary, HUD contracts, HUD tap, admin endpoint, HUD handlers, and WS tests.
- Commit check passed for all 10 task commits listed above.

---
*Phase: 09-slider-hud-per-param-lock*
*Completed: 2026-05-09*
