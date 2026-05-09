---
phase: 03-tts-sentence-buffered-audio
plan: 02
subsystem: sidecar-tts
tags: [piper-tts, sounddevice, ordered-playback, renderer-chat, websocket]

# Dependency graph
requires:
  - phase: 03-tts-sentence-buffered-audio
    provides: TTSGateway, audio payload helpers, SpeechEnvelopePayload contracts, and bundled Piper model from 03-01
provides:
  - OLVT-style TTSTaskManager with parallel synth and ordered sidecar playback
  - Orchestrator pending-input FIFO plus post-drain turn completion gating
  - FastAPI lifespan wiring for pre-READY TTS boot, degraded mode, and speech-queue drain tasks
  - Renderer speaking affordance tied to audio-arrival and chain-end events
affects: [04-compositor-lipsync, 05-verification, chat-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - OLVT sender-task ordering adapted for sidecar playback: queue.put -> ws.send_json -> stream.write
    - pending_inputs FIFO processed by a background turn loop bound to the active websocket
    - speaking UX derived from first audio arrival through chain-end rather than from thinking state

key-files:
  created:
    - sidecar/src/sidecar/tts/tts_manager.py
    - sidecar/tests/test_tts_manager.py
    - apps/renderer/tests/Chat.test.tsx
  modified:
    - sidecar/src/sidecar/orchestrator/orchestrator.py
    - sidecar/src/sidecar/ws/server.py
    - sidecar/src/sidecar/ws/handlers.py
    - sidecar/src/sidecar/orchestrator/PROVENANCE.md
    - sidecar/src/sidecar/tts/PROVENANCE.md
    - apps/renderer/src/screens/Chat/useStreamingMessages.ts
    - apps/renderer/src/screens/Chat/Chat.tsx
    - apps/renderer/src/ws/store.ts
    - apps/renderer/src/lib/copy.ts

key-decisions:
  - "force-new-message remains delayed until post-drain in this skeleton implementation because the renderer seal and input re-enable must stay aligned with sidecar-side playback completion."
  - "The pending-input turn loop binds a single active websocket on enqueue, matching the project’s single-renderer skeleton assumption."
  - "The Phase 4 speech-driver handoff stays queue-based, with debug [SPEECH-ENV] logs emitted by the no-op drain task for verification."

patterns-established:
  - "TTSTaskManager pattern: concurrent sentence synth tasks feed a sequence-buffered sender coroutine with explicit drain waiting."
  - "Degraded-mode startup pattern: TTS/init failures leave the sidecar READY and surface a WS banner on first text input instead of hanging Electron startup."
  - "Renderer speaking-state pattern: chain-start clears speaking, audio envelopes assert speaking, and chain-end/error clears it."

requirements-completed: [TTS-02]

# Metrics
duration: 25min
completed: 2026-05-07
---

# Phase 03 Plan 02: Sentence-Buffered TTS Playback and Speaking UX Summary

**Sentence-buffered sidecar playback with OLVT-style ordered delivery, post-drain turn completion, queued follow-up inputs, and a renderer “Teto is still speaking…” affordance.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-07T05:00:00Z
- **Completed:** 2026-05-07T05:24:26Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Ported `TTSTaskManager` into the sidecar, preserving parallel synthesis and monotonic ordered playback while adapting the sender path to `SpeechEnvelopePayload`, WebSocket audio envelopes, and `sounddevice` writes.
- Extended the orchestrator and FastAPI lifespan so queued text inputs are processed serially, audio drain completes before turn-finalization signals, and TTS boot happens before the sidecar reaches READY.
- Added renderer speaking state, dispatcher wiring, copy, and a visible speaking label so the input stays disabled and the UI distinguishes “thinking” from “still speaking”.

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-executor protocol:

1. **Task 1: TTSTaskManager port + orchestrator drain gating** - `e34be75` (`feat`)
2. **Task 2: Sidecar lifespan + handler enqueue integration** - `b85defe` (`feat`)
3. **Task 3: Renderer speaking affordance** - `f286c21` (`feat`)

## Files Created/Modified

- `sidecar/src/sidecar/tts/tts_manager.py` - OLVT-style sequence-buffered sender and drain-aware wait logic for sidecar playback.
- `sidecar/src/sidecar/orchestrator/orchestrator.py` - TTS manager integration, pending-input FIFO, active-WS binding, and post-drain turn completion.
- `sidecar/src/sidecar/ws/server.py` / `sidecar/src/sidecar/ws/handlers.py` - TTS boot before READY, degraded-mode startup, speech-drain task, turn-loop spawn, and enqueue-on-text-input behavior.
- `sidecar/tests/test_tts_manager.py` / `sidecar/tests/test_orchestrator_turn.py` - ordering, log-marker, drain, queue-serialization, and enqueue-path coverage.
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` / `apps/renderer/src/ws/store.ts` / `apps/renderer/src/screens/Chat/Chat.tsx` / `apps/renderer/src/lib/copy.ts` - speaking-state reducer, dispatcher toggles, UI label, and copy constant.
- `apps/renderer/tests/Chat.test.tsx` - DOM coverage for the speaking label and disabled-input interaction.

## Decisions Made

- Delayed `force-new-message` together with `chain-end` until post-drain, keeping the chat seal and input re-enable aligned with audible completion in the sidecar.
- Used `stream.time + stream.latency` at write start for `SpeechEnvelopePayload.started_at`, preserving the Phase 4 sync contract and matching the plan mandate.
- Kept degraded mode simple: startup failures leave `app.state.orchestrator = None`, preserve READY emission, and return a banner-ready WS error on the next text input.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Sandboxed `uv run pytest` could not access the user uv cache, so sidecar verification had to be rerun with escalation.
- Sandboxed renderer vitest startup hit `esbuild` spawn `EPERM`, so renderer verification also required escalation.
- Live LM Studio / VTube Studio smoke verification was not run in this execution context, so the audible multi-sentence proof, READY-to-audio latency comparison, and live log ordering checks remain for operator verification.

## User Setup Required

None - no external service configuration was added by this plan.

## Next Phase Readiness

- Phase 4 can now consume `compositor_speech_queue` with real `SpeechEnvelopePayload` timing and volume envelopes, without changing the sidecar TTS path.
- The renderer already distinguishes pre-audio “Thinking…” from in-audio “Teto is still speaking…”, so Phase 4 only needs compositor/VTS motion work rather than more chat-state changes.
- Remaining gap for full acceptance is the live LM Studio / audio-device smoke pass required by the plan’s audible verification criteria.

## Self-Check: PASSED

The summary path exists, the three task commits exist in `git log`, and the modified-file scan found no intentional stubs that would block this plan’s goal.

---
*Phase: 03-tts-sentence-buffered-audio*
*Completed: 2026-05-07*
