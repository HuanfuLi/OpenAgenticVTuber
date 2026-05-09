# v3.0 Technology Stack: Rich Voice Configuration + Voice Input

**Project:** AgenticLLMVTuber  
**Milestone:** v3.0 Rich Voice Configuration + Voice Input  
**Researched:** 2026-05-09  
**Scope:** stack additions/changes only for configurable TTS, GPT-SoVITS, pluggable STT, Chinese/English code-switching, VAD, chunk preview, and AEC.

## Executive Recommendation

Keep the existing Electron + React + Vite + Python FastAPI sidecar architecture. Add a sidecar-owned `TTSProvider` / `ASRProvider` abstraction, but capture microphone audio in the Electron renderer with Chromium `getUserMedia()` and stream normalized PCM frames to Python over the existing localhost WebSocket. This gives the app browser-grade mic permissions, device selection, and baseline WebRTC echo cancellation without introducing fragile native Python AEC bindings.

Use **FunASR 1.3.1 + SenseVoiceSmall** as the default local ASR for Chinese/English users because it is explicitly multilingual, supports zh/en/yue/ja/ko, includes language identification tags, and is already represented in Open-LLM-VTuber's provider shape. Keep **faster-whisper 1.2.1** as the local fallback because it is mature, Python-packageable, and broadly multilingual, but do not make it the default for Chinese/English code-switch quality. Add **OpenAI SDK 2.36.x** and **Groq SDK 1.2.x** as opt-in cloud transcription providers.

For GPT-SoVITS, do **not** vendor the GPT-SoVITS Python package or install its dependencies into our sidecar. Treat it as an external HTTP service at `127.0.0.1:9880` by default, with optional user-supplied app-managed launch command. Use our existing `httpx` client, decode returned WAV/RAW with `soundfile`, resample with `samplerate` only when necessary, then feed the existing ordered playback + RMS/lipsync envelope path.

## Recommended Stack Additions

### Core audio capture / transport

| Technology | Version guidance | Purpose | Recommendation |
|------------|------------------|---------|----------------|
| **Chromium `navigator.mediaDevices.getUserMedia()`** | Electron-bundled Chromium; no npm package | Mic capture, device permission, browser AEC/NS/AGC constraints | **Use in renderer.** Request `{ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }`, then downmix/resample in an `AudioWorklet` and stream PCM frames to the sidecar. This is the most realistic baseline AEC path. |
| **AudioWorklet** | Built-in Web API | Low-jitter chunking for PTT/VAD/audio preview | **Use instead of MediaRecorder** for STT input. MediaRecorder emits encoded chunks and adds latency; ASR/VAD wants 16 kHz mono float32/int16 PCM. |
| **WebSocket binary frames** | Existing FastAPI WS | Renderer → sidecar audio frame stream | Send 20-32 ms frames or coalesced 100 ms chunks. Use JSON control messages for `start`, `partial`, `commit`, `cancel`, `provider`, `vad_config`; binary for PCM. |
| **sounddevice** | Existing; current 0.5.5 | Sidecar playback, optional diagnostics-only input | Keep for output. Do **not** make Python `InputStream` the primary mic path unless renderer capture fails, because it bypasses Chromium AEC and creates cross-platform permission/device complexity. |

### TTS provider layer

| Technology | Version guidance | Purpose | Recommendation |
|------------|------------------|---------|----------------|
| **piper-tts** | Existing 1.4.x line | Local fallback/default TTS | Keep as fallback and regression baseline. Preserve sentence-buffered ordered playback and RMS envelope exactly. |
| **httpx** | Existing 0.28.x | GPT-SoVITS REST client | Use one async client with timeout/retry policy. Health check external server before use; on failure fall back to Piper for the current turn and toast. |
| **GPT-SoVITS API v2** | External app; no sidecar dependency | Character voice backend | Integrate against `api_v2.py` endpoints: `POST /tts`, `GET /set_gpt_weights`, `GET /set_sovits_weights`, `GET /control`. Default URL `http://127.0.0.1:9880`. Use `media_type="wav"` initially; evaluate streaming modes after baseline works. |
| **soundfile** | 0.13.1 | Decode/validate WAV reference audio and GPT-SoVITS responses | Add for in-memory WAV read/write and reference-audio validation. Wheels bundle libsndfile on common platforms. |
| **samplerate** | 0.2.4 | High-quality sample-rate conversion | Add only if existing path cannot handle GPT-SoVITS 24/32/48 kHz output cleanly. It has Python 3.12 Windows/macOS/Linux wheels and avoids ad-hoc resampling. |

**GPT-SoVITS provider contract:** return a normalized `SynthesizedAudio` object: `pcm_int16`, `sample_rate`, `channels=1`, `provider_metadata`, `rms_envelope`. The `TTSTaskManager` should not know whether audio came from Piper or GPT-SoVITS.

### STT / ASR providers

| Technology | Version guidance | Purpose | Recommendation |
|------------|------------------|---------|----------------|
| **funasr** | **1.3.1** (PyPI, 2026-01-26) | Default local ASR | Use as default through `funasr.AutoModel`. Start with `iic/SenseVoiceSmall`, `language="auto"`, `use_itn=True`, CPU by default, CUDA optional. It is the best fit for zh/en code-switching in this scope. |
| **modelscope** | **1.36.3** (PyPI, 2026-04-28) | Model download/cache for FunASR | Add as optional-but-recommended for FunASR model resolution. Support local model paths to keep local-first installs deterministic after download. |
| **torch / torchaudio** | Pin during implementation to a Python 3.12-compatible stable CPU build; CUDA optional | FunASR + Silero runtime | This is the largest dependency risk. Prefer CPU wheels for default install; expose CUDA as an advanced opt-in. Do not bundle CUDA runtimes in the Electron app. |
| **faster-whisper** | **1.2.1** (PyPI, 2025-10-31) | Local fallback ASR | Keep as fallback/provider baseline. Use `language=None` for auto-detect/code-switch; default model `small`, compute `int8`, device `auto`. Expose `base/small/medium/large-v3/turbo` as advanced. |
| **openai** | **2.36.x** (PyPI latest 2026-05-07) | Opt-in cloud transcription | Add provider using `AsyncOpenAI`. Default model should be configurable; seed with high-accuracy transcription model if available for the user's account, with `whisper-1` as stable fallback. Requires user API key and explicit cloud disclosure. |
| **groq** | **1.2.x** (PyPI latest 2026-04-18) | Opt-in low-latency cloud Whisper | Use `AsyncGroq.audio.transcriptions.create`; default `whisper-large-v3-turbo`, allow `whisper-large-v3`. Requires user API key. Good latency; quality on Mandarin/code-switch must be UAT-tested. |
| **soundfile** | 0.13.1 | In-memory WAV wrapping for cloud uploads | Use to wrap sidecar PCM into WAV for OpenAI/Groq uploads; avoid temp files. |

**Default ASR order:** `funasr_sensevoice` → `faster_whisper` fallback if FunASR load/download fails → cloud providers only when explicitly selected.

### VAD and recording UX

| Technology | Version guidance | Purpose | Recommendation |
|------------|------------------|---------|----------------|
| **silero-vad** | **6.2.1** (PyPI, 2026-02-24) | Local VAD state machine | Use the Open-LLM-VTuber state-machine pattern, adapted to renderer-fed PCM. Defaults: 16 kHz, 512-sample windows, prob threshold ~0.4, required hits ~3, misses ~24. Expose sensitivity slider mapped to probability/miss thresholds. |
| **NumPy** | Existing | Frame conversion/RMS | Use for PCM conversion, chunk RMS meter, and VAD buffering. |
| **No wake-word package** | n/a | Scope control | Keep raw PTT/VAD only. Wake-word remains explicitly out of scope. |

**Chunk preview:** do not require every provider to support true streaming ASR. Implement a provider-neutral preview layer:

1. Renderer shows waveform/RMS immediately from captured frames.
2. Sidecar emits `recording_started`, `speech_active`, and elapsed-time events from Silero.
3. For text preview, run throttled provisional transcription on a rolling buffer for local providers only, clearly marked `partial=true` and replaceable. The final submit uses the full utterance transcript unchanged/no translation.
4. Cloud providers may skip live text preview or use low-frequency previews to avoid cost surprises.

### AEC / echo cancellation

| Technology | Version guidance | Purpose | Recommendation |
|------------|------------------|---------|----------------|
| **Chromium/WebRTC AEC via `echoCancellation` constraint** | Built into Electron/Chromium | Baseline echo cancellation | Use first. MDN documents `echoCancellation` as widely available; browsers may ignore unknown constraints but attempt cancellation when enabled. Combine with `noiseSuppression` and `autoGainControl`. |
| **Headphone / PTT guidance** | UX, not package | Realistic mitigation | UI should state that speakers can still leak TTS into the mic; PTT/headphones improve reliability. Do not promise no-headphones operation. |
| **webrtc-audio-processing PyPI** | 0.1.3 from 2018; pre-alpha; Linux/old Python wheels only | Native AEC candidate | **Do not add.** Too stale and not Windows/Python 3.12 friendly. |
| **Custom native WebRTC APM / SpeexDSP / RNNoise** | Research only | Stronger future AEC/noise suppression | Dedicated AEC phase may prototype, but do not commit as v3.0 dependency until cross-platform packaging is proven. |

**AEC realism:** browser AEC can reduce echo but will not reliably remove our own TTS in all speaker/mic/room combinations, especially with loud speakers, low-latency playback drift, or non-default output devices. The dedicated AEC phase should produce an empirical support statement, not a marketing promise.

## Integration Points in Current Codebase

### Existing TTS path to preserve

Current code is Piper-specific:

- `sidecar/src/sidecar/tts/tts_gateway.py` owns `PiperVoice` and one long-lived `sounddevice.OutputStream`.
- `sidecar/src/sidecar/tts/tts_manager.py` parallelizes sentence synthesis, preserves sequence order, writes PCM to the output stream, sends `AudioPayloadMessage`, and pushes `SpeechEnvelopePayload` for compositor/lipsync.

Refactor to:

```text
TTSProvider.synthesize(sentence, voice_config) -> SynthesizedAudio
TTSTaskManager -> provider-agnostic ordered queue -> same OutputStream/write path -> same RMS/lipsync envelope
```

Do **not** let GPT-SoVITS own playback. It should only return audio bytes; our sidecar remains the single playback/lipsync owner.

### Contracts/settings to add

Extend `packages/contracts/py/contracts/avatar_overrides.py` `Voice` from the current minimal shape:

```python
backend: str = "piper"
model: str = "en_US-amy-medium"
lipsync_mode: str = "our-rms"
```

to a versioned structure like:

```python
voice: VoiceConfig
stt: STTConfig  # app/session level, optionally avatar-defaulted later
```

Recommended contract families:

- `VoiceProviderName = Literal["piper", "gpt_sovits"]` for v3.0. Do not add Edge/ComfyUI controls yet.
- `PiperVoiceConfig`: model path/name, speaker, length/noise/noise_w if Piper exposes controls.
- `GptSoVitsVoiceConfig`: base URL, mode `external|managed_command`, launch command, ref audio path(s), prompt text/lang, text lang default, top_k/top_p/temperature, speed_factor, repetition_penalty, sample_steps, streaming_mode, gpt/sovits weights paths.
- `VoicePreset`: name, provider, provider config snapshot, avatar binding, last health status.
- `ASRProviderName = Literal["funasr", "faster_whisper", "openai", "groq"]`.
- `STTConfig`: provider, mic device id from renderer, ptt key, vad enabled, vad sensitivity, preview enabled, final language policy `auto_no_translation`.
- `ReferenceAudioAsset`: id, original filename, stored path, duration, sample rate, transcript/prompt text, language, validation warnings.

### New sidecar services

Add these modules rather than growing existing Piper files:

```text
sidecar/src/sidecar/tts/providers/base.py
sidecar/src/sidecar/tts/providers/piper_provider.py
sidecar/src/sidecar/tts/providers/gpt_sovits_provider.py
sidecar/src/sidecar/stt/providers/base.py
sidecar/src/sidecar/stt/providers/funasr_provider.py
sidecar/src/sidecar/stt/providers/faster_whisper_provider.py
sidecar/src/sidecar/stt/providers/openai_provider.py
sidecar/src/sidecar/stt/providers/groq_provider.py
sidecar/src/sidecar/stt/vad/silero_engine.py
sidecar/src/sidecar/audio/audio_session.py
```

Use Open-LLM-VTuber as a shape reference, not a copy source:

- `ASRInterface`'s `async_transcribe_np(audio: np.ndarray) -> str` is a good minimum provider shape.
- `ASRFactory` validates the provider registry pattern.
- `fun_asr.py` shows `SenseVoiceSmall`, `fsmn-vad`, `ct-punc`, tag stripping, ModelScope local-cache detection.
- `faster_whisper_asr.py` shows `WhisperModel(..., condition_on_previous_text=False)`; keep that to prevent cross-utterance hallucination.
- `vad/silero.py` is the right state-machine starting point, but change its bytes bug/assumptions: keep explicit float32/int16 conversions and include pre-roll.

## Installation Guidance

Add dependencies in extras so the default sidecar remains installable without all ML/cloud packages:

```bash
# Always needed for v3 audio plumbing
uv add soundfile==0.13.1 samplerate==0.2.4 silero-vad==6.2.1

# Local ASR default
uv add funasr==1.3.1 modelscope==1.36.3
# plus a pinned torch/torchaudio CPU build selected during implementation

# Local ASR fallback
uv add faster-whisper==1.2.1

# Cloud STT providers (optional extra is acceptable)
uv add openai==2.36.0 groq==1.2.0
```

Prefer packaging groups/extras:

- `voice-core`: `soundfile`, `samplerate`, `silero-vad`
- `voice-local-asr`: `funasr`, `modelscope`, `torch`, `torchaudio`, `faster-whisper`
- `voice-cloud-asr`: `openai`, `groq`

## What NOT to Add Yet

| Avoid | Why | Do instead |
|-------|-----|------------|
| Bundling GPT-SoVITS into our sidecar | Huge GPU/PyTorch/FFmpeg/model dependency surface; conflicts with local-first lightweight sidecar; user explicitly excluded installer/training UI | External HTTP client + optional user command launcher |
| Voice cloning/training UI | Explicitly out of v3.0 scope | Reference-audio management only |
| Edge TTS / ComfyUI TTS controls | Mentioned in original design but not user-confirmed v3.0 scope | Keep provider registry extensible, hide until future milestone |
| `webrtc-audio-processing` PyPI | 2018 pre-alpha, no modern Windows/Python 3.12 wheel story | Browser WebRTC AEC first; native AEC prototype separately |
| Wake-word libraries | Explicitly out of scope | PTT + raw VAD |
| Whisper.cpp / Sherpa-ONNX in v3.0 | Useful future packaging options, but expands matrix before FunASR/faster-whisper baseline is proven | Revisit only if FunASR packaging is unacceptable |
| Translation or language normalization of final transcript | User explicitly wants final text sent as heard/no translation | Preserve original Chinese/English/code-switched transcript |

## Packaging and Model-Size Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **FunASR + torch is large** | App/venv size jumps by hundreds of MB to >1 GB depending on torch build | Put local ASR in an install group; document first-run model download; do not bundle CUDA. |
| **SenseVoiceSmall model cache is substantial** | First-run download/storage cost; offline users may fail until model exists | Provide model status UI, local path override, and clear download progress. Use ModelScope/HF cache; never hide downloads. |
| **Fun-ASR-Nano is 800M params** | Better multilingual promise but too heavy/new for default | Do not default to Nano in v3.0; list as future advanced model after UAT. |
| **faster-whisper CUDA dependencies** | CUDA 12/cuDNN mismatch issues; CTranslate2 GPU wheels require matching NVIDIA libs | Default CPU int8. Treat CUDA as advanced user path. |
| **Cloud STT privacy/cost** | Audio leaves machine; token/minute cost | Explicit opt-in, per-provider status, no silent fallback from local to cloud. |
| **GPT-SoVITS latency** | First sentence may take 1-3s; can stall perceived conversation | Warmup/test synthesis; chat buffering indicator; Piper per-turn fallback on health failure. |
| **Reference audio paths** | External GPT-SoVITS server must be able to read paths; app-managed vs external path semantics differ | Store reference audio under app data, expose absolute path, and validate server accessibility during health/test synthesis. |
| **AEC is not solved by a package install** | Speaker playback can still enter mic, causing self-replies or interruptions | Browser AEC + TTS ducking/PTT guidance + dedicated empirical AEC phase. |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| GPT-SoVITS API integration | HIGH | Current upstream `api_v2.py` documents `/tts`, weight-switch, streaming, and control endpoints. |
| FunASR default choice | MEDIUM-HIGH | PyPI and OLVT provider confirm current package/provider shape; actual code-switch quality still needs app-specific UAT. |
| faster-whisper fallback | HIGH | Current PyPI docs, mature package, already in design/OLVT. |
| OpenAI/Groq cloud STT | MEDIUM | SDK versions verified; exact best OpenAI transcription model should be rechecked against provider model list during implementation. Groq `whisper-large-v3-turbo` verified in SDK docs. |
| Renderer mic capture + browser AEC | HIGH for baseline availability, MEDIUM for quality | MDN confirms `getUserMedia` and `echoCancellation`; real room/speaker performance is environment-dependent. |
| Native AEC alternatives | LOW | Python bindings are stale or packaging-heavy; requires a dedicated prototype. |

## Sources

- Project context: `.planning/PROJECT.md`, `.planning/ROADMAP.md`; `.planning/REQUIREMENTS.md` was requested but is not present in the repo.
- Existing implementation: `sidecar/src/sidecar/tts/tts_gateway.py`, `sidecar/src/sidecar/tts/tts_manager.py`, `packages/contracts/py/contracts/avatar_overrides.py`.
- Open-LLM-VTuber upstream: `asr_interface.py`, `asr_factory.py`, `faster_whisper_asr.py`, `fun_asr.py`, `groq_whisper_asr.py`, `vad/silero.py`, `config_manager/asr.py`.
- FunASR PyPI: https://pypi.org/project/funasr/ — 1.3.1, SenseVoiceSmall, Fun-ASR-Nano, streaming examples.
- ModelScope PyPI: https://pypi.org/project/modelscope/ — 1.36.3.
- faster-whisper PyPI: https://pypi.org/project/faster-whisper/ — 1.2.1, CTranslate2, VAD, CUDA notes.
- silero-vad PyPI: https://pypi.org/project/silero-vad/ — 6.2.1, 16 kHz/8 kHz support, performance/model size.
- OpenAI PyPI: https://pypi.org/project/openai/ — 2.36.0 SDK, async/httpx support.
- Groq PyPI: https://pypi.org/project/groq/ — 1.2.0 SDK, audio transcription example.
- sounddevice PyPI: https://pypi.org/project/sounddevice/ — 0.5.5, cross-platform PortAudio bindings.
- soundfile PyPI: https://pypi.org/project/soundfile/ — 0.13.1, libsndfile-backed in-memory audio.
- samplerate PyPI: https://pypi.org/project/samplerate/ — 0.2.4, Python 3.12 wheels.
- MDN `getUserMedia`: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN `echoCancellation`: https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation
- GPT-SoVITS README/API: https://github.com/RVC-Boss/GPT-SoVITS and `api_v2.py` raw upstream.
