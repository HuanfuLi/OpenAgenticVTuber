---
phase: 08-avatar-import-catalogs
evidence: dogfood-native-dialog
status: pass
date: "2026-05-08"
operator: ""
---

# Native Dialog Teto Dogfood UAT

## Procedure

1. Run `npm run dev`.
2. Open Settings.
3. Click `Edit avatar catalogs`.
4. In the native folder dialog, choose `Live2D/重音テト/`.
5. Review the extracted rows on the import screen.
6. Rename at least one row.
7. Delete at least one row.
8. Save the reviewed catalog.
9. Confirm the resulting file path is `avatars/重音テト/_avatar_overrides.yaml`.
10. Validate the saved YAML with `jsonschema.validate` against the sidecar avatar overrides schema.

## Evidence

- selected folder: `Live2D/重音テト/`
- variants before Save: extracted Teto VTS hotkey catalog was visible in the import review screen before Save.
- rows renamed: at least one row renamed during human dogfood UAT.
- rows deleted: at least one row deleted during human dogfood UAT.
- resulting path: `C:\Users\16079\Code\AgenticLLMVTuber\avatars\重音テト\_avatar_overrides.yaml`
- source folder mutation check: source model folder kept intact; `Live2D/重音テト/_avatar_overrides.yaml` was not the save target and must not be staged or modified by this evidence update.
- validation command: `cd sidecar && uv run python -c "from pathlib import Path; import yaml, jsonschema; from sidecar.avatar.overrides_writer import _SCHEMA; p=Path('../avatars/重音テト/_avatar_overrides.yaml'); data=yaml.safe_load(p.read_text(encoding='utf-8')); jsonschema.validate(data, _SCHEMA); assert data['source_rig_path']; assert 'default_plugin_action_bindings' in data; print('OK', p.as_posix())"`
- validation output: `OK ../avatars/重音テト/_avatar_overrides.yaml`

## Pass Criteria

- `status: pass` is set in the frontmatter.
- The selected folder evidence names `Live2D/重音テト/`.
- `avatars/重音テト/_avatar_overrides.yaml` exists.
- The YAML contains `variants`, `events`, `default_plugin_action_bindings`, and `source_rig_path`.
- `jsonschema.validate` succeeds for the saved YAML.
