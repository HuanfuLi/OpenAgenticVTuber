---
phase: 02-conversation-pipeline
plan: 02
subsystem: orchestrator
tags: [olvt-port, orchestrator, kv-cache-discipline, decorator-chain, lifespan, warmup-ping, sentence-divider, actions-extractor]

# Dependency graph
requires:
  - phase: 02-conversation-pipeline
    plan: 01
    provides: LLMGateway streaming wrapper, AudioPayloadMessage / ActionIntent contracts, AvatarCapabilities loader, WSMessage union extended with audio + control + full-text + force-new-message + error + log variants, Orchestrator PROVENANCE.md scaffolding
provides:
  - Orchestrator class with append-only `_memory` + forward-only `_head_idx` + system_prompt frozen at boot (D-17/D-18/D-19)
  - OLVT 4-decorator chain ported (sentence_divider 614 LOC verbatim; tts_preprocessor 184 LOC verbatim minus translator dep; transformers 291 LOC with adapted actions_extractor)
  - turn(text, ws) emits OLVT-canonical envelope sequence: chain-start -> full-text(Thinking...) -> audio(audio=null, sentence_id=N)* -> force-new-message -> chain-end
  - ContextWindowExceededError retry-once + CONTEXT_OVERFLOW banner; generic exception STREAM_ERROR banner; failed user message REMAINS in _memory (Warning A precision)
  - Typed WS emission helpers (sidecar/src/sidecar/ws/emit.py)
  - FastAPI lifespan startup loads ProviderConfig from AGENTICLLMVTUBER_LLM_CONFIG_JSON env var, builds Orchestrator, fires Pitfall 5 warmup ping
  - WS handler text-input drives orchestrator.turn (echo body removed); graceful degradation when orchestrator missing
  - 23 new tests (8 sentence_divider/actions_extractor + 10 orchestrator + 5 lifespan/dispatch); SC #3 split-bracket adversarial fixture passes
affects: [02-03 renderer-streaming, 03-tts, 04-compositor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - OLVT 4-decorator chain port (sentence_divider -> actions_extractor -> display_processor -> tts_filter); _extract_intents bracket-walker keyed on AvatarCapabilities expression-then-hotkey priority
    - KV-cache discipline at code level: append-only `_memory`, forward-only `_head_idx`, bytes-identical `_system_prompt` frozen at __init__; failed user messages REMAIN in _memory (Warning A precision)
    - Display-side bracket strip in display_processor (skeleton-side adaptation): brackets never reach chat panel; OLVT version leaves stripping to renderer
    - FastAPI lifespan-built singleton on app.state.orchestrator; warmup ping fires before app.state.orchestrator is set so the race window emits config-error envelopes
    - Typed WS emission helpers (emit_audio_payload / emit_full_text / emit_chain_start / emit_chain_end / emit_force_new_message / emit_error / emit_log) replace raw send_json calls
    - conftest.py shared fixtures (`fake_gateway`, `ws_recorder` factories) per Blocker 3 (no cross-test sibling imports)

key-files:
  created:
    - sidecar/src/sidecar/orchestrator/__init__.py
    - sidecar/src/sidecar/orchestrator/output_types.py
    - sidecar/src/sidecar/orchestrator/sentence_divider.py
    - sidecar/src/sidecar/orchestrator/tts_preprocessor.py
    - sidecar/src/sidecar/orchestrator/transformers.py
    - sidecar/src/sidecar/orchestrator/prompt_loader.py
    - sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt
    - sidecar/src/sidecar/orchestrator/orchestrator.py
    - sidecar/src/sidecar/ws/emit.py
    - sidecar/tests/test_sentence_divider.py
    - sidecar/tests/test_actions_extractor.py
    - sidecar/tests/test_orchestrator_turn.py
  modified:
    - sidecar/src/sidecar/orchestrator/PROVENANCE.md (Wave 2 ports table populated; OLVT commit SHA recorded)
    - sidecar/src/sidecar/ws/server.py (FastAPI lifespan + AGENTICLLMVTUBER_LLM_CONFIG_JSON loader + warmup ping + Orchestrator on app.state)
    - sidecar/src/sidecar/ws/handlers.py (text-input echo body removed; drives orchestrator.turn; graceful no-config error envelope)
    - sidecar/tests/conftest.py (appended _FakeGateway / _WSRecorder + fake_gateway/ws_recorder fixtures)
    - sidecar/tests/test_ws_echo.py (Phase 1 echo test marked @pytest.mark.skip; sibling subprocess tests updated to assert config-error path)

key-decisions:
  - Display-side bracket-strip in display_processor (Rule-2 deviation): the SC #3 plan headline test asserts `[`/`]` never reach `display_text.text`. OLVT leaves this to the frontend; we strip on the sidecar side so the canonical envelope delivers bracket-free text to all consumers (chat, logs, future TTS).
  - Failed user messages REMAIN in `_memory` on both ContextWindowExceededError-retry-also-fails and generic-Exception paths (Warning A precision). Popping or rebinding `_memory` would violate KV-cache prefix-stability; `_compute_send_window` will prune via `_head_idx` on the next turn.
  - `_compute_send_window` wraps `litellm.token_counter` in try/except: unknown models that the registry doesn't track skip pruning and let D-16 retry-once catch any actual overflow (Pitfall 3 graceful degradation).
  - AGENTICLLMVTUBER_LLM_CONFIG_JSON env-var path chosen for sidecar config loading (Blocker per plan): the encrypted DPAPI blob remains the source of truth; electron-main writes the decrypted blob into the spawned sidecar's environment. Implementing the electron-main side is a follow-up gluing task documented in server.py docstring.
  - Phase 1 echo test_text_input_echoes preserved as @pytest.mark.skip (not deleted) so the historical envelope-shape assertion lineage stays visible in the test file.

patterns-established:
  - Pattern: OLVT 4-decorator chain ports verbatim; only actions_extractor adapts (Live2dModel -> AvatarCapabilities; Actions -> List[ActionIntent])
  - Pattern: KV-cache discipline enforced via inspect.getsource grep test (forbids `_memory.pop|__delitem__|insert|remove|clear` and `del self._memory` and `self._memory[*] =` slice rebind)
  - Pattern: FastAPI lifespan-built singletons stashed on `app.state.<name>`; WS handlers read via `getattr(ws.app.state, "<name>", None)` for graceful degradation
  - Pattern: warmup ping is best-effort (try/except + log); failures don't block startup; first user turn naturally retries

requirements-completed: [LLM-02, LLM-03, LLM-04]

# Metrics
duration: 14min
completed: 2026-05-07
---

# Phase 02 Plan 02: Conversation Orchestrator + OLVT Decorator Chain Port + Lifespan Wiring Summary

**OLVT 4-decorator chain ported verbatim (sentence_divider 614 LOC, tts_preprocessor 184 LOC, transformers 291 LOC with adapted actions_extractor); Orchestrator with append-only `_memory` + forward-only `_head_idx` enforces KV-cache discipline; FastAPI lifespan builds Orchestrator from env-var config + Pitfall-5 warmup; WS text-input drives `orchestrator.turn` end-to-end with OLVT-canonical envelope sequence and SC #3 split-bracket adversarial test passing.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-07T02:55:11Z
- **Completed:** 2026-05-07T03:09:05Z
- **Tasks:** 3
- **Files created:** 12
- **Files modified:** 5

## Accomplishments

- Verbatim port of OLVT `sentence_divider.py` (608 -> 614 LOC; only adaptation = provenance docstring header), `tts_preprocessor.py` (196 -> 184 LOC; TranslateInterface dropped, TTSPreprocessorConfig inlined), `output_types.py` (78 -> 45 LOC; Actions and AudioOutput dropped, SentenceOutput.actions: List[ActionIntent]), `prompt_loader.py` (75 -> 13 LOC; only `load_util()` ported), `live2d_expression_prompt.txt` (verbatim copy with `[<insert_action_keys>]` placeholder)
- Adapted `transformers.py`: `sentence_divider` / `display_processor` / `tts_filter` ported verbatim; `actions_extractor` adapted to `AvatarCapabilities` + `List[ActionIntent]` per CONTEXT D-13 + RESEARCH Example 4 (`_extract_intents` bracket-walker, expression-priority classification, unknown-tag silent-drop)
- Skeleton-side display_processor adaptation: strips `[tag]` brackets from chat display so SC #3 BLOCKER test passes end-to-end (brackets never reach `display_text.text` or `tts_text`)
- `Orchestrator` class with KV-cache discipline: append-only `_memory`, forward-only `_head_idx`, system_prompt frozen at `__init__` (D-17/D-18/D-19); `inspect.getsource` grep test enforces no pop/del/insert/remove/clear/slice-rebind on `_memory`
- `Orchestrator.turn(text, ws)` emits OLVT-canonical sequence per turn: `chain-start` -> `full-text("Thinking...")` -> `audio(audio=None, sentence_id=N)*` -> `force-new-message` -> `chain-end`
- D-16 `ContextWindowExceededError` handler: aggressive prune (`_head_idx = max(_head_idx, len-8)`) + retry once; on second failure emits CONTEXT_OVERFLOW banner; generic Exception emits STREAM_ERROR banner; in both failure paths the failed user message REMAINS in `_memory` (Warning A precision)
- Typed WS emission helpers (`sidecar/src/sidecar/ws/emit.py`): `emit_audio_payload` / `emit_full_text` / `emit_chain_start` / `emit_chain_end` / `emit_force_new_message` / `emit_error` / `emit_log`
- FastAPI lifespan in `sidecar/src/sidecar/ws/server.py` builds `Orchestrator` at sidecar startup from `AGENTICLLMVTUBER_LLM_CONFIG_JSON` env var + `avatars/teto/{avatar.yaml,personality.md}`; fires Pitfall 5 warmup ping (1-token completion) before installing on `app.state.orchestrator`
- `sidecar/src/sidecar/ws/handlers.py` text-input echo body replaced by `await app.state.orchestrator.turn(text, ws)`; graceful degradation emits config-error envelope when orchestrator missing
- 23 new tests (3 sentence_divider + 5 actions_extractor + 10 orchestrator + 8 lifespan/dispatch); 49 passed total + 2 skipped (LM Studio smoke unchanged + Phase 1 echo replaced); 1 skip with explicit pointer to its replacement
- PROVENANCE.md per-file table populated with skeleton path, OLVT path, LOC delta, adaptations; upstream commit `12d42d7c329a3f9ad3e39b5ca5e2c603bae277a7` recorded

## Task Commits

Each task was committed atomically (`--no-verify` per parallel-execution wave protocol):

1. **Task 1: OLVT-port output_types + sentence_divider + tts_preprocessor + transformers + prompt_loader + live2d_expression_prompt + adversarial fixture tests** -- `c7d4d4b` (feat)
2. **Task 2: Orchestrator class + ws/emit.py typed helpers + 10 orchestrator tests + conftest.py fixtures** -- `6d15fdd` (feat)
3. **Task 3: FastAPI lifespan + WS handler wiring + warmup ping + 8 lifespan/dispatch tests + Phase 1 echo skip-marker** -- `4e3d46f` (feat)

**Plan metadata commit:** to follow (this SUMMARY + STATE.md + ROADMAP.md update).

## Files Created/Modified

### Created

- `sidecar/src/sidecar/orchestrator/__init__.py` -- package marker
- `sidecar/src/sidecar/orchestrator/output_types.py` -- DisplayText + SentenceOutput dataclasses (Discrepancy 5 adaptation)
- `sidecar/src/sidecar/orchestrator/sentence_divider.py` -- 614-LOC verbatim port of OLVT `utils/sentence_divider.py`
- `sidecar/src/sidecar/orchestrator/tts_preprocessor.py` -- 184-LOC port of OLVT `utils/tts_preprocessor.py` (TranslateInterface dropped, TTSPreprocessorConfig inlined)
- `sidecar/src/sidecar/orchestrator/transformers.py` -- 291-LOC port of OLVT `agent/transformers.py` (sentence_divider/display_processor/tts_filter verbatim; actions_extractor adapted; display_processor strips brackets per SC #3)
- `sidecar/src/sidecar/orchestrator/prompt_loader.py` -- 13-LOC `load_util()` port
- `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` -- verbatim copy of OLVT prompt with `[<insert_action_keys>]` placeholder
- `sidecar/src/sidecar/orchestrator/orchestrator.py` -- Orchestrator class with KV-cache discipline + OLVT-canonical envelope sequence emit
- `sidecar/src/sidecar/ws/emit.py` -- typed WS emission helpers
- `sidecar/tests/test_sentence_divider.py` -- 3 buffer-then-extract tests (SC #3 / Pitfall 4 / Pitfall 8)
- `sidecar/tests/test_actions_extractor.py` -- 5 tests including SC #3 headline `test_full_decorator_chain_strips_brackets`
- `sidecar/tests/test_orchestrator_turn.py` -- 18 tests covering envelope sequence, append-only memory, KV-cache discipline, intent surfacing, context-overflow retry success/failure, generic exception, system-prompt freeze, log lines, lifespan helpers, WS dispatch

### Modified

- `sidecar/src/sidecar/orchestrator/PROVENANCE.md` -- Wave 2 ports table populated; OLVT commit `12d42d7c329a3f9ad3e39b5ca5e2c603bae277a7` recorded
- `sidecar/src/sidecar/ws/server.py` -- FastAPI lifespan + `_load_provider_config_from_env` + `_warmup_ping` + Orchestrator construction
- `sidecar/src/sidecar/ws/handlers.py` -- text-input drives `orchestrator.turn`; config-error envelope on no-orchestrator
- `sidecar/tests/conftest.py` -- appended `_FakeGateway` / `_WSRecorder` + `fake_gateway` / `ws_recorder` fixtures (Blocker 3)
- `sidecar/tests/test_ws_echo.py` -- Phase 1 echo test marked `@pytest.mark.skip`; sibling subprocess tests updated to assert config-error path (Phase 2 replacement for echo)

## Decisions Made

1. **Display-side bracket-strip in display_processor** (Rule-2 deviation): the SC #3 plan headline test asserts `[`/`]` never reach `display_text.text`. OLVT leaves this to the frontend renderer; we strip on the sidecar side so the canonical envelope delivers bracket-free text to all consumers (chat panel, logs, future TTS path). Documented in `transformers.py` docstring + this SUMMARY.

2. **Failed user messages REMAIN in `_memory` on failure paths** (Warning A precision; CONTEXT D-19): both `ContextWindowExceededError`-retry-also-fails and generic-`Exception` paths leave the user message in `_memory`. Popping or rebinding would violate KV-cache prefix-stability; `_compute_send_window` will prune via `_head_idx` on the next turn naturally.

3. **`_compute_send_window` wraps `litellm.token_counter` in try/except**: unknown models the LiteLLM registry doesn't track will return a `KeyError`-shaped exception. Rather than crash the turn, we skip pruning and let D-16 retry-once handle any real overflow (Pitfall 3 graceful degradation).

4. **AGENTICLLMVTUBER_LLM_CONFIG_JSON env-var path chosen for sidecar config loading**: the DPAPI-encrypted blob at `%APPDATA%/AgenticLLMVTuber/llm-config.enc` remains the source of truth; electron-main is expected to decrypt and write into the spawned sidecar's environment. The corresponding electron-main glue is a follow-up; for Phase 2 testing the env var is set manually. Documented in `server.py` `_load_provider_config_from_env` docstring.

5. **Phase 1 echo test preserved as `@pytest.mark.skip`** rather than deleted: keeps the historical envelope-shape assertion lineage visible and provides a literal pointer to the Phase 2 replacement (`test_handle_text_input_drives_orchestrator_turn_when_configured`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical functionality] Bracket-strip in display_processor for SC #3 headline test**

- **Found during:** Task 1 (writing test_full_decorator_chain_strips_brackets)
- **Issue:** The plan's SC #3 BLOCKER test asserts `"[" not in out.display_text.text`, but OLVT's `display_processor` only handles `<think>` tags -- bracket characters from `[joy]` / `[hold-mic]` would survive into `display_text.text`. Without an adaptation, the chat panel would show literal `[joy]` text.
- **Fix:** Added a non-think-tag fallback branch in `display_processor` that calls `filter_brackets(text)` before constructing `DisplayText`. This is a skeleton-side divergence from OLVT (where the renderer strips brackets) -- documented in `transformers.py` docstring.
- **Files modified:** `sidecar/src/sidecar/orchestrator/transformers.py` (added `filter_brackets` import + non-think-tag branch in display_processor wrapper)
- **Commit:** `c7d4d4b`

### Auth Gates

None encountered.

### Architectural Asks

None.

## Issues Encountered

- **`token_counter` may raise on unknown models.** When `_compute_send_window` is called with a model not in LiteLLM's `model_cost` registry (e.g., `test-model` in unit tests), `token_counter` may raise. Wrapped the call in try/except to gracefully fall through; D-16 retry-once provides the safety net. No test failed before the fix; the wrap is preventive against the Pitfall 3 (token_counter undercount) class of issues.
- **Orchestrator class slice-access regex test was overly strict initially.** First draft of `test_memory_pop_violation_absent` had `assert "self._memory[" not in src or "self._memory[self._head_idx:" in src`, which would fail because the file uses both the read-slice `self._memory[self._head_idx:]` AND the in-place candidate computation `candidate = self._memory[self._head_idx:]`. Replaced the assertion with a precise `re.compile(r"self\._memory\[[^]]*\]\s*=")` that only forbids slice-assignment-on-LHS, not slice-read-on-RHS.

## Q1 Smoke Result

Carried forward unchanged from 02-01: SKIP. Operator action documented in `sidecar/src/sidecar/orchestrator/PROVENANCE.md`. This plan does NOT exercise LM Studio (all tests use `_FakeGateway`).

## User Setup Required

For end-to-end manual validation (not blocking 02-03):
1. Launch LM Studio with a Qwen3-Reasoning or DeepSeek-R1 distill (Jan 2025+) loaded on `http://localhost:1234`
2. Set `$env:AGENTICLLMVTUBER_LLM_CONFIG_JSON='{"provider":"lm_studio","endpoint":"http://localhost:1234/v1","apiKey":"","model":"<your-model-id>"}'`
3. Run `cd sidecar; uv run python -m sidecar` -- observe `[INFO] LLM warmup...` -> `[INFO] LLM warmup complete.` -> `[READY] orchestrator initialized.`
4. Connect a WS client to the printed `ws://127.0.0.1:<port>/ws`, send `{"type":"text-input","text":"tell me a 3-sentence story"}`, observe the OLVT-canonical envelope sequence

## Next Phase Readiness

**02-03 (renderer streaming) has real envelopes to test against:**
- `audio` envelopes with `audio=None`, `volumes=[]`, `slice_length=20`, `display_text:{text,name,avatar}`, `actions:list[ActionIntent]`, `sentence_id:N`, `forwarded:False`
- `control:{text:"conversation-chain-start"}`, `full-text:{text:"Thinking..."}`, `force-new-message:{}`, `control:{text:"conversation-chain-end"}` per turn
- `error:{message:"Sidecar started without LLM configuration..."}` graceful-degradation surface
- `error:{message:"The model couldn't finish that reply..."}` STREAM_ERROR banner copy (matches UI-SPEC `CHAT.STREAM_ERROR`)
- `error:{message:"Conversation got too long..."}` CONTEXT_OVERFLOW banner copy (matches UI-SPEC `CHAT.CONTEXT_OVERFLOW`)
- Loguru `[STUB-TTS]` and `[INTENT]` log lines in stderr -- ready for the Phase 1 LogMessage tail mechanism

**Carry-forward concerns:**
- Q1 smoke test SKIP unchanged from 02-01 (operator-driven re-run before Phase 5).
- The `AGENTICLLMVTUBER_LLM_CONFIG_JSON` env-var write from electron-main side is NOT YET implemented; sidecar will report `app.state.orchestrator=None` and emit config-error envelopes until electron-main is updated. Tracked as a follow-up integration task; affects Phase 5 verification, not 02-03 development.

## Whole-Plan Verification (per plan `<verification>` section)

1. `cd sidecar && uv run pytest tests/ -v` -> 49 passed, 2 skipped, 0 failed.
2. SC #3 (split-bracket `[joy]`) PROVEN -- `test_full_decorator_chain_strips_brackets` PASSED (Task 1 commit `c7d4d4b`).
3. LLM-04 PROVEN -- `test_memory_append_only_after_turn` PASSED; fresh Orchestrator always starts with `len(_memory)==0` and `_head_idx==0`.
4. KV-cache discipline ENFORCED -- `test_memory_pop_violation_absent` PASSED; `grep -rn "_memory\.pop(0)\|_memory\.insert(0\|_memory\[:" sidecar/src/sidecar/orchestrator/` returns 0 matches.
5. OLVT-canonical envelope sequence PROVEN -- `test_emits_canonical_envelope_sequence` PASSED.
6. D-16 retry-once on context overflow PROVEN -- `test_context_overflow_retry_once_then_success` and `test_context_overflow_retry_also_fails_emits_error` both PASSED.
7. Pitfall 6 (system prompt frozen at boot) PROVEN -- `test_system_prompt_built_once` PASSED.
8. PROVENANCE.md complete -- 3 references to OLVT ports (transformers.py, sentence_divider.py, tts_preprocessor.py) recorded.
9. Importability check -- `uv run python -c "from sidecar.orchestrator.orchestrator import Orchestrator; from sidecar.orchestrator.transformers import sentence_divider, actions_extractor, display_processor, tts_filter; from sidecar.ws.emit import emit_audio_payload; print('OK')"` exits 0.

## Self-Check: PASSED

Created files verified on disk:
- sidecar/src/sidecar/orchestrator/__init__.py (FOUND)
- sidecar/src/sidecar/orchestrator/output_types.py (FOUND)
- sidecar/src/sidecar/orchestrator/sentence_divider.py (FOUND, 614 lines)
- sidecar/src/sidecar/orchestrator/tts_preprocessor.py (FOUND, 184 lines)
- sidecar/src/sidecar/orchestrator/transformers.py (FOUND, 291 lines)
- sidecar/src/sidecar/orchestrator/prompt_loader.py (FOUND)
- sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt (FOUND)
- sidecar/src/sidecar/orchestrator/orchestrator.py (FOUND)
- sidecar/src/sidecar/ws/emit.py (FOUND)
- sidecar/tests/test_sentence_divider.py (FOUND)
- sidecar/tests/test_actions_extractor.py (FOUND)
- sidecar/tests/test_orchestrator_turn.py (FOUND)

Commits verified in `git log --oneline`:
- c7d4d4b (Task 1) -- FOUND
- 6d15fdd (Task 2) -- FOUND
- 4e3d46f (Task 3) -- FOUND

---

*Phase: 02-conversation-pipeline*
*Completed: 2026-05-07*
