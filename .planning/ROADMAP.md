# Roadmap: AgenticLLMVTuber

## Milestones

- ✅ **v1.0 Walking Skeleton** — Phases 1-5 shipped 2026-05-08. Archive: `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v2.0 Plugin + Animation Control** — Phases 8, 6, 7, 9, 10 shipped 2026-05-09. Archive: `.planning/milestones/v2.0-ROADMAP.md`
- ✅ **v2.1 Mock/Reality Cleanup** — Phases 11-15 shipped 2026-05-09. Archive: `.planning/milestones/v2.1-ROADMAP.md`
- 📋 **v3.0 Rich Voice Configuration + Voice Input** — Phases 16-22 planned.

## Shipped Phases

<details>
<summary>✅ v1.0 Walking Skeleton (Phases 1-5) — SHIPPED 2026-05-08</summary>

- [x] Phase 1: Plumbing & Process Lifecycle — 2/2 plans complete
- [x] Phase 2: Conversation Pipeline — 3/3 plans complete
- [x] Phase 3: TTS & Sentence-Buffered Audio — 3/3 plans complete
- [x] Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation — 8/8 plans complete
- [x] Phase 5: Polish, Contracts Codegen, §14 Verification — 1/1 plan complete; §14 ceremony migrated to v2.0 Phase 10

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Plugin + Animation Control (Phases 8, 6, 7, 9, 10) — SHIPPED 2026-05-09</summary>

- [x] Phase 8: Avatar Import + Catalogs — 5/5 plans complete
- [x] Phase 6: Plugin Runtime + Default Plugin — 8/8 plans complete
- [x] Phase 7: Three-Category Code Parsing + Dispatch — 8/8 plans complete
- [x] Phase 9: Slider HUD + Per-Param Lock — 2/2 plans complete
- [x] Phase 10: Cursor Polish + §14 SC Re-Verification — 4/4 plans complete

Full details: `.planning/milestones/v2.0-ROADMAP.md`
Phase execution archive: `.planning/milestones/v2.0-phases/`
Audit: `.planning/milestones/v2.0-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v2.1 Mock/Reality Cleanup (Phases 11-15) — SHIPPED 2026-05-09</summary>

- [x] Phase 11: Status & App State Reality — 2/2 plans complete
- [x] Phase 12: Settings Reality Pass — 4/4 plans complete
- [x] Phase 13: Conversation History Sessions — 4/4 plans complete
- [x] Phase 14: Plugin Developer Docs + Plugin Swap Hardening — 4/4 plans complete
- [x] Phase 15: Mock Boundary Audit — 1/1 plan complete

Full details: `.planning/milestones/v2.1-ROADMAP.md`
Requirements archive: `.planning/milestones/v2.1-REQUIREMENTS.md`
Phase execution archive: `.planning/milestones/v2.1-phases/`
Audit: `.planning/milestones/v2.1-MILESTONE-AUDIT.md`

</details>

## Overview

v3.0 refactors audio I/O into sidecar-owned provider systems so the existing Piper ordered playback, renderer audio payloads, RMS/lipsync, VTS compositor, and conversation-history semantics remain intact while users gain GPT-SoVITS voice output and Chinese/English voice input. The roadmap follows the research-recommended order: lock contracts and Piper regression safety first, add GPT-SoVITS and presets, expose rich settings, add STT providers, wire renderer voice capture, then empirically harden code-switch quality and no-headphones/AEC behavior.

## Phases

**Phase Numbering:** v3.0 continues after shipped v2.1 Phases 11-15. Planned work starts at Phase 16.

- [x] **Phase 16: Audio Contracts + TTS Provider Shell** - Sidecar-owned audio contracts, versioned config migration, Piper adapter, and provider failure semantics. Complete after focused live audio retest passed on 2026-05-09.
- [x] **Phase 17: GPT-SoVITS Provider + Voice Presets** - GPT-SoVITS external/app-launched provider, test synthesis, reference audio, named presets, visible failed-audio chat/UAT evidence, and GPT-SoVITS gap closures through plan 17-12.
- [x] **Phase 18: Rich Voice Settings + Persistence** - User-facing audio settings, provider catalog labels, privacy copy, credential redaction, and diagnostics.
- [ ] **Phase 19: STT Provider Abstraction + Local/Cloud Providers** - FunASR, faster-whisper, OpenAI, and Groq through one lazy-loaded STT provider layer.
- [ ] **Phase 20: Renderer Voice Capture + PTT/VAD Preview UX** - Microphone capture, push-to-talk, VAD controls, transcript preview, and final-text submission through the existing chat path.
- [ ] **Phase 21: Code-Switch Evaluation + Hardening** - Locked bilingual eval corpus, provider scorecard, no-translation checks, and evidence-backed provider copy.
- [ ] **Phase 22: AEC Spike + No-Headphones Decision** - Browser/WebRTC AEC prototype, self-speech suppression, conservative VAD defaults, and truthful no-headphones status.

## Phase Details

### Phase 16: Audio Contracts + TTS Provider Shell
**Goal**: The app has a stable audio-provider foundation that preserves existing Piper playback and lipsync while making TTS/STT configuration safe to evolve.
**Depends on**: Phase 15
**Requirements**: AUDIO-02, AUDIO-03, AUDIO-04, TTS-05, PERF-03
**Success Criteria** (what must be TRUE):
  1. Existing Piper chat responses still play in sentence order and drive renderer audio payloads plus VTS lipsync/RMS exactly through the current playback path.
  2. Audio settings persist through a versioned config migration without breaking existing LLM, VTS, conversation history, or avatar catalog settings.
  3. Provider health checks return clear unavailable, missing credential, external-service failure, and timeout states instead of empty turns or silent fallback.
  4. Slow or failed provider work cannot block the chat WebSocket, compositor, HUD traffic, or ordered TTS queue.
**Plans**:
- **Wave 1**:
  - `16-01`: Audio Contracts and Config Migration - shared provider/config/health contracts, schemaVersion 2 migration, and sidecar audio-config env handoff.
- **Wave 2** *(blocked on Wave 1 completion)*:
  - `16-02`: TTS Provider Shell and Piper Adapter - provider-neutral synthesis surface while preserving ordered Piper playback/RMS payload behavior.
- **Wave 3** *(blocked on Wave 2 completion)*:
  - `16-03`: Provider Health, Failure Semantics, and Non-Blocking Regression - typed health endpoint, queue-safe failure behavior, compact diagnostics, and final evidence.
- **Wave 4** *(gap closure after UAT)*:
  - `16-04`: Restore Audible Voice Playback - renderer playback for non-empty sidecar WAV payloads while preserving chat streaming and VTS lipsync state.
**Cross-cutting constraints:**
- Existing Piper ordered playback, renderer `AudioPayloadMessage`, and `SpeechEnvelopePayload`/RMS lipsync path must remain the regression baseline.
- Config migration must preserve existing LLM, plugin, VTS, conversation history, and avatar catalog behavior.
- Provider failure states must be explicit and typed; no silent mid-turn provider fallback.
- Provider synthesis and stream writes must not block chat WebSocket, compositor, HUD, or ordered queue traffic.

### Phase 17: GPT-SoVITS Provider + Voice Presets
**Goal**: Users can choose GPT-SoVITS for character voice output, validate it before use, and organize voice presets without losing Piper fallback safety.
**Depends on**: Phase 16
**Requirements**: TTS-01, TTS-02, TTS-03, TTS-04, TTS-06, PRESET-01, PRESET-02, PRESET-03, PRESET-04
**Success Criteria** (what must be TRUE):
  1. User can select Piper or GPT-SoVITS as the active TTS provider and run test synthesis without sending a chat turn.
  2. User can configure GPT-SoVITS external-server settings or an optional app-managed launch command with health, stop, and restart controls.
  3. User can create, rename, select, and delete named voice presets with backend-specific tuning controls.
  4. User can import GPT-SoVITS reference audio into sanitized app-managed storage and see validation failures before using it.
  5. When GPT-SoVITS fails, the user sees a visible failure/fallback state and the app never silently changes provider mid-turn.
**Plans**: 12 plans
**Plan list**:
- [x] 17-01-PLAN.md — Contracts and blocking Phase 16 UAT gate
- [x] 17-02-PLAN.md — Preset persistence and reference-audio validation IPC
- [x] 17-03-PLAN.md — GPT-SoVITS sidecar provider, health/test synthesis, and failure wiring
- [x] 17-04-PLAN.md — Electron GPT-SoVITS health/test IPC bridge
- [x] 17-05-PLAN.md — App-managed GPT-SoVITS launch lifecycle
- [x] 17-06-PLAN.md — Settings provider, preset, reference-audio, and audible test UI
- [x] 17-07-PLAN.md — Chat failure surface, final regression, and UAT
- [x] 17-08-PLAN.md — Per-preset GPT-SoVITS validation evidence and activation gap closure
- [x] 17-09-PLAN.md — Duplicate GPT-SoVITS chat text gap closure
- [x] 17-10-PLAN.md — GPT-SoVITS sample-rate/lipsync gap closure
- [x] 17-11-PLAN.md — GPT-SoVITS weight and text-language selection gap closure
- [x] 17-12-PLAN.md — GPT-SoVITS lipsync velocity and sentence-latency gap closure
**UI hint**: yes

### Phase 18: Rich Voice Settings + Persistence
**Goal**: Users can manage voice output/input configuration from truthful settings screens with clear capability labels, privacy boundaries, and diagnostics.
**Depends on**: Phase 17
**Requirements**: AUDIO-01, PRIV-01, PRIV-02, PERF-02
**Success Criteria** (what must be TRUE):
  1. User can see available TTS and STT providers with capability labels such as Local, Cloud, Chinese/English, Requires API key, and Requires external service.
  2. Cloud STT providers remain disabled by default and require separate explicit credentials and consent before any audio can be sent.
  3. Settings, logs, and diagnostics redact STT credentials, reference-audio paths, transcripts, and provider errors where appropriate.
  4. User can inspect TTS/STT latency, timeout, and provider-failure diagnostics without exposing secrets.
**Plans**: 3
  - [x] 18-01 Audio Settings Persistence, Consent, And Redaction
  - [x] 18-02 Voice Output And Voice Input Settings UI
  - [x] 18-03 Audio Diagnostics, Provider Tests, And Redaction Regression
**Wave dependencies**:
  - Wave 1: 18-01 can execute after Phase 17 is complete.
  - Wave 2: 18-02 depends on 18-01 typed settings/status APIs.
  - Wave 3: 18-03 depends on 18-01 persistence/redaction and 18-02 UI surfaces.
**UI hint**: yes

### Phase 19: STT Provider Abstraction + Local/Cloud Providers
**Goal**: Voice transcription providers are available behind one lazy-loaded interface, with local-first defaults and explicit model/cache controls.
**Depends on**: Phase 18
**Requirements**: STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, PERF-01
**Success Criteria** (what must be TRUE):
  1. User can enable STT with FunASR as the default local provider or faster-whisper as a local fallback.
  2. User can configure OpenAI or Groq transcription only as explicit opt-in cloud providers.
  3. User can run a test transcription for the selected STT provider before enabling voice input.
  4. User can see and control local model cache/download behavior before large STT models are loaded or fetched.
  5. Heavy local STT models lazy-load after boot rather than blocking app startup.
**Plans**: 4
**Wave 1**:
  - `19-01`: STT Contracts, Registry, Cache, And Readiness Foundation - provider-neutral contracts, lazy registry, model-cache metadata, readiness gate, and admin endpoint skeletons.
**Wave 2** *(blocked on Wave 1 completion)*:
  - `19-02`: Local STT Providers And Model Cache Controls - FunASR/SenseVoiceSmall, faster-whisper, explicit model download/remove/status, and local test transcription.
  - `19-03`: Cloud STT Providers, Consent, And Redacted Diagnostics - OpenAI/Groq adapters, separate STT credentials, persistent consent, and redacted cloud diagnostics.
**Wave 3** *(blocked on Wave 2 completion)*:
  - `19-04`: Settings STT Test Recorder, Cache UI, And Enablement Gate - Electron bridge, Voice Input settings, short manual recorder, readiness-gated enablement, and final regression.
**Cross-cutting constraints:**
- Heavy STT providers must lazy-load only after explicit user action; no boot-time heavy imports, model loads, downloads, or idle preload.
- Local STT models require explicit download into app-managed cache with visible path/status/size and remove controls.
- Provider enablement requires health plus successful non-empty Settings test transcription and is invalidated by provider/model/cache/credential/language/endpoint changes.
- Cloud STT requires separate provider consent and credentials, is never automatic fallback, and keeps only redacted metadata diagnostics.
- Phase 19 test recording is Settings-only; it must not implement chat voice submission, PTT/VAD preview, transcript history, or AEC behavior.
**UI hint**: yes

### Phase 20: Renderer Voice Capture + PTT/VAD Preview UX
**Goal**: Users can talk to the avatar through push-to-talk or VAD, see transient transcription preview, and submit final transcripts through the existing chat pipeline unchanged.
**Depends on**: Phase 19
**Requirements**: VIN-01, VIN-02, VIN-03, VIN-04, VIN-05, VIN-06
**Success Criteria** (what must be TRUE):
  1. User can grant microphone permission and always see whether the app is idle, listening, recording, finalizing, or in error.
  2. User can hold push-to-talk, speak an utterance, see transcription chunks as preview, and submit only the final transcript.
  3. User can enable VAD auto-submit with visible sensitivity and silence-timeout controls.
  4. Preview text never appears in conversation history; only final STT text enters the existing chat pipeline unchanged with no translation.
  5. Speech captured while a turn is in progress queues safely instead of corrupting active TTS/playback state.
**Plans**: TBD
**UI hint**: yes

### Phase 21: Code-Switch Evaluation + Hardening
**Goal**: The Chinese/English voice-input claim is evidence-backed, repeatable, and reflected honestly in provider recommendations.
**Depends on**: Phase 20
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04
**Success Criteria** (what must be TRUE):
  1. User can speak Chinese, English, or mixed Chinese/English in one utterance without manually switching language mode.
  2. The milestone has a locked bilingual/code-switch evaluation corpus and provider scorecard.
  3. Default STT provider recommendation is backed by eval results for semantic correctness, key-token retention, and no-translation behavior.
  4. User-facing provider copy accurately describes strengths and limitations for Chinese, English, and code-switching.
**Plans**: TBD
**UI hint**: yes

### Phase 22: AEC Spike + No-Headphones Decision
**Goal**: The app makes an empirical, truthful decision about no-headphones use and prevents assistant speech from becoming user input.
**Depends on**: Phase 21
**Requirements**: AEC-01, AEC-02, AEC-03, AEC-04
**Success Criteria** (what must be TRUE):
  1. Browser/WebRTC echo cancellation with renderer mic capture has recorded real test results.
  2. During active TTS, assistant speech is not auto-submitted as user speech through VAD or cloud STT.
  3. User sees truthful no-headphones support status: supported, experimental, or use-headphones/PTT fallback.
  4. VAD defaults remain conservative until AEC/no-headphones behavior is verified.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases execute in numeric order: 16 → 17 → 18 → 19 → 20 → 21 → 22.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Plumbing & Process Lifecycle | v1.0 | 2/2 | Complete | 2026-05-08 |
| 2. Conversation Pipeline | v1.0 | 3/3 | Complete | 2026-05-08 |
| 3. TTS & Sentence-Buffered Audio | v1.0 | 3/3 | Complete | 2026-05-08 |
| 4. Action Compositor + VTS Bridge + Body-Sway Investigation | v1.0 | 8/8 | Complete | 2026-05-08 |
| 5. Polish, Contracts Codegen, §14 Verification | v1.0 | 1/1 | Complete | 2026-05-08 |
| 6. Plugin Runtime + Default Plugin | v2.0 | 8/8 | Complete | 2026-05-09 |
| 7. Three-Category Code Parsing + Dispatch | v2.0 | 8/8 | Complete | 2026-05-09 |
| 8. Avatar Import + Catalogs | v2.0 | 5/5 | Complete | 2026-05-09 |
| 9. Slider HUD + Per-Param Lock | v2.0 | 2/2 | Complete | 2026-05-09 |
| 10. Cursor Polish + §14 SC Re-Verification | v2.0 | 4/4 | Complete | 2026-05-09 |
| 11. Status & App State Reality | v2.1 | 2/2 | Complete | 2026-05-09 |
| 12. Settings Reality Pass | v2.1 | 4/4 | Complete | 2026-05-09 |
| 13. Conversation History Sessions | v2.1 | 4/4 | Complete | 2026-05-09 |
| 14. Plugin Developer Docs + Plugin Swap Hardening | v2.1 | 4/4 | Complete | 2026-05-09 |
| 15. Mock Boundary Audit | v2.1 | 1/1 | Complete | 2026-05-09 |
| 16. Audio Contracts + TTS Provider Shell | v3.0 | 4/4 | Complete | 2026-05-09 |
| 17. GPT-SoVITS Provider + Voice Presets | v3.0 | 12/12 | Complete | 2026-05-10 |
| 18. Rich Voice Settings + Persistence | v3.0 | 3/3 | Complete | 2026-05-10 |
| 19. STT Provider Abstraction + Local/Cloud Providers | v3.0 | 0/4 | Planned | - |
| 20. Renderer Voice Capture + PTT/VAD Preview UX | v3.0 | 0/TBD | Not started | - |
| 21. Code-Switch Evaluation + Hardening | v3.0 | 0/TBD | Not started | - |
| 22. AEC Spike + No-Headphones Decision | v3.0 | 0/TBD | Not started | - |

## Coverage

- v1.0 requirements archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.
- v2.0 requirements archived in `.planning/milestones/v2.0-REQUIREMENTS.md`.
- v2.1 requirements archived in `.planning/milestones/v2.1-REQUIREMENTS.md`.
- v3.0 active requirements mapped: 39/39.
- No orphaned v3.0 requirements.

## Accepted Deferred Items

- Phase 7 live `<event>` UAT is catalog-gated because active Teto currently has `events: []`; parser, routing, and completion tracking are covered by automated tests.
- Phase 10 no-VTS-rect cursor synthetic fallback still projects against the primary monitor only. The live DPI-aware VTS-window path is validated on a two-monitor Windows setup with VTS on the secondary display.
- Memory and per-avatar identity remain deferred to v4.0 with the agentic system.
- v3.0 excludes GPT-SoVITS installer/training/voice cloning, wake-word activation, translation before LLM submission, barge-in interruption, silent cloud STT fallback, and any promise that no-headphones/AEC is solved before Phase 22 evidence.

---
*Last updated: 2026-05-10 after Phase 18 rich voice settings execution*
