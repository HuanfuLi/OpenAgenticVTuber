---
status: issues_found
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
depth: deep
files_reviewed: 35
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
reviewed_at: 2026-05-11T10:40:00Z
---

# Phase 20 Code Review

## Findings

### CR-20-01: Voice readiness depends on a Settings STT test recorder that emits mislabeled WebM

Severity: Critical

Evidence:
- `apps/renderer/src/audio/test-recorder.ts:13` records `audio/webm`.
- `apps/renderer/src/audio/test-recorder.ts:29` returns those bytes as `audioBase64Wav`.
- `apps/renderer/src/screens/Settings/Settings.tsx:2222-2227` sends that payload to `testSttProvider`.
- Cloud providers then send it as `audio/wav`.

Impact:
Phase 20 requires a passing Settings STT test before Chat/PTT readiness. The test can fail against real providers because the payload is not WAV, while automated tests mock `recordSettingsTestWav` with a fake RIFF prefix and do not exercise the real recorder.

Remediation:
Route Settings recordings through the same WAV conversion used by `VoiceCapture`, or carry an explicit media type through the STT test contract. Add a test around the real recorder/encoder boundary.

### CR-20-02: Runtime STT can block the sidecar event loop during PTT/VAD use

Severity: Critical

Evidence:
- `sidecar/src/sidecar/admin/audio.py:568-579` performs runtime provider build/transcribe synchronously in an async endpoint.
- Phase 20 preview/final transcription calls this endpoint from `apps/renderer/src/audio/voice-capture.ts`.
- The STT config declares `execution: "off_event_loop"`, but the runtime path does not honor it.

Impact:
PTT finalization, preview transcription, and VAD auto-submit can freeze the sidecar loop while local STT or cloud SDK work runs. That can affect cursor tracking, VTS/plugin updates, and readiness endpoints during active voice input.

Remediation:
Run STT provider work in a bounded worker thread/executor and keep the async route responsive. Add a regression test that proves a slow fake provider does not block another sidecar admin request.

### WR-20-01: Normal capture disposal writes a visible voice error

Severity: Warning

Evidence:
- `apps/renderer/src/audio/voice-capture.ts:123` defaults `cancel()` to `"Voice capture canceled."`.
- `apps/renderer/src/audio/voice-capture.ts:139-142` calls `cancel()` from `dispose()`.
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx:129` and `135` dispose capture during unmount/session changes.
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx:315-318` renders any `voice.error`.

Impact:
A normal unmount or session change can leave a stale "Voice capture canceled." message in the global voice store and render it as an error in the next Chat view.

Remediation:
Make dispose/session-change cancellation silent, or distinguish informational cancellation from blocking/error state.

### WR-20-02: Preview transcription failure promotes the whole voice state to error

Severity: Warning

Evidence:
- `apps/renderer/src/audio/voice-capture.ts:198-222` treats preview encode/transcribe failure as a failed preview result.
- `apps/renderer/src/state/voice-input-store.ts:135-142` turns any failed preview into `captureStatus: "error"`.

Impact:
Preview is supposed to be transient and non-authoritative. A transient preview failure while the user is still recording can put Chat into an error state even though final transcription may still succeed.

Remediation:
Keep preview failures non-blocking while capture is active. Reserve `error` for final transcription failure, permission failure, or recorder failure.

### WR-20-03: LLM config saves still fall back to default audio on config-read failure

Severity: Warning

Evidence:
- `apps/renderer/src/state/app-store.tsx:324-327` catches `getStoredConfig` failure and passes `null` to `llmConfigToStoredConfig`.
- `apps/renderer/src/state/app-store.tsx:145` then supplies `defaultAudioConfig()` when no base config is available.

Impact:
The recent persistence fix preserves audio only when `getStoredConfig` succeeds. If the read fails transiently but `saveStoredConfig` succeeds, a later LLM save can still overwrite voice/STT/plugin/preset settings with defaults.

Remediation:
Fail closed for full-config saves when the existing config cannot be read, or expose a narrower IPC patch API for provider-only changes.

