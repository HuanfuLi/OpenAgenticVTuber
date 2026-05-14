---
phase: 21
plan: 21-03
status: complete
requirements-completed: [CODE-03, CODE-04]
key-files:
  modified:
    - packages/contracts/py/contracts/audio_provider.py
    - packages/contracts/ts/audio-provider.ts
    - packages/contracts/generated/json-schema/audio-provider.schema.json
    - packages/contracts/tests/test_codegen.py
    - sidecar/src/sidecar/stt/registry.py
    - sidecar/tests/stt/test_stt_registry.py
    - apps/renderer/src/screens/Settings/Settings.tsx
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/tests/Settings.test.tsx
completed: 2026-05-13
---

# Phase 21 Plan 21-03: Recommendation Metadata, Targeted STT Hardening, and Settings Badges Summary

Translated current evidence into concise provider capabilities and Settings badges without changing STT defaults or provider algorithms.

## What Changed

- Added capability literals for `code_switch_tested`, `limited_code_switch`, and `cuda_optional`.
- Kept FunASR as the local-first recommendation without claiming completed code-switch scorecard results.
- Labeled faster-whisper as limited for code-switching and CUDA optional.
- Centralized Settings provider badge labels in `copy.ts`.
- Updated Settings tests to assert concise provider badges and guard against exposing scorecard/ranking copy in the app.
- Updated the stale contract test that still expected preview voice-input requests/results; voice input is final-only.

## Targeted Provider Hardening

No targeted provider hardening was applied. The automated scorecard runner is ready, but no live corpus audio exists yet, so there is no concrete provider-output failure to justify changing FunASR or faster-whisper behavior.

## Verification

- `npm run codegen:contracts` - passed.
- `cd sidecar; uv run pytest tests/stt/test_stt_registry.py tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py` - passed, 9 tests.
- `cd sidecar; uv run pytest ..\packages\contracts\tests\test_codegen.py` - passed, 20 tests.
- `cd apps/renderer; npm test -- Settings.test.tsx` - passed, 70 tests.

## Deviations from Plan

- Provider algorithm changes were skipped by design because scorecard evidence has not identified a concrete issue.

## Self-Check: PASSED

