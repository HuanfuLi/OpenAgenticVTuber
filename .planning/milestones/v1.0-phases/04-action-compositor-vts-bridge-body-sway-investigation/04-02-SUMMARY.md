---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
plan: 02
subsystem: compositor-body-sway
tags: [compositor, vts, body-sway, idle-driver, speech-driver, intent-driver, dev-panel]
requires:
  - phase: 04-00
    provides: TetoOverrides body-sway default and hotkey inventory
  - phase: 04-01
    provides: PyvtsSafeWriter and ParamFrame contract
provides:
  - 60Hz deadline-driven compositor merge loop
  - Idle baseline head/eye/breath/blink driver
  - Speech driver consuming Phase 3 RMS envelopes and dispatching body-sway strategy output
  - Intent driver with 300ms ramp-in and 600ms sentence-complete decay
  - Body-sway strategy registry with head_only, proxy_param, exp3_modulation
  - Dev-panel body-sway strategy hot-switch over WS control envelope
  - Sentence-complete queue between TTSTaskManager and compositor intent driver
affects: [04-03-cursor-discrete-demo, 04-04-body-sway-investigation, phase-5-verification]
tech-stack:
  added: []
  patterns:
    - deadline-driven 60Hz compositor loop
    - tick-boundary strategy hot-swap
    - queue-fed speech and intent drivers
key-files:
  created:
    - sidecar/src/sidecar/compositor/compositor.py
    - sidecar/src/sidecar/compositor/easing.py
    - sidecar/src/sidecar/compositor/idle_driver.py
    - sidecar/src/sidecar/compositor/intent_driver.py
    - sidecar/src/sidecar/compositor/speech_driver.py
    - sidecar/src/sidecar/compositor/body_sway/registry.py
    - sidecar/src/sidecar/compositor/body_sway/head_only.py
    - sidecar/src/sidecar/compositor/body_sway/proxy_param.py
    - sidecar/src/sidecar/compositor/body_sway/exp3_modulation.py
    - sidecar/tests/compositor/test_body_sway_registry.py
    - sidecar/tests/compositor/test_idle_driver.py
    - sidecar/tests/compositor/test_intent_driver.py
    - sidecar/tests/compositor/test_speech_driver.py
  modified:
    - sidecar/src/sidecar/compositor/__init__.py
    - sidecar/src/sidecar/orchestrator/orchestrator.py
    - sidecar/src/sidecar/tts/tts_manager.py
    - sidecar/src/sidecar/ws/server.py
    - sidecar/src/sidecar/ws/handlers.py
    - apps/renderer/src/dev/DevPanel.tsx
    - apps/renderer/src/lib/copy.ts
key-decisions:
  - "Ship-default body_sway_strategy remains head_only because 04-00 seeded smoke_pass_status=deferred; live strategy ratings are produced by 04-04."
  - "Intent decay is driven by a sentence-complete queue published by TTSTaskManager after stream.write returns."
  - "ActionIntent currently has no sentence_id field, so the skeleton intent driver treats sentence-complete as a global expression decay trigger."
patterns-established:
  - "Compositor catches pre-handshake writer failures and continues ticking until VTS auth completes."
  - "Body-sway strategy swaps are requested from WS control but applied only at the next compositor tick."
requirements-completed: [AVT-01, AVT-02, AVT-03, AVT-06, AVT-08]
duration: 2h
completed: 2026-05-07
---

# Phase 04 Plan 02: Compositor Core Summary

**60Hz compositor with idle, speech, intent, and body-sway strategy drivers wired into sidecar startup and dev controls**

## Performance

- **Duration:** 2h
- **Started:** 2026-05-08T01:10:00Z
- **Completed:** 2026-05-08T03:10:00Z
- **Tasks:** 4
- **Files modified:** 25

## Accomplishments

- Added the 60Hz `Compositor` loop with idle -> speech -> intent -> cursor merge order.
- Added `IdleDriver`, `SpeechDriver`, `IntentDriver`, and the three body-sway strategies: `head_only`, `proxy_param`, `exp3_modulation`.
- Wired `compositor_intent_queue` and `compositor_sentence_complete_queue` through `Orchestrator`, `TTSTaskManager`, and `ws/server.py`.
- Added the dev-panel radio hot-switch that sends `set-body-sway-strategy:<name>` and a sidecar `control` handler that calls `request_strategy_swap`.
- Added 20 compositor tests plus a small `sidecar/tests/__init__.py` fix so targeted imports of `tests.conftest` are stable.

## Task Commits

1. **Tasks 1-4: compositor, drivers, body-sway registry, queue wiring, and dev-panel hot-switch** - `cba79b1` (feat)

## Files Created/Modified

- `sidecar/src/sidecar/compositor/compositor.py` - Deadline-driven 60Hz frame scheduler and driver merge.
- `sidecar/src/sidecar/compositor/idle_driver.py` - Continuous head/eye/breath/blink baseline.
- `sidecar/src/sidecar/compositor/speech_driver.py` - RMS interpolation, mouth output, EMA body-sway strategy dispatch.
- `sidecar/src/sidecar/compositor/intent_driver.py` - Expression intent ramp-in and sentence-end decay.
- `sidecar/src/sidecar/compositor/body_sway/*.py` - Strategy registry and three strategy implementations.
- `sidecar/src/sidecar/ws/server.py` - Creates compositor queues, drivers, `PyvtsSafeWriter`, handshake task, and compositor task in lifespan.
- `sidecar/src/sidecar/ws/handlers.py` - Adds `set-body-sway-strategy:<name>` control handler.
- `apps/renderer/src/dev/DevPanel.tsx` - Adds strategy radio controls.

## Decisions Made

- Ship-default body sway remains `head_only` because `avatars/teto/teto_overrides.yaml` still records deferred smoke-pass status. 04-04 owns the A/B evidence and final rating files under `.planning/skeleton-verification-evidence/04/`.
- `TTSTaskManager` publishes `sentence_id` to `compositor_sentence_complete_queue` immediately after `stream.write()` returns. Inserted at `sidecar/src/sidecar/tts/tts_manager.py:211`:

```python
if self.compositor_sentence_complete_queue is not None:
    await self.compositor_sentence_complete_queue.put(
        next_payload.sentence_id
    )
```

- New orchestrator constructor queues:

```python
compositor_intent_queue: asyncio.Queue[ActionIntent] | None = None
compositor_sentence_complete_queue: asyncio.Queue[int] | None = None
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made sidecar/tests importable**
- **Found during:** Integration-adjacent test run.
- **Issue:** `tests/test_orchestrator_turn.py` imports `tests.conftest`, but `sidecar/tests` lacked `__init__.py`, causing direct targeted pytest collection to fail.
- **Fix:** Added `sidecar/tests/__init__.py`.
- **Verification:** `tests/test_tts_manager.py tests/test_orchestrator_turn.py tests/vts/` passed.
- **Committed in:** `cba79b1`

**2. [Rule 3 - Blocking] Adapted intent driver to current ActionIntent shape**
- **Found during:** Task 2 implementation.
- **Issue:** The plan references `ActionIntent.sentence_id`, but the current contract does not define that field.
- **Fix:** Implemented skeleton-safe global sentence-complete decay while preserving locked `RAMP_IN_MS=300.0` and `RAMP_OUT_MS=600.0`.
- **Verification:** `test_intent_ramps_in_with_cubic_weight` and `test_sentence_complete_starts_600ms_decay` pass.
- **Committed in:** `cba79b1`

---

**Total deviations:** 2 auto-fixed (2 blocking).
**Impact on plan:** The compositor foundation is complete; per-sentence intent binding is limited by the current contract and can be tightened when `ActionIntent.sentence_id` exists.

## Issues Encountered

- A spawned `04-02` executor drifted into Phase 5 plan files and was shut down. The final `04-02` implementation was completed locally.
- `uv` checks required escalated execution because the sandbox cannot access the global uv cache.

## Verification

- `cmd /c uv run pytest tests/compositor/ -x -v` - 20 passed.
- `cmd /c uv run python -c "from sidecar.compositor import Compositor, ease_out_cubic; ..."` - locked decisions verified.
- `cmd /c npx tsc --noEmit -p apps/renderer/tsconfig.json` - passed.
- `cmd /c uv run pytest tests/test_tts_manager.py tests/test_orchestrator_turn.py tests/vts/ -x -v` - 39 passed.
- Source invariants:
- `exp3_modulation.py` contains `Pitfall 18` and `do NOT use ExpressionActivationRequest`.
- `exp3_modulation.py` contains no `requestActivateExpression` or `requestExpressionActivation`.
- `STRATEGY_NAMES == ("head_only", "proxy_param", "exp3_modulation")`.
- `EMA_ALPHA == 0.2`.
- `RAMP_IN_MS == 300.0` and `RAMP_OUT_MS == 600.0`.

## User Setup Required

None. 04-04 will require operator evidence capture using the dev-panel hot-switch.

## Next Phase Readiness

04-03 can add cursor tracking and the visible DiscreteEvent demo on top of the running compositor and existing `app.state.teto_overrides`. 04-04 can run the A/B body-sway investigation and write `.planning/skeleton-verification-evidence/04/README.md` for Phase 5 SC-01.

---
*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Completed: 2026-05-07*
