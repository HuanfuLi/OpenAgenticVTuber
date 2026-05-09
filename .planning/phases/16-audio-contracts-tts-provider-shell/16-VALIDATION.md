---
phase: 16
slug: audio-contracts-tts-provider-shell
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
updated: 2026-05-09T19:24:53-04:00
---

# Phase 16 - Validation Strategy

## Test Infrastructure

| Item | Value |
| --- | --- |
| Unit/integration frameworks | Vitest 4.1.5, pytest via uv |
| Build/contract checks | electron-vite build, package contract codegen drift check |
| Renderer config | `apps/renderer/vite.config.ts` |
| Sidecar config | `sidecar/pyproject.toml` |
| Electron config | `apps/electron-main/electron.vite.config.ts` |
| Contract codegen | `packages/contracts/scripts/run-codegen.cjs` |
| Quick validation command | `npm --workspace apps/renderer run test -- --run safe-storage-migration.test.ts ws-audio-player.test.ts ws-store-audio.test.ts` |
| Full Phase 16 validation command | `npm --workspace apps/renderer run test -- --run Settings.test.tsx AppStoreStatus.test.tsx Chat.test.tsx ws-audio-player.test.ts ws-store-audio.test.ts safe-storage-migration.test.ts && npm --workspace apps/renderer run typecheck && npm --workspace apps/electron-main run build && uv run --project sidecar python -m pytest sidecar\tests\test_audio_config.py sidecar\tests\test_tts_manager.py sidecar\tests\test_tts_gateway.py sidecar\tests\test_audio_payload_helpers.py sidecar\tests\test_sidecar_boot.py sidecar\tests\admin\test_audio_status_endpoint.py -q` |
| Expected feedback latency | About 60 seconds for the focused automated suite |

## Sampling Rate

| Boundary | Validation |
| --- | --- |
| After each task | Focused task-level unit/integration command from each task summary |
| After each execution wave | Relevant renderer, sidecar, or contract subset for changed surfaces |
| Before UAT | Phase 16 full automated subset plus manual live-audio verification |
| Gap closure | Added direct migration/config tests and reran the Phase 16 automated subset |

## Per-Task Verification Map

| Task | Requirements | Automated evidence | Status |
| --- | --- | --- | --- |
| 16-01 Audio contract and renderer event flow | `AUDIO-03`, `AUDIO-04` | `packages/contracts/tests/test_codegen.py`, `apps/renderer/tests/ws-audio-player.test.ts`, `apps/renderer/tests/ws-store-audio.test.ts`, `apps/renderer/tests/Chat.test.tsx` | Green |
| 16-02 Settings and status integration | `AUDIO-02`, `AUDIO-03` | `apps/renderer/tests/Settings.test.tsx`, `sidecar/tests/admin/test_audio_status_endpoint.py`, `apps/renderer/tests/safe-storage-migration.test.ts` | Green |
| 16-03 Sidecar TTS provider shell | `AUDIO-02`, `TTS-05`, `PERF-03` | `sidecar/tests/test_audio_config.py`, `sidecar/tests/test_tts_manager.py`, `sidecar/tests/test_tts_gateway.py`, `sidecar/tests/test_sidecar_boot.py` | Green |
| 16-04 Renderer audio playback gap | `AUDIO-04`, `TTS-05` | `apps/renderer/tests/ws-audio-player.test.ts`, `apps/renderer/tests/ws-store-audio.test.ts`, `apps/renderer/tests/Chat.test.tsx`, `sidecar/tests/test_audio_payload_helpers.py` | Green |

## Gap Analysis

| Requirement | Coverage before validation | Gap found | Resolution |
| --- | --- | --- | --- |
| `AUDIO-02` | Runtime migration and audio provider config existed | No direct test covered v1-to-v2 stored config migration or audio config env/provider factory behavior | Added `apps/renderer/tests/safe-storage-migration.test.ts` and `sidecar/tests/test_audio_config.py` |
| `AUDIO-03` | Renderer settings/status tests and sidecar admin status tests | None | Existing coverage retained |
| `AUDIO-04` | Renderer WebSocket audio playback tests and sidecar payload tests | None | Existing coverage retained |
| `TTS-05` | Gateway/manager tests and live UAT | None | Existing coverage retained |
| `PERF-03` | TTS manager async synthesis and ordering tests | None | Existing coverage retained |

## Validation Runs

| Command | Result | Notes |
| --- | --- | --- |
| `npm --workspace apps/renderer run test -- --run safe-storage-migration.test.ts` | Pass | 2 tests |
| `uv run --project sidecar python -m pytest sidecar\tests\test_audio_config.py -q` | Pass | 4 tests |
| `npm --workspace apps/renderer run test -- --run Settings.test.tsx AppStoreStatus.test.tsx Chat.test.tsx ws-audio-player.test.ts ws-store-audio.test.ts safe-storage-migration.test.ts` | Pass | 49 tests |
| `npm --workspace apps/renderer run typecheck` | Pass | Renderer typecheck |
| `npm --workspace apps/electron-main run build` | Pass | Electron main build |
| `uv run --project sidecar python -m pytest sidecar\tests\test_audio_config.py sidecar\tests\test_tts_manager.py sidecar\tests\test_tts_gateway.py sidecar\tests\test_audio_payload_helpers.py sidecar\tests\test_sidecar_boot.py sidecar\tests\admin\test_audio_status_endpoint.py -q` | Pass | 38 tests |
| `npm run check:contracts` | Blocked by unrelated worktree drift | The rerun generated Phase 17 contract outputs such as voice presets, GPT-SoVITS fields, and `failed_audio`. This is not a Phase 16 regression; the generated drift was restored and left out of Phase 16 validation commits. |

## Manual-Only Coverage

| Surface | Why manual | Evidence |
| --- | --- | --- |
| Actual audible playback through the user's device | Requires local audio output and VTS observation | `16-UAT.md` records the Phase 16 audio gap retest as passed after renderer playback wiring |
| VTS lipsync behavior with live audio | Requires VTS runtime and avatar observation | User retest reported voice and lipsync pass after 16-04 gap closure |

## Sign-off

- [x] All Phase 16 requirements have automated coverage or explicit manual coverage.
- [x] The Wave 0 validation gap was closed with direct tests.
- [x] No watch-mode commands are required for validation.
- [x] Focused validation feedback latency stays under 60 seconds.
- [x] `nyquist_compliant` is true for Phase 16.

Approved on 2026-05-09 after gap closure retest.
