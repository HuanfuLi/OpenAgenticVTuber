---
phase: 07-three-category-code-parsing-dispatch
verified: 2026-05-09T04:09:32Z
status: human_needed
score: 6/6 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Runtime prompt/catalog gap closed: active plugin action codes, avatar variant codes, and avatar event codes are now listed with real delimiters."
    - "Live variant UAT confirmed: active Teto emitted `{heart-eye}`, VTS fired the hotkey, and the user confirmed the rig visibly switched to Heart Eye."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Live VTS event confirmation with event-bearing avatar catalog"
    expected: "With an active avatar whose overrides contain at least one event, a listed `<event>` dispatch fires the VTS motion hotkey and logs `[EVENT-COMPLETE]` after the parsed duration."
    why_human: "Current active Teto catalog has `events: []`; this requires selecting/importing an event-bearing avatar and observing VTube Studio."
---

# Phase 7: Three-Category Code Parsing + Dispatch Verification Report

**Phase Goal:** The LLM can emit `[joy] {hold-mic} <wave>` in a single sentence and three distinct dispatch paths fire: action codes feed the active plugin's input queue, variant codes radio-button-toggle a VTS hotkey via `PyvtsSafeWriter`, event codes fire a VTS motion hotkey with `motion3.json.Meta.Duration + 1s blend pad` auto-completion. Reserved-name guard blocks LLM-protocol sentinels; cross-category uniqueness fails loud at boot when manufactured collisions are introduced.
**Verified:** 2026-05-09T04:09:32Z
**Status:** human_needed
**Re-verification:** Yes - after 07-08 prompt/catalog gap closure.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | One sentence can produce ordered action, variant, and event dispatches. | ✓ VERIFIED | `code_extractor` dispatches on `[`, `{`, and `<` in `sidecar/src/sidecar/orchestrator/transformers.py:101`; `[joy] {hold-mic} <wave>` fixtures assert ordered `ActionCode`, `VariantToggle`, `EventFire` in `sidecar/tests/orchestrator/test_code_extractor.py:65` and split version at `:74`. |
| 2 | Three runtime paths are distinct and wired. | ✓ VERIFIED | `_route_dispatches` sends actions to `plugin_adapter.enqueue_action_code`, variants to `variant_state_manager.apply`, and events to `discrete_dispatcher.fire` plus `event_completion_tracker.track` in `sidecar/src/sidecar/orchestrator/orchestrator.py:238`. Routing tests assert order `action -> variant -> event-fire -> event-track` in `sidecar/tests/orchestrator/test_dispatch_routing.py:124`. |
| 3 | Variant policy is radio-button single-active and event completion uses final duration delays. | ✓ VERIFIED | `VariantStateManager.apply` no-ops repeated variants and toggles old then new on switch in `sidecar/src/sidecar/vts/variant_state_manager.py:37`; `EventCompletionTracker` sleeps from `EventFire.duration_ms` with fallback in `sidecar/src/sidecar/vts/event_completion_tracker.py:72`. Focused tests passed. |
| 4 | Reserved names and cross-category collisions fail loud before VTS connection. | ✓ VERIFIED | `validate_reserved_names` raises `ReservedNameError` / `CategoryCollisionError` in `sidecar/src/sidecar/parser/reserved.py:49`; server calls it before `PyvtsSafeWriter` construction and before `connect_and_authenticate` in `sidecar/src/sidecar/ws/server.py:227`. Boot tests cover collision and reserved failures. |
| 5 | Prompt/catalog gap is closed: the runtime prompt lists active `[action]`, `{variant}`, and `<event>` codes and no longer discourages listed variant/event tags. | ✓ VERIFIED | `build_dispatch_codes_section(plugin_manifest, overrides)` emits `### Plugin Actions`, `### Avatar Variants`, and `### Avatar Events` in `sidecar/src/sidecar/plugins/loader.py:68`; prompt template uses `[<insert_dispatch_codes_section>]` and describes all three delimiters in `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt:1`. Boot builds this section from the loaded plugin manifest and avatar overrides at `sidecar/src/sidecar/ws/server.py:259`. |
| 6 | Empty event catalogs are treated as a live-UAT prerequisite block, not as a parser/routing failure. | ✓ VERIFIED | Boot logs `[DISPATCH-CATALOG]` counts and `[DISPATCH-CATALOG-BLOCKED]` when `events=[]` in `sidecar/src/sidecar/ws/server.py:260`; `07-HUMAN-UAT.md` records live variant pass and live event block because current imported Teto has `events: []`. |

**Score:** 6/6 truths verified. No code gaps found. One live event confirmation remains human/external-catalog gated.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/contracts/py/contracts/dispatch.py` | Python `Dispatch` discriminated union | ✓ VERIFIED | `ActionCode`, `VariantToggle`, `EventFire`, and `Field(discriminator="kind")` exist. |
| `packages/contracts/py/contracts/audio_payload.py` | Audio payload carries ordered `dispatches` | ✓ VERIFIED | `dispatches: List[Dispatch]`; no `actions` field in payload contract. |
| `packages/contracts/ts/dispatch.ts` and generated schema | TS/schema mirrors expose `Dispatch` | ✓ VERIFIED | TS union and JSON Schema discriminator exist; `npm run check:contracts` passed. |
| `sidecar/src/sidecar/orchestrator/transformers.py` | Three-category parser and strip pipeline | ✓ VERIFIED | Single-pass extractor creates all three dispatch records; display/TTS strip square, curly, and angle code syntax. |
| `sidecar/src/sidecar/parser/reserved.py` | Reserved-name and collision validator | ✓ VERIFIED | Case-insensitive reserved and cross-category checks with loud exceptions. |
| `sidecar/src/sidecar/vts/variant_state_manager.py` | Single-active variant manager | ✓ VERIFIED | Re-emitting same variant no-ops; switching fires old hotkey then new hotkey. |
| `sidecar/src/sidecar/vts/event_completion_tracker.py` | Event completion tracker | ✓ VERIFIED | Tracks in-flight event tasks and logs `[EVENT-COMPLETE]` after `duration_ms`. |
| `sidecar/src/sidecar/plugins/loader.py` | Combined dispatch prompt catalog builder | ✓ VERIFIED | `build_dispatch_codes_section` lists action, variant, and event categories with empty-event message. |
| `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` | Prompt allows listed dispatch codes | ✓ VERIFIED | Uses combined placeholder and describes `[action]`, `{variant}`, `<event>`. |
| `sidecar/src/sidecar/ws/server.py` | Boot validation, catalog logs, prompt/runtime wiring | ✓ VERIFIED | Builds prompt section after manifest/overrides load; passes parser catalogs and VTS managers to `Orchestrator`. |
| `apps/renderer/src/chrome/LogsDrawer.tsx` | `[DISPATCH]` log highlighting | ✓ VERIFIED | Renderer test confirms `[DISPATCH]` highlight and legacy `[INTENT]` plain behavior. |
| `.planning/phases/07-three-category-code-parsing-dispatch/07-HUMAN-UAT.md` | Live UAT record | ✓ VERIFIED | Records live `{heart-eye}` pass and event prerequisite block for `events: []`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `codegen.py` | Python/TS/generated dispatch contracts | codegen and drift guard | ✓ VERIFIED | `npm run check:contracts` regenerated contracts and exited cleanly. |
| `orchestrator.py` | `transformers.py` | `code_extractor(plugin_action_codes, variants, events)` | ✓ VERIFIED | `Orchestrator` stores `plugin_action_codes` and derives `variants/events` from `avatar_overrides`, then passes them to `code_extractor` at `orchestrator.py:295`. |
| `orchestrator.py` | `plugin_adapter.py` | `ActionCode` -> `enqueue_action_code` | ✓ VERIFIED | Action route logs `[DISPATCH] kind=action` after accepted enqueue. |
| `orchestrator.py` | `variant_state_manager.py` | `VariantToggle` -> `apply` | ✓ VERIFIED | Variant route awaits `VariantStateManager.apply`. |
| `orchestrator.py` | `discrete_dispatcher.py` / `event_completion_tracker.py` | `EventFire` -> `fire` + `track` | ✓ VERIFIED | Event route fires hotkey via writer-backed dispatcher and schedules completion. |
| `server.py` | `parser/reserved.py` | boot validation before VTS handshake | ✓ VERIFIED | Validation happens before writer/handshake construction; boot tests assert loud failure. |
| `server.py` | `plugins/loader.py` | `build_dispatch_codes_section(plugin_manifest, overrides)` | ✓ VERIFIED | `gsd-tools` key-link passed; server builds combined prompt catalog from the loaded active catalogs. |
| `orchestrator.py` | prompt template | system prompt placeholder replacement | ✓ VERIFIED | `gsd-tools` key-link passed for `insert_dispatch_codes_section`. |
| `server.py` | `Orchestrator` | same boot-frozen catalogs feed prompt and parser | ✓ VERIFIED | Server passes `action_codes_section=dispatch_codes_section`, `plugin_action_codes=plugin_action_codes`, and `avatar_overrides=overrides` in one constructor call. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `build_dispatch_codes_section` | action/variant/event catalog lines | active `PluginManifest` and `AvatarOverrides` loaded during boot | Yes | ✓ FLOWING |
| `Orchestrator._system_prompt` | `dispatch_codes_section` | `server.py` builds from active plugin manifest + avatar overrides | Yes | ✓ FLOWING |
| `code_extractor` | `ActionCode`, `VariantToggle`, `EventFire` | LLM token stream after sentence buffering and boot-frozen catalogs | Yes | ✓ FLOWING |
| `EventFire.duration_ms` | event completion delay | `EventEntry.duration_seconds` and `duration_is_fallback`; parser adds 1s pad only for non-fallback durations | Yes | ✓ FLOWING |
| `PluginAdapter.action_code_queue` | action queue entries | `_route_dispatches` calls `enqueue_action_code` | Yes | ✓ FLOWING |
| `VariantStateManager` | active variant hotkey | `VariantToggle` route | Yes | ✓ FLOWING |
| `EventCompletionTracker` | in-flight event task | `EventFire` route | Yes | ✓ FLOWING |
| `07-HUMAN-UAT.md` | live event status | current active Teto overrides with `events: []` and live logs | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Contract mirrors are current | `npm run check:contracts` | Passed; codegen wrote generated mirrors and `git diff --exit-code packages/contracts/ts/ packages/contracts/generated/` succeeded. | ✓ PASS |
| Prompt/catalog, parser, boot, routing, variant, and event focused sidecar suite | `cd sidecar && uv run pytest tests/plugins/test_prompt_section.py tests/plugins/test_manifest_watcher.py tests/test_orchestrator_turn.py tests/test_sidecar_boot.py tests/orchestrator/test_dispatch_routing.py tests/orchestrator/test_code_extractor.py tests/vts/test_variant_state_manager.py tests/vts/test_event_completion_tracker.py -q` | `83 passed in 56.65s` | ✓ PASS |
| Renderer `[DISPATCH]` log highlighting | `cd apps/renderer && npm test -- --run logs-drawer-intent` | `1 file, 4 tests passed` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PARSE-01 | 07-03, 07-07 | `code_extractor` decorator with single-pass bracket walker for `[action]`, `{variant}`, `<event>` | ✓ SATISFIED | `transformers.py:101`; split-token fixtures in `test_code_extractor.py:17`. |
| PARSE-02 | 07-03, 07-07 | Chat display + TTS strip all three syntaxes | ✓ SATISFIED | `_strip_code_syntax` calls square, curly, and angle filters in `transformers.py:204`; focused extractor tests passed. |
| PARSE-03 | 07-01, 07-02, 07-06, 07-07, 07-08 | Action -> plugin queue; variant -> VTS toggle; event -> VTS motion hotkey | ✓ SATISFIED | Runtime routes in `orchestrator.py:238`; `DiscreteDispatcher` sends writer requests in `discrete_dispatcher.py:27`; prompt catalog now exposes all declared code categories. |
| PARSE-04 | 07-03, 07-04, 07-07 | Requirement text says reasoning strip first; Phase 7 roadmap/context revised this to no parse-time strip, reserved-name guard, and unknown `<think>` drop | ✓ SATISFIED AS REVISED | `valid_tags=[]` in `orchestrator.py:303`; reserved sentinel guard in `reserved.py:7`; unknown `<think>` fixture drops as unknown event. The older REQUIREMENTS wording should be reconciled later, but the implemented behavior matches the Phase 7 roadmap success criterion. |
| PARSE-05 | 07-05, 07-06, 07-07, 07-08 | Radio-button single-active variant policy | ✓ SATISFIED | `VariantStateManager.apply`; `test_applying_different_variant_fires_old_hotkey_then_new_hotkey` passed; live `{heart-eye}` persistence confirmed as intentional. |
| PARSE-06 | 07-01, 07-02, 07-03, 07-05, 07-06, 07-07, 07-08 | Event completion uses `motion3.json.Meta.Duration + 1s`; fallback is 10s for missing/invalid/oversized metadata | ✓ SATISFIED | VTS extractor records duration/fallback metadata; parser conversion in `transformers.py:95`; tracker delay tests passed. Live event UAT still requires an event-bearing active avatar catalog. |
| PARSE-07 | 07-04, 07-07 | Cross-category uniqueness check at boot with loud failure | ✓ SATISFIED | `validate_reserved_names` and boot collision test passed. |
| PARSE-08 | 07-03 | Split-token reassembly fixtures for all three categories; no bracket leak | ✓ SATISFIED | `SPLIT_TOKEN_FIXTURES` covers `[`, `{`, and `<`; full chain strip fixtures passed. Requirement wording still mentions legacy `ActionIntent`; current contract is `ActionCode`. |

All requirement IDs declared in Phase 7 PLAN frontmatter are accounted for. No orphaned Phase 7 requirement IDs were found: PARSE-01 through PARSE-08 all appear in plans and in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `sidecar/src/sidecar/ws/server.py` | 64 | Existing `TODO Phase 5` for Electron env-var handoff | ℹ️ Info | Pre-existing LLM config note, unrelated to Phase 7 dispatch parsing/routing. |
| `sidecar/src/sidecar/orchestrator/orchestrator.py` | 303 | `valid_tags=[]` | ℹ️ Info | Intentional Phase 7 parser policy: no parse-time `<think>` strip; sentinels are guarded at boot and unknown `<think>` is not a valid event. |
| Multiple test files | n/a | Empty lists/dicts | ℹ️ Info | Test fixtures, queues, initial state, or empty-event catalog fixtures; not user-visible stubs. |

No blocker stub, orphaned artifact, hardcoded-empty dispatch path, or prompt placeholder leak was found.

### Human Verification Required

#### 1. Live VTS Event Confirmation With Event-Bearing Avatar

**Test:** Start the app with VTube Studio open and an active avatar whose `_avatar_overrides.yaml` contains at least one `events:` entry. Confirm `[DISPATCH-CATALOG] ... events=N` where `N > 0`, then send a prompt that causes the model to use a listed `<event>` code.

**Expected:** Logs show `[DISPATCH] kind=event ... hotkey_id=... duration_ms=...`; the VTS motion hotkey fires; `[EVENT-COMPLETE]` logs after the event duration.

**Why human:** Current imported Teto has `events: []`, so live event verification is externally catalog-gated. The code path is covered by automated parser/routing/tracker tests, but real VTS motion requires an event-bearing active avatar catalog and visible VTS state.

### Gaps Summary

No code gaps remain after 07-08. The prior prompt/catalog gap is closed and live variant dispatch was confirmed by the user. The only remaining item is a live-event UAT prerequisite: current active Teto reports `events: []`, so there is no declared `<event>` code for the LLM to emit or for VTS to fire. This is not a parser, prompt, routing, or event-completion implementation gap.

---

_Verified: 2026-05-09T04:09:32Z_
_Verifier: Claude (gsd-verifier)_
