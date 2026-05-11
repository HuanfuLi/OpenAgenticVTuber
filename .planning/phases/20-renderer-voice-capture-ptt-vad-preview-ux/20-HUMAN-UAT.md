---
status: partial
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
source: [20-VERIFICATION.md, 20-UAT.md]
started: 2026-05-11T05:50:00Z
updated: 2026-05-11T05:50:00Z
---

# Phase 20 Human UAT

## Current Test

Awaiting live microphone and playback verification.

## Tests

### 1. Live Microphone PTT Capture

expected: Holding PTT records, shows preview outside chat history, finalizes, and submits one normal user turn.
result: pending

### 2. Live Microphone VAD Auto-Submit

expected: Opt-in VAD listens, records on speech, finalizes after configured silence, and submits only final text.
result: pending

### 3. Live Active-Turn Playback Queue

expected: Speech captured while Teto is speaking queues until the current turn/playback clears and does not interrupt audio.
result: pending

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

No implementation gaps found. These checks require live microphone hardware, a ready STT provider, and observable renderer playback.
