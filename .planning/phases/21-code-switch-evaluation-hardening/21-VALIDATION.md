---
phase: 21
slug: code-switch-evaluation-hardening
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
updated: 2026-05-14
source_state: reconstructed-from-summary
---

# Phase 21 - Validation Strategy

This validation file was reconstructed after execution from the Phase 21 plans,
summaries, scorecard, UAT, verification report, and current test suite.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Frameworks | pytest 9.x, Vitest 4.x, TypeScript |
| Config files | `sidecar/pyproject.toml`, `apps/renderer/package.json`, `packages/contracts/py/pyproject.toml` |
| Quick run command | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py tests/stt/test_code_switch_eval_runner.py tests/stt/test_code_switch_eval_report.py` |
| Full suite command | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py tests/stt/test_code_switch_eval_runner.py tests/stt/test_code_switch_eval_report.py tests/stt/test_stt_registry.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py; cd ..\apps\renderer; npm test -- voice-capture.test.ts vad-controller.test.ts voice-input-store.test.ts ChatVoiceInput.test.tsx Settings.test.tsx; npm run typecheck` |
| Contracts command | `cd sidecar; uv run pytest ..\packages\contracts\tests\test_codegen.py` |
| Privacy check | `git check-ignore .planning/eval-audio/phase-21/sample.wav` |
| Estimated runtime | ~35 seconds |

## Sampling Rate

- After scorer, runner, registry, or provider changes: run the sidecar quick command.
- After Chat or Settings voice-input changes: run `cd apps/renderer; npm test -- ChatVoiceInput.test.tsx Settings.test.tsx`.
- After microphone capture or VAD changes: run `cd apps/renderer; npm test -- voice-capture.test.ts vad-controller.test.ts voice-input-store.test.ts`.
- Before verification: run the full suite command, contracts command, typecheck, and privacy check.
- Max feedback latency: 60 seconds for the focused Phase 21 suite.

## Requirement Coverage

| Requirement | Status | Automated Evidence | Supplemental Evidence |
|-------------|--------|--------------------|-----------------------|
| CODE-01 | COVERED | `ChatVoiceInput.test.tsx` final-only mixed Chinese/English dispatch; `voice-capture.test.ts` selected microphone capture and no silent fallback; `vad-controller.test.ts` selected microphone monitoring; `test_audio_voice_input_endpoint.py` selected provider final transcription path. | `21-UAT.md` rows 9-12 record selected physical microphone and FunASR mixed-language retests passing. |
| CODE-02 | COVERED | `test_code_switch_eval_scoring.py` validates locked corpus shape, scorer gates, diagnostics, duplicate rejection, and raw-audio path policy; `test_code_switch_eval_runner.py` and `test_code_switch_eval_report.py` validate scorecard execution and rendering. | `21-CORPUS.md` and `21-SCORECARD.md` provide the checked-in corpus and provider scorecard artifacts. |
| CODE-03 | COVERED | `test_code_switch_eval_scoring.py` covers no-translation, key-token, semantic, and mixed-language hard gates; `test_code_switch_eval_runner.py` covers local recommendation and cloud exclusion; `test_stt_registry.py` covers FunASR recommendation and faster-whisper limited code-switch labels. | `21-SCORECARD.md` records faster-whisper limitations and FunASR recommended-provider pass evidence. |
| CODE-04 | COVERED | `Settings.test.tsx` covers provider badges, no scorecard/ranking exposure, cloud setup copy, selected microphone persistence, and loopback warning copy; `test_codegen.py` verifies contract literals and generated artifacts. | `21-UAT.md` row 7 records manual Settings badge inspection. |

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 21-01 | 1 | CODE-02 | Checked-in corpus only; raw local audio ignored. | unit/privacy | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py`; `git check-ignore .planning/eval-audio/phase-21/sample.wav` | yes | green |
| 21-01-02 | 21-01 | 1 | CODE-02 | Corpus loading rejects invalid or duplicate cases. | unit | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py` | yes | green |
| 21-01-03 | 21-01 | 1 | CODE-03 | No-translation, key-token, and semantic failures remain hard gates. | unit | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py` | yes | green |
| 21-02-01 | 21-02 | 2 | CODE-01/CODE-02 | Scorecard runner uses final STT request semantics only. | unit | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_runner.py` | yes | green |
| 21-02-02 | 21-02 | 2 | CODE-02/CODE-03 | Missing audio, provider errors, and skipped cloud providers are structured evidence, not crashes. | unit | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_runner.py tests/stt/test_code_switch_eval_report.py` | yes | green |
| 21-02-03 | 21-02 | 2 | CODE-03 | Cloud providers are excluded from local default recommendations. | unit | `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_runner.py tests/stt/test_stt_registry.py` | yes | green |
| 21-03-01 | 21-03 | 3 | CODE-03/CODE-04 | Provider catalog truthfully labels FunASR, faster-whisper, and cloud providers. | unit/contract | `cd sidecar; uv run pytest tests/stt/test_stt_registry.py ..\packages\contracts\tests\test_codegen.py` | yes | green |
| 21-03-02 | 21-03 | 3 | CODE-04 | Settings shows concise provider badges without scorecard or cloud-default marketing copy. | component | `cd apps/renderer; npm test -- Settings.test.tsx` | yes | green |
| 21-03-03 | 21-03 | 3 | CODE-01/CODE-03 | Provider output cleanup preserves final transcript semantics and rejects metadata-only speech. | unit | `cd sidecar; uv run pytest tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py` | yes | green |
| 21-04-01 | 21-04 | 4 | CODE-01 | Chat dispatch accepts only final submitted transcripts and preserves mixed Chinese/English text. | component | `cd apps/renderer; npm test -- ChatVoiceInput.test.tsx` | yes | green |
| 21-04-02 | 21-04 | 4 | CODE-01/CODE-03 | No preview transcript path or transient bubble participates in evaluation. | component/contract | `cd apps/renderer; npm test -- ChatVoiceInput.test.tsx`; `cd sidecar; uv run pytest ..\packages\contracts\tests\test_codegen.py` | yes | green |
| 21-05-01 | 21-05 | 5 | CODE-01 | PTT capture uses the selected physical microphone and does not silently fall back on missing selected devices. | unit | `cd apps/renderer; npm test -- voice-capture.test.ts` | yes | green |
| 21-05-02 | 21-05 | 5 | CODE-01 | VAD monitoring uses the selected microphone source and reports selected-device errors. | unit | `cd apps/renderer; npm test -- vad-controller.test.ts` | yes | green |
| 21-05-03 | 21-05 | 5 | CODE-01/CODE-04 | Settings persists selected microphone metadata and warns on likely loopback/system-audio devices. | unit/component | `cd apps/renderer; npm test -- voice-input-store.test.ts Settings.test.tsx` | yes | green |
| 21-05-04 | 21-05 | 5 | CODE-03/CODE-04 | Faster-whisper remains limited-code-switch; FunASR remains local recommended after scorecard evidence. | unit/component | `cd sidecar; uv run pytest tests/stt/test_stt_registry.py`; `cd apps/renderer; npm test -- Settings.test.tsx` | yes | green |

## Wave 0 Requirements

Existing infrastructure covers all Phase 21 requirements. No new test scaffold or framework installation was required during this validation audit.

## Manual-Only Verifications

These checks are supplemental hardware/provider reality checks. They are not replacements for the automated requirement coverage above.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Physical microphone isolation with background system audio playing. | CODE-01 | Browser and OS audio routing depend on the user's actual input devices. | Select a physical microphone in Settings, play background audio through headphones, and confirm PTT/VAD submit only spoken microphone input. |
| Recommended-provider mixed Chinese/English recognition. | CODE-01/CODE-03 | Real STT model quality depends on local model files and live audio. | Run the mixed and key-token UAT rows in `21-UAT.md` with FunASR and record final Chat transcript results. |
| Settings badge inspection in the running app. | CODE-04 | Visual fit and copy density are easiest to verify in the app shell. | Open Settings > Voice input and confirm provider badges are concise and no detailed scorecard or cloud-default copy appears. |

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Generated test files | 0 |

Commands run during audit:

- `cd sidecar; uv run pytest tests/stt/test_code_switch_eval_scoring.py tests/stt/test_code_switch_eval_runner.py tests/stt/test_code_switch_eval_report.py tests/stt/test_stt_registry.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py` - passed, 33 tests.
- `cd apps/renderer; npm test -- voice-capture.test.ts vad-controller.test.ts voice-input-store.test.ts ChatVoiceInput.test.tsx Settings.test.tsx` - passed, 121 tests.
- `cd sidecar; uv run pytest ..\packages\contracts\tests\test_codegen.py` - passed, 20 tests.
- `cd apps/renderer; npm run typecheck` - passed.
- `git check-ignore .planning/eval-audio/phase-21/sample.wav` - passed.

Note: `cd packages/contracts; uv run pytest tests/test_codegen.py` failed in this workspace because that uv environment could not spawn `pytest`; the equivalent repository command through the sidecar uv environment passed.

## Validation Sign-Off

- [x] All tasks have automated verification or an explicit supplemental manual check.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Existing infrastructure covers all missing references; no Wave 0 work required.
- [x] No watch-mode flags in validation commands.
- [x] Feedback latency is under 60 seconds for focused Phase 21 validation.
- [x] `nyquist_compliant: true` set in frontmatter.

Approval: approved 2026-05-14
