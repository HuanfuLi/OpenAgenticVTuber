# Phase 19 Verification: STT Provider Abstraction + Local/Cloud Providers

## Verdict

AUTOMATED PASS; LIVE PROVIDER UAT PENDING

## Success Criteria

1. STT can be enabled with FunASR as recommended local default or faster-whisper as local fallback.
   - AUTOMATED PASS: provider catalog marks FunASR/SenseVoiceSmall recommended and faster-whisper as visible local fallback; enablement remains readiness-gated.
   - LIVE PENDING: one real local provider still needs a Settings transcription after downloading model files on a developer machine.

2. OpenAI/Groq transcription is explicit opt-in only.
   - PASS: cloud providers require STT-specific consent and credentials before provider construction or network behavior.

3. User can run a Settings test transcription before enabling voice input.
   - AUTOMATED PASS: admin STT test accepts valid WAV Settings test audio and returns transcript, latency, model state, diagnostics, and readiness state with mocked providers.
   - LIVE PENDING: real local/cloud provider transcription remains unverified in this environment.

4. User can see and control local model cache/download behavior before large STT models load.
   - AUTOMATED PASS: model cache status, explicit download, and remove endpoints exist; Settings renders cache status/actions; cache status does not report placeholder-only directories as downloaded.
   - LIVE PENDING: real network download of a supported model needs manual acceptance.

5. Heavy local STT models lazy-load after boot.
   - PASS: registry/catalog/cache/status paths do not import FunASR, faster-whisper, OpenAI, Groq, or torch at boot; tests assert provider imports happen only during explicit provider construction/transcription.

## Verification Commands

- `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q`
- `uv run --project sidecar python -m pytest sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/admin/test_audio_stt_cloud.py sidecar/tests/stt -q`
- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run build`
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts safe-storage.test.ts`
- `cd sidecar; uv run pytest tests/stt/test_model_cache.py tests/stt/test_funasr_provider.py tests/stt/test_faster_whisper_provider.py tests/admin/test_audio_stt_local.py tests/admin/test_audio_stt_cloud.py tests/admin/test_audio_voice_input_endpoint.py tests/stt/test_openai_stt_provider.py tests/stt/test_groq_stt_provider.py -q`
- `npm --workspace apps/renderer run test -- --run test-recorder Settings`
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput`

## Notes

- Real provider SDK/model installation and cloud credentials are unavailable in this environment; automated tests use fakes to prove lazy import, explicit download orchestration, cache-path binding, WAV payloads, readiness, consent, language propagation, and endpoint behavior.
- Phase 19 must not be treated as fully live-accepted until the manual/local checks in `19-UAT.md` pass or are explicitly waived.
- Voice chat submission, VAD/PTT preview, and transcript streaming remain Phase 20 scope.
