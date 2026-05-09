---
status: diagnosed
phase: 11-status-app-state-reality
source:
  - 11-01-SUMMARY.md
started: 2026-05-09T06:52:57-04:00
updated: 2026-05-09T07:01:15-04:00
---

## Current Test

[testing complete]

## Tests

### 1. Status popover shows configured LLM
expected: Open the app with a completed LLM setup. Open the status popover from the hex status button. The LLM row shows your configured provider/model from setup, such as LM Studio plus the selected model or auto-detect. It does not show hardcoded qwen2.5 text and does not show fake "last reply" latency.
result: issue
reported: "Pass but: I cannot reconfigure LLM? I was able to configure it before. I should be able to change provider and configure provider settings like LM Studio models, but now it is hardcoded auto-detect"
severity: major

### 2. Status refresh is real
expected: In the status popover, click Refresh status. The button briefly shows a refresh-in-progress state, then the rows continue to reflect real setup/sidecar/VTS state. It does not force the LLM row to green, does not change the model to qwen2.5, and does not add fake latency.
result: pass

### 3. Sidecar and VTS rows are truthful
expected: With the sidecar running, the Sidecar row shows the real local websocket URL. With VTube Studio running and authorized, the VTS row reports an authenticated/ready state; if VTS is not running or not detected, the VTS row says so truthfully instead of pretending to be connected.
result: pass

### 4. Settings connection refresh is real
expected: Open Settings > Connection / Models and click Refresh status. The visible provider, endpoint, and model remain the persisted setup values, and the action does not inject qwen2.5 or fake "last reply" latency into the app status.
result: issue
reported: "As I said in test 1, it is basically hardcoded as LM Studio + auto-detect. Fail"
severity: major

### 5. Preferences persist through Electron storage
expected: Change an Appearance theme option and toggle Settings > Diagnostics > Show log panel. Close and restart the app. The theme preference and log panel preference restore from the previous session, while the LLM setup remains stored through the existing setup flow.
result: pass

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "The LLM status reflects configurable provider/model settings, and the user can update those provider/model settings after initial setup."
  status: failed
  reason: "User reported: Pass but: I cannot reconfigure LLM? I was able to configure it before. I should be able to change provider and configure provider settings like LM Studio models, but now it is hardcoded auto-detect"
  severity: major
  test: 1
  root_cause: "Phase 11 correctly changed the status row to read persisted setup state, but the only editable provider/model UI remains the first-run LLMSetup gate. After setup completes, Settings > Connection / Models renders the stored provider, endpoint, and model as read-only rows and the Change provider button is disabled, so a blank stored model can only appear as auto-detect and cannot be changed from the app."
  artifacts:
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "ConnectionSection reads real StoredConfig but only displays provider/endpoint/model; it disables Change provider and has no edit/save path."
    - path: "apps/renderer/src/screens/LLMSetup/LLMSetup.tsx"
      issue: "The editable provider, endpoint, model, API key, and connection test flow is only available while setup.phase is setup-required."
    - path: "apps/renderer/src/App.tsx"
      issue: "GatedShell swaps LLMSetup out permanently once setup is ready, leaving no post-setup reconfiguration route."
  missing:
    - "Add a post-setup Settings edit flow for provider, endpoint URL, model name, and API key."
    - "Persist changes through window.api.saveStoredConfig with hasCompletedSetup true while preserving unrelated StoredConfig fields such as the active body motion plugin."
    - "Refresh app status after saving so the status popover reflects the newly saved provider/model without mock mutations."
    - "Cover Settings reconfiguration with focused renderer tests, including the blank-model auto-detect case and a nonblank saved model."
  debug_session: ".planning/debug/phase-11-llm-reconfigure-gap.md"
- truth: "Settings > Connection / Models shows and preserves configurable provider/model settings instead of appearing hardcoded to LM Studio auto-detect."
  status: failed
  reason: "User reported: As I said in test 1, it is basically hardcoded as LM Studio + auto-detect. Fail"
  severity: major
  test: 4
  root_cause: "The Settings connection section is a read-only status summary, not a configuration editor. It falls back to the persisted LM Studio default and renders an empty modelName as auto-detect, which is truthful for the stored data but fails the expected reconfiguration behavior."
  artifacts:
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "The Change provider control is intentionally disabled with copy that says reconfiguration lands later."
    - path: "apps/renderer/src/lib/copy.ts"
      issue: "Settings copy still describes provider reconfiguration as deferred instead of offering real controls."
    - path: "apps/renderer/src/state/setup-store.ts"
      issue: "The setup store exposes first-run completeSetup but no obvious post-setup save/update helper for Settings to reuse."
  missing:
    - "Replace the disabled Change provider affordance with editable Settings controls or a reusable setup-editor flow."
    - "Use existing provider choices and LLM test behavior where practical so Settings does not introduce a second provider contract."
    - "Keep auto-detect as explicit blank-model behavior, not a hardcoded model value."
    - "Remove stale deferred copy and test that Settings save preserves the selected provider/model after reload."
  debug_session: ".planning/debug/phase-11-llm-reconfigure-gap.md"
