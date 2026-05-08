---
status: complete
phase: 04-action-compositor-vts-bridge-body-sway-investigation
source:
  - 04-00-SUMMARY.md
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
  - 04-03-SUMMARY.md
  - 04-04-SUMMARY.md
  - 04-05-SUMMARY.md
  - 04-06-SUMMARY.md
  - 04-07-SUMMARY.md
started: 2026-05-08T06:03:09Z
updated: 2026-05-08T07:19:49Z
---

## Current Test

[testing complete]

## Tests

### 1. Live VTS Idle Motion
expected: Start the app with VTube Studio running and Teto loaded. When no one is talking, Teto continues visible idle micro-motion: head drift and blinks continue without flat stillness.
result: pass

### 2. TTS Mouth And Speech Motion
expected: Send a multi-sentence prompt. Teto speaks audibly, mouth movement tracks speech loudness, and head/body speech motion continues through the whole utterance with no flat moments.
result: pass

### 3. Joy Smooth Blend
expected: Send or force an LLM response containing `[joy]`. Teto's joy expression blends in smoothly over about 300ms and decays after the sentence ends, without a VTS hotkey pop.
result: pass

### 4. Cursor Tracking
expected: Move the cursor over the detected VTS/Teto window. Teto's eyes/head track the cursor, and when the cursor exits the window the gaze eases back to center without darting.
result: pass

### 5. Discrete Event Hotkey Demo
expected: Send the control command `fire-discrete-event:Star Eye [7]` while VTS+Teto is running. Teto visibly toggles the Star Eye hotkey/expression.
result: pass

### 6. Body-Sway Evidence Re-Run
expected: Confirm Phase 4 ships visible TTS body motion through the supported `head_only` strategy. Unsupported `proxy_param` and `exp3_modulation` must not be exposed as current Teto controls unless their required override fields are configured.
result: pass
note: "User clarified Phase 4 only needs head_only because Milestone 2 will expose a plugin-controlled motion system. proxy_param and exp3_modulation remain internal exploratory strategies, but current Teto has no proxy_body_param or exp3_body_pose configured."

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
