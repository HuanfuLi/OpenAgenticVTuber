---
status: diagnosed
phase: 12-settings-reality-pass
source:
  - .planning/phases/12-settings-reality-pass/12-01-SUMMARY.md
started: 2026-05-09T07:32:27-04:00
updated: 2026-05-09T07:45:30-04:00
---

## Current Test

[testing complete]

## Tests

### 1. Avatars Settings Reality
expected: Open Settings. There is one combined "Avatars" section. It shows the current avatar ID plus catalog details such as name/source path and variant/event counts when metadata is available, or a truthful degraded state when metadata is unavailable. It does not show separate stale "Avatar catalogs" or "Per-avatar settings" placeholder sections.
result: pass

### 2. Avatar Import/Edit Routing
expected: In Settings > Avatars, "Edit current" opens the Avatar Import review flow for the active avatar catalog. "Import/replace" starts the folder-pick/import flow instead of reusing the current plan.
result: issue
reported: "Fail: I started app with Teto being imported, but Avatars is showing unknown for Avatar ID, while also saying \"Current avatar ID is known, but catalog metadata is unavailable\". The Edit current is disabled, Import/replace is active"
severity: major

### 3. VTube Studio Settings Reality
expected: Settings has a compact "VTube Studio" section that mirrors live VTS status. Restart sidecar and Reset/re-auth VTS token are available only inside the Troubleshooting disclosure, while the upper-right Status popover remains the primary status surface.
result: pass

### 4. Conversation And Memory Truthfulness
expected: Settings > Conversation says the app uses a single in-memory thread that clears on relaunch and does not expose saved-history/session controls. Settings > Memory is visible, disabled, and says memory ships with v4.0 agentic system plus memory.
result: pass

### 5. Diagnostics Log Level And Milestone Copy
expected: Settings > Diagnostics has an enabled Log level select with error/warn/info/debug values that persists after changing it. Target Phase 12 sections do not say "Coming in milestone-2"; TTS/STT copy points to v3.0 where relevant and memory/agentic copy points to v4.0.
result: issue
reported: "pass. However, I don't understand what each level stand for. Need a more descriptive list of level names or with a description panel"
severity: minor

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "In Settings > Avatars, Edit current opens the Avatar Import review flow for the active avatar catalog."
  status: failed
  reason: "User reported: Fail: I started app with Teto being imported, but Avatars is showing unknown for Avatar ID, while also saying \"Current avatar ID is known, but catalog metadata is unavailable\". The Edit current is disabled, Import/replace is active"
  severity: major
  test: 2
  root_cause: "AvatarsSection performs a one-shot current-plan load during initial render and permanently disables Edit current when that first plan load returns null. If sidecar metadata is unavailable during startup, the UI stays degraded. The load path also couples current-id and current-plan failure handling, so an API or startup failure can leave the displayed ID as 'unknown' while the copy says the ID is known."
  artifacts:
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "AvatarsSection disables Edit current with disabled={!plan && !loading} and only loads current metadata in a mount-only useEffect."
    - path: "apps/electron-main/src/ipc.ts"
      issue: "avatar:getCurrentPlan truthfully returns null while sidecar/current metadata is unavailable, so renderer must retry or present a non-contradictory state."
  missing:
    - "Load current avatar ID independently from current avatar metadata and keep a truthful fallback state."
    - "Retry current avatar metadata when sidecar status becomes ready and when Edit current is clicked."
    - "Do not permanently disable Edit current after a transient metadata miss; show an actionable unavailable message only after retry fails."
  debug_session: "inline verify-work diagnosis 2026-05-09"
- truth: "Settings > Diagnostics Log level is understandable enough for a user to choose error/warn/info/debug."
  status: failed
  reason: "User reported: pass. However, I don't understand what each level stand for. Need a more descriptive list of level names or with a description panel"
  severity: minor
  test: 5
  root_cause: "Diagnostics exposes raw log-level enum values with only a generic persistence-oriented helper. The UI does not explain what error/warn/info/debug include, so users cannot make an informed choice."
  artifacts:
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "DiagnosticsSection renders a bare select with raw level names and no selected-level explanation."
    - path: "apps/renderer/src/lib/copy.ts"
      issue: "Copy has DIAG_LOG_LEVEL_HELP but no per-level descriptions."
  missing:
    - "Add user-facing descriptions for error, warn, info, and debug."
    - "Render the selected level description or a compact list near the select."
  debug_session: "inline verify-work diagnosis 2026-05-09"
