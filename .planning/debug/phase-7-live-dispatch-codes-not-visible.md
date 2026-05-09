---
status: diagnosed
trigger: "Phase 7 live VTS UAT: declared action reaches active plugin queue, declared variant toggles through PyvtsSafeWriter, and declared event fires VTS motion hotkey with EVENT-COMPLETE log after duration_ms. User reported variants not visible and no variant dispatch log for {heart-eye}; LLM said it does not know action codes; goal: find_root_cause_only."
created: 2026-05-08T00:00:00-04:00
updated: 2026-05-08T00:35:00-04:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED - live UAT expected model-owned variant/event dispatch, but the system prompt only gives the LLM plugin action codes and explicitly tells it not to add model variant/event tags unless another instruction provides them. Additionally, the active imported Teto override has no events, so event dispatch is impossible from that catalog.
test: Parser smoke with forced declared text and inspection of prompt/catalog construction.
expecting: Forced `{heart-eye}` should dispatch, proving parser/VTS route can be reached when emitted; actual logged `[smirk] Hello!` should dispatch only action; prompt should contain no variant/event vocabulary.
next_action: Return root cause diagnosis without modifying implementation files.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: During live VTS UAT, a message using declared codes should produce action, variant, and event dispatch logs; the active plugin should receive the action; the avatar should visibly toggle the variant; and EVENT-COMPLETE should log after the event duration.
actual: User reported: VTS model did not show variants (heart eye/smirk). LLM responded that it does not know the action codes. Runtime log showed `[DISPATCH] kind=action name=smirk`, but no variant dispatch was logged for `{heart-eye}` and no visible variant change occurred. Current Teto overrides appear to have variants but events: [].
errors: Log excerpt includes sentence divider yielding `[smirk] Hello!`, transformer `[DISPATCH] kind=action name=smirk`, TTS/display filtered to `Hello!`, orchestrator `_route_dispatches` `[DISPATCH] kind=action name=smirk`, then LLM output: `But please don't use action codes I haven't been given yet, okay?`. No `kind=variant` log appears in the provided excerpt.
reproduction: Test 1 in `.planning/phases/07-three-category-code-parsing-dispatch/07-HUMAN-UAT.md`.
started: Discovered during Phase 7 live VTS UAT after automated Phase 7 verification passed.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: PyvtsSafeWriter or VariantStateManager swallowed a valid `{heart-eye}` variant dispatch.
  evidence: Forced parser smoke emitted a `VariantToggle` for `{heart-eye}`, and `_route_dispatches` would log `kind=variant` after applying it. The provided runtime log's parsed sentence was `[smirk] Hello!`, which contains no variant token; the smoke of that exact text emitted only `ActionCode`.
  timestamp: 2026-05-08T00:30:00-04:00

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-08T00:00:00-04:00
  checked: Initial required file read batch
  found: Parallel Get-Content read attempt timed out before usable file contents were returned.
  implication: Continue with smaller read-only commands and keep investigation state persistent.
- timestamp: 2026-05-08T00:10:00-04:00
  checked: Required planning files
  found: Automated verification proved parser/routing paths, but human UAT failed live VTS confirmation. Validation instructions say the operator must pick an action from `plugins/default/plugin.yaml` and a variant/event declared in the active avatar `_avatar_overrides.yaml`.
  implication: The live failure depends on the exact runtime catalogs and exact emitted text, not just the generic routing implementation.
- timestamp: 2026-05-08T00:10:00-04:00
  checked: `sidecar/src/sidecar/orchestrator/orchestrator.py` and `sidecar/src/sidecar/orchestrator/transformers.py`
  found: `_route_dispatches` logs `[DISPATCH] kind=variant...` only after a `VariantToggle` exists. `code_extractor` emits `VariantToggle` only for `{code}` tokens whose lowercased code is present in `AvatarOverrides.variants`; unknown codes are silently ignored.
  implication: Absence of a variant dispatch log means either the model did not emit a valid `{variant}` token in that sentence, or the active catalog given to the extractor did not contain that code.
- timestamp: 2026-05-08T00:10:00-04:00
  checked: Active avatar override files
  found: `avatars/teto/_avatar_overrides.yaml` is missing. `avatars/重音テト/_avatar_overrides.yaml` exists and includes variant code `heart-eye`, but has `events: []`.
  implication: `{heart-eye}` is a valid variant only when `AGENTICLLMVTUBER_ACTIVE_AVATAR=重音テト`; no event dispatch can be produced for the active Teto override because the event catalog is empty.
- timestamp: 2026-05-08T00:20:00-04:00
  checked: `.planning/debug/knowledge-base.md`
  found: Knowledge base file is absent.
  implication: No prior known-pattern hypothesis is available for this failure.
- timestamp: 2026-05-08T00:30:00-04:00
  checked: Prompt vocabulary construction
  found: `_build_system_prompt` only substitutes `action_codes_section`. `server.py` builds that section from `build_action_codes_section(plugin_manifest)`, and `build_action_codes_section` only lists plugin `action_codes`. The prompt text says "Use only the action codes listed below" and "Do not add model variant or event tags unless they are explicitly provided by another instruction."
  implication: The LLM is not told about `{heart-eye}` or any `<event>` codes by Phase 7 runtime prompt construction. Its live response saying it does not know the codes matches the prompt, not a dispatch failure.
- timestamp: 2026-05-08T00:30:00-04:00
  checked: Focused parser/catalog smoke
  found: Against the imported Teto override, `_extract_dispatches('[smirk] {heart-eye} <wave>', {'smirk'}, variants, events)` emitted `[('action','smirk'), ('variant','heart-eye')]`; `_extract_dispatches('[smirk] Hello!', ...)` emitted only `[('action','smirk')]`. The same smoke printed `events []`.
  implication: Parser/routing is capable of producing the variant if the model emits the declared token. The provided live log lacked the token in the parsed sentence, so no variant dispatch log was possible. Event dispatch cannot be produced because no event code is declared.
- timestamp: 2026-05-08T00:30:00-04:00
  checked: Avatar override indirection
  found: `server.py` defaults `AGENTICLLMVTUBER_ACTIVE_AVATAR` to `teto`; `avatars/teto/_avatar_overrides.yaml` is missing and loads zero variants/events. The imported `avatars/重音テト/_avatar_overrides.yaml` has 14 variants and zero events.
  implication: Live UAT only has `{heart-eye}` available if the active avatar env var selects `重音テト`; otherwise even the variant catalog is empty.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The live UAT failure is a catalog/prompt mismatch, not a VTS writer failure. Phase 7 runtime parsing/routing only dispatches codes present in the LLM output. The boot prompt exposes only plugin `[action]` codes via `build_action_codes_section(plugin_manifest)` and explicitly tells the LLM not to add variant/event tags unless another instruction provides them. Therefore the model emitted `[smirk] Hello!` and no `{heart-eye}` token, so no `kind=variant` log could be produced. Separately, the imported Teto override has `events: []`, so no `<event>` code is declared for event dispatch or EVENT-COMPLETE verification; if the app uses the default avatar id `teto`, its override file is missing and the variant/event catalogs are empty too.
fix: Diagnose-only mode; no implementation files modified. Suggested direction is to expose active avatar variants/events in the system prompt/UAT instructions and ensure the active avatar override has at least one declared event before requiring live event dispatch.
verification: Read-only smoke confirmed forced `[smirk] {heart-eye} <wave>` emits action + variant but no event with current imported Teto catalog, while the logged `[smirk] Hello!` emits only action. Prompt inspection confirmed no variant/event vocabulary is supplied to the LLM.
files_changed: []
