# Phase 19 UAT: STT Provider Abstraction + Local/Cloud Providers

## Automated UAT

- PASS: provider catalog lists FunASR, faster-whisper, OpenAI, and Groq with local/cloud and consent/API-key capability labels.
- PASS: cloud STT is blocked before provider construction when consent or credentials are missing.
- PASS: local STT test is blocked until the local model cache entry contains non-empty model files.
- PASS: successful fake local STT test receives a valid WAV payload, uses the resolved app-managed cache path, returns a non-empty transcript, and marks readiness active with `ready`.
- PASS: invalid/non-WAV Settings test payloads fail before readiness is marked active.
- PASS: local model download endpoint invokes provider-specific download helpers and reports `downloaded` only when usable files exist.
- PASS: Settings STT recorder submits RIFF/WAVE bytes and stops microphone tracks after the explicit test action.
- PASS: OpenAI/Groq cloud provider adapters preserve explicit `zh`/`en` language modes and omit language in auto mode.
- PASS: Settings STT test and runtime voice-input transcription run provider work off the FastAPI event loop.
- PASS: Settings renders local model cache controls and does not call conversation-history submission APIs from STT settings tests.

## Manual / Live Acceptance

- PENDING: from a clean app-managed STT cache, download FunASR/SenseVoiceSmall or faster-whisper from Settings and confirm cache state becomes `downloaded` only after real model files exist.
- PENDING: run one short Settings-only local transcription with the downloaded model and confirm a non-empty transcript gates readiness.
- PENDING: remove the downloaded model and confirm readiness is invalidated and Chat voice input is blocked.
- PENDING: with available credentials, run one OpenAI or Groq Settings-only transcription using explicit consent and inspect diagnostics for redaction.
- PENDING: confirm no model download, provider import, or model load happens at app boot.
