---
status: gaps_found
phase: 16-audio-contracts-tts-provider-shell
verified_at: 2026-05-09T18:38:56-04:00
source:
  - 16-01-PLAN.md
  - 16-02-PLAN.md
  - 16-03-PLAN.md
  - 16-UAT.md
---

# Phase 16 Verification

## Result

Automated verification passed. Human UAT is required before Phase 16 should be called officially done because live audio playback and VTube Studio lipsync need observation.

Updated after UAT: one blocker was found. VTS lipsync works, but no voice is audible.

## Must-Haves

- `AUDIO-02` - Passed automated checks. StoredConfig migrates v1 to v2 and new saves include default audio config.
- `AUDIO-03` - Passed automated checks. Provider health states are shared contracts and surfaced through `/admin/audio/status` and IPC.
- `AUDIO-04` - Passed automated checks. Piper remains the default provider and existing payload/queue behavior is covered.
- `TTS-05` - Passed automated checks. PCM flows through the same audio payload/RMS/stream path.
- `PERF-03` - Passed automated checks. Provider synthesis runs off the event loop and failures cannot wedge the TTS queue.

## Automated Checks

- `npm run check:contracts` - passed.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx AppStoreStatus.test.tsx` - passed.
- `npm --workspace apps/renderer run typecheck` - passed.
- `npm --workspace apps/electron-main run build` - passed.
- `uv run --project sidecar python -m pytest sidecar\tests\test_tts_manager.py sidecar\tests\test_tts_gateway.py sidecar\tests\test_audio_payload_helpers.py sidecar\tests\test_sidecar_boot.py sidecar\tests\admin\test_audio_status_endpoint.py -q` - passed.

## Human Verification Required

See `16-UAT.md`:

1. Existing Piper chat response still speaks in order.
2. VTS mouth/lipsync still moves from RMS during speech.
3. Settings TTS diagnostics show Piper/default model and truthful health.
4. Existing setup survives restart after schemaVersion 2 migration.

## Gaps Found

### Gap 1: No audible voice while lipsync works

- **Severity:** blocker
- **UAT:** `16-UAT.md` test 1
- **Diagnosis:** Renderer ignores `AudioPayloadMessage.audio`; audible output depends only on sidecar-local `sounddevice.OutputStream`. Since RMS/lipsync can be queued before sidecar stream write, VTS mouth movement can work even when local sidecar audio is inaudible.
- **Fix plan:** `16-04-PLAN.md`
