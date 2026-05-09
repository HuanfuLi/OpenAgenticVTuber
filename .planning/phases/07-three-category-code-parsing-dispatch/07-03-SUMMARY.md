---
phase: 07-three-category-code-parsing-dispatch
plan: 03
subsystem: orchestrator
tags: [parser, dispatch, tts, pytest]

requires:
  - phase: 07-three-category-code-parsing-dispatch
    provides: Dispatch contracts from 07-01
provides:
  - Three-category code_extractor for action, variant, and event syntax
  - Display and TTS filtering for square, curly, and angle code syntax
  - Split-token parser fixtures for all three syntax categories
affects: [phase-07, phase-09, orchestrator, plugin-runtime]

tech-stack:
  added: []
  patterns:
    - Closure-captured catalog lookups for parser hot path
    - Single-pass left-to-right dispatch walker

key-files:
  created:
    - sidecar/tests/orchestrator/__init__.py
    - sidecar/tests/orchestrator/conftest.py
    - sidecar/tests/orchestrator/test_code_extractor.py
    - sidecar/tests/orchestrator/test_tts_preprocessor.py
  modified:
    - sidecar/src/sidecar/orchestrator/transformers.py
    - sidecar/src/sidecar/orchestrator/tts_preprocessor.py
    - sidecar/tests/test_actions_extractor.py

key-decisions:
  - "code_extractor leaves sentence.text unchanged so plugin-visible text keeps bracketed context."
  - "Leaked <think> is not stripped at parse time; it is treated as an unknown event and emits no dispatch."
  - "EventFire.duration_ms is computed from EventEntry at parse time, using 10s exactly for fallback entries and duration_seconds*1000+1000 otherwise."

patterns-established:
  - "Parser dispatchers accept boot-time action code, variant, and event catalogs and case-fold them once in the decorator factory."
  - "Display and TTS output remove all three LLM code delimiters downstream from parser dispatch."

requirements-completed: [PARSE-01, PARSE-02, PARSE-04, PARSE-08]

duration: 7min
completed: 2026-05-09
---

# Phase 07 Plan 03: Three-Category Parser Summary

**Single-pass parser dispatches ordered ActionCode, VariantToggle, and EventFire records while display and TTS strip all code delimiters.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-09T00:14:35Z
- **Completed:** 2026-05-09T00:21:13Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments

- Replaced the old single-category `actions_extractor` path with `code_extractor`, `_variant_lookup`, `_event_lookup`, and `_extract_dispatches`.
- Added parser coverage for the 16 split-token and adversarial fixtures across `[action]`, `{variant}`, and `<event>` syntax.
- Extended downstream filtering so chat display and TTS output strip square, curly, and angle code text.

## Task Commits

1. **Task 1 RED: parser/filter tests** - `fb61085` (test)
2. **Task 1 GREEN: parser/filter implementation** - `9e6c30f` (feat)

_Note: This was a TDD task, so the task intentionally has separate red and green commits._

## Files Created/Modified

- `sidecar/src/sidecar/orchestrator/transformers.py` - Adds `code_extractor`, lookup helpers, dispatch extraction, and all-syntax display/TTS pass-through.
- `sidecar/src/sidecar/orchestrator/tts_preprocessor.py` - Adds `ignore_curly_brackets` and `filter_curly_brackets`.
- `sidecar/tests/orchestrator/test_code_extractor.py` - Covers ordered mixed dispatches, split-token boundaries, unknown `<think>` drop, fallback event duration, and full-chain stripping.
- `sidecar/tests/orchestrator/test_tts_preprocessor.py` - Covers curly filtering and combined square/curly/angle TTS stripping.
- `sidecar/tests/orchestrator/conftest.py` - Provides parser catalog fixtures.
- `sidecar/tests/orchestrator/__init__.py` - Marks the orchestrator test package.
- `sidecar/tests/test_actions_extractor.py` - Deleted old ActionIntent-era tests.

## Decisions Made

- `code_extractor` does not mutate `sentence.text`; plugins still see the original bracketed text.
- No parse-time `<think>` stripping was added. Unknown angle codes are silently dropped as unknown events.
- Event duration conversion happens in the parser from `EventEntry`: fallback entries emit exactly `10000`, non-fallback entries emit `max(0, int(duration_seconds * 1000)) + 1000`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Other Wave 2 agents committed on top during execution. The 07-03 green implementation was recommitted on current `HEAD` as `9e6c30f`; unrelated dirty files were left untouched.

## Known Stubs

None. Stub scan hits were test literals and normal empty-list initialization only.

## Verification

- `cd sidecar && uv run pytest tests/orchestrator/test_code_extractor.py tests/orchestrator/test_tts_preprocessor.py -x --no-header` - 24 passed
- `cd sidecar && uv run pytest tests/orchestrator/test_code_extractor.py tests/orchestrator/test_tts_preprocessor.py -q` - 24 passed
- Acceptance greps confirmed `code_extractor`, `_extract_dispatches`, `duration_is_fallback`, curly filtering, old test deletion, and absence of `def actions_extractor` / `_extract_intents`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Parser-level dispatch records are ready for the later runtime routing plans. Variant/event managers and reserved validation landed in parallel plans and should be integrated by downstream orchestrator wiring.

## Self-Check: PASSED

- Verified created/modified files exist.
- Verified old `sidecar/tests/test_actions_extractor.py` is deleted.
- Verified task commits exist: `fb61085`, `9e6c30f`.

---
*Phase: 07-three-category-code-parsing-dispatch*
*Completed: 2026-05-09*
