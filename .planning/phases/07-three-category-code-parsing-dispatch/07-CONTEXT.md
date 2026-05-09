# Phase 7: Three-Category Code Parsing + Dispatch — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the parser + dispatcher that lets the LLM emit
`[joy] {hold-mic} <wave>` in a single sentence and trigger three distinct
runtime paths:

- `[action]` codes feed the active plugin's input queue (Phase 6 default
  plugin consumes; Phase 6 ABC defines the queue contract).
- `{variant}` codes drive a radio-button single-active VTS hotkey toggle via
  a new `VariantStateManager` wrapping `PyvtsSafeWriter`/`DiscreteDispatcher`.
- `<event>` codes fire VTS motion hotkeys via `DiscreteDispatcher.fire()`
  with duration-aware completion tracking (`motion3.json.Meta.Duration + 1s`
  blend pad; 10s ceiling fallback).

**In scope:**

1. **`code_extractor` decorator** — replaces milestone-1 `actions_extractor`
   in `sidecar/src/sidecar/orchestrator/transformers.py`. Single-pass
   left-to-right bracket walker dispatches on opener char (`[`, `{`, `<`).
   Yields `(sentence, list[Dispatch])` where `Dispatch` is a discriminated
   union over `ActionCode | VariantToggle | EventFire`. Handles split-token-
   boundary cases for all three syntaxes (PARSE-08).
2. **`display_processor.filter_brackets` extension** — currently strips only
   `[code]`; Phase 7 extends to also strip `{code}` and `<code>` from chat
   surface (PARSE-02). `tts_filter` already handles all three via
   `ignore_brackets` / `ignore_angle_brackets` config; verify and add a
   `filter_curly_brackets` helper symmetric to existing `filter_brackets` /
   `filter_angle_brackets`.
3. **`VariantStateManager`** — new module under `sidecar/src/sidecar/vts/`,
   sibling to `discrete_dispatcher.py`. Owns `_current_variant: hotkey_id |
   None`. On VariantToggle dispatch: detect re-emit (no-op) vs different
   variant (sequentially fire toggle-off-prev → toggle-on-new → update
   shadow). Boot-time `RemoveAllExpressions` synchronizes shadow ↔ VTS to
   `None`. Session-only persistence — clears on sidecar restart.
4. **Event dispatch via `DiscreteDispatcher.fire()`** — reuse the existing
   AVT-09 path. Add `EventCompletionTracker` (lightweight asyncio task) that
   schedules a per-event timer based on cached `events[].duration_ms + 1s`
   blend pad; tracker exists for state observability and Phase 9 HUD's
   future "event-in-flight" badge, NOT for blocking next-event fire.
   Concurrent fire by design — events are independent overlays; LLM
   emission order = VTS fire order; collision-with-in-flight also concurrent.
5. **Reserved-name guard at boot** — single `validate_reserved_names()`
   function called during sidecar boot (after plugin manifest load + after
   `_avatar_overrides.yaml` load). Checks the **union**
   `plugin.action_codes ∪ variants[].code ∪ events[].code` against the
   reserved list (case-insensitive). Same call also enforces PARSE-07
   cross-category empty-intersection rule. Any failure → loud boot-blocking
   exception naming both the violating code and the conflicting source.
6. **Reserved-name list constant** — locked in
   `sidecar/src/sidecar/parser/reserved.py`. Floor 7 from PLG-06
   (`<think>`, `<thinking>`, `<tool_call>`, `<function_call>`,
   `<function_calls>`, `<invoke>`, `<parameter>`) + extended sweep done at
   Phase 7 plan-time covering Anthropic/OpenAI o-series/Gemini/Qwen3 +
   any other current-2026 sentinels research surfaces.
7. **Adversarial split-token test fixtures** — extend the milestone-1
   `[`/`jo`/`y]` test set to cover `{`/`hold-mic}` → VariantToggle,
   `<`/`wave>` → EventFire, plus mixed-category split scenarios. Pytest
   under `sidecar/tests/orchestrator/test_code_extractor.py` (PARSE-08).

**Out of scope (architectural calls from this discussion):**

- **No `<think>`-strip step** — Phase 2 D-10 stance unchanged. PARSE-04 is
  reframed: cross-category uniqueness check at boot is the sole defense.
  See `<decisions>` D-A1.
- **No event motion-cancel semantics** — pyvts 0.3.3 has no native
  `stop motion` API; we'd have to re-trigger the same hotkey hoping VTS
  toggles it off, which depends on hotkey configuration. Concurrent fire
  sidesteps this entirely.
- **No cross-session variant persistence** — Aligns with LLM-04 in-memory
  rule. App restart = clean rig. See D-B2.
- **No plugin-level reserved-name customization** — Reserved list is a
  system invariant, not a plugin knob. See D-D2.

</domain>

<decisions>
## Implementation Decisions

### A. Parser pipeline shape

- **D-A1: No `<think>`-strip step.** Phase 2 D-10 stance ("API-level
  reasoning-disable; no parser-strip safety net") carries forward unchanged.
  PARSE-04 is **reframed** from "strip first" to "boot-time reserved-name
  uniqueness check is the sole defense". If a non-compliant model leaks
  `<think>...</think>`, code_extractor sees `<think>` as an unknown event,
  silently drops the dispatch (consistent with milestone-1's unknown-tag-
  drop behavior in `_extract_intents`); the bracket text still surfaces
  as visible bug per Phase 2 D-10. Rationale: DeepSeek-R1 distill era is
  past (May 2026), modern providers honor API disable, and adding a strip
  step wastes complexity for a deprecated risk.
- **D-A2: code_extractor leaves brackets in `sentence.text`.** Plugin's
  `on_token_stream` (Phase 6) sees the original sentence WITH bracketed
  codes intact, per ARCH-03 ("plugin sees orchestrator-decorated stream
  in context, not bare codes"). Per-stage strip happens downstream:
  `display_processor.filter_brackets` strips for chat surface,
  `tts_filter` strips for audio. code_extractor's job is to emit
  `Dispatch` records alongside the unmodified sentence.
- **D-A3: One unified `code_extractor` decorator.** Single-pass left-to-
  right bracket walker dispatches on opener char (`[` → ActionCode, `{` →
  VariantToggle, `<` → EventFire). Faster (one pass), aligns with
  PARSE-01 spec wording, one stage in the decorator chain stack.
- **D-A4: Output shape =
  `(sentence: SentenceWithTags, list[Dispatch])`.**
  `Dispatch` is a Pydantic discriminated union:

  ```python
  class ActionCode(BaseModel):
      kind: Literal["action"] = "action"
      name: str

  class VariantToggle(BaseModel):
      kind: Literal["variant"] = "variant"
      name: str
      hotkey_id: str  # resolved at parse-time from _avatar_overrides.yaml

  class EventFire(BaseModel):
      kind: Literal["event"] = "event"
      name: str
      hotkey_id: str           # resolved at parse-time
      duration_ms: int          # cached from motion3.json.Meta.Duration

  Dispatch = Annotated[
      Union[ActionCode, VariantToggle, EventFire],
      Field(discriminator="kind"),
  ]
  ```

  Single ordered list preserves emission order across categories
  (`{variant1} <event1> {variant2}` keeps fire order). Phase 5 codegen
  pipeline handles discriminated unions cleanly. The new decorator chain
  becomes:

  ```
  sentence_divider → code_extractor → display_processor → tts_filter
  ```

  Replacing milestone-1's:

  ```
  sentence_divider → actions_extractor → display_processor → tts_filter
  ```

  ⚠ **Plan-time cleanup:** `actions_extractor` + `_extract_intents` +
  `ActionIntent` (milestone-1 contract) are deleted; `Dispatch` discriminated
  union replaces `ActionIntent`. Phase 5's force_required + OWNER_FILE
  codegen handles the TS mirror.

### B. Variant state & lifecycle

- **D-B1: New `VariantStateManager` module in `sidecar/src/sidecar/vts/`.**
  Sibling to `discrete_dispatcher.py`. Owns the radio-button shadow state.
  Public surface:

  ```python
  class VariantStateManager:
      def __init__(self, dispatcher: DiscreteDispatcher) -> None: ...
      async def reset_to_baseline(self) -> None:
          """Boot-time hook. Fires RemoveAllExpressions; sets _current = None."""
      async def apply(self, toggle: VariantToggle) -> None:
          """Idempotent re-emit = no-op + debug log.
             Different variant = toggle-off-prev → toggle-on-new → update shadow.
          """
  ```

  Keeps VTS-write knowledge in `vts/` namespace; orchestrator stays
  category-agnostic.
- **D-B2: Session-only persistence.** Aligns with LLM-04 ("single in-memory
  thread, clears on relaunch"). Sidecar boot fires `RemoveAllExpressions`
  (Teto rig has this hotkey by default; for rigs without it, fall through
  to "no baseline reset, shadow starts None"). No `variant_state.json` on
  disk; app restart = clean rig.
- **D-B3: Idempotent re-emit policy = no-op (silent).** Detect
  `_current == new_hotkey_id` → return early, log debug-level only. LLM
  often repeats codes for context-reinforcement; we don't penalize. Avoids
  toggle-off-toggle-on visual flicker.
- **D-B4: Shadow state is the source of truth; VTS is downstream.** We
  never query VTS for current toggle state. Boot syncs once via
  `RemoveAllExpressions`; subsequent updates flow through
  `VariantStateManager.apply()` exclusively. Lower latency, deterministic,
  avoids race window with VTS internal state-track. Acknowledged limitation:
  if user manually toggles a hotkey via VTS UI mid-session, shadow drifts.
  Not addressed; user bug, not common case.

### C. Event dispatch mechanism

- **D-C1: Reuse `DiscreteDispatcher.fire()`.** VTS's `requestTriggerHotKey`
  works for all hotkey types — VTS internally dispatches by configured
  type (ToggleExpression vs TriggerAnimation vs MoveModel vs ...). Phase 7
  events flow through the same call. Zero new code in `vts/`; only addition
  is `EventCompletionTracker` (described below).
- **D-C2: `duration_ms` cached at Phase 8 import time.** Phase 8's
  `motion3_meta.py` already extracts `Meta.Duration`; that path is extended
  to write `duration_ms` (in milliseconds) into
  `_avatar_overrides.yaml.events[]` entries. Phase 7 dispatch reads from
  the in-memory `AvatarOverrides.events[]` after sidecar boot — zero I/O,
  zero await on hot path. Modifying `motion3.json` requires re-import to
  take effect, matching the established "avatar content change ⇒ re-import"
  mental model from Phase 8.
- **D-C3: Concurrent fire for multi-event in single sentence.**
  `<wave> 你好 <bow>` → fire `<wave>` immediately, fire `<bow>` immediately,
  no await. VTS handles motion overlay per its internal rules (depends on
  hotkey configuration; not our responsibility). LLM emission order = fire
  order. Each event spawns its own `EventCompletionTracker` task.
- **D-C4: Event-in-flight collision = concurrent fire.** Symmetric with D-C3
  — if `<wave>` is still in its `(duration_ms + 1s)` window when `<bow>`
  arrives, both fire. We do NOT cancel/queue/ignore. Rationale: events are
  designed as overlay-able motions (the opposite of variants' single-active
  invariant). Avoids the `pyvts 0.3.3` motion-cancel API gap.
- **D-C5: `EventCompletionTracker` = `asyncio.create_task` per event.**
  Each event fire spawns a task that sleeps `(duration_ms + 1s) / 1000.0`
  seconds, then logs `[EVENT-COMPLETE] hotkey_id=<x> name=<y>`.
  Currently the tracker is **observational only** — it doesn't gate
  anything. Phase 9 HUD may consume the in-flight set later for an
  "event playing" badge; Phase 7 just maintains the registry.

### D. Reserved-name guard policy

- **D-D1: Boot-time validation only.** Single `validate_reserved_names()`
  call at sidecar boot, after plugin manifest load + after
  `_avatar_overrides.yaml` load. Checks union `plugin.action_codes ∪
  variants[].code ∪ events[].code` against reserved-list, AND enforces
  PARSE-07 cross-category empty-intersection (`plugin.action_codes ∩
  variants[].code ∩ events[].code = ∅`). Failure → boot-blocking
  exception naming both the violating code and conflicting source. Hot
  path (per-emit) does NOT re-check — boot caught it once, runtime
  cannot regenerate collisions.
- **D-D2: Reserved list = floor 7 + extended sweep.** Floor: PLG-06
  literal 7 (`think`, `thinking`, `tool_call`, `function_call`,
  `function_calls`, `invoke`, `parameter`). Extended (locked at Phase 7
  plan-time after fresh sweep): Anthropic `<thinking>` variants,
  OpenAI o-series `<reasoning>`, Gemini `<reasoning_step>`, Qwen3
  `<think>` variants, DeepSeek-R1 distill variants, plus any 2026-current
  sentinels surfaced by gsd-phase-researcher. Locked as constant in
  `sidecar/src/sidecar/parser/reserved.py`. Plugin authors cannot extend
  via manifest — system-level invariant.
- **D-D3: Case-insensitive matching.** `name.lower() in reserved_lower_set`.
  LLMs vary in casing (`<Think>` / `<THINK>` / `<think>`); plugin authors
  may type `[Joy]` vs `[joy]`. All treated equivalently. Same applies to
  cross-category uniqueness check.
- **D-D4: Check union of all three sources.** `plugin.action_codes ∪
  variants[].code ∪ events[].code`. No source is exempt. PLG-06 originally
  named only `plugin.action_codes`; Phase 8 D-A2-1 establishes that
  variants/events are also LLM-emitted codes, so the same protection
  applies. Single function call covers PARSE-07 + reserved-name + scope
  in one boot-time sweep.

### Claude's Discretion

The planner/researcher resolves these with documented defaults:

- **Reserved-list final composition (plan-time):** `gsd-phase-researcher`
  runs a fresh sweep against Anthropic / OpenAI / Gemini / DeepSeek /
  Qwen3 docs as of 2026-05-08; produces a numbered list with provenance
  comment per entry; planner finalizes `reserved.py` constant. Floor 7
  is non-negotiable; extended sweep findings are merged subject to
  reasonableness review (no false positives that would block user
  customization).
- **`code_extractor` parser internals:** single-pass while-loop with
  index advancement on opener char detection. Walker grammar is `<opener>
  <name> <closer>` where `(opener, closer)` ∈ `{('[', ']'), ('{', '}'),
  ('<', '>')}`. Mismatched brackets (e.g., `[joy>`) → silently dropped
  (consistent with milestone-1 unmatched-bracket behavior). Planner
  decides whether to share or keep the existing milestone-1
  `_extract_intents` walker as the seed; deletion likely cleaner since
  shape changes substantially.
- **`Dispatch` Pydantic discriminator field name (`kind`):** matches
  milestone-1's `ActionIntent.kind` for codegen consistency. Planner can
  flip to `category` if collision with reserved Pydantic field names
  appears.
- **`EventCompletionTracker` task lifecycle:** sidecar shutdown path must
  cancel in-flight tracker tasks gracefully (no leaked timers). Planner
  decides whether tracker uses `asyncio.create_task` + cancellation
  registry or a managed-task pool. Mark as plan-time call.
- **Adversarial fixture corpus:** at minimum the 3 split-pattern triples
  per category (3 categories × 3 patterns = 9 fixtures) plus 2 mixed-
  category fixtures (e.g., `[joy] {`/`hold-mic} <wave>`). Planner can
  expand based on empirical edge cases discovered during code_extractor
  implementation.
- **Plugin queue interface contract:** Phase 6 owns the queue type/shape
  (`asyncio.Queue[ActionCode]` is the obvious default). Phase 7 produces
  ActionCode records; the actual `queue.put_nowait` integration belongs
  in Phase 6 plumbing-week. Phase 7 plan-time stubs an
  `Orchestrator.action_code_queue` attribute as a type-annotated `asyncio.
  Queue[ActionCode]` and pushes via `put_nowait`; Phase 6 wires the
  consumer.
- **Variant on-rigs-without-RemoveAllExpressions:** boot baseline-reset
  may not work on every rig. Planner adds a fallback: if the rig's
  `_avatar_overrides.yaml.events[]` doesn't expose a
  `remove_all_expressions` style hotkey, log INFO and start with shadow
  = None (assume rig is in expected baseline; user re-imports if not).

### Folded Todos

None — `todo match-phase 7` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements

- `.planning/ROADMAP.md` §"Phase 7: Three-Category Code Parsing + Dispatch"
  — phase goals, requirements list (PARSE-01..08), success criteria, plan
  stubs (07-01 / 07-02), and revised `8 → 6 → 7 → 9 → 10` execution order
  with rationale (Phase 7 third — depends on Phase 8's catalog data + Phase
  6's plugin queue).
- `.planning/REQUIREMENTS.md` §"Three-Category Code Parsing + Dispatch
  (Phase 7)" — PARSE-01..08 verbatim. **Note:** PARSE-04 is reframed by
  D-A1 (Phase 7 CONTEXT.md, this file) — original wording "reasoning-strip
  runs FIRST" supersedes to "boot-time reserved-name uniqueness check is
  sole defense; no parse-time strip".
- `PROJECT_DESIGN.md` §14B — v2.0 plugin + animation-control milestone
  source-of-truth.

### Architectural invariants this phase honors

- `.planning/REQUIREMENTS.md` §"Plugin Architecture & Contracts" ARCH-01
  through ARCH-12 — read ARCH-03 (plugin sees orchestrator-decorated
  stream WITH bracketed codes in context — D-A2 enforces), ARCH-06 (single
  pyvts writer rule — `VariantStateManager` and event dispatch both flow
  through `DiscreteDispatcher` → `PyvtsSafeWriter`), ARCH-09 (KV-cache
  prefix-stable system prompt — Phase 7 doesn't touch system prompt),
  ARCH-10 (compositor primitives untouched — Phase 7 dispatch happens
  outside the compositor 60 Hz tick path).

### Cross-phase context

- **Phase 8 CONTEXT.md (just-completed)**:
  `.planning/phases/08-avatar-import-catalogs/08-CONTEXT.md`. Read D-A2-1
  (plugin owns `[action]`; rig owns `{variant}` + `<event>`), D-A2-5
  (`_avatar_overrides.yaml` has 2 catalogs, no emotion_bindings),
  D-A1-1 (`AvatarCapabilities` deleted; `RigCapabilities` is sole
  contract). Phase 7's parser consumes `_avatar_overrides.yaml` for
  variant + event catalogs.
- **Phase 6 (executes before Phase 7)**: `BodyMotionPlugin` ABC,
  `plugin.yaml` manifest with `action_codes: list[str]`, plugin loader.
  Phase 7's reserved-name validate sweeps `plugin.action_codes` from
  Phase 6's loaded manifest.
- **Phase 2 CONTEXT.md** at
  `.planning/phases/02-conversation-pipeline/02-CONTEXT.md` — D-10 (no
  parser-strip safety net for `<think>`; D-A1 carries this forward),
  D-13 (tag → kind classification — Phase 7 supersedes via three-category
  routing), D-19 (KV-cache discipline — Phase 7 doesn't touch system
  prompt assembly so KV-cache invariant holds), D-20 (4-decorator chain
  — Phase 7 swaps `actions_extractor` for `code_extractor` in slot 2).
- **Phase 4 CONTEXT.md** at
  `.planning/phases/04-action-compositor-vts-bridge-body-sway-investigation/04-CONTEXT.md`
  — D-08 (intent overlay decay curve — orthogonal; Phase 7 emits
  ActionCode → plugin queue, plugin produces ParamFrames, compositor
  applies decay), D-11 (`DiscreteDispatcher` exists; Phase 7 reuses for
  events).

### Live source files Phase 7 modifies/replaces/creates

- **Modify** `sidecar/src/sidecar/orchestrator/transformers.py` — replace
  `actions_extractor` + `_extract_intents` with `code_extractor`. The
  decorator chain in `Orchestrator.turn()` (`orchestrator.py:44-49`)
  also updates.
- **Modify** `sidecar/src/sidecar/orchestrator/tts_preprocessor.py` —
  add `filter_curly_brackets` symmetric to existing `filter_brackets` /
  `filter_angle_brackets`; `tts_filter()` config gains
  `ignore_curly_brackets: bool = True`.
- **Modify** `sidecar/src/sidecar/orchestrator/orchestrator.py` —
  decorator chain swap; new `action_code_queue: asyncio.Queue[ActionCode]`
  attribute (consumer wired in Phase 6).
- **Create** `sidecar/src/sidecar/parser/__init__.py` +
  `sidecar/src/sidecar/parser/reserved.py` — reserved-name constant +
  `validate_reserved_names()` boot-time sweep function.
- **Create** `sidecar/src/sidecar/vts/variant_state_manager.py` —
  `VariantStateManager` class (D-B1 surface).
- **Create** `sidecar/src/sidecar/vts/event_completion_tracker.py` —
  `EventCompletionTracker` class (per-event asyncio task registry).
- **Modify** `sidecar/src/sidecar/ws/server.py` lifespan startup — wire
  `validate_reserved_names()` after manifest load + overrides load (Phase
  8 D-A4-1 boot path); wire `VariantStateManager.reset_to_baseline()`
  after VTS handshake.
- **Delete** `ActionIntent` from `packages/contracts/py/` and TS mirror
  (replaced by `Dispatch` discriminated union — `ActionCode`,
  `VariantToggle`, `EventFire`).
- **Create** `packages/contracts/py/dispatch.py` — `ActionCode`,
  `VariantToggle`, `EventFire` Pydantic models + `Dispatch` discriminated
  union annotation. Phase 5's `force_required` + `OWNER_FILE` codegen
  handles the TS mirror.
- **Create** `sidecar/tests/orchestrator/test_code_extractor.py` —
  adversarial split-token + mixed-category fixtures (PARSE-08).
- **Create** `sidecar/tests/parser/test_reserved.py` — boot-time
  `validate_reserved_names()` table-driven test (collision detection,
  case-insensitivity, cross-category uniqueness).
- **Create** `sidecar/tests/vts/test_variant_state_manager.py` —
  shadow-state semantics, idempotent no-op, baseline-reset.

### OLVT source (port reference)

- `OpenLLM_Vtuber/src/open_llm_vtuber/agent/transformers.py` — the
  `actions_extractor` Phase 7 replaces; the bracket-walker pattern in
  milestone-1's `_extract_intents` is the seed for `code_extractor`.
  Adapt single-bracket-pair to three-pair walker.
- `OpenLLM_Vtuber/src/open_llm_vtuber/utils/sentence_divider.py` — read
  for tag-state-tracking semantics if planner reconsiders D-A1 (not
  expected; recorded for completeness).

### External format / API specs

- VTS API "1.0" `HotkeyTriggerRequest` shape:
  https://github.com/DenchiSoft/VTubeStudio
- pyvts 0.3.3 `requestTriggerHotKey()` method signature: vendored at
  `sidecar/vendor/pyvts/`; verify against IMP-10 smoke-test output.
- Live2D Cubism `motion3.json` schema (especially `Meta.Duration`):
  https://github.com/Live2D/CubismSpecs
- LLM-protocol sentinels (extended sweep at plan-time):
  - Anthropic tool-use: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
  - OpenAI o-series reasoning: https://platform.openai.com/docs/guides/reasoning
  - Gemini reasoning: https://ai.google.dev/gemini-api/docs/reasoning
  - Qwen3 / DeepSeek-R1 distill think-block conventions:
    upstream HF model cards.

### Sample data for testing

- `Live2D/重音テト/重音テト.vtube.json` — 14 ToggleExpression hotkeys =
  variant catalog post-Phase-8-import. Used in `test_code_extractor.py`
  fixtures to validate variant catalog integration.
- `Live2D/重音テト/重音テト.motions/*/...motion3.json` — events with
  `Meta.Duration` values verified against IDLE motion (~2.833s per
  Phase 8 RESEARCH §motion3_meta).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`sidecar/src/sidecar/orchestrator/transformers.py`** —
  `_extract_intents` bracket-walker (lines 125-157) is the seed for
  `code_extractor`. Adapt single `[`/`]` walker to three-pair
  `[`/`]`, `{`/`}`, `<`/`>` dispatch-on-opener walker. Existing
  case-insensitive lookup pattern (`name in expression_names_lower`)
  carries forward to catalog lookup.
- **`sidecar/src/sidecar/orchestrator/tts_preprocessor.py`** — has
  `filter_brackets`, `filter_angle_brackets` already (lines 153, 163);
  Phase 7 adds `filter_curly_brackets` symmetrically. `tts_filter`
  function signature already has `ignore_brackets` / `ignore_parentheses`
  / `ignore_asterisks` / `ignore_angle_brackets` boolean params; adding
  `ignore_curly_brackets` follows the same pattern (~5 LOC each in
  filter helper + tts_filter dispatch).
- **`sidecar/src/sidecar/vts/discrete_dispatcher.py`** —
  `DiscreteDispatcher.fire(hotkey_id, name)` (lines 19-30) is the VTS
  hotkey-trigger primitive. Phase 7 wraps this with
  `VariantStateManager.apply()` for radio-button toggle and uses
  directly for events. The existing `fire_by_name(name, overrides,
  force)` method (lines 32-44) is milestone-1's by-name lookup against
  `TetoOverrides.discovered_hotkeys`; Phase 7 replaces this with
  by-id lookup against `AvatarOverrides.variants[]` /
  `events[]` (Phase 8 schema).
- **`sidecar/src/sidecar/vts/pyvts_writer.py`** — `PyvtsSafeWriter`
  single-writer-task wrapper (AVT-04). All variant + event fires flow
  through it; Phase 7 doesn't add a new pyvts writer or any second-class
  wrapper around it. ARCH-06 enforcement was hardened in 06-07
  (post-verification F-2): `sidecar/tests/test_arch06_single_writer.py`
  asserts `requestSetParameterValue` / `requestInjectParameterData` /
  `plugin_name` callsites stay single-source in `pyvts_writer.py`. Phase 7
  reuses this test as its architecture guard rather than the legacy
  `rg 'import pyvts'` count grep, which is necessary but not sufficient
  (it does not catch indirect `from sidecar.vts.pyvts_writer import`
  re-export wrappers — see `06-VERIFICATION.md` post_verification F-2).

### Established Patterns

- **OLVT decorator-chain pattern** — Phase 2 D-20. Phase 7 swaps
  `actions_extractor` for `code_extractor` in slot 2 of the chain;
  surrounding decorators (`sentence_divider`, `display_processor`,
  `tts_filter`) untouched.
- **Discriminated-union Pydantic** — `WSMessage` (Phase 1) and Phase 8's
  in-flight contracts establish the pattern. Phase 7's `Dispatch` follows
  the same shape: each variant has `kind: Literal[...]`, the union is
  `Annotated[Union[...], Field(discriminator="kind")]`.
- **Loud-failure boot loader** — milestone-1 `AvatarCapabilities` raises
  Pydantic ValidationError on schema drift; Phase 7's
  `validate_reserved_names()` follows: raise `ReservedNameError` /
  `CategoryCollisionError` from `parser/reserved.py` so sidecar boot
  aborts with clear log line.
- **`asyncio.create_task` per request** — Phase 4
  `compositor/scheduler.py` already uses managed tasks; Phase 7
  `EventCompletionTracker` follows the same pattern (registry + cleanup).

### Integration Points

- **Decorator chain wiring** — `Orchestrator.__init__`
  (`orchestrator.py:44-49`) currently imports
  `actions_extractor`; replace with `code_extractor` import + chain
  recompose.
- **Plugin queue producer side** —
  `Orchestrator.action_code_queue: asyncio.Queue[ActionCode]` attribute
  defined in Phase 7; consumer side (PluginAdapter) wired in Phase 6.
  Phase 7 plan-time stubs the queue; Phase 6 wires the consumer.
- **Sidecar boot sequence** — `sidecar/src/sidecar/ws/server.py`
  lifespan startup must call (in order):
  1. Load `_avatar_overrides.yaml` (Phase 8 boot path)
  2. Load plugin manifest (Phase 6 boot path)
  3. `validate_reserved_names(plugin.action_codes,
     overrides.variants, overrides.events)` (Phase 7)
  4. VTS handshake
  5. `VariantStateManager.reset_to_baseline()` (Phase 7)
  Order matters: validate before VTS handshake to fail fast without
  TCP connect cost; baseline-reset after handshake because it requires
  VTS connection.
- **Renderer side** — no Phase 7 renderer changes. Chat surface
  continues to receive bracket-stripped text via existing
  `display_processor` path; the curly-bracket extension is transparent.

</code_context>

<specifics>
## Specific Ideas

- **User architectural insight on `<think>`-strip drop:** The user
  challenged the premise that we still need active reasoning-strip in
  May 2026 ("Why we care about Deepseek R1 that much? It has been
  deprecated for years"). After Claude clarified the residual cross-
  talk risk between `<event>` syntax and `<think>` content, user
  decisively chose "trust API disable; no parser-strip step". This is
  a deliberate departure from the original PARSE-04 wording — the
  reframing is: cross-category uniqueness check at boot is the sole
  defense. Documented in D-A1 + the `<domain>` "Out of scope" section.
  Plan-time agents should respect this and NOT add a `<think>`-strip
  step on their own.

- **Variant state location preference for `vts/` namespace:** User
  explicitly chose `VariantStateManager` to live in
  `sidecar/src/sidecar/vts/` (sibling to `discrete_dispatcher.py`)
  rather than as an Orchestrator attribute. Reason: keeps VTS-write
  concerns clustered; orchestrator stays category-agnostic. This
  aligns with the existing module structure where all pyvts-touching
  code lives in `vts/`.

- **Concurrent event fire is symmetric with overlay design:** Variants
  are mutually exclusive (radio-button); events are explicitly
  designed as overlay-able motions. The collision policies oppose by
  design (variants serialize, events parallelize) and this asymmetry
  is intentional, not an oversight. Plan-time agents should NOT propose
  symmetrizing them.

- **Phase 6 plumbing-week unblocks Phase 7 reserved-name sweep:** The
  Phase 7 sweep at plan-time depends on having a research artifact
  (extended LLM sentinel list) that Phase 6 plumbing-week may have
  already produced. Plan-phase researcher should coordinate: if Phase
  6 lists provider sentinels in its own RESEARCH.md, Phase 7 RESEARCH
  references that list rather than re-deriving.

- **`actions_extractor` deletion is breaking:** Milestone-1 `ActionIntent`
  (kind/name/strength/duration_ms/avatar_id) is deleted; replaced by
  three discriminated-union variants. Phase 5 codegen pipeline regenerates
  TS automatically. Renderer-side: Logs drawer's `[INTENT]` log lines
  reformat to `[DISPATCH]` with `kind=action|variant|event` discriminator
  visible. Plan-time deliverable: rename the `[INTENT]` loguru log
  prefix in `actions_extractor` (deleted) → `[DISPATCH]` in
  `code_extractor`.

</specifics>

<deferred>
## Deferred Ideas

- **`<think>`-strip step revisit** — D-A1 drops it for May 2026 LLM
  landscape. If a future milestone introduces wider model-compatibility
  (e.g., supporting older self-hosted distills as a feature), revisit
  by re-enabling `sentence_divider valid_tags=['think']` or adding a
  pre-divider strip filter. Not in v2.0 scope.

- **Cross-session variant persistence** — D-B2 chose session-only.
  If a future user-experience milestone wants "resume avatar state
  across app restart" as an explicit feature, add an opt-in
  `variant_state.json` on disk + boot-load + corruption recovery.
  Not v2.0; user manually re-emits if continuity matters.

- **VTS-state ground-truth queries** — D-B4 chose shadow-state-only.
  If user-manual-VTS-toggle drift becomes a real bug, add lazy
  `requestExpressionState` query on suspected drift markers (e.g., on
  audio-canvas-focus events). Defer until empirical bug.

- **Event motion-cancel via `requestTriggerHotKey` re-fire** — D-C4
  noted that re-triggering a hotkey can flip toggle-style hotkeys off
  in VTS but is unreliable. If a future milestone needs explicit
  motion-cancel (e.g., "interrupt animation on user click"), explore
  rig-side hotkey configuration changes or wait for pyvts upstream
  feature. Out of v2.0 scope.

- **Plugin-extensible reserved list** — D-D2 chose system-level fixed
  constant. If plugin authors need to reserve their own internal
  syntax markers (e.g., a plugin uses `[[double_bracket]]` for
  internal control), add `manifest.additional_reserved: list[str]`
  later. Not in v2.0.

- **Event in-flight HUD badge (Phase 9 forward-compat)** —
  `EventCompletionTracker` registry exists in Phase 7 (D-C5) but is
  observational only. Phase 9 HUD MAY consume the registry to show
  "event playing" badges on the lock-aware param panel. Phase 7 just
  ensures the registry is queryable (`tracker.in_flight_set() ->
  set[hotkey_id]`). Not a Phase 7 deliverable; surfaced for Phase 9
  plan-time awareness.

- **Reserved-list manifest extension API (`api_version`-gated)** —
  if v3+ plugins emit non-bracket syntax (e.g., `@command`), the
  reserved list scope expands. Not relevant in v2.0; bumped via
  `api_version: "1.0"` (PLG-06 + ARCH-11) when needed.

### Reviewed Todos (not folded)

None — `todo match-phase 7` returned 0 matches.

</deferred>

---

*Phase: 07-three-category-code-parsing-dispatch*
*Context gathered: 2026-05-08*
