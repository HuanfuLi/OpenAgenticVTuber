# Phase 2: Conversation Pipeline — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 02-conversation-pipeline
**Areas presented:** Sentence display granularity, System prompt + tag vocabulary, ActionIntent surfacing, Conversation history strategy
**Areas selected for discussion:** All four

---

## Gray-Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Sentence display granularity | Bubble grouping, WS envelope, turn-start affordance, turn seal | ✓ |
| System prompt + tag vocabulary | Persona file location, assembly format, capabilities source/schema, reasoning suppression | ✓ |
| ActionIntent surfacing | Route, shape, kind classification, log destination | ✓ |
| Conversation history strategy | Base strategy, overflow, system prompt path, thread state location, KV cache discipline | ✓ |

**Mid-discussion pivot:** User instructed reuse of `C:/Users/16079/Code/OpenLLM_Vtuber` (sibling repo) for code and logic. Gray-area framing reformulated mid-discussion to ground each option in concrete OLVT files.

---

## Sentence display granularity (Area A)

### Chat-bubble grouping

| Option | Description | Selected |
|--------|-------------|----------|
| OLVT growing-bubble + force-new-message seal (Recommended) | Port `appendAIMessage` from chat-history-context.tsx:83-111; merge sentences into last AI bubble; `force-new-message` from sidecar starts a new bubble next turn | ✓ |
| Per-sentence bubble | Each sentence is its own bubble | |
| Token-stream growing-bubble | Append every LLM delta as it arrives; bypasses buffer-then-extract — risks `[joy]` showing as `[`/`joy`/`]` mid-stream | |

**User's choice:** OLVT growing-bubble + force-new-message seal.
**Notes:** Maximum copyback fidelity. Phase 1 prototype's per-send-bubble pattern is the placeholder; Phase 2 extends it to merge sentence chunks within a turn.

### WS envelope shape (forward-compat with Phase 3 TTS audio)

| Option | Description | Selected |
|--------|-------------|----------|
| Port OLVT `audio-payload`, audio_b64=null in P2 (Recommended) | Mirror OLVT's envelope verbatim; Phase 2 sets audio_b64=null; Phase 3 fills the field, no protocol churn | ✓ |
| Extend Phase 1 `display-text` with actions field | Cleaner separation but Phase 3 breaks the contract | |
| New `sentence-output` envelope | Match OLVT's `SentenceOutput` dataclass directly | |

**User's choice:** Port OLVT `audio-payload`, audio_b64=null in P2.

### Turn-start affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Port OLVT `full-text:"Thinking…"` echo (Recommended) | Sidecar sends `chain-start` + `full-text:"Thinking…"`; frontend renders "Thinking…" until first display-text replaces | ✓ |
| Pre-render bubble with `…` placeholder | Frontend-only; matches existing prototype sending-state UI | |
| Animated typing dots | Three-dot animation in placeholder bubble | |

**User's choice:** Port OLVT `full-text:"Thinking…"` echo.

### Turn seal

| Option | Description | Selected |
|--------|-------------|----------|
| Port OLVT `force-new-message` + `chain-end` pair (Recommended) | Two control messages after last sentence; frontend uses force-new-message flag to start fresh bubble | ✓ |
| `chain-end` only, infer seal | Drop force-new-message; simpler protocol | |
| Frontend infers seal from new user-send | No backend signal; least chatty; harder for proactive-speak | |

**User's choice:** Port OLVT `force-new-message` + `chain-end` pair.
**Notes:** Phase 3's TTS-complete handshake (`backend-synth-complete`) will piggy-back on this pair.

---

## System prompt + tag vocabulary (Area B)

### Persona prompt source-of-truth

| Option | Description | Selected |
|--------|-------------|----------|
| `avatars/teto/personality.md` (Recommended) | Forward-compat with MEM-01 (per-avatar profile loader); reuses OLVT's per-avatar pattern | ✓ |
| Bundled `apps/sidecar/.../prompts/teto_persona.md` | In-package, version-controlled; future MEM-01 migrates the file | |
| Hardcoded string in `pipeline.py` | Simplest; throwaway | |

**User's choice:** `avatars/teto/personality.md`.

### Assembly format

| Option | Description | Selected |
|--------|-------------|----------|
| Port OLVT's persona + utility-prompts append (Recommended) | Mirror `service_context.py:436-477`; port `live2d_expression_prompt.txt` verbatim with `[<insert_action_keys>]` substitution | ✓ |
| Plain text concatenation | Hand-written tag-instructions block; no OLVT loader | |
| XML-tagged from day one | `<personality>...</personality>` blocks per PROJECT_DESIGN line 1823 | |

**User's choice:** Port OLVT's persona + utility-prompts append.
**Notes:** **NOT** including `prompts/utils/think_tag_prompt.txt` — collides with D-10's reasoning-disable strategy.

### Tag vocabulary scope

| Option | Description | Selected |
|--------|-------------|----------|
| OLVT mao_pro 8-emotion set | Port `model_dict.json`'s mao_pro emotionMap verbatim | |
| Skeleton 4-emotion subset | neutral, joy, surprise, sadness | |
| `[joy]` only | Strict §14 SC #2 minimum | |
| Per-rig from `teto_overrides.yaml` | Read emoMap from override file | |
| **Per-avatar from VTS introspection (Other)** ✓ | User-clarified: each VTS model's parameters are read and stored in avatar profile; toggles like "Remove Water Mark", "Cry", "Baguette" come from the actual rig | ✓ |

**User's choice:** Per-avatar from VTS introspection — followed up with confirmation questions (capabilities file location, schema, bootstrap content).

**User's clarification:** *"DO NOT USE teto_overrides.yaml! The override is NOT robust at all and is NOT generic! Each time user add a new VTS model, read the parameter list of the model and store that in avatar profile. There should be some toggles inside the model file like 'Remove Water Mark', 'Cry', 'Baguette', etc."*

### Capabilities file location (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| `avatars/teto/avatar.yaml` (Recommended) | Single-file per avatar holding capabilities + voice + entrance + per-avatar settings | ✓ |
| `avatars/teto/capabilities.json` | JSON, machine-generated; voice/entrance stay in own files | |
| `avatars/teto/model.yaml` | Matches PROJECT_DESIGN.md §5.11 explicit naming | |

**User's choice:** `avatars/teto/avatar.yaml`.

### Capabilities schema (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| VTS-shaped: expressions + hotkeys + parameters (Recommended) | Mirrors VTS API responses; LLM tag list = expressions[].name + hotkeys[].name (curated subset) | ✓ |
| Port OLVT model_dict shape | `{emotionMap, actionMap}` — user explicitly rejected this approach | |
| Hybrid: VTS-shaped + LLM-vocab subset | Full VTS shape + explicit `llm_tag_vocab: [...]` field | |

**User's choice:** VTS-shaped: expressions + hotkeys + parameters.

### Skeleton bootstrap content (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-authored placeholder, marked auto-gen (Recommended) | Realistic placeholder for actual Teto rig; Phase 4 smoke-pass overwrites | ✓ |
| Empty + system-prompt fallback | Skeleton works without metadata; loses forward-compat shape | |
| Stub-only + helpful error at sidecar boot | Forces developer to author file | |

**User's choice:** Hand-authored placeholder, marked auto-gen.
**Notes:** Planner instructs executor to author by inspecting actual Teto rig in VTS Settings → Expressions/Hotkeys panels and copy-pasting real names. Confirmed: real rig names like "Cry", "Baguette" go in.

### Reasoning suppression strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Param-level + parser-strip safety net (Recommended initially) | Pass disable params + keep orchestrator-boundary `<think>` strip + side-channel | |
| Param-level only — trust the disable | Pass the disable params; drop parser-strip; non-compliant model leak = visible bug | ✓ |
| Parser-strip only (current LLM-03) | No API-level params | |

**User's choice:** Param-level only — trust the disable.

**User's clarification:** *"What? Can't we just disable thinking by passing an explicit parameter for also OpenAI and LM Studio?"* Acknowledged: LiteLLM 1.83.x supports per-provider knobs (OpenAI `reasoning_effort`, Anthropic `thinking={"type":"disabled"}`, LM Studio + custom `extra_body={"enable_thinking":False}` for Qwen3-Reasoning / recent DeepSeek-R1 distills).

**Implication for ROADMAP Phase 2 SC #4:** the "captured to a side channel" sub-clause is dropped under this strategy. Verification with a *compliant* reasoning model satisfies the "never appears in main chat stream" half. Plan-time: planner updates Phase 5 verification doc.

---

## ActionIntent surfacing (Area C)

### Route

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled in `audio-payload`'s `actions` field (Recommended) | Per-sentence audio-payload carries `actions: ActionIntent[]`; compositor (Phase 4) subscribes via internal sidecar pub-sub | ✓ |
| Separate `action-intent` envelope variant | New WS envelope variant emitted alongside audio-payload | |
| Sidecar-internal only — log to dev console | ActionIntent never crosses WS | |

**User's choice:** Bundled in `audio-payload`'s `actions` field.
**Notes:** Phase 4's compositor uses internal sidecar pub-sub (per AVT-01: param-frame is sidecar→VTS direct, NOT through renderer). Renderer gets ActionIntents in audio-payload only for log-panel + future portal-card UX.

### Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full §6 shape from day one (Recommended) | Port PROJECT_DESIGN §6 dataclass verbatim (`kind, name, strength, duration_ms, avatar_id`) | ✓ |
| Phase-2 minimal shape | Just `{kind, name}`; Phase 4 widens | |
| OLVT `Actions` shape | `{expressions, pictures, sounds}`; doesn't carry duration/strength | |

**User's choice:** Full §6 shape from day one.

### Kind classification

| Option | Description | Selected |
|--------|-------------|----------|
| Lookup-based: expressions[]→expression, hotkeys[]→action (Recommended after deeper explanation) | Extractor searches avatar.yaml's expressions[] first, then hotkeys[]; `reaction` reserved for Phase 4 cursor/click events; unknown tags silently dropped | ✓ |
| All extracted tags → kind="expression" | Defer hotkey/action classification to Phase 4 | |
| Defer kind assignment to Phase 4 entirely | Phase 2 emits `kind="unknown"` | |

**User's choice:** Lookup-based.
**Notes:** Required deeper walkthrough (user asked "describe this deeper. I don't understand"). Walkthrough explained that `kind` classifies what kind of avatar response Phase 4's compositor produces — `expression` = continuous facial blend, `action` = discrete one-shot trigger, `reaction` = UI-event-driven (never from LLM tags). Classification is a lookup against avatar.yaml.

### Log destination

| Option | Description | Selected |
|--------|-------------|----------|
| Sidecar stdout via loguru + Logs drawer (Recommended) | Structured loguru calls; Phase 1's Logs drawer tails sidecar stdout via WS log envelope | ✓ |
| Dedicated `log` WS envelope with INTENT level | Custom variant for filtering | |
| File-only (no WS log envelope) | Local logfile under config dir | |

**User's choice:** Sidecar stdout via loguru + Logs drawer.

---

## Conversation history strategy (Area D)

### Base strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full session history (OLVT default — Recommended initially) | Port OLVT's `_memory.copy()` pattern verbatim | |
| Sliding window (last N turns) | Config-driven cap | |
| Token-budget pruning | Estimate via `litellm.token_counter`; drop oldest when approaching context window | ✓ |
| Single-turn (no history) | Each turn sends only system + current user | |

**User's choice:** Token-budget pruning.

### Overflow behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Banner + abort current reply, no auto-truncate (Recommended initially) | LiteLLM raises → error envelope → banner with stub-only "Reset" button | |
| Auto-truncate + retry once | Drop oldest 2 turn-pairs and retry; subtle muted line in chat | ✓ |
| Banner with functional "Reset conversation" button | Adds reset-IPC plumbing | |

**User's choice:** Auto-truncate + retry once.

### System prompt path

| Option | Description | Selected |
|--------|-------------|----------|
| Port OLVT's pattern: system passed separately each turn (Recommended initially) | Mirror `chat_completion(messages, self._system)` from basic_memory_agent.py:646 | |
| Inline in messages array as first element | Functionally identical to option 1 | |
| **KV-cache-aware append-only design (Other)** ✓ | User-clarified: append-only memory + forward-only `_head_idx` to maximize KV cache prefix matching | ✓ |

**User's choice:** KV-cache-aware append-only design — confirmed via plain-text design walkthrough.

**User's clarification:** *"Can we make it in an append-only manner to make use of KV cache?"* Acknowledged with detailed walkthrough: stable system prompt at boot + forward-only `_head_idx` + Anthropic `cache_control` markers + LM Studio's llama.cpp auto-prefix-cache + OpenAI's automatic prompt caching all align around prefix stability.

### Thread state location

| Option | Description | Selected |
|--------|-------------|----------|
| Orchestrator-instance attribute (OLVT pattern — Recommended) | `Orchestrator._memory: list[dict]` per OLVT's BasicMemoryAgent | ✓ |
| Standalone `ChatThread` dataclass | PROJECT_DESIGN §6 `ChatThread` shape — premature for skeleton | |
| WebSocket connection state | Reconnect = new thread; risks silent wipe on sidecar auto-respawn | |

**User's choice:** Orchestrator-instance attribute (OLVT pattern).

---

## Wrap

| Option | Description | Selected |
|--------|-------------|----------|
| Document this decision, and proceed (User-confirmed via plain text) | Lock all four areas, write CONTEXT.md and DISCUSSION-LOG.md | ✓ |
| Explore more gray areas | Look for Phase-2 gray areas not yet identified | |

**User's choice:** Document and proceed.

---

## Claude's Discretion

For the gray areas the user didn't drill into and other plan-time defaults, see `02-CONTEXT.md` `<decisions>` "Claude's Discretion" subsection. Highlights:
- Token-budget threshold (D-15) — 75% default, planner may tune
- Cache breakpoint placement (D-19) — system slot mandatory; last-user-message optional per Anthropic 4-breakpoint trick
- OLVT `tts_preprocessor.py` defaults — `ignore_brackets=True, ignore_parentheses=False, ignore_asterisks=True, ignore_angle_brackets=True`
- Pydantic discriminated union extension shape (one big union vs split directional)
- SC #3 adversarial test-fixture corpus authoring

## Deferred Ideas

See `02-CONTEXT.md` `<deferred>` section. Highlights:
- Per-message reasoning-expand chevron (UX-01) — already v2-deferred
- Functional "Reset conversation" button — milestone-2
- Auto-summarization for sliding-window context (UX-05) — memory milestone
- Anthropic 4-breakpoint cache strategy — plan-time evaluation
- Multi-thread chat per avatar (MULTI-01)
- Roleplay-think tag (`<think>` for inner thoughts)
- "Compliant reasoning model" registry surfaced in LLM Setup screen
