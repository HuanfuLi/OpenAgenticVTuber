---
phase: 06-plugin-runtime-default-plugin
plan: 01
subsystem: plugin-runtime
tags: [python, pydantic, plugins, compositor, pytest]

requires:
  - phase: 08-avatar-import-catalogs
    provides: RigCapabilities and AvatarOverrides contracts consumed by plugin on_load()
provides:
  - BodyMotionPlugin API contract with ApiVersion V1
  - PluginManifest validation and file-path manifest discovery helpers
  - Deterministic action-code prompt section assembly
  - Plugin ParamFrame clamp boundary and system primitive override list
affects: [06-plugin-runtime-default-plugin, 07-three-category-code-parsing-dispatch, orchestrator, compositor]

tech-stack:
  added: []
  patterns:
    - Pydantic manifest validation with explicit reserved-name and API-major guards
    - Repo/userData plugin discovery where userData wins repo conflicts
    - Compositor boundary clamps plugin output against RigCapabilities

key-files:
  created:
    - sidecar/src/sidecar/plugins/__init__.py
    - sidecar/src/sidecar/plugins/api.py
    - sidecar/src/sidecar/plugins/manifest.py
    - sidecar/src/sidecar/plugins/loader.py
    - sidecar/src/sidecar/compositor/clamp.py
    - sidecar/src/sidecar/compositor/lock_filter.py
    - sidecar/tests/plugins/test_api.py
    - sidecar/tests/plugins/test_manifest_loader.py
    - sidecar/tests/plugins/test_prompt_section.py
    - sidecar/tests/compositor/test_clamp_lock_filter.py
  modified:
    - sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt

key-decisions:
  - "Plugin manifests reject incompatible API major versions while accepting the v1.x contract line."
  - "userData plugin manifests override repo plugin manifests with the same name; duplicate userData names fail loudly."
  - "MouthOpen is the only system primitive override because lipsync owns the VTS mouth input."

patterns-established:
  - "Plugin action-code prompt sections are sorted lexicographically and built once from manifest metadata."
  - "Plugin ParamFrames are validated against writable_param_ids before compositor integration."

requirements-completed:
  - PLG-01
  - PLG-02
  - PLG-03
  - PLG-05
  - PLG-06
  - PLG-08
  - PLG-09
  - PLG-10
  - ARCH-01
  - ARCH-07
  - ARCH-08
  - ARCH-09
  - ARCH-11
  - ARCH-12

duration: 7min
completed: 2026-05-08
---

# Phase 06 Plan 01: Plugin Contract Foundation Summary

**BodyMotionPlugin contract, manifest discovery/validation, deterministic prompt section assembly, and compositor plugin safety clamps**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-08T09:57:28Z
- **Completed:** 2026-05-08T10:03:43Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `BodyMotionPlugin` with `on_load(capabilities, overrides)`, `on_token_stream(sentence)`, `on_unload()`, and `ApiVersion.V1`.
- Added `PluginManifest` and `PluginActionCode` validation for reserved names, bracketed names, duplicate action codes, and incompatible API major versions.
- Added loader helpers for manifest discovery, userData precedence, entrypoint resolution, prompt section assembly, and restart-required manifest-change warnings.
- Replaced the old prompt action-key placeholder with `[<insert_action_codes_section>]`.
- Added `clamp_and_validate()` and `SYSTEM_PRIMITIVE_OVERRIDES` with `MouthOpen` as the only lipsync-owned primitive.

## Task Commits

1. **Task 1: Create plugin API contract and tests** - `cf99412` (test), `f13917d` (feat)
2. **Task 2: Manifest validation, reserved names, discovery, and prompt section** - `d46d6c1` (test), `f4f7e5c` (feat)
3. **Task 3: Clamp and system primitive lock-filter primitives** - `db5f1c2` (test), `8a16b28` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/plugins/__init__.py` - Exports plugin API symbols.
- `sidecar/src/sidecar/plugins/api.py` - Defines `ApiVersion` and `BodyMotionPlugin`.
- `sidecar/src/sidecar/plugins/manifest.py` - Defines manifest models and validation rules.
- `sidecar/src/sidecar/plugins/loader.py` - Discovers and loads manifests, resolves entrypoints, builds prompt sections, and warns on prompt-affecting reloads.
- `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` - Uses the new action-code section placeholder.
- `sidecar/src/sidecar/compositor/clamp.py` - Drops unknown/nonfinite params and clamps finite plugin values.
- `sidecar/src/sidecar/compositor/lock_filter.py` - Lists lipsync-owned system primitive overrides.
- `sidecar/tests/plugins/test_api.py` - Covers plugin API contract.
- `sidecar/tests/plugins/test_manifest_loader.py` - Covers manifest validation and discovery behavior.
- `sidecar/tests/plugins/test_prompt_section.py` - Covers stable prompt-section output.
- `sidecar/tests/compositor/test_clamp_lock_filter.py` - Covers clamp and primitive override behavior.

## Decisions Made

- Followed the plan's API-major policy: manifests with a different major `api_version` are rejected at validation time.
- Followed ARCH-08 discovery precedence: repo plugins load first, userData plugins override same-name repo plugins, and duplicate userData names raise `ValueError`.
- Kept the compositor safety boundary independent of runtime rewiring; this plan added primitives only and did not alter compositor merge order.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 2's red test initially used `model_copy(update=...)`, which bypasses nested Pydantic validation. The green commit corrected the fixture to build a second `PluginManifest` with `model_validate()`.

## Verification

- `cd sidecar && uv run pytest tests/plugins/test_api.py tests/plugins/test_manifest_loader.py tests/plugins/test_prompt_section.py tests/compositor/test_clamp_lock_filter.py -q` -> 13 passed.
- `npm run check:contracts` -> passed with no contract drift.

## Known Stubs

None found in files created or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

06-02 can consume the plugin API, manifest loader, prompt section builder, clamp boundary, and `MouthOpen` lock-filter primitive when rewiring the supervisor, adapter, and compositor/orchestrator paths.

## Self-Check: PASSED

- Created/modified files listed in this summary exist.
- Task commits `cf99412`, `f13917d`, `d46d6c1`, `f4f7e5c`, `db5f1c2`, and `8a16b28` exist in git history.

---
*Phase: 06-plugin-runtime-default-plugin*
*Completed: 2026-05-08*
