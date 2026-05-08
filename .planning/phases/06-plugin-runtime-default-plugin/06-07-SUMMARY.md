# 06-07 Writer Consolidation Summary

Completed: 2026-05-08T18:09:47-04:00

## Closed

- F-1: Removed the split Phase 3 mouth writer path. `SpeechDriver.tick()` now always emits `MouthOpen`, and `ws/server.py` feeds speech only to the compositor queue.
- F-1: Deleted `sidecar/src/sidecar/vts/speech_mouth_driver.py`, `sidecar/src/sidecar/vts/parameter_writer.py`, and the old speech-mouth-driver test suite.
- F-2: Added `sidecar/tests/test_arch06_single_writer.py`, which asserts VTS write request APIs and the VTS auth `plugin_name` identity exist only in `sidecar/src/sidecar/vts/pyvts_writer.py`.

## Verification

- `cd sidecar; uv run pytest tests/vts/test_pyvts_writer.py tests/test_orchestrator_turn.py tests/compositor/test_speech_driver.py -q` -> 41 passed.
- `cd sidecar; uv run pytest tests/test_arch06_single_writer.py tests/avatar/test_extract_olvt.py tests/test_orchestrator_turn.py -q` -> 29 passed.
- `cd sidecar; uv run pytest tests/scripts/test_plumbing_harness.py tests/test_arch06_single_writer.py tests/vts/test_pyvts_writer.py tests/test_orchestrator_turn.py tests/compositor/test_speech_driver.py -q` -> 47 passed.
- `cd sidecar; uv run pytest` -> 235 passed, 2 skipped, 3 failed. Remaining failures are unrelated to 06-07 and are caused by missing `avatars/teto/teto_overrides.yaml`, which was already deleted before 06-07 execution began.

## Remaining Human UAT

F-3 is intentionally unchanged by this plan. With a live VTS session, verify lipsync is restored and then observe whether `head_only` produces visible multi-axis motion or still needs a separate runtime-quality investigation.
