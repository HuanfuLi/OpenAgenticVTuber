---
phase: 14-plugin-developer-docs-plugin-swap-hardening
plan: 14-01
subsystem: plugins
tags: [plugins, sdk, docs, sample-plugin, ai-playbook]
requires:
  - phase: 13-conversation-history-sessions
    provides: stable Settings and status surfaces for Phase 14 integration
provides:
  - Supported v1 plugin-author helper kit
  - Minimal sample_motion plugin
  - Human plugin documentation
  - Tool-neutral AI motion plugin playbook and thin Codex adapter skill
affects: [plugins, sidecar, docs, ai-skills]
tech-stack:
  added: []
  patterns:
    - Pure helper kit in sidecar.plugins.sdk
    - Sample plugin uses helper kit before default-plugin complexity
key-files:
  created:
    - sidecar/src/sidecar/plugins/sdk.py
    - plugins/sample_motion/plugin.yaml
    - plugins/sample_motion/__init__.py
    - docs/plugins/README.md
    - docs/plugins/motion-plugin-authoring.md
    - docs/plugins/plugin-system-integration.md
    - docs/plugins/ai-motion-plugin-playbook.md
    - docs/plugins/default-and-sample-plugins.md
    - .codex/skills/agenticllmvtuber-motion-plugin/SKILL.md
  modified:
    - sidecar/src/sidecar/plugins/__init__.py
key-decisions:
  - "The supported v1 authoring surface is a small helper kit, not a second plugin framework."
  - "The tool-neutral AI playbook is canonical; the Codex skill only points at it."
patterns-established:
  - "Plugin helpers stay pure and dependency-light so third-party plugins can import them safely."
requirements-completed: [PLUGDOC-01, PLUGDOC-02, PLUGDOC-05]
duration: 35min
completed: 2026-05-09
---

# Phase 14 Plan 14-01: Plugin Developer Contract, Helper Kit, Sample Plugin, And Agent Playbook Summary

**Supported plugin-authoring kit, minimal sample plugin, human docs, and tool-neutral AI adaptation playbook**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-09T09:18:00-04:00
- **Completed:** 2026-05-09T09:31:00-04:00
- **Tasks:** 5
- **Files modified:** 12

## Accomplishments

- Added `sidecar.plugins.sdk` for action-code parsing, finite filtering, writable-param gating, ramp/easing, and safe `ParamFrame` construction.
- Added `plugins/sample_motion` as the minimal plugin-author reference distinct from the production default plugin.
- Added `docs/plugins/` human docs plus the tool-neutral AI playbook and thin Codex adapter skill.

## Task Commits

1. **Helper kit, sample plugin, docs, and tests** - `3085a2a` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/plugins/sdk.py` - Supported v1 helper kit.
- `plugins/sample_motion/` - Minimal sample plugin and manifest.
- `docs/plugins/` - Human guide, integration guide, default/sample guide, and AI playbook.
- `.codex/skills/agenticllmvtuber-motion-plugin/SKILL.md` - Thin Codex adapter.
- `sidecar/tests/plugins/test_plugin_sdk.py` and `test_sample_plugin.py` - Focused helper/sample tests.

## Decisions Made

- Kept helper APIs pure and small so they reduce repeated plugin-author mistakes without becoming a framework.
- Made the AI playbook tool-neutral and canonical, with the Codex skill as a pointer only.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 14-02 can reference the docs and sample plugin while hardening Settings, restart, and runtime plugin health behavior.

---
*Phase: 14-plugin-developer-docs-plugin-swap-hardening*
*Completed: 2026-05-09*
