---
phase: 17-gpt-sovits-provider-voice-presets
fixed_at: 2026-05-10T00:00:00Z
review_path: .planning/phases/17-gpt-sovits-provider-voice-presets/17-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

## Summary

- Fixed CR-01/CR-04 by separating health payload handling from synthesis, resolving managed reference assets in Electron main before sidecar calls, and adding sidecar managed-storage path guards.
- Fixed CR-02 by passing active voice preset/reference-audio handoff data into sidecar startup and resolving the active preset/reference before `build_tts_gateway()`.
- Fixed CR-03/WR-02 by requiring selected reference audio before test/activation, persisting imported reference audio onto presets, and adding a stop confirmation dialog.
- Fixed WR-01 with cross-tier IPC/sidecar/renderer regression coverage for the corrected request shapes and gates.

## Commits

- `0c821f8` — `fix(17): CR-01 CR-04 align GPT-SoVITS admin contracts`
- `df8b810` — `fix(17): CR-02 wire active GPT-SoVITS preset on boot`
- `8337485` — `fix(17): CR-03 WR-02 require reference association and stop confirmation`

## Verification

- `npm run check:contracts` — passed
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` — passed (45 tests)
- `npm --workspace apps/renderer run typecheck` — passed
- `npm --workspace apps/electron-main run test -- --run reference-audio.test.ts ipc-gpt-sovits-audio.test.ts ipc-gpt-sovits-process.test.ts gpt-sovits-process.test.ts safe-storage.test.ts` — passed (24 tests)
- `npm --workspace apps/electron-main run build` — passed
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py sidecar/tests/test_sidecar_boot.py -q` — passed (41 tests)

## Residual Notes

- Live GPT-SoVITS server UAT remains environment-dependent as documented in `17-UAT.md`.

## Iteration 2 Follow-up

- Resolved the remaining CR-02 activation ordering blocker by persisting the active preset association in the same stored-config save that activates GPT-SoVITS, before sidecar restart can observe the config.
- Added renderer regression coverage for activating the default first preset without a prior preset-radio click, while preserving explicit Piper selection/no silent fallback behavior.
- Verification: `npm --workspace apps/renderer run test -- --run Settings.test.tsx` and `npm --workspace apps/renderer run typecheck` passed.
