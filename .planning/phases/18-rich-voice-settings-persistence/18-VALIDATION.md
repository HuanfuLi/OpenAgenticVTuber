---
phase: 18
slug: rich-voice-settings-persistence
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
updated: 2026-05-14
---

# Phase 18 - Validation Strategy

> Reconstructed from Phase 18 plans, summaries, verification notes, and current test coverage.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8, Vitest 4, TypeScript, electron-vite |
| **Config file** | `sidecar/pyproject.toml`, `apps/renderer/package.json`, `apps/electron-main/package.json`, root `package.json` |
| **Quick run command** | `uv run python -m pytest tests/test_audio_config.py tests/test_audio_redaction.py tests/admin/test_audio_status_endpoint.py tests/admin/test_audio_test_tts_endpoint.py -q` from `sidecar/` |
| **Full suite command** | `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`; `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts ipc-gpt-sovits-process.test.ts safe-storage.test.ts`; `npm --workspace apps/renderer run typecheck`; `npm --workspace apps/electron-main run build` |
| **Estimated runtime** | ~75 seconds |

---

## Sampling Rate

- **After every task commit:** Run the focused command for the touched surface: sidecar pytest for audio endpoints/redaction, renderer Vitest for Settings, Electron Vitest for IPC/storage.
- **After every plan wave:** Run the full suite commands listed above.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** ~75 seconds for the reconstructed Phase 18 focused suite.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | AUDIO-01, PERF-02 | N/A | Audio contracts expose TTS/STT settings, provider capability metadata, and diagnostics fields consumed by Settings and Electron. | contract/codegen | `npm run check:contracts` | Yes | WARN - generated-contract drift exists in current dirty worktree |
| 18-01-02 | 01 | 1 | AUDIO-01, PRIV-01 | N/A | StoredConfig migrates to audio defaults while preserving existing provider, plugin, avatar, and setup data; cloud STT defaults disabled and unconsented. | unit | `npm --workspace apps/renderer run test -- --run safe-storage-migration.test.ts`; `npm --workspace apps/electron-main run test -- --run safe-storage.test.ts` | Yes | PASS |
| 18-01-03 | 01 | 1 | PRIV-01, PRIV-02 | N/A | Electron IPC/preload proxies audio catalog and STT tests without leaking cloud credentials or diagnostics. | unit | `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts` | Yes | PASS |
| 18-01-04 | 01 | 1 | PRIV-02 | N/A | Sidecar config and diagnostic redaction remove API keys, bearer tokens, user paths, and transcript-like payloads before UI/log exposure. | unit | `uv run python -m pytest tests/test_audio_config.py tests/test_audio_redaction.py -q` from `sidecar/` | Yes | PASS |
| 18-02-01 | 02 | 2 | AUDIO-01 | N/A | Settings renders Voice output/input as real operational sections with provider capability labels and without stale milestone placeholder copy. | component | `npm --workspace apps/renderer run test -- --run Settings.test.tsx` | Yes | PASS |
| 18-02-02 | 02 | 2 | PRIV-01 | N/A | Cloud STT provider rows stay blocked until separate API key and explicit cloud-audio consent are present. | component | `npm --workspace apps/renderer run test -- --run Settings.test.tsx` | Yes | PASS |
| 18-02-03 | 02 | 2 | PRIV-02 | N/A | Settings displays redacted provider diagnostics and reference-audio metadata without raw key, full path, or transcript leakage. | component | `npm --workspace apps/renderer run test -- --run Settings.test.tsx` | Yes | PASS |
| 18-03-01 | 03 | 3 | AUDIO-01, PERF-02 | N/A | Audio provider catalog/status endpoints expose provider health independently from whole-sidecar health and include latency/failure fields. | endpoint | `uv run python -m pytest tests/admin/test_audio_status_endpoint.py -q` from `sidecar/` | Yes | PASS |
| 18-03-02 | 03 | 3 | PRIV-01, PRIV-02 | N/A | STT cloud tests return blocked results without outbound provider calls when consent or credential is missing, and responses are redacted. | endpoint/unit | `uv run python -m pytest tests/admin/test_audio_status_endpoint.py -q` from `sidecar/`; `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts` | Yes | PASS |
| 18-03-03 | 03 | 3 | PERF-02, PRIV-02 | N/A | Renderer diagnostics show useful latency, timeout, blocked, and failure summaries without inferring provider health from sidecar status alone. | component | `npm --workspace apps/renderer run test -- --run Settings.test.tsx`; `npm --workspace apps/renderer run typecheck` | Yes | PASS |

*Status: PASS green - FAIL red - WARN covered but current-tree condition needs attention.*

---

## Wave 0 Requirements

Existing infrastructure covers all Phase 18 requirements.

- `sidecar/tests/test_audio_config.py`
- `sidecar/tests/test_audio_redaction.py`
- `sidecar/tests/admin/test_audio_status_endpoint.py`
- `sidecar/tests/admin/test_audio_test_tts_endpoint.py`
- `apps/renderer/tests/Settings.test.tsx`
- `apps/renderer/tests/safe-storage-migration.test.ts`
- `apps/electron-main/tests/ipc-gpt-sovits-audio.test.ts`
- `apps/electron-main/tests/ipc-gpt-sovits-process.test.ts`
- `apps/electron-main/tests/safe-storage.test.ts`

---

## Manual-Only Verifications

All Phase 18 behaviors have automated verification.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | N/A | N/A | N/A |

---

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Requirements audited | 4 |
| Coverage gaps found | 0 |
| Resolved by new tests | 0 |
| Escalated manual-only | 0 |

## Verification Results

| Command | Result |
|---------|--------|
| `uv run python -m pytest tests/test_audio_config.py tests/test_audio_redaction.py tests/admin/test_audio_status_endpoint.py tests/admin/test_audio_test_tts_endpoint.py -q` from `sidecar/` | PASS - 15 passed |
| `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts` | PASS - 2 files, 76 tests |
| `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts ipc-gpt-sovits-process.test.ts safe-storage.test.ts` | PASS - 3 files, 21 tests |
| `npm --workspace apps/renderer run typecheck` | PASS |
| `npm --workspace apps/electron-main run build` | PASS |
| `npm run check:contracts` | WARN - command regenerated contract outputs and reported diffs already present in the dirty current tree from later voice/STT work |

---

## Validation Sign-Off

- [x] All tasks have automated verification or existing Wave 0 coverage.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency under 75 seconds for focused Phase 18 coverage.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-14
