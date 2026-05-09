---
status: completed
phase: 07-three-category-code-parsing-dispatch
source: [07-VERIFICATION.md]
started: 2026-05-08T21:01:52.7978114-04:00
updated: 2026-05-09T03:49:34Z
---

# Phase 7 Human UAT

## Current Test

[testing complete: live variant approved; live event verification prerequisite-gated]

## Live Dispatch Prerequisites

- Use an active avatar whose `_avatar_overrides.yaml` contains the variant and event codes under test.
- For current imported Teto variant testing, start the app with `AGENTICLLMVTUBER_ACTIVE_AVATAR=重音テト` so `{heart-eye}` resolves from `avatars/重音テト/_avatar_overrides.yaml`.
- Current imported Teto has `events: []`, so event dispatch and `[EVENT-COMPLETE]` verification are blocked until an event-bearing avatar catalog is selected or imported.
- If startup logs include `[DISPATCH-CATALOG-BLOCKED]`, absence of `<event>` output from the LLM is not a parser/routing failure.
- Proceed with live variant verification when `[DISPATCH-CATALOG]` reports nonzero `actions` and `variants`; proceed with live event verification only when it reports `events` greater than zero.

## Tests

### 1. Live VTS action and variant confirmation
expected: A declared action reaches the active plugin queue and a declared variant toggles through PyvtsSafeWriter.
result: pass
reported: "User confirmed the rig switched to heart eye after the `heart-eye` hotkey fired."
notes: "The variant did not switch back automatically. This is intentional for Phase 7: `{variant}` codes are radio-button single-active and persistent until another variant is emitted. Timed completion applies to `<event>` codes only."

### 2. Live VTS event confirmation
expected: A declared event fires a VTS motion hotkey with an EVENT-COMPLETE log after duration_ms.
result: blocked
reason: "Current imported Teto has `events: []`, so event dispatch and `[EVENT-COMPLETE]` verification require selecting or importing an event-bearing active avatar catalog."
notes: "Absence of `<event>` output while `[DISPATCH-CATALOG-BLOCKED]` is present is a catalog-prerequisite block, not a parser/routing failure."

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

- truth: "A declared action reaches the active plugin queue, a declared variant toggles through PyvtsSafeWriter, and a declared event fires a VTS motion hotkey with an EVENT-COMPLETE log after duration_ms."
  status: partial_pass
  reason: "Live variant dispatch is approved: user confirmed the rig switched to heart eye. Live event verification is blocked because the active imported Teto catalog has `events: []`."
  severity: prerequisite
  tests: [1, 2]
  root_cause: "The live UAT expected variant/event dispatch from model output, but the runtime prompt only exposes plugin `[action]` codes and explicitly tells the model not to emit variant/event tags unless separately provided. The logged assistant sentence was `[smirk] Hello!`, so the parser had no `{heart-eye}` token to dispatch. Separately, the active imported Teto override currently has `events: []`, so event dispatch and EVENT-COMPLETE cannot pass with that catalog; if the app uses default avatar id `teto`, its override file is missing and variant/event catalogs are empty."
  closure: "Plan 07-08 exposed active dispatch vocabulary in the boot prompt. Human checkpoint confirmed `{heart-eye}` reaches the rig. Persistent heart-eye state is expected variant policy; event UAT remains blocked until an event-bearing avatar catalog is active."
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
