# Phase 22 Active-TTS Safety Audit

## Current Active-Turn Definition

The shipped Chat path treats a turn as active when input is disabled, the turn is settling, or renderer audio playback is active.

Relevant files:

- `apps/renderer/src/screens/Chat/Chat.tsx`
- `apps/renderer/src/screens/Chat/VoiceInputControl.tsx`
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts`
- `apps/renderer/src/ws/store.ts`
- `apps/renderer/src/ws/audio-player.ts`

## Existing Mitigations

| Mitigation | Evidence | Result |
|------------|----------|--------|
| VAD pause during active turns | `VadController.shouldIgnoreSpeech()` returns `turn_in_progress`; Chat shows `VAD paused`. | VAD monitoring can continue, but recording does not start during active turns. |
| One queued final transcript | `voice-input-store` keeps one queued final candidate and Chat promotes it after speaking/input/settling clears. | PTT/final STT during active turns does not dispatch immediately. |
| Stop-current-turn | Chat Stop sends `stop-turn`, stops renderer playback, unlocks input, and preserves the user message for edit. | User can stop streaming/TTS before editing. |
| Edit/regenerate | Persisted and stopped user messages can be edited and dispatched as normal `text-input`. | STT typo recovery remains manual and explicit. |

## Playback Lifecycle Finding

The previous `isSpeaking` state was driven mainly by WebSocket audio/control envelopes. Phase 22 adds renderer playback lifecycle state in `audio-player.ts` so speaking remains true until queued browser audio drains, even if `conversation-chain-end` arrives while audio is still playing.

No raw audio, object URLs, or audio bytes are retained in lifecycle state.

## Guard Decision Input

`existing_mitigations_sufficient: yes`

Evidence:

- VAD active-turn pause prevents VAD self-submit while Teto is speaking.
- PTT/final transcripts captured during active TTS are queued behind active speaking/settlement.
- Renderer playback lifecycle now keeps speaking true until audio drains.
- Stop and edit/regenerate remain explicit recovery paths.

Plan 22-03 should document the no-guard decision and add regression coverage around the current mitigations rather than introduce content-based transcript discard logic.

## Limitations For UAT

- Manual UAT still must confirm speaker echo does not produce queued PTT self-submit in the user's room/device setup.
- Cloud STT path remains conditional on explicit credentials and consent.
- The final no-headphones status remains conservative until `22-UAT.md` records the verdict.
