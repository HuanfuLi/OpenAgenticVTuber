# Feature Landscape: v3.0 Rich Voice Configuration + Voice Input

**Project:** AgenticLLMVTuber  
**Domain:** local-first Live2D desktop companion voice I/O  
**Researched:** 2026-05-09  
**Overall confidence:** MEDIUM-HIGH

> Scope note: `.planning/REQUIREMENTS.md` was requested but is not present in the workspace; current requirements were read from `.planning/PROJECT.md` Active requirements and `.planning/ROADMAP.md`. Open-LLM-VTuber (OLVT) was used as the product reference for module-shaped ASR/TTS/VAD configuration, provider breadth, GPT-SoVITS support, and no-headphones/interruption claims.

## User-Experience Thesis

v3.0 should make the app feel like a real voice companion rather than a text chat with sound effects. From the user's perspective there are two setup jobs:

1. **Voice out:** choose how the avatar sounds, test it quickly, and save named presets. Piper remains the dependable local fallback; GPT-SoVITS is the flagship path for character voices. Users who already run a GPT-SoVITS server should paste a URL and reference-audio metadata; advanced users may optionally let the app launch their server command. The app should not attempt model training, dependency installation, or full voice-cloning workflows.
2. **Voice in:** choose an STT provider, choose PTT or VAD mode, speak Chinese, English, or code-switched utterances, see partial/chunk preview while recording, and submit the final transcript exactly as recognized. The app must not translate or rewrite before sending to the existing conversation pipeline.

The milestone should copy OLVT's strength — configurable module choices with many providers — but translate it into this app's UI-first, local-first, single-user product. Users should not edit YAML for ordinary setup. Settings should expose safe common controls, health checks, and diagnostics; deeper provider-specific knobs can live in an advanced disclosure.

## Product Model

### Voice-out mental model

- **Provider:** Piper, GPT-SoVITS, and later-compatible provider slots.
- **Preset:** a saved named bundle of provider + voice/model + tuning + reference audio metadata. Presets should be attachable to the current avatar and selectable globally.
- **Test phrase:** one-click synthesis that exercises the exact playback path: provider synthesis → sentence-buffered ordered delivery → sidecar audio output → RMS envelope → VTS lipsync.
- **Health:** visible provider state: ready, external server unavailable, launched process starting, missing reference audio, synthesis failed, or fallback active.

### Voice-in mental model

- **Provider:** FunASR default, faster-whisper local fallback, OpenAI cloud, Groq cloud.
- **Mode:** Push-to-talk for deterministic control; VAD for hands-free conversation.
- **Preview:** chunk/partial transcript appears while recording, clearly marked as preview/unstable.
- **Submit:** final transcript is sent unchanged to the same turn pipeline as typed input and saved in conversation history as a user message.
- **Privacy posture:** local providers are default; cloud providers are opt-in and visibly labeled as sending microphone audio to a third party.

### AEC/no-headphones mental model

- The user sees a **Speaker echo filter** setting with states, not a magical guarantee.
- During TTS playback, the app should protect voice input from hearing itself by default: pause/duck recognition, suppress app-output-correlated mic frames, or mark VAD as blocked depending on the AEC implementation chosen.
- User-facing copy should say: **"Reduces the avatar hearing its own voice; quality depends on your speakers, mic, room, and OS audio path."** Do not claim fully solved no-headphones use until validated.

## Table Stakes

Features users will expect for the milestone to feel complete. Missing items here should block v3.0 shipment or be explicitly cut from scope.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| TTS provider abstraction with Piper preserved | Existing Piper behavior is the regression baseline; provider switching must not break ordered playback or lipsync | High | `TTSTaskManager`, audio payload contracts, sidecar playback stream, RMS/lipsync queues | Provider output must normalize to PCM/audio payload + `volumes` envelope + sample rate. Silent/whitespace payload behavior must remain. |
| GPT-SoVITS external-server provider | User confirmed GPT-SoVITS is important; OLVT already treats `gpt_sovits_tts` as a first-class TTS option | High | TTS provider abstraction, settings persistence, health endpoint | Required controls: API URL, text language, prompt/reference language, reference audio path, prompt text, split method, batch/streaming/media options where supported. |
| Optional GPT-SoVITS app-managed launch command | Advanced users want one-click start after initial setup; project scope allows launch command mode | Medium-High | Electron/main or sidecar process lifecycle, diagnostics logs, health polling | App manages command execution, not installation. Store command, working directory, env overrides if needed; show stdout/stderr in diagnostics. |
| Rich TTS settings UI | Current Settings only mirrors Piper; v3.0 goal is provider switching and tuning | High | Settings IA, `COPY`, preload IPC, stored config schema, sidecar health/test APIs | Include Provider, Preset, Health, Test synthesis, Output device summary, Lipsync status, Advanced controls. |
| Named voice presets | Users need to switch between character voices and recover working configs | Medium | persisted config, avatar catalog voice field, current avatar settings | Preset should include provider-specific config and display label. Avatar import already has a voice summary field; v3.0 can make it real. |
| TTS health and test synthesis | Voice setup is impossible without immediate feedback | Medium | provider health endpoint, test synth endpoint, Settings UI | Test must use the production path, not a fake preview. Show latency and provider error details. |
| STT provider abstraction | Multiple STT providers are user-confirmed scope | High | sidecar audio capture, contract definitions, Settings Voice In UI | One interface should expose capabilities: streaming preview support, language options, local/cloud, credentials required, GPU/device settings. |
| FunASR default provider | Chinese/English users and code-switching target make FunASR/SenseVoice-style defaults appropriate | Medium-High | Python deps/model download strategy, ASR provider interface | Use as default if packaging/model initialization is acceptable. Surface model download/cache status and CPU/GPU device. |
| faster-whisper fallback provider | Local fallback and ecosystem baseline | Medium | faster-whisper install/model cache, ASR interface | Controls: model size/path, language auto/en/zh, device, compute type, prompt/hotwords if implemented. |
| OpenAI and Groq cloud STT providers | User-confirmed provider set; cloud option helps low-end machines | Medium | secure credential storage, provider API clients, network diagnostics | Must be opt-in. Label cost/privacy. Credentials saved like LLM provider secrets. |
| PTT mode | Lowest-risk voice UX; avoids VAD false positives and AEC ambiguity | Medium | renderer mic permission/capture, hotkey settings, turn pipeline | Include hold-to-talk and click-to-record if global hotkey is not ready. Recording state must be obvious. |
| VAD mode | Hands-free voice conversation is expected from OLVT-like products | High | audio capture, VAD, STT chunking, AEC policy, interruption policy | Settings: sensitivity, silence timeout, min speech duration, max utterance length, auto-submit toggle. |
| Chunk preview while recording | User-confirmed; builds trust in STT and supports correction before send | High | streaming or chunked ASR, renderer chat/input state | Preview is not conversation history until final submit. Mark partials as unstable. |
| Final transcript sent unchanged | User explicitly requested no translation; avoids corrupting code-switching | Low-Medium | conversation input adapter, history persistence | Do not normalize Chinese/English mix beyond provider punctuation/ITN settings chosen by user. |
| Chinese/English/code-switching quality target | Core audience includes Chinese and English speakers | High | provider selection, language config, test fixtures, acceptance tests | Acceptance must include mixed utterances with names, app terms, English acronyms, Chinese punctuation, and numbers. |
| AEC prototype/decision phase | Project says no-headphones quality is a milestone risk, not assumed solved | High | sidecar audio routing, playback envelope, mic capture, VAD gating | Must produce a supported behavior decision and user-facing limitation if not fully solved. |
| Existing turn pipeline integration | Voice input must feel like normal chat | Medium | conversation history, LLM pipeline, TTS queue, status/errors | Voice final transcript should create a user message, trigger LLM, TTS, VTS action parsing, and history exactly like typed input. |
| Clear failure/fallback semantics | Audio systems fail often: mic permission, model missing, server down, cloud quota | Medium | status store, Settings, logs drawer | Show actionable errors and keep text chat usable. Piper fallback for TTS; typed input fallback for STT. |

## Differentiators

Features that make v3.0 feel better than a basic STT/TTS settings pass. These are worth planning if table stakes are secure.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Avatar-bound voice presets | Switching avatars can later switch relationship identity and voice together | Medium | avatar catalog voice field, preset store, current avatar state | Aligns with core value of distinct avatar identities, without implementing memory yet. |
| End-to-end voice setup wizard | Reduces first-run friction for nontechnical users | Medium | Settings, provider health/test endpoints | Flow: choose local/cloud → test mic → test TTS → choose PTT/VAD → save. Useful but can be a phase after raw Settings controls. |
| Bilingual calibration/test suite in UI | Makes quality target visible and testable | Medium | STT test endpoint, sample prompt list | Include preset phrases: Mandarin, English, code-switching, numbers, app names, game/product names. |
| Provider capability badges | Helps users pick without reading docs | Low-Medium | provider metadata | Badges: Local, Cloud, Best for Chinese, Best for English, Code-switching, Low-latency, Requires GPU/API key. |
| Live AEC/VAD state indicator | Builds trust in hands-free mode | Medium | capture pipeline state, TTS playback state | Show `Listening`, `Avatar speaking — mic gated`, `Echo filter active`, `Silence detected`, `Submitting...`. |
| Interrupt policy controls | OLVT advertises voice interruption; users expect conversational barge-in | High | TTS cancellation, LLM cancellation, VAD/AEC | Candidate controls: Off, PTT interrupt only, VAD interrupt when confidence high. Defer if it threatens AEC/turn stability. |
| Hotword-free wake affordance | Avoids out-of-scope wake word while making VAD usable | Low-Medium | VAD mode | Example: manual "Start listening" session toggle with visible armed state. |
| Reference-audio library for GPT-SoVITS | Makes GPT-SoVITS practical for multiple voices | Medium | file picker, metadata persistence, validation | Store path + prompt text + language + duration warning. Do not copy copyrighted audio unless user explicitly chooses import/copy. |
| Latency/quality diagnostics | Advanced users can tune provider choice | Medium | logging, metrics | Show synth latency, ASR latency, real-time factor if available, model/device. |

## Anti-Features

Features to explicitly not build in v3.0, even if adjacent to voice.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| GPT-SoVITS model training or voice-cloning UI | Heavy workflow, legal/consent risk, GPU/storage complexity; project scope explicitly says users supply their own model | Configure an existing GPT-SoVITS server, reference audio, prompt text, and optional launch command. |
| Dependency installer for GPT-SoVITS/FunASR stacks | Cross-platform dependency management would dominate milestone and create support burden | Provide setup docs, health checks, model/cache status, and app-managed launch command only after user installs. |
| Translation before LLM submission | User asked final transcript be sent as heard; translation damages code-switching and identity/context | Preserve provider transcript exactly except explicit provider ITN/punctuation settings. Translation can be future TTS-output feature, not STT input. |
| Claiming solved no-headphones/AEC | Echo cancellation is uncertain and environment-dependent; overclaiming creates broken trust | Ship conservative echo filter states and document limitations. Prefer gating during TTS over false "perfect AEC" copy. |
| Wake word activation | Already out of scope; increases privacy/perf risk | Use PTT and explicit VAD armed toggle. |
| Multi-user profiles or shared cloud account management | Project is single-user/local-first | Store one user's local voice settings and per-avatar presets. |
| Full audio editor for reference clips | Too broad for milestone | Let users select a file, validate existence/format/duration, and preview/test. |
| Replacing VTS lipsync with a learned driver | Current rule-based RMS lipsync is baseline; learned audio-to-params is deferred | Preserve RMS envelope generation for every TTS provider. |
| Provider marketplace | v1 out-of-scope extension marketplace | Hard-code supported providers behind provider interfaces. |
| Always-on background mic capture without visible state | Privacy and trust risk | Require visible recording/listening indicator and easy stop control. |
| Cloud STT as default | Violates local-first posture and surprises privacy-sensitive users | FunASR local default; faster-whisper fallback; cloud providers opt-in. |

## Deferred / Future Items

Good ideas that should not block v3.0 unless explicitly promoted.

| Future Item | Defer Reason | Recommended Milestone |
|-------------|--------------|-----------------------|
| True barge-in that cancels current LLM/TTS and injects interrupt context | Requires robust cancellation semantics across LLM streaming, ordered TTS queue, sidecar playback, and VAD/AEC | v3.x hardening or v4.0 if tied to agent turn control |
| Voice memory commands like "remember that" | Memory subsystem is v4.0 scope | v4.0 |
| Per-avatar multilingual persona/voice routing | Depends on avatar identity and memory | v4.0+ |
| Online TTS providers beyond GPT-SoVITS/Piper | Scope control; OLVT supports many, but this app should not clone every module now | Later provider expansion |
| TTS translation (e.g. chat in Chinese, speak Japanese) | OLVT supports this as a feature, but v3.0 user explicitly wants STT final transcript unchanged | Future voice customization |
| Audio device picker with per-device loopback routing | Useful for AEC, but can explode OS-specific scope | Promote only if AEC decision requires it |
| Noise suppression/RNNoise/WebRTC NS UI | Valuable but separate from ASR/VAD baseline | v3.x if AEC/noise issues dominate UAT |
| Export/import preset packs | Nice for sharing voices; marketplace is out of scope | Later polish |

## Feature Dependencies

```text
TTS provider abstraction
  → GPT-SoVITS provider
  → TTS health/test endpoints
  → Rich TTS settings UI
  → Named voice presets
  → Avatar-bound voice presets

TTS provider abstraction
  → normalized PCM/envelope output
  → existing RMS lipsync + VTS compositor remains stable

STT provider abstraction
  → FunASR / faster-whisper / OpenAI / Groq providers
  → STT health/test endpoints
  → Voice In settings UI
  → PTT recording
  → VAD recording
  → chunk preview
  → final transcript submission into existing conversation pipeline

Audio capture + playback-state telemetry
  → VAD state machine
  → AEC prototype/decision
  → no-headphones user-facing behavior

Settings stored config schema
  → TTS provider settings
  → STT provider settings
  → credentials handling for cloud STT
  → named presets
```

## Recommended v3.0 Phase Shape

1. **Audio backend contracts** — define TTS/STT provider interfaces, config schemas, health/test semantics, error/fallback states.  
   Addresses: provider abstraction, settings persistence, failure semantics.  
   Avoids: provider-specific hacks inside `TTSTaskManager` or renderer.

2. **TTS providers + GPT-SoVITS** — preserve Piper baseline, add GPT-SoVITS external server, optional launch command, normalized PCM/RMS output.  
   Addresses: rich voice output and flagship provider.  
   Avoids: breaking lipsync/ordered playback.

3. **Rich TTS settings + presets** — provider switcher, health/test synthesis, GPT-SoVITS reference-audio fields, named presets, avatar voice summary.  
   Addresses: user configurability.  
   Avoids: YAML-only configuration.

4. **STT provider service** — FunASR default, faster-whisper fallback, OpenAI/Groq cloud providers, health/test transcription.  
   Addresses: bilingual/code-switching provider set.  
   Avoids: hard-coding one recognizer.

5. **Voice input UX: PTT, VAD, preview, submit** — microphone capture, recording state, chunk preview, final transcript into conversation pipeline unchanged.  
   Addresses: actual voice conversation.  
   Avoids: STT as a disconnected test tool.

6. **AEC/no-headphones decision + hardening** — prototype echo filter/gating path, document supported behavior, expose state in UI, run acceptance tests while TTS is playing.  
   Addresses: milestone risk explicitly.  
   Avoids: unverified OLVT-style no-headphones claims.

## Bilingual / Code-Switching Quality Expectations

The app should treat Chinese/English code-switching as a first-class acceptance target, not a demo bonus.

### Expected user behavior

- Users may speak Mandarin sentences with English product names: `帮我打开 VS Code 然后 check the latest logs`.
- Users may speak English with Chinese names or terms: `Can you remember that 我明天要交作业?`.
- Users may include acronyms, model names, file names, game names, and numbers: `用 GPT-SoVITS 试一下 3.5 秒的 reference audio`.
- Users expect the LLM to receive exactly the mixed-language transcript, not a translated monolingual rewrite.

### Acceptance quality bar

- **Provider-level:** FunASR default should be validated against Mandarin, English, and mixed utterances before finalizing default status. faster-whisper should be accepted as a general local fallback even if Chinese punctuation/code-switching is weaker. Cloud providers should be judged by opt-in quality/latency/cost tradeoff.
- **UI-level:** Language setting should default to `auto` for code-switching. Do not force the user to choose `zh` or `en` per utterance.
- **Transcript-level:** Preserve code-switched words and punctuation as recognized. If ITN/punctuation options are exposed, they must be user-configurable provider knobs.
- **Test-level:** Include a small bilingual fixture set in UAT and provider tests. Pass criteria should focus on semantic correctness and preservation of mixed-language tokens, not exact punctuation only.

## AEC User-Facing Behavior

### Required states

| State | User Copy / Behavior | Acceptance Example |
|-------|----------------------|--------------------|
| Off | `Echo filter off` | With speakers on, VAD may capture avatar speech; UI warns if VAD is enabled. |
| Gated during avatar speech | `Avatar is speaking — mic paused` | While TTS writes audio, VAD does not auto-submit the avatar's own sentence. |
| Echo filter active | `Echo filter active` | During playback, correlated app-output audio is suppressed or ignored enough to avoid self-trigger in normal speaker volume tests. |
| Degraded/unknown | `Echo filter unavailable; use headphones or PTT` | If loopback/capture path fails, app falls back to safe PTT/gating guidance. |

### Recommendation

Ship **PTT as the reliable baseline** and **VAD with conservative gating**. If real AEC is not robust by the decision phase, label VAD no-headphones as experimental/degraded rather than blocking all voice input. The unacceptable outcome is silent self-conversation loops where the avatar hears and responds to its own TTS.

## Acceptance Examples

These are written as user-facing UAT examples for downstream planning.

### TTS / GPT-SoVITS

1. **Provider switch preserves baseline playback**  
   Given Piper is selected and the avatar replies with three sentences, audio plays in sentence order, chat text streams normally, and VTS mouth movement follows RMS. When switching to GPT-SoVITS and repeating the test phrase, the same ordering/lipsync path is used.

2. **External GPT-SoVITS setup succeeds**  
   Given a GPT-SoVITS server is running at `http://127.0.0.1:9880/tts`, when the user enters API URL, `text_lang`, `prompt_lang`, reference audio path, and prompt text, then `Test voice` synthesizes audio, reports latency, and saves a named preset.

3. **GPT-SoVITS unavailable is actionable**  
   Given the saved GPT-SoVITS server is not reachable, Settings shows `server unavailable`, the test button returns a clear error, and conversation can either fall back to Piper or become text-only according to the selected fallback policy.

4. **App-managed launch does not install dependencies**  
   Given the user provides a launch command and working directory, clicking `Start server` runs that command and streams logs. If the command fails, the UI explains that GPT-SoVITS must be installed separately.

5. **Preset attaches to avatar**  
   Given a named preset `Teto SoVITS CN` is saved and selected for the current avatar, the Avatars settings voice row displays the provider/preset summary instead of `No voice configured`.

### STT / Voice Input

1. **PTT records and submits unchanged**  
   Given FunASR is selected and PTT mode is enabled, when the user holds the PTT key and says `帮我 check 一下 status`, then preview text appears during recording and final transcript is submitted exactly as recognized to the chat pipeline when released.

2. **VAD auto-submits after silence**  
   Given VAD mode is armed, when the user speaks a short utterance and stops, the UI transitions `Listening → Speech detected → Finalizing → Sent`, then the LLM responds and TTS plays.

3. **Cloud STT is opt-in**  
   Given OpenAI or Groq STT is selected, the UI requires an API key, labels that microphone audio is sent to the provider, and does not use cloud STT until the user saves and tests the provider.

4. **Code-switching fixture passes**  
   Given FunASR default, the following utterances should retain core mixed-language content in final transcript: `今天用 GPT-SoVITS 试一下`, `Open the settings 然后换成 faster-whisper`, `帮我看一下 VTube Studio connection`.

5. **Preview is not history**  
   Given recording preview changes from partial A to partial B, conversation history remains unchanged until a final transcript is submitted.

### AEC / No-Headphones

1. **Avatar does not self-trigger in safe mode**  
   Given VAD is armed and the avatar is speaking through speakers at normal volume, voice input shows `mic paused` or `echo filter active` and does not submit the avatar's TTS as a user message.

2. **User can override with PTT**  
   Given VAD/AEC is degraded, the app recommends headphones or PTT, and PTT remains usable while TTS is not playing.

3. **Failure is visible**  
   Given AEC initialization fails, the status/Settings UI shows a degraded state and the logs include a diagnostic reason.

## Settings IA Recommendations

Current Settings already has `TTS / Voice out` and placeholder `Voice in`. v3.0 should replace those with functional sections.

### TTS / Voice out section

- Provider: Piper / GPT-SoVITS.
- Preset: select, save as, duplicate, delete.
- Health row: ready/unavailable/fallback active.
- Test voice: phrase input + synthesize button + latency/error.
- Output: keep current output-device summary unless device picker is promoted.
- Lipsync: explicit `RMS envelope → VTube Studio ParamMouthOpenY` status.
- GPT-SoVITS advanced fields: API URL, launch command, working directory, text language, prompt language, reference audio path, prompt text, split method, batch size, media/streaming options.

### Voice in section

- Mode: PTT / VAD.
- Provider: FunASR / faster-whisper / OpenAI / Groq.
- Language: Auto (recommended), Chinese, English where provider supports it.
- Provider health/test: record sample or upload short test clip if available.
- PTT binding/click-to-record fallback.
- VAD sensitivity, silence timeout, min speech duration, max utterance duration.
- Preview policy: show preview while recording; submit final unchanged.
- Echo filter: Off / Conservative gating / Active filter if available; state and warning copy.

## Dependencies on Existing Systems

| Existing System | Required Use / Constraint |
|-----------------|---------------------------|
| `TTSTaskManager` | Preserve ordered async synthesis, payload queue sequencing, sidecar-owned playback, compositor speech queues, and sentence-complete queue. Provider abstraction should sit behind `_synthesize_payload`, not bypass the manager. |
| RMS/lipsync contracts | Every TTS provider must return or generate PCM suitable for RMS envelope extraction. GPT-SoVITS cannot be "audio-only" without volumes. |
| VTS compositor | Voice output should continue to drive mouth movement and action dispatch timing. AEC may need playback state from the same speech envelope timing. |
| Conversation pipeline | Final STT transcript enters the same user-message path as typed input; no separate voice-only conversation semantics. |
| Conversation history | Only final submitted transcript is stored; chunk preview is transient UI state. |
| Settings/copy architecture | All user-facing strings must go through `COPY`; Settings sections should be real data/actions, not placeholders. |
| Stored config / secret handling | Cloud STT keys must use existing safe storage patterns; provider config schema needs versioning/migration. |
| Avatar infrastructure | Named voice presets should integrate with existing avatar voice summary and future per-avatar identity. |
| Status/logs | Provider health, launch-command logs, AEC state, and STT/TTS errors should be visible in status or diagnostics. |

## MVP Recommendation

Prioritize:

1. **Provider contracts + Piper regression safety** — no rich voice work matters if ordered playback/lipsync regresses.
2. **GPT-SoVITS external-server + Settings/test/preset flow** — flagship user value.
3. **STT provider service with FunASR + faster-whisper** — local bilingual voice input baseline.
4. **PTT with chunk preview/final submit** — reliable voice conversation baseline.
5. **VAD with conservative AEC gating** — hands-free path, but do not overclaim.

Defer or make optional:

- App-managed GPT-SoVITS launch command if external-server mode and settings are not stable yet.
- Full interrupt/barge-in if TTS cancellation and AEC are not robust.
- Advanced audio device routing unless required for AEC decision.

## Sources

- HIGH — Local project context: `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `apps/renderer/src/screens/Settings/Settings.tsx`, `apps/renderer/src/lib/copy.ts`, `sidecar/src/sidecar/tts/tts_manager.py`.
- HIGH — Open-LLM-VTuber README: voice conversations, offline mode, provider breadth, GPTSoVITS, FunASR/Faster-Whisper/Groq, VAD/no-headphones claims, module configuration philosophy: https://github.com/Open-LLM-VTuber/Open-LLM-VTuber
- HIGH — Open-LLM-VTuber config template: concrete ASR/TTS/VAD provider options and GPT-SoVITS config fields: https://raw.githubusercontent.com/Open-LLM-VTuber/Open-LLM-VTuber/main/config_templates/conf.default.yaml
- MEDIUM — OLVT docs URLs under `/docs/user-guide/...` returned 404 during this research; conclusions rely on README and config template rather than unavailable docs pages.
