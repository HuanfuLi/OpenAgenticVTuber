# Motion Plugin Authoring

## Quickstart

Create a directory under `plugins/` or under the app user-data `plugins/`
directory:

```text
plugins/my_motion/
  plugin.yaml
  __init__.py
```

Use `plugins/sample_motion/` as the smallest working example.

## Manifest

`plugin.yaml` is loaded through `sidecar.plugins.manifest.PluginManifest`.

Required fields:

- `name`: stable plugin id used by Settings and `AGENTICLLMVTUBER_ACTIVE_PLUGIN`.
- `version`: plugin version string.
- `entrypoint`: `path.py:ClassName` relative to the plugin directory.
- `api_version`: compatible major version; v1 plugins use `"1.0"`.

Optional fields:

- `description`, `author`, `license`, `homepage`.
- `action_codes`: list of `{ code, description }` entries. Codes are written in
  model text as `[code]`.

Reserved names such as `system`, `think`, and `tool_call` are rejected. Do not
include brackets in manifest codes.

## Runtime API

Implement `sidecar.plugins.api.BodyMotionPlugin`.

```python
from collections.abc import AsyncIterator

from contracts import ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from sidecar.plugins import BodyMotionPlugin


class MyPlugin(BodyMotionPlugin):
    def on_load(self, capabilities: RigCapabilities, overrides: AvatarOverrides) -> None:
        self.capabilities = capabilities

    async def on_token_stream(self, sentence: str) -> AsyncIterator[ParamFrame]:
        yield ParamFrame()
```

Lifecycle methods:

- `on_load(capabilities, overrides)`: called once at sidecar boot. Do not call
  pyvts here.
- `on_token_stream(sentence)`: receives orchestrator text that may still contain
  plugin action codes such as `[nod]`; yield zero or more `ParamFrame` values.
- `on_action_code(action)`: optional handler for validated action dispatch.
- `on_unload()`: optional best-effort cleanup.

## ParamFrame

`ParamFrame` is the compositor tick unit:

- `add_params`: additive parameter deltas by VTS/Cubism parameter id.
- `set_params`: set-style values with blend metadata for advanced use.
- Values must be finite numbers. Do not emit `NaN` or infinity.
- Prefer writing only ids present in `RigCapabilities.writable_param_ids`.

## RigCapabilities And AvatarOverrides

`RigCapabilities` is the first contract to check when deciding what a plugin can
write. It describes the current rig surface after import and introspection:
writable parameter ids, parameter ranges, expressions, hotkeys, display names,
sign inversions, and default-plugin action bindings discovered from the rig.

`AvatarOverrides` is the saved avatar-specific catalog and configuration loaded
at sidecar boot. It is not a second output channel. Use it for avatar-specific
hints and context that should shape how your plugin interprets the rig:

- `body_sway_strategy`, `proxy_body_param`, and `exp3_body_pose`: the imported
  body-sway preference and any rig-specific body-pose metadata. Most custom
  plugins can ignore these unless they intentionally implement body sway.
- `default_plugin_action_bindings`: avatar-specific bindings used by the
  production default plugin to map action codes such as `[smirk]` to imported
  expression/catalog data. Custom plugins may ignore these, or use them as
  optional hints if they deliberately want to honor the same avatar-specific
  behavior.
- `variants` and `events`: the avatar dispatch catalog for `{variant}` and
  `<event>` codes. These are not plugin action codes and should not be emitted as
  `ParamFrame` values. They help explain what the avatar can do outside your
  plugin.
- `source_rig_path`, `notes`, `param_probes`, `orphan_params`,
  `physics_chain_proxies`, and `sign_inversions`: import-time metadata that can
  help advanced plugins adapt to a specific rig, but should not override
  `RigCapabilities.writable_param_ids`.
- `voice`: TTS/lipsync configuration. Motion plugins normally should not use it
  except to avoid conflicting with mouth/lipsync behavior.

Rule of thumb: use `RigCapabilities` to decide what you may write, and
`AvatarOverrides` to decide whether the avatar has saved preferences or catalog
metadata that should change your plugin's interpretation. Even when an override
mentions a parameter, still gate emitted values through `RigCapabilities`.

## Helper Kit

`sidecar.plugins.sdk` is the supported v1 helper kit:

- `extract_action_codes(text, allowed_codes, pending_fragment="")`
- `ramp_weight(elapsed_seconds, ramp_in_seconds=..., ramp_out_seconds=...)`
- `ease_in_out_cubic(t)` and `clamp01(value)`
- `finite_params(params)` and `safe_add_params(params, capabilities=...)`
- `filter_writable_params(params, capabilities=...)`
- `safe_add_frame(params, capabilities=..., emitted_at_monotonic=...)`

Example:

```python
from sidecar.plugins.sdk import extract_action_codes, safe_add_frame

result = extract_action_codes(sentence, {"nod"}, pending_fragment=self.pending)
self.pending = result.pending_fragment
frame = safe_add_frame({"FaceAngleX": 2.0}, capabilities=self.capabilities)
```

## Local Tests

Focused plugin checks:

```powershell
cd sidecar
uv run pytest tests/plugins/test_plugin_sdk.py tests/plugins/test_sample_plugin.py tests/plugins/test_default_plugin.py
```

Discovery and runtime checks:

```powershell
cd sidecar
uv run pytest tests/plugins/test_manifest_loader.py tests/plugins/test_supervisor.py
```

## Common Mistakes

- Bypassing `RigCapabilities` and writing unsupported parameter ids.
- Emitting non-finite parameter values.
- Relying on internal compositor, VTS writer, or renderer APIs.
- Changing `plugin.yaml` and expecting the active sidecar to reload it without a restart.
- Treating the default plugin as the minimal template. Read `sample_motion` first.
