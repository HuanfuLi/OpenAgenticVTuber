# Phase 22 AEC Diagnostics Audit

## Scope

Plan 22-01 instruments the existing renderer microphone capture paths. It does not add a second recorder and does not change final STT submission behavior.

## Current Capture Paths

| Path | File | Stream Owner | Notes |
|------|------|--------------|-------|
| PTT/final recording | `apps/renderer/src/audio/voice-capture.ts` | `VoiceCapture` | Uses `MediaRecorder`, encodes final audio to WAV, then calls runtime STT. |
| VAD monitoring | `apps/renderer/src/audio/vad-controller.ts` | `VadController` | Uses `AudioContext`/`AnalyserNode` for RMS threshold detection, then starts/stops the same `VoiceCapture` recording path. |
| Settings source | `apps/renderer/src/state/audio-settings.ts` | renderer local storage | Stores PTT shortcut, selected microphone, loopback/system-audio suspicion, and VAD preferences. |

## Requested Constraints

`voiceInputAudioConstraints()` currently requests:

- `channelCount: { ideal: 1 }`
- `echoCancellation: { ideal: true }`
- `noiseSuppression: { ideal: true }`
- selected microphone `deviceId: { exact }` when a physical input is selected.

This means Phase 22 can inspect browser/WebRTC AEC behavior without replacing the capture stack.

## Diagnostic Fields

The renderer records metadata only:

- source path: `ptt` or `vad`;
- selected microphone label, whether a device id is present, and system-audio suspicion;
- supported constraint flags from `getSupportedConstraints()`;
- requested AEC/noise/channel/device constraints;
- applied track settings: AEC/noise/AGC values, channel count, sample rate, and whether device/group identifiers were present;
- track capabilities and applied constraints when browser APIs expose them.

## Redaction Boundary

Diagnostics do not retain:

- raw microphone audio;
- TTS audio bytes;
- waveform samples;
- STT transcript text;
- raw `deviceId` or `groupId` values.

Device identifiers are represented as booleans such as `deviceIdPresent`.

## Requirement Coverage

- `AEC-01`: Browser/WebRTC echo cancellation is requested through current renderer capture and recorded as real applied metadata.
- `AEC-04`: VAD defaults remain unchanged and conservative while diagnostics are added.
