---
status: partial
phase: 16-audio-contracts-tts-provider-shell
source:
  - 16-01-SUMMARY.md
  - 16-02-SUMMARY.md
  - 16-03-SUMMARY.md
started: 2026-05-09T18:38:56-04:00
updated: 2026-05-09T18:38:56-04:00
---

## Current Test

Awaiting manual audio/VTS verification.

## Automated Evidence

- `npm run check:contracts` - passed.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx AppStoreStatus.test.tsx` - passed, 29 tests.
- `npm --workspace apps/renderer run typecheck` - passed.
- `npm --workspace apps/electron-main run build` - passed.
- `uv run --project sidecar python -m pytest sidecar\tests\test_tts_manager.py sidecar\tests\test_tts_gateway.py sidecar\tests\test_audio_payload_helpers.py sidecar\tests\test_sidecar_boot.py sidecar\tests\admin\test_audio_status_endpoint.py -q` - passed, 34 tests.

## Tests

### 1. Existing Piper chat response still speaks in order
expected: Multi-sentence chat output speaks through Piper in the same sentence order shown in the chat stream.
result: pending

### 2. VTS mouth/lipsync still moves from RMS during speech
expected: During spoken output, VTube Studio mouth motion follows the RMS envelope and does not freeze or desync.
result: pending

### 3. Settings TTS diagnostics show Piper/default model and truthful health
expected: Settings > TTS shows Piper, the active voice/model, and a health state such as `ok`; refresh does not expose provider switching controls.
result: pending

### 4. Existing setup survives restart after schemaVersion 2 migration
expected: Restarting with a previously completed v1 setup does not force LLM setup reconfiguration; provider, model, plugin selection, and cursor tracking are preserved.
result: pending

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None recorded yet. Manual UAT pending.
