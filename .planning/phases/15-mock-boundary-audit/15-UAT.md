---
status: pending
phase: 15-mock-boundary-audit
source:
  - 15-01-PLAN.md
started: 2026-05-09T12:28:00-04:00
updated: 2026-05-09T12:28:00-04:00
---

# Phase 15 UAT: Mock Boundary Audit

## Current Test

Awaiting optional human confirmation. Automated mock-boundary, renderer, and Electron build checks passed during execution.

## Tests

### 1. Normal Chat Has No Scripted Conversation

expected: Opening Chat with an empty active session shows the normal empty state and does not inject prototype messages such as `echo: hello`.
result: pending

### 2. Banner Actions Use Real App Paths

expected: LLM retry refreshes real status APIs, and sidecar restart banners call the real restart bridge. No banner action creates fake green status.
result: pending

### 3. Log Folder Action Is Real

expected: Logs drawer and Settings Diagnostics open the native log folder through the Electron bridge.
result: pending

### 4. Docs Actions Are Real

expected: VTube Studio docs and setup help use narrow Electron bridge actions, not mock alert dialogs.
result: pending

### 5. Development Controls Are Isolated

expected: DevPanel remains available only in dev builds, and production renderer source has no dependency on dev mock modules.
result: pending

## Automated Evidence

```powershell
npm --workspace apps/renderer run test -- --run mock-boundary.test.ts Chat.test.tsx Settings.test.tsx logs-drawer-intent.test.tsx LLMSetup.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx
npm --workspace apps/renderer run typecheck
npm --workspace apps/electron-main run build
rg -n "@/dev/__mocks__|mockStatus|mockBanners|mockToasts|mockSafeStorage|SCRIPTED_CONVO|PLACEHOLDER_THREADS|startSidecarLogs" apps/renderer/src -g "!dev/**"
rg -n "alert\('\(mock\)|Would open" apps/renderer/src apps/electron-main/src apps/electron-main/preload
```

Result: all tests/build/typecheck passed; both `rg` commands returned no matches.

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

None at execution time.
