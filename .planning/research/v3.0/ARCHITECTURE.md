# Architecture: v3.0 Rich Voice Configuration + Voice Input

**Project:** AgenticLLMVTuber  
**Milestone:** v3.0 Rich Voice Configuration + Voice Input  
**Researched:** 2026-05-09  
**Overall confidence:** MEDIUM-HIGH for integration shape; MEDIUM for AEC until live no-headphones tests pass.

## Executive Recommendation

Keep the current conversation and playback ownership model intact: **Electron renderer owns user interaction and persisted chat-session writes; Python sidecar owns audio providers, sidecar playback, VAD/STT, TTS synthesis, and VTS/lipsync timing**. Do not let new TTS providers write audio themselves, and do not let STT bypass the renderer's existing text-submission path unless a later phase also moves conversation-history commits into the sidecar.

The safest v3.0 architecture is:

1. Refactor Piper into a **sidecar TTS provider interface** whose only job is `synthesize(text, preset) -> PCM + sample_rate + optional metadata`.
2. Keep ordered playback, `AudioPayloadMessage`, RMS generation, WebSocket `audio` emission, and compositor `SpeechEnvelopePayload` publication inside an enhanced `TTSTaskManager` / audio-output layer.
3. Add a **sidecar STT service** modeled after Open-LLM-VTuber: provider factory, 16 kHz mono numpy contract, async transcribe wrapper, and VAD controller with thresholds/pre-buffer.
4. Use **renderer microphone capture first** for permission UX and browser/WebRTC echo-cancellation controls, streaming 16 kHz mono PCM chunks over a dedicated `/voice/ws` to the sidecar. Treat sidecar `sounddevice` capture as a fallback/spike path, not the default.
5. Return final transcripts to the renderer as `stt-final`; the renderer submits that text through the existing chat input path so conversation history, `session_id`, `history`, pending-turn queue, and LLM/TTS behavior remain unchanged.
6. Make AEC a separate verification phase. Start with renderer WebRTC AEC (`echoCancellation`, `noiseSuppression`, `autoGainControl`) plus explicit TTS-ducking/ignore windows; only add native/DSP AEC if no-headphones UAT fails.

## Existing Invariants That Must Not Move

| Invariant | Current owner | v3.0 rule |
|-----------|---------------|-----------|
| Sentence order | `TTSTaskManager._payload_queue` sequence numbers | Preserve exactly; providers may synthesize concurrently, but only manager sends/plays in sequence. |
| Sidecar playback | `sounddevice.OutputStream.write` in `TTSTaskManager` | Keep playback in sidecar. GPT-SoVITS returns audio; it must not play audio itself. |
| Lipsync timing | `SpeechEnvelopePayload.started_at = stream.time + stream.latency` at write-time | Keep envelope publication at write-time, not synth-time. |
| RMS/lipsync source | `AudioPayloadMessage.volumes` and `SpeechEnvelopePayload.volumes` | Generate from the final PCM that is actually written after resampling/normalization. |
| Chat history | Renderer/main conversation store + `TextInputMessage.session_id/history` | Voice final text must enter existing text submit path, not call `Orchestrator.turn()` directly. |
| Local-first | Sidecar binds localhost; local providers default; cloud opt-in | Cloud STT providers require explicit API key config and never become default. |

## Recommended Component Architecture

```text
Renderer
  Settings.tsx
    ├─ Voice Output settings / presets / GPT-SoVITS launch controls
    └─ Voice Input settings / mic device / PTT / VAD / provider tests
  VoiceInputController
    ├─ getUserMedia + AudioWorklet capture
    ├─ downmix/resample to 16 kHz mono PCM16
    ├─ /voice/ws audio chunk stream
    └─ on stt-final -> existing submitText(finalText)

Electron main
  safe-storage.ts StoredConfig v2
    ├─ llm provider config
    ├─ audio.tts config / presets / selected preset
    └─ audio.stt config / input mode / cloud keys
  ipc.ts/preload
    ├─ config load/save remains DPAPI-backed
    ├─ voice provider admin proxies
    └─ optional device-picker helpers
  sidecar.ts
    ├─ passes AGENTICLLMVTUBER_AUDIO_CONFIG_JSON
    └─ restarts sidecar on provider changes requiring boot-time resources

Python sidecar
  audio/config.py
  tts/providers/*
  tts/provider_factory.py
  tts/audio_output.py
  tts/tts_manager.py (ordered playback invariant)
  stt/providers/*
  stt/provider_factory.py
  stt/vad.py
  stt/session.py
  ws/voice_server.py or ws/voice_handlers.py
  admin/audio.py
```

## TTS Architecture

### Provider Interface

Create a narrow provider interface under `sidecar/src/sidecar/tts/providers/base.py`:

```python
@dataclass
class TTSRequest:
    text: str
    preset_id: str | None
    reference_audio_id: str | None
    language: str | None
    options: dict[str, object]

@dataclass
class TTSAudioResult:
    pcm: np.ndarray          # mono int16 or float32, provider-normalized by adapter
    sample_rate: int
    mime: str | None = None
    provider_latency_ms: float | None = None

class TTSProvider(Protocol):
    id: str
    async def boot(self) -> None: ...
    async def health(self) -> ProviderHealth: ...
    async def synthesize(self, request: TTSRequest) -> TTSAudioResult: ...
    async def close(self) -> None: ...
```

**Important:** `TTSProvider` does not know about WebSockets, `AudioPayloadMessage`, compositor queues, `sounddevice.OutputStream`, or sentence ordering. This prevents GPT-SoVITS from breaking Piper's current playback/lipsync guarantees.

### Provider Implementations

| Provider | File | Notes |
|----------|------|-------|
| Piper | `sidecar/tts/providers/piper.py` | Move current `PiperVoice.load()` and synth warmup here. Piper remains fallback/default if configured provider fails. |
| GPT-SoVITS external | `sidecar/tts/providers/gpt_sovits.py` | HTTP client against user endpoint. Adapter downloads/validates response audio and converts to mono PCM. |
| GPT-SoVITS managed | `sidecar/tts/gpt_sovits_process.py` + provider | Electron/sidecar stores command, cwd, env allowlist, health URL. Launch/stop/status are explicit user actions. No installer/training UI. |

### Audio Output Layer

Add `sidecar/tts/audio_output.py`:

```python
class AudioOutputSink:
    stream: sounddevice.OutputStream
    output_sample_rate: int
    async def write(self, pcm: np.ndarray, sample_rate: int) -> WriteTiming: ...
```

Responsibilities:
- Own one long-lived output stream where possible.
- Resample provider output to the stream sample rate when needed.
- Normalize channel layout to mono.
- Return `started_at = stream.time + stream.latency` and write duration.
- Expose `latency`, `time`, and `shutdown()` so `TTSTaskManager.wait_for_all_audio_complete()` keeps its current semantics.

The current `TTSGateway` should become a compatibility facade during the first phase, then split into `TTSProviderFactory` + `AudioOutputSink` after tests are green.

### Modified `TTSTaskManager`

`TTSTaskManager` should keep its sequence-number queue unchanged, but replace `voice.synthesize()` with provider synthesis:

```text
speak(sentence)
  -> assign sequence_number
  -> concurrent _process_tts()
       provider.synthesize(TTSRequest)
       prepare final PCM/WAV/base64 + RMS volumes from actual PCM
       put _QueuedPayload(sequence_number)
  -> _process_payload_queue()
       wait for next sequence_number
       output.write(pcm)
       publish SpeechEnvelopePayload at write-time
       ws.send_json(AudioPayloadMessage)
```

Add a PCM tap for AEC **only after** the output PCM is final:

```python
extra_audio_taps: list[asyncio.Queue[TTSAudioTapFrame]]
```

The existing `extra_speech_queues` only carry RMS envelopes; AEC needs the actual played PCM plus timing.

## STT Architecture

### Provider Contract: OLVT-Compatible 16 kHz Mono

Adopt the Open-LLM-VTuber shape: every STT provider receives a 16 kHz mono numpy array and returns transcript text asynchronously.

```python
@dataclass
class STTRequest:
    audio: np.ndarray        # float32, mono, 16_000 Hz, range [-1, 1]
    sample_rate: Literal[16000] = 16000
    language_hint: str | None = None  # "zh", "en", "auto", "zh-en"
    prompt: str | None = None

@dataclass
class STTResult:
    text: str
    language: str | None
    segments: list[STTSegment]
    confidence: float | None = None
    is_partial: bool = False

class STTProvider(Protocol):
    id: str
    async def boot(self) -> None: ...
    async def transcribe(self, request: STTRequest) -> STTResult: ...
    async def health(self) -> ProviderHealth: ...
    async def close(self) -> None: ...
```

Provider files:

| Provider | File | Role |
|----------|------|------|
| FunASR | `sidecar/stt/providers/funasr.py` | Default for Chinese/English code-switching if packaging/quality verification passes. |
| faster-whisper | `sidecar/stt/providers/faster_whisper.py` | Local fallback/provider baseline. |
| OpenAI | `sidecar/stt/providers/openai.py` | Cloud opt-in; uses stored user API key. |
| Groq | `sidecar/stt/providers/groq.py` | Cloud opt-in; same sidecar provider interface. |

### VAD Session

Create `sidecar/stt/vad.py` and `sidecar/stt/session.py`:

```text
VoiceSession
  state: idle | recording | speech | finalizing | error
  mode: ptt | vad
  ring_buffer: pre_buffer_ms of PCM chunks
  vad: SileroVADController
  provider: STTProvider
```

VAD should match OLVT patterns:
- 16 kHz mono numpy frames.
- Silero VAD threshold config, min speech duration, min silence duration, max utterance duration.
- Pre-buffer audio before detected speech so first syllables are not clipped.
- PTT mode bypasses auto-start but may still use VAD for end trimming.
- Preview is a UI feature: show waveform/chunk state immediately; provider partial transcription is optional and should not block MVP.

## Renderer Capture vs Sidecar Capture

### Recommended Default: Renderer Capture

Use renderer capture for v3.0 default:

```typescript
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1
  }
})
```

Then process in an `AudioWorklet`:
- Downmix to mono.
- Resample to 16 kHz.
- Convert to PCM16 or float32 frames.
- Send frames to `/voice/ws` with sequence numbers.

Why this wins:
- Browser permission UX is better than Python `sounddevice` prompts/failures.
- WebRTC AEC is available without native Python dependencies.
- Renderer can show PTT state, waveform, and chunk preview with minimal roundtrips.
- Local-first remains intact: audio only streams to `127.0.0.1` sidecar.

### Fallback/Spike: Sidecar Capture

Keep sidecar capture as an AEC/diagnostics fallback:
- `sounddevice.InputStream` can avoid browser constraints and may be simpler for device enumeration.
- It does **not** give WebRTC AEC for free.
- It complicates permission UX and renderer preview.

Recommendation: build renderer capture first; use sidecar capture only in an AEC spike if renderer AEC fails badly.

## WebSocket and IPC Surface

### Existing `/ws` Chat Socket

Do not overload the chat socket with high-rate audio chunks. Keep it for existing OLVT-shape messages:
- `text-input`
- `control`
- `audio`
- `full-text`
- `force-new-message`
- `error`
- `log`

Add only low-rate STT result messages if necessary:

```python
class SttFinalMessage(BaseModel):
    type: Literal["stt-final"] = "stt-final"
    text: str
    session_id: str | None = None
    language: str | None = None
    confidence: float | None = None
```

However, prefer sending these on `/voice/ws` and letting the renderer submit final text through the existing chat path.

### New `/voice/ws`

Use a dedicated voice socket for recording sessions:

Client -> sidecar:

```python
class VoiceStartMessage(BaseModel):
    type: Literal["voice-start"] = "voice-start"
    mode: Literal["ptt", "vad"]
    sample_rate: int              # renderer sends 16000 after worklet resample
    channels: Literal[1]
    provider: str | None = None
    session_id: str | None = None

class VoiceChunkMessage(BaseModel):
    type: Literal["voice-chunk"] = "voice-chunk"
    seq: int
    pcm16_b64: str                # JSON-safe first pass; binary frames can optimize later

class VoiceStopMessage(BaseModel):
    type: Literal["voice-stop"] = "voice-stop"
    reason: Literal["ptt-release", "vad-silence", "cancel"]
```

Sidecar -> client:

```python
class VoiceStateMessage(BaseModel):
    type: Literal["voice-state"] = "voice-state"
    state: Literal["idle", "recording", "speech", "finalizing", "error"]
    level: float | None = None

class VoicePreviewMessage(BaseModel):
    type: Literal["voice-preview"] = "voice-preview"
    duration_ms: int
    speech_detected: bool
    level: float

class SttPartialMessage(BaseModel):
    type: Literal["stt-partial"] = "stt-partial"
    text: str

class SttFinalMessage(BaseModel):
    type: Literal["stt-final"] = "stt-final"
    text: str
    language: str | None = None
    confidence: float | None = None
```

Use JSON/base64 for the first implementation because it matches the existing WS dispatcher and generated-contract workflow. If CPU/latency profiling shows overhead, switch only `voice-chunk` to binary frames while keeping control/results JSON.

### Admin HTTP Endpoints

Add `sidecar/src/sidecar/admin/audio.py` and include it in `server.py`:

| Endpoint | Purpose |
|----------|---------|
| `GET /admin/audio/providers` | List TTS/STT providers, capabilities, required config fields. |
| `GET /admin/audio/status` | Current selected TTS/STT provider health, managed GPT-SoVITS status, input mode status. |
| `POST /admin/audio/tts/test` | Synthesize a test sentence using selected or supplied preset; returns health/latency and optionally plays through sidecar. |
| `POST /admin/audio/stt/test` | Test provider config without starting chat. Cloud tests must be explicit. |
| `POST /admin/audio/gpt-sovits/launch` | Start user-configured managed command. |
| `POST /admin/audio/gpt-sovits/stop` | Stop managed GPT-SoVITS process. |
| `GET /admin/audio/gpt-sovits/status` | Running/health URL/last error. |
| `POST /admin/audio/reference-audio/import` | Copy selected reference audio into userData/avatar voice assets; validate extension/duration. |

### Electron IPC / Preload Additions

Add typed preload methods:

```typescript
getAudioStatus(): Promise<AudioRuntimeStatus>
listAudioProviders(): Promise<AudioProviderCatalog>
testTts(input: TestTtsInput): Promise<TestTtsResult>
testStt(input: TestSttInput): Promise<TestSttResult>
pickReferenceAudio(): Promise<string | null>
importReferenceAudio(path: string): Promise<ReferenceAudioAsset>
launchGptSovits(): Promise<GptSovitsStatus>
stopGptSovits(): Promise<GptSovitsStatus>
```

Config save can keep the existing `config:save -> restartSidecar()` behavior for v3.0. Later, provider hot-swap can avoid restarts, but restart-on-save is simpler and consistent with current plugin/avatar patterns.

## Contract Changes

Add Pydantic contracts in `packages/contracts/py/contracts/` and generate TS mirrors.

### New Contract Files

| File | Purpose |
|------|---------|
| `audio_config.py` | Persistent audio settings: TTS/STT provider choices, selected preset, VAD/PTT options, AEC mode. |
| `tts_provider.py` | TTS provider config union, capabilities, health, test request/result. |
| `voice_preset.py` | Named voice presets, GPT-SoVITS reference audio IDs, provider-specific options. |
| `stt_provider.py` | STT provider config union, capabilities, health, test request/result. |
| `voice_ws_message.py` | `/voice/ws` start/chunk/stop/state/preview/partial/final/error contracts. |
| `audio_runtime_status.py` | Settings/status surface payload for current audio stack. |

### Modified Contract Files

| File | Change |
|------|--------|
| `avatar_overrides.py` | Keep `Voice` backward-compatible, but either add `voice_preset_id` or make avatar voice point to a named preset. Do not store full secrets or GPT-SoVITS command in avatar overrides. |
| `ws_message.py` | Optional: include `SttFinalMessage` only if final transcripts are sent on `/ws`; otherwise leave `/ws` unchanged. |
| `audio_payload.py` | No required change; provider abstraction should still output the same `AudioPayloadMessage`. |
| `speech_envelope.py` | No required change; AEC PCM tap should use a separate in-process type, not this RMS-only contract. |

### StoredConfig Versioning

`apps/electron-main/src/safe-storage.ts` currently has `schemaVersion: 1`. v3.0 should bump to `schemaVersion: 2` and migrate v1 configs:

```typescript
interface StoredConfigV2 {
  provider: ProviderConfig
  plugin?: BodyMotionPluginConfig
  audio: AudioConfig
  hasCompletedSetup: boolean
  schemaVersion: 2
}
```

Migration default:
- TTS provider: `piper`, model from active avatar overrides or `en_US-amy-medium`.
- STT provider: `funasr` if installed/healthy, otherwise `faster_whisper` with clear degraded status.
- Input mode: `ptt` by default; VAD opt-in after calibration.
- AEC mode: `renderer-webrtc` for renderer capture.

## Data Flows

### TTS Reply Flow

```text
Renderer sends existing text-input(session_id, history)
  -> sidecar ws.handlers.handle_text_input
  -> Orchestrator.pending_inputs
  -> Orchestrator.turn()
  -> sentence_divider / code_extractor / display_processor / tts_filter
  -> TTSTaskManager.speak(sentence_id, tts_text, display_text, dispatches)
  -> TTSProvider.synthesize()
  -> prepare final PCM + WAV/base64 + RMS volumes
  -> ordered payload queue
  -> AudioOutputSink.write()
  -> SpeechEnvelopePayload to compositor at write-time
  -> AudioPayloadMessage to renderer
  -> compositor speech driver drives VTS lipsync/RMS
```

### Voice Input PTT Flow

```text
User holds PTT in renderer
  -> VoiceInputController opens /voice/ws
  -> getUserMedia + AudioWorklet emits 16k mono chunks
  -> sidecar VoiceSession buffers chunks
  -> user releases PTT
  -> sidecar STTProvider.transcribe(full utterance)
  -> /voice/ws stt-final(text)
  -> renderer calls existing submitText(text)
  -> existing text-input path with session_id/history
```

### Voice Input VAD Flow

```text
Renderer streams chunks while voice mode enabled
  -> sidecar SileroVADController monitors 16k mono frames
  -> pre-buffer + speech frames accumulated
  -> silence threshold finalizes utterance
  -> STT transcribes
  -> renderer receives final transcript
  -> renderer submits through existing chat path
```

## AEC Architecture Options

### Option A — Renderer WebRTC AEC (recommended first)

**What:** Use browser capture constraints `echoCancellation/noiseSuppression/autoGainControl`, and keep audio playback in sidecar speakers.

**Pros:** No native dependency; best permission UX; aligns with renderer capture.  
**Cons:** Browser AEC works best when playback is in the same WebRTC/audio graph. Because TTS playback is sidecar-owned via `sounddevice`, AEC may be weaker than a browser-only audio app.

**Mitigation:** Add empirical no-headphones UAT. During TTS playback, VAD can either pause auto-submit or require stronger speech confidence. This is not true AEC but prevents obvious self-triggering.

### Option B — Sidecar DSP AEC with TTS PCM Reference

**What:** Add a PCM tap from `TTSTaskManager` after final resampling; feed played TTS reference + mic input to an AEC processor.

**Pros:** Architecturally correct because the sidecar has the exact played PCM and write timing.  
**Cons:** Requires choosing/packaging an AEC library; native wheels may be painful; tuning can consume the milestone.

**Required architecture if chosen:**
- `TTSAudioTapFrame(sentence_id, pcm, sample_rate, started_at)` from audio-output write path.
- `EchoReferenceBuffer` keyed by monotonic/output timestamps.
- `AECProcessor.process(mic_frame, reference_frame_window) -> cleaned_frame` before VAD/STT.

### Option C — Sidecar Capture + DSP AEC

**What:** Move mic capture to Python `sounddevice.InputStream` and run DSP AEC in sidecar.

**Pros:** Entire audio path is in one process.  
**Cons:** Worse device/permission UX; still needs native AEC; renderer preview becomes remote-only.

**Use only if:** Renderer capture cannot provide stable chunks or WebRTC AEC is unusable.

### Option D — Supported Headphones / Push-to-Talk Limitation

**What:** Document no-headphones as limited; require headphones or PTT when AEC fails.

**Pros:** Honest and shippable.  
**Cons:** Misses target if no-headphones use is core.

**Recommendation:** Keep this as an explicit fallback, not as the initial assumption.

## New vs Modified Files / Surfaces

### New Sidecar Files

| File | Purpose |
|------|---------|
| `sidecar/src/sidecar/audio/config.py` | Load/validate audio config from env and defaults. |
| `sidecar/src/sidecar/tts/providers/base.py` | TTS provider protocol/types. |
| `sidecar/src/sidecar/tts/providers/piper.py` | Piper provider adapter. |
| `sidecar/src/sidecar/tts/providers/gpt_sovits.py` | GPT-SoVITS HTTP provider. |
| `sidecar/src/sidecar/tts/provider_factory.py` | Select/build provider from config. |
| `sidecar/src/sidecar/tts/audio_output.py` | Long-lived output stream, resampling, write timing. |
| `sidecar/src/sidecar/tts/gpt_sovits_process.py` | Optional managed launch/stop/status. |
| `sidecar/src/sidecar/stt/providers/base.py` | STT provider protocol/types. |
| `sidecar/src/sidecar/stt/providers/funasr.py` | FunASR adapter. |
| `sidecar/src/sidecar/stt/providers/faster_whisper.py` | faster-whisper adapter. |
| `sidecar/src/sidecar/stt/providers/openai.py` | OpenAI cloud STT adapter. |
| `sidecar/src/sidecar/stt/providers/groq.py` | Groq cloud STT adapter. |
| `sidecar/src/sidecar/stt/provider_factory.py` | Select/build STT provider. |
| `sidecar/src/sidecar/stt/vad.py` | Silero VAD state machine. |
| `sidecar/src/sidecar/stt/session.py` | Per-WS voice session and chunk buffer. |
| `sidecar/src/sidecar/ws/voice_server.py` | `/voice/ws` endpoint router. |
| `sidecar/src/sidecar/admin/audio.py` | Provider status/test/GPT-SoVITS admin endpoints. |

### Modified Sidecar Files

| File | Change |
|------|--------|
| `sidecar/src/sidecar/ws/server.py` | Load audio config, build provider factories, include `admin_audio.router`, register `/voice/ws`, pass provider/output to `TTSTaskManager`. |
| `sidecar/src/sidecar/tts/tts_gateway.py` | Convert to compatibility wrapper or retire after provider split. |
| `sidecar/src/sidecar/tts/tts_manager.py` | Replace Piper-specific `_voice` path with provider synthesis + `AudioOutputSink`; keep ordering and write-time envelope semantics. |
| `sidecar/src/sidecar/tts/audio_payload_helpers.py` | Generalize from Piper chunks to arbitrary PCM/sample rate. |
| `sidecar/src/sidecar/orchestrator/orchestrator.py` | Ideally no change except constructor type names; do not add STT direct entry here. |
| `sidecar/pyproject.toml` | Add FunASR/faster-whisper/silero-vad/cloud client deps in phase-specific commits. |

### New Renderer / Electron Files

| File | Purpose |
|------|---------|
| `apps/renderer/src/audio/VoiceInputController.ts` | Capture, worklet lifecycle, voice WS client, PTT/VAD state. |
| `apps/renderer/src/audio/pcm16-worklet.ts` | Downmix/resample/chunk mic audio. |
| `apps/renderer/src/screens/Settings/VoiceOutputSection.tsx` | Rich TTS provider/preset UI. |
| `apps/renderer/src/screens/Settings/VoiceInputSection.tsx` | STT/VAD/PTT/mic UI. |
| `apps/renderer/src/state/audio-settings.ts` | Renderer state wrapper over StoredConfig audio section. |

### Modified Renderer / Electron Files

| File | Change |
|------|--------|
| `apps/renderer/src/screens/Settings/Settings.tsx` | Replace current TTS placeholder with voice output settings; add voice input section/anchor. |
| `apps/electron-main/src/safe-storage.ts` | `StoredConfig` schema v2 with audio config and migration. |
| `apps/electron-main/src/sidecar.ts` | Pass decrypted audio config via env; optionally expose audio status helpers. |
| `apps/electron-main/src/ipc.ts` | Add audio admin proxy IPC and file picker for reference audio. |
| `apps/electron-main/preload/index.ts` | Whitelist audio methods/types. |
| Chat input component | Add PTT button and transcript preview; final text calls existing submit handler. |

## Build Order / Phase Boundaries

### Phase 16 — Audio Contracts + TTS Provider Shell

Goal: introduce config/contracts without behavior drift.
- Add audio Pydantic contracts + TS generation.
- Add `StoredConfig` v2 migration with default Piper config.
- Add `TTSProvider` interface and Piper provider adapter.
- Keep existing Piper output identical in UAT: sentence order, `volumes`, `started_at`, and `force-new-message` timing.

**Gate:** Existing text chat/TTS/lipsync regression tests pass unchanged.

### Phase 17 — GPT-SoVITS Provider + Voice Presets

Goal: rich voice output while preserving playback invariants.
- Add GPT-SoVITS external-server provider.
- Add managed launch command controls with health checks.
- Add reference-audio import and named presets.
- Settings voice output UI: provider switch, test synthesis, preset management.

**Gate:** GPT-SoVITS audio is played only through `TTSTaskManager`; lipsync envelope generated from actual PCM.

### Phase 18 — STT Provider Abstraction + FunASR/faster-whisper

Goal: local STT providers behind one sidecar interface.
- Add `STTProvider` and factory.
- Implement FunASR default and faster-whisper fallback.
- Add provider health/test endpoint.
- Add code-switch evaluation harness with Chinese, English, and mixed utterance clips.

**Gate:** Code-switch eval is recorded; FunASR remains default only if quality/packaging passes.

### Phase 19 — Renderer Voice Capture + PTT

Goal: speak-to-chat through existing conversation pipeline.
- Add renderer capture, worklet, `/voice/ws` chunk stream.
- Implement PTT recording and final transcript result.
- Renderer final transcript calls existing text submit path with `session_id/history`.
- Add chunk/waveform preview.

**Gate:** Conversation history shows voice turns identically to typed turns.

### Phase 20 — VAD Auto-Submit

Goal: hands-free voice input without wake word.
- Add Silero VAD controller with pre-buffer and silence thresholds.
- Settings controls for threshold/min silence/max utterance.
- VAD final text uses same final transcript path as PTT.

**Gate:** No clipped first syllables; no duplicate submissions; PTT remains reliable fallback.

### Phase 21 — Cloud STT Providers

Goal: opt-in OpenAI/Groq transcription.
- Add OpenAI and Groq STT adapters.
- Add credential fields, explicit cloud warning, provider tests.
- Ensure cloud providers are never default and can be disabled without side effects.

**Gate:** Local-first default verified after fresh install.

### Phase 22 — AEC Spike + No-Headphones Decision

Goal: decide supported no-headphones behavior honestly.
- Test renderer WebRTC AEC while TTS plays through sidecar.
- Add TTS self-speech suppression windows for VAD if needed.
- If insufficient, prototype PCM reference tap + DSP AEC path.
- Document supported modes: no-headphones, headphones recommended, or PTT-only during avatar speech.

**Gate:** No-headphones UAT evidence exists; remaining limitations are explicit.

## Pitfalls / Research Flags

1. **Provider writing its own audio breaks lipsync.** GPT-SoVITS must return PCM only; sidecar output remains single writer.
2. **STT direct-to-orchestrator breaks history.** Final voice transcript must go through renderer's existing text submit path unless history ownership is redesigned.
3. **AEC may not work with sidecar playback.** Browser AEC is not guaranteed when playback is outside Chromium's audio graph. Treat as a live risk.
4. **FunASR packaging and code-switch quality must be measured.** Do not keep FunASR as default on assumption alone; use eval clips.
5. **Variable provider sample rates can desync RMS.** Generate RMS after final resample and write that exact PCM.
6. **VAD during avatar speech can self-trigger.** Use AEC, suppression windows, or disable auto-submit while TTS is active until verified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| TTS provider integration | HIGH | Existing `TTSTaskManager` already isolates synthesis from ordered write; refactor boundary is clear. |
| STT provider shape | HIGH | OLVT-style 16 kHz mono provider/factory/VAD pattern fits Python sidecar. |
| Renderer capture boundary | MEDIUM-HIGH | Best UX and AEC starting point, but final WebRTC behavior with sidecar playback needs testing. |
| Conversation-history preservation | HIGH | Returning final text to renderer and reusing existing submit path preserves current `session_id/history`. |
| AEC no-headphones outcome | MEDIUM | Architecture options are clear; product outcome requires live tests. |
