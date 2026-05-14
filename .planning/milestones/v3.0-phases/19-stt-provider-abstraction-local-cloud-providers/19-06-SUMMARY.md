# Phase 19-06 Summary: STT Test Audio, Readiness, Event Loop, And Cloud Language Fixes

requirements-completed: [STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, PERF-01]

## Completed

- Updated the Settings-only STT recorder to submit real WAV bytes through the existing `audioBase64Wav` contract.
- Added coherent active readiness semantics with `invalidation_reason: ready` instead of `never_tested`.
- Moved provider construction/transcription work for Settings tests and runtime voice input off the FastAPI event loop.
- Passed explicit `zh`/`en` language modes through OpenAI and Groq transcription requests while preserving auto-detect when selected.
- Reconciled Phase 19 evidence so automated checks are separated from live local/cloud provider acceptance.

## Verification

- `cd sidecar; uv run pytest tests/stt/test_model_cache.py tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py tests/admin/test_audio_stt_local.py tests/admin/test_audio_stt_cloud.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_openai_stt_provider.py tests/stt/test_groq_stt_provider.py -q`
- `npm --workspace apps/renderer run test -- --run test-recorder Settings`
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput`
- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run build`

## Manual Follow-Up

- Live local-provider Settings transcription is still pending after a real model download.
- Live OpenAI/Groq transcription with user-provided credentials and consent remains pending; automated tests cover consent, credential, language, and redaction behavior with fakes.
