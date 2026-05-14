# Phase 19 Verification: STT Provider Abstraction + Local/Cloud Providers

updated: 2026-05-13T02:29:02-04:00

## Verdict

PASS

## Success Criteria

1. `STT-01` / `STT-02`: STT can be enabled with FunASR as recommended local default or faster-whisper as local fallback.
   - AUTOMATED PASS: provider catalog marks FunASR/SenseVoiceSmall recommended and faster-whisper as visible local fallback; enablement remains readiness-gated.
   - LIVE PASS: one real local provider completed model download and Settings transcription on a developer machine.

2. `STT-03` / `STT-04`: OpenAI/Groq transcription is explicit opt-in only.
   - PASS: cloud providers require STT-specific consent and credentials before provider construction or network behavior.
   - LIVE SKIPPED: cloud transcription was not tested with credentials; automated coverage verifies consent, credential gates, language propagation, and redacted diagnostics.

3. `STT-05`: User can run a Settings test transcription before enabling voice input.
   - AUTOMATED PASS: admin STT test accepts valid WAV Settings test audio and returns transcript, latency, model state, diagnostics, and readiness state with mocked providers.
   - LIVE PASS: real local provider transcription returned a non-empty Settings transcript and marked readiness ready.

4. `STT-06`: User can see and control local model cache/download behavior before large STT models load.
   - AUTOMATED PASS: model cache status, explicit download, and remove endpoints exist; Settings renders cache status/actions; cache status does not report placeholder-only directories as downloaded.
   - LIVE PASS: local model cache reached `downloaded` only after real files existed, and removal invalidated readiness.

5. `PERF-01`: Heavy local STT models lazy-load after boot.
   - PASS: registry/catalog/cache/status paths do not import FunASR, faster-whisper, OpenAI, Groq, or torch at boot; tests assert provider imports happen only during explicit provider construction/transcription.
   - LIVE PASS: app boot did not trigger model download, provider import, or model load.

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

- Real local provider acceptance passed in `19-UAT.md`; cloud live transcription was skipped by user because credentials were not used.
- Automated tests use fakes to prove cloud consent, credential gates, language propagation, and redacted diagnostics.
- Voice chat submission, VAD/PTT preview, and transcript streaming remain Phase 20 scope.
