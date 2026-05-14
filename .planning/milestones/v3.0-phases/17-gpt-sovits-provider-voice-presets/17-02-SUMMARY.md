---
phase: 17-gpt-sovits-provider-voice-presets
plan: 17-02
subsystem: audio-persistence
tags: [gpt-sovits, voice-presets, reference-audio, electron-ipc, fastapi, soundfile]
requires:
  - phase: 17-01
    provides: generated GPT-SoVITS provider, voice preset, and reference-audio contracts
provides:
  - Electron StoredConfig preset/reference-audio defaults and delete guards
  - soundfile-backed sidecar reference-audio validation endpoint
  - typed Electron IPC/preload APIs for voice presets and reference-audio management
affects: [phase-17-provider, phase-17-settings-ui, phase-18-rich-voice-settings]
tech-stack:
  added: [soundfile==0.13.1, vitest-electron-main-test-script]
  patterns: [managed-reference-audio-storage, validation-before-save, preset-delete-guard, typed-preload-bridge]
key-files:
  created: [apps/electron-main/src/reference-audio.ts, apps/electron-main/tests/reference-audio.test.ts, apps/electron-main/tests/safe-storage.test.ts, sidecar/tests/admin/test_reference_audio_validation_endpoint.py]
  modified: [apps/electron-main/src/safe-storage.ts, apps/electron-main/src/ipc.ts, apps/electron-main/preload/index.ts, apps/electron-main/preload/index.d.ts, apps/electron-main/package.json, package-lock.json, sidecar/src/sidecar/admin/audio.py, sidecar/pyproject.toml, sidecar/uv.lock]
key-decisions:
  - "Reference audio is copied into app-managed userData storage and accepted only after sidecar soundfile validation succeeds."
  - "Preset and reference-audio deletion is blocked when active/in-use instead of falling back to Piper or cascade-deleting dependent presets."
  - "The local system python lacks pytest, so sidecar validation tests are run through uv's sidecar project environment."
patterns-established:
  - "Reference audio imports use generated asset ids plus sanitized basenames under userData/reference-audio."
  - "Renderer preset/reference-audio access goes through explicit IPC/preload allowlist methods."
requirements-completed: [TTS-01, TTS-02, TTS-06, PRESET-01, PRESET-02, PRESET-03, PRESET-04]
duration: 5 min
completed: 2026-05-09
---

# Phase 17 Plan 17-02: Preset Persistence and Reference-Audio Validation IPC Summary

**Safe-storage voice preset library and managed reference-audio validation IPC with soundfile metadata checks and referential delete guards.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-09T23:37:31Z
- **Completed:** 2026-05-09T23:42:30Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added StoredConfig defaults/migration for `voicePresets`, `referenceAudioAssets`, and `activePresetByAvatarSession` while preserving provider, plugin, audio, history, and avatar settings.
- Added delete guard helpers so active presets and in-use reference audio cannot be removed without reassignment.
- Implemented `POST /admin/audio/reference-audio/validate` using `soundfile.info()` with allowed extensions, readable metadata, 1-30 second duration bounds, and redacted diagnostics.
- Added Electron reference-audio helpers plus IPC/preload methods for preset CRUD, active avatar/session selection, reference-audio import/validation/delete.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: StoredConfig preset behavior tests** - `6c86153` (test)
2. **Task 1 GREEN: StoredConfig preset defaults/delete guards** - `b1048cd` (feat)
3. **Task 2 RED: sidecar reference-audio endpoint tests** - `cea5676` (test)
4. **Task 2 GREEN: soundfile validation endpoint** - `3218e96` (feat)
5. **Task 3 RED: reference-audio IPC/helper tests** - `1c4e342` (test)
6. **Task 3 GREEN: reference-audio IPC/preload APIs** - `37b4dbf` (feat)
7. **Lockfile sync: electron-main test dependency** - `6f4a1c5` (chore)

**Plan metadata:** `8349702` (docs), follow-up summary correction pending.

## Files Created/Modified

- `apps/electron-main/src/safe-storage.ts` - Adds preset/reference defaults, active association keying, and deletion guard helpers.
- `apps/electron-main/src/reference-audio.ts` - Manages sanitized userData reference-audio copies, sidecar validation proxying, and reference-audio deletion guards.
- `apps/electron-main/src/ipc.ts` - Registers voice preset and reference-audio IPC channels and unregisters them during cleanup.
- `apps/electron-main/preload/index.ts` - Exposes renderer-safe preset/reference-audio bridge methods.
- `apps/electron-main/preload/index.d.ts` - Adds typed bridge declarations including `validateReferenceAudio`.
- `apps/electron-main/tests/safe-storage.test.ts` - Covers migration/defaults and active preset association/delete guard behavior.
- `apps/electron-main/tests/reference-audio.test.ts` - Covers sanitized managed imports, validation proxying, delete guards, and preload exposure.
- `apps/electron-main/package.json` / `package-lock.json` - Adds the electron-main Vitest test script and dev dependency.
- `sidecar/src/sidecar/admin/audio.py` - Adds soundfile-backed reference-audio validation endpoint.
- `sidecar/tests/admin/test_reference_audio_validation_endpoint.py` - Covers missing, unsupported, unreadable, too-short, too-long, and valid reference audio.
- `sidecar/pyproject.toml` / `sidecar/uv.lock` - Adds `soundfile==0.13.1`.

## Decisions Made

- Kept active preset associations in app settings (`activePresetByAvatarSession`) rather than avatar catalog/import artifacts.
- Accepted only `.wav`, `.flac`, `.mp3`, and `.ogg` at the validation endpoint for this plan, matching the plan's stricter endpoint requirement even though generated contracts still include future `m4a` shape.
- Used `uv run --project sidecar` for sidecar pytest verification because the system `python` lacks pytest.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added electron-main Vitest script/dependency**
- **Found during:** Task 1 (StoredConfig voice preset library and delete guards)
- **Issue:** The plan's electron-main test command referenced a workspace `test` script that did not exist.
- **Fix:** Added `"test": "vitest run"` and a `vitest` dev dependency to `apps/electron-main/package.json`.
- **Files modified:** `apps/electron-main/package.json`
- **Verification:** `npm --workspace apps/electron-main run test -- --run reference-audio.test.ts safe-storage.test.ts` passed.
- **Committed in:** `6c86153`

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** Required to execute the planned tests; no feature scope expansion.

## Issues Encountered

- The bare `python -m pytest ...` command failed because the system Python environment has no pytest. The sidecar test was run with `uv run --project sidecar python -m pytest ...`, which installs/uses the project environment and passed.

## User Setup Required

None - no external service configuration required for this persistence/validation IPC plan.

## Known Stubs

None. Empty arrays/objects/nulls in changed files are typed defaults or validation/test data, not UI-rendered placeholders.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: local-file-import | `apps/electron-main/src/reference-audio.ts` | User-selected audio is copied into app-managed storage; mitigated by generated ids, sanitized basenames, allowed extensions, and validation-before-save. |
| threat_flag: sidecar-admin-endpoint | `sidecar/src/sidecar/admin/audio.py` | New localhost admin validation endpoint reads managed file metadata; mitigated by extension checks, metadata-only soundfile access, duration bounds, and redacted diagnostics. |

## Auth Gates

None.

## Verification

- `npm --workspace apps/electron-main run test -- --run reference-audio.test.ts safe-storage.test.ts` — passed (8 tests).
- `npm --workspace apps/electron-main run build` — passed.
- `uv run --project sidecar python -m pytest sidecar/tests/admin/test_reference_audio_validation_endpoint.py -q` — passed (5 tests).

## Next Phase Readiness

- Ready for `17-03`: GPT-SoVITS provider/test-synthesis work can consume managed reference-audio paths and validation responses.
- Ready for later settings UI: typed preload methods exist for preset CRUD, active avatar/session selection, reference-audio import/validation/delete.

## Self-Check: PASSED

- Found `apps/electron-main/src/reference-audio.ts`.
- Found `apps/electron-main/tests/reference-audio.test.ts`.
- Found `apps/electron-main/tests/safe-storage.test.ts`.
- Found `sidecar/tests/admin/test_reference_audio_validation_endpoint.py`.
- Found task commits `6c86153`, `b1048cd`, `cea5676`, `3218e96`, `1c4e342`, `37b4dbf`, and `6f4a1c5` in git log.
- Verification commands passed as listed above.

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-09*
