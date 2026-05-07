# Phase 3: TTS & Sentence-Buffered Audio — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 03-tts-sentence-buffered-audio
**Areas discussed:** Audio playback architecture, RMS feature tap shape, Warmup synth strategy, Cancel-in-flight TTS + voice-model packaging

---

## Gray-area selection

**Question:** Phase 3 (TTS & Sentence-Buffered Audio) — which areas do you want to discuss?

| Option | Description | Selected |
|--------|-------------|----------|
| Audio playback architecture | Sidecar (sounddevice, matches SC #4) vs renderer (Web Audio, matches the audio_b64 envelope flow). Most consequential decision. | ✓ |
| RMS tap shape (Phase 4 contract) | Per-sentence pre-computed float[] at 20ms chunks (OLVT volumes pattern) vs streaming/realtime; in-process pub-sub vs sync API. | ✓ |
| Warmup synth strategy | What gets warmed (piper-model load, sounddevice OutputStream, end-to-end synth+play) and when (boot vs after LLM-setup vs first message). | ✓ |
| Cancel-in-flight TTS + voice-model packaging | (1) Hard-stop vs let-finish vs skeleton-ignore on mid-playback input; (2) voice model bundled vs download-on-first-run vs manual placement. | ✓ |

**User's choice:** All four areas selected.

---

## Area A — Audio playback architecture

### Round 1 (initial)

| Option | Description | Selected |
|--------|-------------|----------|
| Sidecar (sounddevice) — recommended | Sidecar plays via Python sounddevice OutputStream, RMS lives in-process for compositor. Matches SC #4 wording. AVT-01 invariant clean. ~100-150 LOC of Python audio code we wouldn't write in pure-OLVT-port. | |
| Renderer (Web Audio, OLVT verbatim) | Maximum OLVT port verbatim. Cost: violates AVT-01 spirit — lipsync ParamFrame writes flow renderer→sidecar→VTS (extra hop). | |
| Hybrid: renderer plays, sidecar tracks timing | Single playback-started ack per sentence, sidecar advances locally. Cost: lipsync visibly off if Web Audio jitters. | |

**User's choice:** "I don't know which is better. Please analyze deeper."
**Notes:** User asked for deeper analysis before committing.

### Round 2 (after deeper analysis)

Claude found the load-bearing detail by reading OLVT's `use-audio-task.ts`: OLVT ships `volumes[]` in the envelope but **does NOT use it for lipsync** — it hands the audio data URL to Cubism's `_wavFileHandler`, which computes RMS internally from PCM. Our project uses VTS API (no Cubism in renderer), so `volumes[]` IS load-bearing for us in a way it isn't for OLVT — we must inject `ParamMouthOpenY` ourselves via the compositor.

This shifted the analysis toward sidecar-side playback because the lipsync tightness depends on tight RMS-to-paramframe sync, which is trivial in sidecar-side and lossy in renderer-side.

| Option | Description | Selected |
|--------|-------------|----------|
| Sidecar (sounddevice) — recommended | Compositor reads RMS from in-process source, perfect lipsync sync, AVT-01 invariant clean, SC #4 wording matches. Envelope keeps audio_b64+volumes per Phase 2 lock for §14 SC #6 protocol parity — renderer ignores in skeleton, monitoring/recording lands into existing slots in v2. | ✓ |
| Renderer (Web Audio) — OLVT verbatim | Maximum OLVT port. Cost: needs renderer→sidecar position acks at 60 Hz for compositor lipsync sync (the same cascade AVT-01 frames against). | |
| Hybrid (renderer plays, sidecar estimates timing) | Renderer plays audio. Sidecar's compositor runs against an estimated playback timeline. Cost: lipsync visibly off if Web Audio jitters. | |

**User's choice:** Sidecar (sounddevice) — recommended.
**Notes:** Decided after Claude's deeper analysis showed: (1) lipsync precision tight in sidecar, lossy in renderer; (2) AVT-01 invariant cleanly preserved; (3) SC #4 wording matches verbatim; (4) OLVT's `volumes[]` field isn't actually used by OLVT for lipsync, so "OLVT-verbatim" loses some weight here. WS envelope still ships `audio` + `volumes` for §14 SC #6 protocol parity.

---

## Area B — RMS feature tap shape

### Question 1 — How does the compositor consume per-sentence amplitude?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-computed volumes[] + interp | Sidecar synthesizes WAV → computes volumes[] per 20ms chunk at synth time → publishes SpeechEnvelopePayload to compositor_speech_queue at audio-stream-write time. Compositor interpolates linearly between volumes[i]/volumes[i+1] at 60Hz. OLVT envelope shape unchanged. | ✓ |
| Streaming PCM tap (per-frame) | Compositor pulls live PCM samples from a sounddevice ringbuffer every 16.67ms and computes RMS per frame. 60Hz native, no interp, more complex. | |
| Pre-computed volumes[], no interp | Same as Recommended but compositor uses nearest-neighbor lookup. Slightly choppier mouth motion at sentence transitions; trivially less code. | |

**User's choice:** Pre-computed volumes[] + interp.

### Question 2 — How does the compositor's speech driver SUBSCRIBE?

| Option | Description | Selected |
|--------|-------------|----------|
| asyncio.Queue (pub-sub) | Mirrors Phase 2 D-11 (compositor_intent_queue pattern). New compositor_speech_queue: asyncio.Queue. Phase 4's speech driver awaits messages. Phase 3 ships a no-op consumer drain so the queue doesn't unbound-grow. | ✓ |
| Sync API (function call) | Speech driver calls tts_gateway.get_current_envelope() each frame. Synchronous; matches SC #5 wording verbatim. | |
| Both — queue for events, sync for current state | More API surface; matches SC #5 verbatim while keeping pub-sub for new-sentence transitions. | |

**User's choice:** asyncio.Queue (pub-sub).

---

## Area C — Warmup synth strategy

### Question 1 — When does the warmup synth fire?

| Option | Description | Selected |
|--------|-------------|----------|
| Sidecar boot, BEFORE [READY] | Warmup runs synchronously during sidecar startup; [READY] emits only after warmup completes. Boot is ~500ms slower. SC #3 is provably true. | ✓ |
| Sidecar boot, AFTER [READY] (background) | Sidecar emits [READY] as soon as uvicorn is listening; warmup runs as a background task. First text-input handler awaits warmup completion. | |
| After LLM-setup completes | Warmup fires the first time hasCompletedSetup goes true. Cost: defeats SC #3. | |

**User's choice:** Sidecar boot, BEFORE [READY].

### Question 2 — What gets pre-warmed?

| Option | Description | Selected |
|--------|-------------|----------|
| piper model + ORT JIT + OutputStream | Eager-load piper voice; synthesize a single token ('.') and discard via numpy; separately open sounddevice OutputStream at voice sample rate. Three sources of cold-start latency all eliminated. | ✓ |
| piper model + ORT JIT (no OutputStream warmup) | Load model, synth-and-discard one token. OutputStream opens lazily on first real synth. Cost: SC #4's "OutputStream pre-warmed" wording isn't satisfied. | |
| Full end-to-end smoke | Synth + encode via prepare_audio_payload + write to OutputStream at zero gain. Most thorough; small risk of user hearing a glitch. | |

**User's choice:** piper model + ORT JIT + OutputStream.

---

## Area D — Cancel-in-flight TTS + voice-model packaging

### Question 1 — Cancel-in-flight TTS

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-stop on new input | New text-input message IS the interrupt signal. Orchestrator cancels current turn task; TTSTaskManager.clear() cancels pending synth + drains queues; sounddevice stream.abort() stops audio mid-sample. Matches OLVT's audioManager.stopCurrentAudioAndLipSync() pattern. | |
| Let-finish, queue new turn | Current TTS plays to completion; new user input queues and starts after force-new-message + chain-end pair. Simpler implementation; surprising UX if no UI affordance. | ✓ |
| Skeleton-ignore (drop new input) | While orchestrator.turn() is in-flight, new text-input messages are dropped with a WS error. Trivial; obviously wrong UX. | |

**User's choice:** Let-finish, queue new turn.
**Notes:** Implies a pending-input FIFO queue + UX affordance ("Teto is still speaking..." indicator + grayed chat input). The latter is `/gsd:ui-phase 3` territory.

### Question 2 — Voice model packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-download on first boot | Sidecar checks for model files; if missing, runs `python -m piper.download_voices en_US-amy-medium` automatically. Repo stays small; requires internet on first launch. | |
| Bundle in repo via Git LFS | Commit .onnx (~60MB) + .onnx.json into sidecar/models/piper/ via Git LFS. Works offline immediately; clone gets ~60MB heavier; Git LFS adds tooling burden. | ✓ |
| Manual placement (documented) | Developer downloads model files manually; sidecar errors loud if absent. Zero-magic, zero-dependency, but adds a manual step. | |

**User's choice:** Bundle in repo via Git LFS.
**Notes:** Phase 3 plan must initialize Git LFS in the repo (not currently configured) and verify clone+checkout works.

---

## Final check

**Question:** All four selected areas captured. Ready for context, or explore more gray areas?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Decisions concrete enough for researcher and planner. Remaining details (started_at calculation, volumes[] normalization, queue-of-pending-inputs FIFO mechanics, .gitattributes setup, prepare_audio_payload port, TTSTaskManager port semantics) are planner's discretion. | ✓ |
| Explore more gray areas | Discuss more before writing context. | |

**User's choice:** I'm ready for context.

---

## Claude's Discretion

Areas where the user explicitly deferred to planner judgment with documented defaults (mirrored in 03-CONTEXT.md `<decisions>`):

- pydub vs numpy for `volumes[]` computation (D-12)
- `sounddevice` latency mode (default vs `latency='low'`)
- `stream.time` vs `time.monotonic()` for `started_at`
- Implicit vs explicit per-sentence end-of-audio signaling
- `avatars/teto/avatar.yaml` `sample_rate` field vs `PiperVoice.config` derivation
- `[TTS]` log line format for SC #2 verification
- Pending-input queue UX affordance details (UI-phase territory)
- Sounddevice buffer underrun handling under load

## Deferred Ideas

Mirrored in 03-CONTEXT.md `<deferred>`. Highlights:

- Hard-stop / interrupt mid-TTS (v2 — preserve OLVT pattern as reference)
- Renderer-side audio playback / recording UI (v2 — fields in envelope already)
- Multiple TTS backends (TTSv2 milestone)
- Voice input (VI milestone)
- Per-avatar voice selection (MULTI-03)
- Audio output device picker (v2)
- Streaming PCM tap (v1.5 if learned audio-to-params drivers need it)
