---
phase: 06-plugin-runtime-default-plugin
plan: 08
subsystem: plugins
tags: [default-plugin, prompt, avatar-catalog, uat, pytest]
requires:
  - phase: 06-plugin-runtime-default-plugin
    provides: "Default plugin runtime, prompt action-code insertion, and Phase 6 UAT artifacts"
provides:
  - "Strict active Teto catalog regression proving joy is absent while heart-eye/star-eye remain present"
  - "Default plugin production vocabulary without joy"
  - "Prompt wording that treats bracketed actions as optional manifest-bounded action codes"
  - "Corrected Phase 6 UAT and verification boundary deferring model-owned variants to Phase 7"
affects: [phase-06, phase-07, plugin-runtime, prompt-vocabulary]
tech-stack:
  added: []
  patterns:
    - "Active imported avatar overrides are the production source of truth for model-owned variant/expression vocabulary"
key-files:
  created:
    - sidecar/tests/plugins/test_teto_catalog_strict_variants.py
  modified:
    - plugins/default/plugin.yaml
    - plugins/default/__init__.py
    - sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt
    - sidecar/tests/plugins/test_default_plugin.py
    - sidecar/tests/plugins/test_default_plugin_parser.py
    - sidecar/tests/plugins/test_default_plugin_integration.py
    - sidecar/tests/plugins/test_prompt_section.py
    - sidecar/tests/compositor/test_plugin_adapter.py
    - .planning/phases/06-plugin-runtime-default-plugin/06-HUMAN-UAT.md
    - .planning/phases/06-plugin-runtime-default-plugin/06-VERIFICATION.md
key-decisions:
  - "For active Teto, joy is obsolete/invalid production vocabulary because it is absent from avatars/重音テト/_avatar_overrides.yaml."
  - "Phase 6 keeps default plugin action dispatch only; model-owned variant/event dispatch such as heart-eye remains Phase 7 work."
patterns-established:
  - "Default plugin tests use declared action codes such as smirk for ParamFrame ramp coverage and reserve joy for safe-ignore regressions."
requirements-completed: [PLG-02, PLG-07, ARCH-03, ARCH-09]
duration: 5 min
completed: 2026-05-08
---

# Phase 06 Plan 08: Strict Teto Joy Vocabulary Summary

**Teto-owned production vocabulary is now catalog-strict: `joy` is absent, ignored safely, and no longer advertised by the default plugin or prompt.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-08T23:50:11Z
- **Completed:** 2026-05-08T23:55:21Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added regressions proving active Teto variants include `heart-eye`/`star-eye` and exclude `joy`.
- Removed `joy` from the default plugin manifest, supported action set, and ParamFrame compositions.
- Rewrote prompt copy so bracketed actions are optional and limited to inserted action codes, with no mandatory emotion tag examples.
- Updated Phase 6 UAT/verification language so forced `[joy]` means safe ignore, while `heart-eye` model-variant success is deferred to Phase 7 `{variant}` dispatch.

## Task Commits

1. **Task 1: Add strict Teto vocabulary regressions** - `4f581da` (test)
2. **Task 2: Remove `[joy]` from Phase 6 production prompt and plugin semantics** - `ee15af6` (fix)
3. **Task 3: Correct Phase 6 UAT and verification wording** - `5db8d03` (docs)

## Files Created/Modified

- `sidecar/tests/plugins/test_teto_catalog_strict_variants.py` - Active Teto catalog regression for known variants and absent `joy`.
- `plugins/default/plugin.yaml` - Removed `code: joy`.
- `plugins/default/__init__.py` - Removed `joy` from supported actions and compositions.
- `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` - Removed mandatory emotion-tag instructions and nonexistent examples.
- `sidecar/tests/plugins/test_default_plugin.py` - Moved ramp/source tests from `joy` to `smirk`.
- `sidecar/tests/plugins/test_default_plugin_parser.py` - Added direct and split-token `[joy]` safe-ignore coverage.
- `sidecar/tests/plugins/test_default_plugin_integration.py` - Manifest expectation now excludes `joy`.
- `sidecar/tests/plugins/test_prompt_section.py` - Prompt no-longer-advertises-joy regression.
- `sidecar/tests/compositor/test_plugin_adapter.py` - Adapter ramp tests now use `smirk`.
- `.planning/phases/06-plugin-runtime-default-plugin/06-HUMAN-UAT.md` - Reframed `[joy]` as invalid/obsolete for active Teto.
- `.planning/phases/06-plugin-runtime-default-plugin/06-VERIFICATION.md` - Added 06-08 re-verification and Phase 7 deferral wording.

## Decisions Made

- `joy` is not a valid production model-owned variant/expression for the active imported Teto avatar because it is absent from `_avatar_overrides.yaml`.
- Phase 6 does not implement `{variant}` or `<event>` dispatch; active Teto model-owned tags such as `heart-eye` remain Phase 7 parser/dispatch work.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None.

## Verification

- `cd sidecar && uv run pytest tests/plugins/test_teto_catalog_strict_variants.py tests/plugins/test_default_plugin.py tests/plugins/test_default_plugin_parser.py tests/plugins/test_default_plugin_integration.py tests/plugins/test_prompt_section.py tests/compositor/test_plugin_adapter.py -x --no-header` -> 23 passed.
- Static `joy` grep under `plugins/default`, production prompts, and plugin tests now finds only negative regressions and generic manifest loader/watcher fixtures, not default production manifest/runtime/prompt acceptance.
- Prohibited scope grep for `live2d-py`, `MotionCaptureFrame`, `{variant}`, `<event>`, and variant/event dispatch under touched production surfaces returned no matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 6 gap closure is complete. Phase 7 can implement the three-category parser/dispatch knowing that `joy` is not part of active Teto production vocabulary and that model-owned variants must come from the imported avatar catalog.

## Self-Check: PASSED

- Created/modified file spot-checks found all required artifacts.
- Commit spot-checks found `4f581da`, `ee15af6`, and `5db8d03`.

---
*Phase: 06-plugin-runtime-default-plugin*
*Completed: 2026-05-08*
