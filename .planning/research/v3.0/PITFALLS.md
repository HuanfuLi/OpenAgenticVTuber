# Domain Pitfalls: v3.0 Rich Voice Configuration + Voice Input

**Project:** AgenticLLMVTuber  
**Domain:** Local-first Electron + Python sidecar VTuber companion audio I/O  
**Researched:** 2026-05-09  
**Overall confidence:** HIGH for integration risks in this codebase; MEDIUM for provider-specific quality/latency until live dogfood benchmarks run.

## Scope Notes

This file focuses on hidden risks in adding rich TTS configuration, GPT-SoVITS, pluggable STT, Chinese/English code-switching, PTT+VAD preview, cloud ASR, and a dedicated AEC phase to the existing app.

Current baseline verified from code:

- `TTSGateway` eagerly loads one Piper voice at sidecar startup, warms ORT, opens one long-lived `sounddevice.OutputStream`, and exposes `voice`, `stream`, and `sample_rate` as process-global objects.
- `TTSTaskManager` does parallel per-sentence synthesis but preserves ordered playback through `sequence_number`; it emits `AudioPayloadMessage` to the renderer and `SpeechEnvelopePayload` to the compositor before blocking stream writes in an executor.
- `server.py` constructs TTS, LLM, orchestrator, VTS writer, compositor, and plugin runtime in one lifespan path; TTS boot failure currently degrades to “TTS failed to initialize” with no provider-level fallback surface.
- Settings has a truthful but read-only TTS section today; provider-specific settings, STT settings, input devices, credentials, and AEC status do not exist yet.
- `.planning/REQUIREMENTS.md` was requested but is absent; active v3.0 requirements were read from `.planning/PROJECT.md` and `.planning/STATE.md` instead.

Suggested phase ownership below assumes v3.0 starts at Phase 16:

| Phase | Suggested Ownership |
|-------|---------------------|
| **Phase 16: Audio Backend Contracts** | TTS/STT provider interfaces, config schema, health/test/fallback semantics, audio device contracts |
| **Phase 17: GPT-SoVITS + Rich TTS** | GPT-SoVITS integration, presets, reference audio, TTS latency/fallback, model packaging policy |
| **Phase 18: Voice Settings UI + Persistence** | Settings UX, credential storage, provider toggles, restart/hot-swap copy, diagnostics |
| **Phase 19: STT Providers** | FunASR/faster-whisper/OpenAI/Groq implementation, model download/cache, provider errors |
| **Phase 20: PTT + VAD Preview UX** | Capture state machine, chunk preview, final transcript, interruption, turn pipeline integration |
| **Phase 21: Code-Switch Evaluation + Hardening** | Chinese/English benchmark set, accuracy gates, provider comparison, language/punctuation behavior |
| **Phase 22: AEC Prototype + Decision** | Echo/self-transcription prevention, no-headphones reality check, supported-mode declaration |

## Critical Pitfalls

### Pitfall 1: Breaking sentence ordering and lipsync while abstracting TTS

**What goes wrong:** A new provider abstraction returns audio directly to the UI or writes directly to a device, bypassing `TTSTaskManager` ordering and the `SpeechEnvelopePayload` path used by lipsync/speech-driver motion. GPT-SoVITS responses may arrive out of order because later short sentences synthesize faster than earlier long sentences.

**Why it happens:** The current code couples synthesis, renderer audio payloads, local playback, and compositor RMS timing in one manager. A naive “provider.speak(text)” API hides sample rate, volumes, PCM, duration, and `sentence_id`.

**Consequences:** Chat text appears in the right order but audio plays out of order; VTS mouth movement is early/late; sentence-complete events fire against the wrong sentence; final turn completion may occur before audible playback drains.

**Warning signs:**

- Logs show `TTS-SYNTH-END` for sentence 2 before sentence 1 and `TTS-WRITE-START` also follows that wrong order.
- Lipsync envelope starts before the first audible sample or continues after audio ends.
- GPT-SoVITS provider works in tests but the avatar mouth is flat because no RMS envelope was generated.

**Prevention:**

- Phase 16 must define the TTS provider contract as `synthesize(sentence) -> AudioArtifact`, not `speak()`. The manager remains the single owner of ordering, playback, renderer payload emission, compositor speech envelope, and completion.
- `AudioArtifact` must include normalized PCM bytes, sample rate, duration, RMS/volume frames, provider metadata, and whether audio is silent/fallback.
- Preserve `sequence_number` ordering exactly; provider tasks can run in parallel but only the existing sender queue writes and emits.
- Add a cross-provider test with forced out-of-order synthetic completion.

**Phase owner:** Phase 16, regression-tested again in Phase 17.

### Pitfall 2: Treating GPT-SoVITS like a bundled library instead of an external/runtime dependency

**What goes wrong:** The app tries to install, train, version, or package GPT-SoVITS inside the sidecar. The release suddenly depends on PyTorch/CUDA/FFmpeg/GPT-SoVITS model files and becomes multi-GB, brittle, and GPU-environment-specific.

**Why it happens:** GPT-SoVITS is attractive as “the voice feature,” but the project requirement explicitly says external-server mode plus optional app-managed launch command; no dependency installer or model training/cloning UI. Official GPT-SoVITS docs list Python/PyTorch/CUDA variants, FFmpeg, pretrained models, G2PW/UVR5/ASR assets, Docker variants, and large integrated packages.

**Consequences:** Installer bloat, CUDA mismatch support burden, model licensing ambiguity, sidecar startup failure on machines without GPU, and violation of local-first “zero-config Piper fallback” expectations.

**Warning signs:**

- `pyproject.toml` gains `torch`, GPT-SoVITS repo dependencies, UVR5, or model files for default install.
- “Manage GPT-SoVITS” UI grows training/dataset tabs.
- Sidecar boot waits for SoVITS model loading before `[READY]`.

**Prevention:**

- Phase 17 must implement GPT-SoVITS as an HTTP client first. App-managed mode is only a user-provided command + health check + kill-on-exit policy, not an installer.
- Keep Piper bootable and selectable even when GPT-SoVITS is misconfigured.
- Store reference audio paths and provider settings; never copy large models into app data unless explicitly user-selected.
- Document “bring your own GPT-SoVITS service/model” in UI copy.

**Phase owner:** Phase 17; Phase 18 owns UX copy.

### Pitfall 3: Unbounded model download and packaging size for local STT

**What goes wrong:** FunASR, faster-whisper, VAD, punctuation, and code-switch models are bundled by default or auto-downloaded without confirmation. User data/cache expands unexpectedly; CI/package builds become slow; offline startup blocks on Hugging Face/ModelScope access.

**Why it happens:** FunASR workflows commonly load models by name and download from ModelScope/Hugging Face. faster-whisper also downloads CTranslate2 models by name. Existing Piper code currently guards one known local `.onnx`; v3.0 will add multiple model families with very different sizes.

**Consequences:** Broken “local-first but controllable” posture, install bloat, first-recording timeout, opaque download failures in restricted networks, and support tickets about disk usage.

**Warning signs:**

- First PTT attempt logs model download progress but UI just says “recording.”
- `sidecar/models/` grows many hundreds of MB/GB in git or package artifacts.
- Tests pass on developer machine only because models are already cached globally.

**Prevention:**

- Phase 19 must introduce a model cache policy: no surprise downloads; explicit “download local STT model” action with size, source, disk path, checksum if available, and cancel/resume behavior.
- Keep faster-whisper fallback selectable but lazy-loaded; do not load every provider at sidecar startup.
- Add diagnostics for model path, cache size, provider loaded/not-loaded, and missing model remediation.
- CI should mock providers and include a “no global cache” test path.

**Phase owner:** Phase 19; Phase 18 surfaces cache/settings UI.

### Pitfall 4: Assuming no-headphones AEC is solved because OLVT/reference UX says interruption or no-headphones works

**What goes wrong:** VAD hears the avatar’s own Piper/GPT-SoVITS output through speakers, transcribes it as user speech, interrupts the assistant, and sends the avatar’s own words back into the LLM. The app then spirals into self-conversation or “why did you repeat yourself?” failures.

**Why it happens:** Echo cancellation is much harder in a desktop app with `sounddevice` playback, arbitrary output devices, VTube Studio running separately, OS mixer effects, and no guaranteed reference stream into the microphone capture path. VAD alone is not AEC.

**Consequences:** No-headphones mode is unusable; “voice interruption” feels haunted; cloud ASR bills for the assistant’s own speech; conversation history stores false user turns.

**Warning signs:**

- During TTS, VAD speech probability rises in sync with `TTS-WRITE-START` / RMS envelope.
- Preview text contains exact assistant sentence fragments.
- Final transcripts appear while the user is silent; they often start 100–500ms after playback begins.
- Open mic works with headphones but fails with speakers.

**Prevention:**

- Phase 22 must be a real decision phase, not an implementation victory lap. Define supported modes: `headphones recommended`, `barge-in disabled during TTS`, `barge-in with ducking`, or `AEC experimental` based on measured evidence.
- Before real AEC exists, gate VAD finalization during app-owned TTS and/or subtract using a conservative “TTS active + high mic correlation” self-speech detector.
- Keep PTT available as the reliable path. For VAD, default to not submitting while TTS is active unless the phase proves safe barge-in.
- Build an echo test harness: play known TTS phrase through speakers, capture mic, assert it is not submitted as user text.

**Phase owner:** Phase 22; Phase 20 must include temporary self-transcription guards.

### Pitfall 5: VAD preview text treated as final transcript

**What goes wrong:** The UI streams unstable partial ASR into chat/history or the LLM. Words flicker, code-switch text flips language/script, and the final transcript differs from what was sent.

**Why it happens:** Streaming/preview ASR and final ASR have different semantics. FunASR streaming can emit partial chunks; OpenAI/Groq file transcription can stream deltas for completed recordings; VAD emits start/end events, not “this is final text.”

**Consequences:** The LLM answers incomplete or wrong text; conversation history violates “as-heard final transcript”; users lose trust because preview corrections look like edits after submission.

**Warning signs:**

- `appendUserMessage` is called before VAD end / PTT release.
- Preview chips become persisted messages after an error.
- Final transcript is a prefix/suffix mismatch with visible preview.

**Prevention:**

- Phase 20 must model STT UI state explicitly: `idle -> listening -> previewing(partial) -> finalizing -> submitted|discarded|error`.
- Preview text is visually distinct and never persisted. Only a `final_transcript` event can enter the existing `TextInput` / turn pipeline.
- Preserve “final transcript as-heard” by disabling post-ASR translation/paraphrase before LLM submission. Optional punctuation/ITN must be provider-labeled and test-covered.

**Phase owner:** Phase 20; Phase 21 validates final-transcript quality.

### Pitfall 6: Code-switching target lacks a measurable eval, so “high accuracy” becomes anecdotal

**What goes wrong:** FunASR is chosen as default, faster-whisper is fallback, and cloud providers are added, but nobody can say whether Chinese/English mixed utterances are good enough. Regressions ship because manual tests use simple monolingual phrases.

**Why it happens:** Code-switching quality is not captured by ordinary English WER or Mandarin CER alone. Problems include language boundary errors, proper nouns, product names, Japanese avatar names, punctuation, simplified/traditional drift, and unwanted translation.

**Consequences:** Users speaking “帮我 open settings 然后 search GPT-SoVITS” get mangled commands; cloud/local provider comparisons become subjective; settings expose knobs without guidance.

**Warning signs:**

- Acceptance criteria say “Chinese and English work” with no corpus.
- Tests assert provider returns non-empty text only.
- Whisper translation endpoint is accidentally used and outputs English instead of original mixed language.

**Prevention:**

- Phase 21 must create a small locked eval set: 30–50 recorded or generated utterances covering Mandarin, English, mixed clauses, mixed nouns, acronyms, avatar names, app terms, fillers, and noisy/near-field samples.
- Score separately: Chinese CER, English WER, mixed-token exact match for key terms, “no translation” invariant, punctuation/ITN acceptability.
- Run at least FunASR default, faster-whisper local fallback, OpenAI, and Groq on the same files; store results in planning artifacts.
- Provider selection copy should say “best measured for your language target” only after this eval.

**Phase owner:** Phase 21, with provider hooks from Phase 19.

### Pitfall 7: Cloud ASR credentials and privacy are bolted onto the LLM config path

**What goes wrong:** OpenAI/Groq STT keys are stored in the existing LLM config blob or logged in provider errors. Audio is sent to cloud providers without a clear opt-in boundary. Local-first promise becomes ambiguous.

**Why it happens:** The app already has provider config storage and setup UI. It is tempting to reuse the same key/endpoint fields and “Connection” section for STT.

**Consequences:** Users unintentionally send microphone audio to cloud; key rotation and provider-specific permissions are confusing; logs or crash reports may contain API keys, endpoints, file paths, or transcript snippets.

**Warning signs:**

- STT provider defaults to OpenAI/Groq because LLM provider is cloud.
- Logs include request headers, multipart filenames, or full cloud exceptions.
- Settings has one global “API key” with no distinction between LLM and ASR.

**Prevention:**

- Phase 18 must create an explicit Voice Input provider section with local providers first and cloud providers opt-in.
- Store STT credentials in safeStorage under provider-specific fields; redact all keys and signed URLs in logs.
- Add “cloud transcription sends microphone audio to provider” copy next to enable/test buttons.
- Network egress prompts are v4 agent scope, but v3.0 should at least pre-approve only the configured STT host and show it.

**Phase owner:** Phase 18; Phase 19 implements redacted cloud clients.

### Pitfall 8: Provider failure semantics are inconsistent, causing silent fallback or wrong-user text

**What goes wrong:** GPT-SoVITS failure falls back to Piper for some turns but not others; STT timeout returns empty text and submits it; cloud 429 is shown as “no speech detected”; provider health is green because app booted, not because the selected provider works.

**Why it happens:** Current sidecar has one TTS boot path and one generic startup error message. Provider health/test endpoints do not yet exist. OLVT-style many-provider configs can become a maze if each provider invents its own errors.

**Consequences:** Hard-to-debug voice failures, unexpected provider switching, loss of character voice, cloud bills/retries, and corrupted conversation turns.

**Warning signs:**

- `except Exception` maps all STT errors to empty transcript.
- UI only has sidecar green/red, no selected TTS/STT provider health.
- Fallback happens without a toast/log event carrying provider/fallback reason.

**Prevention:**

- Phase 16 must define provider statuses and error taxonomy: `not_configured`, `missing_model`, `unreachable`, `auth_failed`, `rate_limited`, `timeout`, `unsupported_audio`, `no_speech`, `internal_error`.
- TTS fallback to Piper is allowed but must be visible per turn and logged as `[TTS-FALLBACK] provider=... reason=... sentence_id=...`.
- STT should not fallback silently after the user spoke; if a provider fails during finalization, show retry/change-provider/discard options unless fallback is explicitly enabled.

**Phase owner:** Phase 16; Phase 18/19/20 consume statuses.

## Moderate Pitfalls

### Pitfall 9: Audio sample-rate/channel normalization is forgotten between providers

**What goes wrong:** GPT-SoVITS outputs 24k/32k/48k or stereo audio while Piper uses 22.05k mono. STT providers expect 16k mono or perform their own downsampling. RMS frame timing and `slice_length=20` drift from real playback duration.

**Warning signs:** Chipmunk/slow playback, `sounddevice` errors, lipsync gradually drifts, STT latency improves after manual ffmpeg conversion.

**Prevention:** Phase 16 should mandate an internal audio format boundary: TTS artifacts normalized for playback/envelope; STT capture normalized to 16k mono PCM/WAV before provider call unless provider explicitly accepts another format. Keep original provider sample rate in metadata for diagnostics.

**Phase owner:** Phase 16; Phase 17/19 validate per provider.

### Pitfall 10: Rich settings UI exposes every backend knob and becomes unusable

**What goes wrong:** GPT-SoVITS tuning, FunASR model/VAD/punc options, faster-whisper beam/temperature/compute type, OpenAI/Groq prompts/language/response formats, and VAD thresholds all land in one long settings section.

**Warning signs:** Users must understand “chunk lookback,” “beam size,” “temperature,” “ITN,” and “merge_vad” to get a working mic.

**Prevention:** Phase 18 should separate Basic vs Advanced. Basic: provider, health/test, model/preset, input/output device, VAD sensitivity, cloud credential. Advanced: provider-native tuning with reset-to-default and tooltips. Presets should store provider-specific knobs under versioned schemas.

**Phase owner:** Phase 18.

### Pitfall 11: Hot-swapping audio devices/providers mid-turn corrupts active queues

**What goes wrong:** User changes TTS output device or provider while sentences are queued. Some sentences play on old provider/device, some on new, and completion state mismatches.

**Warning signs:** Changing Settings during speech causes `TTS-WRITE-END` never to appear, or the current sentence is cut off despite design saying boundary-only hot-swap.

**Prevention:** Adopt existing design: settings changes apply at next TTS turn boundary or next STT session. Mark restart/next-turn pending in UI. Do not mutate `TTSTaskManager._stream` or provider instance while `_payload_queue` is active.

**Phase owner:** Phase 16 contract, Phase 18 UI.

### Pitfall 12: Voice interruption collides with conversation-history persistence rules

**What goes wrong:** User barge-in interrupts an assistant turn; partial assistant text/audio gets persisted as a complete history turn, or the user’s interrupt transcript is appended to the wrong session.

**Warning signs:** History contains half assistant responses after stop/interruption; active session title updates from partial STT preview; `conversation-chain-end` is emitted after an interrupted drain.

**Prevention:** Phase 20 must reuse v2.1 history rule: only complete turns persist. Add explicit `interrupted` terminal state for assistant turns and tests that interrupted audio does not save as complete. If interruption cancels TTS tasks, also cancel/flush speech envelopes and sentence-complete queues coherently.

**Phase owner:** Phase 20.

### Pitfall 13: Cloud ASR file-size/streaming limits mismatch the app’s preview UX

**What goes wrong:** PTT recordings longer than provider upload limits fail late; cloud “streaming” APIs are confused with local VAD preview; Groq/OpenAI transcription limits differ and responses expose different timestamp/confidence fields.

**Warning signs:** Long utterances fail after release; cloud provider preview stays blank until final; word timestamps work on one provider but not another.

**Prevention:** Phase 19 provider contracts must distinguish `supports_partial_preview`, `supports_file_final`, `max_upload_bytes`, `max_duration_s`, `supports_word_timestamps`, and `supports_confidence`. Phase 20 UI should degrade honestly: local preview if available; otherwise recording meter + finalizing spinner.

**Phase owner:** Phase 19 and Phase 20.

### Pitfall 14: CPU/GPU contention destroys avatar responsiveness

**What goes wrong:** Local ASR, GPT-SoVITS, Piper/ONNX, VTS, and Electron compete for CPU/GPU. The compositor’s 60 Hz loop stutters, TTS first sentence is delayed, or STT finalization blocks the event loop.

**Warning signs:** VTS motion freezes during transcription; `TTS-SYNTH-END` spikes when ASR runs; renderer websocket heartbeat/reconnect occurs during model inference; fan/GPU usage pegs while app looks idle.

**Prevention:** Lazy-load heavy models, move CPU/GPU inference off the asyncio loop, cap concurrency (`one STT finalization`, bounded TTS synth workers), expose compute-mode settings, and benchmark on CPU-only plus midrange GPU. Treat local code-switch default as “quality target with latency budget,” not just best WER.

**Phase owner:** Phase 19 for ASR, Phase 17 for GPT-SoVITS, Phase 20 for interaction timing.

### Pitfall 15: Reference-audio management leaks private files or breaks avatar portability

**What goes wrong:** GPT-SoVITS presets store absolute paths to personal recordings; moving avatar/user-data breaks presets; logs reveal filenames; delete/reset leaves orphaned reference audio.

**Warning signs:** `voice.yaml` contains `C:\Users\...\Downloads\my_voice.wav`; export/backup misses referenced files.

**Prevention:** Phase 17 should copy explicitly selected short reference clips into per-avatar/user-data voice assets with sanitized filenames, store relative paths, track provenance, and offer delete. Do not log full paths unless debug mode redacts home directory.

**Phase owner:** Phase 17; Phase 18 handles UI delete/reset.

## Minor Pitfalls

### Pitfall 16: Punctuation/ITN alters “as-heard” semantics

**What goes wrong:** Provider post-processing changes “二点零” to “2.0”, “open AI” to “OpenAI”, or adds punctuation that changes intent. Sometimes helpful, sometimes not “as heard.”

**Prevention:** Treat punctuation/ITN as provider-labeled normalization. Default to readable final transcript, but preserve raw provider text in debug metadata and include eval cases for numbers, acronyms, and commands.

**Phase owner:** Phase 21.

### Pitfall 17: VAD threshold slider is not calibrated to the actual selected microphone

**What goes wrong:** Medium sensitivity works on the developer mic but fails for laptop arrays or noisy rooms.

**Prevention:** Phase 20 should include a live level/VAD meter and “test my room” calibration path. Store per-input-device sensitivity if device IDs are stable enough; otherwise surface recalibration when the selected mic changes.

**Phase owner:** Phase 20.

### Pitfall 18: Settings health tests use different audio path than real chat

**What goes wrong:** “Test voice” works but chat TTS fails because test endpoint bypasses sentence-buffered queue, output stream, or compositor envelope.

**Prevention:** Phase 16/18 health endpoints should report layered checks separately: provider reachable, synthesis ok, playback ok, envelope ok. The audible test should use the same TTS manager path when possible, tagged as test/non-history.

**Phase owner:** Phase 16 and Phase 18.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Phase 16: Audio backend contracts | Abstracting too high and losing sentence ordering/RMS/completion semantics | Contract around artifacts and provider capabilities; manager remains owner of playback/order |
| Phase 16: Config contracts | Provider-specific settings become unversioned blobs | Version every provider config and preset; migration tests before writing user data |
| Phase 17: GPT-SoVITS | Treating SoVITS as bundled dependency | External HTTP client first; app-managed launch command only; Piper fallback visible |
| Phase 17: TTS latency | First sentence takes 1–3s and UI looks frozen | Warmup/test synth; “buffering voice” indicator after display text; latency logging per provider |
| Phase 17: Reference audio | Absolute paths/private clips leak | Copy into controlled per-avatar asset dir; relative paths; delete and redaction |
| Phase 18: Settings | One giant expert panel | Basic/Advanced split; health cards; provider-specific advanced drawer |
| Phase 18: Credentials | Reusing LLM key fields for STT | Separate safeStorage keys and explicit cloud audio opt-in copy |
| Phase 19: Local STT | Surprise model downloads and cache bloat | Explicit download manager/cache policy; lazy load; no model files in git/package by default |
| Phase 19: Cloud STT | Rate limits/timeouts become empty transcripts | Error taxonomy; retry/backoff; no silent fallback/submission |
| Phase 20: VAD/PTT | Preview sent to LLM before final | Explicit preview/final state machine; final-only TextInput |
| Phase 20: Interruption | Self-transcription and partial history | TTS-active guard; interrupted turn state; no persist until chain end |
| Phase 21: Code-switch eval | “Works for me” quality target | Locked bilingual eval corpus and per-provider scorecard |
| Phase 22: AEC | Claiming speaker/no-headphones support too early | Empirical echo harness; supported-mode matrix; headphones/PTT fallback |

## Sources

- Project source: `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `sidecar/src/sidecar/tts/tts_gateway.py`, `sidecar/src/sidecar/tts/tts_manager.py`, `sidecar/src/sidecar/ws/server.py`, `apps/renderer/src/screens/Settings/Settings.tsx` — HIGH confidence.
- Project design: `PROJECT_DESIGN.md` §5.6, §13.12, §13.16, §13.46, §13.89, §13.100, §13.101, §13.109, §13.119, §15 R-15/R-18 — HIGH confidence for intended architecture.
- GPT-SoVITS official GitHub README: external service complexity, Python/PyTorch/CUDA/FFmpeg/model requirements, cross-lingual support, API files, large integrated packages — MEDIUM/HIGH confidence.
- FunASR official GitHub README: ASR/VAD/punctuation features, streaming/non-streaming examples, SenseVoice/Paraformer/FSMN-VAD, model zoo, ModelScope/Hugging Face downloads — HIGH confidence.
- faster-whisper official GitHub README: CTranslate2 speed/memory tradeoffs, GPU library requirements, model download behavior, generator semantics, VAD filter — HIGH confidence.
- OpenAI Speech-to-Text docs: transcription/translation distinction, 25 MB file limit, streaming/realtime transcription, prompts, supported formats/languages, timestamp limitations — HIGH confidence.
- Groq Speech-to-Text docs: OpenAI-compatible transcription endpoints, Whisper model choices, file limits, language parameter, timestamp/confidence metadata, chunking guidance — HIGH confidence.
- Open-LLM-VTuber reference: used as architectural warning source per project context, but no local OLVT checkout was present in this repo during this research pass — MEDIUM confidence for specific OLVT implementation details beyond project-cited references.
