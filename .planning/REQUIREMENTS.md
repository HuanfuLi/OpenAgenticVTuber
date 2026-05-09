# Requirements: AgenticLLMVTuber v3.0

**Defined:** 2026-05-09  
**Milestone:** v3.0 Rich Voice Configuration + Voice Input  
**Core Value:** Multi-avatar identity persistence (v1 horizon — v3.0 improves voice usability before memory/avatar identity work)

v3.0 turns the app from text-first chat with Piper output into a configurable voice companion. The milestone preserves the existing ordered TTS playback, RMS/lipsync, VTube Studio compositor, and conversation-history semantics while adding GPT-SoVITS output and high-accuracy Chinese/English STT input.

## v3.0 Requirements

### Audio Configuration

- [ ] **AUDIO-01**: User can see available TTS and STT providers with capability labels such as Local, Cloud, Chinese/English, Requires API key, and Requires external service.
- [x] **AUDIO-02**: User can save audio configuration through versioned app settings without breaking existing LLM, VTS, conversation history, or avatar catalog settings.
- [x] **AUDIO-03**: User sees clear provider health and error states for unavailable models, missing credentials, external-service failures, and timeouts.
- [x] **AUDIO-04**: Existing Piper TTS behavior remains available as the fallback baseline with ordered sentence playback and VTS lipsync.

### TTS + GPT-SoVITS

- [ ] **TTS-01**: User can select Piper or GPT-SoVITS as the active TTS provider.
- [ ] **TTS-02**: User can configure GPT-SoVITS external-server settings and run a health check before using it.
- [ ] **TTS-03**: User can configure an optional app-managed GPT-SoVITS launch command, working directory, health URL, and stop/restart action.
- [ ] **TTS-04**: User can run test synthesis for the active TTS provider and hear the result without sending a chat turn.
- [x] **TTS-05**: TTS output from every provider flows through the existing ordered playback, renderer audio payload, and RMS/lipsync path.
- [ ] **TTS-06**: User sees a visible fallback/error state when GPT-SoVITS fails; the app never silently changes provider mid-turn.

### Voice Presets + Reference Audio

- [ ] **PRESET-01**: User can create, rename, select, and delete named voice presets.
- [ ] **PRESET-02**: User can configure backend-specific tuning controls for a preset, including GPT-SoVITS reference text/language and synthesis knobs.
- [ ] **PRESET-03**: User can import/manage GPT-SoVITS reference audio with validation and sanitized app-managed storage.
- [ ] **PRESET-04**: User can associate the active avatar/session with a voice preset without modifying avatar import catalogs.

### STT Providers

- [ ] **STT-01**: User can enable STT with FunASR as the default local provider.
- [ ] **STT-02**: User can select faster-whisper as a local fallback STT provider.
- [ ] **STT-03**: User can configure OpenAI transcription as an explicit opt-in cloud STT provider.
- [ ] **STT-04**: User can configure Groq transcription as an explicit opt-in cloud STT provider.
- [ ] **STT-05**: User can run a test transcription for the selected STT provider before enabling voice input.
- [ ] **STT-06**: User can see and control local model cache/download behavior before large STT models are loaded or fetched.

### Voice Input UX

- [ ] **VIN-01**: User can grant microphone permission and see the current microphone/listening state.
- [ ] **VIN-02**: User can use push-to-talk voice input to record an utterance, preview transcription chunks, and submit only the final transcript.
- [ ] **VIN-03**: User can enable VAD auto-submit with visible sensitivity and silence-timeout controls.
- [ ] **VIN-04**: User sees recording/preview/finalizing/error states that distinguish preview text from submitted chat text.
- [ ] **VIN-05**: Final STT text enters the existing chat pipeline unchanged, preserving conversation history semantics and applying no translation.
- [ ] **VIN-06**: User speech captured while a turn is in progress is queued safely rather than corrupting active TTS/playback state.

### Code-Switch Quality

- [ ] **CODE-01**: User can speak Chinese, English, or mixed Chinese/English in one utterance without manually switching language mode.
- [ ] **CODE-02**: The milestone includes a locked bilingual/code-switch evaluation corpus and provider scorecard.
- [ ] **CODE-03**: The default STT provider recommendation is backed by eval results for semantic correctness, key-token retention, and no-translation invariants.
- [ ] **CODE-04**: User-facing copy accurately describes provider strengths and limitations for Chinese, English, and code-switching.

### Echo Cancellation / No-Headphones

- [ ] **AEC-01**: The milestone prototypes browser/WebRTC echo cancellation with renderer mic capture and records real results.
- [ ] **AEC-02**: The milestone tests TTS-active self-transcription risk and prevents assistant speech from being auto-submitted as user speech.
- [ ] **AEC-03**: User sees truthful no-headphones support status: supported, experimental, or use-headphones/PTT fallback.
- [ ] **AEC-04**: VAD defaults stay conservative until AEC/no-headphones behavior is verified.

### Privacy + Reliability

- [ ] **PRIV-01**: Cloud STT providers are never enabled by default and require separate explicit credentials/consent.
- [ ] **PRIV-02**: STT credentials, reference-audio paths, and transcript/error logs are redacted where appropriate.
- [ ] **PERF-01**: Heavy local models are lazy-loaded and do not block app boot.
- [ ] **PERF-02**: TTS/STT latency, timeout, and provider failure logs are available in diagnostics without exposing secrets.
- [x] **PERF-03**: Provider work runs off the event loop and does not block chat WebSocket, compositor, or HUD traffic.

## Future Requirements

Deferred beyond v3.0. Tracked but not in the current roadmap.

### Voice + Audio

- **VOICE-FUTURE-01**: Wake-word activation.
- **VOICE-FUTURE-02**: Barge-in interruption that cancels active TTS and starts a new turn mid-speech.
- **VOICE-FUTURE-03**: Full STT translation or conversation-language normalization before LLM submission.
- **VOICE-FUTURE-04**: edge-tts and ComfyUI TTS providers.
- **VOICE-FUTURE-05**: GPT-SoVITS dependency installer, model training, or voice-cloning UI.
- **VOICE-FUTURE-06**: Learned audio-to-parameter drivers replacing rule-based RMS/lipsync.

### Product Roadmap

- **MEM-FUTURE-01**: Per-avatar episodic memory, shared user-facts, semantic retrieval, and memory deletion controls.
- **AGENT-FUTURE-01**: Agent mode, goal loop, screen control, scheduled goals, skills system, and audit log.
- **FORM-FUTURE-01**: Pet mode, click-through window, dockable chat, and avatar drag/inertia.
- **MULTI-FUTURE-01**: First-class multi-avatar switching backed by per-avatar identity state.

## Out of Scope

Explicitly excluded from v3.0 to prevent scope creep.

| Feature | Reason |
|---------|--------|
| GPT-SoVITS installer/training/voice cloning | Users provide and run their own GPT-SoVITS model/service; v3.0 is a client/configuration milestone. |
| Silent cloud STT fallback | Violates local-first expectations and could leak audio/cost without consent. |
| Wake word | Project decision: raw VAD only when voice ships. |
| Translation before LLM | User explicitly wants final transcript sent as heard. |
| Perfect no-headphones claim | AEC requires empirical validation; v3.0 includes a decision phase but does not assume success. |
| Barge-in interruption | Prioritized queue-after/current-turn semantics for v3.0; cancellation can be a future voice UX milestone. |
| Mobile companion | Separate future project with its own design and renderer constraints. |

## Traceability

Populated by the roadmapper during ROADMAP.md creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIO-01 | Phase 18 | Pending |
| AUDIO-02 | Phase 16 | Complete |
| AUDIO-03 | Phase 16 | Complete |
| AUDIO-04 | Phase 16 | Complete |
| TTS-01 | Phase 17 | Pending |
| TTS-02 | Phase 17 | Pending |
| TTS-03 | Phase 17 | Pending |
| TTS-04 | Phase 17 | Pending |
| TTS-05 | Phase 16 | Complete |
| TTS-06 | Phase 17 | Pending |
| PRESET-01 | Phase 17 | Pending |
| PRESET-02 | Phase 17 | Pending |
| PRESET-03 | Phase 17 | Pending |
| PRESET-04 | Phase 17 | Pending |
| STT-01 | Phase 19 | Pending |
| STT-02 | Phase 19 | Pending |
| STT-03 | Phase 19 | Pending |
| STT-04 | Phase 19 | Pending |
| STT-05 | Phase 19 | Pending |
| STT-06 | Phase 19 | Pending |
| VIN-01 | Phase 20 | Pending |
| VIN-02 | Phase 20 | Pending |
| VIN-03 | Phase 20 | Pending |
| VIN-04 | Phase 20 | Pending |
| VIN-05 | Phase 20 | Pending |
| VIN-06 | Phase 20 | Pending |
| CODE-01 | Phase 21 | Pending |
| CODE-02 | Phase 21 | Pending |
| CODE-03 | Phase 21 | Pending |
| CODE-04 | Phase 21 | Pending |
| AEC-01 | Phase 22 | Pending |
| AEC-02 | Phase 22 | Pending |
| AEC-03 | Phase 22 | Pending |
| AEC-04 | Phase 22 | Pending |
| PRIV-01 | Phase 18 | Pending |
| PRIV-02 | Phase 18 | Pending |
| PERF-01 | Phase 19 | Pending |
| PERF-02 | Phase 18 | Pending |
| PERF-03 | Phase 16 | Complete |

**Coverage:**
- v3.0 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-05-09*  
*Last updated: 2026-05-09 after v3.0 roadmap traceability mapping*
