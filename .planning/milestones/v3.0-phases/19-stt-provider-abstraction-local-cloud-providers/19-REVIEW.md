---
status: issues_found
phase: 19-stt-provider-abstraction-local-cloud-providers
depth: deep
files_reviewed: 34
findings:
  critical: 4
  warning: 3
  info: 0
  total: 7
reviewed_at: 2026-05-12T04:27:30Z
---

# Phase 19 Code Review

## Findings

### CR-19-01: STT model download endpoint is still a hardcoded manual-setup stub

Severity: Critical

Evidence:
- `sidecar/src/sidecar/admin/audio.py:633` routes `/admin/audio/stt/models/download` directly to `STTModelCache.download_unavailable(...)`.
- `sidecar/src/sidecar/stt/model_cache.py:10` defines the returned summary as `Automatic STT model download is not implemented yet.`
- `sidecar/tests/admin/test_audio_stt_local.py:109` asserts this unavailable behavior as passing.
- `19-02-PLAN.md` success criteria said FunASR/SenseVoiceSmall and faster-whisper can be explicitly downloaded, tested, and marked ready.

Impact:
Phase 19 reports automated UAT pass while the primary local-STT first-use path cannot download a model. Live Phase 20 voice input is blocked unless the user manually places real model files or configures a local path. This is a Phase 19 gap, not a Phase 20 renderer issue.

Remediation:
Add a Phase 19 gap-closure plan for a real local STT model download manager, or formally revise the Phase 19 acceptance criteria to "manual model path required." The product UI, UAT, and roadmap must not claim explicit automatic download until this endpoint performs a real provider-specific download with progress/failure semantics.

### CR-19-02: App-managed local model cache is validated but not used by local providers

Severity: Critical

Evidence:
- `sidecar/src/sidecar/admin/audio.py:456` blocks local STT unless `_local_model_status(...) == "downloaded"`.
- `sidecar/src/sidecar/stt/model_cache.py:79` defines the app-managed cache path, for example `stt-models/funasr/iic__SenseVoiceSmall`.
- `sidecar/src/sidecar/stt/providers/funasr_provider.py:58` loads `local_model_path_override or local_model_id or "iic/SenseVoiceSmall"`.
- `sidecar/src/sidecar/stt/providers/faster_whisper_provider.py:47` loads `local_model_path_override or local_model_id or "small"`.

Impact:
The cache gate can pass because files exist in app-managed cache, but provider construction ignores that cache path and loads by model id instead. That can trigger provider/library default download behavior, load a different model location, or fail despite the UI reporting the app-managed model as present.

Remediation:
Resolve the effective local model path once in the admin/provider boundary. If no explicit override is set and the app-managed cache contains the selected model, pass that cache path into the provider. Add tests asserting the fake `AutoModel`/`WhisperModel` receives the app-managed cache path.

### CR-19-03: Settings STT test records WebM but sends it through the contract as WAV

Severity: Critical

Evidence:
- `apps/renderer/src/audio/test-recorder.ts:13` constructs `MediaRecorder(stream, { mimeType: 'audio/webm' })`.
- `apps/renderer/src/audio/test-recorder.ts:26-30` base64-encodes that WebM blob and returns it as `audioBase64Wav`.
- `sidecar/src/sidecar/stt/providers/openai_provider.py:45` sends the bytes to OpenAI as `("settings-test.wav", ..., "audio/wav")`.
- `sidecar/src/sidecar/stt/providers/groq_provider.py:45` does the same for Groq.

Impact:
The Settings test is the gate that marks STT readiness active. In a real browser/Electron run it produces WebM/Opus bytes, but downstream code and cloud MIME labels treat them as WAV. Fake tests pass because they do not decode the bytes. Real providers can reject the file or behave inconsistently.

Remediation:
Reuse the Phase 20 WAV encoder (`encodeVoiceBlobToBase64Wav`) for Settings tests, or change the contract to carry actual media type and filename. Add a renderer test that fails if `recordSettingsTestWav` returns a non-RIFF payload.

### CR-19-04: Successful readiness is marked with `never_tested`

Severity: Critical

Evidence:
- `sidecar/src/sidecar/stt/readiness.py:31-39` sets `active_allowed=True` after a passing test, but also sets `invalidation_reason="never_tested"`.
- Tests assert only `active_allowed`, not that the reason reflects a valid tested state.

Impact:
The readiness object can say both "active allowed" and "never tested." That undermines diagnostics and any UI or future gate that interprets `invalidation_reason` independently from `active_allowed`.

Remediation:
Add a positive reason such as `valid`/`none`, or allow `invalidation_reason` to be null for active readiness. Update generated contracts and tests accordingly.

### WR-19-01: STT execution is synchronous inside async FastAPI routes

Severity: Warning

Evidence:
- `sidecar/src/sidecar/admin/audio.py:467-478` decodes, builds, loads, and transcribes synchronously inside `async def post_stt_test`.
- `sidecar/src/sidecar/admin/audio.py:568-579` does the same inside runtime `/voice-input`.
- Config defaults expose `execution: "off_event_loop"`, but no `asyncio.to_thread` or executor is used.

Impact:
Local model load/inference and cloud SDK calls can block the sidecar event loop. During long STT tests or PTT finalization, VTS/plugin/websocket/admin responsiveness can stall.

Remediation:
Move provider build/load/transcribe work behind `asyncio.to_thread` or a bounded executor. Preserve typed failures and cancellation semantics.

### WR-19-02: Cloud STT ignores selected language mode

Severity: Warning

Evidence:
- `sidecar/src/sidecar/stt/providers/openai_provider.py:43-46` calls transcription with `model` and `file` only.
- `sidecar/src/sidecar/stt/providers/groq_provider.py:43-46` also omits language.
- `STTRequest.language_mode` is supplied by admin routes, but the cloud adapters never use it.

Impact:
Settings exposes `auto`, `zh`, and `en`, but OpenAI/Groq requests always behave as provider default/auto. This weakens user control and makes language-specific verification misleading.

Remediation:
Map `language_mode != "auto"` to the provider-supported language parameter, and test both OpenAI and Groq request bodies.

### WR-19-03: Local STT automated UAT used non-audio bytes and provider fakes

Severity: Warning

Evidence:
- `sidecar/tests/admin/test_audio_stt_local.py:46` and `:98` send `base64.b64encode(b"wav")`, not a valid RIFF/WAV sample.
- `sidecar/tests/admin/test_audio_stt_local.py:61-68` monkeypatches a fake FunASR `AutoModel` that accepts any bytes.
- `19-UAT.md` says automated local STT passed, but the manual follow-up still says real provider dependencies/model tests are optional.

Impact:
The UAT proves endpoint branching and readiness wiring, not that a real local STT provider can decode app-recorded audio or run with real model files. That is why Phase 20 live UAT can still be blocked after Phase 19 "passed."

Remediation:
Add at least one checked-in tiny valid WAV fixture for local-provider boundary tests, plus a manual/live UAT gate for real FunASR or faster-whisper before claiming Phase 19 local STT acceptance.
