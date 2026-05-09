---
status: diagnosed
phase: 14-plugin-developer-docs-plugin-swap-hardening
source:
  - 14-01-SUMMARY.md
  - 14-02-SUMMARY.md
started: 2026-05-09T09:59:18-04:00
updated: 2026-05-09T10:20:00-04:00
---

## Current Test

[testing complete]

## Tests

### 1. Plugin Developer Docs Are Usable
expected: Open docs/plugins/README.md and follow the links. The docs should clearly explain the plugin directory layout, plugin.yaml fields, BodyMotionPlugin lifecycle hooks, ParamFrame expectations, RigCapabilities/AvatarOverrides usage, helper-kit functions, local test commands, and the tool-neutral AI playbook.
result: issue
reported: "The missing/confusing part is AvatarOverrides usage. It appears in the on_load signature and the AI playbook tells agents to read the contract file, but the docs do not clearly explain what AvatarOverrides contains, when a plugin should use it, or how it relates to action bindings/default avatar behavior. RigCapabilities usage is clear enough; AvatarOverrides is only named, not explained."
severity: major

### 2. Sample Plugin Appears As A Valid Plugin
expected: Start or restart the app, open Settings > Body motion plugin, and see sample_motion listed as a valid selectable plugin alongside default.
result: pass

### 3. Selecting sample_motion Restarts And Becomes Active
expected: Select sample_motion in Settings. The app should save the selection, show restart-pending/restart progress, restart the sidecar automatically, and then Settings/Status should report sample_motion as active.
result: issue
reported: "I don't know. The log shows app restarted, but in VTS I don't see connected plugin to zero, I also did not see the motion control ever disconnected as a sign of restart. Instead, each time I switch plugin, the number of connected plugins shown in VTS is increase."
severity: major

### 4. Broken Plugin Shows Visible Fallback Without Losing Selection
expected: Select an invalid or broken plugin manifest. Settings should show it with an error/warning, it should remain selectable, the selected config should stay on that plugin, and Status should show invalid/load-failed/fallback-null motion instead of silently reverting to default.
result: pass

### 5. Chat Remains Available While Plugin Motion Is Degraded
expected: With the broken plugin selected and fallback/null motion active, send a normal chat message. Chat, LLM response, and text/audio pipeline should remain usable even though plugin motion is degraded.
result: blocked
blocked_by: other
reason: "Blocked by previously mentioned plugin not unloading issue"

## Summary

total: 5
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "Plugin docs clearly explain AvatarOverrides contents, when plugins should use it, and how it relates to action bindings/default avatar behavior."
  status: failed
  reason: "User reported: The missing/confusing part is AvatarOverrides usage. It appears in the on_load signature and the AI playbook tells agents to read the contract file, but the docs do not clearly explain what AvatarOverrides contains, when a plugin should use it, or how it relates to action bindings/default avatar behavior. RigCapabilities usage is clear enough; AvatarOverrides is only named, not explained."
  severity: major
  test: 1
  root_cause: "docs/plugins/motion-plugin-authoring.md names AvatarOverrides in the on_load signature and quick contract list, but does not include an author-facing section explaining the contract fields or plugin usage patterns."
  artifacts:
    - path: "docs/plugins/motion-plugin-authoring.md"
      issue: "AvatarOverrides usage is named but not explained."
    - path: "docs/plugins/ai-motion-plugin-playbook.md"
      issue: "Agents are told to read AvatarOverrides but are not given a concise adaptation rule for when to use it."
  missing:
    - "Explain AvatarOverrides contents relevant to plugin authors: body_sway_strategy, default_plugin_action_bindings, variants/events context, voice is not motion control, and source rig metadata."
    - "Explain when plugins should prefer RigCapabilities versus AvatarOverrides."
    - "Explain how default_plugin_action_bindings relate to the default plugin and when custom plugins can ignore or consume them."

- truth: "Selecting sample_motion restarts the sidecar cleanly and Settings/Status report sample_motion active without accumulating VTS plugin connections."
  status: failed
  reason: "User reported: I don't know. The log shows app restarted, but in VTS I don't see connected plugin to zero, I also did not see the motion control ever disconnected as a sign of restart. Instead, each time I switch plugin, the number of connected plugins shown in VTS is increase."
  severity: major
  test: 3
  root_cause: "apps/electron-main/src/sidecar.ts starts the sidecar with shell:true on Windows, so ChildProcess.kill() targets the shell wrapper instead of reliably terminating the uv/python descendant tree. The Python watchdog tracks the Electron PID, which remains alive during an intentional restart, so orphaned Python sidecars can keep their VTS websocket open."
  artifacts:
    - path: "apps/electron-main/src/sidecar.ts"
      issue: "shutdownSidecar() kills only the direct child process and does not force the Windows process tree to exit."
    - path: "sidecar/src/sidecar/lifecycle/watchdog.py"
      issue: "Watchdog only handles Electron death, not intentional shell-wrapper restarts while Electron remains alive."
  missing:
    - "Terminate the full sidecar process tree during restart on Windows, or avoid shell-wrapper orphaning entirely."
    - "Add regression coverage around shutdownSidecar process-tree termination behavior."
    - "Retest plugin switching in VTS and confirm connected plugin count does not accumulate."
