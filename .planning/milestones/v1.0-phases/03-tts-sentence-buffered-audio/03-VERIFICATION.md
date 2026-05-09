---
phase: 03-tts-sentence-buffered-audio
verified: 2026-05-07T08:24:52Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "Phase 3 requirement coverage includes actual RMS-driven lipsync into ParamMouthOpenY"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Multi-sentence audible playback"
    expected: "Three sentences are spoken in order, and sentence 1 begins playing while sentence 2 is still synthesizing."
    why_human: "Requires a live audio device and listening confirmation."
  - test: "Warmup latency check"
    expected: "After a fresh launch, first-audio onset on the first reply is materially similar to later replies because Piper warmup already ran before ready."
    why_human: "Cold-start latency depends on the real host audio/device/runtime environment."
  - test: "Clean audio start and live mouth motion"
    expected: "The first sentence starts without click/pop, and the avatar mouth opens and closes in sync with speech instead of remaining stuck."
    why_human: "Audio quality and visible VTube Studio parameter motion require a live runtime."
---

# Phase 03: tts-sentence-buffered-audio Verification Report

**Phase Goal:** The avatar's reply is spoken with sentence-buffered parallel synth + ordered playback (the OLVT pattern). The first sentence plays while the second is still synthesizing. The TTS gateway exposes a real RMS envelope tap that Phase 4's speech driver will consume -- no stub.
**Verified:** 2026-05-07T08:24:52Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Typing a multi-sentence prompt produces audible TTS output for each sentence in correct order | ? HUMAN | Runtime path is wired end to end: `TTSGateway.boot()` opens the real stream before ready, `TTSTaskManager` sends ordered PCM to `stream.write()`, and the server boots the orchestrator + TTS stack before `[READY]` in [server.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/ws/server.py:151). |
| 2 | Logs prove parallel synth: sentence N playback can start while sentence N+1 synthesis is still running | ✓ VERIFIED | `TTSTaskManager` logs `[TTS-SYNTH-*]`, `[TTS-WRITE-*]`, and captures write-start before queue/send/write ordering in [tts_manager.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/tts/tts_manager.py:181). Targeted pytest passed: `30 passed` on 2026-05-07. |
| 3 | First-reply latency after launch is comparable to later replies because warmup ran at boot | ? HUMAN | The code still performs startup warmup before ready: `tts_gateway.boot()` then `_warmup_ping(gateway)` before orchestrator ready in [server.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/ws/server.py:151). Live timing comparison still requires runtime measurement. |
| 4 | First sentence audio starts cleanly with no click/pop | ? HUMAN | Stream boot and sample-rate pinning remain in the runtime path, but audible quality is not statically verifiable. |
| 5 | A real RMS envelope tap is exposed and consumed by a real ParamMouthOpenY runtime path with no logger stub | ✓ VERIFIED | `TTSTaskManager` publishes `SpeechEnvelopePayload(started_at=stream.time+latency, volumes, slice_length)` to `compositor_speech_queue` in [tts_manager.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/tts/tts_manager.py:188). `server.py` now installs `SpeechMouthDriver.consume_forever(...)` instead of the old logger path in [server.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/ws/server.py:174). `SpeechMouthDriver` interpolates envelope values and writes `ParamMouthOpenY` through the writer seam in [speech_mouth_driver.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/speech_mouth_driver.py:36) and [parameter_writer.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/parameter_writer.py:45). |

**Score:** 5/5 truths verified for automated/static goal checks; 3 live-runtime checks remain human-only

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/contracts/py/contracts/speech_envelope.py` | Speech-envelope contract | ✓ VERIFIED | Still present and still matches the runtime queue payload consumed downstream. |
| `sidecar/src/sidecar/tts/tts_manager.py` | Ordered sender publishes real envelopes with playback-clock timing | ✓ VERIFIED | `started_at` is captured from `stream.time + stream.latency` and queue publication precedes WS send and stream write in [tts_manager.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/tts/tts_manager.py:182). |
| `sidecar/src/sidecar/vts/parameter_writer.py` | Concrete parameter-writer seam | ✓ VERIFIED | `PyVTSParameterWriter` builds vendored `pyvts` requests and `LoggingParameterWriter` preserves degraded behavior in [parameter_writer.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/parameter_writer.py:24). |
| `sidecar/src/sidecar/vts/speech_mouth_driver.py` | Queue consumer that converts envelopes into mouth writes | ✓ VERIFIED | `consume_forever()` drains the queue and `drive_envelope()` interpolates RMS values, clamps them, and ends with a `0.0` close in [speech_mouth_driver.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/speech_mouth_driver.py:26). |
| `sidecar/src/sidecar/ws/server.py` | Lifespan wiring replaces no-op speech drain with mouth driver | ✓ VERIFIED | Imports `SpeechMouthDriver`, chooses `PyVTSParameterWriter` vs `LoggingParameterWriter`, and starts `mouth_driver.consume_forever(compositor_speech_queue)` in [server.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/ws/server.py:95). |
| `sidecar/tests/test_speech_mouth_driver.py` | Proof of envelope-driven `ParamMouthOpenY` writes | ✓ VERIFIED | Tests cover interpolation, empty envelopes, final close, request shape, and queue consumption in [test_speech_mouth_driver.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/tests/test_speech_mouth_driver.py:48). |
| `apps/renderer/src/ws/store.ts` | Speaking-state reducer wiring | ✓ VERIFIED | Audio envelopes set speaking true; chain-end and errors clear it in [store.ts](/C:/Users/16079/Code/AgenticLLMVTuber/apps/renderer/src/ws/store.ts:46). |
| `apps/renderer/src/screens/Chat/Chat.tsx` | Distinct speaking affordance | ✓ VERIFIED | Chat renders `COPY.CHAT.SPEAKING` while `isSpeaking` is true in [Chat.tsx](/C:/Users/16079/Code/AgenticLLMVTuber/apps/renderer/src/screens/Chat/Chat.tsx:224). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `tts_manager.py` | `SpeechMouthDriver` | `compositor_speech_queue` carrying `SpeechEnvelopePayload` | ✓ WIRED | `TTSTaskManager` publishes real envelopes in [tts_manager.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/tts/tts_manager.py:188); `server.py` gives the same queue to `mouth_driver.consume_forever(...)` in [server.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/ws/server.py:178). |
| `speech_mouth_driver.py` | `parameter_writer.py` | `write_parameter('ParamMouthOpenY', ...)` on each tick plus final `0.0` close | ✓ WIRED | `_write_mouth()` always routes through the writer seam in [speech_mouth_driver.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/speech_mouth_driver.py:60). |
| `parameter_writer.py` | vendored `pyvts` request builder | `requestSetParameterValue(...)->InjectParameterDataRequest` | ✓ WIRED | `PyVTSParameterWriter.write_parameter()` uses the vendored request builder in [parameter_writer.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/parameter_writer.py:54). |
| `server.py` | playback clock contract | `_playback_now(stream) -> stream.time + stream.latency` | ✓ WIRED | The mouth driver uses the same playback time base as the TTS sender in [server.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/ws/server.py:91). |
| `apps/renderer/src/ws/store.ts` | `Chat.tsx` speaking label | `setSpeaking(true/false)` -> `useSpeaking()` | ✓ WIRED | WS reducer and chat hook remain connected across the speaking UX path in [store.ts](/C:/Users/16079/Code/AgenticLLMVTuber/apps/renderer/src/ws/store.ts:64) and [Chat.tsx](/C:/Users/16079/Code/AgenticLLMVTuber/apps/renderer/src/screens/Chat/Chat.tsx:29). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/tts/audio_payload_helpers.py` | `volumes` | Real Piper PCM synthesized from sentence text | Yes | ✓ FLOWING |
| `sidecar/src/sidecar/tts/tts_manager.py` | `started_at`, `volumes`, `slice_length` on `SpeechEnvelopePayload` | Real output stream clock plus real RMS envelope | Yes | ✓ FLOWING |
| `sidecar/src/sidecar/ws/server.py` | `mouth_driver.now` | `_playback_now(tts_gateway.stream)` | Yes | ✓ FLOWING |
| `sidecar/src/sidecar/vts/speech_mouth_driver.py` | Interpolated mouth value | `elapsed_ms` against `envelope.started_at` and `envelope.volumes[]` | Yes | ✓ FLOWING |
| `sidecar/src/sidecar/vts/parameter_writer.py` | `InjectParameterDataRequest.parameterValues[0]` | `write_parameter("ParamMouthOpenY", value, ...)` | Yes | ✓ FLOWING |
| `apps/renderer/src/screens/Chat/Chat.tsx` | `isSpeaking` | WS reducer transitions on chain-start, audio, chain-end, error | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 03 gap-closure tests pass | `cd sidecar && uv run pytest tests/test_speech_mouth_driver.py tests/test_orchestrator_turn.py -x -v` | `30 passed in 2.01s` on 2026-05-07 | ✓ PASS |
| Gap-closure artifacts are substantive | `gsd-tools verify artifacts .planning/phases/03-tts-sentence-buffered-audio/03-03-PLAN.md` | `4/4 passed` | ✓ PASS |
| Gap-closure key links are wired | `gsd-tools verify key-links .planning/phases/03-tts-sentence-buffered-audio/03-03-PLAN.md` | `3/3 verified` | ✓ PASS |
| Playback clock helper matches sender contract | `uv run python -c "from sidecar.ws.server import _playback_now; ..."` | Sandbox blocked `uv` cache; static test `test_playback_now_uses_stream_time_plus_latency` passed under pytest | ✓ PASS |
| Full sidecar regression suite | `uv run pytest -x -v` | Orchestrator pre-run reported `80 passed, 2 skipped` | ✓ PASS |
| Renderer regression checks | `npx tsc --noEmit` and `npm test` | Orchestrator pre-run reported typecheck passed and `18 passed` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| `TTS-01` | `03-01-PLAN.md` | Piper-only backend with launch warmup synth | ✓ SATISFIED | `server.py` still boots `TTSGateway` before ready in [server.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/ws/server.py:151), and no alternate TTS backend was introduced in the gap closure. |
| `TTS-02` | `03-02-PLAN.md` | Sentence-buffered parallel synth plus ordered playback | ✓ SATISFIED | `TTSTaskManager` still buffers by sequence and preserves queue -> WS -> stream order in [tts_manager.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/tts/tts_manager.py:168). Targeted pytest passed. |
| `TTS-03` | `03-01-PLAN.md` | RMS feature tap exposed for speech-driver consumption | ✓ SATISFIED | Real RMS volumes still originate from synthesized audio and are emitted as `SpeechEnvelopePayload` in [tts_manager.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/tts/tts_manager.py:188). |
| `TTS-04` | `03-01-PLAN.md`, `03-03-PLAN.md` | Lipsync drives `ParamMouthOpenY` from our RMS path | ✓ SATISFIED | `SpeechMouthDriver` now consumes the queue and writes `ParamMouthOpenY` through the writer seam in [speech_mouth_driver.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/speech_mouth_driver.py:62) and [parameter_writer.py](/C:/Users/16079/Code/AgenticLLMVTuber/sidecar/src/sidecar/vts/parameter_writer.py:54). |

No orphaned Phase 03 requirements were found in `.planning/REQUIREMENTS.md`; the phase maps exactly to `TTS-01` through `TTS-04`, and those IDs are all claimed by the Phase 03 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/ws/server.py` | 38 | `TODO Phase 5 / electron-main side: add the env-var write to the spawn path.` | ℹ️ Info | Pre-existing cross-phase TODO; unrelated to Phase 03 TTS goal and not on the mouth-driver path. |

### Human Verification Required

### 1. Multi-Sentence Audible Playback

**Test:** Launch the full app with LM Studio and VTube Studio running, send `Tell me a 3-sentence story.`  
**Expected:** Three sentences are spoken in order, and sentence 1 audibly starts before sentence 2 finishes synthesizing.  
**Why human:** Requires a live audio device and listening confirmation.

### 2. Warmup Latency Comparison

**Test:** After a fresh launch, send a short prompt twice and compare first-audio onset using the `[TTS-INIT]`, `[TTS-WRITE-START]`, and wall-clock timing.  
**Expected:** The first reply is not materially colder than the second because the warmup path already executed before `[READY]`.  
**Why human:** Latency depends on the real machine, audio device, and runtime state.

### 3. Live Mouth Motion and Audio Quality

**Test:** With VTube Studio connected, watch the avatar while the sidecar speaks a sentence and listen to the first ~200 ms of playback.  
**Expected:** `ParamMouthOpenY` visibly opens and closes with speech and returns closed at the end; no audible click/pop at sentence start.  
**Why human:** Visible VTS motion and audio quality are not programmatically verifiable in this environment.

## Gaps Summary

The previous blocker is closed. `SpeechEnvelopePayload` no longer terminates in a logger; it now flows from the TTS sender into a real `SpeechMouthDriver`, which interpolates the RMS envelope and writes `ParamMouthOpenY` through a concrete writer seam. Targeted Phase 03 pytest coverage passed, and the requirements map for `TTS-01` through `TTS-04` is fully satisfied in code.

The only remaining verification debt is live runtime confirmation: audible ordered playback, first-reply warmup behavior on the actual host, and visible VTube Studio mouth motion without click/pop. Those are legitimate human checks, so the phase should not remain `gaps_found`, but it also should not be marked fully `passed` until those runtime observations are made.

---

_Verified: 2026-05-07T08:24:52Z_  
_Verifier: Claude (gsd-verifier)_
