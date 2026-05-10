# Phase 19 UAT: STT Provider Abstraction + Local/Cloud Providers

## Automated UAT

- PASS: provider catalog lists FunASR, faster-whisper, OpenAI, and Groq with local/cloud and consent/API-key capability labels.
- PASS: cloud STT is blocked before provider construction when consent or credentials are missing.
- PASS: local STT test is blocked until the local model cache entry is present.
- PASS: successful fake local STT test returns a non-empty transcript and marks readiness active.
- PASS: Settings renders local model cache controls and does not call conversation-history submission APIs from STT settings tests.

## Manual Follow-Up

- Optional: install real provider dependencies and run a short Settings-only STT test for FunASR and/or faster-whisper.
- Optional: provide OpenAI/Groq STT credentials and consent, then run one short Settings-only cloud transcription test and inspect logs for redacted diagnostics.

