---
status: partial
phase: 03-tts-sentence-buffered-audio
source: [03-VERIFICATION.md]
started: 2026-05-07T08:24:52Z
updated: 2026-05-07T21:32:49Z
---

## Current Test

number: 1
name: Multi-Sentence Audible Playback
expected: |
  Three sentences are spoken in order, and sentence 1 begins playing while sentence 2 is still synthesizing.
awaiting: user response
status: fix implemented; awaiting re-test

## Tests

### 1. Multi-Sentence Audible Playback
expected: Three sentences are spoken in order, and sentence 1 begins playing while sentence 2 is still synthesizing.
result: issue
reported: "There is no sound at all. In settings the TTS is placeholder showing coming in milestone 3? Fully blocked now."
severity: blocker
diagnosis: |
  Three blockers were found. First, Settings still rendered "TTS / Voice out" from the generic placeholder list even though Phase 3 had implemented Piper TTS. Second, Electron spawned the sidecar before setup completion; if the app launched without stored LLM config, the sidecar stayed in the no-orchestrator/no-TTS mode after the user completed setup because config save did not restart it. Third, real Piper synthesis produced non-empty PCM, but playback passed raw bytes to sounddevice.OutputStream.write(), which raises a dtype mismatch instead of playing audio.
fix: |
  Config save now restarts the sidecar after persisting safeStorage config, so the restarted sidecar receives AGENTICLLMVTUBER_LLM_CONFIG_JSON and initializes orchestrator + TTS. Settings now has a real Phase 3 TTS section instead of the milestone placeholder. TTSTaskManager now converts PCM bytes to a NumPy int16 array before calling sounddevice, and tests assert that contract.

### 2. Warmup Latency Check
expected: After a fresh launch, first-audio onset on the first reply is materially similar to later replies because Piper warmup already ran before ready.
result: [pending]

### 3. Clean Audio Start and Live Mouth Motion
expected: The first sentence starts without click/pop, and the avatar mouth opens and closes in sync with speech instead of remaining stuck.
result: [pending]

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

- truth: "Three sentences are spoken in order, and sentence 1 begins playing while sentence 2 is still synthesizing."
  status: failed
  reason: "User reported: There is no sound at all. In settings the TTS is placeholder showing coming in milestone 3? Fully blocked now."
  severity: blocker
  test: 1
  root_cause: "Settings placeholder was never replaced for Phase 3, sidecar lifecycle did not restart after first-time LLM setup saved config, and real playback passed bytes to sounddevice instead of an int16 ndarray."
  artifacts:
    - "apps/electron-main/src/ipc.ts"
    - "apps/electron-main/src/sidecar.ts"
    - "apps/renderer/src/screens/Settings/Settings.tsx"
    - "apps/renderer/src/lib/copy.ts"
    - "apps/renderer/tests/Settings.test.tsx"
    - "sidecar/src/sidecar/tts/tts_manager.py"
    - "sidecar/tests/test_tts_manager.py"
    - ".planning/phases/03-tts-sentence-buffered-audio/03-DEBUG-sound-blocker.md"
  missing: []
  debug_session: ".planning/phases/03-tts-sentence-buffered-audio/03-DEBUG-sound-blocker.md"
