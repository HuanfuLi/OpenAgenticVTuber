# 22-04 Summary: Settings No-Headphones Status And VAD Policy

## Status

Complete.

## Implementation

- Added `noHeadphones` settings with `Ready`, `Limited`, and `Unsafe` status plus an explicit unsafe override.
- Defaulted no-headphones status to `Unsafe` and VAD disabled until the user marks the setup verified or deliberately overrides.
- Added Settings UI for no-headphones status, unsafe override, concise status help, and latest AEC diagnostic summary.
- Kept VAD explicit opt-in and blocked VAD enablement while no-headphones status is Unsafe without override.
- Preserved PTT as the safer default path.

## Files

- `apps/renderer/src/state/audio-settings.ts`
- `apps/renderer/src/screens/Settings/VoiceInputSection.tsx`
- `apps/renderer/src/screens/Settings/Settings.tsx`
- `apps/renderer/src/lib/copy.ts`
- `apps/renderer/tests/Settings.test.tsx`
- `apps/renderer/tests/ChatVoiceInput.test.tsx`
- `apps/renderer/tests/voice-input-store.test.ts`
- `apps/renderer/tests/vad-controller.test.ts`

## Verification

- `npm --workspace apps/renderer run test -- --run Settings` passed.
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput` passed.
- `npm --workspace apps/renderer run test -- --run voice-input-store` passed.
- `npm --workspace apps/renderer run test -- --run vad-controller` passed.
- `npm --workspace apps/renderer run typecheck` passed.

