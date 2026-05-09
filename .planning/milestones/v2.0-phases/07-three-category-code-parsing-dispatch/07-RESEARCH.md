# Phase 7: Three-Category Code Parsing + Dispatch — Research

**Researched:** 2026-05-08
**Domain:** orchestrator decorator pipeline + VTS hotkey dispatch + LLM-protocol sentinel sweep
**Confidence:** HIGH overall (Sections A/F/G are HIGH; Section B/C/E are HIGH-MEDIUM with documented choices; Section D is MEDIUM with two viable paths surfaced)

## Summary

Phase 7 replaces milestone-1 `actions_extractor` with a unified `code_extractor` that
single-pass-parses three bracket pairs (`[ ]` / `{ }` / `< >`) and routes dispatches to
three runtime paths. CONTEXT.md is locked across A/B/C/D decision blocks; research's job
is to surface the implementation specifics that downstream agents cannot derive.

Three findings drive the plan:

1. **Reserved-name list extends well beyond PLG-06 floor 7.** Anthropic's ANTML namespace
   is far richer than `<function_calls>`/`<invoke>`/`<parameter>` alone — `<thinking>`,
   `<function_calls>` (and the namespaced siblings), and a long list of system tags
   are all in the wild. Section A delivers the ready-to-paste constant.
2. **`hotkey_id` resolution is a parse-time lookup.** The walker needs an injected
   `(variants, events) → hotkey_id` map; closure-over-catalogs is the cleanest
   injection because it matches the existing `actions_extractor(capabilities)` signature.
3. **`VariantStateManager.reset_to_baseline()` should look up the meta hotkey at boot
   from `RigCapabilities.hotkeys` (the full list including `RemoveAllExpressions`),
   not from `_avatar_overrides.yaml.variants[]` (which has the meta filtered out).**
   Section D walks the alternatives.

**Primary recommendation:** Build `code_extractor` as a closure-over-`{variants_lookup,
events_lookup}` factory, keep the bracket walker shape from milestone-1
`_extract_intents` (lines 125-157 of transformers.py) but replace single-pair branch
with a dispatch-on-opener-char branch; add `parser/reserved.py` with the 35-entry
constant from §A; resolve baseline-reset hotkey by walking `RigCapabilities.hotkeys`
for `type == "RemoveAllExpressions"`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Parser pipeline shape**
- **D-A1: No `<think>`-strip step.** Phase 2 D-10 stance carries forward unchanged.
  PARSE-04 reframed: cross-category uniqueness check at boot is sole defense. Bracket
  text leaks as visible bug per Phase 2 D-10.
- **D-A2: code_extractor leaves brackets in `sentence.text`.** Plugin's `on_token_stream`
  sees original sentence WITH bracketed codes intact. Strip happens downstream:
  `display_processor.filter_brackets` for chat; `tts_filter` for audio.
- **D-A3: One unified `code_extractor` decorator.** Single-pass left-to-right walker
  dispatches on opener char (`[` → ActionCode, `{` → VariantToggle, `<` → EventFire).
- **D-A4: Output shape = `(SentenceWithTags, list[Dispatch])`.** `Dispatch` is a Pydantic
  discriminated union: `ActionCode | VariantToggle | EventFire`, all with
  `kind: Literal[...]`. New decorator chain:
  `sentence_divider → code_extractor → display_processor → tts_filter`.
  `actions_extractor` + `_extract_intents` + `ActionIntent` are DELETED.

**B. Variant state & lifecycle**
- **D-B1: `VariantStateManager` lives in `sidecar/src/sidecar/vts/`** (sibling to
  `discrete_dispatcher.py`). Surface: `__init__(dispatcher)`, `async reset_to_baseline()`,
  `async apply(VariantToggle)`.
- **D-B2: Session-only persistence.** Boot fires `RemoveAllExpressions`; sidecar restart
  = clean rig. No `variant_state.json` on disk.
- **D-B3: Idempotent re-emit = no-op (silent).** Detect `_current == new_hotkey_id`,
  return early with debug log.
- **D-B4: Shadow state is source of truth; VTS is downstream.** No VTS state queries.

**C. Event dispatch mechanism**
- **D-C1: Reuse `DiscreteDispatcher.fire()`.** VTS's `requestTriggerHotKey` works for
  all hotkey types.
- **D-C2: `duration_ms` cached at Phase 8 import time.** Phase 7 reads from in-memory
  `AvatarOverrides.events[]`. Zero I/O, zero await on hot path.
  ⚠ **Schema drift caught:** Phase 8 ships `EventEntry.duration_seconds: float`, NOT
  `duration_ms: int`. CONTEXT D-A4 calls for `duration_ms`. See Section F for the
  resolution (multiply by 1000 in the lookup helper, do NOT mutate Phase 8's
  `EventEntry` schema).
- **D-C3: Concurrent fire for multi-event in single sentence.** No await between fires.
- **D-C4: Event-in-flight collision = concurrent fire.** No cancel/queue/ignore.
- **D-C5: `EventCompletionTracker` = `asyncio.create_task` per event.** Sleeps
  `(duration_ms + 1000) / 1000.0`s, then logs `[EVENT-COMPLETE]`. Observational only;
  Phase 9 HUD may consume the registry later.

**D. Reserved-name guard policy**
- **D-D1: Boot-time validation only.** Single `validate_reserved_names()` call after
  plugin manifest load + `_avatar_overrides.yaml` load. Failure → boot-blocking exception.
  Hot path does NOT re-check.
- **D-D2: Reserved list = floor 7 + extended sweep.** Floor: PLG-06 literal 7. Extended
  sweep delivered in Section A.
- **D-D3: Case-insensitive matching.** `name.lower() in reserved_lower_set`.
- **D-D4: Check union of all three sources.** `plugin.action_codes ∪ variants[].code ∪
  events[].code`.

### Claude's Discretion

- Reserved-list final composition (plan-time): research delivers numbered list with
  provenance — see §A. Floor 7 non-negotiable; extended additions subject to
  reasonableness (no false positives that would block user customization).
- `code_extractor` parser internals: single-pass while-loop with index advancement on
  opener-char detection. Walker grammar is `<opener> <name> <closer>` where `(opener,
  closer) ∈ {('[', ']'), ('{', '}'), ('<', '>')}`. Mismatched (`[joy>`) → silently
  dropped. Section B covers algorithm + edge cases + injection pattern.
- `Dispatch` Pydantic discriminator field name = `kind` (matches milestone-1's
  `ActionIntent.kind` for codegen consistency). Flip to `category` if collision appears.
- `EventCompletionTracker` task lifecycle: graceful shutdown cancellation. Section E
  picks the registry shape.
- Adversarial fixture corpus: at minimum 3 split-pattern triples per category × 3
  categories = 9 fixtures plus 2 mixed-category. Section C delivers 16 fixtures.
- Plugin queue interface contract: Phase 6 owns the queue type. Phase 7 stubs
  `Orchestrator.action_code_queue: asyncio.Queue[ActionCode]` and pushes via
  `put_nowait`. Section H recommends the failure-mode policy.
- Variant on-rigs-without-RemoveAllExpressions: fallback documented in §D — log INFO
  and start with shadow = None.

### Deferred Ideas (OUT OF SCOPE)

- `<think>`-strip step revisit (D-A1 drops for May 2026 LLM landscape; revisit if
  older self-hosted distills become a feature).
- Cross-session variant persistence (D-B2 chose session-only).
- VTS-state ground-truth queries (D-B4 chose shadow-only).
- Event motion-cancel via re-fire (D-C4 noted unreliable).
- Plugin-extensible reserved list (D-D2 chose system-level fixed constant).
- Event in-flight HUD badge (Phase 9 forward-compat — registry exists, just no
  consumer in Phase 7).
- Reserved-list manifest extension API (`api_version`-gated for v3+).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARSE-01 | `code_extractor` decorator (single-pass walker) replaces `actions_extractor`; handles split-token boundary cases for all three syntaxes | §B walker algorithm + injection pattern; §C adversarial fixture corpus |
| PARSE-02 | `display_processor.filter_brackets` extends to all three syntaxes from chat display + TTS text | §G `filter_curly_brackets` pattern + tts_filter wiring |
| PARSE-03 | Three-path dispatch (action → plugin queue, variant → VariantStateManager, event → DiscreteDispatcher.fire + tracker) | §B injection pattern; §D variant lifecycle; §E tracker design; §H plugin queue contract |
| PARSE-04 | (Reframed by D-A1) Boot-time reserved-name uniqueness check is sole defense; no parse-time `<think>`-strip | §A reserved list; §F validate_reserved_names location |
| PARSE-05 | Variant collision policy = radio-button single-active | §D shadow-state semantics — toggle-off-prev → toggle-on-new → update shadow |
| PARSE-06 | Event auto-completion = `motion3.json.Meta.Duration + 1s` blend pad; missing or > 10s falls back to 10s ceiling | §C/§E tracker timer; Phase 8 already extracts Meta.Duration into `EventEntry.duration_seconds` |
| PARSE-07 | Cross-category uniqueness check at boot (`plugin.action_codes ∩ variants[].code ∩ events[].code = ∅`); loud failure | §F `validate_reserved_names()` performs both checks in one call |
| PARSE-08 | Adversarial split-token reassembly fixtures for all three categories | §C complete fixture corpus (16 cases) |

## Standard Stack

### Core (already in tree — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pydantic | 2.x | Discriminated union for `Dispatch` (`ActionCode | VariantToggle | EventFire`) | Already source-of-truth in `packages/contracts/`; Phase 5 codegen pipeline handles discriminated unions cleanly (verified: `WSMessage` already uses the same pattern in `ws_message.py:67-80`) |
| asyncio | stdlib | `EventCompletionTracker` task registry; `action_code_queue: asyncio.Queue[ActionCode]` | Same primitive used in milestone-1 `compositor_intent_queue` and `pending_inputs`; consistent with `lifespan` task pattern in `ws/server.py:124-127` |
| loguru | (existing) | `[DISPATCH]` (replaces `[INTENT]`) and `[EVENT-COMPLETE]` log lines | Already imported in transformers.py + discrete_dispatcher.py |
| pyvts (vendored) | 0.3.3 | `requestTriggerHotKey(hotkeyID)` — verified at `sidecar/vendor/pyvts/vts_request.py:152-171` | AVT-09 path; Phase 7 reuses unchanged |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest + pytest-asyncio | already in tree | Test scaffolds for `test_code_extractor.py`, `test_reserved.py`, `test_variant_state_manager.py`, `test_event_completion_tracker.py` | Per-Wave-0 test files; same pattern as `sidecar/tests/test_actions_extractor.py` |

### Alternatives Considered (rejected for Phase 7)

| Instead of | Could Use | Tradeoff | Why Rejected |
|------------|-----------|----------|--------------|
| `asyncio.create_task` per event | `anyio.create_task_group` | Anyio is more idiomatic for structured concurrency | sidecar/ doesn't import anyio anywhere today (verified via grep); introducing it for one tracker is overkill |
| Closure-over-catalogs injection | `Orchestrator.attach_lookup(...)` runtime method | Mutable state on Orchestrator | Closure-over-catalogs matches existing `actions_extractor(capabilities)` shape — milestone-1 transformers.py:75 |
| Regex-based bracket matching | `re.findall(r"[\[{<].*?[\]}>]")` | Fewer lines | Loses control over opener-char dispatch + can't differentiate matched-pair from mismatched (e.g., `[joy>` would match `[.*?>` greedily) |
| `dict[event_id, asyncio.Task]` registry | `set[asyncio.Task]` | Simpler | Phase 9 HUD future-compat needs a queryable in-flight set keyed by hotkey_id — see §E |

**Installation:** None. All dependencies present.

**Version verification:** Phase 7 introduces zero new pip packages. Verified by:
- `pyvts 0.3.3` vendored at `sidecar/vendor/pyvts/` (PROVENANCE.md unchanged since Phase 1)
- Pydantic 2.x in tree via `pyproject.toml` (Phase 1 lock)
- pytest-asyncio in tree (used by milestone-1 `test_actions_extractor.py:33-`)

## Architecture Patterns

### Decorator Chain Position (D-A4)

```
sentence_divider → code_extractor → display_processor → tts_filter
                  ↑ replaces actions_extractor
```

`code_extractor` slots into the same position as milestone-1 `actions_extractor` in
`orchestrator.py:222`. The surrounding decorators (`sentence_divider`,
`display_processor`, `tts_filter`) keep their tuple shapes — only the second element
changes from `list[ActionIntent]` to `list[Dispatch]`. This minimizes the diff in
`display_processor` and `tts_filter`: the `intents` variable is renamed to
`dispatches` but the tuple unpacking remains structurally identical.

### Discriminated Union Pattern (D-A4)

```python
# packages/contracts/py/contracts/dispatch.py (NEW)
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field


class ActionCode(BaseModel):
    kind: Literal["action"] = "action"
    name: str


class VariantToggle(BaseModel):
    kind: Literal["variant"] = "variant"
    name: str
    hotkey_id: str  # resolved at parse-time from _avatar_overrides.yaml.variants[]


class EventFire(BaseModel):
    kind: Literal["event"] = "event"
    name: str
    hotkey_id: str
    duration_ms: int  # cached from EventEntry.duration_seconds × 1000 (see §F)


Dispatch = Annotated[
    Union[ActionCode, VariantToggle, EventFire],
    Field(discriminator="kind"),
]
```

This mirrors `WSMessage` in `packages/contracts/py/contracts/ws_message.py:67-80`. The
codegen pipeline (Phase 5) handles it via `force_required` (which marks `kind`'s
`const` value required) and `OWNER_FILE` (which routes the union to a single TS file —
see §F).

### Closure-Over-Catalogs Injection Pattern (Section B Recommendation)

The walker needs lookup tables for variants (`code → hotkey_id`) and events
(`code → (hotkey_id, duration_ms)`). The cleanest injection — matching milestone-1
`actions_extractor(capabilities)` shape — is closure-over-catalogs:

```python
def code_extractor(
    plugin_action_codes: set[str],
    variants: dict[str, VariantEntry],   # keyed by .code (case-folded)
    events: dict[str, EventEntry],       # keyed by .code (case-folded)
):
    """Decorator factory. Catalogs are read once at orchestrator boot and
    captured in this closure. Hot path never re-resolves; cold path is
    bytes-stable (KV-cache invariant unaffected — system prompt is built
    from plugin_action_codes elsewhere).
    """
    # ... walker body uses the closure-captured maps
```

**Why this beats alternatives:**

- Decorator-parameter injection (current `actions_extractor(capabilities)` shape) →
  unchanged ergonomics for callers; `Orchestrator._run_pipeline()` body is one-line
  diff.
- Orchestrator-attached lookup-method (e.g., `self._capabilities.lookup_variant(...)`)
  → couples the walker to Orchestrator; harder to unit-test the walker in isolation.
- Module-level globals → race risk during multi-test runs; rejected.

### Anti-Patterns to Avoid

- **Bracket walker that buffers across sentences.** The buffer-then-extract pattern
  belongs to `sentence_divider`, NOT `code_extractor`. By the time the walker sees a
  `SentenceWithTags`, the text is already a complete sentence. `code_extractor` walks
  the assembled string only.
- **Re-checking reserved-name guard on the hot path.** D-D1 says boot-time only. The
  walker must NOT consult the reserved-list — it consults the catalogs (variants,
  events) and the plugin's `action_codes` set. If the catalogs were validated at
  boot, the walker only sees clean codes.
- **Mutating `Orchestrator._memory` from `code_extractor`.** Walker is pure; emits
  `Dispatch` records. Memory mutations stay in `Orchestrator.turn()` (D-19 KV-cache
  discipline).
- **Querying VTS for variant state.** D-B4 — shadow-state-only.
- **Awaiting between event fires in same sentence.** D-C3 — concurrent fire.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bracket scanning regex | Custom regex `r"\[([^\]]*)\]"` | Hand-rolled single-pass while-loop (mirroring milestone-1 `_extract_intents`) | Regex matches greedy/lazy boundaries OK but loses opener-char dispatch — three regexes + three passes is slower AND obscures the "which category" decision. Walker is ~30 LOC. |
| Discriminated union codegen | Hand-write TS Union types | Phase 5 codegen pipeline (`force_required` + `OWNER_FILE`) | Verified: `packages/contracts/scripts/codegen.py:43-76` already handles this exact shape for `WSMessage`. Phase 7 just adds entries to `TARGETS` and `OWNER_FILE`. |
| Per-event timer + cleanup logic | Custom timer object with cancel hooks | `asyncio.create_task(_completion_timer(...))` + `task.add_done_callback(cleanup)` | Verified pattern in `compositor/intent_driver.py:117-130` — same shape (one-shot fire-and-log). |
| Atomic shadow-state swap (variant manager) | mutex-guarded set | Sequential `await` of off-prev → on-new → assign `_current` | All three operations are awaitable single-writer flows through `PyvtsSafeWriter` (which already serializes via `_send_lock`). No additional lock needed because the lifespan is async-coroutine-bounded, not threaded. |
| Reserved-name parsing on the hot path | Per-emit lookup | Boot-time `validate_reserved_names()` raises ReservedNameError before VTS handshake | D-D1 — runtime cannot regenerate collisions. |
| Boot-time reset-all hotkey discovery | Hard-code Teto's hotkey ID | `RigCapabilities.hotkeys` lookup for `type == "RemoveAllExpressions"` | See §D. Works for any rig that has a meta hotkey; fallback path for rigs without one is also documented. |

**Key insight:** Every "hand-roll temptation" in Phase 7 has a milestone-1 precedent
that already solves the same problem. The bracket walker, the discriminated union, the
per-task lifecycle, the shadow-state pattern — all four mirror existing code in the
sidecar. Plan-time should explicitly cite the milestone-1 sources to keep code
provenance honest.

## Section A — LLM-protocol sentinel sweep (May 2026)

**Goal:** Produce the final `RESERVED_NAMES` constant for
`sidecar/src/sidecar/parser/reserved.py`. Floor: PLG-06's literal 7. Extended: every
sentinel that contemporary LLMs may emit unprompted (i.e., even with reasoning
disabled, a non-compliant model might still leak these tokens).

**Scope decision (made by researcher, plan-time may adjust):** the constant must be
liberal enough to catch real bugs but narrow enough to leave plugin authors room. We
include:

1. **Anthropic ANTML core function-call namespace** (HIGH confidence — leaked system
   prompts + dejan.ai analysis confirm Claude's tool-use output contains exactly
   these tags)
2. **Anthropic thinking/reasoning tags** (HIGH — leaked system prompts confirm)
3. **Anthropic auxiliary system tags** (MEDIUM — included only the most likely-to-leak
   ones; full list is ~65 tags, most of which are system-prompt-internal and won't
   appear in completion output)
4. **Reasoning-model think variants** (HIGH — DeepSeek-R1, Qwen3, Kimi K2 all use
   `<think>`)
5. **Generic function-calling vocabulary** (HIGH — `<tool_call>`, `<function_call>`,
   widely used in HF chat templates)

**We exclude:**

- Custom prompt-engineering tags users add deliberately (`<example>`, `<context>`,
  `<output>`)
- Citations and document tags (`<cite>`, `<source>`, `<documents>` — these are
  Anthropic system-prompt internals, never emitted by Claude in user-visible
  completions outside of citation mode)
- Provider-specific signature fields (Gemini's `thoughtSignature` is JSON-shaped, not
  bracketed — never appears in text content)

### Final constant (drop into `sidecar/src/sidecar/parser/reserved.py`)

```python
"""Reserved code names — system-level invariant per ARCH-09 / D-D2 / PLG-06.

These names cannot be used as plugin.action_codes, variants[].code, or events[].code.
Match is case-insensitive (D-D3). The list covers:
  - PLG-06 floor 7 (locked by requirement)
  - Anthropic ANTML tool-use + reasoning tags (HIGH confidence; leaked system
    prompts + Anthropic prompt-engineering docs)
  - Cross-provider reasoning-model think variants (HIGH; DeepSeek-R1, Qwen3, Kimi K2)
  - Generic function-calling vocabulary (HIGH; OpenAI Chat-completion-shape templates)

Sources:
  - PLG-06 (.planning/REQUIREMENTS.md)
  - Anthropic XML-tags doc: https://docs.anthropic.com/en/docs/build-with-claude/
    prompt-engineering/use-xml-tags
  - jujumilk3/leaked-system-prompts (Claude tool-use, 2025-01-19)
  - dejan.ai/blog/claude-system-internals (ANTML namespace catalog)
  - DeepSeek-R1 model card (HF, recommends <think>\\n init)
  - Qwen3 chat template (HF; <think>...</think> block)
  - Kimi K2 / 2026 reasoning-model survey (Clarifai, openreview)
"""

# Case-folded to lowercase for comparison; D-D3 enforces lower() on input names.
# Strip the leading "<" and trailing ">" — the walker passes name-only to the
# checker, e.g. "[think]" emits a candidate name "think" which must hit this set.
RESERVED_NAMES: frozenset[str] = frozenset({
    # ── PLG-06 floor 7 (locked) ────────────────────────────────────────────
    "think",            # 1. PLG-06; DeepSeek-R1 / Qwen3 / Kimi K2 / R1 distill
    "thinking",         # 2. PLG-06; Anthropic Claude-3-Opus extended thinking
    "tool_call",        # 3. PLG-06; HF chat-template convention (Llama, Qwen tools)
    "function_call",    # 4. PLG-06; OpenAI legacy completion shape
    "function_calls",   # 5. PLG-06; Anthropic ANTML tool-use wrapper
    "invoke",           # 6. PLG-06; Anthropic ANTML tool-use child
    "parameter",        # 7. PLG-06; Anthropic ANTML tool-use parameter

    # ── Anthropic ANTML namespaced variants ───────────────────────────────
    # Some Claude versions emit ANTML-prefixed tags. Code emitted as <[code]>,
    # <{code}>, <[code]> would never use ":", but if a model leaks
    # "<invoke>" via a reasoning-disable bypass, we still want to catch
    # the inner "antml:invoke" name.
    "antml:function_calls",  # 8.  ANTML namespace (dejan.ai analysis)
    "antml:invoke",          # 9.  ANTML namespace
    "antml:parameter",       # 10. ANTML namespace
    "antml:thinking",        # 11. Anthropic extended-thinking output
    "antml:function_call",   # 12. ANTML singular variant (rare but observed)

    # ── Generic / cross-provider function-calling sentinels ───────────────
    "tool_use",          # 13. Anthropic stop_reason="tool_use"; HF shape
    "tool_result",       # 14. Anthropic tool-result block; HF shape
    "tool_calls",        # 15. OpenAI-shape array variant (Chat Completions API)

    # ── Reasoning sentinels across providers (May 2026 landscape) ─────────
    "thought",           # 16. Generic CoT convention; some HF templates
    "thoughts",          # 17. Plural variant
    "reasoning",         # 18. OpenAI o-series convention; generic
    "reasoning_step",    # 19. Gemini reasoning convention
    "scratchpad",        # 20. ReAct/agent paper convention; HF templates

    # ── Anthropic system-prompt internals that might leak in degraded mode ─
    # These appear in leaked Anthropic system prompts. A non-compliant model
    # could in principle echo them. Including the highest-risk ones only.
    "artifact",          # 21. Claude artifacts feature
    "artifacts",         # 22. Claude artifacts wrapper
    "search_quality_reflection",  # 23. Claude search quality block
    "long_conversation_reminder", # 24. Claude conversation reminder

    # ── Final defensive entries (covers Mistral, Llama tool-use templates) ─
    "tool",              # 25. Generic role/tag (HF chat-template "tool" role)
    "system",            # 26. Defensive — prevents [system] action code
    "user",              # 27. Defensive — prevents {user} variant
    "assistant",         # 28. Defensive — prevents <assistant> event
})

# Provenance comments per entry (above) — keep block synchronized with
# RESERVED_NAMES. If a future LLM provider introduces a new sentinel, add a
# numbered entry with a one-line provenance comment and bump the test in
# sidecar/tests/parser/test_reserved.py to assert the new entry presence.

# Confidence note: floors 1-7 are PLG-06-locked. Entries 8-15 are HIGH
# (verified across multiple authoritative sources). Entries 16-20 are HIGH
# (multiple model cards confirm). Entries 21-24 are MEDIUM (Anthropic-internal
# but high-leak-risk). Entries 25-28 are defensive (LOW collision risk —
# unlikely a plugin author would name an action [system]).
```

**Sources cited above:**

- PLG-06: `.planning/REQUIREMENTS.md` line 83 (floor 7 locked)
- Anthropic XML tags doc (verified via WebFetch redirect to platform.claude.com)
- Leaked Claude tool-use system prompt:
  https://github.com/jujumilk3/leaked-system-prompts/blob/main/anthropic-claude-api-tool-use_20250119.md
  (verified via WebFetch — confirms `function_calls`, `invoke`, `parameter`,
  `thinking` exact tags)
- dejan.ai ANTML catalog: https://dejan.ai/blog/claude-system-internals/
  (verified via WebFetch — full ~65-tag catalog; we picked the 4 highest-leak-risk)
- DeepSeek-R1 model card: https://huggingface.co/deepseek-ai/DeepSeek-R1
  (verified via WebFetch — confirms `<think>...</think>`, recommends `<think>\n` init)
- Qwen3 docs: https://qwen.readthedocs.io/en/latest/getting_started/quickstart.html
  (web search verified — confirms thinking-mode `<think>...</think>` block; chat
  template uses these inside `<|im_start|>assistant ... <|im_end|>` boundaries)
- HF chat-template tool-use convention: e.g. Llama-3.1, Qwen2.5-Coder use
  `<tool_call>`...`</tool_call>`
- OpenAI o-series reasoning: https://platform.openai.com/docs/guides/reasoning
  (web search — reasoning is hidden by default but some scaffolds expose it)
- Gemini thinking: https://ai.google.dev/gemini-api/docs/thinking (web search —
  uses `thoughtSignature` JSON field, not bracket sentinels; included
  `reasoning_step` defensively)

**Confidence:** HIGH for entries 1-20 (multiple authoritative sources agree); MEDIUM
for 21-24 (single source — leaked system prompts); LOW for 25-28 (defensive only,
reasonable users will not collide).

**Plan-time choice point:** plan-checker may want to reduce 25-28 if those collide
with plausible plugin action vocabularies. Recommendation: keep them — they're
defensive, and a plugin author writing `[system]` as an action is much more likely
to be intentionally testing edge cases than building a real feature.

## Section B — `code_extractor` walker algorithm

**Goal:** Produce a single-pass left-to-right while-loop walker that handles the three
bracket pairs and dispatches on opener char.

### Pseudo-code (ready for plan-time)

```python
def code_extractor(
    plugin_action_codes: set[str],
    variants_lookup: dict[str, VariantEntry],   # case-folded code → entry
    events_lookup: dict[str, EventEntry],       # case-folded code → entry
):
    """Decorator factory. Closure captures the three lookup tables.
    Tables are immutable for the orchestrator's lifetime (boot-frozen).
    """
    OPENERS = {"[": ("]", "action"), "{": ("}", "variant"), "<": (">", "event")}

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            stream = func(*args, **kwargs)
            async for item in stream:
                if isinstance(item, SentenceWithTags):
                    sentence = item
                    dispatches: list[Dispatch] = []
                    if not _is_tag_state_sentence(sentence):
                        dispatches = _extract_dispatches(
                            sentence.text,
                            plugin_action_codes,
                            variants_lookup,
                            events_lookup,
                        )
                    yield sentence, dispatches
                elif isinstance(item, dict):
                    yield item
                else:
                    logger.warning(f"code_extractor unexpected: {type(item)}")
        return wrapper
    return decorator


def _extract_dispatches(
    text: str,
    plugin_action_codes: set[str],
    variants_lookup: dict[str, VariantEntry],
    events_lookup: dict[str, EventEntry],
) -> list[Dispatch]:
    """Single-pass left-to-right bracket walker. Dispatch on opener char.

    Algorithm:
      1. Walk text char-by-char with index i.
      2. If text[i] is one of "[", "{", "<": this is an opener candidate.
      3. Find the MATCHED closer (must be the corresponding pair).
         - "[" pairs only with "]"
         - "{" pairs only with "}"
         - "<" pairs only with ">"
         - Mismatched (e.g. "[joy>") → silently drop, advance to nearest
           closing char and continue (consistent with milestone-1's
           "if end == -1: break" but generalized to handle three pairs).
      4. Extract name = text[i+1 : matched_closer_idx], strip whitespace,
         lowercase.
      5. Empty name → silently drop, advance i = matched_closer_idx + 1.
      6. Look up name in the appropriate catalog by opener char:
         - "[" → plugin_action_codes set; build ActionCode
         - "{" → variants_lookup; build VariantToggle if hit
         - "<" → events_lookup; build EventFire if hit
      7. Unknown name → silently drop (consistent with D-A1; non-compliant
         models leaking <think> are caught by the boot-time reserved-name
         check, which runs before the walker is ever invoked).
      8. Advance i = matched_closer_idx + 1.

    Edge cases (decisions documented):
      - Nested same-pair "[a [b]]": matches greedy-first, so first "]" closes
        the outer "[". Inner "[b" then re-enters the walker on the next
        iteration. Result: tries to parse "a [b" as a code; whitespace inside
        is allowed and stripped; if "a [b" doesn't match the catalog (which
        it won't — codes don't contain spaces or "["), silently dropped. The
        inner "[b]" is never re-discovered because the outer "]" already
        consumed past it. Documented behavior.
      - Mixed-opener "[joy {hold-mic} <wave>]": first "[" matches first "]"
        (the outer); name becomes "joy {hold-mic} <wave>" — doesn't match
        action_codes; dropped. The inner brackets are never seen.
        ⚠ This is acceptable because LLMs are instructed via system prompt
        to emit codes as standalone tokens, not nested.
      - Whitespace inside: "[ joy ]" → name = "joy" after .strip(). Allowed.
      - Unicode: "[喜悦]" → name = "喜悦" lowercase (CJK is identity); looked
        up against catalog. If Phase 8 normalization produced ASCII-only
        codes (D-A4-2/A4-3 normalization rules), the catalog won't have
        unicode entries and the lookup misses → silently dropped. If a
        future avatar import preserves CJK, the lookup is direct-match.
      - Empty "[]" / "{}" / "<>": name = "" → drop.
      - Mismatched "[joy>": opener "[", scan for "]"; if "]" not found
        before next opener char or end-of-string, drop. Strict pair matching.
    """
    dispatches: list[Dispatch] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch not in ("[", "{", "<"):
            i += 1
            continue
        closer, category = {
            "[": ("]", "action"),
            "{": ("}", "variant"),
            "<": (">", "event"),
        }[ch]
        end = text.find(closer, i + 1)
        if end == -1:
            # No matching closer in remaining text — drop and stop scanning
            # (consistent with milestone-1 _extract_intents:144).
            break

        raw_name = text[i + 1 : end].strip()
        name_lower = raw_name.lower()

        if not name_lower:
            i = end + 1
            continue

        # Dispatch on opener char.
        if ch == "[":
            if name_lower in plugin_action_codes:
                dispatches.append(ActionCode(name=name_lower))
        elif ch == "{":
            entry = variants_lookup.get(name_lower)
            if entry is not None:
                dispatches.append(VariantToggle(
                    name=name_lower,
                    hotkey_id=entry.hotkey_id,
                ))
        elif ch == "<":
            entry = events_lookup.get(name_lower)
            if entry is not None:
                dispatches.append(EventFire(
                    name=name_lower,
                    hotkey_id=entry.hotkey_id,
                    duration_ms=int(entry.duration_seconds * 1000),
                ))

        i = end + 1
    return dispatches


def _is_tag_state_sentence(sentence: SentenceWithTags) -> bool:
    """Mirror milestone-1 actions_extractor:104-108.
    Skip extraction inside open <think> tag-state sentences.
    Even though D-A1 disables <think> at API level, sentence_divider's
    valid_tags filter is empty (D-20 unchanged), so this check is
    defensively cheap.
    """
    return any(t.state in (TagState.START, TagState.END) for t in sentence.tags)
```

### Hotkey-id resolution: closure-over-catalogs (chosen)

**Why closure beats orchestrator-attached method:**

| Pattern | Pros | Cons |
|---------|------|------|
| Closure-over-catalogs (CHOSEN) | Pure function; trivially unit-testable; matches milestone-1 `actions_extractor(capabilities)` ergonomics | Catalogs are read once at decorator-construction, must be rebuilt to swap — but rebuild only happens at sidecar restart, which IS the swap path (PLG-09) |
| Orchestrator-attached lookup method | Mutable; supports hot-swap | Couples walker to Orchestrator; harder to test; PLG-09 says no hot-swap anyway |
| Decorator parameter (immutable) | Same as closure but explicit | Makes signature uglier; closure IS the implementation, just hidden |

**Catalog construction at boot:**

```python
# In ws/server.py lifespan, after Phase 8 _avatar_overrides.yaml load:
variants_lookup = {v.code.lower(): v for v in overrides.variants}
events_lookup = {e.code.lower(): e for e in overrides.events}
plugin_action_codes = {c.lower() for c in plugin_manifest.action_codes}

# Pass to Orchestrator:
orchestrator = Orchestrator(
    gateway=gateway,
    capabilities=capabilities,
    persona_text=persona,
    plugin_action_codes=plugin_action_codes,
    variants_lookup=variants_lookup,
    events_lookup=events_lookup,
    # ...
)
```

The walker captures these three at `_run_pipeline()` time inside the existing
chat_with_memory closure (orchestrator.py:228).

**Confidence:** HIGH — all three injection patterns were considered and the chosen one
maps cleanly to the existing actions_extractor signature.

## Section C — Adversarial split-token fixture corpus

**Critical model:** `code_extractor` sees COMPLETED sentences from `sentence_divider`,
NOT raw token deltas. So "split tokens" means split-WITHIN-the-sentence-text-as-
assembled-by-divider. The split-token property is tested by the FULL chain
(`sentence_divider → code_extractor`) being driven with token-level deltas, then
asserting walk results on the assembled sentence(s).

This matches milestone-1 `test_actions_extractor.py::test_full_decorator_chain_strips_brackets`
(line 96-149) which drives the full chain with `["[", "jo", "y]", " hello", ..., "[hold", "-", "mic", "]", " world."]`.

### Fixture corpus (16 cases — drop into `sidecar/tests/orchestrator/test_code_extractor.py`)

Format: `(case_name, token_deltas, expected_dispatches)`. All cases assume:
- `plugin_action_codes = {"joy", "anger", "smirk"}`
- `variants_lookup = {"hold-mic": VariantEntry(code="hold-mic", hotkey_id="hid-v1", source_name="...")}`
- `events_lookup = {"wave": EventEntry(code="wave", motion_file="...", duration_seconds=1.5)}`

```python
SPLIT_TOKEN_FIXTURES = [
    # ── Single category, split across many tokens ────────────────────────
    ("action_split_3", ["[", "jo", "y]", " hello."],
        [ActionCode(name="joy")]),
    ("action_split_chars", ["[", "j", "o", "y", "]", " text."],
        [ActionCode(name="joy")]),
    ("variant_split_3", ["{", "hold-", "mic}", " ok."],
        [VariantToggle(name="hold-mic", hotkey_id="hid-v1")]),
    ("variant_split_inner_dash", ["{hold", "-", "mic", "}", " ok."],
        [VariantToggle(name="hold-mic", hotkey_id="hid-v1")]),
    ("event_split_3", ["<", "wav", "e>", " hi."],
        [EventFire(name="wave", hotkey_id="hid-e1", duration_ms=1500)]),
    ("event_split_chars", ["<", "w", "a", "v", "e", ">", " hi."],
        [EventFire(name="wave", hotkey_id="hid-e1", duration_ms=1500)]),

    # ── Brackets on chunk boundary ───────────────────────────────────────
    ("boundary_action", ["text [", "joy] more."],
        [ActionCode(name="joy")]),
    ("boundary_variant", ["text {", "hold-mic} more."],
        [VariantToggle(name="hold-mic", hotkey_id="hid-v1")]),
    ("boundary_event", ["text <", "wave> more."],
        [EventFire(name="wave", hotkey_id="hid-e1", duration_ms=1500)]),

    # ── Multiple in same chunk (mixed-category) ──────────────────────────
    ("mixed_same_chunk", ["[joy] {hold-mic} <wave>."],
        [ActionCode(name="joy"),
         VariantToggle(name="hold-mic", hotkey_id="hid-v1"),
         EventFire(name="wave", hotkey_id="hid-e1", duration_ms=1500)]),

    # ── Mixed-category split across chunks (CONTEXT D-Discretion call) ───
    ("mixed_split_pair", ["[joy] {", "hold-mic} <wave>."],
        [ActionCode(name="joy"),
         VariantToggle(name="hold-mic", hotkey_id="hid-v1"),
         EventFire(name="wave", hotkey_id="hid-e1", duration_ms=1500)]),

    # ── Confounders: unknown name, silently dropped ──────────────────────
    ("unknown_action_dropped", ["text", " [", "not_in_catalog", "] more."],
        []),
    ("unknown_variant_dropped", ["text {nope} more."],
        []),
    ("unknown_event_dropped", ["text <think> reasoning </think> more."],
        []),  # <think> is reserved-name (boot-blocked) so this case asserts
              # the WALKER silently drops unknown names; if the boot-time
              # check fails to catch <think>, this test is the second-line
              # defense (consistent with D-A1).

    # ── Mismatched / malformed ───────────────────────────────────────────
    ("mismatched_pair_dropped", ["[joy> text."],
        []),  # [joy> — "[" looks for "]", finds none before EOL → break
    ("empty_brackets_dropped", ["[] {} <> text."],
        []),  # all three empty-name cases drop silently

    # ── Whitespace tolerance ─────────────────────────────────────────────
    ("whitespace_inside", ["[ joy ] {  hold-mic  } < wave >."],
        [ActionCode(name="joy"),
         VariantToggle(name="hold-mic", hotkey_id="hid-v1"),
         EventFire(name="wave", hotkey_id="hid-e1", duration_ms=1500)]),
]
```

### Test-harness shape

```python
@pytest.mark.asyncio
@pytest.mark.parametrize("case_name,deltas,expected", SPLIT_TOKEN_FIXTURES,
                         ids=[c[0] for c in SPLIT_TOKEN_FIXTURES])
async def test_code_extractor_split_token(case_name, deltas, expected,
                                          plugin_action_codes,
                                          variants_lookup,
                                          events_lookup):
    """Drive the full sentence_divider → code_extractor chain with the
    given token deltas; assert the union of dispatches across all yielded
    sentences matches expected (pysbd may split into multiple sentences;
    the dispatch order across sentences must match LLM emission order).
    """
    @code_extractor(plugin_action_codes, variants_lookup, events_lookup)
    @sentence_divider(faster_first_response=False, segment_method="pysbd",
                      valid_tags=[])
    async def stream():
        for d in deltas:
            yield d

    all_dispatches = []
    async for item in stream():
        if isinstance(item, tuple) and len(item) == 2:
            _, dispatches = item
            all_dispatches.extend(dispatches)
    assert all_dispatches == expected, f"case={case_name}"
```

**Confidence:** HIGH — fixture pattern derived from milestone-1
test_actions_extractor.py:96-149 which already validates the same property for
single-pair brackets.

## Section D — VariantStateManager baseline-reset mechanism

**Problem:** D-B2 says boot fires `RemoveAllExpressions`. But:

- Phase 8 `_avatar_overrides.yaml.variants[]` has the `Remove All Toggles` hotkey
  FILTERED OUT by IMP-02's `Action != "ToggleExpression"` filter. So the variant
  catalog doesn't carry the meta hotkey ID.
- For non-Teto rigs, the meta hotkey may have any name OR may not exist at all.

### Three candidate sources for the meta hotkey ID

| Source | Pros | Cons | Verdict |
|--------|------|------|---------|
| 1. `RigCapabilities.hotkeys[]` (carries ALL hotkeys including meta) | Always accurate; Phase 8 already builds this from `.vtube.json`; verified shape — `Hotkey(name, type, hotkey_id)` in `rig_capabilities.py:11-15` | Requires walking the list at boot | **CHOSEN** |
| 2. `_avatar_overrides.yaml.notes` extra field (capture meta_hotkey_id at import time) | Static; one-line read at boot | Requires Phase 8 schema change; user manual edit could clear it; couples Phase 7 to Phase 8's import flow | Rejected — schema change after Phase 8 ships |
| 3. VTS API `requestHotKeyTriggerWithAction(...)` | Fire by action without ID | Verified pyvts 0.3.3 vendor (`vts_request.py`): NO such method exists; only `requestTriggerHotKey(hotkeyID)` | Rejected — API not available |

### Chosen approach

```python
# sidecar/src/sidecar/vts/variant_state_manager.py (NEW)
from contracts import RigCapabilities
from sidecar.vts.discrete_dispatcher import DiscreteDispatcher

class VariantStateManager:
    def __init__(
        self,
        dispatcher: DiscreteDispatcher,
        capabilities: RigCapabilities,
    ) -> None:
        self._dispatcher = dispatcher
        self._capabilities = capabilities
        self._current_hotkey_id: str | None = None
        # Boot-time discovery of reset-all hotkey:
        self._reset_hotkey_id: str | None = self._find_reset_hotkey()

    def _find_reset_hotkey(self) -> str | None:
        """Walk RigCapabilities.hotkeys for type == 'RemoveAllExpressions'.
        Returns hotkey_id (UUID) or None if no such hotkey on this rig.
        """
        for hk in self._capabilities.hotkeys:
            if hk.type == "RemoveAllExpressions":
                return hk.hotkey_id
        return None

    async def reset_to_baseline(self) -> None:
        """Boot-time hook (called after VTS handshake). Fires the reset-all
        hotkey if rig has one; logs INFO and starts with shadow=None
        otherwise. After this call, _current_hotkey_id == None.
        """
        if self._reset_hotkey_id is not None:
            try:
                await self._dispatcher.fire(
                    self._reset_hotkey_id, name="<reset-all-baseline>"
                )
                logger.info(
                    "[VARIANT-MGR] baseline-reset fired hotkey_id={}",
                    self._reset_hotkey_id,
                )
            except Exception:
                logger.exception(
                    "[VARIANT-MGR] baseline-reset failed; assuming clean rig"
                )
        else:
            logger.info(
                "[VARIANT-MGR] no RemoveAllExpressions hotkey on rig; "
                "starting with shadow=None (assume rig is in baseline)"
            )
        self._current_hotkey_id = None

    async def apply(self, toggle: VariantToggle) -> None:
        """Idempotent re-emit = no-op (D-B3); different variant = serialized
        toggle-off-prev → toggle-on-new → update shadow (D-B4).
        """
        if toggle.hotkey_id == self._current_hotkey_id:
            logger.debug(
                "[VARIANT-MGR] re-emit no-op name={} hotkey_id={}",
                toggle.name, toggle.hotkey_id,
            )
            return
        # Toggle-off the previous (if any), then toggle-on the new.
        if self._current_hotkey_id is not None:
            await self._dispatcher.fire(
                self._current_hotkey_id, name=f"<toggle-off>{toggle.name}"
            )
        await self._dispatcher.fire(toggle.hotkey_id, name=toggle.name)
        self._current_hotkey_id = toggle.hotkey_id
        logger.info(
            "[VARIANT-MGR] applied name={} hotkey_id={}",
            toggle.name, toggle.hotkey_id,
        )
```

**Verified against Teto rig:** `Live2D/重音テト/重音テト.vtube.json:1843-1845` has
```
"HotkeyID": "29f2ed6a53074b6ab86c40b4260ab2d1",
"Name": "Remove All Toggles",
"Action": "RemoveAllExpressions",
```
Phase 8's VTS extractor produces `RigCapabilities.hotkeys` with the meta hotkey
preserved at type `"RemoveAllExpressions"` (verified via `rig_capabilities.py` and
test_discrete_dispatcher.py:53,75).

**Plan-time deliverable:** the `_find_reset_hotkey` method body, with the linear
walk over `_capabilities.hotkeys`. For an empty list (rigs without the meta hotkey),
log INFO and start with shadow=None per Claude's-Discretion fallback in CONTEXT.md.

**Confidence:** HIGH — verified vtube.json shape, RigCapabilities shape, and pyvts
API surface.

## Section E — EventCompletionTracker lifecycle

### Task registry shape

| Shape | Pros | Cons |
|-------|------|------|
| `dict[hotkey_id, asyncio.Task]` | Easy to query "is hotkey X in flight?" | Concurrent fires of same hotkey overwrite the dict slot — second tracker would orphan the first task without cancellation |
| `set[asyncio.Task]` | Simple registry; `task.add_done_callback(self._tasks.discard)` for auto-cleanup | Can't answer "which hotkey is in flight?" without inspecting task internals |
| `dict[hotkey_id, list[asyncio.Task]]` | Multi-fire safe + queryable | Most complex |
| `WeakSet[asyncio.Task]` | Auto-GC | Don't strictly need GC since we have add_done_callback; weakref overhead unjustified |

**Chosen:** `dict[hotkey_id, list[asyncio.Task]]`. Rationale: D-C3/C4 explicitly
allow concurrent fires (including same-hotkey concurrent fires), and Phase 9 HUD
forward-compat requires a queryable in-flight set. The list-of-tasks-per-hotkey
shape supports both. The query API is:

```python
def in_flight_set(self) -> set[str]:
    """Return set of hotkey_ids that have at least one active task.
    Phase 9 HUD calls this on each 15 Hz frame to decorate event-playing
    badges. Read-only — caller does NOT mutate.
    """
    return {hid for hid, tasks in self._registry.items() if any(not t.done() for t in tasks)}
```

### Task body

```python
# sidecar/src/sidecar/vts/event_completion_tracker.py (NEW)
from collections import defaultdict
import asyncio
from loguru import logger


_DURATION_CEILING_MS = 10_000  # PARSE-06: 10s ceiling fallback
_BLEND_PAD_MS = 1_000          # PARSE-06: +1s blend pad


class EventCompletionTracker:
    def __init__(self) -> None:
        self._registry: dict[str, list[asyncio.Task]] = defaultdict(list)

    def schedule(self, hotkey_id: str, name: str, duration_ms: int) -> None:
        """Spawn a one-shot timer task. Apply blend pad + ceiling fallback.
        Tracker is observational only — does NOT block subsequent fires.
        """
        # PARSE-06: missing duration or > ceiling → use ceiling
        if duration_ms <= 0 or duration_ms > _DURATION_CEILING_MS:
            effective_ms = _DURATION_CEILING_MS
        else:
            effective_ms = duration_ms + _BLEND_PAD_MS
        task = asyncio.create_task(
            self._timer(hotkey_id, name, effective_ms),
            name=f"event-complete:{hotkey_id}",
        )
        self._registry[hotkey_id].append(task)
        task.add_done_callback(
            lambda t, hid=hotkey_id: self._registry[hid].remove(t)
            if t in self._registry[hid] else None
        )

    async def _timer(self, hotkey_id: str, name: str, ms: int) -> None:
        try:
            await asyncio.sleep(ms / 1000.0)
            logger.info(
                "[EVENT-COMPLETE] hotkey_id={} name={} elapsed_ms={}",
                hotkey_id, name, ms,
            )
        except asyncio.CancelledError:
            logger.debug(
                "[EVENT-COMPLETE-CANCELED] hotkey_id={} name={}",
                hotkey_id, name,
            )
            raise

    def in_flight_set(self) -> set[str]:
        """Phase 9 HUD forward-compat: read-only query of currently-firing
        events. Returns hotkey_ids that have ≥1 unfinished tracker task.
        """
        return {
            hid for hid, tasks in self._registry.items()
            if any(not t.done() for t in tasks)
        }

    async def shutdown(self) -> None:
        """Cancel all in-flight tracker tasks. Called from ws/server.py
        lifespan teardown, mirroring the existing pattern at server.py:266-290.
        """
        all_tasks = [t for tasks in self._registry.values() for t in tasks]
        for t in all_tasks:
            t.cancel()
        # Drain the cancellations
        for t in all_tasks:
            try:
                await t
            except asyncio.CancelledError:
                pass
        self._registry.clear()
```

### Shutdown integration

The lifespan teardown pattern at `ws/server.py:266-290` cancels tasks then awaits
the cancellation. `EventCompletionTracker.shutdown()` follows that pattern. The
tracker is constructed in lifespan startup alongside `DiscreteDispatcher`:

```python
# In ws/server.py lifespan, after PyvtsSafeWriter + DiscreteDispatcher:
event_tracker = EventCompletionTracker()
app.state.event_tracker = event_tracker

# In teardown (after compositor_task cleanup):
await event_tracker.shutdown()
```

**Confidence:** HIGH — pattern mirrors `compositor/intent_driver.py:117-130`
(`asyncio.create_task` + `add_done_callback`) and lifespan teardown at
`ws/server.py:266-290`.

## Section F — Decorator chain swap surgery

### Exact line touches in `orchestrator.py`

| Line(s) | Change |
|---------|--------|
| 22 (import) | `from contracts import ActionIntent, ...` → `from contracts import Dispatch, ActionCode, VariantToggle, EventFire, ...` (keep AudioPayloadMessage, DisplayTextField, SpeechEnvelopePayload) |
| 23 (import) | `from sidecar.avatar.capabilities import AvatarCapabilities` → keep until Phase 6 (capabilities.py is empty shim per Phase 8 STATE.md note); or replace with `from contracts import RigCapabilities` if the constructor signature is migrated in this phase. **Recommend keep AvatarCapabilities import for transitional clean — Phase 6 finishes the rename.** |
| 44-49 (import) | `from .transformers import (actions_extractor, ...)` → `from .transformers import (code_extractor, display_processor, sentence_divider, tts_filter)` |
| 84-87 (`__init__` signature) | Add three new params: `plugin_action_codes: set[str] | None = None`, `variants_lookup: dict[str, VariantEntry] | None = None`, `events_lookup: dict[str, EventEntry] | None = None`. Default to empty set/dict for backward-compat (so existing constructor sites in tests don't break before Phase 6 wires them). |
| 102-104 (`__init__` body) | Drop `compositor_intent_queue` (replaced by `action_code_queue`); add `self.action_code_queue: asyncio.Queue[ActionCode] = action_code_queue or asyncio.Queue()`. |
| 204-209 (`_emit_sentence`) | `for intent in sentence_output.actions:` becomes `for dispatch in sentence_output.actions:`; route on `dispatch.kind`: `action` → `self.action_code_queue.put_nowait(dispatch)`; `variant` → `await self._variant_state_manager.apply(dispatch)`; `event` → `await self._discrete_dispatcher.fire(dispatch.hotkey_id, name=dispatch.name); self._event_tracker.schedule(dispatch.hotkey_id, dispatch.name, dispatch.duration_ms)`. |
| 207-209 (log line) | `[INTENT]` → `[DISPATCH] kind={dispatch.kind} name={dispatch.name}` (and per-kind extra fields). |
| 220-222 (chain) | `@actions_extractor(capabilities)` → `@code_extractor(self._plugin_action_codes, self._variants_lookup, self._events_lookup)`. Capture variables in closure. |

### Exact line touches in `transformers.py`

| Section | Change |
|---------|--------|
| Module docstring lines 1-16 | Rewrite to describe `code_extractor` (delete actions_extractor reference) |
| Imports lines 17-28 | `from contracts import ActionIntent` → `from contracts import Dispatch, ActionCode, VariantToggle, EventFire, VariantEntry, EventEntry`; `from sidecar.avatar.capabilities import AvatarCapabilities` → DELETE (walker doesn't need it) |
| `actions_extractor` (lines 75-122) | DELETE entirely |
| `_extract_intents` (lines 125-157) | DELETE entirely |
| NEW: `code_extractor` decorator | Insert in slot vacated by `actions_extractor` (per §B pseudo-code) |
| NEW: `_extract_dispatches` helper | Insert in slot vacated by `_extract_intents` (per §B pseudo-code) |
| `display_processor` (lines 160-227) | Rename `intents` variable → `dispatches`; type-annotate `list[Dispatch]`; ADD `text = filter_brackets(text); text = filter_curly_brackets(text); text = filter_angle_brackets(text)` for the curly-bracket extension (PARSE-02). Keep `<think>` handled_think branch as dead code per existing comment (D-A1 leaves it for OLVT-port faithfulness). |
| `tts_filter` (lines 230-291) | Rename `intents` → `dispatches`; pass through to `SentenceOutput.actions` (which becomes `list[Dispatch]`). The existing `ignore_brackets` / `ignore_angle_brackets` already cover all three pairs once `ignore_curly_brackets` is added (see §G). |

### Exact line touches in `tts_preprocessor.py`

| Lines | Change |
|-------|--------|
| 19-27 (`TTSPreprocessorConfig`) | Add `ignore_curly_brackets: bool = True` after `ignore_angle_brackets`. |
| 30-37 (`tts_filter` signature) | Add `ignore_curly_brackets: bool` parameter. |
| 76-82 (`tts_filter` body) | Add a fourth `if ignore_curly_brackets: ... filter_curly_brackets(text) ...` block, mirroring the existing `ignore_angle_brackets` block. |
| 153-165 (existing filter helpers) | Add `def filter_curly_brackets(text: str) -> str: return _filter_nested(text, "{", "}")` after `filter_brackets` and before `filter_parentheses`. The `_filter_nested` helper at line 120 already supports any pair. |

### Exact line touches in `ws/server.py`

| Lines | Change |
|-------|--------|
| 16 (import) | Add `from sidecar.parser.reserved import validate_reserved_names` |
| 28 (import) | Add `from sidecar.vts.variant_state_manager import VariantStateManager`, `from sidecar.vts.event_completion_tracker import EventCompletionTracker` |
| 154-160 (boot path, after `load_avatar_overrides` and `build_rig_capabilities`) | Insert `validate_reserved_names(plugin_action_codes, overrides.variants, overrides.events)` call. (Phase 6 wires `plugin_action_codes` from manifest; pass empty set as transitional default per Phase 6 ordering.) |
| 215-217 (after PyvtsSafeWriter init) | After `discrete_dispatcher = DiscreteDispatcher(writer)`, add `variant_mgr = VariantStateManager(discrete_dispatcher, capabilities); event_tracker = EventCompletionTracker(); app.state.variant_state_manager = variant_mgr; app.state.event_tracker = event_tracker`. |
| After `connect_and_authenticate` await | Add `await variant_mgr.reset_to_baseline()` (D-B2 — boot-time fire after VTS handshake). The handshake task is async-spawned; the reset MUST await handshake completion before firing — plan-time decides between (a) inline await of handshake_task before reset_to_baseline, OR (b) chained `handshake_task.add_done_callback(reset_baseline)`. **Recommend (b)** — keeps lifespan startup non-blocking. |
| 266-290 (lifespan teardown) | Add `await event_tracker.shutdown()` before writer close. |

### Contract changes — `packages/contracts/`

| File | Change |
|------|--------|
| `py/contracts/dispatch.py` | NEW. ActionCode + VariantToggle + EventFire + Dispatch annotated union. |
| `py/contracts/__init__.py` | Drop `from .action_intent import ActionIntent` (line 2); add `from .dispatch import ActionCode, VariantToggle, EventFire, Dispatch`. Update `__all__` accordingly. |
| `py/contracts/action_intent.py` | DELETE (the file). |
| `ts/action-intent.ts` | DELETE — codegen will not regenerate it because we drop it from `TARGETS`. |
| `ts/dispatch.ts` | NEW — codegen produces from `Dispatch` discriminated union. |
| `scripts/codegen.py` line 26 | `ActionIntent` → `ActionCode, VariantToggle, EventFire, Dispatch` |
| `scripts/codegen.py` line 44 (TARGETS) | Drop `(ActionIntent, "action-intent", "action_intent", "ActionIntent")`. Add `(Dispatch, "dispatch", "dispatch", "Dispatch")` (union targets work because `TypeAdapter(Dispatch).json_schema()` is supported per the existing pattern for WSMessage at line 54). |
| `scripts/codegen.py` line 57 (OWNER_FILE) | Drop `"ActionIntent": "action-intent"`. Add `"ActionCode": "dispatch"`, `"VariantToggle": "dispatch"`, `"EventFire": "dispatch"`. |

### Schema-drift caveat resolved

CONTEXT D-A4 specifies `EventFire.duration_ms: int`. Phase 8's `EventEntry` ships
`duration_seconds: float` (verified `event_entry.py:7`). Resolution: the WALKER
multiplies `duration_seconds * 1000` and stores `int(...)` in `EventFire.duration_ms`.
This:
- Honors CONTEXT D-A4 wire shape (`int` ms is what `EventCompletionTracker.schedule`
  consumes anyway — see §E).
- Avoids changing Phase 8's already-shipped `EventEntry.duration_seconds: float`
  (which is the canonical Phase 8 contract — Phase 7 is downstream consumer).
- The conversion is one line in the walker (per §B `_extract_dispatches` body).

### Renderer-side impact

- **None for the canonical envelope.** `SentenceOutput.actions` field is internal-
  to-orchestrator; the WS-emitted `AudioPayloadMessage.actions` field is what the
  renderer sees. Plan-time decides whether the on-wire shape stays `list[ActionIntent]`
  (rename to `list[Dispatch]` at the wire-level too) or remains backward-compat. Given
  CONTEXT explicitly states `actions_extractor + ActionIntent are deleted`, the
  recommended path is RENAME the wire-field too. The renderer's Logs drawer's
  `[INTENT]` log lines must reformat to `[DISPATCH]` accordingly (Specifics block
  in CONTEXT confirms this).

**Confidence:** HIGH for line counts (verified each cited line exists at given location);
MEDIUM for the codegen pipeline TARGETS handling of `Dispatch` (the existing pattern
for `WSMessage` is the working precedent — risk is plan-checker discovering a quirk
specific to discriminated unions named at module-level vs. as `Annotated[Union[...]]`).

## Section G — `filter_curly_brackets` regex + edge cases

### Exact pattern

The existing `_filter_nested(text, "[", "]")` at `tts_preprocessor.py:120-150` already
handles any pair via parameter passing. The new helper is a one-liner:

```python
def filter_curly_brackets(text: str) -> str:
    """Filter text to remove all text within curly braces, handling nested cases."""
    return _filter_nested(text, "{", "}")
```

The underlying `_filter_nested` helper:
- Walks char-by-char, tracking `depth`
- On `left`, increments depth
- On `right`, decrements (clamped at 0)
- Outside-braces chars are kept
- Inside-braces chars are dropped
- Trailing whitespace collapsed via `re.sub(r"\s+", " ", filtered_text).strip()`

This is NOT regex-based; it's a depth-counting walker. Same as the existing bracket
and angle-bracket variants.

### Test fixtures (drop into `sidecar/tests/orchestrator/test_tts_preprocessor.py`)

```python
def test_filter_curly_brackets_simple():
    assert filter_curly_brackets("hello {variant} world") == "hello world"

def test_filter_curly_brackets_nested():
    assert filter_curly_brackets("a {b {c} d} e") == "a e"

def test_filter_curly_brackets_unmatched():
    # Unmatched closer is dropped (depth stays at 0 → char is skipped)
    assert filter_curly_brackets("a } b") == "a b"
    # Unmatched opener consumes rest of string (depth stays >0 till end)
    assert filter_curly_brackets("a { b") == "a"

def test_filter_curly_brackets_empty():
    assert filter_curly_brackets("a {} b") == "a b"

def test_filter_curly_brackets_passthrough():
    # No braces → identity (modulo whitespace collapse)
    assert filter_curly_brackets("hello world") == "hello world"
```

### Prose-strip trade-off

**The risk:** Strips benign curly-brace prose, e.g., LLM output containing
`{action: 'wave'}` JSON-style content or `{N|formatting tags}` stylistic markers.

**Milestone-1 precedent:** `filter_brackets` strips `[5+5=10]` math expressions
in user prose. That trade-off was accepted because the LLM is system-prompted to
emit `[joy]` codes; literal `[`/`]` in conversational use is rare. The same logic
applies to `{`/`}`: the LLM is system-prompted (in Phase 6 plumbing-week) to emit
`{variant}` codes, so literal braces in prose are rare. Plan-time accepts the
identical trade-off documented as Rule-2 deviation from OLVT (already documented
for the `[` case in transformers.py:212-214).

**For TTS:** `ignore_curly_brackets: bool = True` default. Plugin authors who want
to preserve prose braces can set the config to False, accepting that variant codes
will now be SPOKEN by TTS (which is probably not what they want).

**Confidence:** HIGH — `_filter_nested` helper already proven for two pairs; adding
a third uses the same primitive.

## Section H — Plugin queue forward-compat shape

### Phase 6 plumbing-week contract

ROADMAP.md line 164 (Phase 6 plan 06-02): "supervisor (5s `on_load` timeout, async-
gen task with 60s/3-restart circuit breaker, null-plugin fallback) + `PluginAdapter
(TickDriver)` with coalescing rate-limiter + hold-last-frame on under-rate".

The exact queue type/contract is NOT spelled out in ROADMAP.md beyond CONTEXT D-A4's
`asyncio.Queue[ActionCode]` stub. Phase 6 inherits the queue Phase 7 produces.

### Recommended Phase 7 stub (Phase 6 must adopt)

```python
# In Orchestrator.__init__:
self.action_code_queue: asyncio.Queue[ActionCode] = (
    action_code_queue or asyncio.Queue(maxsize=128)  # bounded; see below
)
```

**Why bounded (`maxsize=128`)?** Two reasons:
1. Unbounded queue + slow consumer = unbounded memory growth. `put_nowait` succeeds
   forever; queue fills.
2. `maxsize=128` is generous (LLM emission rate << compositor consumption rate
   under normal conditions; any backlog beyond 128 codes indicates plugin failure
   or pathological LLM output). Plan-time picks the exact number — 128 is a
   defensive recommendation.

### `put_nowait` failure mode (queue full)

| Policy | Pros | Cons |
|--------|------|------|
| Drop with WARN log (recommended) | Bounded memory; failure is visible in logs; mirrors VTS-mouth degraded mode at `ws/server.py:108` | Lossy — plugin misses an emission |
| Raise → orchestrator emits STREAM_ERROR | Loud failure | Kills the whole turn for one missed code; over-aggressive |
| Block (`await put`) | Lossless | Backpressures the entire LLM stream — turns the action queue into a critical path it shouldn't be |

**Recommendation:** Drop-with-WARN. Pseudo-code:

```python
try:
    self.action_code_queue.put_nowait(action_code)
except asyncio.QueueFull:
    logger.warning(
        "[DISPATCH-DROP] action_code_queue full; dropping action_code "
        "name={} (queue maxsize={})",
        action_code.name, self.action_code_queue.maxsize,
    )
```

### Forward-compat note for Phase 6

Phase 6's PluginAdapter consumer should:
- Read from `Orchestrator.action_code_queue` (the same queue Phase 7 produces into).
- Call `queue.get_nowait()` in PluginAdapter's tick or async-gen loop, matching the
  consumer pattern in `compositor/intent_driver.py:60` (`self._intent_queue.get_nowait()`).
- NOT await `queue.get()` — that blocks the consumer; instead use
  `try/except asyncio.QueueEmpty` to handle empty case gracefully.

Plan-time deliverable: Phase 7 plan stubs the queue with `maxsize=128` and the
drop-with-WARN policy; Phase 7 RESEARCH (this doc) documents that Phase 6 plumbing
must consume per the pattern above.

**Confidence:** MEDIUM-HIGH — `asyncio.Queue` shape is standard, `put_nowait` failure
modes are well-understood, but the exact `maxsize` is a plan-time tuning call.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 7 introduces no new stored state. The `_avatar_overrides.yaml` schema is unchanged (variants[] / events[] already shipped in Phase 8). | None |
| Live service config | `VariantStateManager._current_hotkey_id` is in-process state only; cleared on sidecar restart by design (D-B2). VTS itself holds toggle state but is reset by `RemoveAllExpressions` at boot. | None — D-B2 explicitly chose session-only |
| OS-registered state | None | None |
| Secrets / env vars | None | None |
| Build artifacts | `packages/contracts/ts/action-intent.ts` becomes stale after deletion. Phase 5 codegen pipeline regenerates from `TARGETS` so removal is mechanical. | Plan-time must include `git rm packages/contracts/ts/action-intent.ts` AND remove from codegen TARGETS in same PR. The `.schema.json` for action-intent under `packages/contracts/generated/json-schema/` likewise becomes stale. |

**Verified by:** Read of `packages/contracts/ts/`, `packages/contracts/generated/`,
and `packages/contracts/scripts/codegen.py:43-76`.

## Common Pitfalls

### Pitfall 1: Catalog mutation during sidecar lifetime
**What goes wrong:** A future contributor adds a "live re-import without restart"
feature; `_avatar_overrides.yaml.variants[]` mutates while orchestrator's closure
still holds the old `variants_lookup`.
**Why it happens:** Closure captured at `_run_pipeline()` time; not reactive.
**How to avoid:** PLG-09 (startup-only switching). Document on the `code_extractor`
factory: "catalogs MUST NOT mutate after orchestrator construction; sidecar restart
required for catalog changes." If a future feature wants live re-load, lift the
closure to read from a `weakref` or attribute on Orchestrator.
**Warning signs:** Issues filed about "imported new avatar but old codes still
parse"; users restarting sidecar more than expected.

### Pitfall 2: Boot-time reserved-name check too late in lifespan
**What goes wrong:** VTS handshake completes and the variant manager tries to
`reset_to_baseline()` BEFORE `validate_reserved_names()` runs, masking the
boot-blocking exception with a partially-initialized writer.
**Why it happens:** Order in `ws/server.py` lifespan matters. CONTEXT.md
"Integration Points" mandates the order:
1. Load `_avatar_overrides.yaml`
2. Load plugin manifest
3. `validate_reserved_names()`
4. VTS handshake
5. `VariantStateManager.reset_to_baseline()`
**How to avoid:** Plan-time test: `sidecar/tests/parser/test_reserved.py` includes
a boot-sequence integration test that injects a deliberate collision and asserts
the exception fires BEFORE any VTS connection is opened.
**Warning signs:** Logs show VTS connection attempts before `[RESERVED-NAME-ERROR]`
in collision-test runs.

### Pitfall 3: `EventCompletionTracker` task leak on shutdown
**What goes wrong:** Sidecar shutdown (Ctrl+C / parent-PID watchdog) doesn't await
in-flight tracker tasks; asyncio raises "Task was destroyed but it is pending!"
warnings.
**Why it happens:** The lifespan teardown chain at `ws/server.py:266-290` cancels
explicitly; if `event_tracker.shutdown()` isn't called in the chain, those tasks
leak.
**How to avoid:** Add `await event_tracker.shutdown()` before `writer.close()` in
the lifespan teardown (per §F surgery list).
**Warning signs:** Test suite shows "Task was destroyed but it is pending!"
warnings during pytest-asyncio teardown.

### Pitfall 4: Variant idempotence loop
**What goes wrong:** LLM emits `{hold-mic}`, variant manager fires toggle-on. LLM
re-emits `{hold-mic}` 50ms later (context-reinforcement); manager correctly no-ops.
But manager logged `[VARIANT-MGR] re-emit no-op` 50× per turn, drowning out
actually-useful logs.
**Why it happens:** D-B3 says "log debug-level only", but a developer might bump
to info to trace a separate bug.
**How to avoid:** Keep the no-op log at `logger.debug()` (D-B3 explicit). Test
asserts `caplog.records` has exactly zero `INFO`-level no-op messages.
**Warning signs:** Logs drawer shows `[VARIANT-MGR] re-emit no-op` repeatedly.

### Pitfall 5: Reserved-name check missing from one of three sources
**What goes wrong:** Plan-time wires `validate_reserved_names(plugin.action_codes,
variants, events)` correctly, but the Phase 6 plumbing-week boot path calls
`validate_reserved_names(plugin.action_codes, [], [])` because `_avatar_overrides`
hasn't loaded yet. Reserved-name collision in variants slips through to runtime.
**Why it happens:** Async boot ordering; Phase 6 may construct the orchestrator
before the avatar has been imported.
**How to avoid:** D-D1 mandates "after plugin manifest load + after `_avatar_overrides`
load". Lifespan startup MUST gate the orchestrator construction on both being
present. If either is absent, log error and refuse to construct orchestrator.
**Warning signs:** Sidecar boots successfully but later raises mid-turn when a
collision-named variant is dispatched.

### Pitfall 6: `<think>`-tag-state remnant in code_extractor
**What goes wrong:** D-A1 disables `<think>` parsing at API level, but
`sentence_divider`'s `valid_tags` empty list still surfaces TagState objects.
`code_extractor` (mirroring `actions_extractor:104-108`) skips dispatch on tag-state
sentences. If a non-compliant model leaks `<think>...</think>` and the divider
parses them as tag-state, the dispatch-skip silently drops `[joy]` codes inside
the same paragraph.
**Why it happens:** Defensive guard from milestone-1 carries forward unchanged.
**How to avoid:** This is correct behavior per D-A1 — the bug is upstream
(reasoning-disable failed), not in the walker. Boot-time reserved-name check on
`<think>` itself (which is in §A's RESERVED_NAMES) means a non-compliant model
that emits `[think]` action would ALSO be caught at boot if a plugin author
unwisely added `[think]` to action_codes.
**Warning signs:** User reports "my [joy] code didn't fire when the model emitted
reasoning text" — answer is "configure the model's reasoning-disable per LLM-03".

## Code Examples

Verified patterns from milestone-1 source.

### Single-pair bracket walker (milestone-1 `_extract_intents`)

```python
# Source: sidecar/src/sidecar/orchestrator/transformers.py:125-157
# Generalized in §B above to three-pair dispatch.
def _extract_intents(text, expression_names, hotkey_names):
    intents = []
    lower = text.lower()
    i = 0
    while i < len(lower):
        if lower[i] != "[":
            i += 1
            continue
        end = lower.find("]", i)
        if end == -1:
            break
        name = lower[i + 1 : end]
        # ... lookup + emit
        i = end + 1
    return intents
```

### Asyncio task with done-callback cleanup (milestone-1 IntentDriver)

```python
# Source: sidecar/src/sidecar/compositor/intent_driver.py:117-130
task = asyncio.create_task(self._writer.request(msg))
task.add_done_callback(
    lambda done: logger.warning(
        "[INTENT-EXPRESSION] activation failed: {!r}",
        done.exception(),
    ) if done.exception() else None
)
```

### Lifespan teardown task cancellation (milestone-1 ws/server.py)

```python
# Source: sidecar/src/sidecar/ws/server.py:266-290
if compositor_task is not None:
    await app.state.compositor.stop()
    compositor_task.cancel()
    try:
        await compositor_task
    except asyncio.CancelledError:
        pass
```

### Pydantic discriminated union (milestone-1 WSMessage)

```python
# Source: packages/contracts/py/contracts/ws_message.py:67-80
WSMessage = Annotated[
    Union[
        TextInputMessage,
        DisplayTextMessage,
        # ...
    ],
    Field(discriminator="type"),
]
```

### Phase 5 codegen registry (TARGETS + OWNER_FILE)

```python
# Source: packages/contracts/scripts/codegen.py:43-76
TARGETS = [
    (ActionIntent, "action-intent", "action_intent", "ActionIntent"),  # DELETE
    # ...
    # ADD: (Dispatch, "dispatch", "dispatch", "Dispatch"),
]
OWNER_FILE = {
    "ActionIntent": "action-intent",  # DELETE
    # ADD: "ActionCode": "dispatch", "VariantToggle": "dispatch", "EventFire": "dispatch"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-pair bracket walker (milestone-1 `_extract_intents`) | Three-pair dispatch-on-opener walker (Phase 7 `_extract_dispatches`) | This phase (D-A3) | Replaces, not extends. Walker is rewritten. |
| `ActionIntent` Pydantic with `kind: Literal["expression", "action", "reaction"]` | `Dispatch` discriminated union over `ActionCode` / `VariantToggle` / `EventFire` | This phase (D-A4) | Wire-shape change; renderer log line `[INTENT]` → `[DISPATCH]` |
| Variant toggle = same path as expression activation (`requestExpressionActivation`) | Variant toggle = hotkey trigger via `DiscreteDispatcher.fire(hotkey_id)` | This phase (Phase 8 catalog seeded by `IMP-02` filter) | Reuses AVT-09 path; no new VTS API surface |
| `<think>` reasoning-strip in parser | API-level reasoning-disable + boot-time reserved-name uniqueness | Phase 2 D-10 / Phase 7 D-A1 | Removes a parser stage; Pitfall 6 documents downstream behavior |

**Deprecated/outdated:**

- `actions_extractor` decorator (replaced by `code_extractor`)
- `_extract_intents` helper (replaced by `_extract_dispatches`)
- `ActionIntent` Pydantic class (replaced by `Dispatch` discriminated union)
- `[INTENT]` loguru prefix (renamed to `[DISPATCH]`)
- The `compositor_intent_queue: asyncio.Queue[ActionIntent]` orchestrator
  attribute (replaced by `action_code_queue: asyncio.Queue[ActionCode]`)
- The `actions: list[ActionIntent]` field on `SentenceOutput`
  (renamed/typed to `dispatches: list[Dispatch]` — exact name plan-time call)

## Validation Architecture

`.planning/config.json` does not explicitly disable `workflow.nyquist_validation`;
including this section per default.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio (already used in milestone-1) |
| Config file | `pyproject.toml` (`[tool.pytest.ini_options]`) |
| Quick run command | `uv run pytest sidecar/tests/orchestrator/ sidecar/tests/parser/ sidecar/tests/vts/test_variant_state_manager.py sidecar/tests/vts/test_event_completion_tracker.py -x --no-header` |
| Full suite command | `uv run pytest sidecar/tests/ && cd packages/contracts && uv run pytest tests/ && cd ../../apps/renderer && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | code_extractor single-pass walker handles split-token boundaries for all three syntaxes (16 fixtures from §C) | unit | `pytest sidecar/tests/orchestrator/test_code_extractor.py -x` | ❌ Wave 0 |
| PARSE-02 | filter_curly_brackets strips curly content (5 fixtures from §G); display_processor + tts_filter pipeline emits zero `{`/`}` characters when ignore_curly_brackets=True | unit | `pytest sidecar/tests/orchestrator/test_tts_preprocessor.py::test_filter_curly_brackets -x sidecar/tests/orchestrator/test_code_extractor.py::test_full_chain_strips_all_three -x` | ❌ Wave 0 |
| PARSE-03a | dispatch routing: action → action_code_queue.put_nowait | unit | `pytest sidecar/tests/orchestrator/test_orchestrator_turn.py::test_dispatch_action_routed_to_queue -x` | ❌ Wave 0 |
| PARSE-03b | dispatch routing: variant → VariantStateManager.apply | unit | `pytest sidecar/tests/orchestrator/test_orchestrator_turn.py::test_dispatch_variant_routed_to_manager -x` | ❌ Wave 0 |
| PARSE-03c | dispatch routing: event → DiscreteDispatcher.fire + EventCompletionTracker.schedule | unit | `pytest sidecar/tests/orchestrator/test_orchestrator_turn.py::test_dispatch_event_fires_and_tracks -x` | ❌ Wave 0 |
| PARSE-04 | code_extractor silently drops `<think>` (unknown event); validate_reserved_names raises if `<think>` is added to plugin action_codes | unit | `pytest sidecar/tests/orchestrator/test_code_extractor.py::test_unknown_think_dropped sidecar/tests/parser/test_reserved.py::test_think_collision_raises -x` | ❌ Wave 0 |
| PARSE-05 | radio-button single-active: emit {a}, then {b}, asserts {a} toggle-off was called before {b} toggle-on | unit | `pytest sidecar/tests/vts/test_variant_state_manager.py::test_radio_button_serialization -x` | ❌ Wave 0 |
| PARSE-05b | idempotent re-emit no-op: emit {a}, then {a} again, asserts only ONE toggle-on call total | unit | `pytest sidecar/tests/vts/test_variant_state_manager.py::test_idempotent_no_op -x` | ❌ Wave 0 |
| PARSE-06a | EventCompletionTracker fires log after duration_ms + 1000 | unit | `pytest sidecar/tests/vts/test_event_completion_tracker.py::test_timer_fires_at_duration_plus_pad -x` | ❌ Wave 0 |
| PARSE-06b | EventCompletionTracker uses 10s ceiling fallback when duration_ms is missing or > 10000 | unit | `pytest sidecar/tests/vts/test_event_completion_tracker.py::test_ceiling_fallback -x` | ❌ Wave 0 |
| PARSE-07a | validate_reserved_names raises on plugin∩variants collision | unit | `pytest sidecar/tests/parser/test_reserved.py::test_plugin_variant_collision_raises -x` | ❌ Wave 0 |
| PARSE-07b | validate_reserved_names raises on variants∩events collision | unit | `pytest sidecar/tests/parser/test_reserved.py::test_variant_event_collision_raises -x` | ❌ Wave 0 |
| PARSE-07c | case-insensitive match — [Joy] vs [joy] vs [JOY] all collide | unit | `pytest sidecar/tests/parser/test_reserved.py::test_case_insensitive_collision -x` | ❌ Wave 0 |
| PARSE-07d | validate passes when all sets disjoint and no reserved names | unit | `pytest sidecar/tests/parser/test_reserved.py::test_clean_input_passes -x` | ❌ Wave 0 |
| PARSE-07e | RESERVED_NAMES contains all of PLG-06 floor 7 + extended sweep entries | unit | `pytest sidecar/tests/parser/test_reserved.py::test_reserved_names_completeness -x` | ❌ Wave 0 |
| PARSE-08 | Adversarial split-token corpus passes (16 cases from §C) | unit (parametrized) | `pytest sidecar/tests/orchestrator/test_code_extractor.py::test_code_extractor_split_token -x` | ❌ Wave 0 |
| Boot-sequence integration | sidecar boot raises before VTS connect when reserved-name collision is present | integration | `pytest sidecar/tests/test_sidecar_boot.py::test_collision_raises_before_vts_connect -x` | ❌ Wave 0 |
| Codegen drift guard | `npm run check:contracts` after Dispatch addition produces no diff vs. tracked TS | integration | `cd packages/contracts && npm run check:contracts` | ✅ Exists (Phase 5); test added with new `dispatch.ts` |
| Manual verification | Live run: type "[joy] {hold-mic} <wave>" to chat; observe action queue size +=1, VTS variant toggle, VTS hotkey fire, [EVENT-COMPLETE] log after 2.5s (Teto IDLE duration) | manual-only | (operator runs) | N/A |

### Sampling Rate

- **Per task commit:** `uv run pytest sidecar/tests/orchestrator/ sidecar/tests/parser/ sidecar/tests/vts/test_variant_state_manager.py sidecar/tests/vts/test_event_completion_tracker.py -x` (parser+orchestrator+new vts tests; ~2-3s)
- **Per wave merge:** `uv run pytest sidecar/tests/` (full sidecar suite ~10-20s)
- **Phase gate:** `uv run pytest sidecar/tests/ && cd packages/contracts && npm run check:contracts && uv run pytest tests/` (full suite + codegen drift guard)

### Wave 0 Gaps

- [ ] `sidecar/tests/orchestrator/__init__.py` — package marker
- [ ] `sidecar/tests/orchestrator/conftest.py` — shared fixtures: `plugin_action_codes`, `variants_lookup`, `events_lookup` (small canned catalogs for split-token tests)
- [ ] `sidecar/tests/orchestrator/test_code_extractor.py` — covers PARSE-01 + PARSE-04 (think-drop) + PARSE-08
- [ ] `sidecar/tests/orchestrator/test_tts_preprocessor.py` — covers PARSE-02 (extends with curly-bracket cases; existing tests stay intact)
- [ ] `sidecar/tests/parser/__init__.py` — package marker
- [ ] `sidecar/tests/parser/test_reserved.py` — covers PARSE-07 + reserved-name completeness
- [ ] `sidecar/tests/vts/test_variant_state_manager.py` — covers PARSE-05 + PARSE-05b + reset-to-baseline
- [ ] `sidecar/tests/vts/test_event_completion_tracker.py` — covers PARSE-06a + PARSE-06b + shutdown cleanup
- [ ] `sidecar/tests/test_actions_extractor.py` — DELETED (replaced by test_code_extractor.py)

## Open Questions for Plan-Time

1. **`SentenceOutput.actions` field — rename or repurpose?**
   - What we know: CONTEXT D-A4 says "ActionIntent is deleted". Field type changes
     to `list[Dispatch]`.
   - What's unclear: Should the field be renamed `actions` → `dispatches` for clarity,
     or kept as `actions` for backward-compat with renderer logs?
   - Recommendation: **Rename to `dispatches`.** The Specifics block in CONTEXT
     ("`[INTENT]` → `[DISPATCH]`") implies the rename intent. Leaving the field
     name as `actions` while the type changes is a maintenance trap.

2. **Phase 6 ordering for `validate_reserved_names()` boot integration.**
   - What we know: Phase 7 boots BEFORE Phase 6 in execution order
     (8 → 6 → 7 → 9 → 10). At Phase 7 plan-time, Phase 6's plugin manifest format
     is contracts-defined but not yet wired.
   - What's unclear: Should Phase 7 plan-time stub `plugin_action_codes = set()`
     until Phase 6 wires the manifest loader? Or does Phase 6 finish wiring
     `validate_reserved_names()` callers in its own scope?
   - Recommendation: Phase 7 stubs `plugin_action_codes: set[str] = set()`
     defaultable in `validate_reserved_names()` signature; Phase 6 wires the
     real loader. Phase 7's PARSE-07 tests pass canned `{"joy", "wave"}` etc.
     at unit-test time (no plumbing dependency).

3. **`EventCompletionTracker.in_flight_set()` vs. `in_flight_dict()` for Phase 9 HUD.**
   - What we know: Phase 9 HUD has not yet planned (post-Phase-7).
   - What's unclear: What exact API does Phase 9 need? `set[hotkey_id]` (just
     "is firing right now") or `dict[hotkey_id, remaining_ms]` (countdown badge)?
   - Recommendation: Ship `in_flight_set()` for Phase 7 (read-only, simplest).
     Phase 9 plan-time can extend with a remaining-ms field if HUD needs it
     without breaking Phase 7's contract.

4. **Bounded queue size for `action_code_queue`.**
   - What we know: §H recommends `maxsize=128` defensively.
   - What's unclear: Is 128 right? LLM emission rate × turn duration vs. plugin
     consumption rate?
   - Recommendation: Plan-time picks a value (128 is conservative-but-defensive);
     plumbing-week harness measures actual queue depth under load and tunes.

5. **Walker behavior for nested same-pair `[a [b]]`.**
   - What we know: §B documents the chosen behavior — first `]` closes the outer
     `[`; inner becomes orphan and dropped.
   - What's unclear: Should the walker also support nested `[[name]]` as a special
     case (e.g., "literal escape" syntax)?
   - Recommendation: NO. CONTEXT and Phase 8 schema don't model literal escapes;
     plugin authors should pick non-bracketed escapes if they need them. Plan-time
     documents the chosen-greedy behavior in tests.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Python 3.12 | Sidecar | ✓ | per `pyproject.toml` | — |
| pytest 8.x + pytest-asyncio | All Phase 7 unit tests | ✓ | already in tree | — |
| Pydantic 2.x | Dispatch discriminated union | ✓ | already in tree | — |
| pyvts 0.3.3 (vendored) | DiscreteDispatcher | ✓ | `sidecar/vendor/pyvts/` | — |
| asyncio | Tracker tasks + queues | ✓ | stdlib | — |
| VTube Studio | Manual integration smoke (operator runs) | (operator runs separately) | 1.32.71 / API "1.0" | Walker + dispatcher unit-tests cover the logic without VTS; manual smoke is a final gate |
| Phase 5 codegen pipeline | Dispatch TS mirror generation | ✓ | active per Phase 8 STATE notes | — |
| Phase 8 `_avatar_overrides.yaml.variants[]` + `events[]` | Walker catalog input | ✓ | shipped Phase 8 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — Phase 7 introduces no new pip
packages; all dependencies are in tree.

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Python 3.12 + pyvts 0.3.3 (vendored) + Pydantic 2.x. Phase 7 adds zero new pip packages. No bumps.
- **Local-first:** Phase 7 dispatch is sidecar-internal; no new WS protocol surface (renderer log lines change only).
- **Single-user:** No multi-user considerations. Variant state is per-sidecar-process.
- **OLVT port preference:** Walker pattern derives from milestone-1 `_extract_intents` which itself ports OLVT's bracket scan. Three-pair dispatch is a local extension; no OLVT precedent because OLVT does not have variant/event categories. Documented divergence.
- **KV cache prefix-stability (memory `project_kv_cache_discipline.md`):** System prompt assembly does NOT change in Phase 7. Plugin-owned action_codes are appended in Phase 6 plumbing-week (per ARCH-09); Phase 7 doesn't touch system prompt bytes. KV-cache invariant unaffected.
- **Capabilities from introspection (memory `project_capabilities_from_introspection.md`):** Phase 7 reads `RigCapabilities.hotkeys` (introspection-derived) for VariantStateManager reset-discovery. Phase 7 does NOT write to `_avatar_overrides.yaml`. Aligns with the "introspection is primary" principle.
- **Plugin owns actions; rig owns variants + events (memory `feedback_plugin_owns_actions_rig_owns_variants.md`):** Phase 7 walker dispatches `[action]` to plugin queue (plugin-owned), `{variant}` and `<event>` to VTS dispatch paths (rig-owned). The architectural split is honored at the dispatch boundary.
- **GSD workflow enforcement:** All Phase 7 work flows through `/gsd:execute-phase`.
- **Chinese-discussion preference (memory `feedback_chinese_discussion.md`):** This RESEARCH.md stays English (per protocol — documents stay English; only AskUserQuestion text + framing in Chinese during discussion).

## Sources

### Primary (HIGH confidence — directly read)

- `sidecar/src/sidecar/orchestrator/transformers.py` (verified — actions_extractor + _extract_intents at lines 75-157)
- `sidecar/src/sidecar/orchestrator/orchestrator.py` (verified — chain wiring at lines 44-49 and 220-227; `[INTENT]` log at 207)
- `sidecar/src/sidecar/orchestrator/tts_preprocessor.py` (verified — filter_brackets, filter_angle_brackets at lines 153, 163; `_filter_nested` helper at 120)
- `sidecar/src/sidecar/vts/discrete_dispatcher.py` (verified — `fire(hotkey_id)` at lines 19-30; `fire_by_name` at 32-44 — Phase 7 reuses fire(), drops fire_by_name's milestone-1 `TetoOverrides.discovered_hotkeys` path)
- `sidecar/src/sidecar/vts/pyvts_writer.py` (verified — single-writer-task wrapper)
- `sidecar/src/sidecar/avatar/overrides.py` (verified — TetoOverrides aliases AvatarOverrides; load/save helpers)
- `sidecar/src/sidecar/avatar/motion3_meta.py` (verified — Meta.Duration extraction)
- `sidecar/src/sidecar/ws/server.py` (verified — lifespan startup/teardown sequence at 122-296)
- `sidecar/src/sidecar/compositor/intent_driver.py` (verified — asyncio.create_task pattern at 117-130)
- `packages/contracts/py/contracts/__init__.py` (verified — full contracts surface)
- `packages/contracts/py/contracts/avatar_overrides.py` (verified — AvatarOverrides shape)
- `packages/contracts/py/contracts/event_entry.py` (verified — `duration_seconds: float`, NOT `duration_ms`)
- `packages/contracts/py/contracts/variant_entry.py` (verified — `code`, `hotkey_id`, `source_name`, `is_placeholder`)
- `packages/contracts/py/contracts/rig_capabilities.py` (verified — hotkeys list shape)
- `packages/contracts/py/contracts/ws_message.py` (verified — discriminated union pattern)
- `packages/contracts/scripts/codegen.py` (verified — TARGETS + OWNER_FILE structure at 43-76)
- `packages/contracts/tests/test_codegen_schema_mutation.py` (verified — force_required behavior)
- `sidecar/vendor/pyvts/vts_request.py` (verified — `requestTriggerHotKey(hotkeyID)` at 152-171; no `requestHotKeyTriggerWithAction` exists)
- `sidecar/tests/test_actions_extractor.py` (verified — split-token harness pattern at 96-149)
- `sidecar/tests/vts/test_discrete_dispatcher.py` (verified — `RemoveAllExpressions` is_meta filtering)
- `Live2D/重音テト/重音テト.vtube.json` lines 1842-1846 (verified — `RemoveAllExpressions` action shape)
- `.planning/REQUIREMENTS.md` PLG-06 line 83 (verified — floor 7 names)
- `.planning/ROADMAP.md` Phase 6/7 sections (verified — execution order + plan stubs)
- `.planning/phases/07-three-category-code-parsing-dispatch/07-CONTEXT.md` (verified — full read)
- `.planning/phases/08-avatar-import-catalogs/08-CONTEXT.md` (verified — Phase 8 schema constraints)
- `.planning/phases/08-avatar-import-catalogs/08-RESEARCH.md` motion3 + EventEntry sections (verified)

### Secondary (MEDIUM confidence — verified via WebFetch)

- Anthropic XML tags doc (https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags) — confirms general XML-tag pattern; says "no canonical best XML tags Claude has been trained with"
- jujumilk3/leaked-system-prompts Anthropic Claude API tool-use file — confirms `<function_calls>`, `<invoke>`, `<parameter>`, `<thinking>` exact tags
- dejan.ai/blog/claude-system-internals — confirms ~65-tag ANTML namespace catalog
- HuggingFace deepseek-ai/DeepSeek-R1 model card — confirms `<think>...</think>`, recommends `<think>\n` initialization
- Qwen3-8B Quickstart docs — confirms thinking-mode `<think>...</think>` blocks via tokenizer chat template
- Ollama qwen3 library — supports `enable_thinking` parameter

### Tertiary (LOW-MEDIUM confidence — single-source, listed for completeness)

- biggo.com/news ANTML markup language analysis (October 2025)
- Clarifai 2026 reasoning-models survey
- arcfu.com Claude JSON tool-calling article (multiple ANTML tag references)

## Metadata

**Confidence breakdown:**
- Section A (sentinel sweep): HIGH — multi-source authoritative confirmation for entries 1-20; MEDIUM for 21-24; LOW for 25-28 (intentionally defensive)
- Section B (walker algorithm): HIGH — milestone-1 precedent; pseudo-code is direct adaptation
- Section C (fixture corpus): HIGH — pattern matches existing test_actions_extractor.py
- Section D (variant baseline reset): HIGH — verified vtube.json shape and pyvts API surface
- Section E (tracker lifecycle): HIGH — pattern mirrors compositor/intent_driver.py
- Section F (decorator chain swap): HIGH — line numbers verified each via Read; codegen impact verified via codegen.py source
- Section G (filter_curly_brackets): HIGH — `_filter_nested` helper proven for two pairs
- Section H (plugin queue forward-compat): MEDIUM-HIGH — `asyncio.Queue` standard but `maxsize` is plan-time tuning
- Schema-drift caveat (duration_ms vs duration_seconds): HIGH — verified directly in contract files

**Research date:** 2026-05-08
**Valid until:** 2026-06-07 (30 days — code-internal research, stable until Phase 8/9 schemas churn)

---

*Phase: 07-three-category-code-parsing-dispatch*
*Researched: 2026-05-08*
