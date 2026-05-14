---
phase: 20
slug: renderer-voice-capture-ptt-vad-preview-ux
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
---

# Phase 20 - Validation Strategy

> Retroactive Nyquist validation for Renderer Voice Capture + PTT/VAD UX.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest for renderer/electron, pytest for sidecar/contracts |
| **Config file** | `apps/renderer/vite.config.ts`, `apps/electron-main/package.json`, `sidecar/pyproject.toml` |
| **Quick run command** | `npm --workspace apps/renderer run test -- --run voice-capture vad-controller voice-input-store ChatVoiceInput ChatStreaming Settings` |
| **Full suite command** | `npm --workspace apps/electron-main run test -- --run ipc-voice-input`; `uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_model_cache.py tests/stt/test_local_stt_runtime_dependencies.py -q`; `uv run pytest ..\packages\contracts\tests\test_codegen.py -q` from `sidecar/` |
| **Estimated runtime** | ~35 seconds for targeted Phase 20 suites |

---

## Sampling Rate

- **After every task commit:** Run the focused command listed in that task row.
- **After every plan wave:** Run the renderer quick suite plus the relevant electron, sidecar, or contract suite.
- **Before `$gsd-verify-work`:** Run all commands in the full suite command row.
- **Max feedback latency:** ~35 seconds for targeted automated checks; live hardware UAT remains manual.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01 | 01 | 1 | VIN-01, VIN-02, VIN-04, VIN-05 | N/A | Voice input readiness, permission, and final transcript contracts stay typed and preload-mediated. | unit/integration | `npm --workspace apps/electron-main run test -- --run ipc-voice-input`; `uv run pytest tests/admin/test_audio_voice_input_endpoint.py -q`; `uv run pytest ..\packages\contracts\tests\test_codegen.py -q` | yes | green |
| 20-02 | 02 | 1 | VIN-01, VIN-02, VIN-03, VIN-04 | N/A | Renderer capture state and Settings controls expose PTT-first voice input with VAD disabled by default. | unit/component | `npm --workspace apps/renderer run test -- --run voice-capture voice-input-store Settings` | yes | green |
| 20-03 | 03 | 1 | VIN-01, VIN-02, VIN-04, VIN-05, VIN-06 | N/A | Chat final voice text uses the existing text-input path unchanged and queues during active turns. | component/regression | `npm --workspace apps/renderer run test -- --run ChatVoiceInput ChatStreaming` | yes | green |
| 20-04 | 04 | 1 | VIN-01, VIN-02, VIN-03, VIN-04, VIN-05, VIN-06 | N/A | VAD auto-submit is opt-in, conservative, and shares the PTT finalization path without interrupting playback. | unit/component | `npm --workspace apps/renderer run test -- --run vad-controller ChatVoiceInput Settings` | yes | green |
| 20-05 | 05 | 2 | GAP-20-01, GAP-20-02, GAP-20-03, VIN-01, VIN-02, VIN-05 | N/A | Readiness recovery and Settings STT test state do not leave Chat stuck behind stale sidecar/config errors. | unit/component | `npm --workspace apps/renderer run test -- --run voice-input-store ChatVoiceInput Settings` | yes | green |
| 20-06 | 06 | 2 | GAP-20-04, GAP-20-05, VIN-01, VIN-02, VIN-03 | N/A | Local STT model cache state is truthful and VAD copy is separate from downloadable model state. | unit/component | `uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_model_cache.py -q`; `npm --workspace apps/renderer run test -- --run Settings` | yes | green |
| 20-07 | 07 | 2 | VIN-01, VIN-02, VIN-03 | N/A | Multi-chunk capture finalization does not assume each recorder chunk is independently decodable. | unit/component | `npm --workspace apps/renderer run test -- --run voice-capture ChatVoiceInput` | yes | green |
| 20-08 | 08 | 3 | VIN-01, VIN-03, VIN-04 | N/A | VAD exposes live level/status diagnostics without raw audio or transcript leakage. | unit/component | `npm --workspace apps/renderer run test -- --run vad-controller ChatVoiceInput Settings` | yes | green |
| 20-09 | 09 | 3 | VIN-06 | N/A | Queued voice dispatch waits for completed-turn cleanup so prior TTS/history state is not corrupted. | component/regression | `npm --workspace apps/renderer run test -- --run ChatVoiceInput ChatStreaming ConversationHistory` | yes | green |
| 20-10 | 10 | 3 | VIN-01 | N/A | Removing the active local STT model blocks Chat readiness while keeping redownload UX available. | component/regression | `npm --workspace apps/renderer run test -- --run Settings`; `uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_model_cache.py -q` | yes | green |

*Status: green = targeted automated command passed on 2026-05-14 or is covered by a passing subset listed in the audit trail.*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live microphone PTT capture | VIN-01, VIN-02, VIN-04, VIN-05 | Requires local microphone permission, installed STT provider, and real audio device behavior. | Use `20-HUMAN-UAT.md` Test 1. |
| Live microphone VAD auto-submit | VIN-03, VIN-04, VIN-05 | Requires real ambient level, microphone gain, silence timing, and human speech. | Use `20-HUMAN-UAT.md` Test 2. |
| Live active-turn playback queue | VIN-06 | Requires real app playback/turn timing and user capture during audible response. | Use `20-HUMAN-UAT.md` Test 3. |
| Live STT model/cache UX | VIN-01, VIN-03 | Requires packaged app behavior and filesystem-backed local model cache. | Use `20-HUMAN-UAT.md` Tests 6-8. |

All manual-only behaviors have automated supporting coverage and 9/9 live checks passed in `20-HUMAN-UAT.md`.

---

## Gap Analysis

| Requirement | Status | Evidence |
|-------------|--------|----------|
| VIN-01 microphone permission/readiness state | COVERED | `ChatVoiceInput`, `voice-input-store`, `ipc-voice-input`, sidecar readiness tests |
| VIN-02 PTT recording/final transcript path | COVERED | `voice-capture`, `ChatVoiceInput` |
| VIN-03 VAD opt-in/sensitivity/silence timeout | COVERED | `vad-controller`, `Settings`, `ChatVoiceInput` |
| VIN-04 preview/finalizing/error distinct from chat text | COVERED | `ChatVoiceInput`, `voice-input-store` |
| VIN-05 final STT text enters chat unchanged | COVERED | `ChatVoiceInput`, contract tests, sidecar endpoint tests |
| VIN-06 active-turn queueing | COVERED | `ChatVoiceInput`, `ChatStreaming`, `voice-input-store` |
| GAP-20-01/03 readiness recovery | COVERED | `voice-input-store`, `ChatVoiceInput` |
| GAP-20-02 Settings STT readiness persistence | COVERED | `Settings` |
| GAP-20-04/05 truthful model cache and VAD copy | COVERED | `Settings`, sidecar STT/model-cache tests |
| GAP-20-07/08 local STT integration/runtime packaging | COVERED | sidecar STT/provider/runtime tests |
| 20-08 VAD diagnostics and observability | COVERED | `vad-controller`, `ChatVoiceInput` |
| 20-09 queued voice ordering | COVERED | `ChatVoiceInput`, `ChatStreaming` |
| 20-10 model removal/redownload readiness | COVERED | `Settings`, sidecar model-cache tests |

No missing automated coverage remains for Phase 20 requirements.

---

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

Resolved gap: generated contract mirrors were stale relative to the current contract source worktree. `npm run check:contracts` regenerated `packages/contracts/ts/` and `packages/contracts/generated/`; contract unit coverage passed with `uv run pytest ..\packages\contracts\tests\test_codegen.py -q`.

### Commands Run

| Command | Result |
|---------|--------|
| `npm --workspace apps/renderer run test -- --run voice-capture vad-controller voice-input-store ChatVoiceInput ChatStreaming Settings` | PASS - 6 files, 133 tests |
| `npm --workspace apps/electron-main run test -- --run ipc-voice-input` | PASS - 1 file, 8 tests |
| `uv run pytest tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_model_cache.py tests/stt/test_local_stt_runtime_dependencies.py -q` from `sidecar/` | PASS - 21 tests |
| `uv run pytest ..\packages\contracts\tests\test_codegen.py -q` from `sidecar/` | PASS - 20 tests |
| `npm run check:contracts` | GENERATED DRIFT FOUND AND REGENERATED - see resolved gap note |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or existing test infrastructure
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s for targeted suites
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-14
