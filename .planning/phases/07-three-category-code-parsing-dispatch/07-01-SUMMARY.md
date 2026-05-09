---
phase: 07-three-category-code-parsing-dispatch
plan: 01
subsystem: contracts
tags: [pydantic, dispatch, vts, avatar-import, codegen]
requires:
  - phase: 08-avatar-import-catalogs
    provides: Avatar catalog extraction and EventEntry source models
  - phase: 06-plugin-runtime-default-plugin
    provides: Plugin action-code ownership model consumed by Phase 7 dispatch
provides:
  - Python Dispatch discriminated union with action, variant, and event records
  - AudioPayloadMessage and SentenceOutput dispatches fields
  - VTS TriggerAnimation extraction into EventEntry with hotkey ID and duration fallback state
affects: [07-three-category-code-parsing-dispatch, contracts-codegen, avatar-import, orchestrator]
tech-stack:
  added: []
  patterns: [Pydantic discriminated union, VTS TriggerAnimation duration policy]
key-files:
  created:
    - packages/contracts/py/contracts/dispatch.py
  modified:
    - packages/contracts/py/contracts/__init__.py
    - packages/contracts/py/contracts/audio_payload.py
    - packages/contracts/py/contracts/event_entry.py
    - packages/contracts/scripts/codegen.py
    - sidecar/schemas/avatar_overrides.schema.json
    - sidecar/src/sidecar/avatar/extractors/vts.py
    - sidecar/src/sidecar/orchestrator/output_types.py
    - sidecar/tests/avatar/test_extract_vts.py
key-decisions:
  - "ActionIntent was deleted from the Python contracts package rather than aliased; Dispatch is the sole Phase 7 contract surface."
  - "TriggerAnimation entries use real motion3 Meta.Duration only when finite and within 0 < duration <= 10.0; fallback entries carry duration_is_fallback=True."
patterns-established:
  - "Dispatch records are ordered Pydantic variants discriminated by kind."
  - "EventEntry preserves import-time fallback state so later parser/runtime code can avoid adding the blend pad to fallback durations."
requirements-completed: [PARSE-03, PARSE-06]
duration: 5min
completed: 2026-05-09
---

# Phase 07 Plan 01: Dispatch Contract Source Summary

**Python Dispatch contracts with VTS TriggerAnimation event extraction using real motion durations and explicit fallback state**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-09T00:05:04Z
- **Completed:** 2026-05-09T00:09:59Z
- **Tasks:** 1
- **Files modified:** 10

## Accomplishments

- Added `ActionCode`, `VariantToggle`, `EventFire`, and `Dispatch` as the Python source-of-truth discriminated union.
- Replaced Python audio and sentence output model fields from `actions`/`ActionIntent` to ordered `dispatches`.
- Extended VTS extraction so `TriggerAnimation` hotkeys become `EventEntry` records with `hotkey_id`, `motion_file`, `duration_seconds`, and `duration_is_fallback`.

## Task Commits

1. **Task 1 RED: Dispatch duration regression tests** - `dfeb64c` (test)
2. **Task 1 GREEN: Dispatch contract and VTS extraction** - `a62eb55` (feat)

## Files Created/Modified

- `packages/contracts/py/contracts/dispatch.py` - Defines the three dispatch variants and `Dispatch = Annotated[..., Field(discriminator="kind")]`.
- `packages/contracts/py/contracts/__init__.py` - Exports dispatch symbols and removes `ActionIntent`.
- `packages/contracts/py/contracts/audio_payload.py` - Replaces `actions` with `dispatches: List[Dispatch]`.
- `packages/contracts/py/contracts/event_entry.py` - Adds `hotkey_id` and `duration_is_fallback`.
- `packages/contracts/scripts/codegen.py` - Registers `Dispatch` and maps dispatch variants to the `dispatch` owner file.
- `sidecar/schemas/avatar_overrides.schema.json` - Allows event `hotkey_id` and `duration_is_fallback`.
- `sidecar/src/sidecar/avatar/extractors/vts.py` - Extracts `TriggerAnimation` events and reads `motion3.json` metadata.
- `sidecar/src/sidecar/orchestrator/output_types.py` - Renames `SentenceOutput.actions` to `dispatches`.
- `sidecar/tests/avatar/test_extract_vts.py` - Covers dispatch model construction, real duration extraction, and fallback policy.

## Decisions Made

- Followed D-A4 strictly: no compatibility alias for `ActionIntent`; Python contract imports now expose only Dispatch variants.
- Preserved `EventEntry.duration_seconds` as the import/catalog representation and left conversion to `EventFire.duration_ms` for later parser/runtime plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Treat non-finite motion durations as fallback**
- **Found during:** Task 1 (VTS TriggerAnimation duration validation)
- **Issue:** The plan listed invalid/non-numeric, nonpositive, and oversized durations; numeric non-finite values such as `NaN` can pass `float(...)` but are not valid motion durations.
- **Fix:** Added `math.isfinite(duration_seconds)` to the valid-duration gate and covered `"NaN"` in the fallback test table.
- **Files modified:** `sidecar/src/sidecar/avatar/extractors/vts.py`, `sidecar/tests/avatar/test_extract_vts.py`
- **Verification:** `cd sidecar && uv run pytest tests/avatar/test_extract_vts.py -x --no-header`
- **Committed in:** `a62eb55`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Tightens PARSE-06 correctness without changing the architecture or adding scope.

## Issues Encountered

- Two inspection commands needed reruns because PowerShell rejected heredoc syntax and a combined regex was over-escaped. The verification commands themselves passed.

## Known Stubs

None. Stub scan hits were existing placeholder terminology/model fields such as `is_placeholder`; no new unwired UI or data stubs were introduced.

## User Setup Required

None - no external service configuration required.

## Verification

- `uv run --project sidecar python -c "from contracts import ActionCode, VariantToggle, EventFire, Dispatch; ..."` -> passed.
- `cd sidecar && uv run pytest tests/avatar/test_extract_vts.py::test_trigger_animation_uses_motion3_duration -x --no-header` -> passed.
- `cd sidecar && uv run pytest tests/avatar/test_extract_vts.py -x --no-header` -> 9 passed.
- `rg "ActionIntent" packages/contracts/py sidecar/src/sidecar/orchestrator/output_types.py -n` -> no matches.

## Next Phase Readiness

Plan 07-02 can regenerate/check TypeScript mirrors from the new Python Dispatch source. Later parser/runtime plans can rely on event entries carrying both hotkey IDs and fallback state.

## Self-Check: PASSED

Verified all created/modified plan files exist and task commits `dfeb64c` and `a62eb55` are present in git history.

---
*Phase: 07-three-category-code-parsing-dispatch*
*Completed: 2026-05-09*
