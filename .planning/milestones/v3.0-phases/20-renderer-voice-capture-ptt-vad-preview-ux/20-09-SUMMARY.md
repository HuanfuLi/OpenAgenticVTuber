---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
plan: 20-09
status: implemented
completed: 2026-05-13T01:19:28-04:00
gap_closure: true
---

# 20-09 Summary: Active-Turn Voice Queue Ordering

## Outcome

Implemented the active-turn queued voice ordering gap closure. Queued voice input is now held until the previous assistant turn has finished conversation-history persistence and streaming cleanup, preventing the queued turn from overwriting the completed turn's pending state.

## Changes

- Added identity-aware completed-turn candidates and cleanup keyed by the originating user message id.
- Added a short turn-settling state between `conversation-chain-end` and persistence cleanup completion.
- Blocked queued voice dispatch while a previous turn is settling.
- Kept newer pending turns intact if older completed-turn cleanup resolves late.
- Added regression coverage for identity-aware cleanup and queued voice hold/release behavior.

## Verification

- `npm --workspace apps/renderer run test -- --run useStreamingMessages` passed.
- `npm --workspace apps/renderer run test -- --run ChatVoiceInput` passed.
- `npm --workspace apps/renderer run test -- --run ChatStreaming` passed.
- `npm --workspace apps/renderer run typecheck` passed.

## Human Retest

Retest Phase 20 Test 3 in the live app: ask the first question by VAD, capture the second question by PTT while the first answer is active, then confirm the visible sequence is first question, first answer, second question, second answer with no duplicated first turn and no dropped queued turn.
