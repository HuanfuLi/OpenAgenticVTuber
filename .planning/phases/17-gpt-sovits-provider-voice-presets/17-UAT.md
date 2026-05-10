---
status: testing
phase: 17-gpt-sovits-provider-voice-presets
source:
  - 17-01-SUMMARY.md
  - 17-02-SUMMARY.md
  - 17-03-SUMMARY.md
  - 17-04-SUMMARY.md
  - 17-05-SUMMARY.md
  - 17-06-SUMMARY.md
  - 17-07-SUMMARY.md
started: 2026-05-10T00:00:00Z
updated: 2026-05-10T04:20:00Z
---

# Phase 17 UAT - GPT-SoVITS Provider + Voice Presets

## Current Test

number: 3
name: Reference Audio Import And Validation
expected: |
  Importing reference audio copies it into app-managed storage, requires transcript text and language, displays validation details such as format and duration, and does not show the original absolute file path.
awaiting: user retest after activation runtime-status polling fix

## Tests

### 1. Provider Selection And Health Gate
expected: In Settings -> TTS, Piper is available as a selectable local provider. Selecting GPT-SoVITS shows a single Base URL field, lets you run a health check, and does not activate GPT-SoVITS until a voice preset and audible test synthesis also pass.
result: pass
reported: "After fixes, health check and test synthesis passed; activation produced GPT-SoVITS runtime and chat used GPT-SoVITS voice instead of Piper. User confirmed: 'pass. Running GPT-Sovits voice'."
severity: none

### 2. App-Managed Launch Controls
expected: In app-launched GPT-SoVITS mode, Settings shows command, working directory, optional health URL, Start, Stop, and Restart controls. Stop/Restart only apply to the process AgenticLLMVTuber started; external server mode says to stop it outside the app.
result: pass
reported: "User confirmed pass."
severity: none

### 3. Reference Audio Import And Validation
expected: Importing reference audio copies it into app-managed storage, requires transcript text and language, displays validation details such as format and duration, and does not show the original absolute file path.
result: issue
reported: "User reported: Import is not blocked when transcript/language are missing, saving a different preset name/config overwrites the first saved preset instead of creating a new preset, the first fixes still had the wrong user flow, incomplete config actions still showed no visible message, active preset deletion opened a dead-end cancel-only popover, duplicate preset names were allowed, and activation could show a Piper runtime mismatch even while GPT-SoVITS was actually working. Activation runtime-status polling fix now applied; awaiting user retest."
severity: blocker

### 4. Voice Preset Management
expected: You can create, rename, select, and delete named voice presets with GPT-SoVITS tuning/reference fields. Deleting the active preset or in-use reference audio is blocked until reassignment rather than silently switching to Piper or cascade-deleting data.
result: [pending]

### 5. Audible Test Synthesis
expected: With a healthy GPT-SoVITS server and a preset that has reference audio, clicking Test synthesis plays or previews generated audio without sending a chat message or adding anything to conversation history. Activation becomes available only after this test succeeds.
result: [pending]

### 6. Active GPT-SoVITS Chat Turn
expected: After activating a GPT-SoVITS voice preset, the next chat turn still shows sentence text normally and plays audio through the existing renderer audio/RMS/lipsync path.
result: [pending]

### 7. Failed GPT-SoVITS Turn And Explicit Piper Fallback
expected: If GPT-SoVITS fails during a chat turn, the affected sentence text remains visible, the UI marks audio failed for that sentence, logs hold technical detail, and the app does not switch to Piper until you explicitly select Piper for a later turn.
result: [pending]

## Summary

total: 7
passed: 2
issues: 1
pending: 4
skipped: 0
blocked: 0

## Automated Regression Evidence

| Check | Result | Evidence |
|---|---:|---|
| Contracts drift | PASS | `npm run check:contracts` completed during Phase 17 execution/fix verification. |
| Renderer Settings + Chat failure tests | PASS | `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` passed after review fixes. |
| Renderer typecheck | PASS | `npm --workspace apps/renderer run typecheck` passed after review fixes. |
| Electron main build/tests | PASS | Electron main focused tests and build passed after review fixes. |
| Sidecar focused tests | PASS | `uv run --project sidecar python -m pytest ...` passed after review fixes. |
| Code review | PASS | `17-REVIEW.md` status is clean after fixes. |
| Goal verification | PASS | `17-VERIFICATION.md` passed 5/5 roadmap success criteria. |

## Previous Live Server Availability

Earlier automation attempted to probe `http://127.0.0.1:9880/docs` and could not connect, so live GPT-SoVITS server UAT was environment-blocked at execution time. This conversational UAT session resumes those user-facing checks.

## Gaps

- truth: "In Settings -> TTS, Piper is available as a selectable local provider. Selecting GPT-SoVITS shows a single Base URL field, lets you run a health check, and does not activate GPT-SoVITS until a voice preset and audible test synthesis also pass."
  status: resolved
  reason: "User confirmed retest passed: test synthesis and activation succeeded, runtime/chat used GPT-SoVITS voice instead of Piper."
  severity: none
  test: 1
  root_cause: "Startup sub-issue resolved: local npm workspace install was stale/incomplete. Health/test gate sub-issue fixed in commit 8504e17. Preset save feedback/persistence and stale activation chat startup sub-issues fixed in commit 417fbea. Latest activation issue root cause: activation could save the final config from stale renderer state, overwriting the preset/reference data that made test synthesis pass; Electron also was not passing active conversation session id to the sidecar for exact avatar/session preset resolution."
  artifacts:
    - path: "node_modules/.bin/electron-vite"
      issue: "Missing executable shim required by `npm run dev`."
    - path: "apps/electron-main/package.json"
      issue: "Dev script depends on `electron-vite dev`; package declares `electron-vite` but local install has not linked it into the workspace command PATH."
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "Fixed selected reference asset not being considered for Test synthesis/activation readiness."
    - path: "sidecar/src/sidecar/admin/audio.py"
      issue: "Health route delegates to provider health; provider readiness semantics were too permissive."
    - path: "sidecar/src/sidecar/tts/gpt_sovits_provider.py"
      issue: "Fixed health check to require a 2xx `/docs` response instead of accepting 4xx as reachable."
    - path: "apps/renderer/tests/Settings.test.tsx"
      issue: "Added regression coverage for enabling Test synthesis after health when a selected reference asset populates the preset."
    - path: "sidecar/tests/tts/test_gpt_sovits_provider.py"
      issue: "Added regression coverage that non-2xx docs response is not healthy."
    - path: "apps/electron-main/src/ipc.ts"
      issue: "Investigating whether voice preset save/list writes and reloads persisted config correctly."
    - path: "sidecar/src/sidecar/ws/server.py"
      issue: "Fixed sidecar startup to use Piper gateway and visible misconfigured GPT-SoVITS health when active GPT-SoVITS lacks preset/reference handoff."
    - path: "sidecar/src/sidecar/tts/tts_gateway.py"
      issue: "Startup currently raises if active GPT-SoVITS lacks preset/reference, breaking chat instead of preserving Piper availability."
    - path: "apps/renderer/src/lib/copy.ts"
      issue: "Added voice preset save success/failure copy."
    - path: "sidecar/tests/test_sidecar_boot.py"
      issue: "Added regression coverage for incomplete active GPT-SoVITS config using Piper gateway config."
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "Fixed activation to fetch latest stored config, persist the activated preset with selected reference audio, refresh runtime audio status, and show a clear activation/runtime provider status card."
    - path: "apps/electron-main/src/sidecar.ts"
      issue: "Fixed sidecar env handoff to include the active conversation session id for exact active preset resolution."
    - path: "sidecar/src/sidecar/tts/tts_gateway.py"
      issue: "Investigating whether sidecar selects GPT-SoVITS provider or falls back to Piper after activation."
    - path: "apps/renderer/tests/Settings.test.tsx"
      issue: "Added regression coverage that activation persists selected reference audio into the active preset before sidecar restart."
    - path: "sidecar/tests/test_sidecar_boot.py"
      issue: "Added regression coverage that complete GPT-SoVITS preset/reference handoff keeps the GPT-SoVITS gateway config."
  missing:
    - "None for Test 1."
  debug_session: ""

- truth: "Importing reference audio copies it into app-managed storage, requires transcript text and language, displays validation details such as format and duration, and does not show the original absolute file path."
  status: failed
  reason: "User reported reference import was not clearly blocked without transcript/language and preset save overwrote the selected preset when trying to create a different named/configured preset."
  severity: blocker
  test: 3
  root_cause: "Reference import relied on disabled-button state and silently returned in the handler without visible validation feedback. Voice preset editing had no explicit create/update split, so Save always derived from the selected preset id and overwrote it. The first redesign treated New preset as a draft-clearing action, but the desired UX is direct-entry: enter config, import/select reference audio, then click New preset to persist a new record. Reference import also auto-saved into the selected preset, which could mutate the existing preset before a new record was created. The validation dialog overlay was absolute-positioned inside the Settings scroll layout instead of fixed to the viewport, making it easy to miss. Active preset deletion correctly required reassignment but presented only a cancel button instead of the reassignment action it requested. Preset identity was enforced only by preset_id, so duplicate display names were not validated at create or rename time."
  artifacts:
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "Redesigned preset persistence so New preset saves the current form as a new preset id, Save preset updates only the selected preset, and reference import selects an app-managed asset without implicitly saving into the selected preset. Missing required fields open a focused alertdialog and skip persistence; editing transcript/language clears stale selected reference audio; active preset deletion now lets the user choose another preset, set it active, then delete the original; create/rename rejects duplicate trimmed case-insensitive preset names."
    - path: "apps/renderer/src/index.css"
      issue: "Changed dialog overlay positioning to fixed so validation/delete dialogs appear over the current viewport instead of being lost in the Settings scroll layout."
    - path: "apps/renderer/src/lib/copy.ts"
      issue: "Updated copy to describe direct-entry New preset behavior, distinguish new-preset creation success from existing-preset save success, and explain duplicate preset-name rejection."
    - path: "apps/renderer/tests/Settings.test.tsx"
      issue: "Updated regression coverage so users type config first, import/select reference audio, then click New preset to create a separate record; reference import no longer calls saveVoicePreset by itself; Save preset remains the existing-preset update action; missing import fields show an alertdialog; active preset deletion can reassign and delete; duplicate create/rename names are rejected."
  missing:
    - "User retest confirmation that invalid reference import is blocked with visible feedback and New preset creates a second preset."
  debug_session: ""

## Gap Fix Evidence

- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed, 42 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed, 47 tests.
- `npm --workspace apps/renderer run typecheck` - passed.
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py -q` - passed, 5 tests.
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py sidecar/tests/test_sidecar_boot.py -q` - passed, 42 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after preset persistence/boot robustness fix, 43 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after preset persistence/boot robustness fix, 48 tests.
- `npm --workspace apps/renderer run typecheck` - passed after preset persistence/boot robustness fix.
- `uv run --project sidecar python -m pytest sidecar/tests/test_sidecar_boot.py -q` - passed, 9 tests.
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py sidecar/tests/test_sidecar_boot.py -q` - passed after preset persistence/boot robustness fix, 43 tests.
- `npm --workspace apps/electron-main run test -- --run reference-audio.test.ts ipc-gpt-sovits-audio.test.ts safe-storage.test.ts` - passed, 15 tests.
- `npm --workspace apps/electron-main run build` - passed.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after activation persistence/runtime feedback fix, 49 tests.
- `npm --workspace apps/electron-main run test -- --run ipc-gpt-sovits-audio.test.ts safe-storage.test.ts` - passed after activation persistence/runtime feedback fix, 11 tests.
- `uv run --project sidecar python -m pytest sidecar/tests/test_sidecar_boot.py sidecar/tests/test_tts_gateway.py -q` - passed after active-session handoff coverage, 16 tests.
- `npm --workspace apps/renderer run typecheck` - passed after activation persistence/runtime feedback fix.
- `npm --workspace apps/electron-main run build` - passed after active-session handoff fix.
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py sidecar/tests/test_sidecar_boot.py -q` - passed after activation persistence/runtime feedback fix, 44 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after Test 3 import/new-preset fix, 45 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after Test 3 import/new-preset fix, 50 tests.
- `npm --workspace apps/renderer run typecheck` - passed after Test 3 import/new-preset fix.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after audited Test 3 hydration/UX fix, 46 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after audited Test 3 hydration/UX fix, 51 tests.
- `npm --workspace apps/renderer run typecheck` - passed after audited Test 3 hydration/UX fix.
- `npm --workspace apps/electron-main run test -- --run reference-audio.test.ts ipc-gpt-sovits-audio.test.ts safe-storage.test.ts` - passed after audited Test 3 hydration/UX fix, 15 tests.
- `npm --workspace apps/electron-main run build` - passed after audited Test 3 hydration/UX fix.
- `uv run --project sidecar python -m pytest sidecar/tests/test_sidecar_boot.py -q` - passed after audited Test 3 hydration/UX fix, 10 tests.
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/admin/test_reference_audio_validation_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py sidecar/tests/test_sidecar_boot.py -q` - passed after audited Test 3 hydration/UX fix, 44 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after Save-preset missing-reference UX fix, 47 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after Save-preset missing-reference UX fix, 52 tests.
- `npm --workspace apps/renderer run typecheck` - passed after Save-preset missing-reference UX fix.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after blocking incomplete-preset save dialog fix, 47 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after blocking incomplete-preset save dialog fix, 52 tests.
- `npm --workspace apps/renderer run typecheck` - passed after blocking incomplete-preset save dialog fix.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after New-preset create-flow redesign, 47 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after New-preset create-flow redesign, 52 tests.
- `npm --workspace apps/renderer run typecheck` - passed after New-preset create-flow redesign.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after visible validation and active-delete reassignment fix, 48 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after visible validation and active-delete reassignment fix, 53 tests.
- `npm --workspace apps/renderer run typecheck` - passed after visible validation and active-delete reassignment fix.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after duplicate preset-name validation fix, 49 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after duplicate preset-name validation fix, 54 tests.
- `npm --workspace apps/renderer run typecheck` - passed after duplicate preset-name validation fix.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx` - passed after activation runtime-status polling fix, 50 tests.
- `npm --workspace apps/renderer run test -- --run Settings.test.tsx ChatStreaming.test.tsx` - passed after activation runtime-status polling fix, 55 tests.
- `npm --workspace apps/renderer run typecheck` - passed after activation runtime-status polling fix.
