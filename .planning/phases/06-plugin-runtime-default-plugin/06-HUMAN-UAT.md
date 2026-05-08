---
status: complete
phase: 06-plugin-runtime-default-plugin
source: [06-VERIFICATION.md]
started: 2026-05-08T11:57:55Z
updated: 2026-05-08T19:06:50-04:00
---

# Phase 06 Human UAT

## Current Test

[testing complete]

## Tests

### 1. Active plugin swap

expected: Restarting the sidecar with a different active plugin changes body-motion behavior or falls back safely for an invalid plugin.
result: issue
reported: "Fail with BLOCK: There is no plugin configuration at all. I cannot select plugin. Also a critical regression, I see the VTS seems only connected to one VTS plugin named AgenticLLMVtuber Mouth v3, and there used to be 2 VTS plugins, I guess another one is body motion control, but that VTS plugin seems broken after phase 8 execution. Is that deprecated by design?"
severity: blocker

### 2. [joy] default plugin action

expected: A forced [joy] reply shows visible head/eye/face ramp-in and decay with no VTS request-error flood or exp3 activation.
result: issue
reported: "问题：1. 我在设计和文档中已经明确要求不使用joy标签了，因为这个标签并不存在于teto模型中，而variant code必须完全严格地只使用模型自带的expressions。很显然joy不在此类。2. 我要求LLM输出了这个joy标签，log显示捕捉了，但无事发生。"
severity: major

### 3. Speech motion

expected: A 30s utterance keeps mouth movement synced and head/body motion non-flat.
result: pass

## Summary

total: 3
passed: 1
issues: 2
pending: 0
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
  fix_attempted:
    - "Settings now exposes a Body motion plugin radio group backed by persisted StoredConfig.plugin.activePluginName."
    - "Electron now lists repo/userData body-motion plugin manifests, passes AGENTICLLMVTUBER_USER_DATA and AGENTICLLMVTUBER_ACTIVE_PLUGIN into sidecar spawn env, and restarts sidecar on selection save."
    - "Compositor VTS writer identity restored to AgenticLLMVTuber Phase4 Safe Writer; mouth writer keeps AgenticLLMVTuber Phase3 Mouth Driver and uses .vts_mouth_token.txt."
    - "Regression tests added for Settings plugin selection and VTS writer identity separation."
    - "Follow-up: restored old shared .vts_token.txt path for the mouth writer to avoid VTS auth regression."
    - "Follow-up: clamp now permits standard VTS tracking input parameters such as FaceAngleX/Y/Z, EyeRightY, FacePositionZ, and MouthOpen even when rig reflection only exposes Cubism/output IDs."
    - "Follow-up: repeated clamp drops for truly unknown params are warning-once per param/reason/mode to prevent log flood."
    - "Follow-up: mouth writer now uses the same PyvtsSafeWriter handshake path as the compositor instead of direct pyvts auth calls, avoiding receive-loop races that degrade lipsync to LoggingParameterWriter."
  debug_session: "retest_needed"

- truth: "Variant/action tags must be strictly limited to expressions discovered from the active Teto model; nonexistent tags such as [joy] must not be treated as valid model actions or UAT success criteria."
  status: failed
  reason: "User reported: 问题：1. 我在设计和文档中已经明确要求不使用joy标签了，因为这个标签并不存在于teto模型中，而variant code必须完全严格地只使用模型自带的expressions。很显然joy不在此类。2. 我要求LLM输出了这个joy标签，log显示捕捉了，但无事发生。"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
