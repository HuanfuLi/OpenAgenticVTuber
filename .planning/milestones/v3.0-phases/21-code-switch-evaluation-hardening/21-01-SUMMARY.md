---
phase: 21
plan: 21-01
status: complete
requirements-completed: [CODE-02]
key-files:
  created:
    - .planning/phases/21-code-switch-evaluation-hardening/21-CORPUS.md
    - .planning/phases/21-code-switch-evaluation-hardening/21-SCORECARD.md
    - sidecar/src/sidecar/stt/eval/__init__.py
    - sidecar/src/sidecar/stt/eval/corpus.py
    - sidecar/src/sidecar/stt/eval/scoring.py
    - sidecar/tests/stt/test_code_switch_eval_scoring.py
  modified:
    - .gitignore
completed: 2026-05-13
---

# Phase 21 Plan 21-01: Final-Transcript Corpus and Scoring Foundation Summary

Created the locked Phase 21 final-transcript corpus, raw-audio privacy boundary, scorecard seed, and deterministic scorer primitives for semantic/key-token/no-translation gates.

## What Changed

- Added 24 generic Chinese, English, and mixed Chinese/English corpus cases in `21-CORPUS.md`.
- Ignored `.planning/eval-audio/phase-21/` so user-recorded eval audio cannot be committed accidentally.
- Added typed corpus/audio manifest helpers and final-transcript scoring helpers under `sidecar.stt.eval`.
- Added diagnostics for CER and WER-like distance while keeping semantic/key-token/no-translation as hard gates.

## Verification

- `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py` - passed, 8 tests.
- `git check-ignore .planning/eval-audio/phase-21/sample.wav` - passed.

## Deviations from Plan

None - plan executed as written.

## Self-Check: PASSED

