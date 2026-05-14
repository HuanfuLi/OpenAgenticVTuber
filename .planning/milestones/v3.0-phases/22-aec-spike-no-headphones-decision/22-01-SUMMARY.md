# 22-01 Summary: AEC Diagnostics On Current Capture Path

## Status

Complete.

## Implementation

- Added metadata-only AEC diagnostics for the shipped renderer microphone capture path.
- Wired diagnostics into both PTT (`VoiceCapture`) and VAD (`VadController`) without adding a second capture stack.
- Stored the latest diagnostic snapshot in `voice-input-store` as `aecDiagnostics`.
- Redacted raw device IDs/group IDs and retained no audio or transcripts.
- Added `22-AEC-DIAGNOSTICS.md` describing collected fields, privacy boundaries, and interpretation limits.

## Files

- `apps/renderer/src/audio/aec-diagnostics.ts`
- `apps/renderer/src/audio/voice-capture.ts`
- `apps/renderer/src/audio/vad-controller.ts`
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx`
- `apps/renderer/src/state/voice-input-store.ts`
- `apps/renderer/tests/aec-diagnostics.test.ts`
- `apps/renderer/tests/voice-capture.test.ts`
- `apps/renderer/tests/vad-controller.test.ts`
- `apps/renderer/tests/voice-input-store.test.ts`
- `.planning/phases/22-aec-spike-no-headphones-decision/22-AEC-DIAGNOSTICS.md`

## Verification

- `npm --workspace apps/renderer run test -- --run aec-diagnostics` passed.
- `npm --workspace apps/renderer run test -- --run voice-capture` passed.
- `npm --workspace apps/renderer run test -- --run vad-controller` passed.
- `npm --workspace apps/renderer run test -- --run voice-input-store` passed.

