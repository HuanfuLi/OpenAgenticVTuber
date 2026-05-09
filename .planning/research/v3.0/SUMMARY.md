# v3.0 Research Summary

**Project:** AgenticLLMVTuber  
**Milestone:** v3.0 Rich Voice Configuration + Voice Input  
**Domain:** local-first desktop VTuber companion voice I/O  
**Researched:** 2026-05-09  
**Confidence:** MEDIUM-HIGH

## Executive Recommendation

v3.0 should turn AgenticLLMVTuber from a text-first companion with TTS into a real voice companion: configurable character voice output, high-quality local-first speech input, and safe PTT/VAD interaction. Keep the existing Electron + React + Python FastAPI sidecar architecture, but introduce sidecar-owned TTS/STT provider abstractions so Piper, GPT-SoVITS, FunASR, faster-whisper, OpenAI, and Groq all plug into narrow contracts rather than leaking provider behavior into UI or turn orchestration.

The recommended path is: preserve Piper/ordered playback/lipsync first, add GPT-SoVITS as an external HTTP service rather than bundled dependency, then add STT provider services with FunASR/SenseVoiceSmall as the Chinese/English code-switch default and faster-whisper as local fallback. Capture microphone audio in the Electron renderer using `getUserMedia()` + AudioWorklet, stream 16 kHz mono PCM to Python over a dedicated voice WebSocket, and submit only final transcripts through the existing text input path unchanged/no translation.

The main risks are not basic provider APIs; they are audio invariants and user trust. GPT-SoVITS must never bypass the sidecar playback/RMS/lipsync path; local ASR must not surprise-download huge models; preview text must not become conversation history; cloud ASR must be explicit opt-in; and AEC/no-headphones support must be treated as an empirical decision phase, not a promised feature. Ship PTT as reliable baseline, VAD with conservative gating, and honest AEC status copy.

## Key Findings

### Stack Additions

**Core audio and capture:**
- **Renderer `getUserMedia()` + AudioWorklet** — default microphone capture path for permission UX, device handling, low-latency PCM frames, and browser WebRTC AEC constraints.
- **Dedicated `/voice/ws`** — keep high-rate audio chunks off the existing chat WebSocket; use JSON/control messages first, with binary chunks later only if profiling demands it.
- **silero-vad 6.2.1** — local VAD state machine with pre-buffer, sensitivity, silence timeout, and max utterance duration controls.

**TTS:**
- **Piper remains fallback/regression baseline** — existing ordered playback and RMS lipsync must continue unchanged.
- **GPT-SoVITS API v2 via HTTP** — integrate external service at `http://127.0.0.1:9880`; do not install/vendor GPT-SoVITS into the sidecar.
- **httpx + soundfile + optional samplerate** — health/test requests, WAV/RAW decoding, validation, and sample-rate normalization.

**STT:**
- **FunASR 1.3.1 + SenseVoiceSmall** — recommended default for Chinese/English/code-switching, pending app-specific UAT.
- **modelscope 1.36.3** — model download/cache support for FunASR, with explicit UI policy.
- **faster-whisper 1.2.1** — mature local fallback; default CPU/int8, CUDA advanced only.
- **OpenAI SDK 2.36.x + Groq SDK 1.2.x** — opt-in cloud transcription providers only; never default.

### Feature Table Stakes

Must ship or be explicitly cut:
- TTS provider abstraction that preserves Piper playback, sentence ordering, audio payloads, and RMS/lipsync.
- GPT-SoVITS external-server provider with API URL, reference audio/prompt metadata, health check, test synthesis, and visible fallback.
- Rich TTS settings UI with provider switch, named presets, health/test, advanced provider controls, and avatar voice summary integration.
- STT provider abstraction with FunASR, faster-whisper, OpenAI, and Groq capability metadata and health/test behavior.
- PTT mode as reliable baseline; VAD mode with sensitivity/silence controls and visible state.
- Chunk/waveform preview while recording; only final transcript is submitted and stored.
- Chinese/English/code-switch quality target with acceptance fixtures.
- Dedicated AEC/no-headphones decision phase with conservative user-facing claims.

### Differentiators

- Avatar-bound voice presets aligned with the long-term multi-avatar identity value.
- Voice setup wizard after raw settings are stable.
- Bilingual calibration/test suite visible in UI.
- Provider capability badges: Local, Cloud, Best for Chinese, Low-latency, Requires GPU/API key, etc.
- Live AEC/VAD state indicator: `Listening`, `Avatar speaking — mic paused`, `Echo filter active`, `Finalizing`.
- Reference-audio library for GPT-SoVITS with validation and sanitized storage.
- Latency/quality diagnostics for advanced users.

### Anti-Features

- No GPT-SoVITS model training, voice-cloning UI, dependency installer, or bundled GPT-SoVITS runtime.
- No STT translation or language normalization before LLM submission; final transcript is sent as heard.
- No wake-word activation.
- No cloud STT default or silent fallback from local to cloud.
- No claims that no-headphones/AEC is solved before empirical tests.
- No full reference-audio editor, provider marketplace, or learned lipsync replacement in v3.0.

## Architecture Recommendations

### Preserve Current Invariants

1. **TTSTaskManager remains the owner of order, playback, renderer audio payloads, RMS envelope generation, speech envelope publication, and completion.** Providers only synthesize audio artifacts.
2. **GPT-SoVITS returns PCM/WAV; it never plays audio.** Sidecar playback remains the single audio output writer.
3. **RMS/lipsync is generated from the final PCM actually written after resampling/normalization.**
4. **Voice final transcripts return to the renderer and reuse the existing submit-text path.** Do not call the orchestrator directly from STT.
5. **Cloud providers are explicit opt-in and separately configured from LLM provider settings.**

### Major Components

- **Renderer `VoiceInputController`** — mic permission, AudioWorklet capture, PTT/VAD UI state, waveform/preview, voice WebSocket client, final transcript submission.
- **Electron main StoredConfig v2 + IPC/preload** — audio config, voice presets, STT credentials, file picker/import, admin endpoint proxy, optional GPT-SoVITS launch controls.
- **Sidecar TTS providers** — `piper` and `gpt_sovits` behind `TTSProvider.synthesize(request) -> TTSAudioResult`.
- **Sidecar AudioOutputSink** — long-lived output stream, resampling, write timing, PCM tap for future AEC.
- **Sidecar STT providers** — FunASR, faster-whisper, OpenAI, Groq behind a 16 kHz mono numpy contract.
- **Sidecar VoiceSession/VAD** — PTT/VAD state machine, pre-buffer, finalization, preview events, provider final transcription.
- **Admin audio endpoints** — provider catalog, status, health/test TTS/STT, GPT-SoVITS launch/stop/status, reference-audio import.

## Phase Ordering Implications

### Phase 16: Audio Contracts + TTS Provider Shell
**Rationale:** All later work depends on stable contracts, config migration, provider health/error taxonomy, and Piper regression safety.  
**Delivers:** Audio Pydantic/TS contracts, StoredConfig v2 migration, TTS provider interface, Piper adapter, provider status/error taxonomy.  
**Avoids:** Breaking sentence ordering, RMS/lipsync, hidden fallback semantics, unversioned provider blobs.  
**Research flag:** Standard pattern; no extra research needed, but requires regression tests.

### Phase 17: GPT-SoVITS Provider + Voice Presets
**Rationale:** Flagship user value, but safe only after provider shell and playback invariants exist.  
**Delivers:** External GPT-SoVITS HTTP provider, optional managed launch command, reference-audio import/validation, named presets, test synthesis, visible Piper fallback.  
**Avoids:** Bundling GPT-SoVITS, bypassing TTSTaskManager, leaking private reference paths, frozen UI during slow synthesis.  
**Research flag:** Light API recheck during planning against current GPT-SoVITS `api_v2.py`.

### Phase 18: Rich Voice Settings + Persistence
**Rationale:** Users need non-YAML controls before providers are useful; credentials/privacy and Basic/Advanced split belong here.  
**Delivers:** Voice Output and Voice Input settings sections, provider health cards, presets UI, cloud opt-in copy, safeStorage fields, diagnostics/log surfaces.  
**Avoids:** One giant expert panel, credential leakage, cloud ambiguity, hot-swapping mid-turn corruption.  
**Research flag:** Standard app UI/settings work; consider UI review, not deeper technical research.

### Phase 19: STT Provider Abstraction + Local/Cloud Providers
**Rationale:** Voice input needs a provider layer before capture UX and VAD can be meaningful.  
**Delivers:** FunASR default, faster-whisper fallback, OpenAI/Groq opt-in adapters, model cache policy, provider health/test endpoints, capability metadata.  
**Avoids:** Surprise model downloads, loading all heavy models at boot, empty-text fallback, cloud file-limit surprises.  
**Research flag:** Needs provider/model/version recheck and packaging spike, especially torch/FunASR on Python 3.12/Windows.

### Phase 20: Renderer Voice Capture + PTT/VAD Preview UX
**Rationale:** Capture and submission must reuse existing conversation semantics; PTT should ship before relying on VAD.  
**Delivers:** `getUserMedia` + AudioWorklet, `/voice/ws`, PTT recording, VAD state machine, waveform/chunk preview, final transcript submitted unchanged.  
**Avoids:** Preview persisted as history, STT direct-to-orchestrator, clipped first syllables, duplicate submissions, self-trigger during TTS.  
**Research flag:** Standard Web Audio/WebSocket implementation; test heavily across devices.

### Phase 21: Code-Switch Evaluation + Hardening
**Rationale:** The Chinese/English accuracy target must be measurable before claiming FunASR is best default.  
**Delivers:** 30-50 utterance eval set, provider scorecard, no-translation invariant tests, language/punctuation/ITN decisions, provider selection copy grounded in evidence.  
**Avoids:** Anecdotal “works for me” quality, accidental translation endpoint, poor mixed-token retention.  
**Research flag:** Needs empirical evaluation, not more desk research.

### Phase 22: AEC Spike + No-Headphones Decision
**Rationale:** AEC outcome depends on real speaker/mic/room behavior and sidecar playback; it must be isolated as a decision phase.  
**Delivers:** Renderer WebRTC AEC test results, TTS-active VAD gating/self-speech suppression, optional PCM reference tap prototype, supported-mode matrix, UI state/copy.  
**Avoids:** Self-conversation loops, cloud ASR billing for assistant speech, overclaiming no-headphones support.  
**Research flag:** High-risk spike. Validate before committing to native/DSP dependencies.

### Phase Ordering Rationale

- Contracts and Piper regression safety must precede all provider work because the existing ordered playback/lipsync path is the highest-value invariant.
- GPT-SoVITS and settings are sequenced before STT UX because rich voice output is the user-confirmed flagship and exercises the audio artifact/output architecture.
- STT providers precede capture UX so `/voice/ws` can target real provider capabilities and failures.
- PTT precedes VAD/AEC because it is the reliable baseline and reduces risk if no-headphones mode is degraded.
- Code-switch evaluation and AEC are explicit hardening/decision phases because both require empirical evidence.

## Watch-Outs and Mitigations

1. **TTS abstraction breaks ordering/lipsync** — keep providers as `synthesize()` only; manager owns queue/write/envelope; add forced out-of-order provider tests.
2. **GPT-SoVITS becomes bundled dependency** — external HTTP client only; optional user command launcher; no installer/training/model packaging.
3. **Local ASR downloads/models surprise users** — explicit model/cache UI, lazy load providers, no model files in git/package, diagnostics for cache path/size.
4. **AEC self-transcription loops** — default PTT, gate VAD during avatar speech until proven safe, build echo harness, publish supported-mode matrix.
5. **Preview treated as final** — explicit recording state machine; only `stt-final` can submit to chat/history.
6. **Code-switch quality is anecdotal** — locked bilingual eval corpus with CER/WER/key-token/no-translation scoring.
7. **Cloud privacy/cost leakage** — separate STT credentials, visible opt-in copy, redacted logs, no silent cloud fallback.
8. **Provider failures become empty turns** — shared error taxonomy; STT failure offers retry/change/discard; TTS fallback visible per turn.
9. **Sample-rate/channel drift** — normalize TTS output before playback/RMS and STT input to 16 kHz mono; retain provider metadata for diagnostics.
10. **CPU/GPU contention** — lazy-load heavy models, bound concurrency, keep inference off event loop, expose CPU/CUDA options.

## Requirement Implications

Recommended candidate requirement categories and REQ-ID prefixes for requirements definition:

| Category | Prefix | Candidate requirements |
|----------|--------|------------------------|
| Voice configuration model | `REQ-V3-AUDIO-CONFIG-*` | Versioned audio config, provider capability catalog, provider health/error taxonomy, StoredConfig v2 migration. |
| TTS provider/output | `REQ-V3-TTS-*` | Piper regression baseline, GPT-SoVITS external provider, normalized PCM artifact, ordered playback preservation, RMS/lipsync from final PCM, visible fallback. |
| Voice presets/assets | `REQ-V3-PRESET-*` | Named presets, avatar-bound preset reference, reference-audio import/validation, sanitized storage, provider-specific advanced knobs. |
| Settings and diagnostics | `REQ-V3-SETTINGS-*` | Basic/Advanced settings split, test synthesis/transcription, provider health cards, launch-command logs, COPY-backed user strings. |
| STT providers | `REQ-V3-STT-*` | FunASR default, faster-whisper fallback, OpenAI/Groq opt-in, local model cache policy, cloud credential handling, provider capability metadata. |
| Voice input UX | `REQ-V3-VOICE-IN-*` | Renderer capture, PTT, VAD, recording state machine, preview as transient UI, final transcript submitted unchanged through text path. |
| Code-switch quality | `REQ-V3-CODESWITCH-*` | Bilingual eval set, no-translation invariant, mixed-token scoring, provider comparison, acceptance fixtures. |
| AEC/no-headphones | `REQ-V3-AEC-*` | Browser AEC baseline, TTS-active gating, echo harness, supported-mode matrix, degraded/PTT fallback copy. |
| Privacy/security | `REQ-V3-PRIVACY-*` | Local-first defaults, cloud ASR explicit opt-in, redacted logs, no always-on invisible mic capture, separate STT secrets. |
| Performance/reliability | `REQ-V3-PERF-*` | Lazy model load, bounded synthesis/transcription concurrency, latency logging, timeout/retry policy, no surprise downloads. |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core APIs and package versions are current; FunASR/code-switch quality and torch packaging need live validation. |
| Features | MEDIUM-HIGH | Strong alignment across project context, OLVT reference, and user-confirmed scope; wizard/barge-in should remain optional. |
| Architecture | MEDIUM-HIGH | TTS/STT boundaries are clear and fit existing code; AEC with sidecar playback remains uncertain. |
| Pitfalls | HIGH | Risks are grounded in current code invariants and known audio/provider failure modes. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **FunASR default quality:** Validate on Chinese/English mixed utterances before locking provider copy.
- **Torch/FunASR packaging:** Confirm Python 3.12 Windows/macOS/Linux install and CPU-wheel strategy.
- **Best OpenAI transcription model:** Recheck provider model list during implementation; keep model configurable.
- **AEC real-world outcome:** Browser AEC may be weak because playback is sidecar-owned; require no-headphones UAT and fallback modes.
- **Cloud STT limits/cost:** Verify upload limits, streaming/preview semantics, and timeout behavior during provider implementation.
- **Reference-audio path semantics:** Confirm external GPT-SoVITS server can access app-managed copied files; health/test must validate this.

## Sources

### Primary (HIGH confidence)
- `.planning/research/v3.0/STACK.md` — package versions, provider choices, AEC stack assessment.
- `.planning/research/v3.0/FEATURES.md` — table stakes, differentiators, anti-features, UAT examples.
- `.planning/research/v3.0/ARCHITECTURE.md` — component boundaries, contracts, data flows, phase structure.
- `.planning/research/v3.0/PITFALLS.md` — critical/moderate/minor risks and phase warnings.
- Project source/design references cited by research files: current TTS manager/gateway, settings UI, StoredConfig, PROJECT/ROADMAP/STATE, PROJECT_DESIGN.

### External / Ecosystem Sources
- Open-LLM-VTuber README/config/provider shape — implementation reference for ASR/TTS/VAD modularity.
- GPT-SoVITS official repository/API — external API, dependency complexity, service-mode integration.
- FunASR, ModelScope, faster-whisper, silero-vad, OpenAI, Groq, soundfile, samplerate package/docs — provider versions, capabilities, and limits.
- MDN `getUserMedia` / `echoCancellation` — renderer capture and baseline browser AEC behavior.

---
*Research completed: 2026-05-09*  
*Ready for roadmap/requirements: yes*
