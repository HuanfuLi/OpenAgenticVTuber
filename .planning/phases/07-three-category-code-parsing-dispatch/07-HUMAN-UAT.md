---
status: diagnosed
phase: 07-three-category-code-parsing-dispatch
source: [07-VERIFICATION.md]
started: 2026-05-08T21:01:52.7978114-04:00
updated: 2026-05-08T22:50:51.8225985-04:00
---

# Phase 7 Human UAT

## Current Test

[testing complete]

## Tests

### 1. Live VTS dispatch confirmation
expected: A declared action reaches the active plugin queue, a declared variant toggles through PyvtsSafeWriter, and a declared event fires a VTS motion hotkey with an EVENT-COMPLETE log after duration_ms.
result: issue
reported: "VTS model did not show variants (heart eye/smirk). LLM responded that it does not know the action codes. Runtime log showed `[DISPATCH] kind=action name=smirk`, but no variant dispatch was logged for `{heart-eye}` and no visible variant change occurred."
severity: major

## Summary

total: 1
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "A declared action reaches the active plugin queue, a declared variant toggles through PyvtsSafeWriter, and a declared event fires a VTS motion hotkey with an EVENT-COMPLETE log after duration_ms."
  status: failed
  reason: "User reported: VTS model did not show variants (heart eye/smirk). LLM responded that it does not know the action codes. Runtime log showed `[DISPATCH] kind=action name=smirk`, but no variant dispatch was logged for `{heart-eye}` and no visible variant change occurred."
  severity: major
  test: 1
  root_cause: "The live UAT expected variant/event dispatch from model output, but the runtime prompt only exposes plugin `[action]` codes and explicitly tells the model not to emit variant/event tags unless separately provided. The logged assistant sentence was `[smirk] Hello!`, so the parser had no `{heart-eye}` token to dispatch. Separately, the active imported Teto override currently has `events: []`, so event dispatch and EVENT-COMPLETE cannot pass with that catalog; if the app uses default avatar id `teto`, its override file is missing and variant/event catalogs are empty."
  artifacts:
    - path: "sidecar/src/sidecar/orchestrator/orchestrator.py"
      issue: "System prompt construction accepts only `action_codes_section`; it has no active-avatar variant/event vocabulary section."
    - path: "sidecar/src/sidecar/plugins/loader.py"
      issue: "`build_action_codes_section()` lists plugin action codes only."
    - path: "sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt"
      issue: "Prompt instructs the LLM to use only listed action codes and not add model variant/event tags unless explicitly provided elsewhere."
    - path: "sidecar/src/sidecar/ws/server.py"
      issue: "Boot passes only the plugin action-code prompt section into the orchestrator; default active avatar id `teto` can miss the imported `重音テト` overrides."
    - path: "avatars/重音テト/_avatar_overrides.yaml"
      issue: "`heart-eye` exists as a variant, but `events: []`, so no live event dispatch can be verified with this catalog."
  missing:
    - "Expose active avatar variant and event codes to the LLM prompt, or provide a deterministic test/injection path for exact assistant output containing declared codes."
    - "Ensure the active avatar id resolves to the imported Teto override when running the live UAT."
    - "Add or select an avatar override with at least one declared event before requiring live event dispatch and EVENT-COMPLETE verification."
  debug_session: ".planning/debug/phase-7-live-dispatch-codes-not-visible.md"
