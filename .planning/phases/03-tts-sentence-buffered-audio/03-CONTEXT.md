# Phase 3: TTS & Sentence-Buffered Audio — Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver real piper TTS that fills the `audio` + `volumes` slots in the WS audio envelope locked by Phase 2 D-02 + Amendment. Sentence-buffered parallel synthesis with ordered playback (port of OLVT's `TTSTaskManager`). Audio plays **sidecar-side** via `sounddevice.OutputStream` (NOT renderer Web Audio). The RMS feature tap is exposed via an in-process `asyncio.Queue` (`compositor_speech_queue`) consumed by Phase 4's compositor speech driver. The TTS gateway provides the per-sentence amplitude envelope synchronously when audio playback begins (SC #5 satisfaction).

Specifically:

1. Multi-sentence prompt → audible TTS output for each sentence in order, played via `sounddevice` from the sidecar process (the user hears the avatar speak).
2. Logs prove parallel synth: sentence N audio playback begins while sentence N+1 synth is still running (verifiable via `[TTS]` loguru lines in the Logs drawer).
3. First-reply latency comparable to subsequent — warmup synth runs at sidecar boot **before** the `[READY]` line emits.
4. First sentence's audio starts cleanly; `sounddevice.OutputStream` pre-warmed at boot, sample rate pinned to `avatars/teto/avatar.yaml.voice` config.
5. RMS feature tap publishes `SpeechEnvelopePayload(sentence_id, volumes[], slice_length, started_at)` to `compositor_speech_queue` at audio-write time.

Out of this phase:

- The compositor itself / 60Hz `ParamFrame` stream / VTS bridge / `ParamMouthOpenY` writes (Phase 4 — consumes the queue this phase exposes).
- Body-sway investigation (Phase 4 AVT-06).
- Renderer-side audio playback (deferred to v2 audio-monitoring/recording features — `audio` and `volumes` ship in the WS envelope for §14 SC #6 protocol parity but skeleton renderer ignores both).
- Multi-thread / multi-avatar TTS routing (deferred milestones).
- Voice input (faster-whisper, VAD): explicitly REQUIREMENTS.md VI-01..04 deferred — do not pull these wheels in Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Audio playback architecture (Area A)

- **D-01: Audio plays sidecar-side via `sounddevice.OutputStream`.** Locks the most consequential decision. Sidecar's TTS gateway opens a single `sounddevice.OutputStream` at boot pinned to the voice's sample rate (en_US-amy-medium = 22050 Hz mono int16; per Phase 2 D-08 schema). All TTS audio plays through this stream. The WS audio envelope continues to ship `audio` (base64) + `volumes[]` for §14 SC #6 OLVT-protocol-shape parity, but the **renderer DOES NOT play it in skeleton** — those fields are reserved for v2 audio-monitoring/recording. Diverges from OLVT's renderer-side Web Audio playback because OLVT relies on Cubism's `_wavFileHandler` for lipsync (PCM-driven from inside the renderer), and we use VTS's API where lipsync flows through compositor's sidecar→VTS direct `ParamFrame` writes (AVT-01 invariant).
- **D-02: Compositor RMS sync is in-process and time-precise.** `started_at = stream.time + stream.output_latency` at the moment the sender task calls `stream.write()` for sentence N's first chunk. Compositor's speech driver advances `index = floor((now() - started_at) * 1000 / slice_length)` and reads `volumes[index]` (with linear interpolation per D-04). No renderer→sidecar position acks; no estimate-jitter; SC #4 wording satisfied verbatim.

### RMS feature tap (Area B)

- **D-03: Per-sentence pre-computed `volumes[]` envelope, OLVT-shape, computed at synth time.** Sidecar synthesizes WAV → computes `volumes[]` (one float per `slice_length=20 ms` chunk, normalized to max RMS in the sentence per OLVT's `_get_volume_by_chunks` pattern). The same `volumes[]` array (a) ships in the WS audio envelope for protocol parity, AND (b) publishes to `compositor_speech_queue` for Phase 4 consumption. Computed once per sentence; no runtime PCM tap. Mirrors OLVT's `prepare_audio_payload` behavior verbatim.
- **D-04: Compositor consumes via linear interpolation between adjacent `volumes[i]` / `volumes[i+1]`.** 20 ms slice resolution = 50 Hz native; compositor runs at 60 Hz; linear interp produces visibly smooth `ParamMouthOpenY` motion. Phase 4's speech driver: `t = ((now() - started_at) * 1000 % slice_length) / slice_length; mouth = volumes[i] * (1 - t) + volumes[i+1] * t` (with edge-case clamping at sentence end). Phase 3 doesn't write `ParamMouthOpenY` itself — only exposes the data; Phase 4's compositor owns the param-write side.

  **D-04A Gap-closure supersession (2026-05-07):** Phase 3 verification found that `TTS-04` cannot pass while `SpeechEnvelopePayload` terminates in a no-op logger. The narrow Phase 3 gap-closure exception is now: implement only the `SpeechEnvelopePayload -> ParamMouthOpenY` runtime mouth-driver path and writer seam needed to prove our-RMS lipsync. Broader Phase 4 compositor scope remains deferred: no idle/rest-state compositor, no expression/body-sway/cursor drivers, no 60 Hz multi-driver frame loop, and no AVT-03 additive blending work.
- **D-05: RMS API surface = `compositor_speech_queue: asyncio.Queue[SpeechEnvelopePayload]`.** Mirrors Phase 2 D-11's `compositor_intent_queue` pattern. New queue lives on the orchestrator (sibling of `compositor_intent_queue`). `TTSTaskManager` publishes to this queue at the moment audio write begins for sentence N (so `started_at` reflects audible time-zero). Phase 3 ships a no-op consumer task that drains the queue (prevents unbounded growth); Phase 4 swaps in the real speech driver.
  - **Schema:** `SpeechEnvelopePayload` Pydantic model in `packages/contracts/py/contracts/speech_envelope.py` with fields `sentence_id: int`, `volumes: list[float]`, `slice_length: int`, `started_at: float` (sidecar wall-clock seconds; consumer compares against the same clock source — planner picks `time.monotonic()` or `stream.time`). Hand-mirrored TS in `packages/contracts/ts/speech-envelope.ts` per Phase 2's hand-mirror pattern (codegen replaces in Phase 5 per SC-02). Note: `SpeechEnvelopePayload` is **NOT a WS message** — it is an in-process queue payload; no WS dispatcher entry.
  - **SC #5 wording:** "in-process API that returns the per-sentence amplitude envelope synchronously when a sentence finishes synthesis" — the `compositor_speech_queue.put()` call IS the synchronous publication point. **Slight wording tension:** SC #5 says "when synthesis finishes", but D-02 publishes at write-time so `started_at` is meaningful. Acceptable resolution: the queue.put happens in the same coroutine immediately before stream.write begins for sentence N, which is also "when synthesis is fully complete" because synth precedes write. Verifies cleanly.
  - **Optional sync-getter:** planner may also expose `tts_gateway.get_active_envelope() -> SpeechEnvelopePayload | None` for Phase 4's flexibility — the queue is the load-bearing contract; the sync getter is a convenience. Skeleton may ship without it.

### Warmup synth strategy (Area C)

- **D-06: Warmup runs at sidecar boot, BEFORE `[READY]` emits.** Sequence inside FastAPI lifespan startup:
  1. `PiperVoice.load(model_path)` — model into memory.
  2. Synthesize a single token (`"."`) in-memory via `synthesize_wav` into a `BytesIO`; **discard** (do NOT write to OutputStream). JIT-warms onnxruntime.
  3. Open `sounddevice.OutputStream(samplerate=voice.sample_rate, channels=1, dtype='int16').start()`. Stream stays open for the session.
  4. Emit `[READY] ws://127.0.0.1:<port>/ws` line to stdout (Phase 1's port-discovery contract).
  5. uvicorn begins serving; renderer connects.

  Boot is ~500 ms slower than current Phase 1/2 baseline (cold venv on Windows already takes seconds, so this is in the noise). SC #3 first-reply-latency is provably correct because first message and Nth message run identical code paths.

- **D-07: Warmup scope = piper model + ORT JIT + sounddevice OutputStream.** All three sources of cold-start latency eliminated (model load, ORT JIT first-pass, PortAudio output buffer fill). Voice sample rate pinned from `avatars/teto/avatar.yaml.voice.sample_rate` OR derived from `PiperVoice.config.sample_rate` (planner picks; if derived, drop the yaml field). en_US-amy-medium is 22050 Hz int16 mono.
- **D-08: Warmup audio is discarded (NOT written to OutputStream).** Synth-and-discard runs in-memory via `BytesIO`; resulting samples are never written to sounddevice. Zero risk of user hearing a glitched warmup token. The OutputStream is opened/started separately with no input — `sounddevice` allows opening a stream without immediate writes.

### Cancel-in-flight TTS + voice-model packaging (Area D)

- **D-09: Let-finish + queue new turn on mid-playback text-input.** Current TTS plays to completion; new user `text-input` queues via FIFO `pending_inputs: asyncio.Queue[str]`. Orchestrator processes serially: when current turn's `force-new-message` + `chain-end` pair has emitted AND `audio_task_queue.empty()`, dequeue next pending input and start the new turn. Multiple rapid-fire user messages all queue and process in order. UX implication: avatar continues speaking after user types; the chat surface needs a "Teto is still speaking…" indicator + visibly grayed-out chat input until queue drains. **No interrupt envelope, no hard-stop, no `audio.abort()`** in skeleton — simpler than OLVT's `audioManager.stopCurrentAudioAndLipSync()` pattern. OLVT's interrupt path is preserved as a v2 reference (see Deferred Ideas). Planner: surface this UX detail to the UI researcher / `/gsd:ui-phase 3` so the chat input affordance is specified.
- **D-10: Voice model files bundled in repo via Git LFS.** `sidecar/models/piper/en_US-amy-medium.onnx` (~60 MB) + `sidecar/models/piper/en_US-amy-medium.onnx.json` (~few KB) tracked via Git LFS. `.gitattributes` adds `sidecar/models/piper/*.onnx filter=lfs diff=lfs merge=lfs -text`. Repo works offline immediately on clean clone; no first-launch network dependency. Phase 3 plan must initialize Git LFS in the repo (not currently configured) — planner introduces it and verifies clone + checkout works. Voice .onnx file is downloaded via `python -m piper.download_voices en_US-amy-medium` once, then committed to `sidecar/models/piper/`.

### TTSTaskManager port (cross-cutting)

- **D-11: Port OLVT `TTSTaskManager` verbatim, adapt for sidecar-side playback.** Direct port of `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py` (183 LOC) into `apps/sidecar/src/sidecar/tts/tts_manager.py`. The `sequence_counter` + `buffered_payloads` + `asyncio.Queue` + `sender_task` ordered-delivery pattern stays. Adaptations:
  - `_process_tts` synthesizes via piper + computes `volumes[]` (port `prepare_audio_payload` from `OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py` per D-12), emits `AudioPayloadMessage` envelope to WS, AND publishes `SpeechEnvelopePayload` to `compositor_speech_queue` at the moment `stream.write` begins.
  - **Audio playback is sidecar-side:** the `_process_payload_queue` sender task pulls payloads in sequence order and writes PCM int16 samples to the global `sounddevice.OutputStream` synchronously. Sequence ordering is enforced by the OLVT pattern unchanged — the parallel synth happens in the spawned `_process_tts` coroutines; the sender task ensures playback is monotonic.
  - **`clear()` semantics retained for v2 hard-stop interrupt** but skeleton only invokes it at orchestrator shutdown (not on user input per D-09).
- **D-12: Port `prepare_audio_payload` verbatim; numpy substitution acceptable for `_get_volume_by_chunks`.** OLVT's `_get_volume_by_chunks` uses `pydub.AudioSegment.make_chunks`. Pydub depends on FFmpeg for non-WAV formats; piper outputs WAV directly so pydub-with-FFmpeg is overkill. Planner discretion: either (a) port verbatim with `pydub` dep + ffmpeg in PATH, or (b) substitute numpy — load WAV bytes via the `wave` stdlib module, reshape into `slice_length`-ms chunks of int16 samples, compute `sqrt(mean(x.astype(float64)**2))` per chunk, normalize by max → `list[float]`. Option (b) drops a dep and adds ~15 LOC; recommended.

### sentence_id continuity from Phase 2

- **D-13: `sentence_id` values come from the orchestrator's existing counter (Phase 2).** Phase 2's orchestrator emits monotonic `sentence_id` per turn. Phase 3 reuses this counter — both `AudioPayloadMessage` (WS) and `SpeechEnvelopePayload` (in-process queue) carry the same `sentence_id`, allowing Phase 4 (and any debug tooling) to correlate WS-side audio with sidecar-side compositor speech. Counter resets per turn at the orchestrator's discretion (Phase 2 detail; Phase 3 doesn't change it).

### Force-new-message + chain-end timing relative to audio-end

- **D-14: `chain-end` emits AFTER the last sentence's audio finishes playing.** OLVT's `single_conversation.py` + `conversation_utils.py:181, 199-204` fire `force-new-message` and `chain-end` after the orchestrator's last sentence emits, but in OLVT they fire shortly after WS sends complete (renderer plays audio post-WS-receive). Our skeleton plays audio sidecar-side, so the orchestrator must `await tts_manager.wait_for_all_audio_complete()` (last sentence's playback fully drained from `sounddevice` buffer) before emitting `chain-end`. Otherwise the renderer sees `chain-end` while audio is still playing in the sidecar — which would visibly un-gray the chat input mid-speech (D-09's UX contract).
  - **Phase 4 implication:** `chain-end` is also the signal Phase 4's compositor speech driver uses to decay body-sway. Confirm with the Phase 4 planner that post-audio-complete timing is what they want (vs. firing `chain-end` at synth-complete and letting decay overlap with last-sentence playback). Skeleton picks the post-audio-complete timing for verifiability of D-09's UX contract.
  - **`force-new-message` timing:** unchanged from OLVT — fires immediately after the last sentence's `AudioPayloadMessage` is sent to WS, so the renderer's growing-bubble seal happens before audio ends. Only `chain-end` is shifted.

### Claude's Discretion

User chose to defer these to research/planner judgment with documented defaults:

- **pydub vs numpy for `volumes[]` computation (D-12)** — either is acceptable; numpy preferred for fewer deps, easier wheel story on Windows.
- **`sounddevice` latency mode** — `latency='low'` vs default. Low-latency mode reduces buffer fill for tighter sync but raises CPU and risks underruns. Skeleton ships default; planner verifies SC #4 click/pop is absent under default before considering low-latency.
- **`stream.time` vs `time.monotonic()` for `started_at`** — sounddevice exposes `stream.time` (the device clock); `time.monotonic()` is simpler and platform-portable. Planner picks based on which has lower jitter on Windows; the choice must be consistent between producer (TTSTaskManager) and consumer (compositor speech driver).
- **Per-sentence end-of-audio signaling** — compositor needs to know when sentence N's `volumes[]` is exhausted. Planner picks: implicit (compositor reads index until `index >= len(volumes)`; enters silence) vs explicit (TTSTaskManager publishes a `SpeechEnvelopeEndPayload(sentence_id)` when sentence N's audio completes). Skeleton can ship implicit; explicit lands in Phase 4 if needed.
- **`avatars/teto/avatar.yaml` schema extension** — Phase 2 D-08 has `voice: { backend, model, lipsync_mode }`. Phase 3 may add `sample_rate: int` field, OR derive sample rate from `PiperVoice.config` at boot. Planner picks; if `PiperVoice.config.sample_rate` is reliably exposed via the Python API, skip the yaml field.
- **Logs drawer `[TTS]` log lines** — planner designs `[TTS] sentence_id=N synth_ms=X play_started_at=Y volumes_n=Z slice_ms=20` log format for SC #2 verification (parallel synth proof). Phase 2's `[STUB-TTS]` lines get renamed to `[TTS]` consistently.
- **Pending-input queue UI affordance** — D-09 implies a "Teto is still speaking…" indicator + grayed chat input. Exact UX (banner, button state, animation) is `/gsd:ui-phase 3` UI researcher territory.
- **Sounddevice buffer underrun handling** — if audio buffer underruns mid-playback (CPU spike, GC pause), what does the compositor see? `started_at` keeps advancing but `index` overshoots `len(volumes)` early. Planner: pick clamping strategy (compositor goes to silence on overshoot) and test under load.

### Folded Todos

None — todo cross-reference returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** OLVT files are highest authority for code reuse; project-level specs lock the contract; Phase 1 + 2 carry-forward establish the seams Phase 3 builds on.

### OLVT source (port verbatim where applicable)

Full source tree: `C:/Users/16079/Code/OpenLLM_Vtuber/`. Read each cited file end-to-end before deriving the skeleton port.

**TTS pipeline (highest-priority direct ports for this phase):**

- `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py` (183 LOC) — `TTSTaskManager` class. Sequence-counter + buffered_payloads + ordered delivery pattern. Port verbatim with sidecar-playback adaptation per D-11. The `_process_tts` / `_process_payload_queue` / `_send_silent_payload` / `clear` methods all map to skeleton equivalents.
- `OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py` — `prepare_audio_payload` and `_get_volume_by_chunks`. Port logic; numpy substitution acceptable per D-12 (no pydub/FFmpeg dependency). The `chunk_length_ms=20` default is the OLVT-canonical `slice_length` Phase 2 D-02 + Amendment locked.
- `OpenLLM_Vtuber/src/open_llm_vtuber/tts/piper_tts.py` — piper invocation reference. `PiperVoice.load()` + `SynthesisConfig` + `synthesize_wav`. Adapt `generate_audio` for skeleton's in-memory `BytesIO` usage (skip file I/O since sidecar plays directly via sounddevice).
- `OpenLLM_Vtuber/src/open_llm_vtuber/tts/tts_interface.py` — base class for TTS engines. Skeleton can drop the inheritance hierarchy (single backend, piper) but the `async_generate_audio` method signature is the OLVT-shape contract that future TTSv2 backends would implement.

**Conversation lifecycle (signal timing):**

- `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/single_conversation.py` (174 LOC) — turn lifecycle, full-response accumulation. Phase 3 amends "post-audio-complete chain-end" timing per D-14.
- `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/conversation_utils.py` lines 84-113 (`handle_sentence_output`), 133-211 (`send_conversation_start_signals`, `finalize_conversation_turn`, `send_conversation_end_signal`). The `force-new-message` (line 181) + `chain-end` (lines 199-204) pair Phase 2 D-04 ports forward; D-14 amends the chain-end timing to post-audio-complete.

**Frontend audio handling (informs what renderer DOES NOT do in skeleton):**

- `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/utils/audio-manager.ts` — interrupt pattern (`stopCurrentAudioAndLipSync`). NOT ported in skeleton per D-09 (let-finish strategy). Cited for plan-checker awareness; v2 reintroduces if interrupt becomes a feature.
- `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/hooks/utils/use-audio-task.ts` — OLVT's renderer-side audio-task queue + Cubism `_wavFileHandler` lipsync. NOT ported in skeleton per D-01 (sidecar-side playback). Cited so the planner understands which fields in our WS audio envelope are "shipped but unconsumed renderer-side" in skeleton, and what v2 audio-monitoring would look like if it lands.

**Already ported (carried forward from Phase 2, no rework here):**

- `OpenLLM_Vtuber/src/open_llm_vtuber/agent/transformers.py` — `tts_filter` decorator (Phase 2 D-20). Phase 3's `TTSTaskManager` wraps this output.
- `OpenLLM_Vtuber/src/open_llm_vtuber/utils/tts_preprocessor.py` — text cleanup (Phase 2 Claude's-Discretion). Phase 3 inherits unchanged.

### Project-level specs (decision authority)

- `PROJECT_DESIGN.md` §5.1 (Conversation orchestrator pipeline shape, sentence-by-sentence streaming UX).
- `PROJECT_DESIGN.md` §5.6 (TTS strategy, RMS feature tap as compositor input — D-03/D-04/D-05 implementation).
- `PROJECT_DESIGN.md` §11 (VTS rendering, lipsync via param injection — confirms `ParamMouthOpenY` is sidecar→VTS direct in Phase 4, not renderer-side).
- `PROJECT_DESIGN.md` §13.28 (piper TTS-only locked for skeleton).
- `PROJECT_DESIGN.md` §14 walking-skeleton SCs #1, #4, #6 (Phase 3 contributes to all three).
- `.planning/PROJECT.md` (Active reqs: piper TTS only; lipsync via our-RMS path driving `ParamMouthOpenY`; Risks: R-OPEN-1 body-sway is Phase 4 territory but D-04 enables Phase 4 to consume the RMS tap).
- `.planning/REQUIREMENTS.md` TTS-01 through TTS-04 (Phase 3's full requirement set, plus the cross-phase TTS-04 lipsync wiring that lands in Phase 4 against the queue this phase exposes).
- `.planning/ROADMAP.md` Phase 3 lines 63-77 (success criteria #1-#5, plans 03-01 + 03-02).

### Phase 1 + 2 carry-forward (seams Phase 3 extends)

- `.planning/phases/01-plumbing-process-lifecycle/01-CONTEXT.md` — sidecar lifecycle (D-04 watchdog, D-05 graceful shutdown), `[READY]` emission contract, PROVENANCE.md vendor pattern. Phase 3 extends `[READY]` to fire after warmup completes.
- `.planning/phases/02-conversation-pipeline/02-CONTEXT.md` — most relevant prior decisions Phase 3 depends on:
  - **D-02 + D-12 + Amendment** — WS audio envelope shape (`type:"audio"`, `audio`, `volumes`, `slice_length`, `display_text`, `actions`, `forwarded`, `sentence_id`). Phase 3 fills `audio` (base64 WAV) and `volumes` (RMS list).
  - **D-03 + D-04** — `force-new-message` + `chain-end` signals; Phase 3 D-14 amends chain-end timing to post-audio-complete.
  - **D-08** — `avatars/teto/avatar.yaml.voice` schema (`backend, model, lipsync_mode`); Phase 3 may add `sample_rate` (or derive from piper voice metadata).
  - **D-11** — `compositor_intent_queue: asyncio.Queue` pattern; Phase 3 adds parallel `compositor_speech_queue` on the same orchestrator.
  - **D-13** — `sentence_id` is the cross-envelope correlation key. Phase 3 D-13 confirms it spans both WS audio and in-process speech-envelope payloads.
  - **D-19** — Orchestrator append-only memory + forward-only `_head_idx` discipline; Phase 3 must not regress (the pending-input FIFO doesn't touch `_memory`).
  - **D-20** — OLVT 4-decorator chain port; Phase 3's `TTSTaskManager` attaches downstream of `tts_filter`.
  - **D-23** — stub TTS log-to-stdout pattern; Phase 3 swaps stub for real piper invocation while keeping the log shape (rename `[STUB-TTS]` → `[TTS]`).
- `.planning/phases/02-conversation-pipeline/02-CONTEXT-AMENDMENT.md` — final OLVT-canonical envelope names. Phase 3's `audio` field IS the OLVT-canonical name; do not regress to `audio_b64`.
- `.planning/phases/02-conversation-pipeline/02-RESEARCH.md` — OLVT verbatim-port philosophy, BPE adversarial fixture pattern (Phase 3 inherits the philosophy; no new fixtures).
- `.planning/phases/02-conversation-pipeline/02-01-PLAN.md`, `02-02-PLAN.md`, `02-03-PLAN.md` — Phase 2 plans Phase 3 extends. Read 02-02-PLAN.md for the orchestrator turn structure that Phase 3's TTS path attaches into.
- `packages/contracts/py/contracts/audio_payload.py` — already-created Pydantic model from Phase 2; Phase 3 fills its `audio` and `volumes` fields. Phase 3 ADDS a sibling `speech_envelope.py` (in-process queue payload, NOT a WS message).

### Research outputs

- `.planning/research/PITFALLS.md` — no Phase-3-specific pitfalls beyond piper voice model file presence (handled by D-10 LFS) and `<think>` boundary handling (already addressed Phase 2 D-10).
- `.planning/research/ARCHITECTURE.md` §2.3, §5 (sidecar internal modules — `orchestrator/`, `tts/` Phase 3 lands; data-flow trace per phase).
- `.planning/research/STACK.md` — piper-tts 1.4.2 pinned, Python 3.12. Skeleton uses `piper-tts` (NOT `piper-onnx`) per CLAUDE.md. Phase 3 `uv add`s: `piper-tts==1.4.2`, `sounddevice==0.4.x` (or current; planner verifies wheel for Python 3.12 on Windows). `pydub` only if D-12 picks (a); skip if (b).

### Convention / config

- `CLAUDE.md` (project root) — locked stack: `piper-tts` (NOT `piper-onnx`), Python 3.12, npm-not-pnpm, voice-input deps SKELETON-DEFERRED. Phase 3 plan must NOT add `faster-whisper`, `silero-vad` even though they're pinned in CLAUDE.md's full Recommended Stack — those are voice-INPUT, deferred.
- `.planning/STATE.md` — current phase position; updated at the end of this discuss-phase run.

### External (no in-repo path — paste URL in plans)

- piper-tts PyPI: https://pypi.org/project/piper-tts/ (1.4.2 stable)
- piper voice models: https://github.com/rhasspy/piper/releases (en_US-amy-medium download)
- piper-tts voice download CLI: `python -m piper.download_voices en_US-amy-medium`
- python-sounddevice docs: https://python-sounddevice.readthedocs.io/ (OutputStream, latency, sample rate, stream.time)
- ONNX Runtime warmup pattern: https://onnxruntime.ai/docs/performance/tune-performance/profiling-tools.html (single inference primes JIT)
- Git LFS docs: https://git-lfs.github.com/ (initial setup, .gitattributes patterns)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phase 1 + 2 + OLVT sibling)

- **`apps/sidecar/src/sidecar/orchestrator/transformers.py`** (Phase 2 port of OLVT `transformers.py`) — `tts_filter` decorator already in place. Phase 3 attaches `TTSTaskManager` downstream of its `SentenceOutput` emissions.
- **`apps/sidecar/src/sidecar/orchestrator/orchestrator.py`** (Phase 2) — `Orchestrator.turn()` already publishes ActionIntents to `compositor_intent_queue`. Phase 3 adds `compositor_speech_queue` alongside (same orchestrator instance owns both).
- **`apps/sidecar/src/sidecar/orchestrator/output_types.py`** + **`prompt_loader.py`** + **`sentence_divider.py`** + **`tts_preprocessor.py`** — already ported in Phase 2 with PROVENANCE.md entries. Phase 3 reuses unchanged.
- **`apps/sidecar/src/sidecar/avatar/`** (Phase 2) — `AvatarCapabilities` loader reads `avatars/teto/avatar.yaml`. Phase 3 reads the `voice` block at boot (model path resolution for `PiperVoice.load`, sample-rate pinning).
- **`packages/contracts/py/contracts/audio_payload.py`** + **`packages/contracts/ts/audio-payload.ts`** (Phase 2) — Pydantic + hand-mirrored TS for the WS audio envelope. Phase 3 fills `audio: Optional[str]` and `volumes: list[float]`.
- **`OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py`** — port template per D-11.
- **`OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py`** — port template per D-12.
- **`OpenLLM_Vtuber/src/open_llm_vtuber/tts/piper_tts.py`** — piper invocation reference per D-11.

### Established Patterns (from Phase 1 + 2)

- **Vendor + PROVENANCE.md pattern** (Phase 1 D-01..D-04). Phase 3's OLVT port adds entries to `apps/sidecar/src/sidecar/orchestrator/PROVENANCE.md` (or a new `apps/sidecar/src/sidecar/tts/PROVENANCE.md`): `tts_manager.py` + `stream_audio.py` + `piper_tts.py` + `tts_interface.py` (if ported) all with their upstream commit SHA + adaptation notes per D-11/D-12.
- **Pub-sub via `asyncio.Queue`** (Phase 2 D-11). Pattern: orchestrator owns the queue; producer puts; Phase-N consumer awaits. Phase 3 producer is `TTSTaskManager`; Phase 3 consumer is a no-op drain task.
- **Pydantic-first contracts** (Phase 2). Phase 3 adds `packages/contracts/py/contracts/speech_envelope.py` + hand-mirrored `packages/contracts/ts/speech-envelope.ts` (codegen replaces in Phase 5 per SC-02). Note: `SpeechEnvelopePayload` is **NOT** a WS message variant — it's an in-process queue payload with no WS dispatcher entry.
- **Loguru log envelope through Logs drawer** (Phase 1 + 2). Phase 3 emits `[TTS] sentence_id=N synth_ms=X play_started_at=Y volumes_n=Z` etc. through the same channel for SC #2 parallel-synth verification.
- **`avatars/teto/avatar.yaml`** (Phase 2 D-07/D-08). Already created with `voice` block. Phase 3 may extend with `sample_rate` field if not derivable from `PiperVoice.config`.

### Integration Points

- **Orchestrator → TTSTaskManager handoff:** Phase 2's `Orchestrator.turn()` async-iterates `SentenceOutput` from the 4-decorator chain. Phase 3 amends: each `SentenceOutput` → `tts_manager.speak(tts_text, display_text, actions, sentence_id, ...)` → returns immediately. The TTSTaskManager spawns a `_process_tts` coroutine per sentence (parallel synth). The internal sender_task pulls completed payloads in sequence order and writes audio sequentially.
- **TTSTaskManager → sounddevice OutputStream:** Single global `OutputStream` owned by the TTS gateway, opened at boot during warmup, closed at sidecar shutdown. The sender task writes int16 PCM bytes to the stream sequentially; sounddevice handles hardware emission.
- **TTSTaskManager → `compositor_speech_queue`:** At the moment the sender task calls `stream.write()` for sentence N, publish `SpeechEnvelopePayload` to the queue. Phase 3 ships a no-op draining task; Phase 4 swaps in the real compositor speech driver.
- **TTSTaskManager → WS audio envelope:** sender task ALSO emits `AudioPayloadMessage{type:"audio", audio:base64, volumes, slice_length, sentence_id, display_text, actions}` to the renderer via the existing WS sender path. Renderer ignores `audio` + `volumes` in skeleton; Phase 2's chat surface uses `display_text` + `sentence_id` to render the growing assistant bubble.
- **Sidecar boot warmup → `[READY]`:** FastAPI lifespan startup runs warmup before yielding to `uvicorn.serve()`; `[READY]` line emits as part of post-warmup startup. Phase 1's `[READY] ws://127.0.0.1:<port>/ws` regex unchanged.
- **`avatars/teto/avatar.yaml.voice` → TTSGateway init:** TTSGateway reads voice config at boot (model path = `sidecar/models/piper/<model>.onnx`; sample rate from `PiperVoice.config` or yaml field per Claude's Discretion).
- **Orchestrator pending-input FIFO:** New `pending_inputs: asyncio.Queue[str]` on the orchestrator. WS handler enqueues every `text-input` payload regardless of orchestrator state. A "turn-loop" coroutine awaits the queue + processes one turn at a time + waits for `tts_manager.wait_for_all_audio_complete()` before processing the next. D-09's let-finish behavior emerges naturally.

### Greenfield additions (Phase 3 creates)

- **`apps/sidecar/src/sidecar/tts/`** — new module:
  - `__init__.py`
  - `tts_gateway.py` — piper wrapper (PiperVoice.load + SynthesisConfig holding + warmup logic + sounddevice OutputStream owner)
  - `tts_manager.py` — port of OLVT `TTSTaskManager` per D-11
  - `audio_payload_helpers.py` — port of OLVT `prepare_audio_payload` + `_get_volume_by_chunks` per D-12
  - `speech_envelope.py` — helper to build `SpeechEnvelopePayload` and publish to `compositor_speech_queue`
  - `PROVENANCE.md` — OLVT-port attribution (or merged into orchestrator/PROVENANCE.md, planner picks)
- **`packages/contracts/py/contracts/speech_envelope.py`** — `SpeechEnvelopePayload` Pydantic model (in-process queue payload).
- **`packages/contracts/ts/speech-envelope.ts`** — hand-mirrored TS for codegen-replacement-target completeness.
- **`sidecar/models/piper/en_US-amy-medium.onnx`** + **`sidecar/models/piper/en_US-amy-medium.onnx.json`** — voice model files (LFS-tracked).
- **`.gitattributes`** — Git LFS configuration: `sidecar/models/piper/*.onnx filter=lfs diff=lfs merge=lfs -text`.
- **Phase 3 deps in `sidecar/pyproject.toml`:** `piper-tts==1.4.2`, `sounddevice==0.4.x` (planner verifies wheel for Python 3.12 on Windows). Optional: `pydub` if D-12 picks pydub variant.

</code_context>

<specifics>
## Specific Ideas

- **OLVT port verbatim where possible.** The user's standing preference (memory `feedback_olvt_port_preference`) drives D-11 (TTSTaskManager verbatim) and D-12 (`prepare_audio_payload` logic verbatim, with optional pydub→numpy substitution for fewer deps). The deviations from OLVT are purposeful and individually documented:
  - **D-01:** Audio plays sidecar-side. OLVT plays renderer-side via Cubism `_wavFileHandler`. Forced by VTS-API constraint (no in-renderer Cubism instance available; lipsync must be sidecar→VTS direct per AVT-01).
  - **D-09:** Let-finish + queue. OLVT supports interrupt. User picked simpler model for skeleton; OLVT's interrupt pattern is preserved as v2 reference.
  - **D-14:** `chain-end` after audio-complete. OLVT fires immediately after WS sends. Forced by sidecar-side playback timing (so the renderer's chat-input ungrey doesn't happen mid-speech).
- **The renderer's role for `audio` + `volumes` is "ignore in skeleton, reserved for v2 audio-monitoring/recording".** Deliberate forward-compat. §14 SC #6 (OLVT protocol-shape parity) is preserved without renderer-side action. Phase 5 verification of SC #6 will check protocol shape matches OLVT, NOT that the renderer plays it.
- **Sample rate pinning is from the voice config.** Per SC #4 wording "sample rate pinned to voice config" — `avatars/teto/avatar.yaml.voice.sample_rate` (or `PiperVoice.config.sample_rate`; planner picks). en_US-amy-medium is 22050 Hz mono int16; pinned at OutputStream open; no resampling.
- **The `compositor_speech_queue` producer-side contract is THE Phase-4 deliverable interface.** D-05's `SpeechEnvelopePayload` is what Phase 4's compositor speech driver consumes. Locked here so Phase 4 plan-time has a stable contract; if Phase 4 needs additional fields (e.g., voice gain, expected_duration_ms, voice_id for multi-avatar), plan-time amendment is acceptable but breaking changes flag a re-plan.
- **Pending-input FIFO + UX affordance.** D-09 implies the chat input must visibly indicate "Teto is still speaking, your message is queued". The exact UX is `/gsd:ui-phase 3` UI researcher territory but the planner must explicitly call this out in the plan deliverable so the renderer-side affordance is built (not discovered late).

</specifics>

<deferred>
## Deferred Ideas

- **Hard-stop / interrupt mid-TTS** — OLVT's `audioManager.stopCurrentAudioAndLipSync()` is the v2 reference. Skeleton's let-finish (D-09) is intentionally simpler; revisit if user feedback flags "avatar talks over me" annoyance.
- **Renderer-side audio playback / recording UI** — `audio` + `volumes` live in the WS envelope but renderer ignores in skeleton. v2 lands renderer-side audio playback for monitoring (e.g., headphone preview), waveform visualization in chat bubble, "save audio" feature. Requires no protocol change.
- **Multiple TTS backends (edge-tts, GPT-SoVITS, ComfyUI)** — already deferred per REQUIREMENTS.md TTSv2-01..05. Skeleton is piper-only.
- **Voice input (faster-whisper, silero-vad, push-to-talk, VAD interrupt)** — already deferred per REQUIREMENTS.md VI-01..04. Phase 3 is TTS-output-only; do NOT add ASR/VAD wheels.
- **Per-avatar voice selection / multi-avatar voice routing** — `avatars/teto/avatar.yaml.voice` is hardcoded en_US-amy-medium per Phase 2 D-08. Multi-avatar voice routing is MULTI-03 territory.
- **Audio output device picker** — `sounddevice` supports it via `device=` kwarg, but UI surface is Settings polish. v2.
- **Sentence-end-of-audio explicit signaling** — Phase 3 ships implicit (compositor reads `volumes[]` until index >= len). Phase 4 may need explicit per-sentence "audio complete" event; if so, Phase 4 plans the addition.
- **Voice gain / volume control** — `sounddevice` supports per-stream gain; Settings UI for it is v2.
- **Streaming PCM tap** (alternative to D-03 pre-computed envelope) — discussed and rejected for skeleton; noted for v1.5 if learned audio-to-params drivers (per PROJECT_DESIGN §5.6 v1.5 hint) need 60 Hz native PCM access.
- **Hot-stop audio output stream during graceful shutdown** — Phase 1's graceful shutdown pattern flushes logs and closes pyvts; Phase 3 adds OutputStream.close() to the same path. Not a deferred idea — covered by planner; called out here so it's not missed.
- **APScheduler-driven TTS** (e.g., scheduled-greeting on app launch) — agent-runtime milestone, far outside skeleton.

### Reviewed Todos (not folded)

None — todo cross-reference returned 0 matches; no pending todos to review.

</deferred>

---

*Phase: 03-tts-sentence-buffered-audio*
*Context gathered: 2026-05-06*
