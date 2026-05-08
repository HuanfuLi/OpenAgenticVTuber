---
status: complete
phase: 08-avatar-import-catalogs
source:
  - 08-01-SUMMARY.md
  - 08-02-SUMMARY.md
  - 08-03-SUMMARY.md
  - 08-04-SUMMARY.md
started: 2026-05-08T06:06:51.3290149-04:00
updated: 2026-05-08T06:33:08.7356878-04:00
---

## Current Test

[testing complete]

## Tests

### 1. Native Dialog Teto Import Save
expected: Run the app with `npm run dev`, open Settings, click `Edit avatar catalogs`, choose `Live2D/重音テト/` through the native folder dialog, review the extracted catalog, rename or delete at least one row, save, and confirm `avatars/teto/_avatar_overrides.yaml` exists. The YAML should validate and contain `variants`, `events`, `default_plugin_action_bindings`, and `source_rig_path`.
result: issue
reported: "Panel works, but the Cancel/Save catalogs controls are in a misaligned dedicated bottom banner and should be regular bottom-of-page buttons. The save did create `_avatar_overrides.yaml`, but it was written under `Live2D/重音テト/` instead of the expected runtime/evidence path `avatars/teto/_avatar_overrides.yaml`. The legacy `teto_overrides.yaml` name is not the correct Phase 8 target. User clarified that imported Live2D/VTS model folders may live anywhere such as Downloads, so Save should write the runtime override to `avatars/teto/_avatar_overrides.yaml` and keep the source folder intact."
severity: blocker

### 2. Placeholder Save Gate
expected: Import a Cubism avatar whose extracted expression names are placeholders such as `exp_01`. The review route keeps Save disabled while any placeholder remains, then enables Save after placeholder codes are renamed to valid semantic codes.
result: pass

### 3. OLVT Model Dict Binding Preservation
expected: Import an OLVT-shape avatar with `model_dict.json`. The import produces semantic variants from `actionMap` and preserves `emotionMap` rows as `default_plugin_action_bindings`; saving keeps those bindings in `_avatar_overrides.yaml`.
result: pass

### 4. Reopen Catalog Editor From Settings
expected: With an existing `_avatar_overrides.yaml`, opening Settings and clicking `Edit avatar catalogs` reopens the review screen for the current avatar. Existing rows are editable, and changed/new rows show the expected review indicators before Save.
result: pass

### 5. VTS Introspection Smoke Evidence
expected: Running `cd sidecar && uv run python scripts/vts_introspect_smoke.py` with VTube Studio and Teto available exits 0 with the PASS output. If VTube Studio or Teto is unavailable, the attempt is recorded as blocked with exit code 3, output containing `Is VTube Studio running?`, date, command, and reason.
result: issue
reported: "Smoke test failed while VTS was open and API was enabled. Output showed AuthenticationResponse authenticated=False with reason 'Authentication request failed because token is invalid or has been revoked by the user.' The subsequent HotkeyList request returned APIError errorID 8: current session is not authenticated. User also observed VTS shows one plugin, while there used to be two before this phase/regression."
severity: blocker

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Saving the native-dialog Teto import creates `avatars/teto/_avatar_overrides.yaml` containing variants, events, default_plugin_action_bindings, and source_rig_path"
  status: failed
  reason: "User clarified: Save catalog creates `_avatar_overrides.yaml`, but it is written under `Live2D/重音テト/` instead of the expected runtime/evidence path `avatars/teto/_avatar_overrides.yaml`. Imported model folders may live anywhere outside the repo, so Save must write the runtime override to `avatars/teto/_avatar_overrides.yaml` and leave the source folder intact."
  severity: blocker
  test: 1
  artifacts:
    - path: "apps/renderer/src/screens/AvatarImport/AvatarImport.tsx"
      issue: "Save flow writes the override to the selected source rig path, not the expected runtime/evidence path."
    - path: "sidecar/src/sidecar/admin/avatar.py"
      issue: "Commit endpoint writes beside `source_rig_path`; Phase 8 evidence requires `avatars/teto/_avatar_overrides.yaml` or an explicit post-save copy/import step."
    - path: "apps/electron-main/src/ipc.ts"
      issue: "IPC save chain completes without surfacing that the artifact landed outside `avatars/teto`."
    - path: "Live2D/重音テト/_avatar_overrides.yaml"
      issue: "Actual UAT save output path."
  missing:
    - "Implement the Phase 8 runtime/evidence path policy: Save catalog writes validated YAML to `avatars/teto/_avatar_overrides.yaml` for the current avatar and does not write into or mutate the selected source rig folder."
    - "Ensure `avatars/teto/_avatar_overrides.yaml` exists and validates after the native-dialog dogfood flow."
    - "Keep `teto_overrides.yaml` treated as legacy; it is not the correct Phase 8 target artifact."
- truth: "Avatar import Save/Cancel controls are placed at the bottom of the page without a misaligned dedicated banner"
  status: failed
  reason: "User reported: Cancel and Save catalogs controls are contained in a misaligned dedicated banner; they should just be placed at the bottom of the page."
  severity: cosmetic
  test: 1
  artifacts:
    - path: "apps/renderer/src/screens/AvatarImport/AvatarImport.tsx"
      issue: "Save/Cancel control layout uses an unwanted dedicated banner container."
    - path: "apps/renderer/src/screens/AvatarImport/AvatarImport.module.css"
      issue: "Footer/banner styling likely causes misalignment."
  missing:
    - "Remove the dedicated banner treatment for Save/Cancel controls."
    - "Place Cancel and Save catalogs buttons naturally at the bottom of the page."
- truth: "VTS introspection smoke authenticates successfully and returns a HotkeyList response with `availableHotkeys` as a list"
  status: failed
  reason: "User reported: VTS API was enabled and VTS responded, but AuthenticationResponse returned authenticated=False because the token is invalid or revoked. The following HotkeyList request failed with APIError errorID 8 because the session was not authenticated. VTS now shows one plugin where two existed before this phase/regression."
  severity: blocker
  test: 5
  artifacts:
    - path: "sidecar/scripts/vts_introspect_smoke.py"
      issue: "Smoke continues to HotkeyList after authentication failure and reports a misleading HotkeyList shape failure instead of stopping on auth failure."
    - path: "sidecar/src/sidecar/vts/handshake.py"
      issue: "Shared VTS authentication/token handling may not recover cleanly from revoked/invalid tokens."
    - path: "sidecar/vendor/pyvts"
      issue: "VTS plugin token identity/storage may be stale or inconsistent with the VTube Studio plugin list."
  missing:
    - "Diagnose why VTS authentication token is invalid/revoked after Phase 8 changes."
    - "Make `vts_introspect_smoke.py` fail loud on AuthenticationResponse authenticated=False before issuing authenticated requests."
    - "Document or automate token reset/re-auth path when VTube Studio revokes the plugin token."
