---
phase: 07-three-category-code-parsing-dispatch
plan: 06
subsystem: runtime-dispatch
tags: [python, orchestrator, plugin-adapter, tts, vts-dispatch]

requires:
  - phase: 07-03
    provides: Dispatch contracts and code_extractor output shape
  - phase: 07-05
    provides: VariantStateManager, DiscreteDispatcher, and EventCompletionTracker consumers
provides:
  - Active PluginAdapter ActionCode delivery queue and callback surface
  - Orchestrator dispatch routing for action, variant, and event records
  - TTS/audio payload plumbing using dispatches instead of actions
affects: [phase-07, phase-09, plugin-runtime, audio-payloads]

tech-stack:
  added: []
  patterns: [bounded asyncio ActionCode queue, ordered dispatch routing, dispatches audio payload field]

key-files:
  created:
    - sidecar/tests/orchestrator/test_dispatch_routing.py
  modified:
    - sidecar/src/sidecar/plugins/api.py
    - sidecar/src/sidecar/compositor/plugin_adapter.py
    - sidecar/src/sidecar/orchestrator/orchestrator.py
    - sidecar/src/sidecar/tts/tts_manager.py
    - sidecar/src/sidecar/tts/audio_payload_helpers.py
    - sidecar/tests/plugins/test_api.py
    - sidecar/tests/compositor/test_plugin_adapter.py
    - sidecar/tests/test_tts_manager.py
    - sidecar/tests/test_audio_payload_helpers.py
    - sidecar/tests/test_orchestrator_turn.py

key-decisions:
  - "Kept valid_expression_names as a backward-compatible constructor alias for plugin action code parsing while routing through Dispatch records."
  - "ActionCode enqueue failures log explicit DISPATCH-DROP reasons instead of raising from the orchestrator hot path."
  - "AudioPayloadMessage emission now uses dispatches only; stale actions assertions were updated in directly affected orchestrator-turn tests."

patterns-established:
  - "PluginAdapter exposes enqueue_action_code plus next_action_code for active plugin/runtime consumers."
  - "Orchestrator routes ordered Dispatch records after successful audio/stub emission."
  - "TTS helpers accept list[Dispatch] and construct AudioPayloadMessage(dispatches=...)."

requirements-completed: [PARSE-03, PARSE-05, PARSE-06]

duration: 250min
completed: 2026-05-09
---

# Phase 07 Plan 06: Runtime Dispatch Routing Summary

**Dispatch records now leave the parser path and reach the active plugin adapter, VTS variant/event consumers, and audio payloads as `dispatches`.**

## Performance

- **Duration:** 250 min
- **Started:** 2026-05-08T20:28:53Z
- **Completed:** 2026-05-09T00:39:13Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added `BodyMotionPlugin.on_action_code()` and a bounded `PluginAdapter.action_code_queue` with `enqueue_action_code()` / `next_action_code()`.
- Replaced stale orchestrator `actions` usage with ordered `dispatches`, routed to plugin adapter, variant manager, discrete dispatcher, and event tracker.
- Renamed TTS manager and payload helper parameters/fields to `dispatches`, with tests proving no `actions` field is emitted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add active-plugin ActionCode delivery surface** - `5fb6be3` (test RED), `9b9133d` (feat GREEN)
2. **Task 2: Route Dispatch records from orchestrator to plugin, variant, event, and audio payloads** - `dc77c8a` (test RED), `3212ae6` (feat GREEN), `8dc959e` (test compatibility fix)

_Note: TDD tasks have separate test and implementation commits._

## Files Created/Modified

- `sidecar/src/sidecar/plugins/api.py` - Optional `on_action_code(ActionCode)` hook.
- `sidecar/src/sidecar/compositor/plugin_adapter.py` - ActionCode queue, enqueue/drop behavior, callback delivery, and async consumer.
- `sidecar/src/sidecar/orchestrator/orchestrator.py` - `code_extractor` pipeline use, `dispatches` payload emission, and `_route_dispatches`.
- `sidecar/src/sidecar/tts/tts_manager.py` - TTS task API and silent payload path renamed to `dispatches`.
- `sidecar/src/sidecar/tts/audio_payload_helpers.py` - Synthesized and silent audio payloads now serialize `dispatches`.
- `sidecar/tests/orchestrator/test_dispatch_routing.py` - New routing tests for action, variant, event, order, drop, and stub payload shape.
- `sidecar/tests/test_orchestrator_turn.py` - Existing orchestrator-turn assertions updated for dispatch payloads.
- `sidecar/tests/plugins/test_api.py`, `sidecar/tests/compositor/test_plugin_adapter.py`, `sidecar/tests/test_tts_manager.py`, `sidecar/tests/test_audio_payload_helpers.py` - Contract and payload tests updated/extended.

## Decisions Made

- Kept the old `valid_expression_names` constructor input as a compatibility alias for action code parsing while the code now routes `Dispatch` records.
- Logged `DISPATCH-DROP` for missing plugin adapters, full action queues, and missing event hotkey IDs so runtime failures are observable without crashing a turn.
- Preserved plugin sentence forwarding separately from action-code delivery: plugins still receive bracketed sentence text and can also consume validated `ActionCode` records.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale orchestrator-turn tests for dispatch payloads**
- **Found during:** Post-task regression check after Task 2
- **Issue:** Existing `tests/test_orchestrator_turn.py` still asserted `AudioPayloadMessage.actions` and `[INTENT]` logs, both removed by the Phase 7 dispatch contract.
- **Fix:** Updated assertions to use `dispatches`, added fake plugin action enqueue support, and checked `[DISPATCH] kind=action` through an active plugin adapter.
- **Files modified:** `sidecar/tests/test_orchestrator_turn.py`
- **Verification:** `cd sidecar && uv run pytest tests/test_orchestrator_turn.py -x --no-header` and expanded verification passed.
- **Committed in:** `8dc959e`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test-only compatibility update for directly affected existing coverage. No production scope expansion.

## Issues Encountered

- The codebase was partially migrated before this plan: contracts/output types already used `Dispatch`, while orchestrator and TTS still imported old `ActionIntent`/`actions`. The planned Task 2 rename resolved this inconsistency.

## Known Stubs

None. Empty list defaults found during the stub scan are intentional queue/test/silent-payload defaults and do not block the plan goal.

## User Setup Required

None - no external service configuration required.

## Verification

- `cd sidecar && uv run pytest tests/plugins/test_api.py tests/compositor/test_plugin_adapter.py tests/orchestrator/test_dispatch_routing.py tests/test_tts_manager.py tests/test_audio_payload_helpers.py -q` -> 34 passed
- `cd sidecar && uv run pytest tests/test_orchestrator_turn.py -x --no-header` -> 26 passed
- `cd sidecar && uv run pytest tests/plugins/test_api.py tests/compositor/test_plugin_adapter.py tests/orchestrator/test_dispatch_routing.py tests/test_tts_manager.py tests/test_audio_payload_helpers.py tests/test_orchestrator_turn.py -q` -> 60 passed

## Next Phase Readiness

The parser output now reaches runtime consumers via dispatch routing. Phase 07-07 can focus on renderer/log/UI-facing behavior without needing to invent a second action delivery path.

## Self-Check: PASSED

- Summary file exists.
- Key created/modified files exist.
- Task commits found: `5fb6be3`, `9b9133d`, `dc77c8a`, `3212ae6`, `8dc959e`.

---
*Phase: 07-three-category-code-parsing-dispatch*
*Completed: 2026-05-09*
