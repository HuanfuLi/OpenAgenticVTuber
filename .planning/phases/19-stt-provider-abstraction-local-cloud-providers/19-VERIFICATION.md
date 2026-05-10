# Phase 19 Verification: STT Provider Abstraction + Local/Cloud Providers

## Verdict

PASS

## Success Criteria

1. STT can be enabled with FunASR as recommended local default or faster-whisper as local fallback.
   - PASS: provider catalog marks FunASR/SenseVoiceSmall recommended and faster-whisper as visible local fallback; enablement remains readiness-gated.

2. OpenAI/Groq transcription is explicit opt-in only.
   - PASS: cloud providers require STT-specific consent and credentials before provider construction or network behavior.

3. User can run a Settings test transcription before enabling voice input.
   - PASS: admin STT test accepts Settings test audio and returns transcript, latency, model state, diagnostics, and readiness state.

4. User can see and control local model cache/download behavior before large STT models load.
   - PASS: model cache status, prepare/download, and remove endpoints exist and Settings renders cache status/actions.

5. Heavy local STT models lazy-load after boot.
   - PASS: registry/catalog/cache/status paths do not import FunASR, faster-whisper, OpenAI, Groq, or torch at boot; tests assert provider imports happen only during explicit provider construction/transcription.

## Verification Commands

- `uv run --project sidecar python -m pytest packages/contracts/tests/test_codegen.py -q`
- `uv run --project sidecar python -m pytest sidecar/tests/admin/test_audio_stt_local.py sidecar/tests/admin/test_audio_stt_cloud.py sidecar/tests/stt -q`
- `npm --workspace apps/renderer run typecheck`
- `npm --workspace apps/electron-main run build`
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx safe-storage-migration.test.ts`
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts safe-storage.test.ts`

## Notes

- Real provider SDK/model installation remains optional in this environment; automated tests use fakes to prove lazy import, readiness, consent, and endpoint behavior.
- Voice chat submission, VAD/PTT preview, and transcript streaming remain Phase 20 scope.

