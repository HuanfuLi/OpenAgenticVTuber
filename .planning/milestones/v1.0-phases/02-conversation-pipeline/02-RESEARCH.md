# Phase 2: Conversation Pipeline — Research

**Researched:** 2026-05-06
**Domain:** Streaming LLM conversation pipeline (LiteLLM 1.83.14 → OLVT decorator chain → WS envelope) with KV-cache-aware history, API-level reasoning suppression, and `[joy]` `ActionIntent` extraction
**Confidence:** HIGH on OLVT port mechanics (verified against `C:/Users/16079/Code/OpenLLM_Vtuber/` v current main); HIGH on Anthropic prompt-caching shape; MEDIUM on LiteLLM `extra_body` passthrough for LM Studio (a known-bug history exists; current behavior verified through ecosystem docs but not bench-verified); LOW on per-distill compliance with `enable_thinking:false` (model-dependent — flagged as a known-leak risk)

## Summary

Phase 2's research scope is bounded narrowly: **22 user decisions in 02-CONTEXT.md (D-01..D-23) lock the design**, and this RESEARCH.md exists to (a) verify OLVT line-range citations are still current in the sibling repo, (b) pin LiteLLM 1.83.x reasoning-disable parameter compatibility per provider, (c) document KV-cache-marker mechanics, (d) flag the ROADMAP SC #4 wording change required by D-10, and (e) call out three discrepancies between CONTEXT.md citations and OLVT's actual code shape that the planner must resolve.

The core architecture is a **direct port from OLVT** with three principled adaptations: (1) `Actions` dataclass → `ActionIntent[]` Pydantic v2 model, (2) `live2d_model.extract_emotion`/`extract_action` → `avatar.yaml`-driven lookup, (3) drop `valid_tags=["think"]` because reasoning is suppressed at the LiteLLM call level (no parser-strip safety net per D-10).

**Three discrepancies the planner must consciously resolve:**

1. **OLVT envelope `type` is `"audio"` not `"audio-payload"`.** `prepare_audio_payload` returns `{"type": "audio", ...}` (line 53 / 73 of `OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py`). CONTEXT.md D-02 says "audio-payload." Either the planner standardizes our envelope on `"audio"` to match OLVT exactly, or names it `"audio-payload"` as a deliberate divergence. **Recommendation: adopt OLVT-canonical `"audio"`** for maximum copyback fidelity — D-02's intent is OLVT mirror, and the renamed envelope is a pointless divergence. Document in CONTEXT.md amendment.

2. **OLVT field is `audio` not `audio_b64`.** The base64-encoded audio lives in the `"audio"` field of the OLVT envelope; CONTEXT.md says `audio_b64`. Same recommendation: name it `"audio"` (which is `null` in Phase 2, base64-string in Phase 3).

3. **OLVT envelope also carries `volumes` and `slice_length` fields** alongside `audio`/`display_text`/`actions`/`forwarded`. These are RMS-envelope outputs from `_get_volume_by_chunks` — Phase 3 territory. In Phase 2, set `volumes: []` and `slice_length: 20` (OLVT default) so the contract shape is forward-stable.

**Primary recommendation:** Port OLVT verbatim where the file is small enough to inspect (`transformers.py` 227 LOC, `output_types.py` 78 LOC, `tts_preprocessor.py` 196 LOC, `stream_audio.py` 87 LOC). The 608-LOC `sentence_divider.py` ports as a single unit; do not refactor inline. Pin LiteLLM 1.83.14 (already in `sidecar/pyproject.toml`); no new package versions are needed for Phase 2.

## Project Constraints (from CLAUDE.md)

These directives override any research recommendation:

- **Stack lock (CLAUDE.md "Recommended Stack"):** Electron 40 + React 19.2 + Vite 6 + TS 5.7 + npm; Python 3.12; FastAPI 0.136.1; uvicorn 0.46.0; LiteLLM **1.83.14** (post-incident stable line); httpx 0.28; pysbd 0.3.4; loguru (already a sidecar dep). **No new dependencies in Phase 2** beyond the one new sidecar dep `pyyaml` for `avatar.yaml` parsing (CONTEXT.md D-07).
- **Python sidecar disciplines:** uv-managed venv (`uv add` not `pip install`); ruff lint; `Annotated[Union[...], Field(discriminator="type")]` Pydantic discriminated-union pattern (Phase 1 D-PLUMB-03 established this).
- **TS contracts:** hand-mirrored TS until Phase 5 codegen (SC-02). Pydantic models in `packages/contracts/py/contracts/`; matching TS in `packages/contracts/ts/`.
- **GSD workflow enforcement:** edits via `/gsd:execute-phase`, no direct repo edits outside the workflow.
- **OLVT port-verbatim preference (memory: `feedback_olvt_port_preference`):** `C:/Users/16079/Code/OpenLLM_Vtuber/` is the implementation reference; default to "port OLVT" with explicit divergence reasons.
- **KV cache discipline (memory: `project_kv_cache_discipline`):** append-only `_memory` + forward-only `_head_idx`; system prompt bytes-identical at boot; `_memory.pop(0)` is forbidden.

## User Constraints (from CONTEXT.md)

> Copied verbatim from `02-CONTEXT.md`. Locked decisions; the planner MUST honor these.

### Locked Decisions

#### Sentence display granularity (Area A)

- **D-01: Chat-bubble grouping = port OLVT growing-bubble + force-new-message seal.** Mirror `appendAIMessage` from `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/context/chat-history-context.tsx:83-111` verbatim — successive `audio-payload.display_text` arrivals append to the last AI bubble; a `{type:"force-new-message"}` from the sidecar sets a flag so the next display-text starts a fresh bubble. Phase 1's prototype `ChatView` (root `src/shell.jsx:245-359`) currently creates one bubble per send — Phase 2 extends it to merge incoming sentence chunks into the last AI bubble until force-new-message fires.
- **D-02: WS envelope = port OLVT `audio-payload` verbatim, audio_b64 empty in Phase 2.** Mirror OLVT's `prepare_audio_payload` shape: `{type:"audio-payload", audio_b64, display_text:{text, name, avatar}, actions:{expressions, pictures, sounds} | ActionIntent[], sentence_id}`. Phase 2 sets `audio_b64=null`. Phase 3 fills the field, no protocol churn. The `display-text` envelope from Phase 1 (`{type:"display-text", payload:{text, sentence_id}}`) remains for non-TTS surfaces (errors, system messages, `full-text` echo). **Hand-mirrored TS lands now under `packages/contracts/ts/audio-payload.ts`** (codegen replaces in Phase 5 per SC-02).
  - *Note:* OLVT's `Actions` dataclass uses `{expressions, pictures, sounds}`; we use the PROJECT_DESIGN §6 `ActionIntent[]` shape instead (D-12 below). The `audio-payload` envelope's `actions` field carries our richer structure.
  - **PLANNER NOTE (research finding):** OLVT's actual envelope `type` value is `"audio"` and the field is `audio` (not `audio_b64`). See "Discrepancies" section. Recommend renaming to OLVT-canonical names for maximum port fidelity.
- **D-03: Turn-start affordance = port OLVT's "Thinking…" echo.** On receiving `text-input`, sidecar immediately sends `{type:"control", text:"conversation-chain-start"}` then `{type:"full-text", text:"Thinking…"}` (matches `conversation_utils.py:138-143`). Frontend renders "Thinking…" inside a fresh assistant bubble; replaced on first `audio-payload.display_text` arrival.
- **D-04: Turn seal = port OLVT's `force-new-message` + `chain-end` pair.** After the orchestrator's last sentence emits, sidecar sends `{type:"force-new-message"}` then `{type:"control", text:"conversation-chain-end"}` (matches `conversation_utils.py:181, 199-204`). Frontend's `appendAIMessage` reads the flag set by `force-new-message` and starts a fresh bubble on the next AI sentence. Phase 3's TTS-complete handshake will piggy-back on this pair (`backend-synth-complete` already in OLVT).

#### System prompt + tag vocabulary (Area B)

- **D-05: Persona prompt source-of-truth = `avatars/teto/personality.md`.** Forward-compat with MEM-01. Phase 2 reads the file once at sidecar startup; **no hot-reload** in skeleton (chokidar/watchdog comes in MEM-01).
- **D-06: System prompt assembly = port OLVT's persona + utility-prompts append pattern.** Mirror `service_context.py:436-477`'s `construct_system_prompt`. Skeleton ports `OpenLLM_Vtuber/prompts/utils/live2d_expression_prompt.txt` verbatim into `apps/sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` and a minimal `prompt_loader.py` (~20 LOC).
  - **Do NOT include `OpenLLM_Vtuber/prompts/utils/think_tag_prompt.txt`** — collides with D-10.
- **D-07: Per-avatar capabilities file = `avatars/teto/avatar.yaml`.** Single-file per avatar that holds capabilities + voice + entrance + per-avatar settings. Adds `pyyaml` to sidecar deps (`uv add pyyaml`).
- **D-08: Capabilities schema = VTS-shaped (expressions + hotkeys + parameters).** LLM tag list = `expressions[].name + hotkeys[].name` (post-curation).
- **D-09: Skeleton bootstrap content = hand-authored Teto placeholder marked auto-gen.** Developer authors based on inspecting the actual Teto rig in VTS → Settings → Expressions/Hotkeys panels and copy-pasting the real names.
- **D-10: Reasoning suppression = LiteLLM call-level disable params, NO parser-strip safety net.**
  - **OpenAI o1/o3:** `reasoning_effort="minimal"` (newer models)
  - **Anthropic:** `thinking={"type":"disabled"}` (default behavior anyway; explicit for clarity)
  - **LM Studio + custom OpenAI-compat:** `extra_body={"enable_thinking": False}` — Qwen3-Reasoning and recent DeepSeek-R1 distills (Jan 2025+) honor this via the chat template; older distills ignore it harmlessly.
  - **ROADMAP Phase 2 SC #4 implication:** the success criterion's "captured to a side channel" sub-clause is dropped under this strategy.

#### ActionIntent surfacing (Area C)

- **D-11: ActionIntent route = bundled in `audio-payload.actions` field.** Per-sentence `audio-payload` carries `actions: ActionIntent[]` alongside `display_text` and (Phase 3) `audio_b64`. Phase 4's compositor subscribes via **internal sidecar pub-sub** (NOT the WS — per AVT-01).
- **D-12: ActionIntent shape = full PROJECT_DESIGN §6 dataclass from day one.** Pydantic v2 model in `packages/contracts/py/contracts/action_intent.py`; matching TS in `packages/contracts/ts/action-intent.ts`.
- **D-13: Tag → kind classification = lookup-based against avatar.yaml.** Extractor searches the tag name in `expressions[]` first → `kind="expression"`; fallback to `hotkeys[]` → `kind="action"`. `kind="reaction"` is reserved for Phase 4's UI-event-driven intents. Unknown tags silently dropped.
- **D-14: ActionIntent log destination = sidecar stdout via loguru, surfaced in Logs drawer.** Use structured loguru calls; reuses Phase 1's `log` channel.

#### Conversation history strategy (Area D)

- **D-15: Base strategy = token-budget pruning.** Per-turn estimation via `litellm.token_counter`. When estimate exceeds **75%** of `model_context_window`, advance `_head_idx += 2`.
- **D-16: Overflow = auto-truncate + retry once.** On `ContextWindowExceededError`, aggressively advance `_head_idx` to keep only the last 4 turn-pairs and retry once. If retry also fails, surface a `{type:"error", message:"Conversation too long. Close the app to start fresh."}` envelope.
- **D-17: System prompt path = port OLVT's pattern: system passed separately each turn.** Mirror `self._llm.chat_completion(messages, self._system)` from `basic_memory_agent.py:646`. System prompt assembled **once at sidecar boot** — bytes-identical across all turns.
- **D-18: Thread state location = orchestrator-instance attribute (OLVT pattern).** `Orchestrator._memory: list[dict]`. Single-instance, single-thread skeleton.
- **D-19: KV cache discipline = append-only memory + forward-only `_head_idx`.** **`_memory.pop(0)` is forbidden.** Only `_head_idx` advances when pruning. Anthropic `cache_control: {"type": "ephemeral"}` on system slot. (See Code Examples for the full Orchestrator skeleton.)

#### OLVT decorator chain (cross-cutting)

- **D-20: Port the 4-decorator OLVT chain verbatim** with `valid_tags=[]` (NOT `["think"]`). `actions_extractor` adapted to read from `AvatarCapabilities` and emit `ActionIntent[]`.

#### Streaming LLM gateway (extends Phase 1's setup-test integration)

- **D-21: LiteLLM streaming via `litellm.acompletion(stream=True)`.** Phase 1 established `litellm.acompletion` for the setup test. Phase 2 reuses the same client config but adds `stream=True`. The 120s timeout from LLM-01 carries forward.
- **D-22: Provider config snapshot at sidecar boot.** Sidecar reads `safeStorage` once at startup via the Phase 1 IPC bridge. Mid-session provider change is **not supported** in skeleton.

#### Stub TTS contract (preserves Phase 3 swap-in seam)

- **D-23: Stub TTS = log tts_text to stdout, omit audio_b64 from envelope.** Orchestrator just logs `[STUB-TTS] {sentence_id} text="{tts_text}"` via loguru. The `audio-payload` envelope sets `audio_b64=null`.

### Claude's Discretion

User chose to defer these to research/planner judgment with documented defaults:

- **Token-budget threshold (D-15):** 75% of model context window default. Planner may tune (60% if system prompt is heavy, 80% if light).
- **Cache breakpoint placement (D-19):** system slot mandatory; optional Anthropic 4-breakpoint trick on most-recent user message.
- **OLVT `tts_preprocessor.py` deep port:** defaults `ignore_brackets=True, ignore_parentheses=False, ignore_asterisks=True, ignore_angle_brackets=True`.
- **Pydantic discriminated union extension:** one big union vs split directional. OLVT uses one big dispatcher.
- **Test-fixture corpus for SC #3:** Planner drafts. Minimum: `[joy]` split as `[`/`jo`/`y]`; `[hold-mic]` split as `[hold`/`-`/`mic]`; nested brackets `[joy] [surprise]` split arbitrarily.

### Deferred Ideas (OUT OF SCOPE)

- **Per-message reasoning-expand chevron (UX-01)** — already deferred to v2.
- **"Reset conversation" button in chat surface** — milestone-2.
- **Auto-summarization for sliding-window context (UX-05)** — memory milestone.
- **Anthropic 4-breakpoint cache strategy** — plan-time evaluation.
- **Multi-thread chat per avatar (MULTI-01)** — `_memory` becomes `dict[thread_id, list[dict]]`.
- **Roleplay-think tag (`<think>...</think>` for inner thoughts)** — explicitly dropped under D-10.
- **"Compliant reasoning model" registry** — UX polish for v2.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LLM-01 | LiteLLM is the single LLM client; LM Studio + custom OpenAI-compat; ≥120s timeout for cold-start | Phase 1 already wired `litellm.acompletion` with `timeout=120` for the 1-token setup test. Phase 2 reuses the same client config + `stream=True` for token deltas. The 120s budget covers LM Studio's JIT lazy-load (LM Studio default Idle TTL: 60min; cold-start can take 30-60s on first request) — see "LM Studio warmup pattern" findings below. |
| LLM-02 | OLVT decorator chain (sentence_divider → actions_extractor → tts_filter); buffer-then-extract on completed sentences only | OLVT's `transformers.py` (227 LOC, verified current) ports as 4 decorators stacked in `_chat_function_factory` (`basic_memory_agent.py:586-593`). `SentenceDivider` (608 LOC at `utils/sentence_divider.py`) buffers the token stream until pysbd reports a complete sentence boundary; tag extraction happens *only after* a complete sentence is yielded. Per PITFALLS Pitfall 5 — never extract on streaming deltas. |
| LLM-03 | LLM-gateway boundary strips `<think>` reasoning blocks before the orchestrator sees the content; reasoning to side channel | **Per D-10, this requirement is satisfied via API-level reasoning-disable, NOT parser-strip.** The "side channel" sub-clause is dropped. ROADMAP SC #4 wording needs the planner-side update for Phase 5 verification (test with a *compliant* DeepSeek-R1 distill / Qwen3-Reasoning where `enable_thinking:false` is honored). |
| LLM-04 | Single in-memory thread, clears on relaunch | `Orchestrator._memory: list[dict]` is an instance attribute; sidecar process restart destroys the orchestrator instance → `_memory` wiped. No persistence layer in Phase 2. |

## Standard Stack

### Core (no new deps; Phase 2 extends Phase 1's pinned set)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **LiteLLM** | **1.83.14** (already pinned in `sidecar/pyproject.toml`) | Streaming LLM gateway with `acompletion(stream=True)`; provider-prefix routing (`lm_studio/<id>` / `openai/<id>` / `anthropic/<id>` / `gemini/<id>`); reasoning-disable param pass-through; Anthropic prompt-caching pass-through | Locked by CLAUDE.md, exercised by Phase 1's setup-test. v1.83.x is the post-March-2026-supply-chain-incident stable line. |
| **pysbd** | **0.3.4** | Sentence Boundary Disambiguation — segments LLM token stream into complete sentences (with `clean=False`); 22-language support including English/Japanese/Chinese | OLVT-direct port (`utils/sentence_divider.py:213-266`). Rule-based, no model load, sub-ms per segment. The 2026 standard for streaming sentence-boundary detection in this exact use case. |
| **Pydantic** | **>=2.5** (already in `sidecar/pyproject.toml`) | Discriminated-union WS envelopes; `ActionIntent`, `AudioPayloadMessage`, `ControlMessage`, `FullTextMessage`, `ForceNewMessageMessage`, `ErrorMessage`, `LogMessage` models | Established in Phase 1 (`packages/contracts/py/contracts/ws_message.py`). v2's `model_dump()` and `Annotated[Union[...], Field(discriminator="type")]` are the OLVT-shape mirror pattern. |
| **loguru** | (already a sidecar transitive dep) | Structured logging to stdout for `[INTENT]` and `[STUB-TTS]` lines; surfaced in Phase 1's Logs drawer via the `log` WS envelope | OLVT-direct (used throughout `OpenLLM_Vtuber/src/`). Already configured in Phase 1. |
| **PyYAML** | **>=6.0** (NEW in Phase 2) | Parse `avatars/teto/avatar.yaml` capabilities file at sidecar boot | Standard YAML parser; widely available for Python 3.12. Add via `uv add pyyaml`. |
| **langdetect** | (transitive via OLVT port) | Language detection inside `SentenceDivider` to pick pysbd-supported language | Inherited from OLVT — port verbatim. Pin via `uv add langdetect>=1.0.9` if not transitive. **Verify install** during Wave 0. |
| **httpx** | **>=0.28** (already pinned) | Underlying HTTP transport for LiteLLM | Phase 1 already uses for `/v1/models` pre-flight. No change. |

**Version verification (npm view / pip show on 2026-05-06):**
- LiteLLM 1.83.14 — current stable (per CLAUDE.md verification 2026-04-26)
- pysbd 0.3.4 — current (PyPI confirms, last release ~2024 but algorithm is complete; OLVT uses this exact version)
- pyyaml 6.0.x — current LTS line on Python 3.12
- langdetect 1.0.9 — current; mature Python language-id library

### Supporting (no install — these are sidecar internals to **author**)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `apps/sidecar/src/sidecar/orchestrator/transformers.py` | Port of OLVT `transformers.py` — 4 decorators (sentence_divider, actions_extractor, display_processor, tts_filter) | Wraps the LLM token-stream coroutine in `Orchestrator.turn` |
| `apps/sidecar/src/sidecar/orchestrator/sentence_divider.py` | Port of OLVT `utils/sentence_divider.py` (608 LOC) — `SentenceDivider` class with pysbd + comma-splitter for `faster_first_response` | Decorator implementation detail |
| `apps/sidecar/src/sidecar/orchestrator/tts_preprocessor.py` | Port of OLVT `utils/tts_preprocessor.py` (196 LOC) — `tts_filter` text cleanup function | Used by `tts_filter` decorator (Phase 2 logs result, Phase 3 sends to piper) |
| `apps/sidecar/src/sidecar/orchestrator/output_types.py` | Adaptation of OLVT `agent/output_types.py` (78 LOC) — replace `Actions` dataclass with `ActionIntent[]` consumption | Internal types for the decorator chain |
| `apps/sidecar/src/sidecar/orchestrator/orchestrator.py` | NEW — replaces OLVT's `BasicMemoryAgent`. Owns `_memory`, `_head_idx`, `_system_prompt`. Method `turn(user_text) → AsyncIterator[SentenceOutput]` | Single instantiation at sidecar boot via FastAPI lifespan |
| `apps/sidecar/src/sidecar/orchestrator/prompt_loader.py` | NEW (~20 LOC) — `load_util(prompt_name)` mirroring OLVT's `prompts/prompt_loader.py` | Used by `construct_system_prompt` |
| `apps/sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` | NEW — verbatim port of `OpenLLM_Vtuber/prompts/utils/live2d_expression_prompt.txt` (~30 lines) | Read by `prompt_loader.load_util("live2d_expression_prompt")` at boot |
| `apps/sidecar/src/sidecar/avatar/capabilities.py` | NEW — Pydantic v2 `AvatarCapabilities`, `Expression`, `Hotkey`, `Parameter` models; YAML loader | Read at sidecar boot; consumed by `actions_extractor` (kind classification) and `construct_system_prompt` (LLM tag-vocabulary string) |
| `apps/sidecar/src/sidecar/llm/gateway.py` | NEW — thin wrapper around `litellm.acompletion(stream=True)` with provider-config snapshot, reasoning-disable params, cache_control, and per-call `timeout=120` | Called by `Orchestrator.turn` to get the raw token stream |
| `packages/contracts/py/contracts/action_intent.py` | NEW Pydantic v2 model | Imported by orchestrator; serialized in `audio-payload.actions` |
| `packages/contracts/py/contracts/audio_payload.py` | NEW Pydantic v2 model — `AudioPayloadMessage` | Server→client envelope; carries `actions: list[ActionIntent]` |
| `packages/contracts/ts/action-intent.ts` | NEW hand-mirror | Renderer reads from `audio-payload.actions` for log-panel surfacing only |
| `packages/contracts/ts/audio-payload.ts` | NEW hand-mirror | Renderer parses for the chat-panel growing-bubble |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OLVT 4-decorator chain | Hand-rolled state machine in `Orchestrator.turn` | OLVT pattern is verified working; decorators are the explicit user-locked decision (D-20). No tradeoff worth taking. |
| `litellm.acompletion(stream=True)` | Direct provider SDKs (anthropic, openai) | LiteLLM's `cache_control` and reasoning-disable pass-through abstracts provider differences. Direct SDKs would force per-provider branching in the orchestrator. |
| Pydantic `ActionIntent` | TypedDict / dataclass | Pydantic v2 supports `model_json_schema()` (Phase 5 codegen seam); validates at WS boundary; matches Phase 1's contract pattern. |
| `pyyaml` for `avatar.yaml` | `tomllib` (TOML) / `json` | YAML is the pre-existing convention for OLVT character configs and PROJECT_DESIGN.md §5.11. Already in CONTEXT.md D-07. |
| `langdetect` (inside SentenceDivider) | `lingua-py`, `cld3` | OLVT uses `langdetect` directly. Port verbatim. |

**Installation:**

```bash
cd sidecar
uv add pyyaml
# verify langdetect is present (transitive dep of pysbd-related stack); add explicitly if not
uv add langdetect

# No frontend dep changes — Phase 2 is renderer-side state-reducer + WS-handler logic only
```

**Version verification (PyPI 2026-05-06, confirmed via Read of `sidecar/pyproject.toml`):**

```bash
# Already pinned, no change:
litellm==1.83.14   # Phase 1's pin — current stable
fastapi==0.136.1   # Phase 1's pin
uvicorn==0.46.0    # Phase 1's pin
pydantic>=2.5      # Phase 1's pin
httpx>=0.28        # Phase 1's pin

# New in Phase 2 (verify exact at install time):
pyyaml>=6.0        # confirmed current LTS for Python 3.12
langdetect>=1.0.9  # confirmed current; mature
pysbd==0.3.4       # OLVT-pinned; matches CLAUDE.md
```

## Architecture Patterns

### Recommended Module Layout (extends Phase 1's sidecar tree)

```
apps/sidecar/src/sidecar/
├── ws/                          # Phase 1 — extended with new handlers and emission helpers
│   ├── handlers.py              # extend: text-input now drives orchestrator.turn
│   └── emit.py                  # NEW — typed helpers: emit_audio_payload(), emit_full_text(), emit_force_new(), emit_chain_end(), emit_error(), emit_log()
│
├── llm/                         # Phase 1 — extended for streaming
│   ├── setup_test.py            # Phase 1 — unchanged
│   └── gateway.py               # NEW — async stream() wrapping litellm.acompletion(stream=True)
│
├── orchestrator/                # NEW (the Phase 2 deliverable)
│   ├── __init__.py
│   ├── orchestrator.py          # Orchestrator class — _memory, _head_idx, turn(text)
│   ├── transformers.py          # OLVT-port — sentence_divider, actions_extractor, display_processor, tts_filter decorators
│   ├── sentence_divider.py      # OLVT-port — SentenceDivider class
│   ├── tts_preprocessor.py      # OLVT-port — tts_filter() text-cleanup function
│   ├── output_types.py          # adapted from OLVT — DisplayText, SentenceOutput
│   ├── prompt_loader.py         # ~20 LOC — load_util() pattern from OLVT
│   ├── prompts/
│   │   └── live2d_expression_prompt.txt   # verbatim from OLVT
│   └── PROVENANCE.md            # records OLVT commit SHA + per-file adaptations (mirrors sidecar/vendor/pyvts/PROVENANCE.md from Phase 1 D-01)
│
└── avatar/                      # NEW
    ├── __init__.py
    ├── capabilities.py          # Pydantic models + YAML loader

packages/contracts/py/contracts/
├── ws_message.py                # Phase 1 — extend WSMessage union with new variants
├── action_intent.py             # NEW
├── audio_payload.py             # NEW

packages/contracts/ts/
├── ws-message.ts                # Phase 1 — extend WSMessage union
├── action-intent.ts             # NEW hand-mirror
├── audio-payload.ts             # NEW hand-mirror

avatars/teto/                    # NEW directory (root-level, not under apps/)
├── personality.md               # hand-authored Teto persona
└── avatar.yaml                  # hand-authored capabilities (per D-09 instructions)
```

### Pattern 1: 4-Decorator Streaming Pipeline (OLVT-direct port)

**What:** Stack four decorators around an `async def chat_with_memory()` coroutine. Each decorator transforms the streaming output into progressively-more-structured shapes:

```
LLM token-stream → sentence_divider (str → SentenceWithTags)
                → actions_extractor (SentenceWithTags → (SentenceWithTags, ActionIntent[]))
                → display_processor ((SentenceWithTags, Actions) → (SentenceWithTags, DisplayText, Actions))
                → tts_filter ((SentenceWithTags, DisplayText, Actions) → SentenceOutput)
```

**When to use:** any streaming pipeline where downstream stages need progressively-more-structured data and individual stages can be reasoned about / unit-tested independently.

**Source-of-truth:** `OpenLLM_Vtuber/src/open_llm_vtuber/agent/transformers.py` (lines 12-227, all 4 decorators), `OpenLLM_Vtuber/src/open_llm_vtuber/agent/agents/basic_memory_agent.py:581-662` (`_chat_function_factory`).

**Adaptation for our skeleton:**
- `valid_tags=[]` instead of OLVT's default `["think"]` (D-10 disables `<think>` at API level — sentence_divider has nothing to track inside think-tag boundaries)
- `actions_extractor` takes `AvatarCapabilities` (from `avatar.yaml`) instead of `Live2dModel`; emits `ActionIntent[]` instead of `Actions`-with-string-list
- `display_processor`: OLVT's lines 144-149 wrap `<think>` content in `(...)` parens. Under D-10 there are no `<think>` tags, but the code path is harmless — port verbatim, leaves dead code (clean port).

### Pattern 2: KV-cache-aware append-only memory (PROJECT-locked invariant)

**What:** `_memory: list[dict]` is **append-only**. `_head_idx: int` is **forward-only**. The slice `_memory[_head_idx:]` is what gets sent to the LLM each turn. When pruning, increment `_head_idx` (drop turn-pairs from the *left*); never `_memory.pop(0)`.

**Why it matters:** Anthropic prompt caching, llama.cpp auto-prefix-caching (LM Studio), and OpenAI's automatic prompt caching all key on **byte-identical message-prefix sequences**. If `_memory.pop(0)` mutates the list, the prefix shifts and cache hits collapse. With append-only + `_head_idx`, the prefix `[system, *_memory[_head_idx:]]` stays bytes-identical across turns until the head advances (which is a deliberate cache-bust, accounted for).

**When to use:** every turn. Mandatory.

**Source:** PROJECT_DESIGN.md §13 KV-cache discipline; user-pinned memory `project_kv_cache_discipline`. CONTEXT.md D-19 has the full skeleton.

### Pattern 3: System prompt assembly at sidecar boot, bytes-identical thereafter

**What:** Build the system prompt **once** at sidecar lifespan-startup. Cache the result on the orchestrator instance. Pass it as `messages[0]` (or the OLVT separate-system-arg pattern) verbatim every turn.

**Implementation:**

```python
# apps/sidecar/src/sidecar/orchestrator/orchestrator.py (excerpt)
async def build_system_prompt(persona_path: Path, capabilities: AvatarCapabilities) -> str:
    persona = persona_path.read_text(encoding="utf-8")
    expression_prompt = prompt_loader.load_util("live2d_expression_prompt")  # OLVT pattern
    full_action_str = " ".join(
        f"[{name}]," for name in (
            [e.name for e in capabilities.expressions]
            + [h.name for h in capabilities.hotkeys]
        )
    )
    expression_prompt = expression_prompt.replace("[<insert_action_keys>]", full_action_str)
    return persona + expression_prompt
```

**Anti-pattern to avoid:** rebuilding the system prompt per-turn. Even appending a timestamp invalidates the cache prefix.

### Pattern 4: WS envelope dispatcher with typed-out emission helpers

**What:** Phase 1's `@on("text-input")` decorator pattern is the *inbound* surface. Phase 2 adds a small `emit.py` module that wraps `websocket.send_json()` calls in typed helpers — one per envelope type. Keeps Pydantic validation centralized and prevents stringly-typed envelope construction at call sites.

```python
# apps/sidecar/src/sidecar/ws/emit.py
from contracts.audio_payload import AudioPayloadMessage
from contracts.ws_message import ControlMessage, FullTextMessage, ForceNewMessageMessage, ErrorMessage

async def emit_audio_payload(ws, msg: AudioPayloadMessage) -> None:
    await ws.send_json(msg.model_dump())

async def emit_full_text(ws, text: str) -> None:
    await ws.send_json(FullTextMessage(text=text).model_dump())

async def emit_chain_start(ws) -> None:
    await ws.send_json(ControlMessage(text="conversation-chain-start").model_dump())

async def emit_chain_end(ws) -> None:
    await ws.send_json(ControlMessage(text="conversation-chain-end").model_dump())

async def emit_force_new_message(ws) -> None:
    await ws.send_json(ForceNewMessageMessage().model_dump())

async def emit_error(ws, message: str) -> None:
    await ws.send_json(ErrorMessage(message=message).model_dump())
```

**Source:** OLVT's `websocket_handler.py:156-176` and `conversation_utils.py:133-211` mix raw `json.dumps({"type":..., "text":...})` calls — fine for OLVT, but our skeleton is greenfield so we get the typed-emit ergonomics for free.

### Anti-Patterns to Avoid

- **Streaming-extract instead of buffer-then-extract.** PITFALLS Pitfall 5 — `[joy]` fragments across BPE deltas. Never run regex on individual deltas. Always buffer until pysbd reports a complete sentence; run extractor on the *whole sentence string*. SC #3 directly tests this.
- **Mutating `_memory[0]`.** Forbidden by user memory `project_kv_cache_discipline`. KV cache prefix collapse on every turn.
- **Re-building system prompt per turn.** Same as above. Build once at boot; never touch.
- **Inline `<think>` strip parser.** Per D-10, no parser-strip safety net. Trust the API disable params. Non-compliant model = visible bug = user changes models.
- **Per-token chat rendering.** UI-SPEC IP-1 forbids it. Chat displays sentence-by-sentence (the sentence_divider boundary), not token-by-token.
- **New WS envelope variant for ActionIntent.** Per D-11, intents ride inside `audio-payload.actions`. Adding a separate `action-intent` envelope variant duplicates the bus.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming sentence segmentation across BPE token boundaries | Custom regex-on-deltas | OLVT's `SentenceDivider` (pysbd-backed, 608 LOC, handles JP/EN/ZH abbreviations + faster-first-response comma-split) | PITFALLS Pitfall 5; OLVT's port-verbatim is the user-locked stance |
| Multi-provider streaming completion (OpenAI / Anthropic / LM Studio / custom OpenAI-compat / Gemini) | Direct provider SDKs with branching | `litellm.acompletion(stream=True)` with `extra_body` / `thinking` / `reasoning_effort` provider-specific kwargs | LiteLLM is the locked gateway (CLAUDE.md, §5.5). Phase 1 already exercises it. |
| Anthropic prompt-cache marker injection | Manual header-and-content-array assembly | Pass `cache_control: {"type": "ephemeral"}` as a content-block field; LiteLLM forwards to Anthropic's API automatically (no `anthropic-beta` header needed in current versions) | LiteLLM 1.83.x handles the translation; OpenAI/Gemini/LM Studio ignore the field harmlessly |
| Token counting per-message-list before LLM call | tiktoken-direct or hand-rolled char heuristics | `litellm.token_counter(model=..., messages=[...])` | LiteLLM dispatches the right tokenizer per provider; falls back to tiktoken for OpenAI-compat / LM Studio (LOW accuracy on custom models — flagged below) |
| Model-context-window lookup | Hardcoded constants | `litellm.model_cost.get(model, {}).get("max_input_tokens", 8192)` | LiteLLM ships an updated model registry. **Caveat:** custom OpenAI-compat models (e.g., user-loaded Llama-3-8B in LM Studio under model name `qwen2.5-7b-instruct`) won't be in the registry — fall back to the 8192 default and let `ContextWindowExceededError` retry-once (D-16) catch overruns. |
| Persona prompt assembly with action-vocabulary substitution | Hand-rolled string interpolation | OLVT `service_context.py:436-477` `construct_system_prompt` pattern + `prompt_loader.load_util` (~20 LOC each) | Forward-compat with MEM-01 hot-reload milestone |
| YAML schema validation for `avatar.yaml` | Manual `if "expressions" in data` checks | Pydantic v2 `AvatarCapabilities` model with nested `Expression` / `Hotkey` / `Parameter` models; YAML → dict → `model_validate(dict)` | Loud failure on schema drift, single source of truth for the file shape |
| Frontend growing-bubble logic | Custom React state-reducer rebuild | Logic-port from `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/context/chat-history-context.tsx:79-111` (`appendAIMessage` + `forceNewMessage` flag pattern) | UI-SPEC IP-1 mandates this is the seal contract; OLVT-canonical ~25 LOC |

**Key insight:** Phase 2 is overwhelmingly a **port**, not a build. The user's directive (`feedback_olvt_port_preference`) means every line of OLVT we *don't* port verbatim becomes a divergence requiring justification. Plan tasks should structure as "port file X (Y LOC) verbatim with these N adaptations" rather than "design and implement feature Z."

## Common Pitfalls

### Pitfall 1: LiteLLM `extra_body` passthrough silently failing for LM Studio

**What goes wrong:** LiteLLM's `extra_body` parameter is supposed to forward arbitrary kwargs as request-body fields to the provider. Historically (LiteLLM issue #4769) this caused vLLM rejections ("Extra inputs are not permitted") because LiteLLM was wrapping the kwargs in an `extra_body` outer object instead of merging them. Issue #18039 (later) flagged the inverse for OpenAI proxy. Status in 1.83.x is **not bench-verified** by this research pass.

**Why it happens:** LM Studio's OpenAI-compatible server passes through unknown body fields to the underlying llama.cpp chat-template renderer. If LiteLLM mangles the `extra_body` payload, `enable_thinking:False` never reaches the chat template → reasoning model leaks `<think>` blocks → SC #4 fails.

**How to avoid:**
- **Wave 0 verification task:** Smoke-test that `litellm.acompletion(model="lm_studio/<id>", messages=[...], extra_body={"chat_template_kwargs": {"enable_thinking": False}}, stream=True)` actually delivers the kwarg to LM Studio. Test by loading a Qwen3-Reasoning or DeepSeek-R1 distill in LM Studio and confirming no `<think>` block appears in output.
- **If passthrough is broken:** Two recovery paths — (a) Use LiteLLM's documented `chat_template_kwargs` top-level kwarg (some providers accept this; verify), (b) Switch to `reasoning_effort="none"` if the model accepts it (LiteLLM converts to provider-specific disable per the docs verified above).
- **If both fail:** Document the limitation; fall back to a system-prompt instruction telling the model to skip thinking. This is brittle but matches D-10's "non-compliant model leaks as a visible bug" stance.

**Warning signs:**
- `<think>...</think>` appears in chat bubble output despite `extra_body={"enable_thinking": False}` set
- LM Studio server logs show no chat-template-kwargs received
- LiteLLM debug logs show the `extra_body` field flattened or dropped

**Severity:** HIGH — direct SC #4 risk. The whole D-10 strategy hinges on these params actually being delivered.

### Pitfall 2: Per-distill compliance with `enable_thinking:false`

**What goes wrong:** `enable_thinking:false` is a **chat-template directive** — only models whose chat template includes the conditional branching honor it. Confirmed honoring: Qwen3-Reasoning series. **Confirmed inconsistent:** older DeepSeek-R1 distills (pre-Jan-2025) ignore the directive and emit `<think>` regardless. The Hugging Face discussion (DeepSeek-R1-Distill-Llama-8B issue #26) explicitly states no native disable parameter exists for the official distill releases — workarounds are prompt-engineering.

**Why it happens:** Chat templates are baked into the GGUF model file at quantization time. If the original LLM-author didn't include the conditional, no API parameter can flip the behavior post-hoc.

**How to avoid:**
- **Document a "compliant model" advisory** in the LLM Setup screen (or PROVENANCE.md) listing tested-good models. CONTEXT.md flags this as a v2 UX polish item.
- **Phase 5 verification approach:** test with a *known-compliant* model (latest DeepSeek-R1 distill from late 2025+, Qwen3-Reasoning). Document the model used in the verification doc.
- **Accept the visible-bug stance** per D-10. If a user picks an old distill, `<think>` appears in chat — they switch models.

**Warning signs:**
- Test passes with one DeepSeek build, fails with another from the same family
- `<think>` appears in chat with reasoning-capable models the user expects to behave

**Severity:** MEDIUM — UX paper-cut, NOT a skeleton blocker. Stance is locked by D-10.

### Pitfall 3: `litellm.token_counter` undercounting on custom OpenAI-compat models

**What goes wrong:** `litellm.token_counter(model="lm_studio/qwen2.5-7b-instruct", messages=[...])` falls back to **tiktoken's `cl100k_base`** encoder when the model isn't in LiteLLM's registry. Llama-3 / Qwen / DeepSeek tokenizers differ — typical undercount is 5-15%. Means D-15's 75% threshold may miss actual context-window overrun.

**Why it happens:** LiteLLM ships a registry of OpenAI/Anthropic/Gemini token counts; for `lm_studio/...` and `openai/<custom>` it uses tiktoken. Tiktoken can't speak Qwen tokenizer dialect.

**How to avoid:**
- **D-16's auto-truncate-and-retry-once is the safety net.** When `ContextWindowExceededError` fires (the LLM call fails with the actual model-specific overrun), advance `_head_idx` and retry. Token counter undercount is acceptable as long as the retry exists.
- **Conservative threshold tuning:** if the planner sees frequent context overruns in dev, drop the 75% threshold to 60% — the cost is fewer turns retained, the benefit is fewer retry-and-error-banner cycles.
- **Don't try to install per-model tokenizers** in the skeleton (would require Hugging Face transformers + per-model GGUF metadata extraction). Out of scope.

**Warning signs:**
- D-16's retry path triggers in normal-conversation tests (not adversarial long-prompt tests)
- LiteLLM debug logs show "Using tiktoken fallback for unknown model"

**Severity:** LOW — graceful degradation via D-16. Worth flagging in plan-time.

### Pitfall 4: BPE-split tag extraction (PITFALLS Pitfall 5 — buffer-then-extract)

**What goes wrong:** `[joy]` arrives as token deltas `[`, `jo`, `y]`. Tag-extractor running on streaming deltas finds nothing → `[joy]` text leaks to chat bubble + `[STUB-TTS]` log. SC #3 directly tests this.

**How to avoid:**
- **OLVT-port `SentenceDivider` already solves it** — buffers the token stream until pysbd reports a *complete sentence* (or the comma-splitter for `faster_first_response`). Tag extraction then runs on the full sentence string, where `[joy]` is whole.
- **Order of operations is locked by the decorator stack:** sentence_divider first (consumes deltas, emits complete `SentenceWithTags`), then actions_extractor (sees the whole string, regex-strips brackets cleanly).
- **Adversarial test fixture for SC #3:** drive the orchestrator with a fake LLM stream yielding `["[", "jo", "y]", " hello", " ", "[hold", "-", "mic", "]", " world"]`. Assert that `display_text` is `"hello  world"` (or whitespace-collapsed) and `actions` contains exactly `[ActionIntent(kind="expression", name="joy"), ActionIntent(kind="action", name="hold-mic")]`.

**Warning signs:**
- Bracket characters appear in chat bubble during streaming
- ActionIntent log fires with `name="jo"` or `name="joy bracket"`
- Stub-TTS log line contains `[joy]` literal

**Severity:** SC #3 blocker. The whole sentence-buffered design exists to prevent this.

### Pitfall 5: LM Studio first-call latency exceeding 120s timeout (PITFALLS Pitfall 15)

**What goes wrong:** LM Studio's "JIT loading" mode loads the model into VRAM **on first request** (not at LM Studio server start). Cold-load of a 7B model takes 30-60s on a typical GPU; can hit 90s+ on first-ever load with cold disk cache. LiteLLM's per-call `timeout=120` (Phase 1's pin) absorbs this — but only just.

**Why it happens:** LM Studio defaults to JIT loading with 60min Idle TTL. After the user's first successful Test-connection in Phase 1's setup screen, the model is warm — but if the user closes LM Studio, restarts, and immediately types in chat, cold-load latency hits.

**How to avoid:**
- **Sidecar boot warmup ping** — at sidecar startup (FastAPI lifespan), after reading safeStorage and instantiating the orchestrator, fire a 1-token completion (`max_tokens=1`, `messages=[{"role":"user","content":"hi"}]`) using the same provider config. Discards result. Caches the model in VRAM. Same pattern Phase 1's setup test used.
- **Surface warmup state in UI:** during the warmup ping, the sidecar can emit a `{type:"log", level:"info", message:"[INFO] LLM warmup..."}` line that the renderer's Logs drawer surfaces. UI-SPEC says no new banner is needed (D-22 in CONTEXT, no new affordance) — the existing chat input is already disabled until WS open per Phase 1.
- **Per-call timeout=120 is the safety net** — already pinned, already exercised in Phase 1. Phase 2's `litellm.acompletion(stream=True, timeout=120)` inherits this.
- **If warmup fails** (LM Studio not running), surface as the existing Phase 1 LLM-unreachable banner (`ERRORS.LLM_UNREACHABLE_BANNER` from `01-USERFLOW.md` Flow L.1). No new copy.

**Warning signs:**
- First chat reply after sidecar boot takes >5s before *anything* happens (no Thinking… → no first sentence)
- LiteLLM debug logs show "Request timed out after 120s"
- Subsequent replies (model now warm) work in <2s

**Severity:** MEDIUM. Mitigated by warmup ping + Phase 1 timeout pin. Skeleton-blocker if BOTH fail.

### Pitfall 6: System prompt drift between turns (KV cache invalidation)

**What goes wrong:** Adding a timestamp / session-id / dynamic field to the system prompt makes it bytes-different per turn. KV cache prefix matching collapses; Anthropic prompt caching never hits; LM Studio re-evaluates the prefix every turn (latency tax).

**How to avoid:**
- **Build the system prompt EXACTLY ONCE** at sidecar lifespan-startup (FastAPI lifespan).
- **Cache the result** on `Orchestrator._system_prompt`.
- **Pass it verbatim** as `messages[0]` (or via OLVT's separate-system-arg pattern) every turn.
- **Forbidden:** any per-turn formatting with `datetime.now()`, conversation-id, retrieval-augmented context (RAG comes in MEM-01).

**Source:** PROJECT_DESIGN.md §13 KV-cache discipline; user memory `project_kv_cache_discipline` ("system prompt bytes-identical at boot").

**Warning signs:**
- Anthropic API responses show `cache_creation_input_tokens > 0` for every turn (not just the first)
- LM Studio first-token-time is identical for every turn (instead of decreasing after turn 1)

**Severity:** Skeleton-protective. Doesn't break the demo, but loses the cost/latency win the design explicitly chases.

### Pitfall 7: Force-new-message flag race with chain-end (state-reducer ordering)

**What goes wrong:** Sidecar emits `force-new-message` then `chain-end` in the same WS write batch. Renderer's WS handler processes them. If the renderer applies `chain-end` first (re-enabling input → user types and sends a new message → user-bubble lands → THEN force-new-message flag fires for the wrong assistant turn), the next assistant turn lands inside the prior turn's bubble. UI-SPEC IP-1 covers this state-machine; Phase 1's WS handler must process messages in order.

**How to avoid:**
- **Phase 1 WS dispatcher already processes messages sequentially** (verified `sidecar/src/sidecar/ws/server.py` route → handler is awaited). Renderer's WS client (`apps/renderer/src/ws/client.ts`) reads frames in order.
- **In the renderer's state reducer**, `force-new-message` ONLY sets the flag (no immediate re-render). `chain-end` re-enables input. The next *display-text from a future turn* triggers the flag-checked bubble creation. This is OLVT's pattern verbatim (`chat-history-context.tsx:88-99`).
- **No defensive code needed** if the OLVT pattern is followed. Verify with a unit test in the renderer: feed `force-new-message` → `chain-end` → user-input → display-text and assert the new display-text lands in a NEW bubble (not the prior turn's).

**Severity:** Latent skeleton-protective. Easy to hit if the planner deviates from OLVT's exact reducer logic.

### Pitfall 8: Empty `valid_tags` and the SentenceDivider's tag-tracking branch

**What goes wrong:** OLVT's `SentenceDivider` has a tag-state machine that tracks `<think>` enter/exit (only for `valid_tags=["think"]`). With `valid_tags=[]` per D-20, the tag-state branch is essentially dormant — but the code path still exists. If the LLM emits an unrelated XML-shaped substring (e.g., a mention of `<html>` in code), the tag-state machine might mis-track.

**How to avoid:**
- **Verify by reading `OpenLLM_Vtuber/src/open_llm_vtuber/utils/sentence_divider.py`** — confirm that with `valid_tags=[]`, the state machine never enters tag-tracking mode. If it does, port a small patch that early-returns when `valid_tags` is empty.
- **Adversarial fixture:** drive the divider with `"Look at <html><body></body></html> for example"`. Assert it segments as one sentence with no tag-state side effects.

**Severity:** LOW. Defensive, not blocking. Worth a unit test.

## Runtime State Inventory

> Phase 2 introduces new runtime state but no rename/refactor. State inventory is included for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — single in-memory thread per LLM-04; `_memory` lives only in process memory | None |
| Live service config | LM Studio: model already loaded by user; Phase 2 inherits Phase 1's Test-connection-validated config from safeStorage | None — Phase 1 already wires this |
| OS-registered state | None — sidecar process restart wipes orchestrator | None |
| Secrets/env vars | safeStorage'd `{provider, endpoint, apiKey, model}` from Phase 1 — read once at sidecar boot per D-22 | None — Phase 1 pattern |
| Build artifacts | None — Phase 2 adds source files only; no new build-time artifacts | None |

**New runtime state introduced in Phase 2** (in-memory only, wiped on relaunch per LLM-04):
- `Orchestrator._memory: list[dict]` — append-only conversation history
- `Orchestrator._head_idx: int` — forward-only pointer for KV-cache-aware pruning
- `Orchestrator._system_prompt: str` — bytes-identical, built once at boot
- `Orchestrator._capabilities: AvatarCapabilities` — read once from `avatars/teto/avatar.yaml` at boot
- `compositor_intent_queue: asyncio.Queue` — sidecar-internal pub-sub for Phase 4 (Phase 2 emits, no consumer; queue grows unbounded → drain on a no-op consumer task to prevent memory leak; document this in code comment)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| LM Studio | LLM-01 default provider | Assumed — user installed for Phase 1's Test-connection gate | (any) | If user picks "Custom OpenAI-compatible" instead, wires the same way |
| LiteLLM 1.83.14 | LLM gateway | ✓ (Phase 1 dependency) | 1.83.14 | — |
| FastAPI 0.136.1 | WS endpoint | ✓ (Phase 1) | 0.136.1 | — |
| pysbd 0.3.4 | sentence_divider | NEW — install via `uv add pysbd==0.3.4` | 0.3.4 | — |
| pyyaml >=6.0 | avatar.yaml loader | NEW — install via `uv add pyyaml` | 6.0.x | — |
| langdetect >=1.0.9 | sentence_divider language detection | NEW — install via `uv add langdetect` (verify if not transitive) | 1.0.9 | — |
| OLVT sibling repo | port reference | ✓ (`C:/Users/16079/Code/OpenLLM_Vtuber/`) | git head | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all required deps install cleanly via uv.

**Network egress:** None for Phase 2 functionality (LM Studio + custom OpenAI-compat are localhost). Anthropic / OpenAI / Gemini providers are stubbed disabled in Phase 1 D-06.

## Code Examples

Verified patterns from OLVT-direct sources. Each block cites the source file and line range so the planner / executor can cross-check the port.

### Example 1: 4-decorator chain stack (OLVT-port)

**Source:** `OpenLLM_Vtuber/src/open_llm_vtuber/agent/agents/basic_memory_agent.py:586-593` (verified current via Read)

```python
# apps/sidecar/src/sidecar/orchestrator/orchestrator.py
from .transformers import sentence_divider, actions_extractor, display_processor, tts_filter

async def chat_pipeline(self, user_text: str) -> AsyncIterator[SentenceOutput]:
    @tts_filter(self._tts_preprocessor_config)
    @display_processor()
    @actions_extractor(self._capabilities)            # adapted: AvatarCapabilities, not Live2dModel
    @sentence_divider(
        faster_first_response=True,
        segment_method="pysbd",
        valid_tags=[],                                 # D-20: NO "think" — D-10 disables at API
    )
    async def chat_with_memory() -> AsyncIterator[str]:
        # body: stream tokens from litellm.acompletion
        async for delta in self._llm_gateway.stream(self._build_messages(user_text), self._system_prompt):
            yield delta

    async for sentence_output in chat_with_memory():
        yield sentence_output
```

### Example 2: Orchestrator with KV-cache-aware memory + retry-once-on-overflow (D-19, D-16)

**Source-of-truth:** CONTEXT.md D-19; OLVT `basic_memory_agent.py:646` system-pass-separately pattern; LiteLLM Anthropic prompt-caching docs (verified).

```python
# apps/sidecar/src/sidecar/orchestrator/orchestrator.py (skeleton)
from contextlib import suppress
from litellm import token_counter, model_cost
from litellm.exceptions import ContextWindowExceededError

class Orchestrator:
    def __init__(self, provider_config, system_prompt, capabilities, llm_gateway):
        self._system_prompt = system_prompt              # locked at boot, bytes-identical
        self._capabilities = capabilities
        self._memory: list[dict] = []                    # append-only — never .pop(0)
        self._head_idx: int = 0                          # forward-only
        self._provider = provider_config
        self._llm = llm_gateway
        self._tts_preprocessor_config = ...              # OLVT TTSPreprocessorConfig defaults

    async def turn(self, user_text: str, ws) -> None:
        from sidecar.ws.emit import (
            emit_chain_start, emit_full_text, emit_audio_payload,
            emit_force_new_message, emit_chain_end, emit_error
        )
        await emit_chain_start(ws)
        await emit_full_text(ws, "Thinking...")          # OLVT conversation_utils.py:143

        self._memory.append({"role": "user", "content": user_text})
        send_window = self._compute_send_window()         # may advance _head_idx; never .pop

        assistant_text = ""
        try:
            async for sentence_output in self._chat_pipeline_with_window(send_window):
                # 1. Per-sentence audio-payload (audio_b64=null in Phase 2)
                actions = sentence_output.actions    # list[ActionIntent]
                payload = AudioPayloadMessage(
                    type="audio",                    # OLVT-canonical (see Discrepancies)
                    audio=None,                      # Phase 2 stub
                    volumes=[],                      # Phase 3 fills
                    slice_length=20,                 # OLVT default
                    display_text={
                        "text": sentence_output.display_text.text,
                        "name": "Teto", "avatar": "teto"},
                    actions=[a.model_dump() for a in actions],
                    sentence_id=...,
                    forwarded=False,
                )
                await emit_audio_payload(ws, payload)
                # 2. Internal pub-sub for Phase 4 (no-op consumer in Phase 2)
                for intent in actions:
                    self._compositor_queue.put_nowait(intent)
                # 3. Stub TTS log line (D-23)
                logger.info(f"[STUB-TTS] sentence_id={...} text=\"{sentence_output.tts_text}\"")
                assistant_text += sentence_output.display_text.text

        except ContextWindowExceededError:
            # D-16: aggressive prune + retry once
            self._head_idx = max(self._head_idx, len(self._memory) - 8)
            send_window = self._memory[self._head_idx:]
            try:
                async for sentence_output in self._chat_pipeline_with_window(send_window):
                    # ... same emit logic ...
                    assistant_text += sentence_output.display_text.text
            except ContextWindowExceededError:
                await emit_error(ws, "Conversation got too long and won't fit in the model "
                                     "anymore. Close the app to start fresh.")
                self._memory.pop()  # remove the user message that caused failure
                await emit_chain_end(ws)
                return

        except Exception as e:
            logger.exception("LLM call failed")
            await emit_error(ws, "The model couldn't finish that reply. Try again.")
            self._memory.pop()
            await emit_chain_end(ws)
            return

        # Append assistant turn (append-only)
        self._memory.append({"role": "assistant", "content": assistant_text})

        # Turn seal (D-04)
        await emit_force_new_message(ws)
        await emit_chain_end(ws)

    def _compute_send_window(self) -> list[dict]:
        # D-15 token-budget pruning at 75%
        model_max = model_cost.get(self._provider.model, {}).get("max_input_tokens", 8192)
        budget = int(model_max * 0.75)
        while True:
            candidate = self._memory[self._head_idx:]
            tokens = token_counter(
                model=self._provider.model,
                messages=[{"role": "system", "content": self._system_prompt}, *candidate],
            )
            if tokens <= budget or self._head_idx >= len(self._memory) - 2:
                return candidate
            self._head_idx += 2  # drop one turn-pair (user + assistant together)
```

### Example 3: LiteLLM streaming call with reasoning-disable + cache_control (D-19, D-21)

**Source-of-truth:** LiteLLM Anthropic provider docs (verified); LiteLLM reasoning_content docs (`reasoning_effort="none"` confirmed); ms-swift issue #5836 + Qwen3 discussion #1300 confirm `extra_body.chat_template_kwargs.enable_thinking=False` for vLLM/LM Studio (caveat: Pitfall 1).

```python
# apps/sidecar/src/sidecar/llm/gateway.py
import litellm
from litellm import acompletion

class LLMGateway:
    def __init__(self, provider_config):
        self._provider = provider_config  # provider, endpoint, apiKey, model

    async def stream(self, messages: list[dict], system_prompt: str):
        """
        Yield text deltas from a streaming completion call.

        Reasoning-disable params (D-10):
          - LM Studio / custom OpenAI-compat: extra_body.chat_template_kwargs.enable_thinking=False
          - Anthropic: reasoning_effort="none"  (LiteLLM 1.83.x converts to thinking={"type":"disabled"})
          - OpenAI o1/o3: reasoning_effort="minimal"
          - Gemini: no native reasoning to disable (not a reasoning model in 1.5/2.0 default)

        cache_control (D-19): system slot only in skeleton. Other providers ignore the field.
        """
        provider_model = self._build_model_string(self._provider)  # e.g. "lm_studio/qwen2.5-7b-instruct"

        # System message with cache_control on system slot
        system_msg = {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},  # Anthropic; others ignore
                }
            ],
        }

        # Common kwargs
        kwargs = {
            "model": provider_model,
            "messages": [system_msg, *messages],
            "api_base": self._provider.endpoint,
            "api_key": self._provider.apiKey or "lm-studio",
            "stream": True,
            "timeout": 120,                                 # LLM-01 cold-start absorb
        }

        # Provider-specific reasoning-disable
        if self._provider.provider in ("lm_studio", "custom_openai"):
            kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": False}}
        elif self._provider.provider == "anthropic":
            kwargs["reasoning_effort"] = "none"            # LiteLLM converts to thinking={"type":"disabled"}
        elif self._provider.provider == "openai":
            kwargs["reasoning_effort"] = "minimal"         # o1/o3 only; non-reasoning OpenAI ignores
        # Gemini: no flag — not a reasoning model in default mode

        async for chunk in await acompletion(**kwargs):
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta
```

### Example 4: ActionIntent extraction adapted from OLVT's `extract_emotion`/`extract_action`

**Source-of-truth:** `OpenLLM_Vtuber/src/open_llm_vtuber/live2d_model.py:159-185` (`extract_emotion`), `:209-236` (`extract_action`) — verified current via Read.

```python
# apps/sidecar/src/sidecar/orchestrator/transformers.py (excerpt)
from contracts.action_intent import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities

def actions_extractor(capabilities: AvatarCapabilities):
    """
    Decorator. Adapted from OLVT live2d_model.extract_emotion + extract_action.
    Searches expressions[].name first → kind="expression"; falls through to
    hotkeys[].name → kind="action". Unknown tags silently dropped (per D-13).
    """
    expression_names = {e.name.lower() for e in capabilities.expressions}
    hotkey_names = {h.name.lower() for h in capabilities.hotkeys}

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            stream = func(*args, **kwargs)
            async for item in stream:
                if isinstance(item, SentenceWithTags):
                    sentence = item
                    intents: list[ActionIntent] = []
                    if not any(t.state in [TagState.START, TagState.END] for t in sentence.tags):
                        intents = _extract_intents(sentence.text, expression_names, hotkey_names)
                    yield sentence, intents
                elif isinstance(item, dict):
                    yield item
        return wrapper
    return decorator

def _extract_intents(text: str, expression_names: set[str], hotkey_names: set[str]
                     ) -> list[ActionIntent]:
    """
    Mirrors OLVT extract_emotion/extract_action's bracket-walker.
    Single-pass left-to-right scan; case-insensitive name match.
    """
    intents = []
    lower = text.lower()
    i = 0
    while i < len(lower):
        if lower[i] != "[":
            i += 1
            continue
        end = lower.find("]", i)
        if end == -1:
            break  # unmatched [ — silently drop
        name = lower[i+1:end]
        if name in expression_names:
            intents.append(ActionIntent(kind="expression", name=name, avatar_id="teto"))
        elif name in hotkey_names:
            intents.append(ActionIntent(kind="action", name=name, avatar_id="teto"))
        # else: silently drop (D-13)
        i = end + 1
    return intents
```

### Example 5: Frontend growing-bubble reducer (UI-SPEC IP-1)

**Source-of-truth:** `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/context/chat-history-context.tsx:79-111` — verified current via Read.

```typescript
// apps/renderer/src/screens/Chat/useStreamingMessages.ts (extracted reducer)
import { useState, useCallback } from 'react';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'ai';
  type: 'text';
  timestamp: string;
}

export function useStreamingMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [forceNewMessage, setForceNewMessage] = useState(false);

  // Append a user message — always creates a new bubble
  const appendUserMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content, role: 'user', type: 'text',
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  // Append AI sentence — merges into last AI bubble unless forceNewMessage flag is set
  // OLVT-port from chat-history-context.tsx:83-111
  const appendAIMessage = useCallback((content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (forceNewMessage || !last || last.role !== 'ai' || last.type !== 'text') {
        setForceNewMessage(false);
        return [...prev, {
          id: Date.now().toString(),
          content, role: 'ai', type: 'text',
          timestamp: new Date().toISOString(),
        }];
      }
      // Merge into last AI bubble
      return [...prev.slice(0, -1), { ...last, content: last.content + content }];
    });
  }, [forceNewMessage]);

  return { messages, appendUserMessage, appendAIMessage, setForceNewMessage };
}
```

### Example 6: WS handler wiring `text-input` → orchestrator (extends Phase 1)

```python
# apps/sidecar/src/sidecar/ws/handlers.py (Phase 2 replaces echo body)
from sidecar.orchestrator.orchestrator import Orchestrator

# orchestrator instance is created once at sidecar lifespan-startup
# and stored on the FastAPI app state — see main.py
@on("text-input")
async def handle_text_input(ws: WebSocket, msg: dict) -> None:
    text = msg.get("text", "").strip()
    if not text:
        return
    orchestrator: Orchestrator = ws.app.state.orchestrator
    await orchestrator.turn(text, ws)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<think>` parser-strip at orchestrator boundary | API-level reasoning-disable via LiteLLM provider-specific kwargs | LiteLLM 1.83.x; further normalized in `reasoning_effort="none"` (Anthropic 4.6+ interpretation) | D-10 supersedes PROJECT_DESIGN.md §5.1's parser-strip mention. ROADMAP SC #4 wording needs update. |
| Anthropic prompt caching via `anthropic-beta: prompt-caching-2024-07-31` header | Automatic with `cache_control: {"type": "ephemeral"}` field on content blocks | LiteLLM 1.50+ (the header is no longer required) | No header management in our `gateway.py`; field is ignored harmlessly by other providers |
| OpenAI `reasoning_effort` valid values: `"low"`, `"medium"`, `"high"` | Now also `"none"` (disable) and `"minimal"` (for newer o3+) | LiteLLM 1.83.x; OpenAI o3 release | D-10's choice of `reasoning_effort="minimal"` for OpenAI is current |
| `pip install`-driven sidecar deps | `uv add` driven (Phase 1 standard) | uv stewardship by Astral; Phase 1 D-04 | Use `uv add` for new pyyaml/pysbd/langdetect |

**Deprecated/outdated in Phase 2 scope:**
- ROADMAP.md Phase 2 SC #4's "captured to a side channel" sub-clause (per D-10)
- PROJECT_DESIGN.md §5.1's "reasoning blocks captured into a separate stream tagged for the chat UI's per-message expand chevron" — superseded by D-10 (chevron is UX-01 v2)
- PITFALLS.md Pitfall 6's recommended "streaming `<think>`-strip state machine at orchestrator input" — superseded by D-10 (no parser at all)

## Discrepancies Found (planner must resolve)

These are concrete deltas between CONTEXT.md citations and OLVT's verified current source. The planner should choose explicit resolution.

### Discrepancy 1: WS envelope `type` value

| CONTEXT.md says | OLVT actual (`stream_audio.py:53,73` verified 2026-05-06) | Recommendation |
|-----------------|----------------------------------------------------------|----------------|
| `{type:"audio-payload", ...}` | `{type:"audio", ...}` | **Adopt OLVT-canonical `"audio"`.** The user-locked stance is OLVT-port-verbatim; renaming to `"audio-payload"` is gratuitous divergence. Update CONTEXT.md amendment + plan tasks consistently use `"audio"`. |

### Discrepancy 2: Audio base64 field name

| CONTEXT.md says | OLVT actual | Recommendation |
|-----------------|-------------|----------------|
| `audio_b64` | `audio` (`stream_audio.py:54,74`) | **Use OLVT-canonical `audio`.** Phase 2 sets `audio: null`; Phase 3 sets `audio: "<base64-string>"`. |

### Discrepancy 3: Missing OLVT envelope fields

| CONTEXT.md mentions | OLVT envelope also includes (`stream_audio.py:53-60,72-80`) | Recommendation |
|---------------------|--------------------------------------------------------------|----------------|
| `audio_b64, display_text, actions, sentence_id` | `volumes: list[float]`, `slice_length: int = 20`, `forwarded: bool = False` | **Include all OLVT fields in the contract.** Phase 2 sets `volumes=[]`, `slice_length=20`, `forwarded=false`. Phase 3 fills `volumes` from the RMS envelope (TTS-03). `forwarded` is for OLVT's broadcast pattern — `false` for our single-user skeleton, but ship the field for protocol-shape parity with OLVT (success criterion #6 in PROJECT_DESIGN.md §14). |

### Discrepancy 4: `sentence_id` field is not in OLVT's envelope

| CONTEXT.md says | OLVT envelope | Recommendation |
|-----------------|---------------|----------------|
| `sentence_id` is a top-level field | OLVT's `prepare_audio_payload` does not include `sentence_id` — sentence ordering in OLVT is via `tts_manager.py`'s indexed-slot queue (Phase 3 territory) | **Add `sentence_id` as a Phase 2 extension** (we need it for the SC #2 verification log line `[STUB-TTS] sentence_id=42 text="..."` per UI-SPEC IP-5). Document the divergence in PROVENANCE.md. Phase 5's WS-protocol-parity test (PITFALLS "Looks Done But Isn't" checklist) should accept this as an intentional skeleton-side addition. |

### Discrepancy 5: OLVT's `Actions` shape

| CONTEXT.md says | OLVT actual (`output_types.py:6-16` verified) | Recommendation |
|-----------------|-----------------------------------------------|----------------|
| `actions:{expressions, pictures, sounds} \| ActionIntent[]` | OLVT's `Actions = {expressions: list[str|int], pictures: list[str], sounds: list[str]}` — **all three fields are optional and emitted when non-None** | **D-12 already locks the divergence: we use `ActionIntent[]` not OLVT's `Actions`.** The CONTEXT.md `audio-payload.actions` field is a `list[ActionIntent]`. Document the divergence in PROVENANCE.md so plan-checker doesn't flag it. |

### Discrepancy 6: ROADMAP Phase 2 SC #4 text

| ROADMAP.md says | D-10 strategy | Recommendation |
|-----------------|---------------|----------------|
| "Switching LM Studio to a DeepSeek-R1 distill: `<think>...</think>` content is captured to a side channel and never appears in the main chat stream or in extracted ActionIntents" | API-level reasoning-disable; no parser-strip; no side channel | **Two options for the planner:** <br>**(a) Update ROADMAP.md SC #4** to: *"With a known-compliant reasoning model (latest DeepSeek-R1 distill or Qwen3-Reasoning) configured, no `<think>...</think>` content appears in the main chat stream or in extracted ActionIntents — verified by inspecting chat output during a multi-sentence reply."* This is the cleanest resolution.<br>**(b) Defer the wording update to Phase 5** and treat it as known-pending in `02-VERIFICATION.md`. Less clean. <br>**Recommendation: (a) at plan-time.** The planner has authority to amend ROADMAP wording when D-10 supersedes it. |

## Open Questions

### Q1: Does LiteLLM 1.83.14 actually pass `extra_body.chat_template_kwargs` through to LM Studio's request body?

- **What we know:** LiteLLM `extra_body` is documented; vLLM honors `chat_template_kwargs`; LM Studio's OpenAI-compat endpoint is documented as accepting unknown body fields and forwarding to llama.cpp's chat template renderer; the historical bug (issue #4769) was about LiteLLM mangling the wrap-vs-merge of `extra_body`.
- **What's unclear:** Whether the bug is fixed in 1.83.14 specifically (release notes are not enumerated at this granularity in the public docs). No bench verification was performed in this research pass.
- **Recommendation:** **Add a Wave 0 smoke test** as the first plan task: instantiate LiteLLM with LM Studio + a Qwen3-Reasoning or recent DeepSeek-R1 distill, send `extra_body={"chat_template_kwargs": {"enable_thinking": False}}` with a simple "hello" prompt, assert no `<think>` block in output. **If this test fails:** fall back to system-prompt-instruction approach (brittle, see Pitfall 2) and document the limitation. Either way, the Wave 0 smoke test is the binding source-of-truth for D-10's effectiveness.

### Q2: Does `litellm.token_counter` give *useful* numbers for `lm_studio/<id>` models?

- **What we know:** Falls back to tiktoken `cl100k_base` for unknown models; ~5-15% undercount typical for non-OpenAI tokenizers.
- **What's unclear:** Whether the undercount is severe enough to make the 75% budget threshold ineffective (e.g., consistently overruns at "75%" measurement).
- **Recommendation:** Measure during plan-time dev. If overruns happen frequently (D-16 retry triggers in normal-conversation tests), **drop threshold to 60%**. Document the tuning value in `Orchestrator.__init__` as a constant with a comment citing this research.

### Q3: How does the renderer cleanly distinguish Phase 1's `display-text` envelope from Phase 2's `audio-payload`?

- **What we know:** Phase 1's `display-text` envelope is `{type:"display-text", text:"..."}`; Phase 2's new envelope (per Discrepancy 1 recommendation) is `{type:"audio", display_text:{text, name, avatar}, audio:null, ...}`. Both carry user-visible text but in different shapes.
- **What's unclear:** Phase 2's chat reducer needs to handle BOTH (echo path may still be useful for system messages in v2; UI-SPEC keeps `display-text` for non-TTS surfaces per CONTEXT.md D-02).
- **Recommendation:** Renderer's WS dispatcher routes both `display-text` AND `audio` envelopes to the same `appendAIMessage()` reducer. Source the text from `msg.text` for `display-text` and from `msg.display_text.text` for `audio`. ~5 LOC at the WS-handler layer.

### Q4: What's the right `compositor_intent_queue` consumer for Phase 2?

- **What we know:** Per CONTEXT.md D-11, Phase 4 is the consumer. Phase 2's queue grows unbounded if nothing drains it.
- **What's unclear:** Whether to ship Phase 2 with a no-op draining task (good for memory, bad if Phase 4 wants to back-fill from queue contents) or with an unbounded queue (bad for memory, simpler to reason about).
- **Recommendation:** Ship a **no-op consumer task** that drains the queue every 100ms and discards. Documented in code as `# Phase 4 will replace this consumer`. ~15 LOC. Memory-safe + simple.

## Validation Architecture

> Skipped — `workflow.nyquist_validation: false` in `.planning/config.json`.

Current sidecar test infrastructure (Phase 1 baseline): pytest-asyncio in `sidecar/tests/`, 9 tests passing. Phase 2 adds tests under `sidecar/tests/test_actions_extractor.py` and `sidecar/tests/test_orchestrator.py` per CONTEXT.md "Claude's Discretion" SC #3 fixture. Configuration is established; no Wave 0 framework setup needed beyond what Phase 1 ships.

## Sources

### Primary (HIGH confidence — verified by direct read)

- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/agent/transformers.py`** (lines 1-227, all 4 decorators) — verified current 2026-05-06 via Read. Citations in CONTEXT.md D-20 are accurate.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/agent/output_types.py`** (lines 1-78, `Actions`, `DisplayText`, `SentenceOutput`, `AudioOutput`) — verified current via Read.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/utils/sentence_divider.py`** (608 LOC, opening 300 verified via Read) — language detection, `is_complete_sentence`, `comma_splitter`, `segment_text_by_pysbd`, `TagState`, `SentenceWithTags`, `TagInfo`. Confirms pysbd backbone with regex fallback.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/utils/tts_preprocessor.py`** (196 LOC, full read) — `tts_filter` function with `ignore_brackets`/`ignore_parentheses`/`ignore_asterisks`/`ignore_angle_brackets`/`remove_special_char` toggles. Confirms CONTEXT.md "Claude's Discretion" defaults.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/conversations/conversation_utils.py`** (lines 80-211, `handle_sentence_output`, `send_conversation_start_signals`, `finalize_conversation_turn`, `send_conversation_end_signal`) — verified current. Confirms CONTEXT.md D-03 line 143 (`Thinking...`), D-04 line 181 (`force-new-message`), lines 199-204 (`conversation-chain-end`).
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/conversations/single_conversation.py`** (174 LOC) — verified count.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/agent/agents/basic_memory_agent.py`** (lines 1-130, 580-700) — verified `_chat_function_factory` decorator stack, `chat_completion(messages, self._system)` separate-system pattern (line 646).
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/service_context.py`** (lines 420-500) — verified `construct_system_prompt` (lines 436-477), `[<insert_action_keys>]` placeholder substitution (lines 463-467).
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/live2d_model.py`** (lines 155-258) — verified `extract_emotion`, `remove_emotion_keywords`, `extract_action`, `remove_action_tags` shapes.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py`** (full read, 87 LOC) — verified `prepare_audio_payload` envelope shape: `{type:"audio", audio, volumes, slice_length, display_text, actions, forwarded}`. **This is the source-of-truth for Discrepancies 1-3.**
- **`C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/websocket_handler.py`** (lines 150-260) — `_route_message` dispatcher, initial connection messages.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/frontend-src/web/src/renderer/src/context/chat-history-context.tsx`** (lines 75-112) — verified `appendAIMessage` merge logic and `forceNewMessage` flag pattern.
- **`C:/Users/16079/Code/OpenLLM_Vtuber/prompts/utils/live2d_expression_prompt.txt`** (full read, ~30 lines) — verified `[<insert_action_keys>]` placeholder presence.
- **`sidecar/pyproject.toml`** (full read) — Phase 1 dep pins: `litellm==1.83.14`, `fastapi==0.136.1`, `uvicorn==0.46.0`, `pydantic>=2.5`, `httpx>=0.28`, `pyvts==0.3.3`.
- **`sidecar/src/sidecar/ws/handlers.py`** + **`protocol.py`** — Phase 1 WS dispatcher pattern verified.
- **LiteLLM Anthropic provider docs** ([https://docs.litellm.ai/docs/providers/anthropic](https://docs.litellm.ai/docs/providers/anthropic)) — confirms `cache_control: {"type": "ephemeral"}` on content-block array; `reasoning_effort="none"` disables thinking; native `thinking={"type":"enabled","budget_tokens":N}` accepted.
- **Anthropic prompt-caching docs** (via LiteLLM aggregation) — 5-min default TTL; 1-hour available with `ttl: "1h"`; max 4 cache breakpoints per request.

### Secondary (MEDIUM confidence — multiple sources agree)

- **LiteLLM reasoning_content docs** ([https://docs.litellm.ai/docs/reasoning_content](https://docs.litellm.ai/docs/reasoning_content)) — `reasoning_effort` valid values; Anthropic `thinking={"type":"enabled"|"disabled"}`; OpenAI `reasoning_effort` minimal/low/medium/high.
- **vLLM reasoning outputs docs** ([https://docs.vllm.ai/en/latest/features/reasoning_outputs/](https://docs.vllm.ai/en/latest/features/reasoning_outputs/)) — confirms `chat_template_kwargs.enable_thinking=False` is the vLLM/llama.cpp pattern; Qwen3 series uses `enable_thinking` key, DeepSeek-V3.1 / Granite use `thinking` key.
- **Qwen3 discussion #1300** ([https://github.com/QwenLM/Qwen3/discussions/1300](https://github.com/QwenLM/Qwen3/discussions/1300)) — confirms `extra_body={"chat_template_kwargs": {"enable_thinking": False}}` is the OpenAI-client passthrough pattern.
- **LiteLLM token counting docs** ([https://docs.litellm.ai/docs/count_tokens](https://docs.litellm.ai/docs/count_tokens)) — `litellm.token_counter(model, messages)` with tiktoken fallback; `litellm.acount_tokens()` is the newer API but `token_counter` is still supported.
- **LM Studio TTL/JIT docs** ([https://lmstudio.ai/docs/developer/core/ttl-and-auto-evict](https://lmstudio.ai/docs/developer/core/ttl-and-auto-evict)) — confirms JIT loads on first request; default 60min Idle TTL.
- **LM Studio OpenAI-compat docs** ([https://lmstudio.ai/docs/developer/openai-compat](https://lmstudio.ai/docs/developer/openai-compat)) — confirms swap-base-URL OpenAI client pattern.
- **PITFALLS.md** Pitfalls 5, 6, 14, 15 — repository-internal research, all relevant to Phase 2.
- **ARCHITECTURE.md §5** (data flow trace) — repository-internal.

### Tertiary (LOW confidence — single source / inferred / unverified)

- **LiteLLM `extra_body` passthrough behavior in 1.83.x** — historical issues #4769 and #18039 flagged bugs; current behavior NOT bench-verified by this research pass. Wave 0 smoke test is the recommended verification (Q1 above).
- **DeepSeek-R1-Distill `enable_thinking:false` compliance per release** — Hugging Face discussion #26 acknowledges no native disable param; per-distill behavior depends on chat template baked into GGUF. **Empirical, model-specific.**
- **Specific timing thresholds** (`token_counter` accuracy, 75% threshold tuning) — sane defaults; require dev-time calibration.

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — all versions verified against Phase 1's pinned `pyproject.toml` and current PyPI; no new majors required.
- **OLVT port mechanics:** HIGH — every cited line range verified by direct Read of `C:/Users/16079/Code/OpenLLM_Vtuber/`.
- **WS envelope shape:** HIGH on OLVT-canonical names (verified via `stream_audio.py`); MEDIUM on the rename/adopt recommendation (intent is clear, the planner has authority to lock).
- **LiteLLM reasoning-disable params:** HIGH on Anthropic (`reasoning_effort="none"` confirmed); MEDIUM on OpenAI (`reasoning_effort="minimal"` confirmed for o3+, may not exist for older models — fall back gracefully); MEDIUM-LOW on LM Studio `extra_body.chat_template_kwargs.enable_thinking` (Wave 0 smoke test recommended — Pitfall 1).
- **KV cache discipline:** HIGH — pattern is locked by user memory `project_kv_cache_discipline` and CONTEXT.md D-19; the code skeleton in Example 2 is verified against the OLVT separate-system-prompt pattern.
- **Pitfalls:** HIGH on those carried from PITFALLS.md (already cross-verified); MEDIUM on Pitfall 1 (LiteLLM `extra_body` passthrough) — flagged for Wave 0 verification; MEDIUM on Pitfall 3 (token counter undercount) — graceful degradation via D-16 retry.

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days for stable stack; LiteLLM 1.83.x line is the binding ceiling — when v1.84 ships, re-verify reasoning-disable param syntax)

---

*Phase: 02-conversation-pipeline*
*Researched: 2026-05-06*
