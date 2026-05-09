# Default And Sample Plugins

Read `plugins/sample_motion/` first when you are creating a new plugin. It shows
the small contract: manifest, `BodyMotionPlugin`, helper-kit action parsing, and
safe `ParamFrame` construction.

Read `plugins/default/` after that when you need a worked production example.
The default plugin demonstrates:

- action-code parsing for emotion-like `[smirk]` text;
- avatar override and capability gating;
- composition maps from action code to parameter deltas;
- smoothing and timed render frames;
- default-plugin action bindings from imported avatar catalogs.

Default-plugin action bindings live in `RigCapabilities` and
`AvatarOverrides.default_plugin_action_bindings`. They are avatar-specific hints
for the default plugin's emotion/action vocabulary, not a required abstraction
for every custom plugin. A custom plugin should read them only when it wants to
reuse that default-plugin mapping behavior; otherwise it can rely on its own
manifest action codes and `RigCapabilities.writable_param_ids`.

The default plugin is intentionally richer than the minimal authoring path. Do
not copy its full structure unless your plugin needs the same complexity.
