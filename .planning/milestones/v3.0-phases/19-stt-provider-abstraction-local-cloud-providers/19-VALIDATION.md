---
phase: 19
slug: stt-provider-abstraction-local-cloud-providers
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
updated: 2026-05-14
---

# Phase 19 - Validation Strategy

Per-phase validation contract reconstructed after execution from Phase 19 plans,
summaries, UAT, verification evidence, and current test infrastructure.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | pytest, Vitest, TypeScript, contract codegen |
| Config file | `sidecar/pyproject.toml`; workspace `package.json` scripts |
| Quick run command | `uv run --project sidecar python -m pytest sidecar/tests/stt/test_model_cache.py sidecar/tests/stt/test_stt_registry.py sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/admin/test_audio_stt_cloud.py -q` |
| Full suite command | `uv run --project sidecar python -m pytest sidecar/tests/stt/test_model_cache.py sidecar/tests/stt/test_stt_registry.py sidecar/tests/stt/test_funasr_provider.py sidecar/tests/stt/test_faster_whisper_provider.py sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/admin/test_audio_stt_cloud.py sidecar/tests/admin/test_audio_voice_input_endpoint.py sidecar/tests/stt/test_openai_stt_provider.py sidecar/tests/stt/test_groq_stt_provider.py -q` |
| Renderer command | `npm --workspace apps/renderer run test -- --run test-recorder Settings ChatVoiceInput` |
| Electron command | `npm --workspace apps/electron-main run test -- --run ipc-voice-input` |
| Contract command | `node packages/contracts/scripts/run-codegen.cjs` plus generated-file idempotence check |
| Estimated runtime | ~45 seconds for focused validation |

## Sampling Rate

- After every task commit: run the quick sidecar STT/admin command.
- After every plan wave: run the full sidecar STT/admin command plus affected renderer/electron tests.
- Before verification: run renderer typecheck, Electron build, and contract codegen drift check.
- Max feedback latency: ~60 seconds for focused validation.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01 | 19-01 | 1 | STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, PERF-01 | boot-heavy-import / cache-path | Provider catalog, contracts, readiness, cache, and admin skeletons exist without importing heavy STT providers at boot. | unit/integration | `uv run --project sidecar python -m pytest sidecar/tests/stt/test_model_cache.py sidecar/tests/stt/test_stt_registry.py sidecar/tests/admin/test_audio_status_endpoint.py -q` | yes | green |
| 19-02 | 19-02 | 2 | STT-01, STT-02, STT-05, STT-06, PERF-01 | lazy-local-runtime / no-fallback | Local adapters lazy-load, use explicit model cache state, block missing models, and do not fallback silently. | unit/integration | `uv run --project sidecar python -m pytest sidecar/tests/stt/test_funasr_provider.py sidecar/tests/stt/test_faster_whisper_provider.py sidecar/tests/stt/test_model_cache.py sidecar/tests/admin/test_audio_stt_local.py -q` | yes | green |
| 19-03 | 19-03 | 2 | STT-03, STT-04, STT-05, PRIV-01, PRIV-02 | cloud-consent / secret-redaction | OpenAI/Groq require consent and credentials before provider construction; diagnostics redact secrets. | unit/integration | `uv run --project sidecar python -m pytest sidecar/tests/stt/test_openai_stt_provider.py sidecar/tests/stt/test_groq_stt_provider.py sidecar/tests/admin/test_audio_stt_cloud.py sidecar/tests/test_audio_redaction.py -q` | yes | green |
| 19-04 | 19-04 | 3 | STT-05, STT-06, UX-01, PRIV-01 | settings-only-audio / no-chat-submit | Settings exposes STT test/cache controls through Electron/preload and keeps test transcription out of chat history. | UI/IPC/integration | `npm --workspace apps/renderer run test -- --run Settings test-recorder`; `npm --workspace apps/electron-main run test -- --run ipc-voice-input` | yes | green |
| 19-05 | 19-05 | 4 | STT-01, STT-02, STT-05, STT-06, PERF-01 | real-download / cache-binding | Explicit local model download writes usable app-managed files; provider construction receives resolved cache paths; invalid audio is rejected. | unit/integration | `uv run --project sidecar python -m pytest sidecar/tests/stt/test_model_cache.py sidecar/tests/stt/test_funasr_provider.py sidecar/tests/stt/test_faster_whisper_provider.py sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/admin/test_audio_voice_input_endpoint.py -q` | yes | green |
| 19-06 | 19-06 | 5 | STT-03, STT-04, STT-05, PRIV-01, PRIV-02, PERF-01 | wav-contract / event-loop-block / cloud-language | Settings sends real WAV bytes, readiness uses coherent `ready`, STT work runs off the event loop, and cloud language modes propagate. | unit/integration/UI | `uv run --project sidecar python -m pytest sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/admin/test_audio_stt_cloud.py sidecar/tests/admin/test_audio_voice_input_endpoint.py sidecar/tests/stt/test_openai_stt_provider.py sidecar/tests/stt/test_groq_stt_provider.py -q`; `npm --workspace apps/renderer run test -- --run test-recorder Settings ChatVoiceInput` | yes | green |

Status: green = command passed during this audit or in Phase 19 verification evidence.

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- No new test files were generated during this audit.
- Existing sidecar tests cover provider contracts, lazy imports, local cache/download/remove, readiness, local/cloud STT behavior, redaction, runtime voice-input integration, and codegen-relevant contracts.
- Existing renderer/electron tests cover Settings STT recording/cache controls, Chat voice-input boundary behavior, and IPC request/timeout/redaction behavior.
- Opt-in live checks exist in `sidecar/tests/stt/test_live_local_stt.py` for local-provider smoke tests when real model/audio environment variables are available.

## Manual-Only Verifications

All Phase 19 requirement coverage has automated verification. External live-provider acceptance remains documented in `19-UAT.md`:

| Behavior | Requirement | Why Not Required For Nyquist | Test Instructions |
|----------|-------------|------------------------------|-------------------|
| Real local provider live transcription | STT-01, STT-02, STT-05, STT-06 | Covered by automated boundary tests plus opt-in live pytest; `19-UAT.md` records live local acceptance passed. | Use `AGENTICLLMVTUBER_LIVE_STT_PROVIDER`, `AGENTICLLMVTUBER_LIVE_STT_MODEL_PATH`, and `AGENTICLLMVTUBER_LIVE_STT_AUDIO_WAV` with `sidecar/tests/stt/test_live_local_stt.py`. |
| OpenAI/Groq live transcription with credentials | STT-03, STT-04, PRIV-01, PRIV-02 | Phase requirement is explicit opt-in, credential gating, language propagation, and redaction; those are automated. Live cloud use was skipped by user. | Run Settings-only cloud transcription only with user-provided consent and credentials; inspect diagnostics for redaction. |

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Requirement coverage gaps found | 0 |
| New tests generated | 0 |
| Existing targeted suites rerun | 4 |
| Generated-contract drift corrected | 1 |
| Escalated manual-only requirement gaps | 0 |

Audit notes:

- `npm run check:contracts` initially exposed generated TS/schema drift against the current Python contracts.
- Running `node packages/contracts/scripts/run-codegen.cjs` updated the generated contract outputs and was confirmed idempotent by file hash.
- The repository had substantial unrelated dirty work before this audit. No unrelated files were staged or reverted.

## Validation Sign-Off

- [x] All tasks have automated verify commands.
- [x] Sampling continuity: no three consecutive tasks without automated verification.
- [x] Wave 0 is not needed because existing infrastructure covers all phase requirements.
- [x] No watch-mode flags.
- [x] Feedback latency under 60 seconds for focused validation.
- [x] `nyquist_compliant: true` set in frontmatter.

Approval: approved 2026-05-14
