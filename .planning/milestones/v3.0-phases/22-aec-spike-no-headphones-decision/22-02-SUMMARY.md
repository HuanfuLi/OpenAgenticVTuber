# 22-02 Summary: Active-TTS Safety Verification

## Status

Complete.

## Implementation

- Audited the current active-TTS safety path before adding new guard logic.
- Added renderer audio playback lifecycle state so speaking remains true while queued/playing renderer audio is still active.
- Updated WebSocket store subscriptions to follow actual renderer playback state instead of ending speaking state at conversation-chain end.
- Confirmed existing safety primitives remain the baseline: VAD pauses during active TTS, PTT can queue during active turns, Stop cancels active output, and edit/regenerate recovers STT typo mistakes.
- Added `22-SAFETY-AUDIT.md` with the verdict that current mitigations are sufficient for this phase unless live UAT proves otherwise.

## Files

- `apps/renderer/src/ws/audio-player.ts`
- `apps/renderer/src/ws/store.ts`
- `apps/renderer/tests/ws-audio-player.test.ts`
- `apps/renderer/tests/ws-store-audio.test.ts`
- `apps/renderer/tests/ChatVoiceInput.test.tsx`
- `apps/renderer/tests/ChatStreaming.test.tsx`
- `.planning/phases/22-aec-spike-no-headphones-decision/22-SAFETY-AUDIT.md`

## Verification

- `npm --workspace apps/renderer run test -- --run ws-audio-player` passed.
- `npm --workspace apps/renderer run test -- --run ws-store-audio` passed.
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput` passed.
- `npm --workspace apps/renderer run test -- --run ChatStreaming` passed.

