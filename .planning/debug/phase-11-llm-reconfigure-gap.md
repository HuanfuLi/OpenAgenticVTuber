---
status: resolved
phase: 11-status-app-state-reality
created: 2026-05-09T07:01:15-04:00
updated: 2026-05-09T07:12:13-04:00
---

# Phase 11 LLM Reconfiguration Gap

## Issue

Phase 11 UAT found that the status row can show the persisted LLM provider/model, but the user cannot reconfigure those values after first-run setup. In practice this makes the app look hardcoded to LM Studio plus auto-detect when `modelName` is blank.

## Evidence

- `apps/renderer/src/screens/Settings/Settings.tsx`: `ConnectionSection` loads `window.api.getStoredConfig()` and renders provider, endpoint, and model as read-only `kv-row` values. Its "Change provider" button is disabled.
- `apps/renderer/src/screens/LLMSetup/LLMSetup.tsx`: the editable provider/endpoint/model/API key form and `TestLog` connection test exist only in the first-run setup component.
- `apps/renderer/src/App.tsx`: `GatedShell` renders `LLMSetup` only while setup is required. Once setup is ready, there is no route back to the editable setup form.
- `apps/renderer/src/lib/copy.ts`: Settings copy still says provider reconfiguration lands later.

## Root Cause

Phase 11 removed fake status mutation and made status display real persisted setup values, but it did not restore a post-setup configuration editor. The existing Settings connection surface is a read-only summary and therefore cannot change the persisted provider or model.

## Fix Direction

Create a Phase 11 gap-closure plan that adds a real Settings reconfiguration flow. It should persist through the existing Electron safeStorage path, preserve unrelated stored config like active plugin selection, refresh status after save, and keep auto-detect as the intentional display for a blank model field rather than a hardcoded model.

## Resolution

Plan 11-02 implemented the Settings reconfiguration flow. The editor reuses the existing provider selector and connection test log, saves through `saveCompletedSetupConfig`, preserves plugin config, refreshes status, and is covered by focused Settings regression tests.
