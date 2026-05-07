---
phase: 03-tts-sentence-buffered-audio
verified: 2026-05-07T05:32:13Z
status: gaps_found
score: 2/5 must-haves verified
gaps:
  - truth: "Phase 3 requirement coverage includes actual RMS-driven lipsync into ParamMouthOpenY"
    status: failed
    reason: "The code exposes real RMS envelopes and timing data, but nothing in apps/ or sidecar/ writes ParamMouthOpenY yet. Global search only finds ParamMouthOpenY in docs, avatar metadata, and capability schemas."
    artifacts:
      - path: "sidecar/src/sidecar/tts/tts_manager.py"
        issue: "Publishes SpeechEnvelopePayload to compositor_speech_queue, but stops at queue publication."
      - path: "sidecar/src/sidecar/ws/server.py"
        issue: "Queue is drained by a no-op logger task (_drain_speech_queue_until_phase4), not by a speech driver."
      - path: "sidecar/src/sidecar/orchestrator/orchestrator.py"
        issue: "Owns compositor_speech_queue but has no downstream ParamMouthOpenY consumer."
    missing:
      - "A real speech-driver consumer that reads SpeechEnvelopePayload and drives ParamMouthOpenY from the RMS envelope."
      - "A wired path from the queue/gateway timing contract into the VTS parameter write layer."
---

# Phase 03: tts-sentence-buffered-audio Verification Report

**Phase Goal:** The avatar's reply is spoken with sentence-buffered parallel synth + ordered playback (the OLVT pattern). The first sentence plays while the second is still synthesizing. The TTS gateway exposes a real RMS envelope tap that Phase 4's speech driver will consume -- no stub.
**Verified:** 2026-05-07T05:32:13Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Typing a multi-sentence prompt produces audible TTS output for each sentence in correct order | ? UNCERTAIN | Code is wired for it: `TTSGateway.boot()` opens a real `sounddevice.OutputStream`, `TTSTaskManager` writes ordered PCM to that stream, and tests prove sentence ordering. Live audible output was not exercised in this verification run. |
| 2 | Logs prove parallel synth: sentence N playback can start while sentence N+1 synthesis is still running | ✓ VERIFIED | `sidecar/tests/test_tts_manager.py` verifies `speak()` returns immediately, synth tasks overlap, ordered sender buffering holds, and `[TTS-SYNTH-*]` / `[TTS-WRITE-*]` markers are emitted. |
| 3 | First-reply latency after launch is comparable to later replies because warmup ran at boot | ? UNCERTAIN | `sidecar/src/sidecar/tts/tts_gateway.py` loads Piper, runs synth-and-discard warmup on `"."`, then opens the stream before `[READY]`. No live latency comparison was run here. |
| 4 | First sentence audio starts cleanly with no click/pop | ? UNCERTAIN | Sample rate is pinned from `voice.config.sample_rate` and the output stream is pre-opened, but audible click/pop quality cannot be verified programmatically in this environment. |
| 5 | A real RMS envelope tap is exposed for downstream consumption with no stub data | ✓ VERIFIED | `synthesize_and_prepare_payload()` computes real RMS chunks from Piper PCM, `TTSTaskManager` publishes `SpeechEnvelopePayload(sentence_id, volumes, slice_length, started_at)` to `compositor_speech_queue`, and the no-op drainer logs `[SPEECH-ENV]` rather than fabricating data. |

**Score:** 2/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/contracts/py/contracts/speech_envelope.py` | Pydantic speech-envelope contract | ✓ VERIFIED | Exists, exported via `contracts.__init__`, 21 lines, fields match the phase contract. |
| `packages/contracts/ts/speech-envelope.ts` | TS mirror of speech envelope | ✓ VERIFIED | Exists and mirrors the 4 Python fields. |
| `sidecar/src/sidecar/tts/audio_payload_helpers.py` | Single-pass synth helper + RMS chunking | ✓ VERIFIED | Real PCM -> RMS -> base64 WAV path is implemented with no temp files or second synth pass. |
| `sidecar/src/sidecar/tts/tts_gateway.py` | Piper boot/warmup/output-stream lifecycle | ✓ VERIFIED | Loads `PiperVoice`, warms on `"."`, starts one long-lived `OutputStream`, and shuts it down idempotently. |
| `sidecar/src/sidecar/tts/tts_manager.py` | Parallel synth + ordered playback sender | ✓ VERIFIED | Concurrent synth tasks feed a sequence-buffered sender; sender publishes queue -> WS -> stream write in locked order. |
| `sidecar/src/sidecar/orchestrator/orchestrator.py` | Pending-input FIFO + post-drain turn completion | ✓ VERIFIED | Owns `pending_inputs`, `compositor_speech_queue`, and waits for `wait_for_all_audio_complete()` before `force-new-message` / `chain-end`. |
| `sidecar/src/sidecar/ws/server.py` | TTS startup before ready + phase-4 handoff queue | ✓ VERIFIED | Builds `TTSGateway` before `[READY]`, starts no-op speech-envelope drain task, starts `_turn_loop`, and shuts down the gateway on lifespan exit. |
| `sidecar/src/sidecar/ws/handlers.py` | Enqueue text-inputs instead of awaiting turns inline | ✓ VERIFIED | `handle_text_input()` binds the active websocket and enqueues into `pending_inputs`. |
| `apps/renderer/src/screens/Chat/useStreamingMessages.ts` | Speaking state | ✓ VERIFIED | `isSpeaking` state and hook exist and are reset on chain-end/error. |
| `apps/renderer/src/screens/Chat/Chat.tsx` | Distinct speaking affordance | ✓ VERIFIED | Renders `COPY.CHAT.SPEAKING` under the input row while `isSpeaking` is true. |
| `sidecar/tests/test_tts_gateway.py` | Gateway guard/warmup coverage | ⚠️ PARTIAL | Behavior is covered, but the plan-declared `_guard_lfs_pointer` pattern is not present literally in the test file. This is not goal-blocking. |
| `sidecar/models/piper/en_US-amy-medium.onnx` | Real bundled Piper model | ✓ VERIFIED | `git lfs ls-files` lists the model; on-disk size is `63201294` bytes and the file head is binary, not an LFS pointer. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `tts_gateway.py` | `piper.PiperVoice` | `PiperVoice.load(model_path)` | ✓ WIRED | `boot()` loads the ONNX model and reads `voice.config.sample_rate`. |
| `tts_gateway.py` | `sounddevice.OutputStream` | `OutputStream(...).start()` / shutdown stop+close | ✓ WIRED | Stream is created once, started at boot, stopped and closed on shutdown. |
| `audio_payload_helpers.py` | `AudioPayloadMessage` | `synthesize_and_prepare_payload()` | ✓ WIRED | The helper returns a fully populated `AudioPayloadMessage` plus PCM bytes and sample rate. |
| `tts_manager.py` | `audio_payload_helpers.py` | `_synthesize_payload()` -> `synthesize_and_prepare_payload()` | ✓ WIRED | Non-silent paths require a real Piper voice and call the helper. |
| `tts_manager.py` | `compositor_speech_queue` | `SpeechEnvelopePayload` publication | ✓ WIRED | Queue publication happens before WS send and before `stream.write()`. |
| `orchestrator.py` | `tts_manager.py` | `_emit_sentence()` + `wait_for_all_audio_complete()` | ✓ WIRED | Each sentence is handed to `tts_manager.speak()`, and turn finalization waits for audio drain. |
| `handlers.py` | `orchestrator.pending_inputs` | `pending_inputs.put(text)` | ✓ WIRED | Text-input handling no longer awaits `orchestrator.turn()` directly. |
| `server.py` | `TTSGateway` | lifespan boot/shutdown | ✓ WIRED | Startup builds and boots the gateway before `[READY]`; shutdown calls `tts_gateway.shutdown()`. |
| `apps/renderer/src/ws/store.ts` | `useStreamingMessages.ts` | `setSpeaking(true/false)` on audio/control/error | ✓ WIRED | First audio envelope sets speaking true; chain-end and error clear it. |
| `SpeechEnvelopePayload` path | `ParamMouthOpenY` driver | speech-envelope consumer | ✗ NOT WIRED | No runtime consumer writes VTS mouth params yet; the queue is drained by a logger task only. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/tts/audio_payload_helpers.py` | `volumes` | `voice.synthesize(tts_text)` -> concatenated `audio_int16_bytes` -> `get_volume_by_chunks()` | Yes | ✓ FLOWING |
| `sidecar/src/sidecar/tts/tts_manager.py` | `SpeechEnvelopePayload.started_at` | `self._stream.time + self._stream.latency` captured at write start | Yes | ✓ FLOWING |
| `sidecar/src/sidecar/tts/tts_manager.py` | `SpeechEnvelopePayload.volumes` | `payload.volumes` from `synthesize_and_prepare_payload()` | Yes | ✓ FLOWING |
| `apps/renderer/src/screens/Chat/Chat.tsx` | `isSpeaking` | WS dispatcher toggles from `audio`, `conversation-chain-start`, `conversation-chain-end`, and `error` | Yes | ✓ FLOWING |
| `sidecar/src/sidecar/ws/server.py` | phase-4 speech-envelope consumption | `_drain_speech_queue_until_phase4()` logger task | No downstream param writer | ⚠️ HOLLOW |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Model is present as a real LFS-tracked asset | `git lfs ls-files` | `b3a6e47b57 * sidecar/models/piper/en_US-amy-medium.onnx` | ✓ PASS |
| Model file is not an LFS pointer | PowerShell file-length + first-64-bytes check | Size `63201294`; binary header, not `version https://git-lfs...` | ✓ PASS |
| Sidecar tests for the phase still pass | `uv run pytest -x -v` | Pre-run by orchestrator: `71 passed, 2 skipped` | ✓ PASS |
| Renderer typecheck still passes | `npx tsc --noEmit` | Pre-run by orchestrator: passed | ✓ PASS |
| Renderer tests still pass | `npm test` | Pre-run by orchestrator: `18 passed` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `TTS-01` | `03-01-PLAN.md` | piper-only backend with launch warmup synth | ✓ SATISFIED | `TTSGateway.boot()` loads `PiperVoice`, warms on `"."`, and starts the stream before ready. `sidecar/pyproject.toml` pins `piper-tts==1.4.2` and `sounddevice==0.5.5`. |
| `TTS-02` | `03-02-PLAN.md` | sentence-buffered parallel synth + ordered playback | ✓ SATISFIED | `TTSTaskManager.speak()` spawns per-sentence tasks, sender buffers by sequence, and tests verify overlap plus ordered writes. |
| `TTS-03` | `03-01-PLAN.md` | RMS feature tap for the speech driver | ✓ SATISFIED | Real RMS envelope is computed from Piper PCM and published via `SpeechEnvelopePayload` on `compositor_speech_queue`. |
| `TTS-04` | `03-01-PLAN.md` | lipsync drives `ParamMouthOpenY` from our RMS path | ✗ BLOCKED | No code in `apps/` or `sidecar/` writes `ParamMouthOpenY`; current queue consumer is a debug logger only. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/ws/server.py` | 37 | `TODO Phase 5 / electron-main side: add the env-var write to the spawn path.` | ℹ️ Info | Pre-existing cross-phase TODO, unrelated to Phase 3 goal verification. |
| `sidecar/src/sidecar/ws/server.py` | 84-98 | No-op speech-envelope drainer | ⚠️ Warning | Confirms the queue handoff exists but also confirms there is no live mouth/speech-driver consumer yet. |

### Human Verification Still Needed

### 1. Multi-Sentence Audible Playback

**Test:** Run the app with LM Studio configured, send `Tell me a 3-sentence story.`, and listen for three sentences spoken in order.
**Expected:** All three sentences are audible and ordered; the first starts before the second finishes synthesizing.
**Why human:** This requires a live audio device and audible confirmation.

### 2. Warmup Latency Comparison

**Test:** After fresh launch, send one short prompt, then send the same prompt again and compare first-audio onset using the `[TTS-INIT]`, `[TTS-WRITE-START]`, and wall-clock timing.
**Expected:** First reply is not materially colder than later replies because warmup ran at startup.
**Why human:** The code has the warmup path, but the latency comparison is runtime/environment specific.

### 3. Click/Pop Check

**Test:** Listen to the very start of the first spoken sentence after launch.
**Expected:** No audible click/pop at sentence start.
**Why human:** Audio quality cannot be established from static code or unit tests.

## Gaps Summary

Phase 3 substantially delivers the TTS pipeline itself: Piper is booted and warmed before ready, sentence synth work is parallelized, playback ordering is enforced, and the RMS envelope is real data flowing through an in-process contract. The missing piece is requirement alignment: the current codebase does not yet drive `ParamMouthOpenY` from that RMS data.

That missing consumer is not a documentation nit. The queue currently terminates in `_drain_speech_queue_until_phase4()` inside `sidecar/src/sidecar/ws/server.py`, which only logs `[SPEECH-ENV]`. As a result, `TTS-04` is still unmet in the actual codebase, and the phase cannot be marked passed even though most of the Phase 3 infrastructure is in place.

---

_Verified: 2026-05-07T05:32:13Z_  
_Verifier: Claude (gsd-verifier)_
