# Phase 19-05 Summary: Real Local STT Model Downloads And Cache Path Binding

## Completed

- Added explicit local model download orchestration for FunASR/SenseVoiceSmall through ModelScope and faster-whisper through Hugging Face Hub.
- Replaced the manual-setup download stub so app-managed cache entries report `downloaded` only after non-empty model files exist.
- Bound local provider construction to the validated app-managed cache path instead of remote model identifiers.
- Strengthened local STT admin tests with valid WAV fixtures and invalid-audio rejection coverage.

## Verification

- `cd sidecar; uv run pytest tests/stt/test_model_cache.py tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py tests/admin/test_audio_stt_local.py tests/admin/test_audio_voice_input_endpoint.py -q`

## Manual Follow-Up

- Live download of at least one local provider model still needs a developer machine with network access and provider dependencies available.
- Live Settings transcription with a downloaded local provider remains blocked until that model download is exercised outside the mocked test path.
