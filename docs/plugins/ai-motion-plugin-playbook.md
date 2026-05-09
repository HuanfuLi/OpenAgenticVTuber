# AI Motion Plugin Playbook

This playbook is for any coding agent: Codex, Claude, Gemini, or another tool.
It is the canonical AI guide for adapting motion algorithms to AgenticLLMVTuber.

## Grounding Loop

1. Inspect the target repository before editing.
2. Read `docs/plugins/motion-plugin-authoring.md`.
3. Read these contract files:
   - `sidecar/src/sidecar/plugins/api.py`
   - `sidecar/src/sidecar/plugins/manifest.py`
   - `sidecar/src/sidecar/plugins/sdk.py`
   - `packages/contracts/py/contracts/param_frame.py`
   - `packages/contracts/py/contracts/rig_capabilities.py`
   - `packages/contracts/py/contracts/avatar_overrides.py`
4. Read `plugins/sample_motion/` before reading `plugins/default/`.

## Adaptation Loop

1. Identify the algorithm's inputs, outputs, timing model, and state.
2. Convert external motion output into finite `ParamFrame.add_params` values.
3. Gate every parameter id through `RigCapabilities.writable_param_ids`.
4. Inspect `AvatarOverrides` only for avatar-specific hints: body-sway metadata,
   default-plugin action bindings, variants/events catalog context, source rig
   metadata, and notes. Do not treat variants/events as plugin action codes, and
   do not let overrides bypass `RigCapabilities`.
5. Use `sidecar.plugins.sdk` helpers for bracket action parsing, ramping, finite
   filtering, and safe frame construction.
6. Keep the manifest small and explicit.
7. Add tests before declaring the plugin complete.

## Required Tests

Cover:

- manifest validity;
- `on_load` with minimal `RigCapabilities` and `AvatarOverrides`;
- unsupported parameters are skipped;
- non-finite values are not emitted;
- at least one text-to-motion behavior such as `[nod]`.

Useful command:

```powershell
cd sidecar
uv run pytest tests/plugins/test_plugin_sdk.py tests/plugins/test_sample_plugin.py tests/plugins/test_manifest_loader.py tests/plugins/test_supervisor.py
```

## Do Not

- Do not bypass `RigCapabilities`.
- Do not assume `AvatarOverrides.variants` or `AvatarOverrides.events` are plugin
  action codes.
- Do not emit `NaN`, infinity, strings, or booleans as parameter values.
- Do not import renderer, Electron, pyvts writer, or compositor internals from a plugin.
- Do not silently change `plugin.yaml` semantics without updating docs and tests.
- Do not treat plugin failure as a chat failure; plugin motion degrades to fallback/null.
