---
phase: 17
slug: gpt-sovits-provider-voice-presets
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-09
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for GPT-SoVITS provider, voice presets, reference-audio management, activation gates, and visible failure/fallback behavior.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Python framework** | pytest via `sidecar/pyproject.toml` |
| **Renderer framework** | Vitest via `apps/renderer/package.json` |
| **Contract check** | `npm run check:contracts` |
| **Quick run command** | `python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py -q` |
| **Full suite command** | `npm run check:contracts; npm --workspace apps/renderer run test -- --run Settings.test.tsx Chat.test.tsx; npm --workspace apps/renderer run typecheck; npm --workspace apps/electron-main run build; python -m pytest sidecar/tests/test_tts_manager.py sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py -q` |
| **Estimated runtime** | 90-180 seconds |

---

## Sampling Rate

- **After every task:** Run that task's narrow `<automated>` verification command.
- **After every wave:** Run the full suite command above, narrowed only if a documented dependency is unavailable.
- **Before `/gsd-verify-work`:** Full suite must be green, plus manual GPT-SoVITS server UAT if a server is available.
- **Max feedback latency:** 180 seconds for automated checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-* | 17-01 | 1 | PRESET-01..04, TTS-01, TTS-06 | Preset/reference config preserves referential integrity and avoids avatar catalog mutation | contract/unit | `npm run check:contracts` and Electron main preset/reference tests | No - plan creates/updates tests | pending |
| 17-02-* | 17-02 | 2 | TTS-02, TTS-04, TTS-06, PRESET-02, PRESET-03 | GPT-SoVITS HTTP failures map to typed provider errors and never silently switch provider | unit/integration | `python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py -q` | No - plan creates tests | pending |
| 17-03-* | 17-03 | 2 | TTS-03 | Stop/restart affects only app-owned process handle/tree | unit | Electron main or sidecar process lifecycle tests named by plan | No - plan creates tests | pending |
| 17-04-* | 17-04 | 3 | TTS-01..04, TTS-06, PRESET-01..04 | UI gates activation until health + audible test pass and redacts diagnostics | renderer/integration | `npm --workspace apps/renderer run test -- --run Settings.test.tsx` | Existing file updated | pending |
| 17-05-* | 17-05 | 4 | TTS-04, TTS-06, PRESET-01..04 | Failed GPT-SoVITS sentence is visible without mid-turn Piper fallback; final UAT records limits | mixed/manual | `npm --workspace apps/renderer run test -- --run Chat.test.tsx Settings.test.tsx` plus final suite | Existing files updated | pending |

---

## Wave 0 Requirements

- [ ] `sidecar/tests/tts/test_gpt_sovits_provider.py` — mocked HTTP provider tests for `/tts`, WAV decode, and typed failure mapping.
- [ ] `sidecar/tests/admin/test_audio_test_tts_endpoint.py` — health/test synthesis endpoint tests including no activation on failed test.
- [ ] Electron main tests for audio preset config, active association guards, and reference-audio import/delete guards.
- [ ] `apps/renderer/tests/Settings.test.tsx` additions for activation gates, test synthesis playback trigger, preset CRUD states, and log-panel link copy.
- [ ] `apps/renderer/tests/Chat.test.tsx` additions for visible failed-audio sentence state if chat UI is touched.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real GPT-SoVITS health + test synthesis | TTS-02, TTS-04 | Requires a user-run external GPT-SoVITS server and model | Start GPT-SoVITS externally, configure base URL, import reference audio, run health check, run `Test synthesis`, confirm audible playback without creating a chat turn. |
| App-owned launch lifecycle | TTS-03 | Depends on user-provided command/cwd and OS process behavior | Configure a harmless command or real GPT-SoVITS command, start it from the app, confirm status, stop it, and verify only that app-owned process exits. |
| Reference-audio server path accessibility | PRESET-03 | Docker/WSL/remote servers may not share filesystem namespace | Import reference audio, run test synthesis, confirm activation is blocked with reference-path failure if the server cannot read the copied path. |

---

## Validation Sign-Off

- [x] All planned tasks must include `<automated>` verify or explicit manual verification.
- [x] Sampling continuity requires no 3 consecutive tasks without automated verify.
- [x] Wave 0 requirements identify all missing test files before execution.
- [x] No watch-mode flags are used in validation commands.
- [x] Feedback latency target is under 180 seconds for focused checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-09
