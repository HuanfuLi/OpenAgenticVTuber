# Sidecar orchestrator port provenance

Tracks OLVT files ported into `sidecar/src/sidecar/orchestrator/` with upstream
commit SHA + adaptations. Mirrors `sidecar/vendor/pyvts/PROVENANCE.md` (Phase 1
D-01 pattern).

## Upstream

- Repo: `Open-LLM-VTuber/Open-LLM-VTuber` (sibling project at
  `C:/Users/16079/Code/OpenLLM_Vtuber/`)
- License: MIT
- Verified date: 2026-05-06 (research) / <fill at 02-02 commit time>

## Files (filled by 02-02)

| Skeleton path | OLVT path | LOC | Adaptations |
|---------------|-----------|-----|-------------|
| (filled in 02-02) | | | |

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
| D4: `sentence_id` not in OLVT | Skeleton-side extension; required for [STUB-TTS] sentence trace per UI-SPEC IP-5. Documented divergence. |
| D5: OLVT `Actions{exp,pic,sou}` shape | Diverged to ActionIntent[] per CONTEXT D-12. Documented divergence. |
| D6: ROADMAP SC #4 wording | Resolved in 02-03 Task 3 (planner amends ROADMAP). |
