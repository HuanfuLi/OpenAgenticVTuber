---
status: testing
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
source: [20-VERIFICATION.md, 20-UAT.md]
started: 2026-05-11T05:50:00Z
updated: 2026-05-11T07:12:00Z
---

# Phase 20 Human UAT

## Current Test

number: 1
name: Live Microphone PTT Capture
expected: |
  Holding PTT records, shows preview outside chat history, finalizes, and submits one normal user turn.
awaiting: user response

## Tests

### 1. Live Microphone PTT Capture

expected: Holding PTT records, shows preview outside chat history, finalizes, and submits one normal user turn.
result: issue
reported: "Failed: Start app and warning appeared \"Voice input readiness unavailable: sidecar request failed.\""
severity: blocker

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
issues: 1
pending: 5
skipped: 0
blocked: 0

## Gaps

- truth: "Holding PTT records, shows preview outside chat history, finalizes, and submits one normal user turn."
  status: failed
  reason: "User reported: Failed: Start app and warning appeared \"Voice input readiness unavailable: sidecar request failed.\""
  severity: blocker
  test: 1
  root_cause: "Electron `voiceInput:getReadiness` returns a `sidecar_unavailable` fallback summary when the sidecar admin request fetch throws. The renderer suppresses this fallback from `voice.error`, but `VoiceInputControl` still renders `voice.readiness.summary` for every non-ready state, so transient startup sidecar request failures still appear as a visible warning."
  artifacts:
    - path: "apps/electron-main/src/ipc.ts"
      issue: "`voiceInput:getReadiness` fetch-failure fallback summary is surfaced as readiness summary."
    - path: "apps/renderer/src/screens/Chat/VoiceInputControl.tsx"
      issue: "Blocked text falls back to `voice.readiness.summary` even for recoverable `sidecar_unavailable` startup states."
    - path: "apps/renderer/src/state/voice-input-store.ts"
      issue: "Store knows `sidecar_unavailable` is recoverable for `error`, but does not expose a user-safe display summary for Chat."
  missing:
    - "FIXED inline: `VoiceInputControl` now suppresses visible blocked text for recoverable `sidecar_unavailable` readiness while retaining disabled PTT until sidecar-ready/reconnect refreshes readiness."
    - "FIXED inline: Chat regression covers the exact `Voice input readiness unavailable: sidecar request failed.` startup text and verifies it is hidden while later sidecar-ready enables PTT."
    - "FIXED inline: `VoiceInputControl` now retries recoverable `sidecar_unavailable` readiness after startup even when no sidecar-ready event arrives."
    - "FIXED inline: Electron voice readiness fallbacks no longer emit the alarming `Voice input readiness unavailable: sidecar request failed.` text for recoverable sidecar-unavailable startup states."
  debug_session: "inline verify-work 2026-05-11"
