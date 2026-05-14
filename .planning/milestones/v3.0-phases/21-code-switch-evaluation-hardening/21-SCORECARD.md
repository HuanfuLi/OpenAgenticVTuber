---
phase: 21
status: seeded
corpus_version: 2026-05-13-final-transcript-v1
last_run: pending-live-audio
---

# Phase 21 STT Code-Switch Scorecard

All scored transcripts are final submitted transcript evidence. Preview chunks,
partial captions, transient finalizing text, and removed live-preview behavior are
out of scope.

## Run Metadata

| Field | Value |
|---|---|
| Corpus | 21-CORPUS.md |
| Evidence unit | Final submitted STT transcript |
| Audio root | `.planning/eval-audio/phase-21/` (ignored) |
| Local audio status | Pending user recordings |
| Cloud live status | Skipped unless explicit consent and credentials are available |
| CUDA policy | Environment metadata only; no local model quality downgrade |

## Provider Summary

| Provider | Type | Status | Hard-gate pass rate | Key-token retention | No-translation failures | Median latency | Recommendation input | Notes |
|---|---|---|---|---|---|---|---|---|
| funasr | local | live-uat-passed | passed | passed | 0 | pending | unchanged | Recommended local provider. FunASR preserved mixed Chinese/English and key-token cases in live final-transcript UAT. |
| faster_whisper | local | live-uat-limited | partial | limited | 1 | pending | limited-code-switch | UAT used faster-whisper. English and some Chinese/no-translation cases passed, but mixed Chinese/English quality was poor: `三个` normalized to `3`, and `帮我` was misrecognized as `Onward`. CUDA support depends on local NVIDIA CUDA 12 runtime. |
| openai | cloud | skipped | n/a | n/a | n/a | n/a | excluded-cloud | Cloud is explicit opt-in and never a default recommendation. |
| groq | cloud | skipped | n/a | n/a | n/a | n/a | excluded-cloud | Cloud is explicit opt-in and never a default recommendation. |

## Per-Case Evidence

| Provider | Case | Status | Final transcript | Hard gates | CER | WER-like | Latency ms | Diagnostics |
|---|---|---|---|---|---|---|---|---|
| faster_whisper | ptt-zh-001 | passed | 今天晚一点提醒我喝水 | pass | n/a | n/a | pending | Live UAT matched intent. |
| faster_whisper | ptt-en-001 | issue | Please summarize the last message | input-source issue | n/a | n/a | pending | Text passed, but capture also picked up background video/system audio. |
| faster_whisper | ptt-mix-001 | passed-with-limitation | 请把 brightness 调到 fifty percent | semantic pass, poor quality noted | n/a | n/a | pending | User noted very poor model quality. |
| faster_whisper | ptt-mix-002 | issue | I need 3 options, not 2 | semantic pass, key-token language boundary failed | n/a | n/a | pending | Expected `I need 三个 options, not two`; Chinese key token normalized away. |
| faster_whisper | ptt-zh-no-translation | passed | 请继续用中文回答不要翻译成英文 | pass | n/a | n/a | pending | No English translation collapse. |
| faster_whisper | vad-mix-001 | failed | Onward check the schedule for tomorrow | mixed Chinese token failed | n/a | n/a | pending | Expected `帮我 check the schedule for tomorrow`; `帮我` misrecognized as `Onward`. |
| funasr | ptt-mix-001 | passed | 请把 brightness 调到 fifty percent | pass | n/a | n/a | pending | Recommended-provider retest preserved Chinese and English key tokens. |
| funasr | ptt-mix-002 | passed | I need 三个 options, not two | pass | n/a | n/a | pending | Recommended-provider retest preserved mixed key token `三个`. |

## Skipped Or Blocked Rows

| Provider | Reason | Redacted diagnostics |
|---|---|---|
| openai | skipped: missing live opt-in credentials | provider=openai; credential=missing-or-not-requested |
| groq | skipped: missing live opt-in credentials | provider=groq; credential=missing-or-not-requested |

## Local Recommendation Conclusion

No provider default changed by this scorecard. Faster-whisper live UAT supports
the existing `limited-code-switch` label and should not be recommended for
Chinese/English code-switching. FunASR passed the recommended-provider
final-transcript retest and remains the local-first recommendation. Cloud
providers are excluded from local default selection even if later live runs score
well.
