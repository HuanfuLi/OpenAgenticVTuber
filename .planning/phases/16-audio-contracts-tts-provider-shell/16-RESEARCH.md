# Phase 16 Research: Audio Contracts + TTS Provider Shell

**Phase:** 16 - Audio Contracts + TTS Provider Shell  
**Date:** 2026-05-09  
**Mode:** manual plan-phase research after user selected research first and no discuss context

## Scope

Phase 16 is the v3.0 foundation phase. It must not add GPT-SoVITS UX or STT providers yet. It must introduce stable audio-provider contracts, versioned audio configuration, provider health/failure semantics, and a Piper-backed TTS provider shell while preserving the existing ordered playback, renderer audio payloads, and VTS lipsync/RMS path.

Mapped requirements:

- `AUDIO-02`: versioned audio configuration does not break existing settings.
- `AUDIO-03`: clear provider health/error states.
- `AUDIO-04`: Piper remains fallback baseline with ordered sentence playback and VTS lipsync.
- `TTS-05`: provider output flows through existing playback/payload/RMS path.
- `PERF-03`: provider work does not block chat WS, compositor, HUD, or ordered queue.

## Current Implementation

### Piper Boot Path

- `sidecar/src/sidecar/ws/server.py` constructs `TTSGateway(model_path)` directly during FastAPI lifespan startup.
- `TTSGateway.boot()` loads `piper.PiperVoice`, warms ORT with synth-and-discard, opens a long-lived `sounddevice.OutputStream`, then exposes `.voice`, `.stream`, and `.sample_rate`.
- The active voice model comes from avatar overrides: `overrides.voice.model if overrides.voice else "en_US-amy-medium"`.
- Any exception in orchestrator construction sets `app.state.startup_error_message` to a TTS/Piper startup failure copy and leaves `app.state.orchestrator = None`.

### Ordered TTS Queue

- `TTSTaskManager.speak()` assigns a monotonic sequence number and starts synthesis in an async task.
- `_process_payload_queue()` buffers out-of-order synthesis results and sends/writes only when `_next_sequence_to_send` is available.
- Non-silent payload order is important:
  1. Put `SpeechEnvelopePayload` on compositor queue(s).
  2. Send `AudioPayloadMessage` over the chat WebSocket.
  3. Write PCM to `sounddevice.OutputStream` through `loop.run_in_executor`.
  4. Emit sentence-complete queue.
- `wait_for_all_audio_complete()` gathers synthesis tasks, joins the payload queue, then sleeps for stream latency so the renderer and input state do not advance before playback drains.
- Existing tests in `sidecar/tests/test_tts_manager.py` cover parallel synthesis, out-of-order buffering, queue/send/write order, silent payload behavior, extra speech queues, latency drain, and TTS log markers.

### Audio Payload + RMS Contracts

- `packages/contracts/py/contracts/audio_payload.py` owns the OLVT-shaped `AudioPayloadMessage`.
- `packages/contracts/py/contracts/speech_envelope.py` owns `SpeechEnvelopePayload`.
- `sidecar/src/sidecar/tts/audio_payload_helpers.py` performs Piper synthesis, builds WAV base64 for renderer playback, computes normalized RMS `volumes`, and returns raw int16 PCM for sidecar playback.
- `sidecar/tests/test_audio_payload_helpers.py` covers RMS chunking and real Piper payload generation when the model is present.
- Contract codegen is centralized in `packages/contracts/scripts/codegen.py`; new cross-language contracts must be added there and exported from `packages/contracts/py/contracts/__init__.py`.

### Configuration Persistence

- Electron main stores secret/provider setup in `apps/electron-main/src/safe-storage.ts`.
- Current `StoredConfig` is `schemaVersion: 1` with:
  - `provider` for LLM setup.
  - optional `plugin` for body-motion plugin/cursor-tracking settings.
  - `hasCompletedSetup`.
- `loadConfig()` returns `null` when the schema version is not exactly `1`; a naive schema bump would force re-setup and lose existing LLM/provider settings.
- `buildSidecarConfigEnv()` currently passes only LLM config to the sidecar as `AGENTICLLMVTUBER_LLM_CONFIG_JSON`.
- Phase 16 needs an additive migration path, likely `schemaVersion: 2`, that preserves v1 provider/plugin fields and adds an `audio` subtree. It should not require the sidecar to decrypt DPAPI blobs directly.

### Renderer/IPC Patterns

- Narrow renderer APIs live in `apps/electron-main/preload/index.ts` and IPC handlers in `apps/electron-main/src/ipc.ts`.
- Existing status/admin bridge patterns:
  - Electron main fetches sidecar admin endpoints using `getSidecarHttpUrl()`.
  - If the sidecar is unavailable, IPC returns typed unavailable responses instead of throwing.
- Settings currently has a truthful but static `TTSSection` in `apps/renderer/src/screens/Settings/Settings.tsx` that says Piper local TTS, `en_US-amy-medium`, system default, and RMS lipsync. Rich controls are Phase 18, but Phase 16 can add non-invasive diagnostics/admin plumbing for health.

## Key Design Implications

### Provider Boundary Placement

The safest seam is inside the Python sidecar, below `TTSTaskManager` and above Piper-specific synthesis:

- Keep `TTSTaskManager` as the ordered playback/payload queue owner.
- Replace direct Piper voice access with a `TTSProvider` interface returning provider-neutral synthesis output.
- Keep stream/write ownership abstract enough for future providers:
  - Phase 16 can keep the existing long-lived local output stream for Piper.
  - Future providers should still return PCM/WAV plus sample rate or enough data to enter the same payload/RMS path.

Do not move ordered delivery into each provider. That would duplicate the strongest existing invariant.

### Config Migration

Treat `StoredConfig` as app-level config, not just LLM setup:

- Add `schemaVersion: 2`.
- Preserve and migrate v1 `provider`, `plugin`, and `hasCompletedSetup` exactly.
- Add `audio.tts.activeProvider`, `audio.tts.piper.model`, timeout settings, and a minimal `audio.stt` placeholder only if useful for later phases.
- Expose default-building and migration helpers with unit tests.
- Sidecar receives audio config through a second one-shot env var such as `AGENTICLLMVTUBER_AUDIO_CONFIG_JSON`, or a combined v2 config env if the implementation keeps boundaries clean.

### Health Semantics

Phase 16 should define the health states before GPT-SoVITS exists:

- `ok`
- `unavailable`
- `missing_credential`
- `external_service_failure`
- `timeout`
- `misconfigured`

Piper will mostly use `ok`, `unavailable`, and `misconfigured`. The extra states are still useful in contracts so Phase 17/19 do not invent divergent vocabularies.

### Non-Blocking Requirement

The current stream write already runs in `run_in_executor`, but synthesis still executes inside async tasks and calls synchronous Piper synthesis directly. This means the event loop can still be blocked during CPU-bound synthesis if Piper inference does not yield. Phase 16 should move provider synthesis into `asyncio.to_thread()` or provider-owned executor work so chat WS/HUD/compositor loops remain responsive.

Regression tests should assert:

- `speak()` returns quickly while provider work is pending.
- Provider synthesis runs through the async boundary and does not block a scheduled sentinel coroutine.
- Failed provider synthesis produces an explicit error/silent typed outcome without wedging the payload queue.

## Risks

- **Breaking sentence order:** Refactoring `TTSTaskManager` is risky because ordering is a core user-visible invariant. Keep sequence buffering intact.
- **Silent fallback:** Future GPT-SoVITS failures must not silently switch providers mid-turn. Phase 16 should already model provider failures explicitly.
- **Schema bump lockout:** Returning `null` for `schemaVersion !== 1` is currently intentional. Phase 16 must migrate v1 instead of invalidating setup.
- **Health endpoint creep:** Health/test synthesis UI belongs later; Phase 16 should expose contracts/admin primitives and minimal diagnostics, not full settings UX.
- **Audio format drift:** Renderer expects `type: "audio"`, base64 WAV, `volumes`, `slice_length`, `sentence_id`, and dispatches. Keep this envelope stable.

## Recommended Plan Shape

1. **Config and contract foundation:** add provider health/config contracts, schema v2 migration, codegen, and Electron env handoff.
2. **Provider shell and Piper adapter:** introduce provider interfaces/result types, adapt Piper behind the shell, keep `TTSTaskManager` order/playback semantics.
3. **Health/failure/non-blocking hardening:** add sidecar admin health endpoint, explicit failure behavior, non-blocking tests, and focused regression evidence.

## Verification Baseline

Focused checks for Phase 16 execution should include:

```powershell
npm run check:contracts
npm --workspace apps/renderer run typecheck
npm --workspace apps/electron-main run build
python -m pytest sidecar/tests/test_tts_manager.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_audio_payload_helpers.py sidecar/tests/test_sidecar_boot.py -q
python -m pytest sidecar/tests/admin -q
```

The Phase 16 executor may narrow these during task development, but final verification must include ordered TTS manager tests and config migration tests.
