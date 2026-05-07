# Phase 3: TTS & Sentence-Buffered Audio — Research

**Researched:** 2026-05-06
**Domain:** Local neural TTS (piper) + sidecar-side audio playback (sounddevice/PortAudio) + parallel-synth/ordered-playback queue (OLVT TTSTaskManager port) + in-process RMS envelope publication for Phase 4 compositor
**Confidence:** HIGH (architecture is locked by 14 decisions in CONTEXT.md; remaining unknowns are narrow API/wiring details, all confirmed against piper-tts source + sounddevice docs)

## Summary

CONTEXT.md locks Phase 3 architecture down to the implementation seam. This research's job is to translate those decisions into PLAN-ready details: the exact piper-tts 1.4.2 API surface (`PiperVoice.load`, `synthesize`, `synthesize_wav`, `voice.config.sample_rate`, the `AudioChunk` data model), the python-sounddevice 0.5.5 lifecycle (`OutputStream.start/write/stop`, the critical write/stop semantic distinction, the blocking-write-via-`run_in_executor` async bridge pattern), the numpy 15-LOC chunk-RMS pattern that drops pydub/FFmpeg from the dep tree, the Git LFS first-time init checklist for this repo (LFS not currently configured; `git-lfs/3.6.1` is on the dev machine; `.gitattributes` doesn't exist), and the OLVT TTSTaskManager port adapted for sidecar playback (the only structural change is in `_process_payload_queue`: it now writes PCM to `OutputStream` AND `compositor_speech_queue.put()` AND `websocket_send()` in that order).

Three pitfalls dominate: (1) `OutputStream.write()` returns when bytes are accepted into the OS/PortAudio buffer, NOT when they are emitted by the speaker — `chain-end` after audio-complete (D-14) requires `stream.stop()` (which DOES wait for hardware drain) or explicit elapsed-time + `output_latency` math; (2) the `started_at` timestamp for compositor sync (D-02) MUST come from `stream.time + stream.output_latency` at the write moment because `time.monotonic()` does not know about PortAudio's queued buffer; (3) `synthesize_wav()` writes directly to a wave file object, so to get **both** the base64 WAV (for the WS envelope) AND the raw int16 PCM (for `OutputStream.write`) AND the volumes (for RMS) from one synth pass, use `voice.synthesize()` (yields `AudioChunk`s with `audio_int16_bytes` + `sample_rate`) and reassemble the WAV header in-memory — single source of audio truth.

**Primary recommendation:** Build `tts_gateway.py` (PiperVoice owner + warmup + global `OutputStream`), `tts_manager.py` (OLVT port, ~190 LOC), `audio_payload_helpers.py` (`prepare_audio_payload` + numpy `_get_volume_by_chunks`, ~80 LOC), `speech_envelope.py` (the queue.put helper, ~25 LOC). Use `run_in_executor` to call blocking `stream.write()` from the OLVT-pattern sender task (the sender task IS an asyncio coroutine). Capture `stream.time + stream.output_latency` IMMEDIATELY before the executor-wrapped `stream.write()` returns to acquire the buffer; publish `SpeechEnvelopePayload` to `compositor_speech_queue` BEFORE awaiting the write so Phase 4 has the envelope while audio is still queued. Use `await loop.run_in_executor(None, stream.stop)` after the last sentence's write to satisfy D-14 (drain wait) before `chain-end` emits.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audio playback architecture (Area A)**

- **D-01:** Audio plays sidecar-side via `sounddevice.OutputStream` (single instance, opened at boot, pinned to voice sample rate, lives for sidecar lifetime). Renderer ignores `audio` + `volumes` in WS envelope; those fields ship for §14 SC#6 OLVT-protocol parity only.
- **D-02:** Compositor RMS sync uses `started_at = stream.time + stream.output_latency` captured at the moment the sender task calls `stream.write()` for sentence N's first chunk.

**RMS feature tap (Area B)**

- **D-03:** Per-sentence pre-computed `volumes[]` envelope, OLVT-shape, computed at synth time with `slice_length=20ms`. Same array ships in WS envelope AND publishes to `compositor_speech_queue`.
- **D-04:** Compositor consumes via linear interpolation between `volumes[i]`/`volumes[i+1]`.
- **D-05:** RMS API surface = `compositor_speech_queue: asyncio.Queue[SpeechEnvelopePayload]` on the orchestrator (sibling of `compositor_intent_queue`). New Pydantic `SpeechEnvelopePayload` in `packages/contracts/py/contracts/speech_envelope.py` + hand-mirrored TS in `packages/contracts/ts/speech-envelope.ts`. NOT a WS message; in-process queue payload only. Phase 3 ships a no-op draining task; Phase 4 swaps in real consumer.

**Warmup synth strategy (Area C)**

- **D-06:** Warmup runs at sidecar boot, BEFORE `[READY]` emits. Sequence: `PiperVoice.load` → synth-and-discard one token (`"."`) → open + start `sounddevice.OutputStream` → emit `[READY]` → uvicorn serves.
- **D-07:** Warmup scope = piper model + ORT JIT + sounddevice OutputStream.
- **D-08:** Warmup audio is synth-and-discard (NOT written to OutputStream). Done in-memory via `BytesIO` or `synthesize()` iteration.

**Cancel-in-flight + voice packaging (Area D)**

- **D-09:** Let-finish + queue new turn via FIFO `pending_inputs: asyncio.Queue[str]`. UX affordance ("Teto is still speaking…" indicator + grayed chat input) is part of deliverable; UI surface is `/gsd:ui-phase 3` territory.
- **D-10:** Voice model files bundled via Git LFS at `sidecar/models/piper/`. Repo's first LFS use — Phase 3 plan must initialize. `.gitattributes`: `sidecar/models/piper/*.onnx filter=lfs diff=lfs merge=lfs -text`.

**TTSTaskManager port (cross-cutting)**

- **D-11:** Port OLVT `TTSTaskManager` verbatim (183 LOC), adapt `_process_payload_queue` for sidecar-playback (write to stream + WS + queue, in that order).
- **D-12:** Port `prepare_audio_payload` logic; numpy substitution recommended for `_get_volume_by_chunks` (drops pydub/FFmpeg dep; ~15 LOC).

**`sentence_id` continuity**

- **D-13:** `sentence_id` from orchestrator's existing counter (Phase 2). Same value on `AudioPayloadMessage` (WS) + `SpeechEnvelopePayload` (in-process queue).

**`chain-end` timing**

- **D-14:** `chain-end` emits AFTER last sentence's audio finishes draining from `sounddevice` buffer. `force-new-message` timing unchanged from OLVT (post-last-WS-send, pre-audio-end).

### Claude's Discretion

- pydub vs numpy for `volumes[]` (D-12) → recommended numpy.
- `sounddevice` latency mode default vs `'low'` on Windows.
- `stream.time` vs `time.monotonic()` for `started_at` (D-02).
- Per-sentence end-of-audio signaling: implicit (consumer reads index until `>= len`) vs explicit `SpeechEnvelopeEndPayload`.
- `avatars/teto/avatar.yaml.sample_rate` field vs derived from `PiperVoice.config.sample_rate`.
- `[TTS]` log line format for SC #2 verification (planner designs).
- Sounddevice buffer underrun handling under load (xrun strategy + logging).

### Deferred Ideas (OUT OF SCOPE)

- Hard-stop / interrupt mid-TTS (OLVT `stopCurrentAudioAndLipSync`).
- Renderer-side audio playback / recording UI (audio + volumes in envelope but unconsumed in skeleton).
- Multiple TTS backends (edge-tts, GPT-SoVITS, ComfyUI) — REQUIREMENTS TTSv2-01..05.
- Voice input (faster-whisper, silero-vad) — REQUIREMENTS VI-01..04.
- Per-avatar voice routing (multi-avatar) — MULTI-03.
- Audio output device picker (sounddevice `device=` kwarg).
- Sentence-end explicit signaling (Phase 4 may add).
- Voice gain / volume control.
- Streaming PCM tap (rejected for skeleton; v1.5 maybe).
- Hot-stop OutputStream on graceful shutdown — NOT deferred; covered by planner.
- APScheduler-driven TTS — agent-runtime milestone.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TTS-01 | piper TTS (ONNX, local) is the only voice backend; warmup synth at app launch caches one-token render to amortize ~200-500ms cold-start latency | `PiperVoice.load` + warmup pattern (this doc §"Code Examples — Warmup"); piper-tts 1.4.2 confirmed on PyPI (released 2026-04-02) |
| TTS-02 | Sentence-buffered model — per-sentence parallel synth + ordered delivery (OLVT pattern); first sentence plays while subsequent sentences synthesize; perceived latency = first-sentence-synth-time | `TTSTaskManager` port verbatim + `_process_payload_queue` adaptation for sidecar `OutputStream.write` (this doc §"Architecture Patterns — TTSTaskManager Adapted") |
| TTS-03 | TTS gateway exposes RMS feature tap (audio amplitude envelope) that compositor speech driver consumes in real time | `compositor_speech_queue` pattern + `SpeechEnvelopePayload` schema + numpy chunk-RMS (this doc §"Code Examples — RMS chunking" + §"Architecture Patterns — Compositor Queue Publication") |
| TTS-04 | Lipsync drives `ParamMouthOpenY` from TTS RMS we compute (our-RMS path); VTS-native lipsync is not wired in skeleton | Phase 3 publishes `volumes[] + started_at` to queue; Phase 4 consumes (not Phase 3's responsibility, but the contract is locked here) |

## Project Constraints (from CLAUDE.md)

- **Stack pin:** `piper-tts==1.4.2` (NOT `piper-onnx`; NOT `piper`).
- **Stack pin:** Python 3.12.x (NOT 3.13 — ML wheel parity).
- **Skeleton-deferred (do NOT add as Phase 3 deps):** `faster-whisper`, `silero-vad` (those are voice-INPUT, REQUIREMENTS VI-01..04 deferred).
- **Package manager:** uv for Python sidecar; npm-not-pnpm for Electron (Phase 3 has no JS deps to add).
- **GSD discipline:** all file-changing tools must go through a GSD command (Phase 3 will be `/gsd:execute-phase`).
- **Test framework:** pytest 8 + pytest-asyncio (already in `sidecar/pyproject.toml` dev-dependencies).
- **Avatar default:** Teto only in skeleton (`avatars/teto/avatar.yaml`); shipping default for v2 will be Live2D Inc. sample rig.
- **Memory constraint (KV cache discipline):** orchestrator `_memory.append` only; never `pop(0)`; system prompt bytes-identical at boot. Phase 3 doesn't change this; the new `pending_inputs: asyncio.Queue[str]` is separate from `_memory`.
- **OLVT-port preference (memory `feedback_olvt_port_preference`):** port verbatim where possible. D-11 + D-12 honor this. Document deviations (D-01 sidecar playback; D-09 let-finish; D-14 post-audio chain-end) in `apps/sidecar/src/sidecar/tts/PROVENANCE.md`.

## Standard Stack

### Core (Phase 3 ADDITIONS to sidecar/pyproject.toml)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `piper-tts` | **1.4.2** (released 2026-04-02; Python ≥3.9; Alpha development status but the only piper Python package that exposes `PiperVoice` directly) | Local ONNX TTS — load voice + synthesize WAV / stream `AudioChunk` | CLAUDE.md-locked; same package OLVT uses; ONNX Runtime + espeak-ng phonemization in one wheel; works offline |
| `sounddevice` | **0.5.5** (released 2026-01-23; Python ≥3.7; `py3-none-{win_amd64,...}` wheels — bundles PortAudio binaries on Windows in the wheel) | Sidecar-side audio playback — `OutputStream.write(int16 PCM bytes)` | The 2026-standard PortAudio Python binding; pre-built Windows wheel means no CMake/MSVC step; supports `latency='low'`/`'high'`/numeric, callback or blocking write modes; default host API is WASAPI on Windows Vista+ |
| `numpy` | **1.26+** or **2.x** (already a transitive dep via litellm/pydantic — verify version after install; piper-tts also depends on numpy) | Chunk-RMS computation in `_get_volume_by_chunks` numpy substitution + WAV-bytes assembly from int16 PCM | Already present in env; the 15-LOC chunk-RMS replaces pydub.AudioSegment + FFmpeg dependency stack; std `wave` + numpy is the cleanest WAV-from-PCM path |

**Verified version research (2026-05-06):**
- `piper-tts 1.4.2` — PyPI release 2026-04-02. Source: https://pypi.org/project/piper-tts/.
- `sounddevice 0.5.5` — PyPI release 2026-01-23. Source: https://pypi.org/project/sounddevice/.
- `git-lfs 3.6.1` — already installed on dev machine (verified via `git lfs version`).

### Supporting (already in sidecar/pyproject.toml)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `wave` (stdlib) | n/a | Read/write WAV file headers in-memory via `BytesIO` | Used in `prepare_audio_payload` to assemble base64 WAV from `AudioChunk.audio_int16_bytes` (single synth pass — no double work) |
| `base64` (stdlib) | n/a | Encode WAV bytes for `audio` field in `AudioPayloadMessage` | OLVT verbatim (`base64.b64encode(audio_bytes).decode("utf-8")`) |
| `loguru` (>=0.7) | already pinned | Sidecar logging surfaced through Logs drawer | New `[TTS]` log lines per SC#2 verification (replaces Phase 2's `[STUB-TTS]`) |
| `asyncio` (stdlib) | n/a | Queues, executors, tasks | `asyncio.Queue` for compositor + pending inputs; `loop.run_in_executor(None, stream.write, bytes)` for blocking-write bridge |
| `pydantic` (>=2.5) | already pinned | New `SpeechEnvelopePayload` model | Mirrors Phase 2 contracts pattern (`AudioPayloadMessage`, `ActionIntent`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **`sounddevice`** sidecar playback | Web Audio API in renderer (OLVT pattern) | OLVT renderer plays via Cubism `_wavFileHandler` for lipsync; we use VTS API where lipsync is sidecar→VTS direct (AVT-01). Renderer-side playback would require Cubism in renderer (we don't have it) or a separate non-Cubism-driven audio sink. **CONTEXT D-01 LOCKED to sidecar.** |
| `pydub.AudioSegment` for WAV/RMS | numpy + std `wave` (recommended) | pydub is ~15K LOC + needs FFmpeg in PATH for non-WAV (piper outputs WAV directly so we don't need FFmpeg, but the dep is heavy). numpy chunk-RMS is ~15 LOC and stdlib-only. **CONTEXT D-12 RECOMMENDS numpy.** |
| `piper.synthesize_wav` (writes to wav_file directly) | `piper.synthesize` (yields `AudioChunk`s with `audio_int16_bytes`) | `synthesize_wav` is fire-and-forget; we need raw int16 for sounddevice + numpy RMS + base64 WAV all from one synth pass. `synthesize()` gives raw chunks; we assemble WAV header in-memory once. |
| `time.monotonic()` for `started_at` | `stream.time + stream.output_latency` (recommended) | `time.monotonic()` doesn't know about PortAudio's queued buffer (50–250ms on Windows default). `stream.time` is PortAudio's stream clock; `stream.output_latency` is the time between samples being submitted and emitted. Sum is the audible-time-zero. **CONTEXT D-02 LOCKED to `stream.time + stream.output_latency`.** Compositor must read the same clock — see "Common Pitfalls" §3. |
| Callback-based `OutputStream` (with `outdata[:] = ...` + `CallbackStop`) | Blocking `OutputStream.write()` via `run_in_executor` (recommended) | Callback-mode is the canonical sounddevice asyncio pattern (per `examples/asyncio_coroutines.py`) but couples one stream to one playback session. We have a long-lived stream serving sentence-by-sentence playback over many turns. Blocking `write()` from a thread-pool executor matches the OLVT serial sender pattern more cleanly. |
| Git LFS | Hash-pinned download at first run / `git submodule` of an LFS-only repo / commit raw 60MB onnx | Raw commit bloats `.git` permanently and breaks GitHub free tier (file size cap 100MB but repo size discouraged > 1GB); first-run download adds 30s of latency to first launch on a clean clone (offends "works offline immediately" goal); submodule adds operational complexity. **CONTEXT D-10 LOCKED to Git LFS.** |

### Installation

```bash
# Sidecar deps (uv, in apps/sidecar/ or wherever pyproject.toml lives — currently sidecar/)
uv add piper-tts==1.4.2
uv add sounddevice==0.5.5
# numpy is already pulled in transitively; verify with `uv tree | grep numpy`

# Voice model (one-time, then committed via Git LFS):
mkdir -p sidecar/models/piper
cd sidecar/models/piper
python -m piper.download_voices en_US-amy-medium
# Produces: en_US-amy-medium.onnx (63.2 MB) + en_US-amy-medium.onnx.json (4.88 KB)

# Git LFS init (repo's first time — see "Git LFS Init Checklist" below):
git lfs install
echo 'sidecar/models/piper/*.onnx filter=lfs diff=lfs merge=lfs -text' > .gitattributes
git add .gitattributes sidecar/models/piper/en_US-amy-medium.onnx sidecar/models/piper/en_US-amy-medium.onnx.json
git commit -m "feat(03): add Git LFS + en_US-amy-medium voice"
```

**Version verification:**

```bash
uv pip show piper-tts | grep -E '^(Name|Version|Requires-Python)'
# Expected: Name: piper-tts / Version: 1.4.2 / Requires-Python: >=3.9
uv pip show sounddevice | grep -E '^(Name|Version)'
# Expected: Name: sounddevice / Version: 0.5.5
git lfs version
# Expected: git-lfs/3.6.1+ (already verified on dev machine 2026-05-06)
```

## Architecture Patterns

### Recommended Module Structure

```
sidecar/src/sidecar/
├── tts/                                    # Phase 3 GREENFIELD module
│   ├── __init__.py                         # exports TTSGateway, TTSTaskManager
│   ├── tts_gateway.py                      # PiperVoice owner + warmup + global OutputStream
│   ├── tts_manager.py                      # OLVT TTSTaskManager port (D-11)
│   ├── audio_payload_helpers.py            # prepare_audio_payload + numpy _get_volume_by_chunks (D-12)
│   ├── speech_envelope.py                  # build + publish SpeechEnvelopePayload helper (D-05)
│   └── PROVENANCE.md                       # OLVT-port attribution per Phase 1 D-01..D-04 pattern
├── orchestrator/
│   └── orchestrator.py                     # Phase 2 file — Phase 3 EXTENDS:
│                                           #   - new compositor_speech_queue: asyncio.Queue
│                                           #   - new pending_inputs: asyncio.Queue (for D-09)
│                                           #   - turn() now calls tts_manager.speak per sentence
│                                           #   - turn() awaits tts_manager.wait_for_all_audio_complete before chain-end (D-14)
└── ws/
    └── server.py                           # Phase 1 file — Phase 3 EXTENDS lifespan startup:
                                            #   - load AvatarCapabilities.voice
                                            #   - construct TTSGateway (loads piper, warmup, opens stream)
                                            #   - happens BEFORE current LLM warmup ping
                                            #   - happens BEFORE [READY] emits

packages/contracts/py/contracts/
├── speech_envelope.py                      # NEW — SpeechEnvelopePayload Pydantic
└── ...

packages/contracts/ts/
├── speech-envelope.ts                      # NEW — hand-mirrored TS (codegen replaces Phase 5)
└── ...

sidecar/models/piper/                       # NEW directory (LFS-tracked)
├── en_US-amy-medium.onnx                   # 63.2 MB (LFS pointer in git, content in LFS store)
└── en_US-amy-medium.onnx.json              # 4.88 KB (NOT LFS — small + needs diff)

.gitattributes                              # NEW — LFS configuration
```

### Pattern 1: TTSGateway boot warmup (D-06, D-07, D-08)

**What:** TTSGateway owns one `PiperVoice` + one global `OutputStream`. Warmup runs in FastAPI lifespan startup BEFORE `[READY]` emits and BEFORE uvicorn enters the accept loop.

**When to use:** Sidecar boot only. Stream stays open for sidecar lifetime; closed in lifespan shutdown alongside pyvts (Phase 1 graceful-shutdown extension point).

**Sequence (port from CONTEXT.md D-06 verbatim):**

1. Read `avatars/teto/avatar.yaml.voice` → `{backend: "piper", model: "en_US-amy-medium", lipsync_mode: "our-rms"}`.
2. `PiperVoice.load("sidecar/models/piper/en_US-amy-medium.onnx")` (auto-loads `.onnx.json` sidecar config from same dir; verified by `PiperVoice.load` signature accepting `config_path=None` default).
3. Read `voice.config.sample_rate` (root-level int field on `PiperConfig`; verified — for amy-medium = 22050).
4. **Synth-and-discard ONE TOKEN** (CONTEXT D-08): iterate `voice.synthesize(".")` and discard chunks. This warms ORT JIT (D-07).
5. Open `sounddevice.OutputStream(samplerate=22050, channels=1, dtype='int16').start()`. Stream is now live but receives no data — sounddevice allows this.
6. Emit `[READY] ws://127.0.0.1:<port>/ws` (Phase 1 contract).
7. uvicorn enters serve loop.

**Boot impact:** Adds ~500ms (model load) + ~150ms (one-token synth) + ~30ms (stream open) = ~700ms. Cold venv on Windows already takes 2–4s, so this is in the noise. SC#3 first-reply-latency is provably correct because first message and Nth message run identical code paths.

**Example:** see "Code Examples — TTSGateway boot warmup" below.

### Pattern 2: TTSTaskManager Adapted (D-11)

**What:** Port OLVT's `TTSTaskManager` (183 LOC, `OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py`) verbatim. The class structure stays identical:

- `task_list: list[asyncio.Task]` — outstanding `_process_tts` coroutines (parallel synth happens here).
- `_payload_queue: asyncio.Queue[(payload, sequence_number)]` — completed-synth payloads, out of order.
- `_sender_task: asyncio.Task | None` — single ordered-delivery coroutine.
- `_sequence_counter: int` — monotonic per-turn (mirrors OLVT; co-exists with orchestrator's `sentence_id` counter — see "Sequence vs sentence_id" below).
- `_next_sequence_to_send: int` — sender's read-pointer.

**Adaptation per D-11 (the only structural change):**

OLVT's `_process_payload_queue` is the sender task. It pulls payloads in sequence order and `await websocket_send(json.dumps(payload))`. **Our skeleton's sender does THREE things in this order, for each sentence:**

1. **Compute `started_at`** at the moment-of-write: `started_at = stream.time + stream.output_latency`.
2. **Publish `SpeechEnvelopePayload` to `compositor_speech_queue`** with `started_at`. (Done BEFORE the write so Phase 4 has the envelope while audio is still queued — gives Phase 4 max scheduling headroom.)
3. **Send the WS audio envelope** via `websocket_send` (the OLVT-canonical `audio` envelope; renderer logs it but doesn't play it).
4. **Write PCM int16 bytes to global `OutputStream`** via `await loop.run_in_executor(None, stream.write, pcm_bytes)`. This BLOCKS the executor thread until PortAudio accepts the bytes (queued, not played); the asyncio event loop stays free to advance other coroutines (e.g., the next `_process_tts` task that's still synthesizing N+1).

**Why this order:** the queue.put + WS-send happen instantaneously; the write blocks for `len(pcm_bytes) / sample_rate / 2` seconds. If we WS-sent AFTER the write, the renderer would lag the audio start by hundreds of ms. If we queue.put AFTER the write, Phase 4 misses the early-publication scheduling headroom. The locked order is `queue.put → ws_send → stream.write`.

**Sequence vs sentence_id (D-13 clarification):**

OLVT's `_sequence_counter` is internal-to-`TTSTaskManager` and resets per `clear()`. Phase 2's orchestrator already has its own `sentence_id` counter on `Orchestrator._sentence_counter` (currently `from itertools import count`). Per D-13, the orchestrator's `sentence_id` is THE cross-envelope correlation key. **The TTSTaskManager's internal `_sequence_counter` continues to exist (port verbatim) but it's an internal ordering tag** — the orchestrator passes the *real* `sentence_id` to `tts_manager.speak(...)` as a separate argument. Both happen to start from 0/1 and increment by 1, so in practice they line up; but they have different semantic purposes (`_sequence_counter` = per-turn ordering; `sentence_id` = cross-envelope correlation).

**Recommendation:** leave OLVT's `_sequence_counter` mechanic in place verbatim, and ALSO accept `sentence_id` as a parameter to `speak()`. Use `_sequence_counter` for ordering, embed `sentence_id` in both `AudioPayloadMessage` and `SpeechEnvelopePayload`.

### Pattern 3: Compositor Queue Publication (D-05)

**What:** New attribute on `Orchestrator`: `self.compositor_speech_queue: asyncio.Queue[SpeechEnvelopePayload]`. Mirrors Phase 2 D-11's `compositor_intent_queue`. `TTSTaskManager` receives the queue at construction and `.put()`s envelopes from `_process_payload_queue` at write-time.

**No-op draining task:** Phase 4 compositor will own the consumer. Phase 3 ships a no-op:

```python
async def _drain_speech_queue_until_phase4(queue: asyncio.Queue) -> None:
    """No-op consumer — Phase 4 swaps in real compositor speech driver."""
    while True:
        envelope = await queue.get()
        # Optional: log for SC#5 verification.
        logger.debug(f"[SPEECH-ENV] sentence_id={envelope.sentence_id} "
                     f"started_at={envelope.started_at:.3f} "
                     f"volumes_n={len(envelope.volumes)}")
        queue.task_done()
```

Spawned in lifespan startup; cancelled in lifespan shutdown.

**Optional sync getter (CONTEXT D-05 marks this optional):** `tts_gateway.get_active_envelope() -> SpeechEnvelopePayload | None`. Skeleton may ship without; queue is the load-bearing contract.

### Pattern 4: Pending-input FIFO + let-finish (D-09)

**What:** New attribute on `Orchestrator`: `self.pending_inputs: asyncio.Queue[str]`. WS handler enqueues every `text-input` regardless of orchestrator state. A turn-loop coroutine (long-lived, started in lifespan startup) processes one turn at a time:

```python
async def _turn_loop(self) -> None:
    """Processes pending_inputs serially. Started in lifespan startup,
    cancelled in shutdown. Owns the turn queue's let-finish behavior (D-09).
    """
    while True:
        text = await self.pending_inputs.get()
        try:
            await self.turn(text, self._ws_for_pending_turns)
        except Exception:
            logger.exception("Turn failed in turn-loop")
        finally:
            self.pending_inputs.task_done()
```

The handler becomes:

```python
@on("text-input")
async def handle_text_input(ws: WebSocket, msg: dict) -> None:
    text = msg.get("text", "").strip()
    if not text:
        return
    orchestrator = ...
    if orchestrator is None:
        await ws.send_json(ErrorMessage(message="Sidecar started without LLM config...").model_dump())
        return
    await orchestrator.pending_inputs.put(text)  # never blocks; FIFO
```

**UX surface (deferred to `/gsd:ui-phase 3`):** while `orchestrator.pending_inputs.qsize() > 0` OR a turn is in-flight, the renderer shows "Teto is still speaking…" + grayed chat input. Signal: leverage the existing `chain-start`/`chain-end` envelopes — chat input grays on `chain-start`, ungrays on `chain-end`. Per D-14, `chain-end` fires AFTER audio drains, so this naturally yields the correct UX.

### Pattern 5: D-14 await-audio-complete before chain-end

**What:** OLVT's `finalize_conversation_turn` (`conversation_utils.py:162-211`) emits `force-new-message` (line 181) then `chain-end` (lines 199-204) immediately after `asyncio.gather(*tts_manager.task_list)` (which waits for synth-complete, NOT audio-complete). Our skeleton plays sidecar-side, so we must additionally wait for **the last sentence's PCM to drain from the PortAudio buffer**.

**Critical pitfall:** `OutputStream.write()` returns when PortAudio accepts the bytes into the host buffer, NOT when the speaker emits them. `stream.stopped` is False after `write()` returns. There are two valid drain-detection patterns:

**Pattern 5a (recommended): `stream.stop()` waits for hardware drain.**

Per the sounddevice 0.5.5 docs, `stream.stop()` "waits until all pending audio buffers have been played before it returns" (distinct from `stream.abort()` which terminates immediately). BUT calling `stop()` then `start()` between sentences would cause a click/pop and defeat the warmup invariant. So this pattern requires keeping the stream open and using a different drain primitive — see Pattern 5b.

**Pattern 5b (recommended for our long-lived stream): elapsed-time + output_latency math.**

```python
async def wait_for_all_audio_complete(self) -> None:
    """Block the calling coroutine until the last sentence's audio finishes
    draining from the sounddevice buffer (D-14). Uses the per-sentence
    metadata captured at write-time + the stream's output_latency.
    """
    if self._last_write_finished_at is None:
        return  # no audio played yet this turn
    # _last_write_finished_at = stream.time captured AFTER stream.write returned
    # for the final sentence's last chunk
    # _last_write_duration_s = total seconds of int16 audio submitted
    # output_latency = stream's PortAudio output latency (queued-but-not-played seconds)
    # Drain time = output_latency from the moment write returned.
    drain_seconds = self._stream.latency  # output side; sounddevice exposes as .latency
    await asyncio.sleep(drain_seconds + 0.020)  # +20ms safety margin
```

**Pattern 5c (alternative — explicit): use a sentinel callback.** Use a callback-based stream + `finished_callback` semantics — overkill and breaks the blocking-write pattern. Not recommended.

**Recommended:** Pattern 5b. Keep the stream open; track `_last_write_finished_at = stream.time` after the final write returns; sleep for `stream.latency + 20ms` margin before emitting `chain-end`.

### Pattern 6: WAV envelope + raw PCM from one synth pass (D-12 numpy substitution)

**Source-of-truth audio:** `voice.synthesize(text)` yields `AudioChunk` objects, each with:
- `sample_rate: int` (from `voice.config.sample_rate`; constant for a single voice)
- `sample_width: int` (= 2 for int16)
- `sample_channels: int` (= 1 for mono piper voices)
- `audio_int16_bytes: bytes` (raw int16 PCM)
- `audio_int16_array: np.ndarray` (same data as numpy int16 array — verified)

**Pattern:** synthesize once → collect all `audio_int16_bytes` chunks into a single `bytearray` → use that ONE `bytearray` for **three downstream uses simultaneously**:

1. **`OutputStream.write(pcm_bytes)`** — direct int16 PCM, no conversion.
2. **base64 WAV for `AudioPayloadMessage.audio`** — wrap the PCM in a WAV header in-memory via `wave.open(BytesIO(), "wb") + setnchannels(1) + setsampwidth(2) + setframerate(sample_rate) + writeframes(pcm_bytes)`, then base64-encode.
3. **`volumes[]` for `AudioPayloadMessage.volumes` AND `SpeechEnvelopePayload.volumes`** — numpy chunk-RMS over the same bytes (see "Code Examples — RMS chunking").

This is the OLVT-faithful single-pass approach. No double synth, no FFmpeg, no pydub.

### Anti-Patterns to Avoid

- **`piper.synthesize_wav` to a temp file → re-read with `pydub.AudioSegment.from_file` → re-export.** OLVT does this because OLVT's TTSInterface returns a file path. We have direct in-memory access — skip the file roundtrip entirely (saves ~80ms per sentence on Windows due to disk I/O cost).
- **`time.monotonic()` for `started_at`.** Doesn't account for PortAudio's queued buffer (50–250ms on default Windows latency). Compositor's lipsync would lag by buffer depth.
- **Re-opening `OutputStream` per sentence.** Causes click/pop (Pitfall 1) and defeats D-07 warmup. The stream stays open for sidecar lifetime.
- **Calling `stream.write()` directly from the asyncio event loop coroutine.** `write()` blocks for tens-to-hundreds of ms; without `run_in_executor`, the event loop stalls and other coroutines (synth tasks, WS handlers) can't advance. Result: defeats the parallel-synth invariant.
- **`_memory.pop(0)`-style mutation of `pending_inputs`.** The new FIFO is a queue; pop is the right primitive (`get()`). Listed only because of the orchestrator KV-cache discipline rule that `_memory` is append-only — that rule applies to `_memory`, not `pending_inputs`. Don't conflate them.
- **Forgetting to commit `.gitattributes` BEFORE the .onnx.** Git LFS only kicks in for files added AFTER `.gitattributes` is committed (or after `git add --renormalize`). Add order matters.
- **Using `git lfs track` to write `.gitattributes`.** It does work, but it writes paths relative to where the command was invoked. For a path like `sidecar/models/piper/*.onnx`, hand-write the line in `.gitattributes` at repo root for clarity and review-ability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAV header assembly from int16 PCM | Custom WAV header packer (12-byte RIFF + 24-byte fmt + 8-byte data) | `wave.open(BytesIO(), "wb")` + `setnchannels(1) + setsampwidth(2) + setframerate(sr) + writeframes(pcm_bytes)` | stdlib `wave` is correct, byte-exact, unit-tested. Hand-rolling is one endianness mistake away from a corrupt header. |
| Sentence ordering across parallel synth | Custom Lock + Condition + sorted-list pattern | OLVT `TTSTaskManager` port (D-11) | OLVT pattern is debugged, simple (~190 LOC), ships with sequence-counter + buffered_payloads dict. |
| Queueing + draining pending user inputs | Custom list + lock | `asyncio.Queue` (D-09) | One stdlib primitive. FIFO + non-blocking put + awaitable get + `task_done()` semantics for clean shutdown. |
| RMS over PCM chunks | Hand-loop unpack int16 + sqrt(mean(x*x)) per chunk | numpy reshape + `np.sqrt(np.mean(x**2, axis=1))` (vectorized; ~3 LOC for the math) | numpy is 50× faster than Python-loop for typical 0.5–3s sentences. Already a transitive dep. |
| PortAudio bindings | ctypes + libportaudio.so/.dll wiring | `sounddevice` 0.5.5 wheel (bundles PortAudio on Windows) | Hand-rolling PortAudio bindings is multi-week work + per-platform binary curation. The wheel installs in 2s. |
| Voice model download / caching | Custom HTTPS download + checksum | `python -m piper.download_voices` once, then commit via Git LFS (D-10) | piper bundles a verified-download CLI. Repo-committed-via-LFS means clean clone has the model immediately offline. |
| ORT JIT warmup | Custom benchmark loop | One-token `voice.synthesize(".")` and discard at boot (D-08) | First inference primes the EP graph and op kernels; one inference is enough for CPU EP (the only EP we use — `use_cuda=False`). |
| Drain detection (D-14) | Polling `stream.stopped` (always False on a live stream) | `stream.latency + 20ms` sleep after final `write()` returns (Pattern 5b) | `stream.stopped` only flips after `stream.stop()` is called. We keep the stream open for sidecar lifetime, so `stopped` is always False. The latency-based math is correct and has 20ms safety margin. |

**Key insight:** Phase 3's value-add is the **integration glue** — the OLVT sender task adapted for sidecar playback + the compositor queue contract + the warmup orchestration. Every other concern (ONNX inference, WAV encoding, PortAudio bindings, file download) has a battle-tested library answer.

## Runtime State Inventory

> Phase 3 is greenfield (introduces new modules + voice model + LFS) — minimal renaming. Inventory checked for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 3 introduces no persistent data; chat history clears on relaunch (LLM-04, unchanged); no DB/cache/Mem0 usage | None |
| Live service config | None — no n8n, Datadog, Tailscale, Cloudflare in this project | None |
| OS-registered state | None — no Windows Task Scheduler / pm2 / launchd / systemd registrations involve TTS state | None |
| Secrets/env vars | `AGENTICLLMVTUBER_LLM_CONFIG_JSON` (Phase 2) read by sidecar — Phase 3 doesn't change. No new secrets introduced. No new env vars needed unless planner picks `AGENTICLLMVTUBER_TTS_DEVICE` for output-device override (deferred to v2 per CONTEXT). | None |
| Build artifacts / installed packages | `sidecar/.venv/` — `uv add` of piper-tts + sounddevice will pull new wheels. After Phase 3 lands, **a clean `uv sync` is required** to install new deps. PyInstaller binary (deferred per CLAUDE.md) is not a Phase-3 concern. | Document in plan: "after `uv add piper-tts==1.4.2 sounddevice==0.5.5`, a `uv sync` from sidecar/ is required for the dev's venv to pick up the new wheels." |

**Nothing found in any category beyond the build-artifact note.** Verified by inspecting the existing `sidecar/src/sidecar/` tree (Phase 1 + 2 modules); no orphan TTS state from prior phases (Phase 2 is stub-TTS-stdout-only; nothing to migrate).

## Common Pitfalls

### Pitfall 1: `OutputStream.write()` returns BEFORE audio plays — `chain-end` timing breaks D-09 UX

**What goes wrong:** Naive port of OLVT fires `chain-end` immediately after `asyncio.gather(*task_list)` completes. In OLVT, that gates on synth-complete, and the renderer plays audio AFTER receiving the WS envelope, so `chain-end` lands while the renderer is still playing — but the renderer's chat-state is reactive to its own audio completion. In our sidecar-playback world, `chain-end` shipping before audio drains causes the renderer's chat input to ungrey while the avatar is still speaking. Breaks D-09 UX contract.

**Why it happens:** `stream.write()` returns when bytes are accepted into the OS/PortAudio buffer (queued, not played). The buffer holds 50–250ms on Windows default latency settings. After the last `write()` for the last sentence returns, audio is still playing for `output_latency` seconds.

**How to avoid:** Pattern 5b — track `_last_write_finished_at = stream.time` after the final write; await `asyncio.sleep(stream.latency + 0.020)` before emitting `chain-end`. The 20ms margin absorbs scheduling jitter.

**Warning signs:** Visual: chat input ungreys mid-sentence. Acoustic: D-09 banner ("Teto is still speaking…") disappears while audio is still playing. Verifiable via the [TTS] log line `play_ended_at=Y` vs the `[CONTROL] chain-end` timestamp — `chain-end` should be ≥ `play_ended_at`.

### Pitfall 2: `time.monotonic()` for `started_at` — compositor lipsync lags by buffer depth

**What goes wrong:** Phase 4's compositor reads `volumes[index]` where `index = floor((now() - started_at) * 1000 / slice_length)`. If `started_at` is `time.monotonic()` at write-call-time, the compositor's index advances FROM THE MOMENT we queued the bytes, not from the moment the speaker emits them. Result: lipsync is ~50–250ms ahead of the audio (mouth opens before sound emerges).

**Why it happens:** PortAudio buffers a fixed amount. `time.monotonic()` doesn't know about it. `stream.time` is PortAudio's stream clock; adding `output_latency` (the queued-but-not-played seconds) gives audible-time-zero.

**How to avoid:** Per CONTEXT D-02 (LOCKED) — `started_at = stream.time + stream.output_latency` captured at the moment-of-write. Compositor (Phase 4) must read the same clock reference. Two choices:

- **Choice A (recommended):** publish `started_at` in `stream.time` units. Compositor calls `stream.time` to get "now" and computes `now - started_at` in stream-clock seconds.
- **Choice B:** publish `started_at` in `time.monotonic()` units, but offset by `output_latency` ahead-of-time. Compositor uses `time.monotonic()` for "now". Requires the offset to be re-checked per-write because Windows audio drivers can adjust output_latency dynamically.

**Recommendation:** Choice A. Stream-clock units are what `stream.time` returns natively; no offset gymnastics. Phase 4 contract: speech driver imports the stream from `tts_gateway.stream` and reads `stream.time` directly.

**Warning signs:** mouth animation visibly leads audio; SC#1 "synced lipsync" (Phase 5 verification) fails the eyeball test by tens of ms.

### Pitfall 3: Git LFS — clean-clone gets pointer files, sidecar fails with cryptic error

**What goes wrong:** A new dev clones the repo without `git lfs install` having been run on their machine, OR clones with `--no-checkout` semantics that skip LFS smudge. Result: `sidecar/models/piper/en_US-amy-medium.onnx` exists as a 134-byte text file containing `version https://git-lfs.github.com/spec/v1\noid sha256:...\nsize 63247424\n`. PiperVoice.load reads this as ONNX and crashes with a confusing "invalid model" error.

**Why it happens:** Git LFS is a separate-from-git tool. `git clone` only fetches LFS content if (a) `git lfs install` has run globally on the machine AT LEAST ONCE before the clone, OR (b) `git lfs pull` is run after clone. Neither is automatic from a fresh git install.

**How to avoid:**

1. README / CLAUDE.md / Phase 3 PROVENANCE.md: **explicitly document `git lfs install` as a one-time-per-machine prerequisite.**
2. Sidecar boot: detect-and-fail-loudly on LFS-pointer-file. Read the first 1KB of the .onnx file at boot; if it starts with `version https://git-lfs.github.com/spec/v1`, raise `RuntimeError("Voice model is a Git LFS pointer file. Run `git lfs install && git lfs pull` from the repo root.")`. Don't let PiperVoice.load fail with a cryptic ONNX error.
3. CI / clean-clone test: add a Phase 3 verification task "Clone the repo into a fresh dir; run `npm run dev`; assert TTS works on first message." This catches LFS misconfiguration end-to-end.

**Warning signs:** sidecar logs `Failed to load Piper model: ...` early in lifespan startup. The first user message produces no audio. Pointer-file content visible in `Get-Content sidecar/models/piper/en_US-amy-medium.onnx | Select-Object -First 3`.

### Pitfall 4: sounddevice on Windows + WASAPI — sample rate mismatch yields PaErrorCode -9997

**What goes wrong:** On Windows, sounddevice's default host API is WASAPI. WASAPI in shared mode REQUIRES the stream's sample rate to match the device's mix format (typically 48000 Hz). en_US-amy-medium is 22050 Hz. If we open `OutputStream(samplerate=22050, ...)` against the default WASAPI shared-mode device, it can fail with `PaErrorCode -9997` (Invalid sample rate).

**Why it happens:** WASAPI shared mode does not resample; PortAudio raises rather than silently mismatching.

**How to avoid:** Three valid patterns:

- **Pattern A (cleanest, LIKELY-WORKS-AS-IS):** Trust PortAudio's automatic resampling on the MME / DirectSound host APIs. sounddevice's default device is usually MME (`Microsoft Sound Mapper - Output`) on Windows, which resamples. Open the stream as `OutputStream(samplerate=22050, channels=1, dtype='int16')` with no explicit `device=` and trust the default. This is what the recommended pattern is — verify on first run.
- **Pattern B (resample upstream):** Always upsample piper output from 22050 → 48000 in numpy before write. Adds CPU cost (small for 22050→48000 = factor of 2.18; scipy.signal.resample_poly does this in <1ms for typical sentence sizes). Removes WASAPI dependency.
- **Pattern C (force MME):** Probe `sounddevice.query_hostapis()` at TTSGateway init; pick the MME entry; pass via `device=(idx, ...)` arg. Explicit but brittle (host API ordering varies).

**Recommendation:** Pattern A first (simplest; matches OLVT-grade simplicity); fall back to Pattern B only if SC#4 click/pop test fails or `OutputStream` open raises -9997 on the dev machine. Document the failure mode + Pattern B in `tts_gateway.py` docstring so the planner has the fallback at hand.

**Warning signs:** `PortAudioError: Error opening OutputStream: Invalid sample rate [PaErrorCode -9997]` at sidecar boot.

### Pitfall 5: Buffer underrun (xrun) under CPU spike — audible click + compositor `index` overshoots

**What goes wrong:** The CPU spikes (GC pause, antivirus scan, Windows update notification daemon) for 100ms while `OutputStream.write()` is mid-buffer. PortAudio's hardware buffer drains; the speaker emits silence; `OutputStream.write()` returns with `underflowed=True`. Audible click as audio resumes. Worse: compositor's `started_at` was captured before the underrun, so `index = floor((now() - started_at) * 50)` keeps advancing. By the time audio resumes, `index` overshoots `len(volumes)` and lipsync goes silent (closed mouth) for the remainder of the sentence.

**Why it happens:** PortAudio guarantees sample-accurate timing only when the producer keeps the buffer full. Any producer stall = underrun.

**How to avoid:**

1. Use `latency='high'` (sounddevice default) for skeleton — larger buffer = more spike-tolerance. CONTEXT marks `latency='low'` as Claude's Discretion; recommend default for skeleton.
2. Detect underruns: `write()` returns `bool` (= `underflowed`). Log `[TTS] xrun=True sentence_id=N` when True. Phase 5 verification can grep for these.
3. Compositor clamping (Phase 4 contract — surface to Phase 4 planner): if `index >= len(volumes)`, output `0.0` (silence/closed-mouth) until next sentence's envelope arrives. Better than reading garbage.

**Warning signs:** `[TTS] xrun=True` log lines correlate with audible clicks. Phase 5 SC#4 ("audio starts cleanly with no audible click/pop") would fail if xruns are common during normal use.

### Pitfall 6: Warmup throws on missing voice file — `[READY]` never emits, Electron hangs

**What goes wrong:** `PiperVoice.load("sidecar/models/piper/en_US-amy-medium.onnx")` raises FileNotFoundError if the model isn't present. If this happens in lifespan startup BEFORE `[READY]`, sidecar exits with a stack trace; Electron's READY-line parser hangs (Phase 1's BYO-socket pattern depends on the line emitting before serve).

**Why it happens:** LFS smudge skipped (Pitfall 3); or `python -m piper.download_voices` was never run; or path resolution differs in dev vs packaged binary (deferred to PyInstaller phase).

**How to avoid:** in lifespan startup, wrap TTSGateway construction in try/except. On failure: log `[TTS-INIT-FAILED] {error}`; emit `[READY]` anyway (Electron unblocks); sidecar runs WITHOUT TTS (audio envelope ships with `audio=null`, `volumes=[]` — same as Phase 2 stub). User sees a banner via WS error envelope on first text-input. Skeleton is degraded, not crashed.

This mirrors the existing pattern in `sidecar/src/sidecar/ws/server.py` lifespan: `provider_cfg is None or not teto_dir.exists()` → `app.state.orchestrator = None`; renderer gets a clear ErrorMessage on text-input.

**Warning signs:** sidecar log shows `[TTS-INIT-FAILED] FileNotFoundError: ...`; first text-input returns `{type:"error", message:"TTS not initialized..."}`.

### Pitfall 7: `synthesize_wav` written to `BytesIO` for warmup BUT `wave.open` requires `seek()` — fails on raw `BytesIO` if not opened correctly

**What goes wrong:** `wave.open(buffer, "wb")` calls `buffer.seek()` to fix up the header at close-time (it writes the RIFF size after audio data is known). `BytesIO()` supports seek; this works. BUT some BytesIO-like wrappers (e.g., reading a pipe) don't. We're using plain `BytesIO()` for warmup so this is fine — flagged for completeness.

**How to avoid:** stick with `from io import BytesIO; buf = BytesIO(); with wave.open(buf, "wb") as wf: ...; buf.seek(0); audio_bytes = buf.getvalue()`. Test pattern is in "Code Examples" below.

## Code Examples

### Example 1: TTSGateway boot warmup (Pattern 1)

```python
# Source: this RESEARCH.md synthesis of CONTEXT D-06/D-07/D-08 +
#         piper API_PYTHON.md + sounddevice 0.5.5 docs.
# File:   sidecar/src/sidecar/tts/tts_gateway.py

from __future__ import annotations
from io import BytesIO
from pathlib import Path
import wave

import sounddevice as sd
from loguru import logger
from piper import PiperVoice


class TTSGateway:
    """Owns PiperVoice + global OutputStream. Constructed once at sidecar
    boot (FastAPI lifespan startup) BEFORE [READY] emits. Stream stays open
    for sidecar lifetime; closed in lifespan shutdown.

    D-06: warmup BEFORE [READY].
    D-07: warmup scope = piper model + ORT JIT + sounddevice OutputStream.
    D-08: warmup audio is synth-and-discard (not written to OutputStream).
    """

    def __init__(self, model_path: Path) -> None:
        self.model_path = model_path
        self.voice: PiperVoice | None = None
        self.stream: sd.OutputStream | None = None
        self.sample_rate: int = 0  # populated after voice load

    def boot(self) -> None:
        """Synchronous; called from FastAPI lifespan startup BEFORE [READY]."""
        self._guard_lfs_pointer(self.model_path)  # Pitfall 3 mitigation
        logger.info(f"[TTS-INIT] loading PiperVoice from {self.model_path}")
        self.voice = PiperVoice.load(str(self.model_path))  # auto-loads .onnx.json
        self.sample_rate = self.voice.config.sample_rate    # 22050 for amy-medium
        logger.info(f"[TTS-INIT] voice loaded; sample_rate={self.sample_rate}")

        # D-08: synth-and-discard one token to warm ORT JIT.
        # voice.synthesize() yields AudioChunk; iterate to force inference.
        for _ in self.voice.synthesize("."):
            pass
        logger.info("[TTS-INIT] ORT JIT warmup complete (synth-and-discard).")

        # D-07: open + start the long-lived stream. latency='high' (default) for
        # spike-tolerance per Pitfall 5. dtype='int16' matches piper output.
        # No device= → trust default (likely MME on Windows; resamples 22050 if
        # WASAPI is selected — see Pitfall 4).
        self.stream = sd.OutputStream(
            samplerate=self.sample_rate,
            channels=1,
            dtype="int16",
            # latency=None → 'high' default; safer than 'low' for skeleton.
        )
        self.stream.start()
        logger.info(
            f"[TTS-INIT] OutputStream open: latency={self.stream.latency:.3f}s"
        )

    def shutdown(self) -> None:
        """Close stream in lifespan shutdown (Phase 1 graceful-shutdown extension)."""
        if self.stream is not None:
            try:
                self.stream.stop()   # waits for hardware drain (sounddevice docs)
                self.stream.close()
            except Exception:
                logger.exception("[TTS-SHUTDOWN] OutputStream.close failed")
            self.stream = None

    @staticmethod
    def _guard_lfs_pointer(path: Path) -> None:
        """Pitfall 3: detect Git LFS pointer file masquerading as the .onnx."""
        if not path.exists():
            raise FileNotFoundError(
                f"Voice model not found at {path}. "
                f"Run `python -m piper.download_voices en_US-amy-medium` "
                f"into sidecar/models/piper/, then commit via Git LFS."
            )
        with path.open("rb") as f:
            head = f.read(64)
        if head.startswith(b"version https://git-lfs.github.com/spec/v1"):
            raise RuntimeError(
                f"Voice model at {path} is a Git LFS pointer file. "
                f"Run `git lfs install && git lfs pull` from repo root."
            )
```

### Example 2: numpy chunk-RMS replacing pydub `_get_volume_by_chunks` (D-12)

```python
# Source: CONTEXT D-12 (numpy substitution recommended) + OLVT
#         OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py:8-24
#         (pydub-based reference impl).
# File:   sidecar/src/sidecar/tts/audio_payload_helpers.py

from __future__ import annotations
import numpy as np


def get_volume_by_chunks(
    pcm_int16: bytes, sample_rate: int, chunk_length_ms: int = 20
) -> list[float]:
    """OLVT-shape RMS envelope: one float per chunk_length_ms slice,
    normalized to max RMS in the sentence. Replaces OLVT's pydub-based
    _get_volume_by_chunks (drops pydub + FFmpeg dep). ~12 LOC of math.

    Args:
        pcm_int16: raw int16 PCM bytes (mono) from
                   piper AudioChunk.audio_int16_bytes.
        sample_rate: 22050 for amy-medium.
        chunk_length_ms: 20 (OLVT default, locked by Phase 2 D-02 + Amendment).

    Returns:
        list[float] of normalized volumes in [0.0, 1.0]. Empty list if
        pcm_int16 is empty (mirrors the dict-empty edge case OLVT raises on,
        but caller can decide — silent payload uses volumes=[]).
    """
    if not pcm_int16:
        return []

    samples = np.frombuffer(pcm_int16, dtype=np.int16)
    samples_per_chunk = int(sample_rate * chunk_length_ms / 1000)  # = 441 @ 22050+20ms
    if samples_per_chunk <= 0 or len(samples) < samples_per_chunk:
        # Sentence shorter than one chunk — return one RMS over whatever exists.
        rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2))) or 0.0
        return [1.0] if rms > 0.0 else [0.0]

    # Truncate to whole chunks (OLVT pydub.make_chunks discards trailing partial).
    n_chunks = len(samples) // samples_per_chunk
    truncated = samples[: n_chunks * samples_per_chunk]
    chunks = truncated.reshape(n_chunks, samples_per_chunk).astype(np.float64)
    rms_per_chunk = np.sqrt(np.mean(chunks ** 2, axis=1))
    max_rms = float(rms_per_chunk.max())
    if max_rms == 0.0:
        return [0.0] * n_chunks  # silent sentence — don't divide by zero
    return (rms_per_chunk / max_rms).tolist()
```

**Verification fixture (planner suggestion for `tests/test_audio_payload_helpers.py`):**

- Empty bytes → `[]`
- 1ms of silence (zero-bytes) → `[0.0]` (single short chunk path)
- Constant tone (sin wave at 22050 Hz over 100ms) → 5 chunks, all near 1.0 (uniform amplitude)
- Linear ramp from silence to full int16 → ascending values, last ≈ 1.0
- Cross-check against pydub: synthesize one piper sentence; compute volumes via OLVT pydub path AND our numpy path; assert per-chunk values within ±0.01 (RMS rounding tolerance).

### Example 3: prepare_audio_payload (D-12 port + sidecar-playback adaptation)

```python
# Source: OLVT OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py
#         (verbatim port + AudioChunk/numpy adaptation).
# File:   sidecar/src/sidecar/tts/audio_payload_helpers.py (continued)

from __future__ import annotations
import base64
import wave
from io import BytesIO
from typing import Iterable

from piper import AudioChunk

from contracts import ActionIntent, AudioPayloadMessage, DisplayTextField

from .audio_payload_helpers import get_volume_by_chunks


def synthesize_and_prepare_payload(
    voice,
    tts_text: str,
    display_text: DisplayTextField,
    actions: list[ActionIntent],
    sentence_id: int,
    chunk_length_ms: int = 20,
) -> tuple[AudioPayloadMessage, bytes, int]:
    """Synthesize one sentence; produce the OLVT-canonical audio envelope
    + raw int16 PCM bytes + sample_rate, all from a single synth pass.

    Returns:
        (audio_payload_message, pcm_int16_bytes, sample_rate)
            - audio_payload_message: ready to ws.send_json(model_dump()).
            - pcm_int16_bytes: ready for stream.write(...).
            - sample_rate: from voice.config.sample_rate (e.g., 22050).

    Empty / whitespace-only TTS text → silent payload (audio=None, volumes=[])
    matching OLVT _send_silent_payload behavior.
    """
    # Silent fast-path (mirror OLVT TTSTaskManager.speak whitespace check).
    import re
    if len(re.sub(r'[\s.,!?，。！？\'"』」）】\s]+', "", tts_text)) == 0:
        msg = AudioPayloadMessage(
            audio=None, volumes=[], slice_length=chunk_length_ms,
            display_text=display_text, actions=actions, sentence_id=sentence_id,
            forwarded=False,
        )
        return msg, b"", voice.config.sample_rate

    # Single synth pass — collect all int16 chunks.
    pcm_chunks: list[bytes] = []
    sample_rate: int = voice.config.sample_rate
    for chunk in voice.synthesize(tts_text):  # AudioChunk
        pcm_chunks.append(chunk.audio_int16_bytes)
        sample_rate = chunk.sample_rate  # constant per voice; safe to overwrite
    pcm_int16 = b"".join(pcm_chunks)

    # Volumes: numpy chunk-RMS over the same bytes.
    volumes = get_volume_by_chunks(pcm_int16, sample_rate, chunk_length_ms)

    # base64 WAV: assemble header in-memory via stdlib wave.
    wav_buf = BytesIO()
    with wave.open(wav_buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)        # int16 = 2 bytes
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_int16)
    audio_b64 = base64.b64encode(wav_buf.getvalue()).decode("utf-8")

    msg = AudioPayloadMessage(
        audio=audio_b64,
        volumes=volumes,
        slice_length=chunk_length_ms,
        display_text=display_text,
        actions=actions,
        sentence_id=sentence_id,
        forwarded=False,
    )
    return msg, pcm_int16, sample_rate
```

### Example 4: TTSTaskManager sender adapted for sidecar playback (D-11)

```python
# Source: OLVT OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py
#         (port verbatim + sender adaptation per D-11).
# File:   sidecar/src/sidecar/tts/tts_manager.py (excerpt — sender task only)

from __future__ import annotations
import asyncio
import json
import time
from typing import Any

from fastapi import WebSocket
from loguru import logger

from contracts import SpeechEnvelopePayload, AudioPayloadMessage


class TTSTaskManager:
    # ... (init, speak, _process_tts, etc. — all OLVT-verbatim) ...

    async def _process_payload_queue(self, ws: WebSocket) -> None:
        """ADAPTED for sidecar-playback (D-11). For each in-order payload:
          1. Compute started_at = stream.time + stream.output_latency
             (D-02 — captured at moment-of-write).
          2. Publish SpeechEnvelopePayload to compositor_speech_queue (D-05).
          3. Send AudioPayloadMessage via ws.send_json (OLVT canonical).
          4. await loop.run_in_executor(None, stream.write, pcm_bytes)
             — blocking write on a thread to avoid stalling the event loop.

        Order is locked: queue.put → ws_send → stream.write.
        """
        buffered: dict[int, dict[str, Any]] = {}
        loop = asyncio.get_running_loop()

        while True:
            try:
                item: dict[str, Any]
                seq: int
                item, seq = await self._payload_queue.get()
                buffered[seq] = item

                # Send in-order (OLVT pattern).
                while self._next_sequence_to_send in buffered:
                    next_item = buffered.pop(self._next_sequence_to_send)
                    msg: AudioPayloadMessage = next_item["msg"]
                    pcm: bytes = next_item["pcm"]
                    sample_rate: int = next_item["sample_rate"]
                    sentence_id: int = msg.sentence_id

                    if pcm:
                        # 1. Capture audible-time-zero (D-02).
                        started_at = self._stream.time + self._stream.latency

                        # 2. Publish speech envelope FIRST (D-05).
                        envelope = SpeechEnvelopePayload(
                            sentence_id=sentence_id,
                            volumes=msg.volumes,
                            slice_length=msg.slice_length,
                            started_at=started_at,
                        )
                        await self._compositor_speech_queue.put(envelope)

                        # 3. Send WS envelope (OLVT-canonical).
                        await ws.send_json(msg.model_dump())

                        # 4. Blocking write off the event loop.
                        synth_started_at = next_item["synth_started_at"]
                        synth_ms = (time.monotonic() - synth_started_at) * 1000
                        underflowed = await loop.run_in_executor(
                            None, self._stream.write, pcm
                        )
                        write_finished_at = self._stream.time

                        # SC #2 verification log line.
                        logger.info(
                            f"[TTS] sentence_id={sentence_id} "
                            f"synth_ms={synth_ms:.0f} "
                            f"started_at={started_at:.3f} "
                            f"volumes_n={len(msg.volumes)} "
                            f"slice_ms={msg.slice_length} "
                            f"xrun={underflowed}"
                        )

                        # For D-14 wait_for_all_audio_complete: track the LAST
                        # write's stream.time so we can sleep stream.latency
                        # seconds beyond it before chain-end.
                        self._last_write_finished_at = write_finished_at
                    else:
                        # Silent payload — no PCM to write; still ship envelope.
                        await ws.send_json(msg.model_dump())

                    self._next_sequence_to_send += 1

                self._payload_queue.task_done()

            except asyncio.CancelledError:
                break
```

### Example 5: D-14 wait_for_all_audio_complete

```python
# File: sidecar/src/sidecar/tts/tts_manager.py (continued)
import asyncio


async def wait_for_all_audio_complete(self) -> None:
    """D-14: gate chain-end on hardware drain of last sentence.

    Waits for:
      (a) all _process_tts coroutines (synth) to finish — OLVT-verbatim
          asyncio.gather(*self.task_list).
      (b) the in-order sender task to drain its queue (since synth completion
          doesn't imply playback).
      (c) the last write's PortAudio buffer to drain (output_latency seconds
          beyond stream.time when the last write returned).

    After this returns, it is safe to emit force-new-message + chain-end.
    """
    # (a) wait for synth.
    if self.task_list:
        await asyncio.gather(*self.task_list, return_exceptions=True)

    # (b) wait for in-order sender to consume all buffered payloads.
    await self._payload_queue.join()  # asyncio.Queue.join — blocks on task_done

    # (c) wait for hardware drain.
    if self._last_write_finished_at is not None:
        # `latency` is a float (output side for OutputStream) — buffered seconds.
        # +20ms safety margin for scheduling jitter (Pitfall 1).
        drain_s = float(self._stream.latency) + 0.020
        await asyncio.sleep(drain_s)
```

### Example 6: SpeechEnvelopePayload Pydantic + TS mirror (D-05)

```python
# File: packages/contracts/py/contracts/speech_envelope.py

from pydantic import BaseModel


class SpeechEnvelopePayload(BaseModel):
    """In-process queue payload — NOT a WS message. Published by
    TTSTaskManager._process_payload_queue at write-time (D-02 / D-05);
    consumed by Phase 4 compositor speech driver.

    sentence_id: cross-envelope correlation key (D-13). Same value as
                 AudioPayloadMessage.sentence_id for the same sentence.
    volumes:     OLVT-shape RMS envelope, slice_length-ms slices, normalized
                 to per-sentence max. Phase 4 reads volumes[i] / volumes[i+1]
                 with linear interp (D-04).
    slice_length: ms per slice; OLVT-canonical 20.
    started_at:  stream.time + stream.output_latency at the moment the
                 sender task called stream.write() for sentence's first chunk.
                 Compositor reads stream.time directly to compute
                 elapsed = stream.time - started_at; index = floor(
                 elapsed * 1000 / slice_length).
    """
    sentence_id: int
    volumes: list[float]
    slice_length: int
    started_at: float
```

```typescript
// File: packages/contracts/ts/speech-envelope.ts
// Hand-mirrored TS — codegen replaces in Phase 5 (SC-02).

export interface SpeechEnvelopePayload {
  sentence_id: number;
  volumes: number[];
  slice_length: number;
  started_at: number;
}
```

### Example 7: lifespan startup wiring (Phase 3 extension to ws/server.py)

```python
# File: sidecar/src/sidecar/ws/server.py (excerpt — lifespan extension)

from sidecar.tts.tts_gateway import TTSGateway
from sidecar.tts.tts_manager import TTSTaskManager


@asynccontextmanager
async def lifespan(app: FastAPI):
    provider_cfg = _load_provider_config_from_env()
    avatars = _avatars_root()
    teto_dir = avatars / "teto"
    tts_gateway: TTSGateway | None = None
    drain_task: asyncio.Task | None = None
    turn_loop_task: asyncio.Task | None = None

    if provider_cfg is None or not teto_dir.exists():
        # Phase 2 path — orchestrator inactive.
        app.state.orchestrator = None
    else:
        try:
            capabilities = load_capabilities(teto_dir)
            persona = (teto_dir / "personality.md").read_text(encoding="utf-8")

            # Phase 3: TTS warmup BEFORE [READY] (D-06).
            model_path = (
                Path(__file__).resolve().parents[4]
                / "sidecar" / "models" / "piper"
                / f"{capabilities.voice.model}.onnx"
            )
            tts_gateway = TTSGateway(model_path)
            tts_gateway.boot()  # synchronous — blocks lifespan startup, that's fine
                                # because [READY] hasn't emitted yet.

            gateway = LLMGateway(provider_cfg)
            await _warmup_ping(gateway)  # Phase 2 LLM warmup, kept

            # New queues per Phase 3 D-05 + D-09.
            compositor_speech_queue: asyncio.Queue = asyncio.Queue()
            tts_manager = TTSTaskManager(
                stream=tts_gateway.stream,
                voice=tts_gateway.voice,
                compositor_speech_queue=compositor_speech_queue,
            )

            app.state.orchestrator = Orchestrator(
                gateway=gateway,
                capabilities=capabilities,
                persona_text=persona,
                tts_manager=tts_manager,
                compositor_speech_queue=compositor_speech_queue,
            )
            app.state.tts_gateway = tts_gateway

            # No-op drain task (Phase 4 swaps in real consumer).
            drain_task = asyncio.create_task(
                _drain_speech_queue_until_phase4(compositor_speech_queue)
            )
            # Pending-input turn loop (D-09).
            turn_loop_task = asyncio.create_task(
                app.state.orchestrator._turn_loop()
            )
            loguru_logger.info("[READY] orchestrator + TTS initialized.")
        except Exception:
            loguru_logger.exception("Phase 3 init failed (sidecar runs in degraded mode).")
            app.state.orchestrator = None
            app.state.tts_gateway = None

    yield

    # Shutdown.
    if turn_loop_task is not None:
        turn_loop_task.cancel()
    if drain_task is not None:
        drain_task.cancel()
    if tts_gateway is not None:
        tts_gateway.shutdown()
```

### Example 8: Git LFS init checklist for repo's first-time use (D-10)

```powershell
# One-time per developer machine (Pitfall 3):
git lfs install     # configures the smudge filter in ~/.gitconfig

# One-time per repo (Phase 3 plan; the dev who lands the phase does this):
cd C:\Users\16079\Code\AgenticLLMVTuber
@'
sidecar/models/piper/*.onnx filter=lfs diff=lfs merge=lfs -text
'@ | Out-File -Encoding utf8 -NoNewline .gitattributes

git add .gitattributes
git commit -m "chore(03): enable Git LFS for piper voice models"

# Download voice (one-time per voice):
mkdir sidecar/models/piper -Force
cd sidecar/models/piper
python -m piper.download_voices en_US-amy-medium
# Produces:
#   en_US-amy-medium.onnx       (63.2 MB — LFS-tracked)
#   en_US-amy-medium.onnx.json  (4.88 KB — NOT LFS, small + needs diff)

# Commit the model:
cd ../../..
git add sidecar/models/piper/en_US-amy-medium.onnx sidecar/models/piper/en_US-amy-medium.onnx.json
git commit -m "feat(03): bundle en_US-amy-medium piper voice via Git LFS"

# Verify LFS smudge worked:
git lfs ls-files
# Expected output:
#   <oid> * sidecar/models/piper/en_US-amy-medium.onnx

# Verify the tracked file is NOT a pointer file (i.e., LFS pull resolved it):
git check-attr filter sidecar/models/piper/en_US-amy-medium.onnx
# Expected: sidecar/models/piper/en_US-amy-medium.onnx: filter: lfs

# Read first 64 bytes — should NOT start with "version https://git-lfs.github.com..."
Get-Content -Path sidecar/models/piper/en_US-amy-medium.onnx -TotalCount 1 -Encoding Byte | Select-Object -First 8
# Expected: ONNX magic bytes (08 ...).

# Push to remote — LFS upload is automatic:
git push
```

**Clean-clone verification (planner: add this as Phase 3 verification step):**

```powershell
# In a fresh clone:
git clone <repo-url> agentic-test
cd agentic-test
# git lfs install must have been run on this machine at least once before.
git lfs pull   # idempotent if it already happened during clone
# Confirm the .onnx is real (not a pointer):
$head = Get-Content sidecar/models/piper/en_US-amy-medium.onnx -TotalCount 1 -Encoding Byte
$head[0] -eq 8   # ONNX-magic first byte; True if real
# Run the sidecar; first text-input should produce audio.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OLVT renderer-side audio playback (Cubism `_wavFileHandler`) | Sidecar-side `sounddevice.OutputStream` | 2026-05-06 (CONTEXT D-01) | Renderer no longer needs Cubism; lipsync flows sidecar→VTS direct (AVT-01); WS envelope still ships `audio` + `volumes` for OLVT protocol parity |
| OLVT pydub `AudioSegment.make_chunks` for RMS | numpy reshape + sqrt(mean(x**2, axis=1)) | 2026-05-06 (CONTEXT D-12) | Drops pydub + FFmpeg (~50MB on disk); numpy already a transitive dep; ~12 LOC |
| OLVT `audio_b64` / `audio-payload` envelope names | OLVT-canonical `audio` / `audio` (verified against `stream_audio.py:50-60`) | Phase 2 02-CONTEXT-AMENDMENT (2026-05-06) | Envelope-name parity with OLVT preserved; Phase 3 fills `audio` (not `audio_b64`) |
| `piper-onnx` (older smaller wrapper package) | `piper-tts` (1.4.2, current main) | CLAUDE.md stack pin | piper-tts has the full Python API surface; piper-onnx is the lighter wrapper (we don't need lighter — we want full API) |
| `wave.open` + temp-file pattern (OLVT) | `wave.open(BytesIO())` + single-pass synth-to-bytes | This phase | One disk roundtrip eliminated per sentence (~80ms on Windows); piper.synthesize yields raw int16 directly so we never need a temp file |

**Deprecated/outdated:**
- **`piper-onnx`** — reserved for use cases where you want ONNX-only without espeak-ng / phonemization stack. We need full pipeline (text → audio); use `piper-tts` (CLAUDE.md confirmed).
- **`piper` (no suffix)** — older package name; project moved to `piper-tts` and `piper1-gpl` GitHub org (the `1-gpl` suffix indicates the GPL-licensed lineage Anthropic-of-the-piper-project, OHF Voice).
- **OLVT `tts_manager.clear()` invoked on user input** — interrupt pattern; CONTEXT D-09 picks let-finish + queue. `clear()` is preserved for v2 hard-stop, only invoked at orchestrator shutdown in skeleton.

## Open Questions

### 1. Sample rate config — yaml field vs derived from PiperVoice.config

- **What we know:** `PiperVoice.config.sample_rate` is a reliable root-level int field on the loaded voice (verified from piper1-gpl source). For en_US-amy-medium = 22050.
- **What's unclear:** Should `avatars/teto/avatar.yaml.voice.sample_rate` be added? Pro: explicit; readable without loading the voice; matches AvatarCapabilities-as-source-of-truth philosophy. Con: redundant; can drift from voice.config.sample_rate; one more field for Phase 4 introspection to overwrite.
- **Recommendation:** **Drop the yaml field; derive from `PiperVoice.config.sample_rate`.** The voice config IS the source of truth for the sample rate; storing it twice invites drift. AvatarCapabilities already has the model name; deriving from the model is what every consumer should do anyway.

### 2. `latency='low'` vs default on Windows

- **What we know:** sounddevice latency modes are `'low'`, `'high'` (default), or numeric seconds. `'high'` is "more robust" against underruns. Default OutputStream latency on Windows MME is ~150–250ms; `'low'` typically 50–100ms.
- **What's unclear:** Does compositor lipsync look noticeably less synced at 250ms latency? Lipsync precision target is "within 50ms" (typical perceptual threshold for audio-video sync).
- **Recommendation:** Skeleton ships **default (`'high'`)** per Pitfall 5 spike-tolerance. Phase 4's compositor reads `stream.latency` from the gateway and uses the live value in its `started_at` math — so latency value doesn't break sync, only changes the buffer size. If SC#1 (synced lipsync) fails the eyeball test, planner can flip to `latency='low'` as a single-line change. Re-evaluate then.

### 3. `stream.time` vs `time.monotonic()` for `started_at`

- **What we know:** `stream.time` is PortAudio's monotonic stream clock; valid lifetime of stream; co-references the time argument in callback signatures.
- **What's unclear:** `time.monotonic()` is simpler but doesn't share a clock with PortAudio. `stream.time` is precise but couples Phase 4 compositor to the same `stream` instance.
- **Recommendation:** **Use `stream.time` end-to-end.** Both producer (TTSTaskManager) and consumer (Phase 4 compositor) read `stream.time` from the same `tts_gateway.stream` reference. Phase 4 imports `tts_gateway` from `app.state` and reads `stream.time` for "now". This couples Phase 4 to the gateway, but they're in the same sidecar process; the coupling is no worse than Phase 4 importing `compositor_speech_queue` from the orchestrator.

### 4. Implicit vs explicit per-sentence end-of-audio signal

- **What we know:** Implicit = compositor reads `volumes[index]` until `index >= len(volumes)`; outputs 0.0 thereafter. Explicit = TTSTaskManager publishes `SpeechEnvelopeEndPayload(sentence_id)` when sentence's audio drains.
- **What's unclear:** Does Phase 4 need the explicit signal for anything beyond closed-mouth-on-end? If Phase 4 wants to fade out body sway over a known duration after the sentence ends, explicit gives a cleaner trigger.
- **Recommendation:** **Implicit in skeleton.** Phase 4 plans the addition if needed. The contract is forward-extensible — adding `SpeechEnvelopeEndPayload` later doesn't break the existing payload schema.

### 5. `[TTS]` log line format for SC #2 verification (parallel-synth proof)

- **What we know:** SC #2 wants logs proving sentence N's audio plays while sentence N+1's synth is still running.
- **Recommendation (planner can finalize):**

```
[TTS-SYNTH-START] sentence_id=N text="..." spawn_at=<float>
[TTS-SYNTH-END]   sentence_id=N synth_ms=<float>
[TTS-WRITE-START] sentence_id=N started_at=<float> volumes_n=<int> slice_ms=<int>
[TTS-WRITE-END]   sentence_id=N write_ms=<float> xrun=<bool>
[TTS-DRAIN-END]   sentence_id=N drain_ms=<float>   # only on the last sentence of a turn
```

SC #2 grep: `[TTS-WRITE-START] sentence_id=1 ... ` should appear in the log BEFORE `[TTS-SYNTH-END] sentence_id=2` for any 2+-sentence turn.

### 6. Sounddevice xrun handling under load

- **What we know:** `write()` returns `underflowed=True` on detected underrun. Compositor index overshoots by xrun gap.
- **Recommendation:** Log `[TTS-WRITE-END] ... xrun=True` (already in the log format above). Phase 5 verification: if any normal-use turn produces xrun=True, SC#4 fails. Phase 4 compositor's clamping (output 0.0 when `index >= len(volumes)`) mitigates the visual symptom. No skeleton-level recovery; fix at next milestone if it surfaces.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12.x | Sidecar runtime | ✓ | 3.12 (CLAUDE.md pin; existing sidecar venv at `sidecar/.venv/`) | — |
| uv | Python package mgmt | ✓ | (Phase 1 already uses) | pip + venv (slower; uv is preferred) |
| Git LFS | D-10 voice model packaging | ✓ | git-lfs/3.6.1 (verified via `git lfs version`) | — |
| `piper-tts` 1.4.2 | TTS-01 / TTS backend | Pending (`uv add` per Phase 3 plan) | 1.4.2 (PyPI, 2026-04-02) | — |
| `sounddevice` 0.5.5 | TTS-02 / sidecar audio playback | Pending (`uv add`) | 0.5.5 (PyPI, 2026-01-23) | — |
| numpy | TTS-03 / RMS chunking | ✓ (transitive via litellm + piper-tts) | 1.26+ or 2.x (verify after install) | — |
| PortAudio (bundled in sounddevice wheel on Windows) | sounddevice runtime | ✓ (bundled in `sounddevice` py3-none-win_amd64 wheel) | (PortAudio version per sounddevice 0.5.5 wheel) | If wheel install fails on Windows: `winget install PortAudio` then `uv add --no-binary sounddevice sounddevice` (rare; prebuilt wheel is the normal path) |
| Default audio output device | OutputStream playback | ✓ (any Windows machine has at least one default output via MME) | — | If `OutputStream(samplerate=22050)` raises -9997 on user's WASAPI-only setup: probe host APIs at boot, prefer MME (Pitfall 4 Pattern C) |
| en_US-amy-medium voice | TTS-01 default voice | Pending (`python -m piper.download_voices` once, then commit via LFS) | 22050 Hz mono int16, 63.2 MB onnx + 4.88 KB json | — |

**Missing dependencies with no fallback:** None. All blockers have a clear install path.

**Missing dependencies with fallback:**
- WASAPI sample-rate mismatch (Pitfall 4) → fall back to MME host API or numpy upsample; planner decides at execution time based on whether the dev machine reproduces the error.

## Sources

### Primary (HIGH confidence)

- [piper-tts on PyPI](https://pypi.org/project/piper-tts/) — version 1.4.2, release 2026-04-02, Python ≥3.9
- [piper1-gpl docs/API_PYTHON.md (OHF-Voice/piper1-gpl)](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md) — `PiperVoice.load`, `synthesize`, `synthesize_wav`, AudioChunk fields
- [piper1-gpl src/piper/voice.py](https://github.com/OHF-voice/piper1-gpl/blob/main/src/piper/voice.py) — load() classmethod signature; synthesize_wav writes sample_rate from AudioChunk
- [piper1-gpl src/piper/config.py](https://github.com/OHF-voice/piper1-gpl/blob/main/src/piper/config.py) — `PiperConfig.sample_rate` is root-level int; `from_dict` reads from `config["audio"]["sample_rate"]`
- [piper1-gpl docs/CLI.md](https://github.com/OHF-voice/piper1-gpl/blob/main/docs/CLI.md) — `python -m piper.download_voices` + `--data-dir` override
- [en_US-amy-medium on HuggingFace rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/amy/medium) — file sizes verified: .onnx = 63.2 MB, .onnx.json = 4.88 KB
- [en_US-amy-medium.onnx.json metadata](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json) — sample_rate=22050, num_speakers=1, language en_US, dataset amy
- [python-sounddevice docs (0.5.2)](https://python-sounddevice.readthedocs.io/en/0.5.2/api/streams.html) — OutputStream API, write() block semantics, .time, .latency, stop() drain behavior
- [python-sounddevice on PyPI](https://pypi.org/project/sounddevice/) — version 0.5.5, release 2026-01-23
- [python-sounddevice asyncio_coroutines.py example](https://github.com/spatialaudio/python-sounddevice/blob/master/examples/asyncio_coroutines.py) — canonical asyncio + callback pattern (we use blocking-write+executor instead, documented tradeoff)
- [Open-LLM-VTuber tts_manager.py (sibling project, MIT)](file:///C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/conversations/tts_manager.py) — port verbatim per D-11
- [Open-LLM-VTuber stream_audio.py](file:///C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py) — prepare_audio_payload + _get_volume_by_chunks reference
- [Open-LLM-VTuber piper_tts.py](file:///C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/tts/piper_tts.py) — PiperVoice + SynthesisConfig usage reference
- [Open-LLM-VTuber single_conversation.py + conversation_utils.py](file:///C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/conversations/) — turn lifecycle + force-new-message + chain-end signal placement (D-14 amends timing)
- [git-lfs.com](https://git-lfs.com/) — Git LFS protocol + .gitattributes pattern
- [Atlassian Git LFS Tutorial](https://www.atlassian.com/git/tutorials/git-lfs) — `*.onnx filter=lfs diff=lfs merge=lfs -text` pattern; commit .gitattributes BEFORE the large file
- [git-lfs version on dev machine](file:///C:/Users/16079/Code/AgenticLLMVTuber) — `git lfs version` returned `git-lfs/3.6.1 (GitHub; windows amd64; go 1.23.3; git ea47a34b)`

### Secondary (MEDIUM confidence — multiple sources / verified-against-official)

- [ONNX Runtime warmup pattern (onnxruntime.ai/docs/performance/troubleshooting)](https://onnxruntime.ai/docs/performance/tune-performance/troubleshooting.html) — first-inference primes graph optimization + kernels; warmup loop is canonical
- [sounddevice WASAPI host API (DeepWiki spatialaudio/python-sounddevice/3.5)](https://deepwiki.com/spatialaudio/python-sounddevice/3.5-platform-specific-settings) — WASAPI is default on Windows Vista+; shared mode requires sample-rate match
- [PaErrorCode reference (sounddevice issues #298, #546)](https://github.com/spatialaudio/python-sounddevice/issues/) — -9996/-9997/-9998 meanings; sample-rate mismatch yields -9997
- [SuperKogito RMS normalization Python](https://superkogito.github.io/blog/2020/04/30/rms_normalization.html) — sqrt(mean(x**2)) chunk pattern verified
- [int16 to float64 conversion for RMS (cinemetrics)](https://github.com/freder/cinemetrics/blob/master/05_2_audio.py) — int16-aware float promotion before mean to avoid overflow

### Tertiary (LOW confidence — informational, not load-bearing)

- General Git LFS Windows pitfalls (multiple stackoverflow / GitLab docs) — covered in Pitfall 3 mitigation; conservative approach (read-first-bytes guard) addresses the failure mode regardless

## Metadata

**Confidence breakdown:**

- Standard stack (piper-tts 1.4.2, sounddevice 0.5.5): **HIGH** — verified against PyPI release pages 2026-05-06.
- Architecture (TTSTaskManager OLVT port + sidecar adaptation): **HIGH** — OLVT source is local (`C:/Users/16079/Code/OpenLLM_Vtuber/`); CONTEXT D-11 locks verbatim port.
- Audio sync (started_at = stream.time + output_latency): **HIGH** — sounddevice docs confirm `stream.time` is PortAudio's monotonic clock; `.latency` returns measured output latency; CONTEXT D-02 LOCKED.
- D-14 drain semantics: **HIGH** — sounddevice docs confirm `stream.write()` returns when buffered (not played); `stream.stop()` drains; the sleep-by-latency pattern is the standard work-around for keeping the stream open.
- Pitfall 4 (WASAPI sample rate): **MEDIUM** — multiple GitHub issues confirm -9997 on sample-rate mismatch with WASAPI shared mode; default-host-API behavior on Windows is mixed across reports (some say MME default, some say WASAPI). Mitigation (Pattern A: trust default; Pattern B: resample) is robust either way.
- Git LFS init checklist: **HIGH** — current GitHub/Atlassian docs; `git-lfs/3.6.1` on dev machine confirmed.
- numpy chunk-RMS substitution: **HIGH** — math is straightforward; multiple equivalent implementations cross-checked; OLVT pydub reference is byte-equivalent up to int16 → float promotion.
- `voice.config.sample_rate` reliability: **HIGH** — verified against `piper1-gpl/src/piper/config.py` source: it's a documented dataclass field, set by `from_dict()` from `config["audio"]["sample_rate"]`.

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days for stable libraries; piper-tts is Alpha-status development so re-check version pin if a Phase 3 task starts after this date)
