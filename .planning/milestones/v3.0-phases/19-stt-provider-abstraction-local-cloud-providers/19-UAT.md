# Phase 19 UAT: STT Provider Abstraction + Local/Cloud Providers

updated: 2026-05-13T02:29:02-04:00

## Automated UAT

- AUTOMATED MOCKED PASS: provider catalog lists FunASR, faster-whisper, OpenAI, and Groq with local/cloud and consent/API-key capability labels.
- AUTOMATED REAL DEPENDENCY PASS: local STT runtime dependency gate confirms `faster-whisper`, `funasr`, `torch`, and `torchaudio` are installed in the sidecar environment.
- AUTOMATED MOCKED PASS: cloud STT is blocked before provider construction when consent or credentials are missing.
- AUTOMATED MOCKED PASS: local STT test is blocked until the local model cache entry contains non-empty model files.
- AUTOMATED MOCKED PASS: successful fake local STT test receives a valid WAV payload, uses the resolved app-managed cache path, returns a non-empty transcript, and marks readiness active with `ready`.
- AUTOMATED MOCKED PASS: invalid/non-WAV Settings test payloads fail before readiness is marked active.
- AUTOMATED MOCKED PASS: local model download endpoint invokes provider-specific download helpers and reports `downloaded` only when usable files exist.
- AUTOMATED MOCKED PASS: Settings STT recorder submits RIFF/WAVE bytes and stops microphone tracks after the explicit test action.
- AUTOMATED MOCKED PASS: OpenAI/Groq cloud provider adapters preserve explicit `zh`/`en` language modes and omit language in auto mode.
- AUTOMATED MOCKED PASS: Settings STT test and runtime voice-input transcription run provider work off the FastAPI event loop.
- AUTOMATED MOCKED PASS: Settings renders local model cache controls and does not call conversation-history submission APIs from STT settings tests.
- AUTOMATED LIVE-GATED AVAILABLE: `sidecar/tests/stt/test_live_local_stt.py` now provides opt-in live local-provider transcription and model-download checks. They are skipped unless explicit live STT environment variables are set.

## Manual / Live Acceptance

- LIVE PASS: from a clean app-managed STT cache, download FunASR/SenseVoiceSmall or faster-whisper from Settings and confirm cache state becomes `downloaded` only after real model files exist and provider health no longer reports missing local STT runtime dependencies.
- LIVE PASS: run one short Settings-only local transcription with the downloaded model and confirm a non-empty transcript gates readiness.
- LIVE PASS: remove the downloaded model and confirm readiness is invalidated and Chat voice input is blocked.
- SKIPPED: with available credentials, run one OpenAI or Groq Settings-only transcription using explicit consent and inspect diagnostics for redaction.
  reason: "Optional cloud live test skipped by user; automated tests cover explicit consent, credential gates, language propagation, and redacted diagnostics."
- LIVE PASS: confirm no model download, provider import, or model load happens at app boot.

## Final Result

- Local provider live acceptance: passed.
- Local model download/cache truthfulness: passed.
- Settings-only local transcription readiness: passed.
- Local model removal/readiness invalidation: passed.
- Heavy STT lazy-load at boot: passed.
- Cloud live transcription: skipped by user because credentials were not used; automated coverage verifies explicit consent, credential gates, language propagation, and redacted diagnostics.
