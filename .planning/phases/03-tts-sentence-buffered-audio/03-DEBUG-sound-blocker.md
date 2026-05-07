---
status: fixed-awaiting-human-retest
phase: 03-tts-sentence-buffered-audio
issue: no-sound-and-tts-placeholder
created: 2026-05-07T10:13:59Z
---

## User Report

"There is no sound at all. In settings the TTS is placeholder showing coming in milestone 3? Fully blocked now."

## Diagnosis

Root cause 1: `Settings` still rendered TTS from `COPY.SETTINGS.PLACEHOLDERS`, so the UI explicitly told the user TTS was "Coming in milestone-3" after Phase 3 shipped.

Root cause 2: Electron spawned the sidecar at app startup. When no safeStorage config existed yet, the sidecar initialized with `orchestrator=None` and `tts_gateway=None`. Completing setup saved config, but `config:save` did not restart the already-running sidecar, so that launch stayed in inactive no-TTS mode.

## Fix

- `config:save` now restarts the sidecar after persisting config.
- The sidecar supervisor now has an intentional-shutdown path so restart does not look like a crash or trigger crash-loop respawn behavior.
- Settings now renders a real Phase 3 TTS section: Piper local TTS, `en_US-amy-medium`, system default output, and VTS mouth parameter lipsync.
- Added renderer regression coverage that fails if TTS returns to a milestone placeholder.

## Verification

- `cmd /c npm test -w apps/renderer -- --run tests/Settings.test.tsx tests/Chat.test.tsx`: 5 passed.
- `cmd /c npx tsc --noEmit -p apps/renderer/tsconfig.json`: passed.
- `cmd /c npx tsc --noEmit -p apps/electron-main/tsconfig.node.json`: passed.
- `cmd /c uv run pytest tests/test_tts_manager.py tests/test_speech_mouth_driver.py tests/test_orchestrator_turn.py -x -v`: 36 passed.

## Remaining Human Check

Re-run UAT Test 1 in the app after restarting or saving setup again. Expected: Settings no longer says TTS is coming later, and a multi-sentence reply produces audible Piper speech while later sentences synthesize.
