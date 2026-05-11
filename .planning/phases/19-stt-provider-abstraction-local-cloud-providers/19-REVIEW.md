---
status: issues_found
phase: 19-stt-provider-abstraction-local-cloud-providers
depth: deep
files_reviewed: 34
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
reviewed_at: 2026-05-11T10:40:00Z
---

# Phase 19 Code Review

## Findings

### CR-19-01: App-managed local model cache is validated but not used by local providers

Severity: Critical

Evidence:
- `sidecar/src/sidecar/admin/audio.py:456` blocks local STT unless `_local_model_status(...) == "downloaded"`.
- `sidecar/src/sidecar/stt/model_cache.py:79` defines the app-managed cache path, for example `stt-models/funasr/iic__SenseVoiceSmall`.
- `sidecar/src/sidecar/stt/providers/funasr_provider.py:58` loads `local_model_path_override or local_model_id or "iic/SenseVoiceSmall"`.
- `sidecar/src/sidecar/stt/providers/faster_whisper_provider.py:47` loads `local_model_path_override or local_model_id or "small"`.

Impact:
The cache gate can pass because files exist in app-managed cache, but provider construction ignores that cache path and loads by model id instead. That can trigger a provider/library default download, load a different model location, or fail despite the UI reporting the app-managed model as present. This undermines Phase 19's local model cache contract and Phase 20's readiness gate.

Remediation:
Resolve the effective local model path once in the admin/provider boundary. If no explicit override is set and the app-managed cache contains the selected model, pass that cache path into the provider. Add tests asserting the fake `AutoModel`/`WhisperModel` receives the app-managed cache path, not only the model id.

### CR-19-02: Settings STT test records WebM but sends it through the contract as WAV

Severity: Critical

Evidence:
- `apps/renderer/src/audio/test-recorder.ts:13` constructs `MediaRecorder(stream, { mimeType: 'audio/webm' })`.
- `apps/renderer/src/audio/test-recorder.ts:26-30` base64-encodes that WebM blob and returns it as `audioBase64Wav`.
- `sidecar/src/sidecar/stt/providers/openai_provider.py:45` sends the bytes to OpenAI as `("settings-test.wav", ..., "audio/wav")`.
- `sidecar/src/sidecar/stt/providers/groq_provider.py:45` does the same for Groq.

Impact:
The Settings test is the gate that marks STT readiness active. In a real browser/Electron run it produces WebM/Opus bytes, but downstream code and cloud MIME labels treat them as WAV. Fake tests pass because they do not decode the bytes. Real providers can reject the file, mis-detect it, or behave inconsistently.

Remediation:
Reuse the Phase 20 WAV encoder (`encodeVoiceBlobToBase64Wav`) for Settings tests or rename the contract field and provider MIME handling to carry the actual media type. Add a renderer test that fails if `recordSettingsTestWav` returns a non-RIFF payload.

### WR-19-01: STT execution is synchronous inside async FastAPI routes

Severity: Warning

Evidence:
- `sidecar/src/sidecar/admin/audio.py:467-478` decodes, builds, loads, and transcribes synchronously inside `async def post_stt_test`.
- `sidecar/src/sidecar/admin/audio.py:568-579` does the same inside runtime `/voice-input`.
- Config defaults expose `execution: "off_event_loop"`, but no `asyncio.to_thread`/executor is used for STT.

Impact:
Local model load/inference and cloud SDK calls can block the sidecar event loop. During long STT tests or PTT finalization, VTS/plugin/websocket/admin responsiveness can stall.

Remediation:
Move provider build/load/transcribe work behind `asyncio.to_thread` or a bounded executor. Preserve typed failures and cancellation semantics.

### WR-19-02: Cloud STT ignores the selected language mode

Severity: Warning

Evidence:
- `sidecar/src/sidecar/stt/providers/openai_provider.py:43-46` calls transcription with `model` and `file` only.
- `sidecar/src/sidecar/stt/providers/groq_provider.py:43-46` also omits language.
- `STTRequest.language_mode` is supplied by admin routes, but the cloud adapters never use it.

Impact:
Settings exposes `auto`, `zh`, and `en`, but OpenAI/Groq requests always behave as provider default/auto. This weakens user control and makes code-switch/language-specific verification misleading.

Remediation:
Map `language_mode != "auto"` to the provider-supported language parameter, and test both OpenAI and Groq request bodies.

