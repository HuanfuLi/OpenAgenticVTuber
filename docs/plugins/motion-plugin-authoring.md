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
