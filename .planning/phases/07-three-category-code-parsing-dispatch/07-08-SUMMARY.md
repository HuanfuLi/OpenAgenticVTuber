---
phase: 07-three-category-code-parsing-dispatch
plan: 08
subsystem: orchestration
tags: [dispatch, prompt-catalog, avatar-overrides, live-uat, pytest]

requires:
  - phase: 07-three-category-code-parsing-dispatch
    provides: "Parser, dispatch routing, variant state, and event completion semantics from plans 07-01 through 07-07"
provides:
  - "Boot-frozen prompt catalog exposing active plugin actions, avatar variants, and avatar events"
  - "Prompt copy allowing listed `[action]`, `{variant}`, and `<event>` codes without inventing unlisted codes"
  - "Deterministic tests proving prompt visibility and forced three-category dispatch"
  - "Live UAT record separating confirmed `{heart-eye}` variant behavior from blocked empty-event catalog prerequisites"
affects: [phase-07, phase-09, phase-10, orchestrator, sidecar-boot, avatar-catalogs]

tech-stack:
  added: []
  patterns:
    - "Build LLM dispatch vocabulary from the same boot-frozen plugin/avatar catalogs used by code_extractor"
    - "Treat empty avatar event catalogs as UAT prerequisite blocks, not parser/routing failures"

key-files:
  created:
    - ".planning/phases/07-three-category-code-parsing-dispatch/07-08-SUMMARY.md"
  modified:
    - "sidecar/src/sidecar/plugins/loader.py"
    - "sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt"
    - "sidecar/src/sidecar/orchestrator/orchestrator.py"
    - "sidecar/src/sidecar/ws/server.py"
    - "sidecar/tests/plugins/test_prompt_section.py"
    - "sidecar/tests/plugins/test_manifest_watcher.py"
    - "sidecar/tests/test_orchestrator_turn.py"
    - "sidecar/tests/test_sidecar_boot.py"
    - ".planning/phases/07-three-category-code-parsing-dispatch/07-HUMAN-UAT.md"

key-decisions:
  - "The prompt dispatch catalog is boot-frozen from the same active plugin and avatar catalogs used by runtime parsing."
  - "Variant codes are persistent radio-button state; `{heart-eye}` does not auto-reset, while timed completion applies only to `<event>` codes."
  - "Current imported Teto's `events: []` blocks live event UAT until an event-bearing active avatar catalog is selected or imported."

patterns-established:
  - "Combined prompt catalogs use explicit delimiter categories: `[action]`, `{variant}`, and `<event>`."
  - "Live UAT records distinguish visual variant pass, event prerequisite block, and parser/routing failure."

requirements-completed: [PARSE-03, PARSE-05, PARSE-06]

duration: "39 min active execution plus human checkpoint"
completed: 2026-05-09
---

# Phase 07 Plan 08: Dispatch Prompt Gap Closure Summary

**Active dispatch vocabulary is now visible to the LLM prompt, deterministic tests cover all three dispatch categories, and live UAT confirmed `{heart-eye}` while event testing remains blocked by Teto's empty event catalog**

## Performance

- **Duration:** 39 min active execution plus human checkpoint
- **Started:** 2026-05-09T03:13:27Z
- **Completed:** 2026-05-09T03:52:09Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `build_dispatch_codes_section(plugin_manifest, overrides)` so the runtime prompt lists active plugin actions, avatar variants, and avatar events with their real delimiters.
- Replaced the action-only prompt placeholder with a combined dispatch placeholder and removed the prior variant/event discouragement line.
- Wired sidecar boot to build the prompt catalog from the same active plugin manifest and avatar overrides passed to `code_extractor`.
- Added deterministic prompt/catalog and forced-dispatch tests; the focused verification suite passed with 52 tests.
- Recorded human UAT: `{heart-eye}` visibly switched the rig, persistence is expected variant policy, and current Teto event UAT is blocked because `events: []`.

## Task Commits

1. **Task 1: Build and test a combined dispatch prompt catalog** - `e817ff9` (test), `f61b50a` (feat)
2. **Task 2: Wire active catalogs into the boot prompt and make live UAT catalog readiness explicit** - `441a16a` (test), `d805032` (feat)
3. **Task 3: Confirm live VTS behavior after prompt/catalog fix** - `7ff701a` (docs)

_Note: Tasks 1 and 2 used TDD test-then-implementation commits._

## Files Created/Modified

- `sidecar/src/sidecar/plugins/loader.py` - Combined dispatch prompt catalog builder, while preserving action-only compatibility.
- `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` - Prompt copy and placeholder for all three dispatch delimiters.
- `sidecar/src/sidecar/orchestrator/orchestrator.py` - System prompt assembly for the combined dispatch section.
- `sidecar/src/sidecar/ws/server.py` - Boot wiring and catalog readiness logs.
- `sidecar/tests/plugins/test_prompt_section.py` - Combined catalog and prompt-template tests.
- `sidecar/tests/plugins/test_manifest_watcher.py` - Boot source-order regression coverage.
- `sidecar/tests/test_orchestrator_turn.py` - Frozen prompt and forced dispatch coverage.
- `sidecar/tests/test_sidecar_boot.py` - Boot builder and empty-event log coverage.
- `.planning/phases/07-three-category-code-parsing-dispatch/07-HUMAN-UAT.md` - Live variant pass and event prerequisite block record.

## Decisions Made

- The LLM prompt and parser now share one boot-frozen catalog source, avoiding prompt/parser vocabulary drift.
- `{variant}` codes are persistent until another variant is emitted; no automatic switch-back is expected.
- Live `<event>` verification is not required for catalogs with `events: []`; it resumes only after an event-bearing active avatar catalog is available.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Live event UAT could not run against current imported Teto because its avatar overrides declare `events: []`. This is documented as a prerequisite block, not a dispatch failure.

## Known Stubs

- `sidecar/src/sidecar/ws/server.py:64` contains a pre-existing `TODO Phase 5 / electron-main side` note about LLM config env-var handoff. It is unrelated to this dispatch prompt gap closure and does not block the plan goal.

## Verification

- `cd sidecar && uv run pytest tests/plugins/test_prompt_section.py tests/test_orchestrator_turn.py tests/test_sidecar_boot.py tests/plugins/test_manifest_watcher.py tests/orchestrator/test_dispatch_routing.py -q`
- Result: `52 passed in 49.73s`

## User Setup Required

None for this plan. Live event verification still requires selecting or importing an active avatar catalog with at least one event.

## Next Phase Readiness

Phase 7 dispatch prompt exposure is closed for active actions and variants. Phase 9 and Phase 10 can rely on the parser/runtime distinction between persistent variants and timed events, with event live UAT still gated on an event-bearing catalog.

## Self-Check: PASSED

- Summary file exists: `.planning/phases/07-three-category-code-parsing-dispatch/07-08-SUMMARY.md`
- Key implementation and UAT files exist.
- Task commits found: `e817ff9`, `f61b50a`, `441a16a`, `d805032`, `7ff701a`

---
*Phase: 07-three-category-code-parsing-dispatch*
*Completed: 2026-05-09*
