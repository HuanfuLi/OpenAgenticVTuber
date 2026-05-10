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
updated: 2026-05-10T01:32:00Z
---

# Phase 17 UAT - GPT-SoVITS Provider + Voice Presets

## Current Test

number: 1
name: Provider Selection And Health Gate
expected: |
  In Settings -> TTS, Piper is available as a selectable local provider. Selecting GPT-SoVITS shows a single Base URL field, lets you run a health check, and does not activate GPT-SoVITS until a voice preset and audible test synthesis also pass.
awaiting: diagnosis/fix planning

## Tests

### 1. Provider Selection And Health Gate
expected: In Settings -> TTS, Piper is available as a selectable local provider. Selecting GPT-SoVITS shows a single Base URL field, lets you run a health check, and does not activate GPT-SoVITS until a voice preset and audible test synthesis also pass.
result: issue
reported: "Initial startup blocker and health/test gate sub-issue were fixed. Retest still critically fails: Voice preset Save has no indication, user cannot tell whether it saved; saved preset disappears after leaving and returning to Settings; chat regressed and cannot get LLM response because sidecar startup raises `ValueError: GPT-SoVITS activation requires an active voice preset and reference audio.`"
severity: blocker

### 2. App-Managed Launch Controls
expected: In app-launched GPT-SoVITS mode, Settings shows command, working directory, optional health URL, Start, Stop, and Restart controls. Stop/Restart only apply to the process AgenticLLMVTuber started; external server mode says to stop it outside the app.
result: [pending]

### 3. Reference Audio Import And Validation
expected: Importing reference audio copies it into app-managed storage, requires transcript text and language, displays validation details such as format and duration, and does not show the original absolute file path.
result: [pending]

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
passed: 0
issues: 1
pending: 6
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
  status: failed
  reason: "User reported: Initial startup blocker and health/test gate sub-issue were fixed. Retest still critically fails: Voice preset Save has no indication, user cannot tell whether it saved; saved preset disappears after leaving and returning to Settings; chat regressed and cannot get LLM response because sidecar startup raises `ValueError: GPT-SoVITS activation requires an active voice preset and reference audio.`"
  severity: blocker
  test: 1
  root_cause: "Startup sub-issue resolved: local npm workspace install was stale/incomplete. Health/test gate sub-issue fixed in commit 8504e17. Preset save feedback/persistence issue fixed by showing explicit save success/failure status, refreshing persisted preset state after save, and adding a return-to-Settings regression. Chat regression root cause: sidecar startup still built the active GPT-SoVITS gateway when persisted activation lacked a usable active preset/reference handoff, causing `ValueError` and leaving the orchestrator unavailable. Sidecar startup now detects incomplete GPT-SoVITS activation, reports a misconfigured GPT-SoVITS health state, and starts the Piper gateway so chat remains available."
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
  missing:
    - "User retest confirmation that preset save has visible feedback, persists after leaving/returning to Settings, and chat responds when persisted GPT-SoVITS activation is incomplete/stale."
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
