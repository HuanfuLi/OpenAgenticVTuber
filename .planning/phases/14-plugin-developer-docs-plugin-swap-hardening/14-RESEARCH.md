---
phase: 14-plugin-developer-docs-plugin-swap-hardening
researched: 2026-05-09T09:18:00-04:00
status: complete
---

# Phase 14 Research: Plugin Developer Docs + Plugin Swap Hardening

## Research Goal

Determine how to plan Phase 14 so it documents the v2.0 motion plugin architecture accurately, adds only the stable helper surface plugin authors need, and hardens plugin selection/status without expanding into marketplace, dependency installation, sandboxing, or hot-swap.

## Current Runtime Shape

The current public-ish plugin core is small:

- `sidecar/src/sidecar/plugins/api.py`
  - `BodyMotionPlugin`
  - `ApiVersion.V1 = "1.0"`
  - `on_load(capabilities, overrides)`
  - `on_token_stream(sentence)`
  - optional `on_action_code(action)`
  - optional `on_unload()`
- `packages/contracts/py/contracts/param_frame.py`
  - `ParamFrame(add_params, set_params, tick_n, emitted_at_monotonic)`
- `packages/contracts/py/contracts/rig_capabilities.py`
  - writable params and rig metadata passed to plugins at boot.
- `packages/contracts/py/contracts/avatar_overrides.py`
  - avatar-level overrides passed to plugins at boot.
- `sidecar/src/sidecar/plugins/manifest.py`
  - manifest validation for plugin name, action codes, API major compatibility, duplicate codes, and reserved/bracketed names.

The default plugin in `plugins/default/` is a real plugin, but it is too complex to serve as the minimal tutorial example. It owns fallback emotion compositions, split-token bracket parsing, ramp behavior, bindings, and `render_frame(now)`.

## Gaps Confirmed

### Author-Facing Helper Surface

There are useful internal helpers, but no stable author helper kit:

- `sidecar.plugins.loader` is system-owned loader/prompt/watch plumbing, not a plugin SDK.
- `sidecar.compositor.clamp` validates frames at the compositor boundary, not as an author-facing builder.
- `sidecar.compositor.param_id_resolver` is system/compositor-oriented.
- Default plugin body-sway files are examples/artifacts, not a general helper layer.

Phase 14 should add a small stable v1 helper module, likely `sidecar.plugins.sdk` or `sidecar.plugins.helpers`, with tightly scoped author utilities:

- parse bracketed action codes from sentence text
- ramp/easing helpers
- finite-value and writable-param filtering
- safe `ParamFrame` builder helpers
- test/adaptation helpers where small and deterministic

This helper kit becomes part of plugin API v1 once documented.

### Plugin Listing Parity

Electron currently lists plugins with a lightweight YAML scalar parser in `apps/electron-main/src/sidecar.ts`. The sidecar uses Pydantic validation in `sidecar.plugins.loader.load_manifest`. This creates a parity gap:

- Renderer can list a plugin that the sidecar will reject.
- Invalid user plugin manifests may be hidden or partially parsed.
- Settings cannot show validation errors because the listing summary has no status/error fields.

Phase 14 should make plugin listing validation-aware and include invalid entries with actionable errors. This can be implemented in Electron main with a stricter manifest reader or through a sidecar/admin-style validation helper, but planning should require parity with the sidecar manifest contract.

### Plugin Runtime Health

The sidecar already has the runtime facts needed for health:

- selected plugin id comes from `AGENTICLLMVTUBER_ACTIVE_PLUGIN`
- loaded manifest is stored on `app.state.plugin_manifest`
- `PluginSupervisor` wraps the plugin and can report `circuit_open`
- load failures fall back to `NullPlugin`

But the UI does not expose these facts. VTS status is exposed via `/admin/vts-status`; there is no equivalent plugin health endpoint/surface.

Phase 14 should expose a plugin status payload with lifecycle states:

- `active`
- `restart_pending`
- `load_failed`
- `fallback_null`
- `circuit_open`
- `invalid_manifest`
- `unknown_loading`

Names in code can use snake_case while copy renders human-readable labels.

### Swap Behavior

The selected plugin is boot-time:

- Electron saves `StoredConfig.plugin.activePluginName`
- `spawnSidecar()` reads it and sets `AGENTICLLMVTUBER_ACTIVE_PLUGIN`
- the sidecar boot path builds the manifest, prompt catalog, plugin instance, supervisor, and adapter once

Settings currently saves the config but does not clearly apply it. Phase 14 should auto-restart the sidecar after selection and show progress/result. Invalid plugins remain selectable with warning so plugin authors can test failure paths.

### Documentation and Skill Artifacts

There is no top-level `docs/` directory yet. README mentions plugins but is not a developer guide.

Recommended doc set:

- `docs/plugins/README.md`
- `docs/plugins/motion-plugin-authoring.md`
- `docs/plugins/plugin-system-integration.md`
- `docs/plugins/ai-motion-plugin-playbook.md`
- `docs/plugins/default-and-sample-plugins.md`

The tool-neutral AI playbook should be canonical. A thin `.codex/skills/.../SKILL.md` wrapper can point Codex at the canonical Markdown and source anchors. The wrapper should follow the system `skill-creator` guidance: concise frontmatter, concise body, no redundant README, references only when useful.

## Planning Recommendation

Use two plans:

1. **14-01 Author-facing contract, helper kit, sample plugin, docs, AI playbook**
   - Add small stable plugin helper module.
   - Add minimal sample plugin.
   - Add docs and Codex skill wrapper.
   - Add sidecar tests for helper kit and sample plugin.

2. **14-02 Plugin listing/swap/status hardening**
   - Make listing validation-aware and include invalid selectable entries.
   - Auto-restart sidecar after selection.
   - Expose plugin health and fallback state to Settings and Status popover.
   - Add renderer/Electron/sidecar tests and UAT checklist.

This order prevents docs from describing helper/status contracts that do not exist yet and keeps UI hardening grounded in the stable author-facing contract.

## Test Strategy

Sidecar:

- `uv run pytest tests/plugins/test_manifest_loader.py tests/plugins/test_supervisor.py tests/plugins/test_default_plugin.py tests/plugins/test_sample_plugin.py tests/plugins/test_plugin_sdk.py`
- Add or extend tests for invalid manifest summary/listing parity.
- Add plugin health endpoint tests if implemented under `sidecar/tests/admin/`.

Renderer/Electron:

- `npm --workspace apps/renderer run test -- Settings.test.tsx StatusIcon.test.tsx`
- `npm --workspace apps/renderer run typecheck`
- Existing Electron-main build gate: `npm --workspace apps/electron-main run build`

Docs/skill:

- The docs should be source-anchored and checked for stale claims by tests or at least a focused grep/assertion test where practical.
- Codex skill wrapper should be validated manually against the `skill-creator` guidance; avoid adding a heavyweight generated marketplace plugin.

## Risks

| Risk | Mitigation |
|------|------------|
| Docs describe internals as public API | Keep stable contract list explicit; mark loader/compositor/VTS writer internals as internal. |
| Helper kit expands into a full SDK | Keep helper module small and v1-stable only for parser/ramp/frame/writable filtering. |
| Invalid selectable plugins confuse non-developer users | Copy should frame this as developer-oriented and warn before/while selecting. |
| Plugin failure blocks conversation | Plugin health is a warning/degraded state only; Chat must not block. |
| Renderer listing diverges from sidecar validation | Use shared manifest semantics or tests that manufacture invalid manifests and compare outcomes. |

## Open Questions for Planning

None requiring user input. The discuss-phase decisions are specific enough to plan.

## RESEARCH COMPLETE
