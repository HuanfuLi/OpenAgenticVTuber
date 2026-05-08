---
status: testing
phase: 06-plugin-runtime-default-plugin
source: [06-VERIFICATION.md]
started: 2026-05-08T11:57:55Z
updated: 2026-05-08T12:19:00Z
---

# Phase 06 Human UAT

## Current Test

number: 2
name: [joy] default plugin action
expected: |
  A forced [joy] reply shows visible head/eye/face ramp-in and decay with no VTS request-error flood or exp3 activation.
awaiting: user response

## Tests

### 1. Active plugin swap

expected: Restarting the sidecar with a different active plugin changes body-motion behavior or falls back safely for an invalid plugin.
result: issue
reported: "Fail with BLOCK: There is no plugin configuration at all. I cannot select plugin. Also a critical regression, I see the VTS seems only connected to one VTS plugin named AgenticLLMVtuber Mouth v3, and there used to be 2 VTS plugins, I guess another one is body motion control, but that VTS plugin seems broken after phase 8 execution. Is that deprecated by design?"
severity: blocker

### 2. [joy] default plugin action

expected: A forced [joy] reply shows visible head/eye/face ramp-in and decay with no VTS request-error flood or exp3 activation.
result: pending

### 3. Speech motion

expected: A 30s utterance keeps mouth movement synced and head/body motion non-flat.
result: pending

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

- truth: "Restarting the sidecar with a different active plugin changes body-motion behavior or falls back safely for an invalid plugin."
  status: failed
  reason: "User reported: Fail with BLOCK: There is no plugin configuration at all. I cannot select plugin. Also a critical regression, I see the VTS seems only connected to one VTS plugin named AgenticLLMVtuber Mouth v3, and there used to be 2 VTS plugins, I guess another one is body motion control, but that VTS plugin seems broken after phase 8 execution. Is that deprecated by design?"
  severity: blocker
  test: 1
  root_cause: "Phase 6 implemented active body-motion plugin selection as sidecar-only environment variables (`AGENTICLLMVTUBER_ACTIVE_PLUGIN`, optional `AGENTICLLMVTUBER_USER_DATA/plugins`) but did not add a persisted app config, renderer setting, or Electron env bridge, so the operator cannot select or swap plugins from the app. Separately, the Phase 6 runtime rewire regressed VTS API plugin identity: the compositor `PyvtsSafeWriter` default plugin name now matches the mouth-driver identity instead of the prior Phase 4 safe-writer identity, so VTS appears to expose only the mouth plugin even though body-motion plugins are internal Python plugins by design."
  artifacts:
    - path: "sidecar/src/sidecar/ws/server.py"
      issue: "_active_plugin_name() reads only AGENTICLLMVTUBER_ACTIVE_PLUGIN and defaults to `default`; no config-file or renderer setting is consumed."
    - path: "apps/electron-main/src/sidecar.ts"
      issue: "The Electron sidecar spawn env does not set AGENTICLLMVTUBER_ACTIVE_PLUGIN or AGENTICLLMVTUBER_USER_DATA from app config/userData."
    - path: "sidecar/src/sidecar/vts/pyvts_writer.py"
      issue: "The compositor writer default plugin_name is `AgenticLLMVTuber Phase3 Mouth Driver`; historical Phase 4 identity was `AgenticLLMVTuber Phase4 Safe Writer`."
    - path: "sidecar/src/sidecar/vts/parameter_writer.py"
      issue: "The mouth writer uses the same VTS plugin identity family as the compositor writer, making VTS-side plugin identity ambiguous/collapsed."
  missing:
    - "Add persisted plugin configuration, at minimum active_plugin_name, and expose it in Settings or another operator-accessible app surface."
    - "Bridge Electron app userData/config into sidecar env (`AGENTICLLMVTUBER_USER_DATA`, `AGENTICLLMVTUBER_ACTIVE_PLUGIN`) before spawning."
    - "Restore distinct/intended VTS API plugin identity for the compositor/body-motion writer, or intentionally consolidate to one VTS writer identity with explicit docs and regression tests."
    - "Add UAT/regression coverage proving plugin selection is operator-accessible and VTS plugin identity does not regress silently."
  debug_session: ""
