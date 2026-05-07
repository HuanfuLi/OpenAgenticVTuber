---
status: fixed-awaiting-human-retest
phase: 03-tts-sentence-buffered-audio
issue: no-sound-and-tts-placeholder
created: 2026-05-07T10:13:59Z
updated: 2026-05-07T21:32:49Z
---

## User Report

"There is no sound at all. In settings the TTS is placeholder showing coming in milestone 3? Fully blocked now."

## Diagnosis

Root cause 1: `Settings` still rendered TTS from `COPY.SETTINGS.PLACEHOLDERS`, so the UI explicitly told the user TTS was "Coming in milestone-3" after Phase 3 shipped.

Root cause 2: Electron spawned the sidecar at app startup. When no safeStorage config existed yet, the sidecar initialized with `orchestrator=None` and `tts_gateway=None`. Completing setup saved config, but `config:save` did not restart the already-running sidecar, so that launch stayed in inactive no-TTS mode.

Root cause 3: The sound model and synthesis path were implemented, but the real playback call passed raw `bytes` into `sounddevice.OutputStream.write()`. `sounddevice` expects an `int16` array, so live playback raised `TypeError: dtype mismatch` before writing audio. Earlier tests missed this because fake streams accepted bytes.

## Fix

- `config:save` now restarts the sidecar after persisting config.
- The sidecar supervisor now has an intentional-shutdown path so restart does not look like a crash or trigger crash-loop respawn behavior.
- Settings now renders a real Phase 3 TTS section: Piper local TTS, `en_US-amy-medium`, system default output, and VTS mouth parameter lipsync.
- Added renderer regression coverage that fails if TTS returns to a milestone placeholder.
- `TTSTaskManager` now converts Piper PCM bytes to a NumPy `int16` array before calling `OutputStream.write()`.
- `test_tts_manager.py` now asserts the fake stream receives an `int16` ndarray, so the real API contract is covered.

## Verification

- `cmd /c npm test -w apps/renderer -- --run tests/Settings.test.tsx tests/Chat.test.tsx`: 5 passed.
- `cmd /c npx tsc --noEmit -p apps/renderer/tsconfig.json`: passed.
- `cmd /c npx tsc --noEmit -p apps/electron-main/tsconfig.node.json`: passed.
- `cmd /c uv run pytest tests/test_tts_manager.py tests/test_speech_mouth_driver.py tests/test_orchestrator_turn.py -x -v`: 36 passed.
- `cmd /c uv run pytest tests/test_tts_manager.py tests/test_tts_gateway.py tests/test_audio_payload_helpers.py tests/test_orchestrator_turn.py tests/test_speech_mouth_driver.py -x -v`: 49 passed.
- Real Piper playback probe generated non-empty audio (`pcm_bytes=130560`, `samples=65280`, `volumes=148`) and wrote to the default `sounddevice` output with `xrun=False`.

## Remaining Human Check

Re-run UAT Test 1 in the app after restarting or saving setup again. Expected: Settings no longer says TTS is coming later, and a multi-sentence reply produces audible Piper speech while later sentences synthesize.
