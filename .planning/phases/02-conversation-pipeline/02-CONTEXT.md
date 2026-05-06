# Phase 2: Conversation Pipeline — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a real LLM reply that streams into the chat panel sentence-by-sentence with `[joy]`-style tags extracted as `ActionIntent` (logged to the sidecar Logs drawer), the `<think>...</think>` reasoning leak suppressed at the LiteLLM call level, and a single in-memory thread that clears on relaunch. The chat surface mirrors OLVT's UX (one growing assistant bubble per turn, sealed by `force-new-message`); the WS envelope mirrors OLVT's `audio-payload` shape with `audio_b64=null` so Phase 3 fills the field without changing the contract. Stub TTS (text-to-stdout) only — no audio synthesis, no avatar motion.

Specifically:

1. With LM Studio running, typing "tell me a 3-sentence story" produces three sentences appearing sequentially in the chat panel (one growing assistant bubble that accumulates the sentences).
2. An LLM reply containing `[joy]` strips the tag from chat display AND emits a structured `ActionIntent(kind="expression", name="joy", strength=1.0, duration_ms=None, avatar_id="teto")` log line via loguru, surfaced in the Logs drawer.
3. An adversarial fixture splitting `[joy]` across token deltas (`[`, `jo`, `y]`) still extracts cleanly via OLVT's buffer-then-extract `SentenceDivider`.
4. A reasoning-model selection (compliant DeepSeek-R1 distill or Qwen3-Reasoning) does NOT emit `<think>` blocks because the LiteLLM gateway passes provider-specific reasoning-disable params at call time. **NO parser-strip safety net** — non-compliant models leak as a visible bug.
5. Closing and relaunching the app starts a fresh empty in-memory thread (sidecar process restart = orchestrator instance destroyed = `_memory` wiped).

Out of this phase: TTS audio synthesis (Phase 3 — already-decided `audio-payload.audio_b64` slot fills then), the action compositor / VTS bridge (Phase 4 — consumes ActionIntents via internal sidecar pub-sub), `<think>` chevron UX (UX-01, v2-deferred), per-message reasoning expansion, multi-thread chat (MULTI-01, deferred), profile hot-reload (MEM-01, deferred).

</domain>

<decisions>
## Implementation Decisions

### Sentence display granularity (Area A)

- **D-01: Chat-bubble grouping = port OLVT growing-bubble + force-new-message seal.** Mirror `appendAIMessage` from `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/context/chat-history-context.tsx:83-111` verbatim — successive `audio-payload.display_text` arrivals append to the last AI bubble; a `{type:"force-new-message"}` from the sidecar sets a flag so the next display-text starts a fresh bubble. Phase 1's prototype `ChatView` (root `src/shell.jsx:245-359`) currently creates one bubble per send — Phase 2 extends it to merge incoming sentence chunks into the last AI bubble until force-new-message fires. Same pattern OLVT's chat history uses; the Phase 1 chat surface is the placeholder.
- **D-02: WS envelope = port OLVT `audio-payload` verbatim, audio_b64 empty in Phase 2.** Mirror OLVT's `prepare_audio_payload` shape: `{type:"audio-payload", audio_b64, display_text:{text, name, avatar}, actions:{expressions, pictures, sounds} | ActionIntent[], sentence_id}`. Phase 2 sets `audio_b64=null`. Phase 3 fills the field, no protocol churn. The `display-text` envelope from Phase 1 (`{type:"display-text", payload:{text, sentence_id}}`) remains for non-TTS surfaces (errors, system messages, `full-text` echo). **Hand-mirrored TS lands now under `packages/contracts/ts/audio-payload.ts`** (codegen replaces in Phase 5 per SC-02).
  - *Note:* OLVT's `Actions` dataclass (`output_types.py:7-16`) uses `{expressions, pictures, sounds}`; we use the PROJECT_DESIGN §6 `ActionIntent[]` shape instead (D-12 below). The `audio-payload` envelope's `actions` field carries our richer structure — diverges from OLVT-canonical `Actions` to support Phase 4's compositor blend semantics.
- **D-03: Turn-start affordance = port OLVT's "Thinking…" echo.** On receiving `text-input`, sidecar immediately sends `{type:"control", text:"conversation-chain-start"}` then `{type:"full-text", text:"Thinking…"}` (matches `conversation_utils.py:138-143`). Frontend renders "Thinking…" inside a fresh assistant bubble; replaced on first `audio-payload.display_text` arrival. Replaces the prototype's `…` placeholder in `src/shell.jsx:314-319`.
- **D-04: Turn seal = port OLVT's `force-new-message` + `chain-end` pair.** After the orchestrator's last sentence emits, sidecar sends `{type:"force-new-message"}` then `{type:"control", text:"conversation-chain-end"}` (matches `conversation_utils.py:181, 199-204`). Frontend's `appendAIMessage` reads the flag set by `force-new-message` and starts a fresh bubble on the next AI sentence. Phase 3's TTS-complete handshake will piggy-back on this pair (`backend-synth-complete` already in OLVT).

### System prompt + tag vocabulary (Area B)

- **D-05: Persona prompt source-of-truth = `avatars/teto/personality.md`.** Forward-compat with MEM-01 (per-avatar profile loader, deferred to memory milestone). Reuses OLVT's per-avatar profile concept (OLVT pulls from `character_config.persona_prompt` in `characters/<name>.yaml`). Phase 2 reads the file once at sidecar startup; **no hot-reload** in skeleton (chokidar/watchdog comes in MEM-01). Skeleton ships a Teto-flavored persona placeholder authored by the developer.
- **D-06: System prompt assembly = port OLVT's persona + utility-prompts append pattern.** Mirror `service_context.py:436-477`'s `construct_system_prompt`:
  ```
  final_system_prompt = persona_prompt
                      + load_util("live2d_expression_prompt.txt").replace(
                          "[<insert_action_keys>]", full_action_str)
  ```
  Where `full_action_str` is `" ".join(f"[{name}]," for name in expressions[].name + hotkeys[].name)`. Skeleton ports `OpenLLM_Vtuber/prompts/utils/live2d_expression_prompt.txt` verbatim into `apps/sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` and a minimal `prompt_loader.py` (~20 LOC) that mirrors OLVT's `load_util` pattern. Maximum copyback fidelity.
  - **Do NOT include `OpenLLM_Vtuber/prompts/utils/think_tag_prompt.txt`** — that prompt encourages roleplay inner thoughts in `<think>` tags, which collides with the reasoning-disable strategy (D-10). Roleplay-think can return in v2 with a different syntax if user wants it.
- **D-07: Per-avatar capabilities file = `avatars/teto/avatar.yaml`.** Single-file per avatar that holds capabilities + voice + entrance + per-avatar settings under one roof. Adds `pyyaml` to sidecar deps (`uv add pyyaml`). Matches PROJECT_DESIGN.md §5.11's per-avatar file convention. **Distinct from `avatars/teto/teto_overrides.yaml`** (which is engineer-authored deviations for orphan-params / physics-chain proxies / sign-inversions per AVT-07; Phase 4 territory). The override file remains as designed; the capabilities file is the new primary surface for tag-vocabulary lookup.
- **D-08: Capabilities schema = VTS-shaped (expressions + hotkeys + parameters).** Mirrors VTS API responses verbatim:
  ```yaml
  # avatars/teto/avatar.yaml (skeleton placeholder; Phase 4 introspection overwrites)
  expressions:
    - name: joy
      file: joy.exp3.json
    - name: surprise
      file: surprise.exp3.json
    # ... 6+ more
  hotkeys:
    - name: hold-mic        # LLM-emittable
      type: TriggerAnimation
    - name: cry             # LLM-emittable
      type: ToggleExpression
    - name: bread-out       # LLM-emittable
      type: ToggleExpression
    # Note: meta hotkeys (RemoveWatermark, ReloadTextures) are EXCLUDED from this list.
    #       Skeleton hand-author curates which hotkeys are LLM-emittable.
    #       Phase 4's auto-introspection will need a per-hotkey `llm_emittable: bool`
    #       flag (or a developer curation step) to filter VTS-discovered hotkeys.
  parameters:
    - id: ParamMouthOpenY
    - id: ParamAngleX
    - id: ParamAngleY
    # ... full Cubism standard set + rig-specific
  voice:                    # forward-compat — Phase 3 TTS reads from here
    backend: piper
    model: en_US-amy-medium
    lipsync_mode: our-rms
  ```
  The LLM tag list = `expressions[].name + hotkeys[].name` (post-curation). Phase 4's introspection populates this from real VTS calls (`HotkeysInCurrentModelRequest`, `ExpressionStateRequest`, `InputParameterListRequest`).
- **D-09: Skeleton bootstrap content = hand-authored Teto placeholder marked auto-gen.** File header comment says "auto-generated by import pipeline — DO NOT hand-edit" (forward-compat lie — nothing auto-generates it yet). Developer authors based on inspecting the actual Teto rig in VTS → Settings → Expressions/Hotkeys panels and copy-pasting the real names (e.g., `Cry`, `Baguette`, `Remove Water Mark` are real Teto rig names per user reference). Phase 4's smoke-pass will overwrite with real introspection data. **Planner instruction to executor:** when authoring `avatars/teto/avatar.yaml`, run VTS with Teto loaded, open Settings → Expressions panel and Settings → Hotkeys panel, and copy-paste real names. Do NOT hardcode generic expression names — they must match the rig.
- **D-10: Reasoning suppression = LiteLLM call-level disable params, NO parser-strip safety net.** LiteLLM 1.83.x exposes provider-specific reasoning-disable knobs:
  - **OpenAI o1/o3:** `reasoning_effort="minimal"` (newer models) — but most users will pick a non-reasoning OpenAI model
  - **Anthropic:** `thinking={"type":"disabled"}` (default behavior anyway; explicit for clarity)
  - **LM Studio + custom OpenAI-compat:** `extra_body={"enable_thinking": False}` — Qwen3-Reasoning and recent DeepSeek-R1 distills (Jan 2025+) honor this via the chat template; older distills ignore it harmlessly
  
  Skeleton **trusts the disable param** and does NOT implement `<think>...</think>` strip at the orchestrator boundary. Side-channel reasoning capture is dropped entirely.
  - **ROADMAP Phase 2 SC #4 implication:** the success criterion's "captured to a side channel" sub-clause is dropped under this strategy. The "never appears in main chat stream" sub-clause is preserved and verified via testing with a *compliant* reasoning model (latest DeepSeek-R1 distill or Qwen3-Reasoning) where `enable_thinking:false` is honored. **Plan-time:** planner updates Phase 5 verification doc to test with a known-compliant model rather than expecting a parser to capture leaks. Non-compliant models leak `<think>` to chat as a visible bug — user's signal to switch models.

### ActionIntent surfacing (Area C)

- **D-11: ActionIntent route = bundled in `audio-payload.actions` field.** Per-sentence `audio-payload` carries `actions: ActionIntent[]` alongside `display_text` and (Phase 3) `audio_b64`. Phase 4's compositor subscribes via **internal sidecar pub-sub** (NOT the WS — per AVT-01: param-frame flow is sidecar→VTS direct, NOT through renderer). The renderer receives ActionIntents via the WS envelope only for log-panel visibility and future portal-card UX. The sidecar's orchestrator emits each `SentenceOutput` to two consumers: (1) the WS sender (frontend chat surface), (2) an in-process `compositor_intent_queue: asyncio.Queue` (Phase 4 consumes).
- **D-12: ActionIntent shape = full PROJECT_DESIGN §6 dataclass from day one.** Pydantic v2 model in `packages/contracts/py/action_intent.py`:
  ```python
  class ActionIntent(BaseModel):
      kind: Literal["expression", "action", "reaction"]
      name: str
      strength: float = 1.0
      duration_ms: int | None = None
      avatar_id: str  # always "teto" in skeleton
  ```
  Hand-mirrored TS in `packages/contracts/ts/action-intent.ts`. Phase 2 fills `kind` and `name`; defaults for the rest. Avoids one breaking schema change in Phase 4.
- **D-13: Tag → kind classification = lookup-based against avatar.yaml.** Extractor searches the tag name in `expressions[]` first → `kind="expression"`; fallback to `hotkeys[]` → `kind="action"`. `kind="reaction"` is reserved for Phase 4's UI-event-driven intents (cursor moves over avatar canvas, click on rig); Phase 2 never produces `reaction`. Unknown tags (LLM invented something not in either list) are silently dropped — matches OLVT's `extract_emotion` / `extract_action` behavior in `live2d_model.py:170-185, 209-236` and PITFALLS Pitfall 5 robustness.
- **D-14: ActionIntent log destination = sidecar stdout via loguru, surfaced in Logs drawer.** Use structured loguru calls:
  ```python
  logger.info("[INTENT] kind={kind} name={name} strength={strength} avatar={avatar_id}",
              **intent.model_dump())
  ```
  Phase 1's Logs drawer (Settings §15 toggle, already wired) tails sidecar stdout via the WS `log` envelope. **SC #2 verification:** type "hello [joy] world" → `[INTENT] kind=expression name=joy strength=1.0 avatar=teto` appears in the Logs drawer. No new WS envelope variant; reuses the Phase 1 `log` channel.

### Conversation history strategy (Area D)

- **D-15: Base strategy = token-budget pruning.** Per-turn estimation via `litellm.token_counter(model=..., messages=[system, *_memory[_head_idx:], current_user])`. When estimate exceeds **75%** of `model_context_window` (LiteLLM 1.83.x exposes this per-model via `litellm.model_cost[model]["max_input_tokens"]`), advance `_head_idx += 2` (drop one turn-pair: user + assistant) until under budget. Threshold leaves headroom for the assistant response. Planner may re-tune the 75% threshold based on empirical LM Studio behavior with the default model.
- **D-16: Overflow = auto-truncate + retry once.** On `ContextWindowExceededError` from LiteLLM (i.e., the token-budget estimate undercounted), aggressively advance `_head_idx` to keep only the last 4 turn-pairs (`_head_idx = max(_head_idx, len(_memory) - 8)`) and retry the LLM call once. If retry also fails, surface a `{type:"error", message:"Conversation too long. Close the app to start fresh."}` envelope; renderer shows a banner. **No "Reset conversation" button in skeleton** — user closes the app to clear (matches the locked "single in-memory thread, clears on relaunch" stance from LLM-04).
- **D-17: System prompt path = port OLVT's pattern: system passed separately each turn.** Mirror `self._llm.chat_completion(messages, self._system)` from `basic_memory_agent.py:646`. System prompt assembled **once at sidecar boot** from `personality.md` + appended `live2d_expression_prompt.txt` (with `[<insert_action_keys>]` substituted). System prompt is **bytes-identical** across all turns in a session — this is the cache-friendliness invariant.
- **D-18: Thread state location = orchestrator-instance attribute (OLVT pattern).** `Orchestrator._memory: list[dict]` of `{"role": "user"|"assistant", "content": str}` pairs. Single-instance, single-thread skeleton. MULTI-01 (post-skeleton) refactors this to `dict[thread_id, list[dict]]`. The "clears on relaunch" semantic is satisfied implicitly: sidecar process restart destroys the orchestrator instance.
- **D-19: KV cache discipline = append-only memory + forward-only `_head_idx`.** Critical invariant: **`_memory.pop(0)` is forbidden.** Only `_head_idx` advances when pruning. The slice `_memory[_head_idx:]` is a stable prefix turn-to-turn as long as `_head_idx` doesn't advance. Skeleton design:
  ```python
  class Orchestrator:
      def __init__(self):
          self._system_prompt = build_system_prompt()  # locked at boot
          self._memory: list[dict] = []                # append-only
          self._head_idx: int = 0                      # forward-only

      async def turn(self, user_input: str) -> AsyncIterator[SentenceOutput]:
          self._memory.append({"role": "user", "content": user_input})
          send_list = self._compute_send_window()      # may advance _head_idx; never touches tail
          assistant_text = ""
          try:
              stream = litellm.acompletion(
                  model=self._model,
                  messages=[
                      {"role": "system", "content": self._system_prompt,
                       "cache_control": {"type": "ephemeral"}},  # Anthropic; others ignore
                      *send_list,
                  ],
                  extra_body={"enable_thinking": False},   # LM Studio / custom OpenAI-compat
                  thinking={"type": "disabled"},           # Anthropic explicit
                  reasoning_effort="minimal",              # OpenAI o1/o3
                  stream=True,
                  timeout=120,                             # LLM-01 cold-start absorb
              )
              # ... pipe stream through OLVT 4-decorator chain
              # accumulate into assistant_text via tts_filter's display_text
          except ContextWindowExceededError:
              self._head_idx = max(self._head_idx, len(self._memory) - 8)
              # retry once with shorter window — same kwargs
              ...
          self._memory.append({"role": "assistant", "content": assistant_text})

      def _compute_send_window(self) -> list[dict]:
          model_max = litellm.model_cost.get(self._model, {}).get("max_input_tokens", 8192)
          budget = int(model_max * 0.75)
          while True:
              candidate = self._memory[self._head_idx:]
              tokens = litellm.token_counter(
                  model=self._model,
                  messages=[{"role":"system","content":self._system_prompt}, *candidate],
              )
              if tokens <= budget or self._head_idx >= len(self._memory) - 2:
                  return candidate
              self._head_idx += 2  # drop one turn-pair (user + assistant together)
  ```
  - `cache_control: {"type": "ephemeral"}` on system slot wins ~90% Anthropic prompt-caching cost reduction (5-min TTL). Other providers ignore the field.
  - llama.cpp (LM Studio) auto-prefix-caches identical prefixes; stable system + `_memory[_head_idx:]` prefix maximizes hit rate.
  - OpenAI's automatic prompt caching kicks in for prompts >1024 tokens with stable prefixes; 50% discount on cached portion.
  - Planner-discretion: also placing `cache_control` on the *last* user message uses Anthropic's 4-breakpoint trick for finer-grained caching. Defer to plan-time empirical evaluation.

### OLVT decorator chain (cross-cutting)

- **D-20: Port the 4-decorator OLVT chain verbatim.** From `OpenLLM_Vtuber/src/open_llm_vtuber/agent/transformers.py`:
  ```python
  @tts_filter(self._tts_preprocessor_config)         # SentenceOutput → adds tts_text (stub in Phase 2)
  @display_processor()                                # converts <think> blocks for chat display (no-op since D-10 disables them)
  @actions_extractor(avatar_capabilities)             # tag → ActionIntent via avatar.yaml lookup (D-13)
  @sentence_divider(                                  # token stream → SentenceWithTags via pysbd
      faster_first_response=True,
      segment_method="pysbd",
      valid_tags=[],                                  # NO "think" — D-10 disables at API; OLVT default ["think"] is for roleplay
  )
  async def chat_with_memory(input_data: BatchInput):
      # body: stream tokens from litellm.acompletion
      ...
  ```
  Skeleton ports `transformers.py` (227 LOC), `output_types.py` (78 LOC), and `utils/sentence_divider.py` (608 LOC) directly into `apps/sidecar/src/sidecar/orchestrator/`. The `tts_preprocessor.py` is also ported (196 LOC) for Phase 3's voice-text cleaning; in Phase 2 the `tts_filter` runs but its output is logged-to-stdout-only (stub TTS).
  - **Adaptation for our `actions_extractor`:** OLVT's version takes a `Live2dModel` instance and calls `live2d_model.extract_emotion(text) + live2d_model.extract_action(text)` returning string lists. Our version takes an `AvatarCapabilities` (from `avatar.yaml`) and emits `ActionIntent[]` with the kind classification per D-13.
  - **`valid_tags=[]` for SentenceDivider:** OLVT defaults to `["think"]` for roleplay-think handling. Our skeleton drops think-tag handling entirely (D-10) so the list is empty. SentenceDivider still works correctly with empty valid_tags — it just never finds a tag-block to track.

### Streaming LLM gateway (extends Phase 1's setup-test integration)

- **D-21: LiteLLM streaming via `litellm.acompletion(stream=True)`.** Phase 1 established `litellm.acompletion` for the setup test (`/admin/llm-test` endpoint). Phase 2 reuses the same client config (provider, endpoint, API key, model from safeStorage) but adds `stream=True` for token deltas. The 120s timeout from LLM-01 (locked in Phase 1 D-08) carries forward.
- **D-22: Provider config snapshot at sidecar boot.** Sidecar reads `safeStorage` once at startup via the Phase 1 IPC bridge to get `{provider, endpoint, apiKey, model}`. Stored in orchestrator instance. Mid-session provider change is **not supported** in skeleton — user must restart the app (matches v2-deferred "Re-test connection" surface from Phase 1 D-09).

### Stub TTS contract (preserves Phase 3 swap-in seam)

- **D-23: Stub TTS = log tts_text to stdout, omit audio_b64 from envelope.** The `tts_filter` decorator runs as in OLVT but instead of synthesizing audio, the orchestrator just logs `[STUB-TTS] {sentence_id} text="{tts_text}"` via loguru. The `audio-payload` envelope sets `audio_b64=null`. Phase 3 swaps the stub for real piper invocation + RMS envelope tap (TTS-03); the WS envelope contract stays identical.

### Claude's Discretion

User chose to defer these to research/planner judgment with documented defaults:

- **Token-budget threshold (D-15):** 75% of model context window is the proposed default. Planner may tune based on empirical observation (Llama-3-8B's 8K window with Teto's persona prompt + expression list → typical ~2K system + ~150 tokens/turn = ~30 turns before pruning kicks in). If the system prompt is unexpectedly heavy, drop to 60%; if light, push to 80%.
- **Cache breakpoint placement (D-19):** the `cache_control` marker on the system slot is mandatory (highest cache hit rate). Optional: also placing `cache_control` on the most-recent user message uses Anthropic's 4-breakpoint feature for finer-grained caching across in-flight turns. Skeleton can ship with just the system marker; planner evaluates empirical Anthropic cost telemetry if/when a user picks the Anthropic provider in v2.
- **OLVT `tts_preprocessor.py` deep port:** OLVT's tts_filter has multiple toggles (`remove_special_char`, `ignore_brackets`, `ignore_parentheses`, `ignore_asterisks`, `ignore_angle_brackets`). Skeleton can default `ignore_brackets=True, ignore_parentheses=False, ignore_asterisks=True, ignore_angle_brackets=True` per OLVT defaults. Planner verifies these against the SC #3 adversarial-token fixture.
- **Pydantic discriminated union extension:** Phase 1 ships `WSMessage` with `text-input | display-text | shutdown` variants. Phase 2 adds `audio-payload`, `control` (with `text` field for chain-start/end and start-mic), `full-text`, `force-new-message`, `error`, `log` variants. Planner decides whether to keep one big discriminated union or split into directional unions (client→server, server→client). OLVT does it as one big dispatcher; matching that is the simpler call.
- **Test-fixture corpus for SC #3 (adversarial token tokenization):** Planner drafts the fixture set. Minimum: `[joy]` split as `[`/`jo`/`y]`; `[hold-mic]` split as `[hold`/`-`/`mic]`; nested brackets `[joy] [surprise]` split arbitrarily. Pytest-style unit tests under `apps/sidecar/tests/test_actions_extractor.py`.

### Folded Todos

None — todo cross-reference returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** OLVT files are highest authority for code reuse; PROJECT-level specs lock the contract; Phase 1 carry-forward establishes the seams Phase 2 builds on.

### OLVT source (port verbatim where applicable)

Full source tree: `C:/Users/16079/Code/OpenLLM_Vtuber/`. Read each cited file end-to-end before deriving the skeleton port.

**Conversation pipeline (highest-priority direct ports):**

- `OpenLLM_Vtuber/src/open_llm_vtuber/agent/transformers.py` (227 LOC) — `sentence_divider`, `actions_extractor`, `display_processor`, `tts_filter` decorators. Port verbatim with the `actions_extractor` adaptation noted in D-20.
- `OpenLLM_Vtuber/src/open_llm_vtuber/utils/sentence_divider.py` (608 LOC) — `SentenceDivider` class with pysbd segmentation, language detection, `valid_tags` stack, comma-split for `faster_first_response`. Port directly; `valid_tags=[]` per D-20.
- `OpenLLM_Vtuber/src/open_llm_vtuber/utils/tts_preprocessor.py` (196 LOC) — `tts_filter` text-cleanup function. Port; defaults per "Claude's Discretion" above.
- `OpenLLM_Vtuber/src/open_llm_vtuber/agent/output_types.py` (78 LOC) — `Actions`, `DisplayText`, `SentenceOutput`, `AudioOutput` dataclasses. Adapt `Actions` → `ActionIntent[]` per D-12.
- `OpenLLM_Vtuber/src/open_llm_vtuber/agent/agents/basic_memory_agent.py` lines 38-117 (init + memory pattern), 225-288 (`_to_messages` for LLM API call), 581-672 (`_chat_function_factory`). Adapt with token-budget pruning + append-only `_head_idx` per D-19.

**Orchestration shape:**

- `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/single_conversation.py` (174 LOC) — turn lifecycle, error envelopes, full-response accumulation. Skeleton's `Orchestrator.turn` mirrors `process_single_conversation`.
- `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/conversation_utils.py` lines 84-113 (`handle_sentence_output`), 133-211 (`send_conversation_start_signals`, `finalize_conversation_turn`, `send_conversation_end_signal`). The `full-text:"Thinking…"` (line 143), `force-new-message` (line 181), `conversation-chain-end` (lines 199-204) are the signals D-03 and D-04 lock.
- `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py` (183 LOC) — `TTSTaskManager` parallel synth + ordered delivery via sequence numbers. **Phase 3 reference, not Phase 2** — Phase 2's stub TTS doesn't need this. Cite for plan-checker awareness only.

**System prompt assembly:**

- `OpenLLM_Vtuber/src/open_llm_vtuber/service_context.py` lines 436-477 (`construct_system_prompt`) — persona + utility prompts append. Port the assembly logic.
- `OpenLLM_Vtuber/prompts/utils/live2d_expression_prompt.txt` — port verbatim into skeleton's `apps/sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` per D-06. The `[<insert_action_keys>]` placeholder gets substituted with the avatar.yaml-derived tag list.
- `OpenLLM_Vtuber/prompts/utils/think_tag_prompt.txt` — **DO NOT include**. Conflicts with D-10's reasoning-disable-at-source strategy.
- `OpenLLM_Vtuber/prompts/prompt_loader.py` — minimal loader pattern (`load_util(prompt_name)`); skeleton ports the function shape (~20 LOC).

**Tag extraction reference:**

- `OpenLLM_Vtuber/src/open_llm_vtuber/live2d_model.py` lines 159-185 (`extract_emotion`), 209-236 (`extract_action`), 238-258 (`remove_action_tags`). Pattern reuse for our `actions_extractor` adaptation — but driven by `avatar.yaml.expressions[].name + hotkeys[].name` lookup instead of `model_dict.json` `emotionMap` keys.

**WS envelope shape:**

- `OpenLLM_Vtuber/src/open_llm_vtuber/websocket_handler.py` lines 156-176 (initial connection messages), 239-260 (`_route_message`). The `{type, ...}` discriminated-by-type envelope is the OLVT-shape Phase 1's PLUMB-03 mirrors. Phase 2 adds new `type` values per D-02, D-03, D-04.

**Frontend chat rendering:**

- `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/context/chat-history-context.tsx` lines 83-111 (`appendAIMessage`) — growing-bubble pattern with `forceNewMessage` flag. Direct logic port to renderer (`apps/renderer/src/screens/Chat/Chat.tsx`).
- `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/services/websocket-handler.tsx` — WS message dispatcher; cite for plan-checker awareness of how OLVT's frontend handles the `audio-payload`, `force-new-message`, `conversation-chain-end` envelopes.

**Bootstrap content reference (for Teto avatar.yaml):**

- `OpenLLM_Vtuber/model_dict.json` — see `mao_pro` entry's `emotionMap` for the 8-emotion canonical set (neutral, anger, disgust, fear, joy, smirk, sadness, surprise) the LLM is reliably trained on. Skeleton's hand-authored Teto `expressions[]` should include this set (mapped to the actual Teto rig's expression files); add Teto-specific expressions on top.
- **`重音テト` (Teto) entry in model_dict.json**, if present — gives the actual Teto rig's `emotionMap`. Confirm during executor work.

### Project-level specs (decision authority)

- `PROJECT_DESIGN.md` §5.1 (Conversation orchestrator pipeline shape, sentence-by-sentence streaming UX, reasoning-block side channel — superseded by D-10's API-disable strategy)
- `PROJECT_DESIGN.md` §5.5 (LiteLLM gateway, prompt caching pass-through for Anthropic)
- `PROJECT_DESIGN.md` §5.11 (per-avatar files: `personality.md`, `voice.yaml`, etc. — D-07 unifies several into `avatar.yaml`)
- `PROJECT_DESIGN.md` §6 lines 723-737 (`ActionIntent` dataclass shape — D-12 ports verbatim; `DiscreteEvent` is Phase 4 territory)
- `PROJECT_DESIGN.md` §13.117 (Anthropic prompt-caching pass-through via LiteLLM — supports D-19)
- `PROJECT_DESIGN.md` §14 (walking-skeleton scope, success criteria #1, #2)
- `.planning/PROJECT.md` (Active requirements: LLM-04 single in-memory thread; Risks: none Phase-2-specific)
- `.planning/REQUIREMENTS.md` LLM-01, LLM-02, LLM-03, LLM-04 (Phase 2's full requirement set)
- `.planning/ROADMAP.md` Phase 2 lines 44-58 (success criteria, plan structure, plan-time decisions). **Note:** SC #4's "captured to a side channel" sub-clause is dropped per D-10. Plan-time-decision item "Reasoning-UI scope" resolved here.

### Phase 1 carry-forward (seams Phase 2 extends)

- `.planning/phases/01-plumbing-process-lifecycle/01-CONTEXT.md` (LiteLLM gateway, WS envelope shape, safeStorage shape, all D-01 through D-24 from Phase 1 — especially D-06/D-07/D-10/D-23 which Phase 2 inherits and D-08's verbose TestLog pattern that the Logs drawer extends)
- `.planning/phases/01-plumbing-process-lifecycle/01-PROTOTYPE-DELTA.md` — UI prototype port-mapping. Phase 2 extends `ChatView` (root `src/shell.jsx:245-359`); the inline-SVG icons + flat aesthetic + theme system stay as Phase 1 ships them.
- `.planning/phases/01-plumbing-process-lifecycle/01-USERFLOW.md` — Flow C (Conversation), Flow D (History slide-in placeholder), Flow K (Logs drawer), Flow L.1 (LLM unreachable banner) all directly relevant to Phase 2.
- `.planning/phases/01-plumbing-process-lifecycle/01-02-PLAN.md` — Phase 1's WS envelope dispatch pattern (`@on("text-input")` decorator at `sidecar/src/sidecar/ws/handlers.py`). Phase 2 adds new handlers and new WS-out emissions to this pattern.

### Research outputs

- `.planning/research/PITFALLS.md` Pitfall 5 (BPE tokenization breaks across LLM streaming boundaries — informs SC #3 adversarial fixture)
- `.planning/research/PITFALLS.md` Pitfall 6 (`<think>` blocks confuse the sentence pipeline — D-10 supersedes the recommended parser-strip mitigation)
- `.planning/research/ARCHITECTURE.md` §2.3 (sidecar internal modules — `app/orchestrator/`, `app/llm/gateway.py`, `app/contracts/`)
- `.planning/research/ARCHITECTURE.md` §5 (data-flow trace one user message end-to-end — illustrative reference for Phase 2's pipeline assembly)
- `.planning/research/STACK.md` (LiteLLM 1.83.x stable line, pysbd 0.3.4, Python 3.12)

### Convention / config

- `CLAUDE.md` (project root) — locked stack (LiteLLM 1.83.14, pysbd 0.3.4, Python 3.12), package-management discipline
- `.planning/STATE.md` — current phase position, blockers/concerns

### External (no in-repo path — paste URL in plans)

- LiteLLM reasoning content / disable-thinking pass-through: https://docs.litellm.ai/docs/reasoning_content
- LiteLLM Anthropic prompt caching pass-through: https://docs.litellm.ai/docs/providers/anthropic#prompt-caching
- LiteLLM model context window registry (per-model `max_input_tokens`): https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window_backup.json
- VTube Studio API spec — `HotkeysInCurrentModelRequest`, `ExpressionStateRequest`, `InputParameterListRequest`: https://github.com/DenchiSoft/VTubeStudio
- pysbd documentation: https://github.com/nipunsadvilkar/pySBD
- Anthropic prompt caching (4 breakpoints, 5-min/1-hour TTL): https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from OpenLLM_Vtuber sibling repo, license-permitting MIT)

The OLVT sibling project at `C:/Users/16079/Code/OpenLLM_Vtuber/` is the source-of-truth for the conversation pipeline shape. Phase 2 ports the following modules directly:

- **`OpenLLM_Vtuber/src/open_llm_vtuber/agent/transformers.py`** (227 LOC) — 4-decorator chain. Direct port; only `actions_extractor` adapts per D-13.
- **`OpenLLM_Vtuber/src/open_llm_vtuber/utils/sentence_divider.py`** (608 LOC) — `SentenceDivider` class. Direct port. Handles BPE tokenization edge cases (PITFALLS Pitfall 5).
- **`OpenLLM_Vtuber/src/open_llm_vtuber/utils/tts_preprocessor.py`** (196 LOC) — text cleanup. Direct port; defaults from D-Claude's-Discretion.
- **`OpenLLM_Vtuber/src/open_llm_vtuber/agent/output_types.py`** (78 LOC) — dataclasses. Adapt `Actions` → `ActionIntent[]` per D-12.
- **`OpenLLM_Vtuber/prompts/utils/live2d_expression_prompt.txt`** — port verbatim per D-06.
- **`OpenLLM_Vtuber/frontend-src/web/src/renderer/src/context/chat-history-context.tsx:83-111`** — `appendAIMessage` growing-bubble logic. Direct logic port to renderer.

License compatibility: OLVT is MIT-licensed; permit-port-with-attribution. Each ported file lands with a header comment noting `# Ported from Open-LLM-VTuber (MIT) — see PROVENANCE.md` and the upstream commit SHA. PROVENANCE.md sits at `apps/sidecar/src/sidecar/orchestrator/PROVENANCE.md` listing each ported file + upstream commit SHA + adaptations made. Mirrors the `sidecar/vendor/pyvts/PROVENANCE.md` pattern Phase 1 establishes (D-01 of Phase 1).

### Established Patterns (from Phase 1)

- **WS envelope dispatch pattern**: Phase 1's `sidecar/src/sidecar/ws/protocol.py` with `@on("text-input")` decorator. Phase 2 extends this with new emission paths (the orchestrator emits `audio-payload`, `full-text`, `force-new-message`, `control:chain-start/end`, `error`, `log` envelopes via the same `websocket_send` callable).
- **safeStorage credential pattern**: Phase 1's `apps/electron-main/src/safe-storage.ts` stores `{provider, endpoint, apiKey, model, hasCompletedSetup}`. Phase 2 reads this at sidecar boot via the existing IPC bridge to configure the LiteLLM client.
- **Pydantic-first contracts**: Phase 1's `packages/contracts/py/ws_message.py` (Pydantic discriminated union) + `packages/contracts/ts/ws-message.ts` (hand-mirrored TS). Phase 2 adds `action_intent.py`, `audio_payload.py`, `sentence_output.py` (Python) plus matching TS mirrors. Hand-written TS until Phase 5's codegen replacement (SC-02).
- **Logs drawer WS log envelope**: Phase 1's `{type:"log", level, message}` envelope; tailed by the renderer's Logs drawer (Settings §15 toggle). Phase 2's loguru `[INTENT]` lines flow through the same channel.

### Integration Points

- **Renderer Chat.tsx → orchestrator**: text-input WS message; Phase 1's existing handler at `sidecar/src/sidecar/ws/handlers.py:on("text-input")` echoed; Phase 2 replaces echo body with `orchestrator.turn(text)` async-iterator that streams envelopes back.
- **Sidecar boot → orchestrator init**: when `[READY] ws://...` fires, the FastAPI lifespan startup also reads safeStorage via IPC (Phase 1 pattern), assembles the system prompt (D-06), instantiates `Orchestrator(provider_config, system_prompt, avatar_capabilities)`.
- **Orchestrator → in-process Phase 4 compositor**: `compositor_intent_queue: asyncio.Queue` is a sidecar-internal pub-sub channel; Phase 2 emits ActionIntents to this queue alongside the WS emission. Phase 4's compositor subscribes; Phase 2's queue is a no-op consumer (queue is drained but its contents discarded — until Phase 4 wires the consumer).
- **Avatar capabilities loader**: new module `apps/sidecar/src/sidecar/avatar/capabilities.py`. Loads `avatars/teto/avatar.yaml` at sidecar boot via PyYAML (`uv add pyyaml`); validates against a Pydantic `AvatarCapabilities` schema; exposes `expressions: list[Expression]`, `hotkeys: list[Hotkey]`, `parameters: list[Parameter]`. Used by `actions_extractor` (kind classification per D-13) and by `construct_system_prompt` (LLM tag-vocabulary string per D-06).
- **Chat history wipe on relaunch**: implicit. Sidecar process restart destroys `Orchestrator._memory`; no explicit reset path needed.

</code_context>

<specifics>
## Specific Ideas

- **OLVT decorator chain reuse over hand-rolled.** The user explicitly directed reuse of the OLVT sibling project as the implementation reference. The 4-decorator chain (`sentence_divider` → `actions_extractor` → `display_processor` → `tts_filter`) ports verbatim with one structural adaptation: `actions_extractor` reads from `avatar.yaml` capabilities instead of OLVT's `model_dict.json` emotionMap. The 608-LOC `SentenceDivider` ports unchanged.
- **Teto rig hotkey examples are specific and rig-derived, not invented.** The user mentioned "Remove Water Mark", "Cry", "Baguette" as concrete hotkey names — these are real names from the actual Teto rig. The skeleton's hand-authored `avatars/teto/avatar.yaml` placeholder must reflect the *actual* rig (planner: instruct executor to load Teto in VTS and copy real names from Settings → Expressions/Hotkeys panels). Generic placeholders like `Expression1`/`Hotkey1` are explicitly wrong.
- **Reasoning suppression diverges from initial PROJECT_DESIGN intent.** PROJECT_DESIGN §5.1 and PITFALLS Pitfall 6 both assume parser-strip-with-side-channel-capture. D-10 supersedes this with API-level disable, dropping the parser entirely. The trade-off is accepted: a non-compliant model leaks `<think>` to chat as a visible bug; user fixes by switching models. This stance reflects the user's "enthusiast running their own LM Studio" assumption — ROADMAP SC #4 wording needs the planner-side update for Phase 5 verification.
- **KV cache awareness is a deliberate first-class concern.** The user prompted the append-only design specifically to preserve KV cache prefix matching. Phase 2 implements this discipline (forward-only `_head_idx`, never `_memory.pop(0)`, stable system prompt at boot, Anthropic `cache_control` markers). Future memory milestone's auto-summary feature must preserve the same discipline — when summarizing, write the summary into a *new* slot at `_head_idx` rather than mutating older entries.

</specifics>

<deferred>
## Deferred Ideas

- **Per-message reasoning-expand chevron (UX-01)** — already deferred to v2 in REQUIREMENTS.md. Under D-10, no reasoning content is captured anyway, so the chevron has nothing to display in skeleton; v2 milestone work would also need to re-introduce a side-channel parser if the chevron is wanted.
- **"Reset conversation" button in chat surface** — D-16 surfaces an error banner on context-overflow but no functional reset button. Adding the button means an IPC path to clear `_memory`, which the skeleton doesn't otherwise need. Defer to milestone-2.
- **Auto-summarization for sliding-window context (UX-05)** — Phase 2 prunes oldest turn-pairs without summarization. UX-05's auto-summary preserves older context as a `<recent_memories>` block; that work belongs in the memory milestone where the summarizer LLM call has a home (and a budget).
- **Anthropic 4-breakpoint cache strategy** — D-19 marks system slot only. Adding the most-recent-user-message marker for finer-grained caching is in Claude's Discretion; defer to plan-time empirical evaluation.
- **Multi-thread chat per avatar (MULTI-01)** — `_memory` becomes `dict[thread_id, list[dict]]`; thread sidebar UI; LLM-auto-naming. Phase 1 D-15 and Phase 2 D-18 both pre-acknowledge this refactor. Not in skeleton scope.
- **Roleplay-think tag (`<think>...</think>` for inner thoughts)** — D-10 explicitly drops this OLVT pattern. If user wants it back in v2, use a different syntax (e.g., `*action*` for roleplay actions, never `<think>` which is now reserved for reasoning-model API behavior).
- **"Compliant reasoning model" registry** — Phase 5 verification needs to know which DeepSeek-R1 distill versions / Qwen3-Reasoning variants honor `enable_thinking:false`. A small in-app advisory list (LLM Setup screen "model recommendations" panel) could surface this, but that's UX polish for v2.

</deferred>

---

*Phase: 02-conversation-pipeline*
*Context gathered: 2026-05-06*
