---
status: complete
phase: 16-audio-contracts-tts-provider-shell
source:
  - 16-01-SUMMARY.md
  - 16-02-SUMMARY.md
  - 16-03-SUMMARY.md
  - 16-04-SUMMARY.md
started: 2026-05-09T18:38:56-04:00
updated: 2026-05-09T19:12:00-04:00
resolved: 2026-05-09T19:12:00-04:00
---

## Current Test

[testing complete]

## Automated Evidence

- `npm run check:contracts` - passed.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx AppStoreStatus.test.tsx` - passed, 29 tests.
- `npm --workspace apps/renderer run typecheck` - passed.
- `npm --workspace apps/electron-main run build` - passed.
- `uv run --project sidecar python -m pytest sidecar\tests\test_tts_manager.py sidecar\tests\test_tts_gateway.py sidecar\tests\test_audio_payload_helpers.py sidecar\tests\test_sidecar_boot.py sidecar\tests\admin\test_audio_status_endpoint.py -q` - passed, 34 tests.

## Tests

### 1. Existing Piper chat response still speaks in order
expected: Multi-sentence chat output speaks through Piper in the same sentence order shown in the chat stream.
result: issue
reported: "No voice at all, but lipsync is working."
severity: blocker

### 2. VTS mouth/lipsync still moves from RMS during speech
expected: During spoken output, VTube Studio mouth motion follows the RMS envelope and does not freeze or desync.
result: pass

### 3. Settings TTS diagnostics show Piper/default model and truthful health
expected: Settings > TTS shows Piper, the active voice/model, and a health state such as `ok`; refresh does not expose provider switching controls.
result: pass

### 4. Existing setup survives restart after schemaVersion 2 migration
expected: Restarting with a previously completed v1 setup does not force LLM setup reconfiguration; provider, model, plugin selection, and cursor tracking are preserved.
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Multi-sentence chat output speaks through Piper in the same sentence order shown in the chat stream."
  status: resolved
  reason: "User reported: No voice at all, but lipsync is working."
  severity: blocker
  test: 1
  root_cause: "Phase 16 preserved sidecar-local sounddevice playback as the only audible output path. Renderer audio payloads contain WAV data and RMS/lipsync works, but renderer dispatch currently ignores msg.audio and never plays the WAV. If the sidecar output stream writes to a muted/wrong/unavailable default device, the user sees lipsync with no audible voice and no renderer fallback."
  artifacts:
    - path: "apps/renderer/src/ws/store.ts"
      issue: "Audio payload handler appends assistant text and sets speaking state but ignores msg.audio."
    - path: "sidecar/src/sidecar/tts/tts_manager.py"
      issue: "Speech envelope is queued before sidecar stream.write; VTS lipsync can work even when sidecar local playback is inaudible."
    - path: "sidecar/src/sidecar/tts/PROVENANCE.md"
      issue: "Existing architecture states renderer does not play Web Audio, making sidecar device playback a single point of audible-output failure."
  missing:
    - "Resolved by 16-04: renderer-side WAV playback path added for non-empty AudioPayloadMessage.audio."
    - "Resolved by 16-04: VTS RMS/lipsync behavior preserved; silent/action-only envelopes do not invoke playback."
    - "Resolved by 16-04: tests cover WAV playback, silent envelopes, chat text merge, speaking state, and playback failure cleanup."
  debug_session: ".planning/debug/phase-16-no-audible-voice.md"
  resolved_by: "16-04-SUMMARY.md / focused live retest pass on 2026-05-09"

## Gap Closure Retest

### 1. Audible renderer playback while preserving VTS lipsync
expected: Sending a normal chat message produces audible renderer playback from `AudioPayloadMessage.audio` while VTS lipsync continues from the existing RMS envelope.
automated_evidence:
  - `npm --workspace apps/renderer run test -- --run Chat.test.tsx ws-audio-player.test.ts ws-store-audio.test.ts` - passed, 18 tests.
  - `npm --workspace apps/renderer run typecheck` - passed.
result: pass
notes:
  - Renderer now plays non-empty base64 WAV audio payloads.
  - Silent/action-only envelopes with `audio: null` do not invoke playback.
  - Chat text merge and speaking-state updates remain covered by regression tests.
  - Human live retest passed on 2026-05-09.

## Recheck Summary

total: 1
passed: 1
issues: 0
pending: 0
