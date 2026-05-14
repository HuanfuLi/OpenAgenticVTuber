---
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
plan: 20-10
status: implemented
completed: 2026-05-13T01:42:11-04:00
gap_closure: true
---

# 20-10 Summary: STT Model Removal UX And Redownload

## Outcome

Implemented the STT model removal gap closure. Removing the active local STT model now remains a model-cache operation in the UI while still persisting `missing_model` readiness so Chat blocks PTT before recording starts.

## Changes

- Added cache-operation persistence options so removal can persist invalidated STT readiness without showing primary Save settings success copy or Save button state.
- Kept the selected local provider's model cache card visible when the refreshed catalog is temporarily missing the active provider after removal.
- Represented the removed active model as `not_downloaded`, `removable: false`, with Download still available.
- Preserved `notifyVoiceInputConfigChanged()` so Chat refreshes readiness after removal.
- Added a Settings regression for empty post-removal catalog refresh, no generic Save settings copy, visible cache card, enabled Download, disabled Remove, and persisted `missing_model` readiness.

## Verification

- `npm --workspace apps/renderer run test -- --run Settings` passed: 70 tests.
- `npm --workspace apps/renderer run typecheck` passed.
- `git diff --check` passed with existing LF/CRLF warnings only.

## Human Retest

Passed in live Phase 20 UAT. After a local STT model is present and the provider is enabled, `Remove model` now shows model-removal-specific status, keeps the cache card visible as not downloaded, leaves `Download model` immediately available, and blocks Chat PTT until model setup is restored.
