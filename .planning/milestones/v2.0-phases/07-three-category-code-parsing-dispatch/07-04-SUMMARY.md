---
phase: 07-three-category-code-parsing-dispatch
plan: 04
subsystem: parser
tags: [python, pytest, reserved-names, validation, contracts]
requires:
  - phase: 07-three-category-code-parsing-dispatch
    provides: Phase 7 context and reserved-name policy decisions
  - phase: 08-avatar-import-catalogs
    provides: VariantEntry and EventEntry contract models
provides:
  - Fixed 28-name reserved LLM protocol name set
  - Boot-time validation primitive for plugin action, variant, and event codes
  - Case-insensitive cross-category collision detection
affects: [07-three-category-code-parsing-dispatch, sidecar-boot, plugin-runtime, avatar-overrides]
tech-stack:
  added: []
  patterns: [Boot-time catalog validation, typed parser validation errors]
key-files:
  created:
    - sidecar/src/sidecar/parser/__init__.py
    - sidecar/src/sidecar/parser/reserved.py
    - sidecar/tests/parser/__init__.py
    - sidecar/tests/parser/test_reserved.py
  modified: []
key-decisions:
  - "Reserved-name enforcement is exposed as a boot-time validation primitive; parser/runtime hot paths do not consult the reserved list."
  - "The reserved LLM protocol list is a fixed system invariant covering the PLG-06 floor plus the 28-entry Phase 7 research sweep."
patterns-established:
  - "Parser validation exports typed ValueError subclasses for boot integration to fail loudly."
  - "Category code tables are normalized with lower() before reserved-name and collision checks."
requirements-completed: [PARSE-04, PARSE-07]
duration: 3min
completed: 2026-05-09
---

# Phase 07 Plan 04: Reserved Parser Validation Summary

**Boot-time parser validation with fixed LLM protocol reserved names and case-insensitive cross-category collision checks**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-09T00:15:16Z
- **Completed:** 2026-05-09T00:18:20Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Added `sidecar.parser` exports for reserved-name validation.
- Added the exact 28-entry `RESERVED_NAMES: frozenset[str]` from Phase 7 research.
- Implemented `validate_reserved_names()` with typed failures for reserved LLM protocol names and cross-category code collisions.
- Added focused pytest coverage for reserved names, plugin/variant collisions, variant/event collisions, clean inputs, and constant completeness.

## Task Commits

1. **Task 1 RED: Reserved parser validation tests** - `d9c3b4e` (test)
2. **Task 1 GREEN: Reserved parser validation module** - `4b960df` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/parser/__init__.py` - Re-exports the validation API for boot integration.
- `sidecar/src/sidecar/parser/reserved.py` - Defines reserved names, error classes, and boot-time validation logic.
- `sidecar/tests/parser/__init__.py` - Marks parser tests as a package.
- `sidecar/tests/parser/test_reserved.py` - Covers PARSE-04 and PARSE-07 behavior.

## Decisions Made

- Followed D-D1 strictly: validation is a reusable cold-path primitive only; no parse-time `<think>` stripping or runtime hot-path checks were added.
- Normalized all category codes with `.lower()` to match D-D3 and make collisions case-insensitive.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial large context reads timed out, so the plan-required sections were re-read with narrower line and pattern selection.
- Stub scan command needed a quoting correction on PowerShell; the corrected scan found only typed defaults/local empty dict initializers, not stubs.
- The first metadata commit accidentally included already-staged `packages/contracts` changes owned by the parallel 07-02 executor. Follow-up commit `5c36e9e` removed those files from the committed 07-04 net diff and restored them to the worktree uncommitted for the owning executor.

## Known Stubs

None. Stub scan hits were local validation defaults or accumulators, not placeholder UI/data paths.

## User Setup Required

None - no external service configuration required.

## Verification

- `cd sidecar && uv run pytest tests/parser/test_reserved.py -x --no-header` -> 5 passed.
- `cd sidecar && uv run pytest tests/parser/test_reserved.py -q` -> 5 passed.
- Acceptance marker checks for `RESERVED_NAMES: frozenset[str]`, both error classes, `validate_reserved_names`, `cross-category code collision`, `test_reserved_names_completeness`, and `antml:function_calls` all passed.

## Next Phase Readiness

Plan 07-07 can call `validate_reserved_names()` during sidecar boot after plugin manifest and avatar override catalogs are loaded. Parser/runtime plans can rely on this module without adding per-emit reserved-name checks.

## Self-Check: PASSED

Verified all created plan files exist and task commits `d9c3b4e` and `4b960df` are present in git history.

---
*Phase: 07-three-category-code-parsing-dispatch*
*Completed: 2026-05-09*
