---
status: passed
phase: 21-code-switch-evaluation-hardening
updated: 2026-05-13
requirements:
  CODE-01: complete
  CODE-02: complete
  CODE-03: complete
  CODE-04: complete
---

# Phase 21 Verification

## Verdict

Phase 21 is verified. Automated implementation, 21-05 gap closure, and live
retests passed. The selected physical microphone retest prevented background
video/system-audio capture for PTT and VAD, while recommended-provider FunASR
passed the mixed Chinese/English final-transcript checks.

## Requirement Mapping

| Requirement | Status | Evidence | Remaining Work |
|---|---|---|---|
| CODE-01 | complete | `ChatVoiceInput.test.tsx` confirms mixed Chinese/English final text is dispatched unchanged through `text-input`; UAT passed selected physical microphone isolation and FunASR mixed final transcripts. | None. |
| CODE-02 | complete | `21-CORPUS.md`, `21-SCORECARD.md`, `sidecar.stt.eval.corpus`, `scoring`, `runner`, and `report` exist with tests and live UAT rows. | None. |
| CODE-03 | complete | Scoring hard gates and recommendation logic exist; scorecard records faster-whisper limitations and FunASR recommended-provider passes. | None. |
| CODE-04 | complete | Settings provider badges are concise, centralized, covered by `Settings.test.tsx`, and passed live inspection. | None. |

## Automated Checks

- `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py` - passed, 8 tests.
- `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_runner.py tests/stt/test_code_switch_eval_report.py` - passed, 4 tests.
- `cd sidecar; uv run pytest tests/stt/test_stt_registry.py tests/admin/test_audio_voice_input_endpoint.py` - passed, 13 tests.
- `cd sidecar; uv run pytest tests/stt/test_stt_registry.py tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py` - passed, 9 tests.
- `cd sidecar; uv run pytest ..\packages\contracts\tests\test_codegen.py` - passed, 20 tests.
- `cd apps/renderer; npm test -- Settings.test.tsx` - passed, 70 tests.
- `cd apps/renderer; npm test -- ChatVoiceInput.test.tsx Settings.test.tsx` - passed, 89 tests.
- `git check-ignore .planning/eval-audio/phase-21/sample.wav` - passed.
- `cd apps/renderer; npm test -- voice-capture.test.ts vad-controller.test.ts voice-input-store.test.ts ChatVoiceInput.test.tsx Settings.test.tsx` - passed, 115 tests.
- `cd apps/renderer; npm run typecheck` - passed.

## Human Verification Items

Complete in `21-UAT.md`.

## Cloud Rows

Cloud live transcription remains skipped unless the user explicitly configures
consent and credentials. Automated coverage continues to verify consent,
credential, and redacted-diagnostic guardrails. Cloud providers are excluded from
default recommendation decisions.

## Gaps

Resolved:

- PTT/VAD background system/video audio capture: fixed by selected microphone input and loopback warnings in 21-05; live retest passed.
- faster-whisper mixed-language limitations: recorded in scorecard and provider copy; faster-whisper remains limited for code-switching.
- Recommended-provider FunASR UAT: passed mixed Chinese/English and mixed key-token retests.

## Gap Closure Plan

- `21-05-PLAN.md` - Microphone Source Isolation and Faster-Whisper Evidence Closure - implemented and retested.
