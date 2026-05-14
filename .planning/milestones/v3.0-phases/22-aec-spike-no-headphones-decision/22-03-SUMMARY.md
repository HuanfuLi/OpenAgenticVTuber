# 22-03 Summary: Conditional Self-Speech Guard

## Status

Complete.

## Decision

No new content-based self-speech guard was added.

## Rationale

The Phase 22 safety audit found the existing mitigations sufficient as the shipped baseline:

- VAD pauses while Teto is speaking.
- PTT during active turns follows the existing queue path instead of barge-in.
- Stop-current-turn is available when the user needs to interrupt output.
- Edit/regenerate lets the user correct STT mistakes after a normal dispatch.
- Renderer playback state now keeps `speaking` true while renderer audio is actually queued or playing.

A transcript/content guard would be provider-independent but brittle, and it could suppress legitimate user speech that resembles assistant text. The phase therefore documents the no-guard decision and relies on live UAT to disprove or confirm the baseline.

## Artifact

- `.planning/phases/22-aec-spike-no-headphones-decision/22-SELF-SPEECH-GUARD-DECISION.md`

## Verification

Covered by the active-TTS, VAD pause, queueing, Stop, and edit/regenerate regression suites listed in `22-02-SUMMARY.md`.

