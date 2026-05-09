---
status: resolved
phase: 06-plugin-runtime-default-plugin
source: [06-VERIFICATION.md]
started: 2026-05-08T11:57:55Z
updated: 2026-05-09T00:30:00Z
resolved: 2026-05-09T00:30:00Z
resolution_evidence: 06-VERIFICATION.md re_verification_3 (status: passed) + 06-08 closure
---

# Phase 06 Human UAT

## Current Test

[testing complete]

## Tests

### 1. Active plugin swap

expected: Restarting the sidecar with a different active plugin changes body-motion behavior or falls back safely for an invalid plugin.
result: pass
resolved_by:
  - "Settings exposes Body motion plugin radio group backed by persisted StoredConfig.plugin.activePluginName (commit 7f4ab73)"
  - "Electron sidecar spawn passes AGENTICLLMVTUBER_USER_DATA + AGENTICLLMVTUBER_ACTIVE_PLUGIN; sidecar restarts on selection save"
  - "Compositor VTS writer identity restored to AgenticLLMVTuber Phase4 Safe Writer (commit 7b8f4d7)"
  - "06-07 deleted the split mouth writer entirely; only PyvtsSafeWriter remains as VTS plugin identity (commits 623cc32, 6ae381a)"
reported_original: "Fail with BLOCK: There is no plugin configuration at all. I cannot select plugin. Also a critical regression, I see the VTS seems only connected to one VTS plugin named AgenticLLMVtuber Mouth v3, and there used to be 2 VTS plugins, I guess another one is body motion control, but that VTS plugin seems broken after phase 8 execution. Is that deprecated by design?"
severity_original: blocker

### 2. [joy] invalid active Teto vocabulary

expected: A forced [joy] reply is ignored safely because [joy] is obsolete/invalid for the active imported Teto avatar catalog and absent from avatars/重音テト/_avatar_overrides.yaml; no active action, nonzero ParamFrame, model-expression semantics, or visual-success criterion is expected.
result: resolved_by_06_08
reported: "问题：1. 我在设计和文档中已经明确要求不使用joy标签了，因为这个标签并不存在于teto模型中，而variant code必须完全严格地只使用模型自带的expressions。很显然joy不在此类。2. 我要求LLM输出了这个joy标签，log显示捕捉了，但无事发生。"
severity: major

### 3. Speech motion

expected: A 30s utterance keeps mouth movement synced and head/body motion non-flat.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0
resolved_via:
  - re_verification_3 in 06-VERIFICATION.md (operator UAT confirmed lipsync + body sway live)
  - 06-08 (joy vocabulary correction)
  - 06-07 + follow-on commits (writer consolidation + tracking-range fix + Settings plugin selection bridge)

## Gaps

- truth: "Restarting the sidecar with a different active plugin changes body-motion behavior or falls back safely for an invalid plugin."
  status: resolved
  reason: "User reported: Fail with BLOCK: There is no plugin configuration at all. I cannot select plugin. Also a critical regression, I see the VTS seems only connected to one VTS plugin named AgenticLLMVtuber Mouth v3, and there used to be 2 VTS plugins, I guess another one is body motion control, but that VTS plugin seems broken after phase 8 execution. Is that deprecated by design?"
  severity_original: blocker
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
    - "06-07 (commits 623cc32 + 6ae381a): deleted vts/speech_mouth_driver.py + vts/parameter_writer.py entirely; MouthOpen now flows through compositor SpeechDriver -> single PyvtsSafeWriter per ARCH-05/06; CI test test_arch06_single_writer.py asserts no second writer can re-emerge."
    - "Follow-on commits 946abd7 + 4e2ff12: head_only lateral sway + preserve VTS tracking input ranges, closing the body-sway visibility issue (F-3)."
    - "Re-verification: 06-VERIFICATION.md re_verification_3 (2026-05-08T18:35) operator UAT confirmed lipsync restored + body sway visible."
  debug_session: "closed-2026-05-09"
  closed_by: "re_verification_3 in 06-VERIFICATION.md"

- truth: "Variant/action tags must be strictly limited to expressions discovered from the active Teto model; nonexistent tags such as [joy] must not be treated as valid model actions or UAT success criteria."
  status: resolved
  reason: "User reported: 问题：1. 我在设计和文档中已经明确要求不使用joy标签了，因为这个标签并不存在于teto模型中，而variant code必须完全严格地只使用模型自带的expressions。很显然joy不在此类。2. 我要求LLM输出了这个joy标签，log显示捕捉了，但无事发生。"
  severity: major
  test: 2
  root_cause: "Phase 6 carried forward the OLVT/M1 default-plugin emotion vocabulary and UAT language (`[joy]`, `[anger]`, etc.) even though the active imported Teto avatar runtime catalog in `avatars/重音テト/_avatar_overrides.yaml` has no `joy` variant/expression and no `default_plugin_action_bindings`. This made `[joy]` an invalid production test target rather than a valid failed expression trigger."
  artifacts:
    - path: "avatars/重音テト/_avatar_overrides.yaml"
      issue: "Canonical imported-avatar runtime file lists model-derived variants such as `heart-eye`, `star-eye`, `chibi`, and `cry`; it does not list `joy`, and `default_plugin_action_bindings` is empty."
    - path: "plugins/default/plugin.yaml"
      issue: "Resolved by 06-08: default plugin no longer declares `joy`; forced `[joy]` is ignored safely."
    - path: "sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt"
      issue: "Resolved by 06-08: prompt no longer requires mandatory emotion tags or examples `[joy]`/`[anger]`; bracketed actions are optional and limited to inserted action codes."
    - path: ".planning/phases/06-plugin-runtime-default-plugin/06-VERIFICATION.md"
      issue: "Resolved by 06-08: Phase 6 verification/UAT criteria now state `[joy]` is obsolete/invalid and absent from the active imported Teto avatar catalog."
  missing:
    - "None for Phase 6: `[joy]` is obsolete/invalid for active Teto, absent from `_avatar_overrides.yaml`, removed from the default plugin prompt/manifest/runtime path, and ignored safely when forced."
    - "Phase 7 remains responsible for model-owned variant dispatch such as `{heart-eye}`; 06-08 intentionally does not implement `{variant}` or `<event>` dispatch."
  fix_attempted:
    - "06-08 added regression coverage that active Teto variants include `heart-eye`/`star-eye` and exclude `joy`."
    - "06-08 removed `joy` from the default plugin action vocabulary and prompt examples."
    - "06-08 verifies direct and split-token `[joy]` input yields no ParamFrame and leaves the active action empty."
  debug_session: "inline-diagnosis-2026-05-08T19:10:00-04:00"
