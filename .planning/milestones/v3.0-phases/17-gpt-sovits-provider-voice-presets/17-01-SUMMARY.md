---
phase: 17-gpt-sovits-provider-voice-presets
plan: 17-01
subsystem: contracts
tags: [gpt-sovits, tts, voice-presets, pydantic, typescript, json-schema]
requires:
  - phase: 16-audio-contracts-tts-provider-shell
    provides: completed Phase 16 UAT and audio provider shell contracts
provides:
  - GPT-SoVITS provider/test-synthesis contracts
  - voice preset/reference-audio contracts
  - failed-audio metadata on audio payloads
  - generated TypeScript and JSON Schema mirrors
affects: [phase-17-provider, phase-17-settings-ui, phase-18-rich-voice-settings]
tech-stack:
  added: []
  patterns: [pydantic-source-of-truth, generated-contracts, activation-gate-contract]
key-files:
  created: [packages/contracts/py/contracts/voice_preset.py, packages/contracts/ts/voice-preset.ts, packages/contracts/generated/json-schema/voice-preset.schema.json]
  modified: [packages/contracts/py/contracts/audio_provider.py, packages/contracts/py/contracts/audio_payload.py, packages/contracts/py/contracts/__init__.py, packages/contracts/scripts/codegen.py, packages/contracts/tests/test_codegen.py, packages/contracts/ts/audio-provider.ts, packages/contracts/ts/audio-payload.ts, packages/contracts/ts/ws-message.ts, packages/contracts/ts/index.ts]
key-decisions:
  - "GPT-SoVITS activation is represented as explicit health-check and test-synthesis gates on provider config."
  - "Voice presets own tuning/reference fields only; provider connection and launch fields remain provider-level."
  - "Failed audio is represented in AudioPayloadMessage metadata while preserving sentence display text."
patterns-established:
  - "Add Pydantic source, register codegen target, regenerate TS/JSON Schema, export through ts/index.ts."
requirements-completed: [TTS-01, TTS-02, TTS-03, TTS-04, TTS-06, PRESET-01, PRESET-02, PRESET-03, PRESET-04]
duration: 17 min
completed: 2026-05-09
---

# Phase 17 Plan 17-01: Contracts and Blocking Phase-16 UAT Gate Summary

**GPT-SoVITS provider, voice preset, reference-audio, test-synthesis, and failed-audio contracts generated across Python, TypeScript, and JSON Schema.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-05-09T23:18:44Z
- **Completed:** 2026-05-09T23:35:22Z
- **Tasks:** 3 (including the Phase 16 UAT gate)
- **Files modified:** 15

## Accomplishments

- Confirmed the blocking Phase 16 precondition was satisfied by `16-UAT.md` frontmatter `status: complete` and ROADMAP Phase 16 completion evidence.
- Added Python contracts for GPT-SoVITS provider config, activation gates, health/test synthesis requests, test audio results, voice presets, reference assets, active associations, and preset libraries.
- Extended `AudioPayloadMessage` with failed-audio metadata so later provider failures can preserve sentence display text without silently switching providers.
- Registered and generated TypeScript/JSON Schema outputs, including `voice-preset.ts` and `voice-preset.schema.json`; `npm run check:contracts` passes.

## Task Commits

1. **Task 1 RED: Contract behavior tests** - `1caa913` (test)
2. **Task 1 GREEN: Python contract models** - `7ffdb4a` (feat)
3. **Task 2: Generated cross-language outputs** - `3e640a1` (feat)

**Plan metadata:** pending in final docs commit.

## Files Created/Modified

- `packages/contracts/py/contracts/voice_preset.py` - Source contracts for presets, reference-audio assets, active associations, and preset library.
- `packages/contracts/py/contracts/audio_provider.py` - GPT-SoVITS provider config, launch config, activation gate, health request, test synthesis request, and test result contracts.
- `packages/contracts/py/contracts/audio_payload.py` - Failed-audio metadata on audio payloads.
- `packages/contracts/scripts/codegen.py` - Voice preset target registration plus dedup/import handling for generated TS.
- `packages/contracts/tests/test_codegen.py` - Behavioral coverage for provider gates, invalid values, preset scope boundaries, reference-audio metadata, and failed-audio serialization.
- `packages/contracts/ts/*` and `packages/contracts/generated/json-schema/*` - Generated mirrors and barrel exports.

## Decisions Made

- Used provider-level `base_url`, launch fields, and activation gates for GPT-SoVITS rather than endpoint URLs or per-preset connection fields.
- Kept generated reference-audio storage as a sanitized relative `managed_path_token` plus `display_basename`.
- Kept failed GPT-SoVITS audio as metadata on `AudioPayloadMessage` with `audio: null`, preserving display-text and sentence ordering semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript codegen declaration matching for prefixed type names**
- **Found during:** Task 2 (Generate cross-language contract outputs)
- **Issue:** Generated `voice-preset.ts` initially omitted `VoicePreset`/`VoicePresetLibrary` because declaration matching treated `Voice` as a prefix of `VoicePreset*`.
- **Fix:** Tightened `declaration_pattern()` to match declaration names only when followed by whitespace, then regenerated outputs.
- **Files modified:** `packages/contracts/scripts/codegen.py`, generated TS/schema outputs
- **Verification:** `voice-preset.ts` exports `VoicePreset`, `ReferenceAudioAsset`, and `VoicePresetLibrary`; `npm run check:contracts` passed.
- **Committed in:** `3e640a1`

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Necessary to keep generated TypeScript exports correct; no scope expansion.

## Issues Encountered

- The system `python` environment lacks pytest, so contract tests were run with the project sidecar venv.

## User Setup Required

None - no external service configuration required for this contracts-only plan.

## Known Stubs

None. Empty strings/lists found in changed contract files are schema defaults or test fixtures, not UI-rendered placeholder data.

## Auth Gates

None.

## Next Phase Readiness

- Ready for `17-02`: persistence, reference-audio validation IPC, and preset CRUD can consume the generated preset/reference contracts.
- Later GPT-SoVITS sidecar and UI plans can use provider activation/test synthesis contracts without hand-written type drift.

## Self-Check: PASSED

- Found `packages/contracts/py/contracts/voice_preset.py`.
- Found `packages/contracts/ts/voice-preset.ts`.
- Found `packages/contracts/generated/json-schema/voice-preset.schema.json`.
- Found task commits `1caa913`, `7ffdb4a`, and `3e640a1` in git log.
- `npm run check:contracts` passed.
- `sidecar/.venv/Scripts/python.exe -m pytest packages/contracts/tests/test_codegen.py packages/contracts/tests/test_codegen_drift.py -q` passed (18 tests).

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-09*
