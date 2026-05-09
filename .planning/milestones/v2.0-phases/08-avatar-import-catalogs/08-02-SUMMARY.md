---
phase: 08-avatar-import-catalogs
plan: 02
subsystem: avatar-import
tags: [fastapi, electron-ipc, pydantic, jsonschema, contracts-codegen, live2d]
requires:
  - phase: 08-avatar-import-catalogs
    provides: "08-01 Pydantic contracts and extractor functions"
provides:
  - "Avatar type detector with Cubism 5.3 MOC3 rejection"
  - "Atomic _avatar_overrides.yaml writer with jsonschema pre-validation"
  - "Sidecar /admin/avatar import, commit, and current endpoints"
  - "Electron avatar import IPC and preload bridge"
  - "Generated TS mirrors for AvatarImportPlan, AvatarOverrides, RigCapabilities, VariantEntry, and EventEntry"
  - "Sidecar boot path using AvatarOverrides plus RigCapabilities"
affects: [08-03, phase-06-plugin-runtime, phase-09-slider-hud]
tech-stack:
  added: []
  patterns: [atomic-yaml-write, sidecar-admin-router, contracts-codegen-targets, rig-capabilities-boot]
key-files:
  created:
    - sidecar/src/sidecar/avatar/import_detect.py
    - sidecar/src/sidecar/avatar/overrides_writer.py
    - sidecar/src/sidecar/admin/avatar.py
    - packages/contracts/ts/avatar-import-plan.ts
    - packages/contracts/ts/avatar-overrides.ts
    - packages/contracts/ts/rig-capabilities.ts
  modified:
    - sidecar/src/sidecar/ws/server.py
    - sidecar/src/sidecar/avatar/rig_capabilities.py
    - apps/electron-main/src/ipc.ts
    - apps/electron-main/src/sidecar.ts
    - apps/electron-main/preload/index.ts
    - packages/contracts/scripts/codegen.py
key-decisions:
  - "Phase 5 codegen is active, so Phase 8 TS mirrors are generated from Pydantic instead of hand-written."
  - "Wire-only is_placeholder fields are allowed over IPC but stripped before _avatar_overrides.yaml validation and persistence."
  - "Task 4 contracts were executed before Task 3 IPC because Electron preload declarations depend on AvatarImportPlan."
patterns-established:
  - "Admin avatar endpoints mount under /admin/avatar and avoid production lifespan dependencies in tests."
  - "Avatar commit writes only schema-persisted catalog fields and carries forward curated override fields."
requirements-completed: [IMP-01, IMP-08]
duration: 55min
completed: 2026-05-08
---

# Phase 08 Plan 02: Avatar Import Backend Summary

**Folder-to-overrides backend path: Live2D type detection, sidecar import endpoints, Electron IPC, generated TS contracts, and RigCapabilities boot wiring**

## Performance

- **Duration:** 55 min
- **Started:** 2026-05-08T00:00:00Z
- **Completed:** 2026-05-08
- **Tasks:** 5
- **Files modified:** 25

## Accomplishments

- Added `detect_type(folder)` with OLVT precedence, Teto VTS detection, Cubism expression/bare detection, Cubism 5.3 rejection, and empty-folder unsupported handling.
- Added `write_avatar_overrides_atomic(target, data)` using jsonschema validation before `.tmp` creation, `fsync`, and `os.replace`.
- Added `/admin/avatar/import`, `/admin/avatar/import/commit`, and `/admin/avatar/import/current`.
- Added Electron IPC channels `avatar:pickFolder`, `avatar:requestImportPlan`, and `avatar:commitOverrides`; preload exposes `pickAvatarFolder`, `requestImportPlan`, and `commitAvatarOverrides`.
- Extended contract codegen to emit TS and JSON Schema for `VariantEntry`, `EventEntry`, `AvatarOverrides`, `RigCapabilities`, and `AvatarImportPlan`.
- Rewired sidecar lifespan to load `AvatarOverrides`, build `RigCapabilities`, log `[BOOT] RigCapabilities loaded`, and source TTS voice from `overrides.voice`.

## Task Commits

1. **Task 1: detector + atomic writer** - `0c612b7`
2. **Task 2: admin avatar endpoints** - `6c4a36c`
3. **Task 4: generated TS contracts** - `1e56c92`
4. **Task 3: Electron IPC bridge** - `e5503da`
5. **Task 5: RigCapabilities boot rewire** - `408e9c4`

## Endpoint Contract

- `POST /admin/avatar/import` accepts `{ "folder": string }` and returns `AvatarImportPlan` with `detected_type`, `source_rig_path`, extracted `variants`, extracted `events`, warnings, and optional `existing_overrides`. It does not write files.
- `POST /admin/avatar/import/commit` accepts `AvatarImportPlan`, writes `<source_rig_path>/_avatar_overrides.yaml` atomically, strips wire-only `is_placeholder`, and returns `{ "status": "ok", "path": string }`.
- `GET /admin/avatar/import/current?avatar_id=teto` returns a `detected_type: "reedit"` plan from `avatars/<id>/_avatar_overrides.yaml`, or 404 when no override file exists.

## IPC Contract

- `avatar:pickFolder` opens `dialog.showOpenDialog({ properties: ['openDirectory'] })`.
- `avatar:requestImportPlan` posts the selected folder to `/admin/avatar/import`.
- `avatar:commitOverrides` posts the plan to `/admin/avatar/import/commit`, stores `currentAvatarId`, and restarts the sidecar.
- `window.api.pickAvatarFolder()`, `window.api.requestImportPlan(folder)`, and `window.api.commitAvatarOverrides(plan)` are available to Plan 08-03.

## Verification

- `cd sidecar && uv run pytest tests/avatar/ -x --no-header` passed: 53 tests.
- `cd sidecar && uv run python -c "from sidecar.ws.server import app; print('OK')"` passed.
- `cd apps/electron-main && npx tsc --noEmit` passed.
- `npm --workspace apps/renderer run typecheck` passed.
- `npm run check:contracts` passed and regenerated no drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Executed contracts before IPC**
- **Found during:** Task 3
- **Issue:** Electron preload declarations needed `AvatarImportPlan`, but Task 4 was scheduled after Task 3.
- **Fix:** Ran Task 4 before Task 3 and documented the reordered commits.
- **Files modified:** `packages/contracts/scripts/codegen.py`, generated contract files.
- **Verification:** Electron and renderer typechecks passed.
- **Committed in:** `1e56c92`

**2. [Rule 1 - Bug] Stripped wire-only fields before YAML validation**
- **Found during:** Task 2
- **Issue:** `VariantEntry.is_placeholder` and `EventEntry.is_placeholder` are IPC/review fields, but `_avatar_overrides.yaml` schema forbids persisting them.
- **Fix:** Added `_drop_wire_only_fields()` before calling `write_avatar_overrides_atomic`.
- **Files modified:** `sidecar/src/sidecar/admin/avatar.py`
- **Verification:** Commit endpoint tests verify YAML excludes `is_placeholder`.
- **Committed in:** `6c4a36c`

**3. [Rule 3 - Blocking] Used active Phase 5 codegen instead of hand-written TS**
- **Found during:** Task 4
- **Issue:** The plan allowed hand-written files only if Phase 5 codegen had not landed; it had landed.
- **Fix:** Added Phase 8 models to `packages/contracts/scripts/codegen.py` and committed generated JSON Schema/TS.
- **Files modified:** `packages/contracts/scripts/codegen.py`, `packages/contracts/generated/json-schema/*`, `packages/contracts/ts/*`
- **Verification:** `npm run check:contracts` passed.
- **Committed in:** `1e56c92`

**Total deviations:** 3 auto-fixed.

## Known Stubs

- `packages/contracts/ts/variant-entry.ts` and `event-entry.ts` include generated `is_placeholder` fields. These are intentional wire-only review fields and are stripped before YAML persistence.
- `sidecar/src/sidecar/ws/server.py` still contains a pre-existing Phase 5 TODO in `_load_provider_config_from_env`; this plan did not touch LLM config ownership.
- Manual dogfood smoke that deletes `avatars/teto/avatar.yaml` and `avatars/teto/teto_overrides.yaml` was not run in this non-interactive executor. Automated import/app/tests passed; Plan 08-03 should perform the operator smoke before deleting legacy files.

## Next Phase Readiness

Plan 08-03 can call the Electron bridge methods directly and render the returned `AvatarImportPlan`. The backend rejects Cubism 5.3 as a friendly warning plan, writes validated YAML atomically, and reloads the sidecar after commit.

## Self-Check: PASSED

- Verified summary and key created files exist.
- Verified task commits exist: `0c612b7`, `6c4a36c`, `1e56c92`, `e5503da`, `408e9c4`.

---
*Phase: 08-avatar-import-catalogs*
*Completed: 2026-05-08*
