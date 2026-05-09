---
phase: 03-tts-sentence-buffered-audio
plan: 03
subsystem: sidecar-vts-mouth-driver
tags: [gap-closure, tts-04, speech-envelope, parammouthopeny, pyvts]

# Dependency graph
requires:
  - phase: 03-tts-sentence-buffered-audio
    plan: 02
    provides: TTSTaskManager publishes SpeechEnvelopePayload to compositor_speech_queue at audio write start
provides:
  - SpeechMouthDriver queue consumer that interpolates SpeechEnvelopePayload.volumes and writes ParamMouthOpenY
  - ParameterWriter protocol with PyVTSParameterWriter and LoggingParameterWriter implementations
  - server.py lifespan wiring that replaces the Phase 3 no-op speech-envelope logger drain
affects: [04-compositor, 05-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - narrow writer seam around vendored pyvts requestSetParameterValue
    - degraded LoggingParameterWriter fallback when VTS auth fails or ParamMouthOpenY is absent
    - mouth-driver interpolation on the same stream time base used by TTSTaskManager

key-files:
  created:
    - sidecar/src/sidecar/vts/__init__.py
    - sidecar/src/sidecar/vts/parameter_writer.py
    - sidecar/src/sidecar/vts/speech_mouth_driver.py
    - sidecar/tests/test_speech_mouth_driver.py
    - .planning/phases/03-tts-sentence-buffered-audio/03-03-SUMMARY.md
  modified:
    - sidecar/src/sidecar/ws/server.py
    - sidecar/tests/test_orchestrator_turn.py
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "TTS-04 gap closure uses a narrow ParamMouthOpenY writer seam only; Phase 4 still owns full compositor/body-sway/expression/cursor scope."
  - "Server startup degrades to LoggingParameterWriter when VTS is unavailable, preserving READY/startup resilience while keeping real RMS values flowing through the same driver."
  - "Mouth timing uses stream.time + stream.latency to stay on the same playback clock contract as TTSTaskManager."

patterns-established:
  - "SpeechMouthDriver.consume_forever(queue) is the runtime consumer for SpeechEnvelopePayload."
  - "PyVTSParameterWriter writes InjectParameterDataRequest via requestSetParameterValue(..., mode='set')."
  - "LoggingParameterWriter is a degraded runtime fallback, not a replacement for the ParamMouthOpenY production path."

requirements-completed: [TTS-04]

# Metrics
duration: 35min
completed: 2026-05-07
---

# Phase 03 Plan 03: TTS-04 Lipsync Gap Closure Summary

**SpeechEnvelopePayload now drives ParamMouthOpenY through a minimal mouth-driver runtime seam with vendored-pyvts production writes and fake-writer test coverage.**

## Performance

- **Duration:** ~35 min including stale executor recovery
- **Started:** 2026-05-07T06:35:05Z
- **Completed:** 2026-05-07T06:58:00Z
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 4

## Accomplishments

- Added `SpeechMouthDriver`, which consumes `SpeechEnvelopePayload`, interpolates real RMS `volumes[]` over playback time, writes `ParamMouthOpenY`, and closes the mouth with a final `0.0`.
- Added `ParameterWriter` protocol plus `PyVTSParameterWriter` and `LoggingParameterWriter`.
- Wired `server.py` lifespan to start the mouth driver against `compositor_speech_queue`, replacing `_drain_speech_queue_until_phase4`.
- Added degraded fallback when `ParamMouthOpenY` is missing or VTS connect/auth fails.
- Added automated tests proving envelope-to-mouth writes, interpolation, close-mouth reset, pyvts request shape, no-op-drainer removal, playback clock calculation, and fallback branches.

## Task Commits

Each task was committed atomically with `--no-verify`:

1. **Task 1: mouth-driver seam + tests** - `876ee64` (`feat`)
2. **Task 2: server wiring + fallback tests** - `8431c7f` (`feat`)

## Files Created/Modified

- `sidecar/src/sidecar/vts/parameter_writer.py` - parameter writer seam with vendored pyvts and logging fallback implementations.
- `sidecar/src/sidecar/vts/speech_mouth_driver.py` - queue consumer that maps real speech envelope values to mouth parameter writes.
- `sidecar/src/sidecar/vts/__init__.py` - exports the VTS mouth-driver seam.
- `sidecar/src/sidecar/ws/server.py` - starts `SpeechMouthDriver.consume_forever(...)` and removes the no-op speech-envelope drain.
- `sidecar/tests/test_speech_mouth_driver.py` - fake-writer and pyvts request-shape tests.
- `sidecar/tests/test_orchestrator_turn.py` - server wiring and fallback branch tests.

## Decisions Made

- Kept the gap closure deliberately narrow: no idle/rest-state writer, no expression/body-sway/cursor driver, no generic compositor frame loop, and no AVT-03 additive blending.
- Used `mode="set"` for `ParamMouthOpenY` writes because additive/multi-driver composition belongs to Phase 4.
- Kept degraded startup behavior by falling back to `LoggingParameterWriter`; this avoids blocking sidecar READY when VTube Studio is closed during non-avatar development.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Executor stalled after creating only the TDD test file**

- **Found during:** Wave 3 execution fallback checks.
- **Issue:** The spawned executor did not return, created no commits or summary, and only left `sidecar/tests/test_speech_mouth_driver.py`.
- **Fix:** Closed the stale executor, preserved the useful test file, and completed the implementation inline.
- **Verification:** `uv run pytest tests/test_speech_mouth_driver.py tests/test_orchestrator_turn.py -x -v` -> `30 passed`.

**Total deviations:** 1 auto-fixed execution blockage.
**Impact on plan:** No scope change; implementation stayed inside the 03-03 write set.

## Issues Encountered

- Sandboxed Git still could not reliably write the index, so task commits used approved escalation.
- The production VTS path is wired but not live-smoked against a running VTube Studio instance in this environment.

## Verification

- `uv run pytest tests/test_speech_mouth_driver.py tests/test_orchestrator_turn.py -x -v` -> `30 passed`.
- `rg -n "class SpeechMouthDriver|drive_envelope|consume_forever" sidecar/src/sidecar/vts/speech_mouth_driver.py` returns matches.
- `rg -n "requestSetParameterValue|InjectParameterDataRequest|ParamMouthOpenY" sidecar/src/sidecar/vts/parameter_writer.py` returns matches through the pyvts request call.
- `rg -n "SpeechMouthDriver|PyVTSParameterWriter|LoggingParameterWriter|_playback_now|consume_forever" sidecar/src/sidecar/ws/server.py` returns matches.

## Next Phase Readiness

Phase 4 can now build the broader compositor around an existing narrow mouth-driver seam rather than inventing the TTS-to-mouth data path. The gap that blocked TTS-04 is closed in runtime code: `SpeechEnvelopePayload` no longer terminates in a logger-only consumer.

## Self-Check: PASSED

Created files exist, task commits are present, targeted tests pass, and no `## Self-Check: FAILED` marker is present.

---
*Phase: 03-tts-sentence-buffered-audio*
*Completed: 2026-05-07*
