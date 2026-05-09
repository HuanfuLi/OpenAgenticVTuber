---
phase: 06-plugin-runtime-default-plugin
plan: 04
subsystem: plugin-runtime
tags: [python, plugins, orchestrator, compositor, pytest, param-frame]

requires:
  - phase: 06-plugin-runtime-default-plugin
    plan: 03
    provides: default plugin parser, emotion ParamFrame compositions, and runtime adapter wiring
provides:
  - SentenceOutput.plugin_text contract for plugin-visible raw sentence text
  - Orchestrator plugin adapter delivery using pre-display/pre-TTS sentence text
  - DefaultPlugin.render_frame(now) timed active-action frame rendering
  - PluginAdapter tick refresh path for active plugin ramps
affects: [06-plugin-runtime-default-plugin, 07-three-category-code-parsing-dispatch, orchestrator, compositor]

tech-stack:
  added: []
  patterns:
    - Plugin-visible text is carried separately from display_text and tts_text.
    - Token-stream parsing activates plugin actions while compositor ticks render time-varying frames.

key-files:
  created:
    - .planning/phases/06-plugin-runtime-default-plugin/06-04-SUMMARY.md
  modified:
    - sidecar/src/sidecar/orchestrator/output_types.py
    - sidecar/src/sidecar/orchestrator/transformers.py
    - sidecar/src/sidecar/orchestrator/orchestrator.py
    - sidecar/src/sidecar/compositor/plugin_adapter.py
    - plugins/default/__init__.py
    - sidecar/tests/test_orchestrator_turn.py
    - sidecar/tests/compositor/test_plugin_adapter.py

key-decisions:
  - "Plugin action codes are preserved on SentenceOutput.plugin_text while display_text and tts_text remain bracket-stripped."
  - "DefaultPlugin action parsing remains plugin-owned; PluginAdapter.tick() is the authoritative runtime ramp renderer."
  - "Timed default-plugin frames remain ParamFrame-only with no pyvts, exp3, or requestExpressionActivation path."

patterns-established:
  - "Use SentenceOutput.plugin_text for plugin delivery whenever display/TTS filtering would remove plugin action codes."
  - "Plugins with render_frame(now) can expose active clock-rendered frames without requiring additional token-stream calls."

requirements-completed:
  - PLG-07
  - ARCH-01
  - ARCH-03
  - ARCH-04

metrics:
  duration: 5min
  completed: 2026-05-08
  tasks: 2
  files: 8
---

# Phase 06 Plan 04: Plugin Runtime Gap Closure Summary

**Raw plugin sentence delivery plus tick-rendered default-plugin joy ramps**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-08T10:56:21Z
- **Completed:** 2026-05-08T11:01:03Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `SentenceOutput.plugin_text` so the orchestrator can preserve the post-`sentence_divider`, pre-display/pre-TTS sentence for plugins.
- Changed `Orchestrator._emit_sentence()` to enqueue `sentence_output.plugin_text`, so normal turns deliver `Hello [joy] world.` to the plugin adapter while display/TTS stay `Hello world.`.
- Added `DefaultPlugin.render_frame(now)` so active actions can be recomputed against the compositor clock.
- Changed `PluginAdapter.tick(now)` to call optional plugin `render_frame(now)`, allowing one prior `enqueue_sentence("[joy]")` to produce nonzero ramp frames at later ticks and decay afterward.
- Added focused regressions for both failed truths from `06-VERIFICATION.md`.

## Task Commits

1. **Task 1: Preserve plugin-visible raw sentence text through Orchestrator.turn()** - `dd5f730` (test), `e7c43fd` (feat)
2. **Task 2: Render timed default-plugin ramp frames through adapter ticks** - `51143ec` (test), `cf2eaad` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/orchestrator/output_types.py` - Adds the `plugin_text` field to `SentenceOutput`.
- `sidecar/src/sidecar/orchestrator/transformers.py` - Sets `plugin_text=sentence.text` before display/TTS filtering.
- `sidecar/src/sidecar/orchestrator/orchestrator.py` - Enqueues `sentence_output.plugin_text` into the plugin adapter.
- `plugins/default/__init__.py` - Adds `render_frame(now)` for active action ramp rendering and decay.
- `sidecar/src/sidecar/compositor/plugin_adapter.py` - Refreshes active plugin frames through optional `render_frame(now)` on ticks.
- `sidecar/tests/test_orchestrator_turn.py` - Covers bracketed plugin text with stripped display/TTS output.
- `sidecar/tests/compositor/test_plugin_adapter.py` - Covers `[joy]` enqueue followed by nonzero timed ticks and later decay.

## Decisions Made

- Kept the legacy system-owned `ActionIntent(kind="expression", name="joy")` extraction intact for this gap plan, as requested; Phase 7 can replace that layer later.
- Kept default plugin output strictly as `ParamFrame` data. No pyvts import, `.exp3` dependency, or expression activation path was introduced.
- Made adapter ticks authoritative for runtime ramp timing so plugin motion does not depend on repeated token-stream calls.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Other executor commits for 06-05 landed between 06-04 commits. They were left untouched and are not included in this plan's task list.
- Existing unrelated working-tree changes remained outside this plan's scope, including avatar override movement, Phase 7 research, and `backup/`.

## Verification

- `cd sidecar && uv run pytest tests/test_orchestrator_turn.py::test_plugin_adapter_receives_bracketed_sentence_while_display_and_tts_are_stripped -x --no-header` -> 1 passed.
- `cd sidecar && uv run pytest tests/compositor/test_plugin_adapter.py::test_enqueue_joy_renders_nonzero_timed_frames tests/plugins/test_default_plugin.py::test_joy_ramps_in_and_out_over_expected_windows -x --no-header` -> 2 passed.
- `cd sidecar && uv run pytest tests/plugins tests/compositor tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py tests/architecture/test_pyvts_writer_singleton.py -q` -> 103 passed.
- `npm run check:contracts` -> passed with no contract drift.
- `npm --workspace apps/renderer run typecheck` -> passed.

## Known Stubs

None found in files created or modified by this plan. Empty dictionaries/lists in the touched runtime files are active runtime state or test assertions, not UI-facing stubs.

## Auth Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The first two `06-VERIFICATION.md` gaps are closed. Normal orchestrator turns now preserve plugin action text for plugin-owned parsing, and the default plugin can render timed nonzero `[joy]` frames through compositor-style adapter ticks.

## Self-Check: PASSED

- Created/modified files listed in this summary exist.
- Task commits `dd5f730`, `e7c43fd`, `51143ec`, and `cf2eaad` exist in git history.

---
*Phase: 06-plugin-runtime-default-plugin*
*Completed: 2026-05-08*
