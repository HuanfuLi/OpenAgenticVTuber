# Phase 22 Self-Speech Guard Decision

## Decision

`existing_mitigations_sufficient: yes`

Phase 22 does not add a content-based self-speech guard in production code.

## Evidence Summary

- VAD monitoring uses `shouldIgnoreSpeech()` and reports `turn_in_progress` instead of starting recording while a turn is active.
- Chat exposes this as `VAD paused`, which is expected safety behavior.
- Final voice candidates captured during active input/speaking state are queued instead of dispatched immediately.
- Queued final candidates promote only after speaking, input-disabled, and turn-settling states clear.
- Renderer audio playback now publishes lifecycle state so `isSpeaking` remains true until queued browser audio drains.
- Stop remains explicit user cancellation and edit/regenerate remains the manual STT typo recovery path.

## Why No Guard Was Added

A deterministic text-overlap guard would discard transcript candidates after STT. The current shipped mitigation prevents VAD recording during active TTS and prevents final candidates from dispatching while Teto is still speaking. Adding a transcript discard layer now would add complexity and possible false drops before UAT proves it is needed.

If manual UAT later shows assistant speech can still enter Chat through PTT, provider latency, or a specific device setup, a gap-closure plan should add the smallest provider-independent guard before the shared Chat `text-input` dispatch path.

## Tests Covering This Decision

- `ChatVoiceInput.test.tsx`: VAD waits while Teto is speaking.
- `ChatVoiceInput.test.tsx`: final transcript queues during active turns and sends after the turn ends.
- `ChatVoiceInput.test.tsx`: queued transcript waits for turn settlement.
- `ws-audio-player.test.ts`: playback lifecycle remains active until queued audio drains.
- `ws-store-audio.test.ts`: chain-end keeps speaking true while renderer audio is still playing.

## Residual Risk

Manual UAT still needs to test physical no-headphones speaker echo. If the user intentionally presses PTT while Teto is speaking and the microphone hears Teto clearly, the final transcript may still contain echo content after TTS drains. Phase 22 handles that risk through UAT verdict and Settings status rather than a runtime classifier.

## Requirement Coverage

- `AEC-02`: Covered by pause/queue/playback-lifecycle mitigations plus final manual UAT.
- No raw audio or assistant-like discarded transcript text is retained because no discard pipeline is introduced.
