# Motion Plugin Developer Docs

AgenticLLMVTuber body-motion plugins translate model text and validated action
codes into `ParamFrame` values for the sidecar compositor.

Start here:

- [Motion plugin authoring](motion-plugin-authoring.md) - build a plugin from a new directory.
- [Plugin system integration](plugin-system-integration.md) - discovery, selection, restart, fallback, and runtime status.
- [Default and sample plugins](default-and-sample-plugins.md) - which example to read first.
- [AI motion plugin playbook](ai-motion-plugin-playbook.md) - tool-neutral instructions for coding agents adapting motion algorithms.

The supported v1 contract is intentionally small: `plugin.yaml`,
`BodyMotionPlugin`, `ParamFrame`, `RigCapabilities`, `AvatarOverrides`, and the
helper functions in `sidecar.plugins.sdk`.
