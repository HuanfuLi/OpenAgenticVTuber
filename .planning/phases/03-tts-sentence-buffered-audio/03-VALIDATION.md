---
phase: 03
slug: tts-sentence-buffered-audio
status: partial
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-07
updated: 2026-05-07
---

# Phase 03 — Validation Strategy

> Retroactive Nyquist validation audit reconstructed from Phase 03 plans, summaries, verification report, and existing test infrastructure.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.x, vitest 4.x, TypeScript compiler |
| **Config file** | `sidecar/pyproject.toml`, `apps/renderer/vite.config.ts`, `apps/renderer/package.json` |
| **Quick run command** | `cd sidecar && uv run pytest tests/test_audio_payload_helpers.py tests/test_tts_gateway.py tests/test_tts_manager.py tests/test_orchestrator_turn.py tests/test_speech_mouth_driver.py -x -v` |
| **Full suite command** | `cd sidecar && uv run pytest -x -v`; `cd apps/renderer && npx tsc --noEmit`; `cd apps/renderer && npm test` |
| **Estimated runtime** | ~40 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted Phase 03 pytest subset for touched sidecar code; run renderer typecheck/tests when renderer files change.
- **After every plan wave:** Run `cd sidecar && uv run pytest -x -v`; run renderer checks if renderer files changed in the wave.
- **Before `$gsd-verify-work`:** Full sidecar suite, renderer typecheck, and renderer test suite must be green.
- **Max feedback latency:** ~40 seconds for full automated suite in this repo state.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 1 | TTS-03, TTS-04 | unit/integration | `cd sidecar && uv run pytest tests/test_audio_payload_helpers.py -x -v` | yes | green |
| 03-01-02 | 03-01 | 1 | TTS-01 | unit/integration | `cd sidecar && uv run pytest tests/test_tts_gateway.py -x -v` | yes | green |
| 03-01-03 | 03-01 | 1 | TTS-01 | integration/manual-adjacent | `cd sidecar && uv run pytest tests/test_audio_payload_helpers.py tests/test_tts_gateway.py -x -v` | yes | green |
| 03-02-01 | 03-02 | 2 | TTS-02, TTS-03 | unit/integration | `cd sidecar && uv run pytest tests/test_tts_manager.py tests/test_orchestrator_turn.py -x -v` | yes | green |
| 03-02-02 | 03-02 | 2 | TTS-01, TTS-02 | unit/integration | `cd sidecar && uv run pytest tests/test_orchestrator_turn.py -x -v` | yes | green |
| 03-02-03 | 03-02 | 2 | TTS-02 | renderer unit/DOM | `cd apps/renderer && npx tsc --noEmit`; `cd apps/renderer && npm test` | yes | green |
| 03-03-01 | 03-03 | 3 | TTS-04 | unit/integration | `cd sidecar && uv run pytest tests/test_speech_mouth_driver.py -x -v` | yes | green |
| 03-03-02 | 03-03 | 3 | TTS-04 | integration/static wiring | `cd sidecar && uv run pytest tests/test_orchestrator_turn.py tests/test_speech_mouth_driver.py -x -v` | yes | green |

*Status: pending · green · red · flaky*

---

## Requirement Coverage Map

| Requirement | Automated Coverage | Command | Result | Notes |
|-------------|--------------------|---------|--------|-------|
| TTS-01 | `test_tts_gateway.py::test_real_voice_boot`, missing-path and LFS-pointer guard tests, server warmup tests | `cd sidecar && uv run pytest tests -x -v` | pass | Verifies real model boot, warmup path, sample rate, stream open, shutdown, and startup warmup call. |
| TTS-02 | `test_tts_manager.py`, `test_orchestrator_turn.py`, renderer `Chat.test.tsx` | `cd sidecar && uv run pytest tests -x -v`; `cd apps/renderer && npm test` | pass | Verifies parallel synth, ordered send/write, drain wait, pending-input FIFO, chain-end-after-drain, and speaking UX state. |
| TTS-03 | `test_audio_payload_helpers.py`, `test_tts_manager.py` | `cd sidecar && uv run pytest tests -x -v` | pass | Verifies RMS chunking, silent fast-path, real-voice payload synthesis, and envelope publication. |
| TTS-04 | `test_speech_mouth_driver.py`, `test_orchestrator_turn.py` | `cd sidecar && uv run pytest tests -x -v` | pass | Verifies envelope interpolation, final mouth close, pyvts request shape, server mouth-driver wiring, and degraded fallback. |

---

## Wave 0 Requirements

Existing infrastructure covers all Phase 03 requirements. No Wave 0 test scaffolding is needed retroactively.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-sentence audible playback in correct order | TTS-02 | Requires live audio device and listening confirmation. | Launch the full app with LM Studio and VTube Studio running, send `Tell me a 3-sentence story.`, and confirm all sentences are spoken in order. |
| Warmup latency live comparison | TTS-01 | Cold-start latency depends on host audio/runtime state. | After a fresh launch, send one short prompt twice and compare first-audio onset using `[TTS-INIT]`, `[TTS-WRITE-START]`, and wall-clock timing. |
| Clean audio start plus visible VTS mouth motion | TTS-04 | Visible VTube Studio parameter motion and click/pop quality require live runtime observation. | Watch the avatar while sidecar speaks; confirm `ParamMouthOpenY` opens/closes with speech, returns closed at the end, and no click/pop is heard at the first ~200 ms. |

---

## Validation Audit 2026-05-07

| Metric | Count |
|--------|-------|
| Requirements audited | 4 |
| Automated coverage found | 4 |
| Gaps found | 0 |
| Resolved by new tests | 0 |
| Escalated/manual-only behaviors | 3 |

Auditor result: `## PARTIAL` because live runtime observations remain manual-only. No new test files were required.

Latest known automated verification:

- `cd sidecar && uv run pytest -x -v` -> `80 passed, 2 skipped`
- `cd apps/renderer && npx tsc --noEmit` -> passed
- `cd apps/renderer && npm test` -> `18 passed`

---

## Validation Sign-Off

- [x] All tasks have automated verify commands or existing infrastructure coverage
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated coverage approved 2026-05-07; live UAT remains tracked in `03-HUMAN-UAT.md`
