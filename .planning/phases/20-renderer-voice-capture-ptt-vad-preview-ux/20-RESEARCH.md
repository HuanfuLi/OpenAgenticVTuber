# Phase 20 Research: Renderer Voice Capture + PTT/VAD Preview UX

**Phase:** 20 - Renderer Voice Capture + PTT/VAD Preview UX
**Milestone:** v3.0 Rich Voice Configuration + Voice Input
**Date:** 2026-05-10
**Status:** Ready for planning

## Scope

Phase 20 adds the user-facing voice input path in Chat. It owns renderer microphone permission, push-to-talk, optional VAD auto-submit, transient transcript preview, final transcript submission through existing chat, and safe queueing while a text/TTS turn is active.

This phase does not add STT providers, model downloads, provider readiness, cloud consent, translation, wake word, barge-in interruption, code-switch scoring, or no-headphones/AEC claims.

## Inputs

- `.planning/ROADMAP.md` Phase 20 goal, dependencies, and success criteria.
- `.planning/REQUIREMENTS.md` requirements `VIN-01` through `VIN-06`.
- `.planning/phases/20-renderer-voice-capture-ptt-vad-preview-ux/20-CONTEXT.md` user decisions `D-01` through `D-10`.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` STT readiness and provider guardrails.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-01-PLAN.md` planned STT contracts, registry, readiness, and admin endpoint skeletons.
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-04-PLAN.md` planned Settings STT recorder and Electron/preload bridge.
- Current code in `apps/renderer/src/screens/Chat/Chat.tsx`, `apps/renderer/src/screens/Chat/useStreamingMessages.ts`, `apps/renderer/src/ws/client.ts`, `apps/renderer/src/ws/store.ts`, `apps/electron-main/preload/index.ts`, and `packages/contracts/py/contracts/ws_message.py`.

## Browser And Electron Findings

- `navigator.mediaDevices.getUserMedia({ audio })` is the standard renderer-side permission and capture entry point for microphone streams. It returns an audio `MediaStream` and can fail with typed DOM exceptions such as permission denial or unsatisfied constraints.
- `MediaRecorder` is the simplest fit for Phase 20 PTT recording. It records a `MediaStream`, can emit `dataavailable` blobs periodically via a `timeslice`, and emits a final blob on `stop()`.
- `dataavailable` timeslices are not exact and can be delayed, so preview chunking must tolerate late or larger chunks. Do not build correctness around exact timer boundaries.
- Audio constraints can request sample size/channel count and can be changed with `MediaStreamTrack.applyConstraints()`. Browsers ignore unknown constraints, so code should inspect/support graceful fallbacks rather than assuming every device honors every flag.
- Echo cancellation can be requested with `echoCancellation`, but it is best-effort and browser-defined. Phase 20 should set conservative capture defaults if useful, but must not claim no-headphones/AEC support before Phase 22.
- `AudioWorklet` is the right browser primitive for real-time off-main-thread audio processing. Phase 20 can ship a simpler VAD meter using Web Audio APIs first, but if processing becomes heavy or glitchy, move VAD/audio-frame work into an AudioWorklet.
- Electron permission handling should use both `session.setPermissionRequestHandler` and `session.setPermissionCheckHandler` for complete permission behavior. Scope the allowlist to the app renderer origin and media/microphone permission only.

## Current System Facts

- `Chat.tsx` already owns typed input submission. It sends a `text-input` WebSocket envelope with `text`, `session_id`, and prior session history.
- `appendUserMessage()` in `useStreamingMessages.ts` appends a transient user bubble and disables input until `conversation-chain-end`.
- `ws/store.ts` commits completed turns to local conversation history only after a successful assistant reply. Phase 20 final voice submissions should reuse this path.
- Existing Chat tests already cover active-session history handoff, input disabling while speaking, sidecar reconnect reset, and duplicate WS dispatcher behavior.
- Phase 19 plans intentionally keep the Settings recorder narrow. Phase 20 must create a separate Chat voice input controller rather than extending the Settings test recorder into chat.
- Phase 19 planned bridge/API names may differ at execution time. Phase 20 plans must begin with upstream discovery and adapt to actual Phase 19 outputs.

## Planning Decisions

1. Add a Phase 20 voice-input contract/bridge layer for runtime transcription requests and results. Reuse Phase 19 provider readiness and selected provider; do not bypass enablement.
2. Keep microphone capture renderer-owned. Electron main mediates permission and sidecar/admin calls; renderer should not access Node or sidecar URLs directly.
3. Use `getUserMedia` plus `MediaRecorder` for PTT utterance capture and preview chunks. Keep track cleanup explicit: stop all tracks after recording/finalization/error.
4. Use a small renderer voice-input state machine: `idle`, `permission_needed`, `listening`, `recording`, `previewing`, `finalizing`, `queued`, and `error`.
5. Submit only final transcripts through the existing `text-input` path. Preview chunks/results stay in renderer transient state and never call conversation history APIs.
6. Queue captured final transcripts when a turn is in progress. Start with one visible pending utterance queue unless implementation finds an existing queue primitive from Phase 19. Do not cancel active TTS or implement barge-in.
7. Put PTT hotkey configuration in Settings. Chat owns the mic button; Settings owns the binding.
8. Make VAD opt-in and conservative. Use visible sensitivity and silence timeout controls, but keep no-headphones copy truthful and defer self-speech/AEC validation to Phase 22.

## Risks

| Risk | Mitigation |
|------|------------|
| Preview chunk transcription is slow or arrives out of order | Add request ids/sequence ids, ignore stale preview results, and make final transcript authoritative. |
| Preview text leaks into conversation history | Keep preview state outside `appendUserMessage` and assert no history commit until final send. |
| Mic remains active after error or route change | Centralize cleanup in a voice capture controller and test track stop behavior. |
| Electron grants microphone too broadly | Add permission request/check handlers scoped to the app renderer origin and media/microphone permission. |
| VAD records assistant TTS through speakers | Keep VAD disabled by default, block/queue during speaking as needed, and include no-headphones warning until Phase 22. |
| Phase 20 races Phase 19 API names | Every plan starts by inspecting actual Phase 19 outputs before editing and must adapt names instead of adding duplicate endpoints. |

## Recommended Plan Shape

- Plan 20-01: voice input contracts, Electron permission handling, runtime transcription bridge, and sidecar endpoint integration on top of Phase 19 STT readiness.
- Plan 20-02: renderer voice capture controller, PTT hotkey Settings integration, and mic permission/readiness state.
- Plan 20-03: Chat PTT UI, transcript preview, final submission through existing `text-input`, and one-pending-utterance queue.
- Plan 20-04: VAD auto-submit controls, conservative safety states, final regression, and UAT evidence.

## Verification Focus

- `VIN-01`: microphone permission and visible idle/listening/recording/finalizing/error state.
- `VIN-02`: hold-to-talk captures an utterance, preview updates transiently, and only final transcript submits.
- `VIN-03`: VAD auto-submit has sensitivity and silence-timeout controls.
- `VIN-04`: preview/finalizing/error states are visually distinct from submitted chat text.
- `VIN-05`: final text uses existing chat unchanged, no translation, preserving session/history semantics.
- `VIN-06`: speech captured while a turn is in progress queues safely and does not mutate active TTS/playback.

## Sources

- MDN `getUserMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN `MediaRecorder`: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- MDN `MediaRecorder.dataavailable`: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event
- MDN media constraints: https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints
- MDN `echoCancellation`: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation
- MDN AudioWorklet: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
- Electron `session` permission handlers: https://www.electronjs.org/docs/latest/api/session
