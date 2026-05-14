---
phase: 21
plan: 21-02
status: complete
requirements-completed: [CODE-02, CODE-03]
key-files:
  created:
    - sidecar/src/sidecar/stt/eval/runner.py
    - sidecar/src/sidecar/stt/eval/report.py
    - sidecar/tests/stt/test_code_switch_eval_runner.py
    - sidecar/tests/stt/test_code_switch_eval_report.py
  modified:
    - .planning/phases/21-code-switch-evaluation-hardening/21-SCORECARD.md
completed: 2026-05-13
---

# Phase 21 Plan 21-02: Provider Scorecard Runner and Evidence Capture Summary

Added a repeatable provider scorecard runner and deterministic markdown renderer for final submitted transcript evidence.

## What Changed

- Added provider/case run orchestration with structured rows for passed, failed, missing audio, blocked cloud, skipped, and provider error states.
- Reused `STTRequest` final transcription semantics and did not introduce preview/chunk APIs.
- Added local recommendation input logic that excludes cloud providers from defaults.
- Added deterministic scorecard markdown rendering with redacted diagnostics and no raw audio persistence.

## Verification

- `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_runner.py tests/stt/test_code_switch_eval_report.py` - passed, 4 tests.
- `cd sidecar; uv run pytest tests/stt/test_stt_registry.py tests/admin/test_audio_voice_input_endpoint.py` - passed, 13 tests.

## Deviations from Plan

- Live provider scoring was not executed because no local corpus audio files exist yet under `.planning/eval-audio/phase-21/`. The runner records this as pending/missing-audio evidence rather than claiming quality.

## Self-Check: PASSED

