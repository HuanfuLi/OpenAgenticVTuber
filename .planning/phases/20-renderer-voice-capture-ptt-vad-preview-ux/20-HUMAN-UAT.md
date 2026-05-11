---
status: partial
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
source: [20-VERIFICATION.md, 20-UAT.md]
started: 2026-05-11T05:50:00Z
updated: 2026-05-11T06:49:00Z
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

### 4. Live Readiness Recovery After Startup

expected: A startup `Sidecar is not ready.` state clears after sidecar-ready/reconnect, and PTT enables once STT readiness and microphone permission are valid.
result: pending

### 5. Live STT Test Save Refreshes Chat

expected: A successful Settings STT test followed by Save refreshes Chat readiness and clears stale `Voice input is disabled in Voice settings.` text.
result: pending

### 6. Live Truthful Model Cache And VAD Copy

expected: STT model cache no longer reports instant fake download; VAD copy is clearly browser volume/silence detection with no downloadable model.
result: pending

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

Implementation gap closures 20-05 and 20-06 are complete. Remaining checks require live microphone hardware, a ready STT provider, and observable renderer playback.
