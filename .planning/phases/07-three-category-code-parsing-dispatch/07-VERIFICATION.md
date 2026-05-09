---
phase: 07-three-category-code-parsing-dispatch
verified: 2026-05-09T00:59:48Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Live VTS dispatch confirmation"
    expected: "A declared action reaches the active plugin queue, a declared variant toggles through PyvtsSafeWriter, and a declared event fires a VTS motion hotkey with an EVENT-COMPLETE log after duration_ms."
    why_human: "Requires VTube Studio, a loaded rig, visible avatar state, and real hotkey registration."
---

# Phase 7: Three-Category Code Parsing + Dispatch Verification Report

**Phase Goal:** The LLM can emit `[joy] {hold-mic} <wave>` in a single sentence and three distinct dispatch paths fire: action codes feed the active plugin input queue, variant codes radio-button-toggle a VTS hotkey via `PyvtsSafeWriter`, event codes fire a VTS motion hotkey with `motion3.json.Meta.Duration + 1s blend pad` auto-completion. Reserved-name guard blocks LLM-protocol sentinels; cross-category uniqueness fails loud at boot when manufactured collisions are introduced.
**Verified:** 2026-05-09T00:59:48Z
**Status:** human_needed
**Re-verification:** No - initial verification. No prior `*-VERIFICATION.md` existed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | One sentence can produce ordered action, variant, and event dispatches. | Verified | `code_extractor` dispatches on `[`, `{`, `<` in `sidecar/src/sidecar/orchestrator/transformers.py:101`; mixed `[joy] {hold-mic} <wave>` fixtures assert ordered `ActionCode`, `VariantToggle`, `EventFire` in `sidecar/tests/orchestrator/test_code_extractor.py:65` and split version at `:74`. |
| 2 | Three runtime paths are distinct and wired. | Verified | `_route_dispatches` sends actions to `plugin_adapter.enqueue_action_code`, variants to `variant_state_manager.apply`, and events to `discrete_dispatcher.fire` plus `event_completion_tracker.track` in `sidecar/src/sidecar/orchestrator/orchestrator.py:232`. |
| 3 | Variant policy is radio-button single-active and event completion uses final duration delays. | Verified | `VariantStateManager.apply` turns the previous hotkey off before firing the new one in `sidecar/src/sidecar/vts/variant_state_manager.py:37`; `EventCompletionTracker` sleeps from `EventFire.duration_ms` with 10s fallback for missing/nonpositive values in `sidecar/src/sidecar/vts/event_completion_tracker.py:72`. |
| 4 | Reserved names and cross-category collisions fail loud before VTS connection. | Verified | `validate_reserved_names` raises `ReservedNameError` / `CategoryCollisionError` in `sidecar/src/sidecar/parser/reserved.py:49`; server calls it before constructing `PyvtsSafeWriter` and before `connect_and_authenticate` in `sidecar/src/sidecar/ws/server.py:227`. Boot tests assert collision/reserved failures occur before handshake in `sidecar/tests/test_sidecar_boot.py:207` and `:238`. |
| 5 | Current Phase 7 parser policy is enforced: no parse-time `<think>` strip; sentinels are reserved and leaked `<think>` is not valid event dispatch. | Verified | Orchestrator passes `valid_tags=[]` to `sentence_divider` at `sidecar/src/sidecar/orchestrator/orchestrator.py:294`; `<think>` unknown-event drop fixture is in `sidecar/tests/orchestrator/test_code_extractor.py:148`; reserved sentinel list includes `think`, `thinking`, tool sentinels, Anthropic sentinels, and roles in `sidecar/src/sidecar/parser/reserved.py:7`. |

**Score:** 5/5 automated truths verified. Live VTS behavior still needs human confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/contracts/py/contracts/dispatch.py` | Python `Dispatch` discriminated union | Verified | `ActionCode`, `VariantToggle`, `EventFire`, and discriminator exist. |
| `packages/contracts/py/contracts/audio_payload.py` | Audio payload carries `dispatches` | Verified | `dispatches: List[Dispatch]`; no `actions` field. |
| `packages/contracts/ts/dispatch.ts` and JSON Schema | Generated TS/schema mirrors | Verified | `Dispatch = ActionCode \| VariantToggle \| EventFire`; schema has `kind` discriminator. |
| `sidecar/src/sidecar/orchestrator/transformers.py` | `code_extractor`, display/TTS stripping | Verified | Single-pass bracket scan plus display/TTS removal of square, curly, and angle syntax. |
| `sidecar/src/sidecar/parser/reserved.py` | Reserved-name and collision validator | Verified | Case-insensitive validation and source-naming errors. |
| `sidecar/src/sidecar/vts/variant_state_manager.py` | Single-active variant manager | Verified | Re-emitting same variant no-ops; switching fires old then new. |
| `sidecar/src/sidecar/vts/event_completion_tracker.py` | Event completion timer registry | Verified | Tracks multiple tasks per hotkey and logs completion after delay. |
| `sidecar/src/sidecar/orchestrator/orchestrator.py` | Runtime dispatch router | Verified | Routes all dispatch kinds in order. |
| `sidecar/src/sidecar/ws/server.py` | Boot validation and manager wiring | Verified | Wires plugin adapter, discrete dispatcher, variant manager, event tracker into `Orchestrator`. |
| `apps/renderer/src/chrome/LogsDrawer.tsx` | `[DISPATCH]` log highlighting | Verified | `[DISPATCH]` highlighted; old `[INTENT]` remains plain per tests. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `codegen.py` | Python/TS/generated dispatch contracts | owner-file mapping and contract check | Verified | `gsd-tools verify key-links` passed for 07-01 and 07-02. |
| `transformers.py` | `contracts.dispatch` | imports and emits `ActionCode`, `VariantToggle`, `EventFire` | Verified | Extractor creates concrete dispatch records from catalog lookups. |
| `orchestrator.py` | `plugin_adapter.py` | `ActionCode` -> `enqueue_action_code` | Verified | Action route is not orphaned. |
| `orchestrator.py` | `variant_state_manager.py` | `VariantToggle` -> `apply` | Verified | Variant route reaches VTS manager. |
| `orchestrator.py` | `discrete_dispatcher.py` / `event_completion_tracker.py` | `EventFire` -> fire + track | Verified | Event route fires hotkey and schedules completion. |
| `server.py` | `parser/reserved.py` | boot validation before VTS handshake | Verified | Tests prove failure before handshake. |
| `server.py` | `Orchestrator` | manager injection | Verified | Boot passes plugin adapter, variant manager, discrete dispatcher, and tracker. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Orchestrator._run_pipeline` | `SentenceOutput.dispatches` | LLM token stream -> sentence divider -> `code_extractor` with plugin action codes and avatar overrides | Yes | Verified |
| `code_extractor` | `VariantToggle.hotkey_id` / `EventFire.hotkey_id` | `AvatarOverrides.variants` and `AvatarOverrides.events` loaded at boot | Yes | Verified |
| `EventFire.duration_ms` | event delay | VTS import extracts `motion3.json.Meta.Duration`; parser adds 1000ms unless fallback | Yes | Verified |
| `PluginAdapter.action_code_queue` | action queue entries | `_route_dispatches` calls `enqueue_action_code` | Yes | Verified |
| `VariantStateManager` | current variant hotkey | `VariantToggle` from route | Yes | Verified |
| `EventCompletionTracker` | in-flight events | `EventFire` from route | Yes | Verified |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Dispatch contract constructs all three record kinds | `cd sidecar; uv run python -c "from contracts import ActionCode, VariantToggle, EventFire; ..."` | Printed `action variant 2833` | Pass |
| Dispatch order and collision validation | `cd sidecar; uv run pytest tests/orchestrator/test_dispatch_routing.py::test_dispatch_order_is_preserved tests/parser/test_reserved.py::test_plugin_variant_collision_raises -q` | `2 passed` | Pass |
| Full extractor/display/TTS chain strips all code syntax | `cd sidecar; uv run pytest tests/orchestrator/test_code_extractor.py::test_full_decorator_chain_strips_all_code_syntax -q` | `1 passed` | Pass |
| Variant radio-button and event delay behavior | `cd sidecar; uv run pytest tests/vts/test_variant_state_manager.py::test_applying_different_variant_fires_old_hotkey_then_new_hotkey tests/vts/test_event_completion_tracker.py::test_tracking_valid_duration_logs_after_exact_final_delay -q` | `2 passed` | Pass |
| Boot validation before VTS connect | `cd sidecar; uv run pytest tests/test_sidecar_boot.py::test_collision_raises_before_vts_connect tests/test_sidecar_boot.py::test_reserved_event_raises_before_vts_connect -q` | `2 passed` | Pass |
| Boot/catalog data reaches parser | `cd sidecar; uv run pytest tests/orchestrator/test_dispatch_routing.py::test_pipeline_uses_plugin_actions_and_avatar_overrides_for_code_extractor -q` | `1 passed` | Pass |
| Renderer `[DISPATCH]` highlighting | `cd apps/renderer; npm test -- --run logs-drawer-intent` | `1 file, 4 tests passed` | Pass |

Orchestrator-provided regression gate also passed: `npm run check:contracts`, sidecar focused suite (`261 passed, 2 warnings`), and renderer logs-drawer intent tests (`4 passed`).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PARSE-01 | 07-03, 07-07 | `code_extractor` single-pass bracket walker for `[action]`, `{variant}`, `<event>` | Satisfied | `transformers.py:101`; split-token fixtures in `test_code_extractor.py:104`. |
| PARSE-02 | 07-03, 07-07 | Chat display + TTS strip all three syntaxes | Satisfied | `_strip_code_syntax` in `transformers.py:204`; TTS filters at `tts_preprocessor.py:163`, `:173`, `:178`; chain test passed. |
| PARSE-03 | 07-01, 07-02, 07-06, 07-07 | Action -> plugin queue; variant -> VTS toggle; event -> VTS motion hotkey | Satisfied | Runtime routes in `orchestrator.py:232`; `DiscreteDispatcher` uses `PyvtsSafeWriter` request path in `discrete_dispatcher.py:23`. |
| PARSE-04 | 07-03, 07-04, 07-07 | REQUIREMENTS.md still says parse-time reasoning strip runs first; Phase 7 plan/roadmap revised this to no parse-time strip plus reserved-name guard | Satisfied as revised | `valid_tags=[]` in `orchestrator.py:294`; reserved sentinel guard in `reserved.py:7`; unknown `<think>` drop test. Planning artifact wording should be reconciled later. |
| PARSE-05 | 07-05, 07-06, 07-07 | Radio-button single-active variant policy | Satisfied | `VariantStateManager.apply` and focused test passed. |
| PARSE-06 | 07-01, 07-02, 07-03, 07-05, 07-06, 07-07 | `motion3.json.Meta.Duration + 1s`; 10s fallback for missing/oversized metadata | Satisfied | VTS extractor duration policy in `avatar/extractors/vts.py:13`; parser conversion in `transformers.py:95`; tracker tests passed. |
| PARSE-07 | 07-04, 07-07 | Cross-category uniqueness check at boot with loud failure | Satisfied | `validate_reserved_names` and boot tests passed. |
| PARSE-08 | 07-03 | Split-token reassembly fixtures for all three categories; no brackets leak | Satisfied | `SPLIT_TOKEN_FIXTURES` in `test_code_extractor.py:11`; full chain strip test passed. Note: REQUIREMENTS.md says `ActionIntent`, but implemented/current contract is `ActionCode`. |

No orphaned Phase 7 requirement IDs found: plans declare all PARSE-01 through PARSE-08, and REQUIREMENTS.md maps all eight to Phase 7.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `sidecar/src/sidecar/ws/server.py` | 64 | Legacy `TODO Phase 5` about Electron env-var write | Info | Existing startup-config note, not in Phase 7 dispatch path. |
| Multiple | n/a | Empty list/dict initial state and silent payload defaults | Info | Benign initialization/default values; populated by fetch/load/route paths. |

No blocker stub, placeholder, orphaned artifact, or hardcoded-empty user-visible dispatch path was found.

### Human Verification Required

#### 1. Live VTS Dispatch Confirmation

**Test:** Run the app with VTube Studio open and a rig whose active plugin action catalog, variant catalog, and event catalog contain the emitted codes. Send one sentence containing all three codes. If the active default plugin/catalog does not declare `joy`, use a declared action such as `[smirk]`; if the active avatar does not declare `{hold-mic}` or `<wave>`, use declared catalog entries from that avatar.

**Expected:** Logs show `[DISPATCH] kind=action`, `[DISPATCH] kind=variant`, and `[DISPATCH] kind=event`; the plugin receives the action, the variant hotkey toggles visibly, the event motion hotkey fires, and `[EVENT-COMPLETE]` appears after `duration_ms`.

**Why human:** Requires external VTube Studio state, real rig hotkeys, and visual confirmation.

### Gaps Summary

No automated goal gaps found. Phase 7's code-level goal is achieved, with one required manual VTS confirmation remaining because the final hotkey/visual behavior depends on an external running VTS instance and loaded rig.

---

_Verified: 2026-05-09T00:59:48Z_
_Verifier: Claude (gsd-verifier)_
