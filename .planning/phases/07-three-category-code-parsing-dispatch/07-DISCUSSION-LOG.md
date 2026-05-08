# Phase 7: Three-Category Code Parsing + Dispatch — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 07-three-category-code-parsing-dispatch
**Areas discussed:** Parser pipeline shape, Variant state & lifecycle, Event dispatch mechanism, Reserved-name guard policy

---

## Gray Areas Selected

| Area | Description | Selected |
|------|-------------|----------|
| Parser pipeline shape | <think>-strip placement; bracket retention vs strip; decorator topology; output shape | ✓ |
| Variant state & lifecycle | State location; cross-session persistence; idempotent re-emit; ground-truth source | ✓ |
| Event dispatch mechanism | VTS API method; duration source; concurrent vs serial; in-flight collision | ✓ |
| Reserved-name guard policy | Validation timing; sentinel scope; case-sensitivity; check sources | ✓ |

---

## Parser pipeline shape (Area A)

### Q1: Where does `<think>...</think>` reasoning-strip live? (round 1)

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Re-enable sentence_divider valid_tags=['think'] | Original recommendation. OLVT idiomatic. | (rejected) |
| (B) New pre-divider strip filter | Streaming buffer-then-strip layer before sentence_divider. | (rejected) |
| (C) Pre-orchestrator strip (input boundary) | Strip as first step inside Orchestrator.turn(). | (rejected) |

**User's response:** "Why we care about Deepseek R1 that much? It has been deprecated for years"

**Notes:** User pushed back on the premise. Claude re-framed: even with API disable, Phase 7 introduces a new collision (`<event>` syntax shape vs `<think>` content), so the question is about defending against any-source `<think>` leakage, not just DeepSeek-R1.

### Q1: Where does <think>-strip live? (round 2 — re-framed)

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Drop the strip; trust API-level disable (Phase 2 D-10 stance unchanged) | No strip step. If leakage, code_extractor sees <think> as unknown event, drops dispatch silently; brackets surface as visible bug. | ✓ |
| (B) Lightweight regex pre-strip for canonical 7 sentinels only | ~5 LOC regex at orchestrator input boundary; defends against cross-talk without over-engineering. | (rejected) |
| (C) Re-enable sentence_divider valid_tags | Original (A) from round 1. | (rejected) |

**User's choice:** (A) Drop the strip
**Notes:** Trust API-level reasoning-disable. PARSE-04 reframed from "strip first" to "boot-time uniqueness check is sole defense".

### Q2: Does code_extractor strip codes from sentence.text?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Leave brackets in; downstream strips per-stage | Plugin sees codes in semantic context (ARCH-03); display_processor + tts_filter strip per surface. | ✓ |
| (B) Strip in code_extractor; downstream sees clean text | Single strip point; violates ARCH-03. | (rejected) |
| (C) Dual: strip cleaned field, keep raw on .raw_text | Cleanest semantics but adds shape complexity. | (rejected) |

**User's choice:** (A) Leave brackets in

### Q3: Decorator topology

| Option | Description | Selected |
|--------|-------------|----------|
| (A) One unified code_extractor | Single-pass left-to-right walker on opener char; aligns with PARSE-01 spec. | ✓ |
| (B) Three stacked decorators | Easier to test in isolation; triples per-token work. | (rejected) |
| (C) Strategy-pattern with pluggable rules | Over-engineered for 3 fixed categories. | (rejected) |

**User's choice:** (A) One unified

### Q4: Output shape

| Option | Description | Selected |
|--------|-------------|----------|
| (A) (sentence, list[Dispatch]) discriminated union | Single ordered list preserves cross-category emission order; codegen handles cleanly. | ✓ |
| (B) (sentence, list[ActionCode], list[VariantToggle], list[EventFire]) | Type-narrow but loses cross-category order. | (rejected) |
| (C) Stream-yield each dispatch as parsed | Hardest to associate with sentence. | (rejected) |

**User's choice:** (A) Discriminated union

---

## Variant state & lifecycle (Area B)

(Round 1 with English questions interrupted — user requested clarification in Chinese; round 2 re-asked in Chinese with fuller framing.)

### Q1: State home

| Option | Description | Selected |
|--------|-------------|----------|
| (A) VariantStateManager owned by dispatcher (sidecar/src/sidecar/vts/) | Sibling to discrete_dispatcher.py; clusters VTS-write knowledge. | ✓ |
| (B) Orchestrator-instance attribute | OLVT pattern but mixes parser concerns with conversation concerns. | (rejected) |
| (C) Compositor-internal | Variants don't flow through ParamFrame; wrong neighborhood. | (rejected) |

**User's choice:** (A)

### Q2: Cross-session vs session-only persistence

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Session-only — clears on sidecar restart | Aligns with LLM-04 in-memory rule; boot fires RemoveAllExpressions; simple mental model. | ✓ |
| (B) Cross-session — persist to disk | Survives restart; adds atomic-write + boot-load + corruption-recovery. | (rejected) |
| (C) Hybrid — in-memory with optional resume prompt | Over-engineered. | (rejected) |

**User's choice:** (A)

### Q3: Idempotent re-emit policy

| Option | Description | Selected |
|--------|-------------|----------|
| (A) No-op (silent) | Detect _current == new → return early + debug log; LLM repeats freely; no flicker. | ✓ |
| (B) Toggle off (treat re-emit as "turn off") | Some users may want this as "I'm done with the variant". | (rejected) |
| (C) Always fire (let VTS re-toggle) | Visible flicker; unsafe. | (rejected) |

**User's choice:** (A)

### Q4: Source of truth

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Shadow state is truth; VTS downstream | Boot syncs once via RemoveAllExpressions; subsequent updates flow through us; deterministic; no race. | ✓ |
| (B) VTS is truth; query before each emit | "Correct" but adds round-trip + creates race window. | (rejected) |
| (C) Lazy sync: query on boot + suspected drift | Drift detection is fuzzy; defer. | (rejected) |

**User's choice:** (A)

---

## Event dispatch mechanism (Area C)

### Q1: VTS API call method

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Reuse DiscreteDispatcher.fire() | requestTriggerHotKey works for all VTS hotkey types; zero new code in vts/. | ✓ |
| (B) New MotionDispatcher (sibling) | Semantically separates discrete vs LLM-emitted events; doubles code. | (rejected) |
| (C) Rename DiscreteDispatcher → HotkeyDispatcher | Cross-phase refactor; regression risk. | (rejected) |

**User's choice:** (A)

### Q2: duration_ms source

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Cached in _avatar_overrides.yaml.events[].duration_ms at Phase 8 import | Zero I/O on hot path; matches "re-import to take effect" mental model. | ✓ |
| (B) Read motion3.json on each fire | Live updates; ~1ms disk I/O each fire. | (rejected) |
| (C) Hybrid: cached + watchdog invalidate | Over-engineered. | (rejected) |

**User's choice:** (A)

### Q3: Multi-event in single sentence

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Concurrent fire (independent playback, non-blocking) | Each event fires immediately; LLM emission order = fire order; per-event tracker. | ✓ |
| (B) Serial fire (wait for prev to complete) | Clean semantics; but multi-event sentences delay later events. | (rejected) |
| (C) Concurrent with N-cap | Quota mechanism; unnecessary. | (rejected) |

**User's choice:** (A)

### Q4: Event-in-flight collision

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Concurrent fire (let motions coexist) | Symmetric with Q3 (events designed as overlay-able). | ✓ |
| (B) Cancel previous + fire new | pyvts 0.3.3 has no native motion-cancel API; unreliable. | (rejected) |
| (C) Queue new — wait for prev | Same complexity as serial mode. | (rejected) |
| (D) Ignore new — drop until prev done | Drops LLM intent; bad UX. | (rejected) |

**User's choice:** (A) Concurrent

---

## Reserved-name guard policy (Area D)

### Q1: Validation timing

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Boot-time only | Sweep at sidecar startup; hot-path zero overhead; runtime can't regenerate collisions. | ✓ |
| (B) Parse-time only | Re-checks every emit; redundant after boot validates. | (rejected) |
| (C) Both (defense-in-depth) | Doubles code; impossible to fail at runtime if boot caught it. | (rejected) |

**User's choice:** (A)

### Q2: Reserved list scope

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Floor 7 + modern provider sentinels | Plan-time sweep; locks results in sidecar/src/sidecar/parser/reserved.py constant. | ✓ |
| (B) Floor 7 only | Literal PLG-06 wording; doesn't future-proof. | (rejected) |
| (C) Floor 7 + plugin manifest extension | Reserved list should be system invariant, not plugin-tunable. | (rejected) |

**User's choice:** (A)

### Q3: Case-sensitivity

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Case-insensitive | LLMs vary in casing; plugin authors vary too; treat all variants equivalently. | ✓ |
| (B) Case-sensitive | Lets <Think> pass while <think> blocks; unsafe. | (rejected) |

**User's choice:** (A)

### Q4: Check sources

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Union plugin.action_codes ∪ variants[].code ∪ events[].code | All LLM-emitted codes protected uniformly; single boot-time function call. | ✓ |
| (B) Only plugin.action_codes (PLG-06 literal scope) | Misses variants/events which are also LLM-emitted (Phase 8 D-A2-1). | (rejected) |
| (C) Only catalog (variants + events) | Misses plugin; contradicts PLG-06. | (rejected) |

**User's choice:** (A)

---

## Closing

### Q: More gray areas to explore?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | 4 areas sufficient; generate CONTEXT.md and proceed to /gsd:plan-phase 7. | ✓ |
| Explore more gray areas | Possible additional areas: plugin queue delivery semantics, split-token fixture scope, display_processor regex quality, Phase 6 forward-compat queue type. | (rejected) |

**User's choice:** I'm ready for context

---

## Claude's Discretion

Areas where Claude committed defaults rather than asking the user:

- **`Dispatch` discriminator field name** — `kind` (matches milestone-1 `ActionIntent.kind` for codegen consistency)
- **`code_extractor` parser internals** — single-pass while-loop with index advancement; mismatched brackets silently dropped (consistent with milestone-1 unmatched-bracket behavior)
- **`EventCompletionTracker` task lifecycle** — sidecar shutdown must cancel in-flight tracker tasks; planner picks `asyncio.create_task` + cancellation registry
- **Adversarial fixture corpus minimum** — 3 split-pattern triples per category × 3 categories + 2 mixed-category fixtures (~9-11 minimum)
- **Plugin queue producer side** — `Orchestrator.action_code_queue: asyncio.Queue[ActionCode]`; consumer wired in Phase 6
- **Variant on-rigs-without-RemoveAllExpressions** — fallback: log INFO, start with shadow=None
- **`filter_curly_brackets` symmetric helper** — added to tts_preprocessor.py alongside existing filter_brackets / filter_angle_brackets

## Deferred Ideas

- `<think>`-strip step revisit (if older self-hosted distill compatibility becomes a feature)
- Cross-session variant persistence (opt-in `variant_state.json`)
- VTS-state ground-truth queries (only if drift becomes empirical bug)
- Event motion-cancel via re-trigger (depends on rig hotkey configuration)
- Plugin-extensible reserved list (`manifest.additional_reserved`)
- Event in-flight HUD badge (Phase 9 forward-compat surfaced)
- Reserved-list manifest extension API (api_version-gated for v3+)
