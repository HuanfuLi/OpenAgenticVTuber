---
status: diagnosed
trigger: "Diagnose Phase 8 UAT gap: Native dialog Save writes `_avatar_overrides.yaml` under the selected source rig folder (e.g. `Live2D/重音テト/`) instead of the app-managed runtime path `avatars/teto/_avatar_overrides.yaml`. Do not edit files."
created: 2026-05-08T06:34:57.1530600-04:00
updated: 2026-05-08T06:36:30.0000000-04:00
---

## Current Focus

hypothesis: commit endpoint derives write target from source_rig_path instead of app-managed avatar runtime directory
test: trace renderer IPC sidecar commit path and relevant tests
expecting: commit_avatar writes to Path(plan.source_rig_path) / "_avatar_overrides.yaml"
next_action: return root cause and minimal fix plan

## Symptoms

expected: Native dialog Save writes runtime overrides to avatars/teto/_avatar_overrides.yaml while preserving source_rig_path.
actual: Save writes _avatar_overrides.yaml under selected source rig folder such as Live2D/重音テト/.
errors: none reported
reproduction: Run app, Settings, Edit avatar catalogs, choose Live2D/重音テト/ via native dialog, rename/delete a row, Save.
started: Phase 8 UAT

## Eliminated

## Evidence

- timestamp: 2026-05-08T06:34:57.1530600-04:00
  checked: .planning/phases/08-avatar-import-catalogs/08-UAT.md
  found: UAT records Save created _avatar_overrides.yaml in Live2D/重音テト/ instead of avatars/teto/_avatar_overrides.yaml.
  implication: failure is path policy, not YAML validation.
- timestamp: 2026-05-08T06:34:57.1530600-04:00
  checked: apps/renderer/src/screens/AvatarImport/AvatarImport.tsx
  found: handleSave sends the plan plus edited variants/events to window.api.commitAvatarOverrides without supplying a runtime destination.
  implication: renderer preserves source_rig_path and delegates destination choice to backend.
- timestamp: 2026-05-08T06:34:57.1530600-04:00
  checked: apps/electron-main/src/ipc.ts
  found: avatar:commitOverrides POSTs the plan unchanged to /admin/avatar/import/commit, then stores currentAvatarId as plan.avatar_id || "teto".
  implication: Electron does not translate avatar_id into avatars/<id> for write target.
- timestamp: 2026-05-08T06:34:57.1530600-04:00
  checked: sidecar/src/sidecar/admin/avatar.py
  found: commit_avatar sets target_dir = Path(plan.source_rig_path), validates that folder, then target = target_dir / "_avatar_overrides.yaml".
  implication: root cause is confirmed; writer target is the selected external/source folder.
- timestamp: 2026-05-08T06:36:30.0000000-04:00
  checked: sidecar/tests/avatar/test_admin_avatar.py and sidecar/tests/avatar/test_reimport.py
  found: tests assert commit output under tmp_path / "_avatar_overrides.yaml", where tmp_path is also source_rig_path.
  implication: existing tests encode the wrong destination policy and must be changed to assert avatars/<avatar_id>/_avatar_overrides.yaml.

## Resolution

root_cause: commit_avatar uses source_rig_path as the persistence directory instead of treating it as metadata and writing to the app-managed avatars/<avatar_id> directory.
fix: not applied; diagnose-only request.
verification: source and test inspection only; no implementation edits.
files_changed: []
