---
status: human_needed
phase: 16-audio-contracts-tts-provider-shell
verified_at: 2026-05-09T19:09:00-04:00
source:
  - 16-01-PLAN.md
  - 16-02-PLAN.md
  - 16-03-PLAN.md
  - 16-04-PLAN.md
  - 16-UAT.md
---

# Phase 16 Verification

## Result

Automated gap-closure verification passed. Human UAT is still required before Phase 16 should be called officially done because live audible playback and VTube Studio lipsync need observation.

Updated after UAT: the no-audible-voice blocker has a code fix and focused retest entry in `16-UAT.md`.

## Must-Haves

- `AUDIO-02` - Passed automated checks. StoredConfig migrates v1 to v2 and new saves include default audio config.
- `AUDIO-03` - Passed automated checks. Provider health states are shared contracts and surfaced through `/admin/audio/status` and IPC.
- `AUDIO-04` - Passed automated checks. Piper remains the default provider; renderer now plays non-empty audio payload WAVs while silent envelopes stay silent.
- `TTS-05` - Passed automated checks. PCM still produces the same audio payload/RMS stream path; renderer playback consumes the emitted WAV payload without changing VTS lipsync state.
- `PERF-03` - Passed automated checks. Provider synthesis runs off the event loop and failures cannot wedge the TTS queue.

## Automated Checks

- `npm run check:contracts` - passed.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx AppStoreStatus.test.tsx Chat.test.tsx ws-audio-player.test.ts ws-store-audio.test.ts` - passed, 47 tests.
- `npm --workspace apps/renderer run typecheck` - passed.
- `npm --workspace apps/electron-main run build` - passed.
- `uv run --project sidecar python -m pytest sidecar\tests\test_tts_manager.py sidecar\tests\test_tts_gateway.py sidecar\tests\test_audio_payload_helpers.py sidecar\tests\test_sidecar_boot.py sidecar\tests\admin\test_audio_status_endpoint.py -q` - passed.

## Human Verification Required

See `16-UAT.md` Gap Closure Retest:

1. Send a normal chat message and confirm voice is audible from the app.
2. Confirm VTS mouth/lipsync still moves during the same spoken response.
3. Confirm no duplicate or delayed speech is obvious during the response.

## Gap Closure

### Gap 1: No audible voice while lipsync works

- **Severity:** blocker
- **UAT:** `16-UAT.md` test 1
- **Diagnosis:** Renderer ignored `AudioPayloadMessage.audio`; audible output depended only on sidecar-local `sounddevice.OutputStream`.
- **Fix:** `16-04-PLAN.md` added renderer playback for non-empty WAV payloads and tests for silent envelopes.
- **Status:** implemented; pending focused human retest.
