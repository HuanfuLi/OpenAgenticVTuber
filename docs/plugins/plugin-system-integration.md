# Plugin System Integration

## Discovery

The app looks for `plugin.yaml` files in:

- repository plugins under `plugins/*/plugin.yaml`;
- user-data plugins under `<userData>/plugins/*/plugin.yaml`.

User-data plugins with the same manifest `name` override repository plugins.
Settings shows valid and invalid manifests. Invalid entries are selectable so a
developer can save the intended plugin id, restart into fallback/null motion, and
see actionable failure details while fixing `plugin.yaml`.

## Selection And Restart

The selected plugin is stored in safeStorage config as
`plugin.activePluginName`. Electron passes it to the sidecar with
`AGENTICLLMVTUBER_ACTIVE_PLUGIN`.

Plugin loading is boot-time. Changing the Settings selection saves config,
marks plugin status as `restart pending`, restarts the sidecar, then refreshes
runtime status.

## Runtime Status

The sidecar exposes:

```text
GET /admin/plugin/status
```

Lifecycle states:

- `active`: selected plugin loaded and passed `on_load`.
- `restart pending`: renderer has saved a new selection and sidecar restart is in progress.
- `load failed`: Python import, class construction, or `on_load` failed.
- `fallback/null`: null motion is active.
- `circuit open`: repeated runtime failures opened the plugin circuit breaker.
- `invalid manifest`: selected plugin has no valid manifest.
- `unknown/loading`: sidecar or status endpoint is not ready yet.

Failures keep the selected config. The sidecar uses `NullPlugin` for motion and
continues serving chat/status requests.

## Packaging For Local Development

Package a plugin as a single directory containing `plugin.yaml` and Python files.
Keep dependencies minimal. If a plugin needs third-party packages, document how
to install them into the sidecar environment and keep the core plugin contract
unchanged.

## UAT Checklist

1. Follow `motion-plugin-authoring.md` and inspect `plugins/sample_motion/`.
2. Select `sample_motion` in Settings and confirm the sidecar restarts automatically.
3. Confirm Status shows plugin `active`.
4. Select or create a deliberately broken plugin manifest.
5. Confirm Settings and Status show invalid/load-failed fallback while the selected plugin remains configured.
6. Send a chat message and confirm chat remains available while motion is degraded.
