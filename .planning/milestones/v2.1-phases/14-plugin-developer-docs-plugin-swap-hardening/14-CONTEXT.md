# Phase 14: Plugin Developer Docs + Plugin Swap Hardening - Context

**Gathered:** 2026-05-09T09:07:40.5767650-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 makes the v2.0 body-motion plugin system understandable and operable before the mock-boundary audit. It produces code-verified plugin developer documentation, a tool-neutral AI motion-plugin adaptation playbook, a thin Codex adapter skill if useful, a small stable plugin-author helper kit, and plugin swap/status hardening so Settings reflects what actually happens when a plugin is selected.

In scope:
- Top-level plugin docs for human developers and AI coding agents.
- A tutorial-plus-reference human author guide.
- A tool-neutral AI playbook usable by Codex, Claude, Gemini, and similar coding agents.
- A thin Codex skill wrapper around the tool-neutral playbook.
- A minimal sample plugin separate from `plugins/default`.
- A small stable v1 helper kit for plugin authors.
- Settings/status behavior for plugin selection, auto-restart, invalid manifests, load failures, `NullPlugin` fallback, and circuit-open state.
- Tests and UAT that prove docs, sample plugin, live swap, and broken-plugin fallback work.

Out of scope:
- Plugin marketplace, browse/install UX, ratings, packaging, signing, or sandboxing.
- Auto-installing plugin Python dependencies.
- Per-plugin virtual environments or subprocess isolation.
- Mid-conversation hot-swap. Plugin vocabulary and runtime behavior remain boot-time and apply through sidecar restart.
- General-purpose plugin generation beyond adapting motion algorithms to this app's `BodyMotionPlugin` contract.

</domain>

<decisions>
## Implementation Decisions

### Documentation Structure

- **D-01:** Use separate focused docs rather than one long guide.
- **D-02:** Expected docs should include a plugin docs landing page, a human author guide, a system integration/swap guide, an AI motion-plugin playbook, and a default/sample plugin example.
- **D-03:** The human author guide should be a build-a-plugin tutorial plus reference. It starts from a minimal working plugin, then explains manifest fields, hooks, `ParamFrame`, tests, and troubleshooting.
- **D-04:** Documentation must be code-verified against the current runtime. It should not describe a future marketplace, sandbox, auto-dependency installer, or hot-swap system.

### AI Motion-Plugin Playbook and Skill

- **D-05:** Add an actual reusable coding-agent aid for adapting motion algorithms into this plugin runtime.
- **D-06:** The canonical artifact is a tool-neutral Markdown playbook, likely `docs/plugins/ai-motion-plugin-playbook.md`, written so Codex, Claude, Gemini, or another coding agent can follow it.
- **D-07:** Add a thin Codex adapter skill under `.codex/skills/` only as a wrapper around the tool-neutral playbook. The Codex skill must not become the canonical source of truth.
- **D-08:** The playbook should focus on algorithm adaptation: inspect the source algorithm, map outputs to `ParamFrame`, respect writable params, use helper-kit utilities, avoid VTS ownership, and add tests.

### Supported Plugin Contract

- **D-09:** Supported contract is the minimal core API plus a small plugin-author helper kit.
- **D-10:** Stable core API includes `plugin.yaml`, `BodyMotionPlugin`, `ParamFrame`, `RigCapabilities`, `AvatarOverrides`, and documented test commands.
- **D-11:** Everything outside that contract and helper kit is internal unless explicitly documented as author-facing. Runtime internals such as loader plumbing, compositor merge internals, VTS writer, and sidecar boot internals must not be presented as plugin-author APIs.
- **D-12:** Add a small author-facing helper kit, likely under `sidecar.plugins.sdk` or `sidecar.plugins.helpers`, for common plugin-author tasks.
- **D-13:** Helper kit should include, at minimum where practical: action-code/bracket parsing, ramp/easing helpers, safe `ParamFrame` construction or finite-value filtering, writable-param filtering, and test/adaptation helpers.
- **D-14:** Once documented, helper-kit signatures are stable within plugin API v1. Breaking changes require plugin API v2 or a documented migration.

### Examples

- **D-15:** Add a minimal sample plugin separate from `plugins/default`.
- **D-16:** The sample plugin should be intentionally tiny and contract-focused, with one or two action codes and no default-plugin complexity.
- **D-17:** Automated tests should exercise the sample plugin so it remains runnable and honest.
- **D-18:** The default plugin remains a worked real-world example, but it is not the minimal tutorial example.

### Plugin Swap Behavior

- **D-19:** Selecting a different plugin in Settings should auto-restart the sidecar so the boot-time plugin setting actually applies.
- **D-20:** Settings should show progress/result for the save-and-restart flow.
- **D-21:** If a selected plugin fails to load, keep the selected plugin configured, run `NullPlugin`, and show a visible failure. Do not silently revert to the previous plugin or default plugin.
- **D-22:** Invalid plugin manifests should appear in Settings with an error state and manifest/load error.
- **D-23:** Invalid plugins should remain selectable with a warning. This supports developer iteration and deliberately exercises the failure path.

### Plugin Health Visibility

- **D-24:** Plugin health should appear in both the Settings plugin section and the upper-right Status popover.
- **D-25:** Settings owns detailed plugin state and troubleshooting text. Status popover owns compact health/fallback visibility during normal chat.
- **D-26:** UI should distinguish lifecycle states: `active`, `restart pending`, `load failed`, `fallback/null`, `circuit open`, `invalid manifest`, and `unknown/loading`.
- **D-27:** Failure details should use an actionable summary plus expandable developer details, such as manifest validation errors, load exception snippets, or relevant log excerpts.
- **D-28:** Plugin failure must not block chat. LLM, TTS, VTS connection, variants/events, and normal conversation continue where possible; only plugin-driven body motion is degraded.

### Testing and UAT

- **D-29:** Manual UAT must verify docs plus the live swap path: follow the docs to run the sample plugin, switch to it, observe auto-restart, intentionally select a broken plugin, and observe visible fallback/error state.
- **D-30:** Automated tests must cover plugin discovery/listing parity, active-plugin persistence, restart behavior, invalid-plugin visibility/selectability, load-failure fallback reporting, sample plugin smoke behavior, and Status/Settings health rendering.
- **D-31:** The sample plugin should be used as a test fixture rather than only synthetic temp plugins.

### the agent's Discretion

- Exact filenames and navigation labels for the focused docs, provided the tool-neutral playbook remains canonical for non-Codex agents.
- Exact module name for the helper kit, provided it is clearly author-facing and stable within plugin API v1.
- Exact sample plugin action names and parameter output, provided it stays minimal and runnable.
- Exact wording and compact visual treatment for plugin status in the Status popover.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Active v2.1 Scope
- `.planning/ROADMAP.md` - Phase 14 goal, plans, success criteria, and Phase 15 audit dependency.
- `.planning/REQUIREMENTS.md` - PLUGDOC-01 through PLUGDOC-05 plus v2.1 boundaries.
- `.planning/PROJECT.md` - milestone intent and deferred v3.0/v4.0 scope.
- `.planning/STATE.md` - current workflow state and v2.0 plugin architecture flags.

### Prior Plugin Decisions
- `.planning/milestones/v2.0-phases/06-plugin-runtime-default-plugin/06-CONTEXT.md` - locked plugin trust model, file-path loading, no auto dependency install, boot-time vocabulary, userData precedence, `BodyMotionPlugin` API, and default-plugin boundaries.
- `.planning/milestones/v2.0-phases/06-plugin-runtime-default-plugin/06-VERIFICATION.md` - verified plugin runtime, single-writer invariant, supervised adapter, default plugin behavior, and prior plugin UAT gaps.
- `.planning/milestones/v2.0-phases/07-three-category-code-parsing-dispatch/07-VERIFICATION.md` - current `[action]`, `{variant}`, `<event>` dispatch contract and prompt catalog behavior.
- `.planning/skeleton-verification.md` - current v2.0 operator verification and active plugin/action vocabulary.

### Code Anchors
- `sidecar/src/sidecar/plugins/api.py` - current `BodyMotionPlugin` and `ApiVersion` author-facing core.
- `sidecar/src/sidecar/plugins/manifest.py` - manifest schema, reserved-name validation, API major compatibility, duplicate action-code validation.
- `sidecar/src/sidecar/plugins/loader.py` - current internal discovery, manifest loading, userData precedence, dispatch prompt section, and manifest watcher.
- `sidecar/src/sidecar/plugins/supervisor.py` - `NullPlugin`, load timeout, circuit breaker, unload, and fallback behavior.
- `packages/contracts/py/contracts/param_frame.py` - `ParamFrame` shape and add/set semantics.
- `packages/contracts/py/contracts/rig_capabilities.py` - `RigCapabilities` source for writable params and rig metadata.
- `packages/contracts/py/contracts/avatar_overrides.py` - `AvatarOverrides` source for avatar-level plugin inputs.
- `plugins/default/plugin.yaml` - real default manifest example.
- `plugins/default/__init__.py` - real default plugin implementation and current action behavior.
- `apps/electron-main/src/sidecar.ts` - plugin listing, active-plugin env handoff, restart path, and current lightweight YAML summary gap.
- `apps/electron-main/src/safe-storage.ts` - persisted `activePluginName` config shape.
- `apps/electron-main/src/ipc.ts` - current plugin listing IPC and sidecar restart IPC.
- `apps/electron-main/preload/index.ts` - renderer API whitelist pattern for any new plugin status/listing calls.
- `apps/renderer/src/screens/Settings/Settings.tsx` - current plugin selection UI and save-only behavior.
- `apps/renderer/src/chrome/StatusIcon.tsx` - compact status popover target for plugin health.
- `apps/renderer/src/lib/copy.ts` - user-facing Settings/Status copy.
- `sidecar/src/sidecar/admin/status.py` - existing VTS-only status endpoint pattern; likely extension or sibling endpoint for plugin health.
- `sidecar/src/sidecar/ws/server.py` - boot path that discovers the active plugin, loads manifest/entrypoint, constructs supervisor/adapter, and stores app state.
- `sidecar/tests/plugins/` - existing manifest/default-plugin/runtime tests.
- `sidecar/tests/compositor/test_plugin_adapter.py` - current adapter/supervisor/default plugin behavior coverage.
- `apps/renderer/tests/Settings.test.tsx` and `apps/renderer/tests/StatusIcon.test.tsx` - renderer tests likely updated for plugin health and restart behavior.

### Skill Creation Reference
- `C:/Users/16079/.codex/skills/.system/skill-creator/SKILL.md` - Codex skill anatomy and validation guidance for the thin Codex adapter skill.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `BodyMotionPlugin` already defines the core hook surface: `on_load`, `on_token_stream`, optional `on_action_code`, and `on_unload`.
- `ParamFrame` already separates additive and set params; docs and helper kit should teach this as the per-tick contribution unit, not a websocket message.
- `PluginManifest` already validates names, reserved codes, brackets, duplicate action codes, and compatible API major version.
- `PluginSupervisor` already provides `NullPlugin` fallback and circuit-open behavior; Phase 14 can surface that state rather than inventing a new fallback model.
- `restartSidecar()` already exists in Electron main and can apply selected plugins because `AGENTICLLMVTUBER_ACTIVE_PLUGIN` is read on spawn.
- `Settings` already has a plugin section and radio-row selection pattern; Phase 14 should harden that surface instead of introducing a new plugin manager.
- `StatusIcon` already displays compact subsystem status; plugin health can join that pattern.

### Established Patterns

- Renderer-to-main capabilities go through preload and IPC. Plugin status/listing/restart APIs should follow that bridge.
- Settings is the detailed configuration/troubleshooting surface; the top-right Status popover is the compact live state surface.
- User-visible copy is centralized in `COPY`.
- VTS ownership is sidecar/system-only through the single safe writer. Plugins must not import pyvts, call VTS APIs, or own auth.
- UserData plugin manifests override repo manifests with the same name; duplicate userData plugin names fail loudly.
- Manifest changes are warning-only during a running session. Active vocabulary remains boot-frozen until sidecar restart.

### Integration Points

- Replace or extend `listBodyMotionPlugins()` so renderer listing parity matches sidecar manifest validation and includes invalid entries with error state.
- Add plugin runtime health to sidecar app state and expose it through a status/admin endpoint or Electron-side status bridge.
- Update Settings plugin selection to save the selected plugin, auto-restart sidecar, and show lifecycle result.
- Add visible failure/fallback/circuit-open states without blocking Chat.
- Add an author-facing helper module and update docs/sample/tests to use it.
- Add a minimal sample plugin and tests that import/load it through the same runtime path used for real plugins.
- Add a tool-neutral Markdown playbook plus thin `.codex/skills/.../SKILL.md` wrapper.

</code_context>

<specifics>
## Specific Ideas

- The user specifically wants a coding-agent aid that can help adapt arbitrary motion algorithms to this system, not just a Codex-only prompt.
- The tool-neutral playbook should be canonical because Claude and Gemini should be able to use it by reading Markdown.
- The Codex skill, if created, should be a thin adapter that points to the canonical playbook and source anchors.
- Invalid plugins remain selectable intentionally, because this phase is for developers and should support iterative failure-path testing.
- Chat must remain usable even when plugin motion is degraded.

</specifics>

<deferred>
## Deferred Ideas

- Plugin marketplace, installation UX, signing, sandboxing, and per-plugin dependency management remain deferred.
- Hot-swapping plugin vocabulary or behavior without sidecar restart remains deferred.
- Per-plugin virtual environments or subprocess isolation remain deferred unless the trust model changes in a later milestone.
- General multi-agent/plugin generation workflows outside motion-control plugin adaptation remain outside Phase 14.

</deferred>

---

*Phase: 14-plugin-developer-docs-plugin-swap-hardening*
*Context gathered: 2026-05-09T09:07:40.5767650-04:00*
