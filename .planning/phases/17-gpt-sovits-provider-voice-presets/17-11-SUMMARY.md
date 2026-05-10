---
phase: 17-gpt-sovits-provider-voice-presets
plan: 11
subsystem: gpt-sovits-presets
tags: [gpt-sovits, voice-presets, weights, text-language, health-gate]

requires:
  - phase: 17-gpt-sovits-provider-voice-presets
    provides: GPT-SoVITS provider, voice preset validation, and Settings activation gates
provides:
  - Per-preset GPT and SoVITS weight path contracts
  - Independent synthesized Text language control separate from Reference language
  - Candidate-preset health payloads instead of config-only dummy health
  - Provider set-weight calls before health and synthesis
  - Regression coverage for weight failures and OLVT-style `text_lang: zh` / `prompt_lang: ja`
affects: [phase-17-uat, gpt-sovits, voice-presets, renderer-settings, sidecar-admin]

tech-stack:
  added: []
  patterns:
    - Candidate health validates the exact preset being tested or activated
    - Synthesis-affecting preset fields are included in deterministic validation fingerprints
    - GPT-SoVITS external-server model state is made explicit via `/set_gpt_weights` and `/set_sovits_weights`

key-files:
  created:
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-11-SUMMARY.md
  modified:
    - packages/contracts/py/contracts/audio_provider.py
    - packages/contracts/py/contracts/voice_preset.py
    - packages/contracts/ts/audio-provider.ts
    - packages/contracts/ts/voice-preset.ts
    - packages/contracts/ts/gpt-sovits-validation.ts
    - packages/contracts/generated/json-schema/audio-provider.schema.json
    - packages/contracts/generated/json-schema/voice-preset.schema.json
    - sidecar/src/sidecar/tts/gpt_sovits_provider.py
    - sidecar/src/sidecar/admin/audio.py
    - sidecar/tests/tts/test_gpt_sovits_provider.py
    - sidecar/tests/admin/test_audio_test_tts_endpoint.py
    - apps/renderer/src/screens/Settings/Settings.tsx
    - apps/renderer/src/lib/copy.ts
    - apps/renderer/tests/Settings.test.tsx
    - apps/electron-main/tests/ipc-gpt-sovits-audio.test.ts
    - .planning/phases/17-gpt-sovits-provider-voice-presets/17-UAT.md

key-decisions:
  - "Require health checks to send the selected/test candidate preset so weight and language settings are validated before test synthesis or activation."
  - "Expose synthesized Text language separately from Reference language so OLVT parity can use Chinese synthesized text with Japanese reference audio."
  - "Apply configured GPT/SoVITS weights before `/docs` health and `/tts` synthesis, and cache the applied pair per provider instance to avoid redundant set calls."

patterns-established:
  - "GPT-SoVITS preset validation fingerprints include text language and model-weight paths, while still excluding display-only preset names."

requirements-completed: [TTS-01, TTS-02, TTS-03, TTS-04, PRESET-01, PRESET-02, PRESET-03, PRESET-04]

duration: 28min
completed: 2026-05-10
---

# Phase 17 Plan 11: GPT-SoVITS Weight and Text-Language Summary

**GPT-SoVITS presets now carry explicit model-weight paths and an independent synthesized Text language, and health/test/activation validate the exact candidate preset.**

## Accomplishments

- Added per-preset `gpt_weights_path` and `sovits_weights_path` fields to Python contracts and regenerated TypeScript/JSON Schema outputs.
- Updated the GPT-SoVITS validation fingerprint to include synthesized `text_lang` plus both weight paths.
- Removed config-only dummy health from the sidecar admin route; health now receives and passes the candidate `VoicePreset` into `GptSoVitsProvider`.
- Added GPT-SoVITS provider set-weight calls through `/set_gpt_weights` and `/set_sovits_weights` before health and synthesis, with explicit GPT-SoVITS failures on non-2xx, timeout, or transport errors.
- Added Settings controls for Text language, GPT model weight path, and SoVITS model weight path, including copy explaining that Text language may differ from Reference language.
- Added renderer tests proving `text_lang: zh` can coexist with `prompt_lang: ja`, health sends the selected preset plus weights, and language/weight edits invalidate validation.

## Verification

- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py -q` - PASS, 14 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - PASS, 57 tests.
- `npm --workspace apps/renderer run typecheck` - PASS.
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts` - PASS, 8 tests.
- `npm run check:contracts` - GENERATED expected TS/schema changes, then FAILED `git diff --exit-code` because the generated files are intentionally modified but not committed in this working tree.

## Deviations from Plan

- Electron IPC tests needed a small update because `GptSoVitsHealthRequest` now requires `preset`.
- No git commits were created in this session because commit permission was not explicitly requested.

## Remaining Blockers

- Commit or otherwise accept the generated contract changes, then rerun `npm run check:contracts` so its git-diff gate can pass.
- Live UAT still needs valid Teto/user GPT and SoVITS weights with Text language `zh` and Reference language `ja`, followed by invalid-weight-path checks that fail visibly as GPT-SoVITS without Piper fallback.

## Next Step

- Run live GPT-SoVITS UAT for the Plan 17-10 lipsync retest and Plan 17-11 OLVT parity/invalid-weight retests.
