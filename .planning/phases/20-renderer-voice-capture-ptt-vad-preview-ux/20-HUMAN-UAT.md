---
status: testing
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
source: [20-VERIFICATION.md, 20-UAT.md]
started: 2026-05-11T05:50:00Z
updated: 2026-05-12T06:18:00Z
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
blocked_followup: "Automatic download not implemented. Phase 19 owns STT local model cache/download behavior; Phase 20 only made the model-cache UI truthful and requires real model files or a valid explicit local model path before live voice capture can proceed."

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

### 7. Live Model Removal Blocks Chat Readiness

expected: Removing or deleting the selected local STT model after a passing Settings test blocks Chat PTT before recording starts.
result: pending

### 8. Live Custom Cache Root Consistency

expected: STT model catalog, download, remove, readiness, and provider loading all refer to the same configured cache root.
result: pending

### 9. Live Multi-Chunk Preview Robustness

expected: Holding PTT long enough for multiple preview chunks does not prevent final transcript submission if preview is delayed or absent.
result: pending

## Summary

total: 9
passed: 0
issues: 1
pending: 8
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
    - "FIXED inline: recoverable `sidecar_unavailable` readiness now retries continuously instead of only once."
    - "FIXED inline: HTTP failures from `/admin/audio/voice-input/readiness` are now visible `unexpected_failure` readiness errors instead of being mislabeled as sidecar unavailable."
    - "FIXED inline: Voice settings now has an explicit `Enable voice input` switch, and saving an enabled default-visible provider persists `active_provider: funasr` instead of leaving voice disabled."
    - "FIXED inline: Settings STT test requests now use an enabled provider config so a passing test plus save can unblock Chat readiness."
    - "FIXED inline: The `Enable voice input` switch now persists immediately, hydrates from stored config, and refreshes Chat voice readiness after save."
    - "FIXED inline: App-store LLM config writes now preserve persisted audio/plugin/preset settings instead of rebuilding config with default audio."
  debug_session: "inline verify-work 2026-05-11"

- truth: "Phase 19 STT model/cache behavior and Phase 20 live voice capture readiness stay synchronized."
  status: fixed_automated
  reason: "Phase 20 plan 20-07 added cache-root-aware model operations, local model presence re-checks in voice readiness, Settings copy updates for real explicit download, and accumulated-chunk preview encoding."
  severity: blocker
  test: 7
  artifacts:
    - path: "sidecar/src/sidecar/admin/audio.py"
      issue: "Voice readiness now blocks with missing_model when active local readiness outlives model files."
    - path: "packages/contracts/py/contracts/audio_provider.py"
      issue: "STT model operation requests carry cache_root only, not full STT config or credentials."
    - path: "apps/renderer/src/audio/voice-capture.ts"
      issue: "Preview encoding now uses accumulated chunks and preview failures are non-fatal to final submission."
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "Model download/remove passes cache_root and refreshes Chat readiness."
  missing:
    - "LIVE PENDING: confirm model download/remove/cache root behavior in the packaged app."
    - "LIVE PENDING: confirm Chat PTT blocks after removing a previously tested local model."
    - "LIVE PENDING: confirm long PTT captures still produce final transcript if preview is delayed or absent."
