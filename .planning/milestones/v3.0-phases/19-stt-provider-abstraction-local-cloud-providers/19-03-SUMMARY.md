# Phase 19-03 Summary: Cloud STT Providers, Consent, And Redacted Diagnostics

## Completed

- Added lazy OpenAI and Groq STT provider adapters that use provider-specific STT credentials and consent from audio settings.
- Cloud providers call transcription endpoints, not translation endpoints, and do not run as fallback providers.
- Admin STT test blocks cloud providers before provider construction/network behavior when consent or credentials are missing.
- Cloud provider failures return typed health states with redacted diagnostics.

## Verification

- `uv run --project sidecar python -m pytest sidecar/tests/stt/test_openai_stt_provider.py sidecar/tests/stt/test_groq_stt_provider.py sidecar/tests/admin/test_audio_stt_cloud.py sidecar/tests/test_audio_redaction.py -q`

