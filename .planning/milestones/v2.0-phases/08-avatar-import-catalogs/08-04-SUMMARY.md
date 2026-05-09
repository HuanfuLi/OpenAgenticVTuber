---
phase: 08-avatar-import-catalogs
plan: 04
subsystem: contracts
tags: [pydantic, json-schema, typescript, avatar-import, codegen]

requires:
  - phase: 08-avatar-import-catalogs
    provides: AvatarOverrides, AvatarImportPlan, RigCapabilities, variant/event contract foundations
provides:
  - DefaultPluginActionBinding Pydantic, TypeScript, and JSON Schema contract
  - default_plugin_action_bindings fields on AvatarOverrides, AvatarImportPlan, and RigCapabilities
  - sidecar avatar_overrides JSON Schema validation for persisted default-plugin action bindings
affects: [phase-06-plugin-runtime, phase-07-three-category-code-parsing-dispatch, phase-08-avatar-import-catalogs]

tech-stack:
  added: []
  patterns: [Pydantic source-of-truth contracts, generated JSON Schema and TypeScript mirrors, sidecar runtime JSON Schema validation]

key-files:
  created:
    - packages/contracts/py/contracts/action_binding.py
    - packages/contracts/generated/json-schema/action-binding.schema.json
    - packages/contracts/ts/action-binding.ts
    - packages/contracts/tests/test_codegen.py
  modified:
    - packages/contracts/py/contracts/__init__.py
    - packages/contracts/py/contracts/avatar_overrides.py
    - packages/contracts/py/contracts/avatar_import_plan.py
    - packages/contracts/py/contracts/rig_capabilities.py
    - packages/contracts/scripts/codegen.py
    - packages/contracts/generated/json-schema/avatar-import-plan.schema.json
    - packages/contracts/generated/json-schema/avatar-overrides.schema.json
    - packages/contracts/generated/json-schema/rig-capabilities.schema.json
    - packages/contracts/ts/avatar-import-plan.ts
    - packages/contracts/ts/avatar-overrides.ts
    - packages/contracts/ts/rig-capabilities.ts
    - packages/contracts/ts/index.ts
    - sidecar/schemas/avatar_overrides.schema.json

key-decisions:
  - "Default-plugin emotionMap preservation uses DefaultPluginActionBinding rather than generic emotion_bindings, matching the verification gap override."
  - "packages/contracts/tests/test_codegen.py is the focused contract test file for this plan because the referenced file did not previously exist."

patterns-established:
  - "New contract models must be registered in codegen TARGETS and OWNER_FILE before generated TypeScript/JSON Schema mirrors are accepted."
  - "Persisted avatar override schema keeps the same reserved-name rejection policy for default plugin action codes as variant and event codes."

requirements-completed: [IMP-05, IMP-09, ARCH-02]

duration: 6min
completed: 2026-05-08
---

# Phase 08 Plan 04: Default Plugin Action Binding Contracts Summary

**Default-plugin action-code binding contracts preserve OLVT emotionMap entries through shared contracts, generated mirrors, and persisted avatar override validation.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-08T09:34:23Z
- **Completed:** 2026-05-08T09:39:51Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Added `DefaultPluginActionBinding` with fixed `plugin_name="default"`, validated action codes, non-negative expression indexes, and `olvt_emotionMap`/`manual` source tracking.
- Added `default_plugin_action_bindings` to `AvatarOverrides`, `AvatarImportPlan`, and `RigCapabilities`.
- Regenerated TypeScript and JSON Schema outputs, including `action-binding` artifacts and index exports.
- Updated `sidecar/schemas/avatar_overrides.schema.json` so persisted bindings validate required item fields and reserved action-code names.

## Task Commits

1. **Task 1: Add default-plugin action binding contracts** - `f619190` (feat)
2. **Task 2: Regenerate TS/JSON schema and runtime avatar-overrides schema** - `7b8d3d9` (feat)

## Files Created/Modified

- `packages/contracts/py/contracts/action_binding.py` - Source-of-truth Pydantic contract.
- `packages/contracts/py/contracts/avatar_overrides.py` - Persisted overrides binding list.
- `packages/contracts/py/contracts/avatar_import_plan.py` - Import-plan binding transport list.
- `packages/contracts/py/contracts/rig_capabilities.py` - Plugin/HUD on-load binding surface.
- `packages/contracts/scripts/codegen.py` - New codegen model target and owner mapping.
- `packages/contracts/generated/json-schema/*.schema.json` - Generated action-binding and owner schema updates.
- `packages/contracts/ts/*.ts` - Generated action-binding and owner TypeScript updates.
- `packages/contracts/ts/index.ts` - Public TypeScript export for `DefaultPluginActionBinding`.
- `sidecar/schemas/avatar_overrides.schema.json` - Runtime persisted schema validation for default-plugin action bindings.
- `packages/contracts/tests/test_codegen.py` - Focused validation, serialization, generated output, and sidecar schema tests.

## Decisions Made

- Default-plugin action bindings remain explicitly scoped to `plugin_name="default"` rather than a generic plugin-binding surface.
- Sidecar persisted schema mirrors the existing reserved-name rejection policy for variant/event codes on `action_code`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The ambient `python -m pytest` uses a Conda Python without `pytest`; verification was run through the repo-managed sidecar environment with `uv run --project sidecar python -m pytest ...`.
- The plan referenced `packages/contracts/tests/test_codegen.py`, which did not exist. Created it as the focused local contract/codegen test file.

## Verification

- `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q` - 8 passed.
- `npm run check:contracts` - passed.
- Explicit required file/pattern assertions passed for Python contracts, sidecar schema, and TypeScript index export.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 08-05 can consume `default_plugin_action_bindings` in runtime sidecar integration and evidence flows without adding new shared contract surfaces.

## Self-Check: PASSED

- Found summary and created action-binding contract artifacts.
- Found task commits `f619190` and `7b8d3d9` in git history.

---
*Phase: 08-avatar-import-catalogs*
*Completed: 2026-05-08*
