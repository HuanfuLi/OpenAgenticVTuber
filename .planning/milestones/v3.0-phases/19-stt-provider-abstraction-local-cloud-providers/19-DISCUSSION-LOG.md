# Phase 19: STT Provider Abstraction + Local/Cloud Providers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-09T19:27:01.2102604-04:00
**Phase:** 19-STT Provider Abstraction + Local/Cloud Providers
**Areas discussed:** Local Model Download And Cache Policy, Test Transcription Input, Provider Readiness Gate, FunASR vs Faster-Whisper Defaults, Cloud Provider Guardrails

---

## Local Model Download And Cache Policy

| Question | Selected | Options considered |
|----------|----------|--------------------|
| How should local STT models be acquired before first use? | Explicit download first | Explicit download first; Just-in-time with confirmation; Existing cache only; You decide |
| What level of model/cache control should the user have? | Simple app-managed cache | Simple app-managed cache; Advanced cache path override; Provider-native cache only; You decide |
| Should Phase 19 include model removal/cleanup controls? | Yes, remove downloaded model | Yes, remove downloaded model; Status only, no deletion; Only clear failed/partial downloads; You decide |
| How strict should startup behavior be for local STT providers? | Never initialize heavy STT at boot | Never initialize heavy STT at boot; Warm metadata only; Preload selected local provider after boot idle; You decide |

**Notes:** User asked whether prior GPT-SoVITS app-managed launch implied heavy provider startup at boot. Phase 17 context clarified it did not. Phase 19 wording was sharpened to forbid STT auto-start, heavy imports, model load, downloads, and idle preload at boot.

---

## Test Transcription Input

| Question | Selected | Options considered |
|----------|----------|--------------------|
| Since Phase 20 owns real mic capture/PTT/VAD, what should Phase 19 use for provider test transcription? | Minimal record-for-test | Audio file test only; Bundled sample clip plus file option; Minimal record-for-test; You decide |
| How narrow should the Phase 19 record-for-test path be? | Settings-only test recorder | Settings-only test recorder; Reusable capture foundation; Temporary sidecar test recorder; You decide |
| What should happen to recorded test audio after transcription? | Discard immediately | Discard immediately; Ask to save test clip; Keep recent test history; You decide |
| What result should the test transcription show? | Transcript plus concise diagnostics | Transcript plus concise diagnostics; Transcript only; Full debug details in logs only; You decide |

**Notes:** The recorder is a provider test tool only. It should not become Phase 20 voice capture, PTT, VAD, preview, or chat-submission UX.

---

## Provider Readiness Gate

| Question | Selected | Options considered |
|----------|----------|--------------------|
| What must pass before a provider can be enabled for future voice input? | Health plus successful test transcription | Health plus successful test transcription; Health check only; Allow enable with warnings; You decide |
| How should successful test transcription be judged? | Non-empty transcript plus no provider error | Non-empty transcript plus no provider error; User confirms transcript is acceptable; Minimum confidence/quality threshold; You decide |
| How should readiness expire when settings change? | Invalidate on relevant config/model change | Invalidate on relevant config/model change; Keep readiness until next failure; Time-based expiry; You decide |
| What should happen if an enabled provider later fails at runtime? | Disable until re-tested | Disable until re-tested; Keep enabled but blocked for current attempt; Automatically fall back to another local provider; You decide |

**Notes:** Quality scoring is intentionally deferred to Phase 21. Phase 19 readiness is operational readiness, not provider-quality certification.

---

## FunASR vs Faster-Whisper Defaults

| Question | Selected | Options considered |
|----------|----------|--------------------|
| How should the app present the local provider recommendation? | FunASR recommended for bilingual use | FunASR recommended for bilingual use; Neutral local choices; Availability-based default; You decide |
| What should the initial FunASR model target be? | SenseVoiceSmall | SenseVoiceSmall; Configurable FunASR model ID; Researcher decides current best model; You decide |
| How should faster-whisper be positioned? | Local fallback for English/general use | Local fallback for English/general use; Equal peer provider; Advanced/local fallback only; You decide |
| Should Phase 19 expose advanced local inference options like CPU/GPU, quantization, or compute type? | Minimal safe defaults only | Minimal safe defaults only; Expose provider-specific advanced knobs; Auto-detect and hide knobs; You decide |

**Notes:** FunASR/SenseVoice is the recommended bilingual default, while faster-whisper remains visible and usable as the local fallback.

---

## Cloud Provider Guardrails

| Question | Selected | Options considered |
|----------|----------|--------------------|
| What consent should be required before OpenAI/Groq STT can run? | Persistent provider consent plus credentials | Persistent provider consent plus credentials; Per-test/per-transcription confirmation; Credential entry implies consent; You decide |
| Should cloud STT ever be used as automatic fallback when a local provider fails? | Never automatic cloud fallback | Never automatic cloud fallback; Ask each time local fails; Allow user-configured fallback chain; You decide |
| How should cloud test transcription communicate audio handling? | One-time setup copy only | Inline cloud-audio notice on test action; One-time setup copy only; Log-only note; You decide |
| What cloud data should be retained in diagnostics? | Redacted metadata only | Redacted metadata only; Transcript allowed in local logs; No cloud diagnostics; You decide |

**Notes:** Cloud providers are explicit opt-in and credential-gated. The user preferred one-time consent copy instead of repeated per-action confirmation.

---

## the agent's Discretion

No explicit "you decide" areas were delegated.

## Deferred Ideas

None.
