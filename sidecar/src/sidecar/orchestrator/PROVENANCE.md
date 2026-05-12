# Sidecar orchestrator port provenance

Tracks OLVT files ported into `sidecar/src/sidecar/orchestrator/` with upstream
commit SHA + adaptations. Mirrors `sidecar/vendor/pyvts/PROVENANCE.md` (Phase 1
D-01 pattern).

## Upstream

- Repo: `Open-LLM-VTuber/Open-LLM-VTuber` (sibling project at
  `C:/Users/16079/Code/OpenLLM_Vtuber/`)
- License: MIT
- Verified date: 2026-05-06 (research) / <fill at 02-02 commit time>

## Files (Wave 2 ports)

| Skeleton path | OLVT path | LOC | Adaptations |
|---------------|-----------|-----|-------------|
| sidecar/src/sidecar/orchestrator/output_types.py | src/open_llm_vtuber/agent/output_types.py | 78 -> ~45 | Dropped Actions and AudioOutput; SentenceOutput.actions: List[ActionIntent] (Discrepancy 5) |
| sidecar/src/sidecar/orchestrator/sentence_divider.py | src/open_llm_vtuber/utils/sentence_divider.py | 608 -> 609 | Verbatim port; provenance docstring header only (no OLVT-internal imports were used by SentenceDivider) |
| sidecar/src/sidecar/orchestrator/tts_preprocessor.py | src/open_llm_vtuber/utils/tts_preprocessor.py | 196 -> ~165 | Verbatim port + inlined TTSPreprocessorConfig dataclass (OLVT pulled from config_manager.py); removed TranslateInterface dep + translator branch (no translation in skeleton) |
| sidecar/src/sidecar/orchestrator/transformers.py | src/open_llm_vtuber/agent/transformers.py | 227 -> ~260 | sentence_divider/display_processor/tts_filter VERBATIM (only imports adjusted); actions_extractor adapted to AvatarCapabilities + List[ActionIntent] (CONTEXT D-13, D-20; RESEARCH Example 4 _extract_intents bracket-walker) |
| sidecar/src/sidecar/orchestrator/prompt_loader.py | prompts/prompt_loader.py | ~75 -> ~13 | Skeleton uses only load_util(); dropped load_persona, dropped chardet fallback |
| sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt | prompts/utils/live2d_expression_prompt.txt | ~26 lines | Verbatim copy -- preserves [<insert_action_keys>] placeholder |
| sidecar/src/sidecar/orchestrator/orchestrator.py | src/open_llm_vtuber/conversations/single_conversation.py + src/open_llm_vtuber/conversations/conversation_utils.py | ~190 -> ~240 | Phase 3 adaptation: `TTSTaskManager.speak(...)` per sentence, pending-input FIFO `_turn_loop`, and `wait_for_all_audio_complete()` before `force-new-message` + `chain-end` so sidecar-side playback drains before the UI re-enables input (D-09, D-14). |

Upstream commit SHA: `12d42d7c329a3f9ad3e39b5ca5e2c603bae277a7` (verified 2026-05-07)

## Q1 (LiteLLM extra_body passthrough) smoke result

Operator-recorded outcome of `cd sidecar && SIDECAR_SMOKE_LMSTUDIO=1 uv run pytest tests/test_gateway_smoke.py -v -s`:

- [ ] PASS -- extra_body delivered; D-10 strategy verified.
- [ ] FAIL -- recovery path: <document chosen mitigation; default per Pitfall 1
      is "system-prompt instruction" inside personality.md. Add a sentence to
      personality.md: "Do not output <think>...</think> tags or chain-of-thought.">
- [x] SKIP -- LM Studio not reachable / SMOKE_GATE unset. Re-run before Phase 5
      verification.

Operator: 02-01 executor (2026-05-06) -- LM Studio not running on localhost:1234
during plan execution. Pytest collected the smoke test and skipped it cleanly
via the `_lm_studio_reachable()` httpx pre-flight; D-10 strategy is encoded in
the gateway code (Task 3) and operator MUST re-run this with a Qwen3-Reasoning
or DeepSeek-R1 distill loaded before Phase 5 verification. If FAIL, fall back
per recovery path above.

## Discrepancies resolved (per RESEARCH.md §Discrepancies)

| ID | Resolution |
|----|------------|
| D1: type=`audio-payload` vs OLVT `audio` | Adopted OLVT-canonical `audio` per port-verbatim memory. CONTEXT-AMENDMENT.md records the change. |
| D2: `audio_b64` vs OLVT `audio` | Adopted OLVT-canonical `audio`. |
| D3: missing `volumes`/`slice_length`/`forwarded` | Included all three in AudioPayloadMessage with Phase-2 stubs (volumes=[], slice_length=20, forwarded=False). |
| D4: `sentence_id` not in OLVT | Skeleton-side extension; retained for explicit test-only no-TTS sentence traces. Documented divergence. |
| D5: OLVT `Actions{exp,pic,sou}` shape | Diverged to ActionIntent[] per CONTEXT D-12. Documented divergence. |
| D6: ROADMAP SC #4 wording | Resolved in 02-03 Task 3 (planner amends ROADMAP). |
