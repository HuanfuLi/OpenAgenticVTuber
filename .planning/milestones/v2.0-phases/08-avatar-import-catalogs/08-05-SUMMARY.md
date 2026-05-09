---
phase: 08-avatar-import-catalogs
plan: 05
subsystem: avatar-import
tags: [avatar-import, live2d, vtube-studio, react, pyvts, uat]

requires:
  - phase: 08-avatar-import-catalogs
    provides: AvatarImportPlan, default_plugin_action_bindings, import review UI, VTS smoke foundations
provides:
  - App-managed avatar override persistence for imported rigs
  - Non-sticky AvatarImport Save/Cancel footer layout
  - VTS smoke fail-fast authentication handling and reset guidance
  - Native Teto import and VTS introspection UAT evidence
affects: [phase-06-plugin-runtime-default-plugin, phase-08-avatar-import-catalogs, avatar-catalog-uat]

tech-stack:
  added: []
  patterns: [Repo-root avatar override persistence, stable VTS plugin identity, human-action UAT evidence files]

key-files:
  created:
    - sidecar/tests/vts/test_vts_introspect_smoke.py
    - avatars/重音テト/_avatar_overrides.yaml
  modified:
    - sidecar/src/sidecar/admin/avatar.py
    - sidecar/tests/avatar/test_admin_avatar.py
    - sidecar/tests/avatar/test_reimport.py
    - apps/renderer/src/screens/AvatarImport/AvatarImport.tsx
    - apps/renderer/src/screens/AvatarImport/AvatarImport.module.css
    - apps/renderer/tests/AvatarImport.test.tsx
    - sidecar/scripts/vts_introspect_smoke.py
    - .planning/phases/08-avatar-import-catalogs/08-DOGFOOD-UAT.md
    - .planning/phases/08-avatar-import-catalogs/08-VTS-SMOKE-UAT.md
    - .planning/phases/08-avatar-import-catalogs/08-UAT.md

key-decisions:
  - "Persist imported override YAML under the repo-managed `avatars/<avatar_id>/_avatar_overrides.yaml` path, while preserving the selected Live2D folder only as `source_rig_path` metadata."
  - "Use the imported avatar id/display name from the runtime flow; the Teto dogfood produced `avatars/重音テト/_avatar_overrides.yaml`, not the legacy shorthand `avatars/teto/_avatar_overrides.yaml`."
  - "Treat invalid or revoked VTS tokens as authentication failures before HotkeyList, with explicit token reset and plugin re-approval instructions."

patterns-established:
  - "Avatar import commit validates the selected source folder but never writes `_avatar_overrides.yaml` into that external model directory."
  - "VTS smoke scripts must check `request_authenticate()` before issuing authenticated API requests."
  - "Human UAT evidence records both the app-managed runtime path and the external source folder mutation check."

requirements-completed: [IMP-05, IMP-08, IMP-09, IMP-10, ARCH-02]

duration: 35min
completed: 2026-05-08
---

# Phase 08 Plan 05: Avatar Import UAT Gap Closure Summary

**Avatar imports now save reviewed catalogs to app-managed avatar override files, keep source Live2D folders intact, and verify VTS introspection after token re-approval.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-08T10:00:00Z
- **Completed:** 2026-05-08T11:00:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Changed avatar import commit persistence from `source_rig_path/_avatar_overrides.yaml` to repo-managed `avatars/<avatar_id>/_avatar_overrides.yaml`.
- Preserved `source_rig_path` in the saved YAML while keeping the selected `Live2D/重音テト/` source folder out of the write path.
- Removed the sticky/banner treatment from the AvatarImport Save/Cancel controls.
- Added VTS smoke auth tests and fail-fast reset guidance for invalid or revoked tokens.
- Completed native-dialog dogfood evidence with `avatars/重音テト/_avatar_overrides.yaml` and final VTS smoke PASS evidence.

## Task Commits

1. **Task 1: Fix avatar override commit destination policy** - `72f7790` (test), `3d88637` (fix)
2. **Task 2: Fix import footer layout and VTS smoke authentication** - `819ad9c` (test), `018d80e` (fix)
3. **Task 3: Rerun native-dialog dogfood and VTS smoke evidence** - `fcfd01f` (docs), plus final evidence commit for VTS PASS

Prior 08-05 partial commits kept intact: `d527636`, `11056a3`, `5a40316`.

## Files Created/Modified

- `sidecar/src/sidecar/admin/avatar.py` - Derives commit destination from repo root plus `avatars/<avatar_id>/_avatar_overrides.yaml`.
- `sidecar/tests/avatar/test_admin_avatar.py` - Regression coverage for runtime destination writes and source-folder non-mutation.
- `sidecar/tests/avatar/test_reimport.py` - Reimport coverage for app-managed override loading.
- `apps/renderer/src/screens/AvatarImport/AvatarImport.tsx` - Stable footer test hook for Save/Cancel controls.
- `apps/renderer/src/screens/AvatarImport/AvatarImport.module.css` - Normal bottom-of-page footer layout without sticky/banner styling.
- `apps/renderer/tests/AvatarImport.test.tsx` - Renderer and CSS assertions for the footer layout.
- `sidecar/scripts/vts_introspect_smoke.py` - Stable plugin identity and authentication failure handling before HotkeyList.
- `sidecar/tests/vts/test_vts_introspect_smoke.py` - Auth rejection and unavailable-VTS smoke tests.
- `.planning/phases/08-avatar-import-catalogs/08-DOGFOOD-UAT.md` - Native dialog dogfood PASS evidence.
- `.planning/phases/08-avatar-import-catalogs/08-VTS-SMOKE-UAT.md` - VTS smoke PASS evidence after token reset.
- `avatars/重音テト/_avatar_overrides.yaml` - Saved reviewed Teto catalog artifact.

## Decisions Made

- The selected rig folder is provenance, not persistence. It is validated and stored as `source_rig_path`, but never used as the target directory for committed overrides.
- The Japanese imported avatar id/path is the correct runtime result for this dogfood pass. Legacy `avatars/teto` naming can be reconciled separately.
- A revoked VTS token is not a HotkeyList shape failure. The smoke exits with reset guidance before authenticated requests, then passes after token reset and approval.

## Deviations from Plan

The original checkpoint text expected `avatars/teto/_avatar_overrides.yaml`, but the actual native import flow correctly saved under the imported avatar id/display name: `avatars/重音テト/_avatar_overrides.yaml`. Evidence and summary were updated to match the runtime behavior.

## Issues Encountered

- VTube Studio initially rejected the existing token as invalid or revoked. Deleting `sidecar/.vts_token.txt`, removing/re-approving the `AgenticLLMVTuber` plugin entry, and rerunning the smoke produced the final PASS result.
- `sidecar/.vts_token.txt` changed during re-authentication and was intentionally left unstaged.

## Verification

- `cd sidecar; uv run pytest tests/avatar/test_admin_avatar.py tests/avatar/test_reimport.py tests/vts/test_vts_introspect_smoke.py -q --tb=short` - 12 passed.
- `npm --workspace apps/renderer run test -- --run AvatarImport` - 11 passed.
- Static footer CSS check - passed.
- Saved override schema validation for `avatars/重音テト/_avatar_overrides.yaml` - passed.
- `cd sidecar && uv run python scripts/vts_introspect_smoke.py` - PASS: `pyvts 0.3.3 + VTS API "1.0" introspection shape verified`.

## Known Stubs

None.

## User Setup Required

None for the completed UAT. Future VTS token revocations can be handled by deleting `sidecar/.vts_token.txt` and re-approving the `AgenticLLMVTuber` plugin in VTube Studio.

## Next Phase Readiness

Phase 8 gaps are closed. Future avatar work should treat `avatars/<avatar_id>/_avatar_overrides.yaml` as the runtime artifact and avoid writing into arbitrary user-selected model directories.

## Self-Check: PASSED

- `08-DOGFOOD-UAT.md` is `status: pass`.
- `08-VTS-SMOKE-UAT.md` is `status: pass`.
- `08-UAT.md` reports 5/5 tests passed.
- Runtime artifact exists at `avatars/重音テト/_avatar_overrides.yaml`.

---
*Phase: 08-avatar-import-catalogs*
*Completed: 2026-05-08*
