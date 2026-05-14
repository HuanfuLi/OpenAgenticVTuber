# Phase 20: Renderer Voice Capture + PTT/VAD Preview UX - Context

**Gathered:** 2026-05-10T00:10:17.2364891-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 20 adds renderer-owned microphone capture and Chat voice input UX. Users can use push-to-talk, optionally enable VAD auto-submit, see transient transcription preview/finalizing/error states, and submit final STT text through the existing chat pipeline unchanged.

This phase consumes Phase 19's STT provider readiness surface. It does not add STT providers, model cache/download behavior, cloud consent, translation, wake word, barge-in interruption, code-switch evaluation, or no-headphones/AEC claims.

</domain>

<decisions>
## Implementation Decisions

### PTT/VAD Activation Model
- **D-01:** Chat voice controls should be PTT-first. VAD is secondary and explicit, not the default primary interaction.
- **D-02:** PTT should support holding a mic button in Chat and a configurable keyboard shortcut.
- **D-03:** PTT shortcut configuration belongs in the Settings hotkey area, not inline beside the Chat input.
- **D-04:** The Chat mic control should remain visible but disabled when STT is not ready, with a setup link/path back to voice settings.
- **D-05:** Missing microphone permission should produce a browser/Electron permission request and a clear error state.

### Roadmap-Locked Voice Flow
- **D-06:** Transcription chunks are preview-only until finalization. Preview text must not be committed to conversation history.
- **D-07:** Only final STT text enters the existing chat pipeline, using the same `text-input` path as typed chat and preserving the active session/history semantics.
- **D-08:** Final STT text must be submitted unchanged. Do not translate, normalize conversation language, or rewrite mixed-language input in Phase 20.
- **D-09:** Speech captured while a turn is in progress must queue safely instead of corrupting active TTS/playback state. Do not implement barge-in cancellation in this phase.
- **D-10:** VAD defaults must be conservative until Phase 22 produces AEC/no-headphones evidence. Do not claim no-headphones support in Phase 20.

### the agent's Discretion
Downstream agents may choose exact component names, event names, IPC/admin route names, buffering thresholds, keyboard default, and UI layout details consistent with the decisions above and existing app patterns. Do not re-open roadmap-locked preview, final submission, no-translation, queueing, or AEC boundaries unless the roadmap changes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Scope
- `.planning/ROADMAP.md` - Phase 20 goal, dependencies, success criteria, and v3.0 exclusions.
- `.planning/REQUIREMENTS.md` - VIN-01 through VIN-06, CODE/AEC deferrals, and privacy/reliability boundaries.
- `.planning/STATE.md` - current v3.0 state, accumulated audio/STT decisions, and known concerns.
- `PROJECT_DESIGN.md` - original voice input decisions: both PTT and VAD, raw VAD/no wake word, medium default sensitivity, and interruption as future scope constrained by current roadmap.

### Prior Phase Context
- `.planning/phases/19-stt-provider-abstraction-local-cloud-providers/19-CONTEXT.md` - STT readiness, provider enablement, test transcription, lazy-load, cache, and cloud guardrails that Phase 20 must consume.
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-CONTEXT.md` - provider failure, no silent fallback, concise status, and diagnostics/log routing patterns.

### Existing Code
- `apps/renderer/src/screens/Chat/Chat.tsx` - current chat input, disabled-turn behavior, message rendering, banners, and text-input send path.
- `apps/renderer/src/ws/client.ts` - renderer WebSocket send/connection surface used by existing typed chat.
- `apps/renderer/src/ws/store.ts` - WebSocket dispatcher, turn-in-flight state, speaking state, audio payload handling, and conversation turn commit hook.
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` - streaming message reducer and input-disabled/speaking state helpers.
- `apps/renderer/src/state/conversation-history.tsx` - active session and committed-turn persistence semantics.
- `apps/renderer/src/screens/Settings/Settings.tsx` - existing settings section patterns and future hotkey/voice setting integration point.
- `apps/electron-main/preload/index.ts` - renderer-safe API bridge for future microphone/STT controls if Electron main mediation is needed.
- `apps/electron-main/src/ipc.ts` - IPC/admin proxy pattern for sidecar audio actions.
- `packages/contracts/py/contracts/ws_message.py` - current `text-input` WebSocket contract that final STT text should reuse.
- `packages/contracts/py/contracts/audio_provider.py` - STT config/provider id baseline from earlier audio contracts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Chat.tsx`: already centralizes typed input submission, disabled state, turn-in-flight behavior, banners, and active conversation history handoff.
- `send()` in `apps/renderer/src/ws/client.ts`: final STT text can use the same WebSocket message shape as typed chat.
- `useStreamingMessages` / `ws/store.ts`: existing `turnInFlight`, `isSpeaking`, and `conversation-chain-end` handling can guide voice queue state and prevent playback corruption.
- `Settings.tsx`: existing long-scroll Settings structure is the right home for PTT hotkey configuration and links from disabled Chat voice controls.

### Established Patterns
- Final user turns are appended locally, sent as `text-input`, and committed to conversation history only after assistant completion. Voice final submission should preserve this.
- Renderer user-facing copy lives in `apps/renderer/src/lib/copy.ts`; new mic/listening/finalizing/error labels should follow that pattern.
- Cross-process actions use explicit preload APIs and Electron IPC/admin proxy methods rather than direct renderer filesystem or Node access.
- Provider health and readiness are explicit; Phase 20 should not silently fall back to another STT provider or bypass Phase 19 readiness.

### Integration Points
- Chat input row gains mic/PTT affordance, transient transcript preview, and listening/finalizing/error states.
- Settings gains or reuses a hotkey area for configurable PTT shortcut.
- Renderer capture should hand audio/transcription requests to the Phase 19 STT surface and submit only the final transcript through existing chat.
- Queueing must coordinate with existing turn-in-flight/speaking state so recorded speech does not mutate active TTS/playback state.

</code_context>

<specifics>
## Specific Ideas

- Keep Chat voice affordance visible even when disabled, so users can discover why setup is incomplete.
- Treat VAD as an explicit opt-in control with conservative defaults; avoid making always-listening feel like the default mode.
- The user explicitly corrected the discussion flow to avoid re-asking questions already covered by roadmap/context. Downstream agents should treat roadmap-locked Phase 20 behavior as settled.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 20-Renderer Voice Capture + PTT/VAD Preview UX*
*Context gathered: 2026-05-10T00:10:17.2364891-04:00*
