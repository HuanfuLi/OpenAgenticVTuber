---
phase: 08-avatar-import-catalogs
evidence: dogfood-native-dialog
status: pending
date: ""
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
9. Confirm the resulting file path is `avatars/teto/_avatar_overrides.yaml`.
10. Validate the saved YAML with `jsonschema.validate` against the sidecar avatar overrides schema.

## Evidence To Fill

- selected folder:
- variants before Save:
- rows renamed:
- rows deleted:
- resulting path:
- validation command:
- validation output:

## Pass Criteria

- `status: pass` is set in the frontmatter.
- The selected folder evidence names `Live2D/重音テト/`.
- `avatars/teto/_avatar_overrides.yaml` exists.
- The YAML contains `variants`, `events`, `default_plugin_action_bindings`, and `source_rig_path`.
- `jsonschema.validate` succeeds for the saved YAML.
