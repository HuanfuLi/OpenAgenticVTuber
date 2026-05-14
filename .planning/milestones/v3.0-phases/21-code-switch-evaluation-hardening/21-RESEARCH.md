# Phase 21 Research: Code-Switch Evaluation + Hardening

**Phase:** 21 - Code-Switch Evaluation + Hardening
**Milestone:** v3.0 Rich Voice Configuration + Voice Input
**Date:** 2026-05-10
**Updated:** 2026-05-13
**Status:** Ready for execution with refreshed plans

## Scope

Phase 21 evaluates and hardens Chinese/English/code-switch STT behavior after Phase 19 providers, Phase 20 Chat voice input, Phase 20.1 Settings refactor, and Phase 20.2 final-only STT are complete. It must produce a locked corpus, repeatable scorecard, no-translation checks, evidence-backed local default recommendation, concise Settings badges, and live Chat UAT evidence based on final submitted transcripts.

This phase does not add new STT providers, redesign Phase 19 provider architecture, make cloud STT the default, add runtime language policing, add translation, reintroduce live preview transcription, change Chat dispatch semantics, or solve no-headphones/AEC.

## Inputs

- `.planning/ROADMAP.md` Phase 21 goal, dependency on Phase 20.2, final-only STT planning notes, and success criteria.
- `.planning/REQUIREMENTS.md` requirements `CODE-01` through `CODE-04`.
- `.planning/phases/21-code-switch-evaluation-hardening/21-CONTEXT.md` user decisions `D-01` through `D-20` plus 2026-05-13 closed-phase ground truth `D-00A` through `D-00F`.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` STT provider/readiness and local/cloud guardrails.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-UAT.md` and `19-VERIFICATION.md` live local provider acceptance, local model cache behavior, cloud live skip rationale, and automated cloud guardrail coverage.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-CONTEXT.md`, `20-HUMAN-UAT.md`, and `20-VERIFICATION.md` final transcript unchanged/no-translation Chat path, active-turn queueing, readiness/model-cache behavior, and live PTT/VAD acceptance.
- `.planning/phases/20.1-settings-ux-refactor-enablement-simplification/` for current Settings IA and enablement simplification.
- `.planning/phases/20.2-cpu-local-stt-enhancement/` for final-only STT, CPU latency/warm reuse, stop-current-turn, and edit/regenerate behavior.
- Current provider/settings code in contracts, sidecar audio/admin modules, Electron IPC/preload, renderer Chat, and renderer Settings.

## External Findings

### Provider Capabilities And Constraints

- FunASR/SenseVoiceSmall supports automatic language mode for `zh`, `en`, `yue`, `ja`, `ko`, and `nospeech`, with an `auto` language option and `use_itn` control. Phase 21 should explicitly record provider options used in every scorecard run so recommendation changes are explainable.
- faster-whisper detects language when no language is set and exposes the detected language/probability in transcription info. It also has task separation for `transcribe` versus `translate`; Phase 21 should ensure local fallback runs transcription, not translation.
- faster-whisper CUDA acceleration is environment-dependent on NVIDIA CUDA 12 runtime DLLs. Phase 21 may record CUDA availability and selected compute type in scorecards, but should not downgrade the selected model quality as a latency workaround.
- OpenAI Speech-to-Text distinguishes transcriptions from translations. Transcriptions preserve the input language, while translations output English. Phase 21 must call transcription endpoints only and treat translation-like output as a hard eval failure.
- Groq Speech-to-Text also exposes separate transcription and English-translation endpoints. Its docs list multilingual Whisper models and recommend `whisper-large-v3` for error-sensitive multilingual use and `whisper-large-v3-turbo` for price/performance. Cloud providers remain opt-in and non-default per Phase 21 decisions.
- Groq documents 16 kHz mono downsampling as optimal for speech recognition. Phase 20/21 audio normalization should preserve the provider input metadata used during scorecard runs.

### Evaluation Approach

- Standard ASR evaluation commonly uses word-error style scoring. NIST's Speech Recognition Scoring Toolkit includes SCLITE/ASCLITE and related ASR scoring tools, which confirms alignment-based scoring is a conventional baseline.
- `jiwer` provides WER, CER, word/character alignments, and error frequencies in Python. It is a practical fit for a local repeatable harness, but Phase 21 should treat WER/CER as supporting metrics rather than the only gate.
- Research on Semantic-WER argues that plain WER does not capture downstream task usefulness because it is surface-level. That matches Phase 21's user decision to score meaning and key-token retention, not near-exact transcript formatting.
- Recent multilingual ASR metric research argues CER can be more consistent than WER across writing systems and languages without clear word boundaries. Phase 21 should compute CER for Chinese/mixed cases and avoid English-only WER as the main success signal.

## Planning Decisions

1. Use a committed text corpus manifest plus local user-recorded audio assets. Do not commit raw user voice audio; record local path tokens, metadata, and hashes in scorecard output.
2. Corpus manifest should include 20-30 generic companion-style utterances with expected language mix, key tokens, and no-translation expectation flags.
3. Score each case with hard gates first: non-empty transcript, no translation/collapse into one language, semantic pass, and key-token retention. Record WER/CER and alignment data as diagnostics.
4. Prefer `jiwer` or a small local alignment helper for WER/CER. If adding `jiwer`, keep it a sidecar dev/test dependency unless runtime UI needs it.
5. Run every available, enabled, ready provider through the same corpus runner. Never use cloud without existing Phase 19 consent/credentials/readiness.
6. Keep cloud providers in the scorecard when credentials/readiness are available, but explicitly record skipped/blocked cloud status when credentials are not available. Exclude cloud providers from default recommendation logic.
7. Update Settings provider badges from scorecard-derived local recommendation data. The detailed scorecard stays in planning/developer artifacts, and badge/copy work must fit the current Phase 20.1 Settings sidebar IA.
8. Allow only targeted hardening in Phase 21: provider language/task parameters, normalization/tag cleanup, prompt/hotword fields where already supported, and output post-processing that preserves final text semantics. Do not rewrite STT providers.
9. Require a short live Chat voice UAT after corpus scorecard passes to verify that the selected provider's final submitted transcript still enters the existing chat path unchanged.
10. Do not reintroduce preview transcription for evaluation, diagnostics, or UAT evidence. Phase 20.2 made final-only STT the shipped path.

## Risks

| Risk | Mitigation |
|------|------------|
| User voice audio is accidentally committed | Add/confirm ignore rules for local eval audio; commit manifests and scorecards, not raw audio. |
| WER penalizes harmless Chinese formatting or script differences | Normalize for scoring and use CER/alignment as diagnostics, with semantic/key-token gates authoritative. |
| Provider outputs SenseVoice tags or language markers | Treat known tag cleanup as targeted hardening only when tests show it preserves transcript meaning. |
| Whisper-family providers translate instead of transcribe | Use transcription endpoints/tasks only; hard-fail translated output in eval. |
| Cloud provider wins quality but violates local-first default posture | Score cloud separately and never make it default; Settings should not promote cloud quality comparisons. |
| Cloud credentials are unavailable during Phase 21 | Mark cloud scorecard rows skipped/blocked and rely on existing automated consent/credential/redaction coverage; do not block local provider recommendation evidence on cloud live testing. |
| Existing 21 plans target stale Settings component paths | Every plan that edits badges/copy must inspect current `Settings.tsx` and Phase 20.1 layout before editing. |
| Eval accidentally uses removed preview behavior | Treat final submitted transcripts as the only evidence unit and add verification language to prevent preview reintroduction. |
| Phase 19/20 actual file names differ from planned names | Every plan starts with upstream discovery and adapts to actual implemented modules. |

## Recommended Plan Shape

- Plan 21-01: corpus manifest, local audio privacy boundary, score contracts, and scoring harness foundation for final transcript strings.
- Plan 21-02: provider scorecard runner across ready STT providers, no-translation/key-token gates, skipped/blocked cloud rows, and scorecard artifact generation.
- Plan 21-03: evidence-backed local recommendation metadata, targeted provider hardening only when justified, and Settings badge/copy updates against the current sidebar IA.
- Plan 21-04: live Chat voice UAT, final regression, and Phase 21 evidence closure using final submitted transcripts only.

## Verification Focus

- `CODE-01`: Chinese, English, and mixed Chinese/English utterances can be spoken without manual language mode switching.
- `CODE-02`: locked corpus and provider scorecard exist and are reproducible.
- `CODE-03`: default provider recommendation is backed by scorecard evidence and no-translation/key-token checks.
- `CODE-04`: user-facing badges/copy match provider strengths and limitations without overclaiming.

All verification for `CODE-01` must use final submitted transcripts in Chat, not preview chunks or intermediate STT output.

## Sources

- FunASR SenseVoiceSmall docs: https://github.com/modelscope/FunASR/blob/main/docs/tutorial/Tables.md
- faster-whisper README and transcription docs: https://github.com/SYSTRAN/faster-whisper
- OpenAI Speech-to-Text docs: https://developers.openai.com/api/docs/guides/speech-to-text
- Groq Speech-to-Text docs: https://console.groq.com/docs/speech-to-text
- NIST tools: https://www.nist.gov/itl/iad/mig/tools
- jiwer usage docs: https://jitsi.github.io/jiwer/usage/
- Semantic-WER paper: https://arxiv.org/abs/2106.02016
- CER for multilingual ASR paper: https://arxiv.org/abs/2410.07400

---

*Updated: 2026-05-13 after Phase 19/20/20.1/20.2 closure*
