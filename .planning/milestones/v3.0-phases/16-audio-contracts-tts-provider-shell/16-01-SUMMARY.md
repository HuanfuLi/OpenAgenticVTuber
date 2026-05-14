---
phase: 16-audio-contracts-tts-provider-shell
plan: 16-01
subsystem: contracts-config
tags: [audio-config, contracts, safe-storage, migration, sidecar-env]
requires: []
provides:
  - Audio provider/config/health contracts in Python, TypeScript, and JSON Schema
  - StoredConfig schemaVersion 1 to 2 migration with default audio config
  - One-shot sidecar audio config environment handoff
affects: [phase-17, phase-18, phase-19, settings, sidecar-boot]
tech-stack:
  added: []
  patterns:
    - Pydantic contract source of truth with generated TypeScript and JSON Schema
    - SafeStorage migration helper returning schemaVersion 2 in memory
key-files:
  created:
    - packages/contracts/py/contracts/audio_provider.py
    - packages/contracts/ts/audio-provider.ts
    - packages/contracts/ts/audio-provider-health.ts
    - packages/contracts/generated/json-schema/audio-provider.schema.json
    - packages/contracts/generated/json-schema/audio-provider-health.schema.json
    - sidecar/src/sidecar/audio/config.py
  modified:
    - apps/electron-main/src/safe-storage.ts
    - apps/electron-main/src/sidecar.ts
    - apps/renderer/src/state/setup-store.ts
    - sidecar/src/sidecar/ws/server.py
key-decisions:
  - "StoredConfig v2 adds an audio subtree while preserving v1 LLM provider, plugin, cursor tracking, and setup completion fields."
  - "Audio config is passed to Python as AGENTICLLMVTUBER_AUDIO_CONFIG_JSON; DPAPI/safeStorage remains Electron-only."
patterns-established:
  - "Audio provider health states use the shared contract vocabulary instead of ad hoc renderer strings."
  - "Renderer-created configs include the same explicit Piper default as Electron migration."
requirements-completed: [AUDIO-02, AUDIO-03, AUDIO-04, TTS-05, PERF-03]
duration: same-session
completed: 2026-05-09
---

# Phase 16 Plan 01: Audio Contracts and Config Migration Summary

**Versioned audio config and provider health contracts with schemaVersion 2 migration and sidecar env handoff**

## Performance

- **Duration:** same session
- **Started:** 2026-05-09T18:20:00-04:00
- **Completed:** 2026-05-09T18:38:56-04:00
- **Tasks:** 4
- **Files modified:** 17

## Accomplishments

- Added `AudioConfig` and `AudioProviderHealth` Pydantic contracts with generated TS and JSON Schema outputs.
- Migrated stored app config to schemaVersion 2 without invalidating existing setup.
- Passed the audio subtree to the sidecar through a launch-only environment variable and parsed it with a Piper default fallback.

## Task Commits

1. **Tasks 1-4:** `261aa98` (`feat(16): add audio provider shell`)

## Files Created/Modified

- `packages/contracts/py/contracts/audio_provider.py` - Audio config and typed health source of truth.
- `apps/electron-main/src/safe-storage.ts` - v1-to-v2 migration and default audio config.
- `apps/electron-main/src/sidecar.ts` - Audio env handoff.
- `sidecar/src/sidecar/audio/config.py` - Sidecar parser/default path for audio config.

## Decisions Made

Default audio config keeps Piper `en_US-amy-medium`, ordered playback, off-event-loop execution, and RMS lipsync explicitly encoded. Future GPT-SoVITS/STT objects stay inert until later provider phases.

## Deviations from Plan

None - plan executed as scoped. The generated contract drift check only passed after the implementation commit, because `npm run check:contracts` compares generated files against `HEAD`.

## Issues Encountered

The base Python interpreter did not have `pytest`; verification used the sidecar `uv` environment.

## User Setup Required

None.

## Next Phase Readiness

Plan 16-02 can consume the shared audio config and provider health contracts.

---
*Phase: 16-audio-contracts-tts-provider-shell*
*Completed: 2026-05-09*
