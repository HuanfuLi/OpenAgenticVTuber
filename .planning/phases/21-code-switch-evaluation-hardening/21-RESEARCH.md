# Phase 21 Research: Code-Switch Evaluation + Hardening

**Phase:** 21 - Code-Switch Evaluation + Hardening
**Milestone:** v3.0 Rich Voice Configuration + Voice Input
**Date:** 2026-05-10
**Status:** Ready for planning

## Scope

Phase 21 evaluates and hardens Chinese/English/code-switch STT behavior after Phase 19 providers and Phase 20 Chat voice input exist. It must produce a locked corpus, repeatable scorecard, no-translation checks, evidence-backed local default recommendation, concise Settings badges, and live Chat UAT evidence.

This phase does not add new STT providers, redesign Phase 19 provider architecture, make cloud STT the default, add runtime language policing, add translation, or solve no-headphones/AEC.

## Inputs

- `.planning/ROADMAP.md` Phase 21 goal, dependency, and success criteria.
- `.planning/REQUIREMENTS.md` requirements `CODE-01` through `CODE-04`.
- `.planning/phases/21-code-switch-evaluation-hardening/21-CONTEXT.md` user decisions `D-01` through `D-20`.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` STT provider/readiness and local/cloud guardrails.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-CONTEXT.md` final transcript unchanged/no-translation Chat path.
- Current provider/settings code in contracts, sidecar audio/admin modules, Electron IPC/preload, and renderer Settings.

## External Findings

### Provider Capabilities And Constraints

- FunASR/SenseVoiceSmall supports automatic language mode for `zh`, `en`, `yue`, `ja`, `ko`, and `nospeech`, with an `auto` language option and `use_itn` control. Phase 21 should explicitly record provider options used in every scorecard run so recommendation changes are explainable.
- faster-whisper detects language when no language is set and exposes the detected language/probability in transcription info. It also has task separation for `transcribe` versus `translate`; Phase 21 should ensure local fallback runs transcription, not translation.
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
6. Keep cloud providers in the scorecard but exclude them from default recommendation logic.
7. Update Settings provider badges from scorecard-derived local recommendation data. The detailed scorecard stays in planning/developer artifacts.
8. Allow only targeted hardening in Phase 21: provider language/task parameters, normalization/tag cleanup, prompt/hotword fields where already supported, and output post-processing that preserves final text semantics. Do not rewrite STT providers.
9. Require a short live Chat voice UAT after corpus scorecard passes to verify that the selected provider's final transcript still enters the existing chat path unchanged.

## Risks

| Risk | Mitigation |
|------|------------|
| User voice audio is accidentally committed | Add/confirm ignore rules for local eval audio; commit manifests and scorecards, not raw audio. |
| WER penalizes harmless Chinese formatting or script differences | Normalize for scoring and use CER/alignment as diagnostics, with semantic/key-token gates authoritative. |
| Provider outputs SenseVoice tags or language markers | Treat known tag cleanup as targeted hardening only when tests show it preserves transcript meaning. |
| Whisper-family providers translate instead of transcribe | Use transcription endpoints/tasks only; hard-fail translated output in eval. |
| Cloud provider wins quality but violates local-first default posture | Score cloud separately and never make it default; Settings should not promote cloud quality comparisons. |
| Phase 19/20 actual file names differ from planned names | Every plan starts with upstream discovery and adapts to actual implemented modules. |

## Recommended Plan Shape

- Plan 21-01: corpus manifest, local audio capture/import workflow, score contracts, and scoring harness foundation.
- Plan 21-02: provider scorecard runner across enabled STT providers, no-translation/key-token gates, and scorecard artifact generation.
- Plan 21-03: evidence-backed local recommendation, targeted provider hardening, and Settings badge/copy updates.
- Plan 21-04: live Chat voice UAT, final regression, and Phase 21 evidence closure.

## Verification Focus

- `CODE-01`: Chinese, English, and mixed Chinese/English utterances can be spoken without manual language mode switching.
- `CODE-02`: locked corpus and provider scorecard exist and are reproducible.
- `CODE-03`: default provider recommendation is backed by scorecard evidence and no-translation/key-token checks.
- `CODE-04`: user-facing badges/copy match provider strengths and limitations without overclaiming.

## Sources

- FunASR SenseVoiceSmall docs: https://github.com/modelscope/FunASR/blob/main/docs/tutorial/Tables.md
- faster-whisper README and transcription docs: https://github.com/SYSTRAN/faster-whisper
- OpenAI Speech-to-Text docs: https://developers.openai.com/api/docs/guides/speech-to-text
- Groq Speech-to-Text docs: https://console.groq.com/docs/speech-to-text
- NIST tools: https://www.nist.gov/itl/iad/mig/tools
- jiwer usage docs: https://jitsi.github.io/jiwer/usage/
- Semantic-WER paper: https://arxiv.org/abs/2106.02016
- CER for multilingual ASR paper: https://arxiv.org/abs/2410.07400
