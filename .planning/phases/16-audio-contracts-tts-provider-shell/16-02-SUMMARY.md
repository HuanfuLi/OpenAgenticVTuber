---
phase: 16-audio-contracts-tts-provider-shell
plan: 16-02
subsystem: tts
tags: [piper, provider-shell, ordered-playback, rms, lipsync]
requires:
  - phase: 16-01
    provides: Audio config and provider health contracts
provides:
  - Provider-neutral TTS request/result/error layer
  - Piper adapter behind the provider shell
  - Provider-neutral audio payload and RMS assembly
affects: [tts-manager, sidecar-boot, phase-17]
tech-stack:
  added: []
  patterns:
    - TTS providers synthesize PCM only; TTSTaskManager owns ordering, envelopes, and stream writes
key-files:
  created:
    - sidecar/src/sidecar/tts/provider.py
    - sidecar/src/sidecar/tts/piper_provider.py
  modified:
    - sidecar/src/sidecar/tts/tts_gateway.py
    - sidecar/src/sidecar/tts/tts_manager.py
    - sidecar/src/sidecar/tts/audio_payload_helpers.py
    - sidecar/src/sidecar/ws/server.py
key-decisions:
  - "Providers do not own WebSocket sends, compositor speech envelopes, sequence ordering, or stream writes."
  - "Avatar voice overrides remain the default unless a non-default audio config voice is supplied."
patterns-established:
  - "Provider synthesis returns raw PCM and sample rate; payload/RMS assembly happens in sidecar-owned helpers."
requirements-completed: [AUDIO-02, AUDIO-04, TTS-05, PERF-03]
duration: same-session
completed: 2026-05-09
---

# Phase 16 Plan 02: TTS Provider Shell and Piper Adapter Summary

**Piper-backed provider shell preserving ordered playback, renderer audio envelopes, and RMS lipsync**

## Performance

- **Duration:** same session
- **Started:** 2026-05-09T18:20:00-04:00
- **Completed:** 2026-05-09T18:38:56-04:00
- **Tasks:** 4
- **Files modified:** 12

## Accomplishments

- Added provider-neutral `TTSSynthesisRequest`, `TTSSynthesisResult`, `TTSProvider`, and `TTSProviderError`.
- Moved Piper-specific load, LFS guard, warmup, and synthesis into `PiperTTSProvider`.
- Refactored `TTSTaskManager` to use provider output through `asyncio.to_thread()` while keeping the existing ordered queue algorithm.
- Split payload/RMS creation into `prepare_payload_from_pcm()` so future providers can reuse the existing audio envelope path.

## Task Commits

1. **Tasks 1-4:** `261aa98` (`feat(16): add audio provider shell`)

## Files Created/Modified

- `sidecar/src/sidecar/tts/provider.py` - Provider protocol/result/error definitions.
- `sidecar/src/sidecar/tts/piper_provider.py` - Piper adapter.
- `sidecar/src/sidecar/tts/tts_manager.py` - Provider-backed, ordered, non-blocking synthesis queue.
- `sidecar/src/sidecar/tts/audio_payload_helpers.py` - Provider-neutral PCM-to-envelope helper.

## Decisions Made

The provider seam is deliberately below `TTSTaskManager`: providers only synthesize audio. This keeps sequence buffering, WebSocket sends, compositor speech envelopes, and output stream writes in one place.

## Deviations from Plan

None - plan executed as scoped.

## Issues Encountered

Existing sidecar boot tests used fakes that did not expose the newer runtime status/provider health methods; the fakes were updated to match current boot contracts.

## User Setup Required

None.

## Next Phase Readiness

Plan 16-03 can expose provider health and failure semantics through admin/IPC/Settings without changing the synthesis boundary.

---
*Phase: 16-audio-contracts-tts-provider-shell*
*Completed: 2026-05-09*
