---
phase: 06-plugin-runtime-default-plugin
researched: 2026-05-08
status: complete
---

# Phase 6 Research: Plugin Runtime + Default Plugin

## Research Goal

Answer: what must be true to plan Phase 6 without shallow execution?

Phase 6 is the animation-layer inversion point. Milestone-1 had the system own
intent parsing and expression activation through `IntentDriver`; v2.0 moves body
motion and action-code interpretation behind a plugin runtime while keeping the
system as the only owner of VTS writes and LLM prompt assembly.

## Existing Code State

The current sidecar already has the Phase 8 transition pieces in progress:

- `sidecar/src/sidecar/ws/server.py` loads `AvatarOverrides`, builds
  `RigCapabilities`, and still constructs `IntentDriver`.
- `sidecar/src/sidecar/compositor/compositor.py` merges in this order:
  idle -> speech -> intent -> cursor, then writes one `ParamFrame`.
- `sidecar/src/sidecar/compositor/intent_driver.py` activates VTS expressions
  directly through `writer.requestExpressionActivation(...)`.
- `sidecar/src/sidecar/orchestrator/orchestrator.py` still types
  `AvatarCapabilities` and builds the prompt from `capabilities.tag_vocabulary()`.
- `sidecar/src/sidecar/orchestrator/transformers.py` still owns the
  `actions_extractor(capabilities)` path.
- `packages/contracts/py/contracts/rig_capabilities.py` and
  `avatar_overrides.py` now include `default_plugin_action_bindings`, which
  Phase 6 should consume for the default plugin.

The plan should avoid rewriting the dirty Phase 8 work. It should assume those
contracts land before Phase 6 execution.

## Locked Decisions From Context

- Plugins load from file paths with `importlib.util.spec_from_file_location`;
  no pip install, no per-plugin venv, no runtime dependency install.
- Plugin process model is trusted in-sidecar Python.
- Plugin API version floor is `api_version: "1.0"`.
- User plugin directory wins over in-tree plugin directory for the same plugin
  name. Duplicate user plugins with the same manifest name fail boot.
- Runtime plugin switching is startup-only.
- Manifest hot reload only logs a restart-required warning. It does not rebuild
  the prompt or reload behavior mid-conversation.
- Default plugin uses `head_only` as the only selectable body-sway strategy.
  `proxy_param` and `exp3_modulation` remain source artifacts, not selectable
  runtime options.
- Default plugin emits ParamFrames using head, eye, and face parameters. It
  does not call VTS or activate exp3 expressions directly.
- SC #2 and SC #3 visual quality are operator-judged in Phase 10. Do not create
  automated visual baselines for them in Phase 6.

## Architecture Pattern

### Contracts

Create a plugin package under `sidecar/src/sidecar/plugins/`:

- `api.py`: `BodyMotionPlugin` protocol/ABC, `ApiVersion`, `PluginContext`.
- `manifest.py`: `PluginManifest`, `PluginActionCode`, reserved-name guard.
- `loader.py`: manifest discovery, validation, active-plugin selection,
  file-path module import, userData precedence, prompt-section builder.
- `supervisor.py`: `NullPlugin`, lifecycle wrapper, timeout/circuit breaker.

Keep plugin contracts Pydantic where they cross process/module boundaries.
Generate TypeScript mirrors only if renderer needs them; Phase 6 is sidecar-only.

### Runtime Flow

Boot flow after Phase 6:

1. Load `AvatarOverrides`.
2. Build `RigCapabilities`.
3. Discover plugin manifests from repo `plugins/` and userData `plugins/`.
4. Select active plugin name, defaulting to `"default"`.
5. Validate manifest and load the plugin module by file path.
6. Call `plugin.on_load(capabilities, overrides)` under a 5s timeout.
7. Create `PluginAdapter`.
8. Build orchestrator prompt from the plugin manifest's sorted action codes.
9. Construct `Compositor(writer, idle, speech, plugin_adapter, cursor)`.

### Compositor Merge Order

Target order is fixed:

`IdleDriver -> SpeechDriver -> PluginAdapter -> CursorDriver -> system primitive overrides -> lock_filter -> clamp_and_validate -> pyvts.inject_params`

In Phase 6, lock state is still mostly future HUD plumbing. The concrete Phase 6
minimum is:

- `system_primitive_overrides` explicitly documents `MouthOpen` as lipsync-owned.
- `clamp_and_validate(frame, capabilities)` clamps finite values, drops unknown
  params, and drops NaN/Inf.
- Plugin output enters as `set_params` from the adapter unless the returned
  frame explicitly carries additive entries.

### Prompt Assembly

Replace `[<insert_action_keys>]` with `[<insert_action_codes_section>]`.

Required section format:

```text
## Available Actions (plugin: default v1.0.0)
[anger] - Show anger through head, eye, and face motion.
[disgust] - Show disgust through head, eye, and face motion.
...
```

Sort by action code key lexicographically. The same manifest must produce
byte-identical prompt text across two consecutive boots.

### Default Plugin

Default plugin lives in `plugins/default/` with:

- `plugin.yaml`
- `__init__.py`
- `body_sway/`

The default plugin should:

- expose OLVT emotion action codes:
  `neutral`, `anger`, `disgust`, `fear`, `joy`, `smirk`, `sadness`, `surprise`;
- read `AvatarOverrides.default_plugin_action_bindings` and
  `RigCapabilities.default_plugin_action_bindings` when present;
- fall back to deterministic built-in compositions if bindings are absent;
- parse bracketed action codes internally from sentence text;
- produce no direct pyvts calls;
- return empty ParamFrames when no action is active.

## Failure Modes To Plan Around

| Failure | Required behavior |
|---------|-------------------|
| Manifest schema invalid | Boot with null plugin; log clear error |
| Reserved action code | Refuse plugin; null plugin fallback |
| Incompatible major API version | Refuse plugin; null plugin fallback |
| `__init__` raises | Null plugin fallback; sidecar stays alive |
| `on_load` blocks | 5s timeout; null plugin fallback |
| async generator raises repeatedly | 3 restarts in 60s then open circuit; null frames |
| plugin emits NaN/Inf | Drop frame and log warning/error |
| plugin emits unknown param | Drop unknown key and log warning |
| plugin emits >60Hz | latest-frame-wins coalescing in adapter |
| plugin emits <60Hz | hold last fresh frame then decay to empty |
| manifest changes at runtime | WARN restart required; no prompt rebuild |

## Validation Architecture

Use pytest for sidecar behavior and npm/grep for contracts and architecture
guards.

Required automated coverage:

- Manifest validation and reserved-name rejection.
- File-path loader success, bad entrypoint failure, userData precedence, duplicate
  user plugin loud failure.
- Prompt assembly deterministic across two boots.
- `BodyMotionPlugin` ABC/API signature and version policy.
- `clamp_and_validate` drops unknown, NaN, and Inf values.
- Supervisor handles `__init__` failure, `on_load` timeout, async generator
  failures, and circuit breaker.
- `PluginAdapter` coalesces over-rate frames and holds/decays under-rate frames.
- Compositor merge order puts plugin output between speech and cursor.
- Exactly one `import pyvts` remains under `sidecar/src/`.
- Default plugin parses split-token bracket actions and emits deterministic
  ParamFrame output for all eight emotions.

Manual validation:

- Change active plugin name in config, restart sidecar, observe different motion.
- Phase 10 operator visually judges `[joy]` smoothness and speech body/head
  motion.

## Recommended Plan Split

Use three plans:

1. `06-01`: plugin API, manifest loader, prompt assembly, clamp/lock primitives.
2. `06-02`: supervisor, adapter, compositor/orchestrator/server rewiring,
   `IntentDriver` deletion, architecture guard, plumbing harness.
3. `06-03`: default plugin port, body_sway move, eight action compositions,
   plugin parser, runtime demo.

This split lets Plan 06-01 land with null-plugin boot support, Plan 06-02
perform the risky surgery while behavior is still inert, and Plan 06-03 restore
visible action behavior through the default plugin.
