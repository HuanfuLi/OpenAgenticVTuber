---
phase: 14-plugin-developer-docs-plugin-swap-hardening
plan: 14-03
subsystem: plugins-ui-status
tags: [plugins, docs, electron, restart, gap-closure]
requires:
  - phase: 14-plugin-developer-docs-plugin-swap-hardening
    provides: Phase 14 UAT gap diagnosis
provides:
  - AvatarOverrides author documentation
  - Windows sidecar process-tree shutdown for plugin restarts
  - Focused verification for gap closure
affects: [plugins, docs, electron-main]
tech-stack:
  added: []
  patterns:
    - Windows sidecar restart uses process-tree termination for shell-spawned uv/python descendants
key-files:
  created: []
  modified:
    - docs/plugins/motion-plugin-authoring.md
    - docs/plugins/ai-motion-plugin-playbook.md
    - docs/plugins/default-and-sample-plugins.md
    - apps/electron-main/src/sidecar.ts
key-decisions:
  - "AvatarOverrides is documented as avatar-specific context, not a ParamFrame output channel."
  - "Windows sidecar shutdown uses taskkill /T /F to terminate shell-spawned descendants during intentional restart."
patterns-established:
  - "Plugin switch restart must clean up the full sidecar process tree before spawning a replacement."
requirements-completed: [PLUGDOC-01, PLUGDOC-02, PLUGDOC-03, PLUGDOC-04, PLUGDOC-05]
duration: 25min
completed: 2026-05-09
---

# Phase 14 Plan 14-03: Close Plugin Docs And Restart UAT Gaps Summary

**AvatarOverrides docs and Windows sidecar process-tree restart cleanup for plugin-switch UAT gaps**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-09T10:16:00-04:00
- **Completed:** 2026-05-09T10:22:35-04:00
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- Added a dedicated `AvatarOverrides` section explaining author-relevant fields, RigCapabilities precedence, and default-plugin action binding usage.
- Updated the AI playbook and default/sample docs so agents and humans do not confuse variants/events or overrides with plugin action codes.
- Updated Electron sidecar shutdown so Windows restarts terminate the full `cmd -> uv -> python` process tree using `taskkill /T /F`, avoiding leaked VTS plugin connections from old sidecars.

## Task Commits

1. **Docs and restart gap closure** - `95266d7` (fix)

## Files Created/Modified

- `docs/plugins/motion-plugin-authoring.md` - Added AvatarOverrides author guidance.
- `docs/plugins/ai-motion-plugin-playbook.md` - Added AvatarOverrides adaptation rules.
- `docs/plugins/default-and-sample-plugins.md` - Clarified default-plugin action bindings.
- `apps/electron-main/src/sidecar.ts` - Added process-tree shutdown helper and used it for timeout/restart cleanup.

## Decisions Made

- Treated `AvatarOverrides` as boot-time avatar context and documented that plugins must still gate emitted params through `RigCapabilities`.
- Used Windows `taskkill /T /F` because the sidecar is launched through a shell wrapper and direct `ChildProcess.kill()` can leave descendants alive.

## Deviations from Plan

Electron-main does not currently have a test runner. The restart helper was made small/exported, and verification used the existing Electron build plus renderer and focused sidecar tests. Manual VTS UAT remains required to confirm connected plugin count behavior.

## Issues Encountered

None.

## Verification

- `npm --workspace apps/electron-main run build` - passed.
- `npm run typecheck:renderer` - passed.
- `npm --workspace apps/renderer run test -- --run Settings StatusIcon` - 26 passed.
- `cd sidecar; uv run pytest tests/admin/test_plugin_status_endpoint.py tests/plugins/test_supervisor.py -q` - 9 passed.
- `git diff --check` - passed with CRLF normalization warnings only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `$gsd-verify-work 14` recheck focused on AvatarOverrides docs, plugin switch restart behavior, and chat availability with `broken_motion_test`.

---
*Phase: 14-plugin-developer-docs-plugin-swap-hardening*
*Completed: 2026-05-09*
