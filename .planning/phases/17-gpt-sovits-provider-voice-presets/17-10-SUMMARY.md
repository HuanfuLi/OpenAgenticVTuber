---
phase: 17-gpt-sovits-provider-voice-presets
plan: 10
subsystem: sidecar-tts
tags: [gpt-sovits, lipsync, sample-rate, tts, sidecar]

requires:
  - phase: 17-gpt-sovits-provider-voice-presets
    provides: GPT-SoVITS chat audio payloads and compositor RMS/lipsync path
provides:
  - Stream-rate-aligned GPT-SoVITS PCM write bytes
  - Stream-rate-aligned renderer WAV payloads and RMS envelopes
  - Regression coverage for mismatched-rate and matching-rate TTS payloads
  - UAT evidence that keeps live non-stream-rate GPT-SoVITS retest pending
affects: [phase-17-uat, sidecar-tts, gpt-sovits, lipsync]

tech-stack:
  added: []
  patterns:
    - Resample external-provider PCM before WAV/RMS/write payload creation when provider sample rate differs from output stream sample rate
    - Preserve byte-for-byte no-op behavior for matching sample rates

key-files:
  created:
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-10-SUMMARY.md
  modified:
    - sidecar/src/sidecar/tts/audio_payload_helpers.py
    - sidecar/src/sidecar/tts/tts_manager.py
    - sidecar/tests/test_audio_payload_helpers.py
    - sidecar/tests/test_tts_manager.py
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md

key-decisions:
  - "Normalize GPT-SoVITS returned PCM to the long-lived output stream sample rate instead of reopening the sounddevice stream per sentence."
  - "Keep matching-rate Piper/GPT-SoVITS behavior unchanged by making target sample rate optional and no-op when equal to source."
  - "Leave live UAT pending because automated sample-rate alignment does not prove the user's running GPT-SoVITS/VTube Studio mouth timing."

patterns-established:
  - "External TTS providers may return variable sample rates; sidecar playback, renderer WAV, and RMS envelopes must share one aligned PCM representation."

requirements-completed: [TTS-06]

duration: 12min
completed: 2026-05-10
---

# Phase 17 Plan 10: GPT-SoVITS Sample-Rate/Lipsync Summary

**GPT-SoVITS provider-backed audio is now normalized to the output stream sample rate before playback, WAV payload creation, and RMS/lipsync envelope generation.**

## Accomplishments

- Added optional `target_sample_rate` support to `prepare_payload_from_pcm` using deterministic mono int16 linear interpolation with empty and matching-rate fast paths.
- Updated `TTSTaskManager` to capture the output stream sample rate at construction and pass it as the target rate for provider-backed synthesis only.
- Added helper tests proving 32 kHz to 24 kHz and 48 kHz to 22.05 kHz resampling updates write bytes, WAV headers, and RMS inputs.
- Added manager coverage proving mismatched GPT-SoVITS provider output writes stream-rate samples and emits matching websocket/RMS envelope duration.
- Updated UAT evidence while keeping live GPT-SoVITS lipsync retest pending.

## Verification

- `uv run --project sidecar python -m pytest sidecar/tests/test_audio_payload_helpers.py sidecar/tests/test_tts_manager.py sidecar/tests/test_tts_gateway.py -q` - PASS, 31 tests.

## Deviations from Plan

- `sidecar/tests/test_tts_gateway.py` did not need code changes; existing gateway lifecycle coverage passed unchanged.

## Remaining Blockers

- Live UAT still needs a GPT-SoVITS server returning a non-stream-rate WAV, active preset chat playback, and user confirmation that audible speech and mouth/RMS motion end together.

## Next Step

- Execute Plan 17-11 for GPT/SoVITS weight selection plus independent synthesized Text language gating.
