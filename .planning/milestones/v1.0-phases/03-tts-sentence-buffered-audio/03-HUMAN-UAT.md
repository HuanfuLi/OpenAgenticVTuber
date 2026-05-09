---
status: complete
phase: 03-tts-sentence-buffered-audio
source: [03-VERIFICATION.md]
started: 2026-05-07T08:24:52Z
updated: 2026-05-07T21:50:35Z
---

## Current Test

[testing complete]

## Tests

### 1. Multi-Sentence Audible Playback
expected: Three sentences are spoken in order, and sentence 1 begins playing while sentence 2 is still synthesizing.
result: pass
reported: "There is no sound at all. In settings the TTS is placeholder showing coming in milestone 3? Fully blocked now."
severity: blocker
diagnosis: |
  Three blockers were found. First, Settings still rendered "TTS / Voice out" from the generic placeholder list even though Phase 3 had implemented Piper TTS. Second, Electron spawned the sidecar before setup completion; if the app launched without stored LLM config, the sidecar stayed in the no-orchestrator/no-TTS mode after the user completed setup because config save did not restart it. Third, real Piper synthesis produced non-empty PCM, but playback passed raw bytes to sounddevice.OutputStream.write(), which raises a dtype mismatch instead of playing audio.
fix: |
  Config save now restarts the sidecar after persisting safeStorage config, so the restarted sidecar receives AGENTICLLMVTUBER_LLM_CONFIG_JSON and initializes orchestrator + TTS. Settings now has a real Phase 3 TTS section instead of the milestone placeholder. TTSTaskManager now converts PCM bytes to a NumPy int16 array before calling sounddevice, and tests assert that contract.

### 2. Warmup Latency Check
expected: After a fresh launch, first-audio onset on the first reply is materially similar to later replies because Piper warmup already ran before ready.
result: pass

### 3. Clean Audio Start and Live Mouth Motion
expected: The first sentence starts without click/pop, and the avatar mouth opens and closes in sync with speech instead of remaining stuck.
result: pass
reported: "Connected, but lip sync not working. I can see VTS received requests, but no mouth actions at all. VTS is just doing default idle actions."
severity: major
diagnosis: |
  VTS connection/auth worked and VTS received InjectParameterDataRequest messages, but the mouth driver injected the Live2D model parameter id ParamMouthOpenY. VTube Studio's InjectParameterDataRequest expects VTS input parameter ids; live InputParameterList probing showed MouthOpen is the correct injectable mouth parameter.
fix: |
  SpeechMouthDriver now injects MouthOpen. VTS maps that input parameter to the model mouth-open Live2D parameter, typically ParamMouthOpenY. Tests now assert MouthOpen request ids.

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Resolved:
- truth: "Three sentences are spoken in order, and sentence 1 begins playing while sentence 2 is still synthesizing."
  status: fixed
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

- truth: "The first sentence starts without click/pop, and the avatar mouth opens and closes in sync with speech instead of remaining stuck."
  status: fixed
  reason: "User reported: Connected, but lip sync not working. VTS received requests, but no mouth actions at all."
  severity: major
  test: 3
  root_cause: "Injected Live2D model parameter id ParamMouthOpenY instead of VTube Studio input parameter id MouthOpen."
  artifacts:
    - "sidecar/src/sidecar/vts/speech_mouth_driver.py"
    - "sidecar/src/sidecar/vts/parameter_writer.py"
    - "sidecar/tests/test_speech_mouth_driver.py"
  missing: []
  debug_session: ""
