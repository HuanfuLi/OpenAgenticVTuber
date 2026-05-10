# Phase 17: GPT-SoVITS Provider + Voice Presets - Research

**Researched:** 2026-05-09  
**Domain:** External GPT-SoVITS TTS provider, voice preset persistence, reference-audio asset management  
**Confidence:** HIGH for integration shape and API v2 endpoint fields; MEDIUM for live server behavior because no local GPT-SoVITS server was running during research. [VERIFIED: local probe]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Connection Modes
- **D-01:** GPT-SoVITS external-server mode should ask the user for a service base URL, not multiple endpoint URLs. Research/planning should determine endpoint probing against the current GPT-SoVITS API layout.
- **D-02:** App-managed launch is user-command-only: the user supplies command and working directory. The app may start/stop/restart the command but must not install dependencies, mutate environments, or provide bundled command templates in this phase.
- **D-03:** GPT-SoVITS should not become selectable for chat output until both health check and user-triggered test synthesis pass.
- **D-04:** Stop/restart controls must affect only the process this app launched. External servers must never be killed by the app.

### Preset Model
- **D-05:** Voice presets should be a global reusable library, not stored only per avatar or per session.
- **D-06:** The active voice preset association should live in app audio settings keyed by current avatar/session as an override. Do not modify avatar import catalogs or `AvatarOverrides` import artifacts for preset selection.
- **D-07:** A preset owns provider-specific voice knobs, GPT-SoVITS reference text/language, and reference-audio selection. Connection credentials, base URL, and launch command remain provider-level settings rather than duplicated per preset.
- **D-08:** If an active preset is deleted, require reassignment before deletion completes. Do not silently fall back to Piper and do not leave broken active preset references.

### Failure UX
- **D-09:** If GPT-SoVITS fails during a chat turn, the sentence display should still surface, but the audio for that sentence should be visibly marked failed. The app must not silently switch to Piper mid-turn.
- **D-10:** Piper fallback may be used on the next turn only after a visible notice and explicit user action/selection. No silent fallback after a GPT-SoVITS failure.
- **D-11:** Failure detail should reuse the existing log panel for diagnostics. Main voice/settings/chat surfaces should show concise status and point users to logs rather than dumping raw provider output inline.
- **D-12:** Test synthesis failures must not activate the candidate provider/preset. Leave the previous active provider/preset intact.

### Reference Audio
- **D-13:** Imported GPT-SoVITS reference audio should be copied into sanitized app-managed storage. Do not reference original user file paths as the primary preset asset.
- **D-14:** Phase 17 validation should perform basic usable checks: file exists, allowed audio format, duration bounds, and readable metadata. Defer subjective quality scoring or strict noise/loudness gates unless research finds a cheap standard check.
- **D-15:** Reference audio metadata must include reference transcript text and language.
- **D-16:** Deleting reference audio that is used by one or more presets should be blocked until presets are reassigned or deleted. Do not cascade-delete presets and do not leave broken references.

### the agent's Discretion
No explicit “you decide” areas were delegated. Downstream agents may choose exact schema names, endpoint paths, UI layout, timeout values, and validation thresholds consistent with the decisions above and Phase 17 requirements.

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TTS-01 | User can select Piper or GPT-SoVITS as the active TTS provider. [VERIFIED: .planning/REQUIREMENTS.md] | Gate GPT-SoVITS activation on health + test synthesis; keep Piper as explicit selectable baseline, not silent fallback. [VERIFIED: 17-CONTEXT.md] |
| TTS-02 | User can configure GPT-SoVITS external-server settings and run a health check before using it. [VERIFIED: .planning/REQUIREMENTS.md] | Store base URL; probe `/docs`/OpenAPI or safe `/tts` validation request; use health states from Phase 16. [CITED: github.com/RVC-Boss/GPT-SoVITS/api_v2.py] |
| TTS-03 | User can configure optional app-managed GPT-SoVITS launch command, working directory, health URL, and stop/restart action. [VERIFIED: .planning/REQUIREMENTS.md] | Launch only user command in cwd; stop only app-owned process tree; do not call upstream `/control?command=exit` for external servers. [VERIFIED: 17-CONTEXT.md] |
| TTS-04 | User can run test synthesis for the active TTS provider and hear the result without sending a chat turn. [VERIFIED: .planning/REQUIREMENTS.md] | Test path must use production TTS manager/output path when possible and must not activate candidate provider/preset on failure. [VERIFIED: 17-CONTEXT.md] |
| TTS-06 | User sees visible fallback/error state when GPT-SoVITS fails; app never silently changes provider mid-turn. [VERIFIED: .planning/REQUIREMENTS.md] | Failed sentence should surface display text plus failed-audio state; Piper can be selected only next turn after visible notice/action. [VERIFIED: 17-CONTEXT.md] |
| PRESET-01 | User can create, rename, select, and delete named voice presets. [VERIFIED: .planning/REQUIREMENTS.md] | Global preset library with referential-integrity checks and active-preset reassignment before deletion. [VERIFIED: 17-CONTEXT.md] |
| PRESET-02 | User can configure backend-specific tuning controls, including GPT-SoVITS reference text/language and synthesis knobs. [VERIFIED: .planning/REQUIREMENTS.md] | Presets own text/prompt language, prompt text, reference audio id, and tuning knobs; provider base URL/launch fields stay provider-level. [VERIFIED: 17-CONTEXT.md] |
| PRESET-03 | User can import/manage GPT-SoVITS reference audio with validation and sanitized app-managed storage. [VERIFIED: .planning/REQUIREMENTS.md] | Copy into userData-managed storage; validate extension, readable metadata, duration bounds, and in-use delete constraints. [VERIFIED: 17-CONTEXT.md] |
| PRESET-04 | User can associate active avatar/session with a voice preset without modifying avatar import catalogs. [VERIFIED: .planning/REQUIREMENTS.md] | Store active preset association in app audio settings keyed by avatar/session, not `AvatarOverrides`. [VERIFIED: 17-CONTEXT.md] |
</phase_requirements>

## Project Constraints (from AGENTS.md)

No `AGENTS.md` exists in the repository root. [VERIFIED: glob AGENTS.md]

Project instructions from `CLAUDE.md` still apply: Electron + React + Vite + Python FastAPI sidecar is locked; VTube Studio is external; LiteLLM remains LLM gateway; localhost-only local-first protocol; single-user scope; and GSD workflow artifacts must stay in sync. [VERIFIED: CLAUDE.md]

## Summary

Phase 17 should implement GPT-SoVITS as a sidecar HTTP client to a user-supplied external server base URL, with optional app-managed launch only for a user-provided command and working directory. [VERIFIED: 17-CONTEXT.md] The official current `api_v2.py` exposes `/tts`, `/set_gpt_weights`, `/set_sovits_weights`, `/set_refer_audio`, and `/control`, with `POST /tts` returning an audio response on success and JSON error with HTTP 400 on validation/synthesis failure. [CITED: github.com/RVC-Boss/GPT-SoVITS/api_v2.py]

The planner should preserve the Phase 16 boundary: provider adapters synthesize audio artifacts only, while `TTSTaskManager` keeps sentence ordering, playback, renderer `AudioPayloadMessage`, RMS/lipsync, sentence completion, and failure ordering semantics. [VERIFIED: Phase 16 plans] GPT-SoVITS must therefore decode returned WAV bytes into provider-neutral PCM and feed the same manager path used by Piper. [VERIFIED: .planning/research/v3.0/ARCHITECTURE.md]

Voice presets should be planned as a global reusable library with reference-audio assets copied into sanitized app-managed storage, while active avatar/session selection lives in app audio settings rather than avatar import catalogs. [VERIFIED: 17-CONTEXT.md] Deletion requires referential-integrity guards for both active presets and in-use reference audio. [VERIFIED: 17-CONTEXT.md]

**Primary recommendation:** Build three vertical slices: (1) contracts/config/storage for GPT-SoVITS + presets + reference audio, (2) sidecar provider/health/test/managed-process lifecycle, and (3) settings/chat failure UI that gates activation and visibly handles mid-turn failures. [VERIFIED: synthesis of roadmap/context/Phase 16 plans]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| GPT-SoVITS HTTP synthesis | Python sidecar | External GPT-SoVITS server | Sidecar owns audio providers and playback pipeline; GPT-SoVITS is an external HTTP service. [VERIFIED: .planning/research/v3.0/ARCHITECTURE.md] |
| Provider base URL and health/test actions | Electron main + Python sidecar | Renderer | Electron persists settings and proxies admin actions; sidecar performs provider reachability/synthesis checks; renderer displays status. [VERIFIED: Phase 16 plans] |
| App-managed launch/stop/restart | Electron main or sidecar process manager | Renderer | The app may only manage the process it launched from the user command/cwd; UI must not kill external servers. [VERIFIED: 17-CONTEXT.md] |
| TTS playback, RMS, lipsync, ordering | Python sidecar | Renderer for audio payload display | `TTSTaskManager` owns sequence order, audio payload emission, stream write, and speech envelope publication. [VERIFIED: Phase 16 research] |
| Global voice preset library | Electron main persisted config | Renderer + sidecar | Presets are user app settings; sidecar consumes selected preset for synthesis; renderer manages CRUD. [VERIFIED: 17-CONTEXT.md] |
| Reference-audio import/storage | Electron main | Python sidecar validation | Electron can use native file picker and userData storage; sidecar can validate readable audio metadata via `soundfile`. [VERIFIED: .planning/research/v3.0/STACK.md] |
| Active avatar/session preset association | Electron main stored config | Renderer | Association belongs in app audio settings keyed by current avatar/session, not avatar import catalogs. [VERIFIED: 17-CONTEXT.md] |
| Failure notice and log diagnostics | Renderer | Python sidecar logs/admin health | Main surfaces show concise status; existing log panel carries technical details. [VERIFIED: 17-CONTEXT.md] |

## Standard Stack

### Core

| Library / Component | Version | Purpose | Why Standard |
|---------------------|---------|---------|--------------|
| GPT-SoVITS external API v2 | Current upstream `main`, latest release shown as `20250606v2pro` on GitHub | External character-voice TTS service | Official `api_v2.py` documents `/tts` and model/control endpoints; project scope forbids bundling the dependency. [CITED: github.com/RVC-Boss/GPT-SoVITS] |
| `httpx` | 0.28.1 available; project currently allows `>=0.28` | Async HTTP client from sidecar to GPT-SoVITS | Already in sidecar deps; suitable for timeout-aware localhost HTTP calls. [VERIFIED: pip index versions httpx; sidecar/pyproject.toml] |
| `soundfile` | 0.13.1 | Decode GPT-SoVITS WAV responses and validate reference audio metadata | v3.0 stack already recommends it for in-memory WAV validation/decoding. [VERIFIED: pip index versions soundfile; .planning/research/v3.0/STACK.md] |
| Phase 16 `TTSProvider` shell | In-repo contract from Phase 16 | Provider-neutral synthesis boundary | Phase 17 depends on this shell; GPT-SoVITS should implement synthesize-only behavior. [VERIFIED: Phase 16 plans] |
| Electron `safeStorage` / stored config | Existing app pattern | Persist provider settings, presets, and active associations | Existing app config migration pattern is owned by Electron main and passed to sidecar through env/admin surfaces. [VERIFIED: Phase 16 plans] |

### Supporting

| Library / Component | Version | Purpose | When to Use |
|---------------------|---------|---------|-------------|
| `samplerate` | 0.2.4 | High-quality resampling if GPT-SoVITS output sample rate differs from playback stream | Add if Phase 16 payload path cannot already normalize 24k/48k output correctly. [VERIFIED: pip index versions samplerate; GPT-SoVITS README V3/V4 notes] |
| `psutil` | >=7.0 already in sidecar deps | App-owned process status/termination if launch is implemented in sidecar | Use to terminate only the launched process tree, never arbitrary external servers. [VERIFIED: sidecar/pyproject.toml; 17-CONTEXT.md] |
| Existing log panel | In-repo UI surface | Diagnostics for launch stdout/stderr, health errors, synthesis failures | Required by context to avoid raw technical dumps in main settings/chat surfaces. [VERIFIED: 17-CONTEXT.md] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| External HTTP client | Vendor GPT-SoVITS Python package into sidecar | Reject: violates phase scope and adds large PyTorch/CUDA/model dependency surface. [VERIFIED: 17-CONTEXT.md; CITED: GPT-SoVITS README] |
| Base URL | Separate full endpoint URLs for `/tts`, health, controls | Reject: locked decision says base URL only; endpoint paths should be derived/probed. [VERIFIED: 17-CONTEXT.md] |
| WAV non-streaming first | GPT-SoVITS streaming chunks | Streaming modes exist, but non-streaming WAV is simpler for ordered sentence payloads and RMS generation; revisit only after baseline works. [CITED: api_v2.py] |
| App-owned storage copy | Original absolute user file path | Reject: locked decision requires sanitized app-managed storage and avoids privacy/path portability issues. [VERIFIED: 17-CONTEXT.md] |

**Installation:**

```bash
# Python sidecar dependency additions if Phase 16 did not already add them:
uv add soundfile==0.13.1
# Optional only if existing playback path cannot resample provider output:
uv add samplerate==0.2.4
```

**Version verification:** `soundfile==0.13.1`, `samplerate==0.2.4`, and `httpx==0.28.1` were verified with `python -m pip index versions ...` on 2026-05-09. [VERIFIED: pip index]

## Architecture Patterns

### System Architecture Diagram

```text
Renderer Settings / Chat
  ├─ provider + preset forms
  ├─ test synthesis button
  └─ visible failure/fallback notices
        │ IPC/preload typed calls
        ▼
Electron main
  ├─ StoredConfig audio.gptSovitsProvider
  ├─ StoredConfig voicePresets[] + referenceAudioAssets[]
  ├─ activePresetByAvatarSession map
  ├─ file picker → sanitized userData copy
  └─ optional app-owned process launch/stop/status
        │ sidecar admin HTTP / env config
        ▼
Python sidecar admin + provider layer
  ├─ GET/POST health/test endpoints
  ├─ GptSoVitsProvider(httpx, baseUrl)
  └─ decode WAV → TTSSynthesisResult(pcm, sample_rate)
        │ provider-neutral result
        ▼
TTSTaskManager
  ├─ sequence ordering
  ├─ AudioPayloadMessage to renderer
  ├─ sounddevice playback
  └─ SpeechEnvelopePayload/RMS to compositor
        │ localhost HTTP
        ▼
External GPT-SoVITS API v2
  └─ POST /tts returns audio/wav or JSON 400 error
```

### Recommended Project Structure

```text
packages/contracts/py/contracts/
├── voice_preset.py          # preset/reference audio/provider settings contracts [ASSUMED]
└── audio_provider.py        # likely extended from Phase 16 [VERIFIED: Phase 16 plans]

apps/electron-main/src/
├── audio-presets.ts         # CRUD, migration, referential integrity [ASSUMED]
├── reference-audio.ts       # file copy/sanitize/delete guards [ASSUMED]
└── gpt-sovits-process.ts    # app-owned launch lifecycle if implemented in main [ASSUMED]

sidecar/src/sidecar/tts/
├── gpt_sovits_provider.py   # HTTP adapter [ASSUMED]
└── provider.py              # Phase 16 provider interface [VERIFIED: Phase 16 plans]

sidecar/src/sidecar/admin/
└── audio.py                 # extend Phase 16 status with health/test actions [VERIFIED: Phase 16 plans]
```

### Pattern 1: Base-URL Derived GPT-SoVITS Client

**What:** Store `base_url` such as `http://127.0.0.1:9880`, derive `/tts`, `/set_gpt_weights`, `/set_sovits_weights`, and optional health probe URLs internally. [VERIFIED: 17-CONTEXT.md; CITED: api_v2.py]

**When to use:** All external-server and app-managed modes; user should not configure separate full endpoint URLs. [VERIFIED: 17-CONTEXT.md]

**Example:**

```python
# Source: https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/api_v2.py
payload = {
    "text": request.text,
    "text_lang": preset.text_lang,
    "ref_audio_path": reference_audio.absolute_server_path,
    "prompt_text": preset.prompt_text,
    "prompt_lang": preset.prompt_lang,
    "text_split_method": preset.text_split_method or "cut5",
    "batch_size": 1,
    "media_type": "wav",
    "streaming_mode": False,
    "top_k": preset.top_k,
    "top_p": preset.top_p,
    "temperature": preset.temperature,
    "speed_factor": preset.speed_factor,
    "repetition_penalty": preset.repetition_penalty,
}
response = await client.post(f"{base_url}/tts", json=payload)
if response.status_code != 200:
    raise TTSProviderError.from_gpt_sovits_json(response)
```

### Pattern 2: Activation Gate With Candidate Config

**What:** Treat edited GPT-SoVITS provider/preset as a candidate until health check and user-triggered test synthesis both pass. [VERIFIED: 17-CONTEXT.md]

**When to use:** Provider switching, preset selection, reference audio reassignment, and launch command changes. [VERIFIED: 17-CONTEXT.md]

**Implementation guidance:** Persist drafts only as inactive config or save but do not set `activeTtsProvider="gpt_sovits"` / active preset id until test success. [VERIFIED: 17-CONTEXT.md]

### Pattern 3: Reference Audio as Managed Asset

**What:** Copy imported files into app-managed storage with a generated asset id and sanitized filename; store original basename only for display, not as the primary path. [VERIFIED: 17-CONTEXT.md]

**When to use:** Every GPT-SoVITS reference audio selection. [VERIFIED: 17-CONTEXT.md]

**Caveat:** GPT-SoVITS `/tts` expects `ref_audio_path` to be a filesystem path accessible to the GPT-SoVITS server process. [CITED: api_v2.py] App-managed storage must therefore be either on the same machine/path namespace as the server, or health/test synthesis must fail with a clear “server cannot read reference audio” diagnostic. [VERIFIED: .planning/research/v3.0/SUMMARY.md]

### Anti-Patterns to Avoid

- **Provider writes audio directly:** This bypasses `TTSTaskManager` ordering and RMS/lipsync; use provider-neutral PCM results instead. [VERIFIED: Phase 16 research]
- **Calling `/control?command=exit` on external servers:** Upstream exposes `/control`, but the app must never stop servers it did not launch. [CITED: api_v2.py; VERIFIED: 17-CONTEXT.md]
- **Silent mid-turn Piper fallback:** Context explicitly rejects switching to Piper during a failed GPT-SoVITS chat turn. [VERIFIED: 17-CONTEXT.md]
- **Preset stores connection fields:** Base URL and launch command are provider-level settings, not duplicated in each preset. [VERIFIED: 17-CONTEXT.md]
- **Deleting active/in-use data by cascade:** Active preset deletion requires reassignment; reference audio deletion is blocked while used. [VERIFIED: 17-CONTEXT.md]

## GPT-SoVITS API v2 Findings

| Endpoint | Method | Request / Response | Planning Implication |
|----------|--------|--------------------|----------------------|
| `/tts` | GET or POST | Required fields include `text`, `text_lang`, `ref_audio_path`, and `prompt_lang`; `prompt_text` defaults to empty; response success is audio stream with HTTP 200; failure is JSON with HTTP 400. [CITED: api_v2.py] | Use `POST /tts` with JSON and `media_type="wav"` first. [CITED: api_v2.py] |
| `/tts` tuning | POST | Supported fields include `aux_ref_audio_paths`, `top_k`, `top_p`, `temperature`, `text_split_method`, `batch_size`, `batch_threshold`, `split_bucket`, `speed_factor`, `fragment_interval`, `seed`, `parallel_infer`, `repetition_penalty`, `sample_steps`, `super_sampling`, `streaming_mode`, `overlap_length`, and `min_chunk_length`. [CITED: api_v2.py] | Preset schema should include a small safe subset now and an `advanced` object for future compatibility. [ASSUMED] |
| `/set_refer_audio` | GET | Accepts `refer_audio_path`; returns JSON success or JSON 400. [CITED: api_v2.py] | Optional health probe only; normal `/tts` can pass `ref_audio_path` per request. [ASSUMED] |
| `/set_gpt_weights` | GET | Accepts `weights_path`; returns `{"message":"success"}` or JSON 400. [CITED: api_v2.py] | Keep model weights provider-level advanced fields if exposed; do not require for Phase 17 MVP. [ASSUMED] |
| `/set_sovits_weights` | GET | Accepts `weights_path`; returns `{"message":"success"}` or JSON 400. [CITED: api_v2.py] | Same as GPT weights; optional advanced/provider-level setting. [ASSUMED] |
| `/control` | GET or POST | Commands include `restart` and `exit`. [CITED: api_v2.py] | Do not use for external servers; app-owned restart should restart the launched process, not arbitrary upstream process. [VERIFIED: 17-CONTEXT.md] |

**Health strategy:** There is no dedicated `/health` endpoint in the fetched `api_v2.py`. [CITED: api_v2.py] Use layered health: TCP/HTTP reachability to base URL, API-shape probe such as `/docs` or `/openapi.json` if FastAPI docs are enabled, and definitive readiness via short `POST /tts` test with selected reference audio. [ASSUMED] The local probe to `http://127.0.0.1:9880/docs` timed out, so no GPT-SoVITS server is available in this worktree environment. [VERIFIED: local probe]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client/timeouts | Raw sockets or `urllib` wrappers | `httpx.AsyncClient` | Existing dependency and async timeout support. [VERIFIED: sidecar/pyproject.toml] |
| WAV parsing/duration metadata | Manual RIFF parsing | `soundfile` | Recommended by v3.0 stack and current version verified. [VERIFIED: .planning/research/v3.0/STACK.md; pip index] |
| Audio playback/order/RMS | GPT-SoVITS-specific playback path | Existing `TTSTaskManager` + Phase 16 provider shell | Preserves ordered playback and lipsync invariants. [VERIFIED: Phase 16 research] |
| Process tree management | Kill by port/name or call external `/control exit` | App-owned process handle plus `psutil` process tree | Stop/restart must only affect app-launched process. [VERIFIED: 17-CONTEXT.md] |
| File sanitization | Concatenate user filenames into paths | Generated IDs + sanitized display basename + app userData path | Prevents path traversal/private path persistence. [VERIFIED: 17-CONTEXT.md] |
| Referential integrity | Ad hoc deletes | Central preset/reference-audio store with in-use checks | Avoids broken active preset/reference pointers. [VERIFIED: 17-CONTEXT.md] |

**Key insight:** GPT-SoVITS integration complexity is not the HTTP call; it is preserving app-owned playback invariants, explicit activation/fallback semantics, and filesystem accessibility of copied reference audio. [VERIFIED: synthesis of Phase 16 plans, 17-CONTEXT.md, api_v2.py]

## Common Pitfalls

### Pitfall 1: Reference audio path is valid for the app but not for GPT-SoVITS
**What goes wrong:** The app copies a reference file into userData, but an external GPT-SoVITS server in Docker/WSL/another cwd cannot read that path. [VERIFIED: .planning/research/v3.0/SUMMARY.md]  
**Why it happens:** `/tts` takes a `ref_audio_path` string and server-side code validates/uses that path in the GPT-SoVITS process context. [CITED: api_v2.py]  
**How to avoid:** Test synthesis must use the copied app-managed path before activation; if unreadable, show “server cannot access reference audio” with log detail. [VERIFIED: 17-CONTEXT.md]  
**Warning signs:** Health reachability passes but `/tts` returns JSON 400 with file/reference-related exception. [CITED: api_v2.py]

### Pitfall 2: Health check passes without proving synthesis
**What goes wrong:** `/docs` responds, but selected model/reference/language fails during chat. [ASSUMED]  
**Why it happens:** Reachability does not validate `ref_audio_path`, supported languages, model weights, or synthesis runtime. [CITED: api_v2.py]  
**How to avoid:** Require both health check and user-triggered test synthesis before GPT-SoVITS selection. [VERIFIED: 17-CONTEXT.md]  
**Warning signs:** Provider shows ready before any `/tts` call has succeeded. [ASSUMED]

### Pitfall 3: Mid-turn fallback changes avatar voice silently
**What goes wrong:** Sentence 1 uses GPT-SoVITS, sentence 2 fails and switches to Piper without user action. [VERIFIED: 17-CONTEXT.md]  
**Why it happens:** Generic fallback code treats TTS providers as interchangeable. [ASSUMED]  
**How to avoid:** Map GPT-SoVITS synthesis failure to failed sentence/audio state and next-turn explicit fallback action only. [VERIFIED: 17-CONTEXT.md]  
**Warning signs:** Logs show `[TTS-FALLBACK]` and Piper synthesis for the same active GPT-SoVITS turn. [ASSUMED]

### Pitfall 4: Upstream streaming mode complicates ordering
**What goes wrong:** Streaming chunks get emitted directly to renderer/playback and bypass sentence queue semantics. [ASSUMED]  
**Why it happens:** `api_v2.py` supports several `streaming_mode` values that yield chunks. [CITED: api_v2.py]  
**How to avoid:** Start with `streaming_mode=False`, `media_type="wav"`, decode complete sentence audio, then hand to `TTSTaskManager`. [CITED: api_v2.py; VERIFIED: Phase 16 research]  
**Warning signs:** GPT-SoVITS provider needs websocket/compositor references. [ASSUMED]

### Pitfall 5: Preset deletion leaves broken active association
**What goes wrong:** Current avatar/session points to a deleted preset and chat output fails later. [VERIFIED: 17-CONTEXT.md]  
**Why it happens:** Presets are global while active association is keyed elsewhere. [VERIFIED: 17-CONTEXT.md]  
**How to avoid:** Block deletion with a reassignment flow; never silently fall back to Piper. [VERIFIED: 17-CONTEXT.md]  
**Warning signs:** Config contains `activePresetId` not present in `voicePresets[]`. [ASSUMED]

## Code Examples

### GPT-SoVITS POST /tts Request Shape

```json
// Source: https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/api_v2.py
{
  "text": "こんにちは、今日は何をしましょうか？",
  "text_lang": "ja",
  "ref_audio_path": "C:/Users/.../AppData/Roaming/AgenticLLMVTuber/reference-audio/ref_abc123.wav",
  "prompt_text": "今日も一緒に頑張ろうね。",
  "prompt_lang": "ja",
  "top_k": 15,
  "top_p": 1,
  "temperature": 1,
  "text_split_method": "cut5",
  "batch_size": 1,
  "speed_factor": 1.0,
  "media_type": "wav",
  "streaming_mode": false,
  "repetition_penalty": 1.35
}
```

### Provider Adapter Boundary

```python
# Source: Phase 16 provider shell plan + GPT-SoVITS api_v2.py
class GptSoVitsProvider:
    async def synthesize(self, request: TTSSynthesisRequest) -> TTSSynthesisResult:
        payload = build_gpt_sovits_payload(request)
        response = await self._client.post(f"{self._base_url}/tts", json=payload)
        if response.status_code != 200:
            raise map_gpt_sovits_error(response)
        pcm_int16, sample_rate = decode_wav_bytes(response.content)
        return TTSSynthesisResult(pcm_int16=pcm_int16, sample_rate=sample_rate)
```

### Reference Audio Delete Guard

```typescript
// Source: Phase 17 context decisions D-08 and D-16
function canDeleteReferenceAudio(assetId: string, presets: VoicePreset[]): boolean {
  return presets.every((preset) => preset.gptSovits?.referenceAudioId !== assetId)
}

function canDeletePreset(presetId: string, activeAssociations: Record<string, string>): boolean {
  return Object.values(activeAssociations).every((activePresetId) => activePresetId !== presetId)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GPT-SoVITS v1/v2-only assumptions | Upstream README now documents V3, V4, and V2Pro family notes, including V4 native 48 kHz output. [CITED: GPT-SoVITS README] | README current as fetched 2026-05-09; latest release shown Jun 2025. [CITED: GitHub] | Planner must not hard-code one output sample rate; normalize provider output. [VERIFIED: .planning/research/v3.0/PITFALLS.md] |
| App installs GPT-SoVITS | Bring-your-own external server + optional user command launch | Locked for Phase 17. [VERIFIED: 17-CONTEXT.md] | No installer/training/model-management tasks in plan. [VERIFIED: 17-CONTEXT.md] |
| Per-avatar embedded voice config | Global preset library + active association in app audio settings | Locked for Phase 17. [VERIFIED: 17-CONTEXT.md] | Avatar import catalogs remain unchanged. [VERIFIED: 17-CONTEXT.md] |

**Deprecated/outdated:** Do not use older single `api.py` assumptions when planning Phase 17; current research verified `api_v2.py` endpoint shape. [CITED: api_v2.py]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Renderer/Electron tests/build | ✓ | v22.19.0 | — [VERIFIED: local command] |
| npm | JS workspace commands | ✓ | 10.9.3 | — [VERIFIED: local command] |
| Python | Sidecar tests | ⚠ | `python` is 3.13.11, but sidecar requires `>=3.12,<3.13` | Use project uv-managed 3.12 environment during execution. [VERIFIED: local command; sidecar/pyproject.toml] |
| uv | Python dependency management | ✓ | 0.10.4 | pip/venv if needed. [VERIFIED: local command] |
| GPT-SoVITS local server | Live health/test synthesis | ✗ | `http://127.0.0.1:9880/docs` timed out | Mock provider in automated tests; manual UAT requires user-run server. [VERIFIED: local probe] |
| `soundfile` | WAV decode/reference validation | Not installed/checked in env; registry current 0.13.1 | 0.13.1 available | Add dependency. [VERIFIED: pip index] |
| `samplerate` | Optional resampling | Not installed/checked in env; registry current 0.2.4 | 0.2.4 available | Use existing path if Phase 16 already handles resampling. [VERIFIED: pip index] |

**Missing dependencies with no fallback:** Live GPT-SoVITS manual health/test UAT is blocked until the user runs/provides a server. [VERIFIED: local probe]

**Missing dependencies with fallback:** Python command points to 3.13.11; execution should use uv/project Python 3.12 environment because the sidecar declares `<3.13`. [VERIFIED: local command; sidecar/pyproject.toml]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Python framework | pytest via `sidecar/pyproject.toml` with `testpaths = ["tests"]`. [VERIFIED: sidecar/pyproject.toml] |
| Renderer framework | Vitest via `apps/renderer/package.json`. [VERIFIED: apps/renderer/package.json] |
| Contracts command | `npm run check:contracts`. [VERIFIED: package.json] |
| Quick run command | `python -m pytest sidecar/tests/test_tts_manager.py sidecar/tests/test_audio_payload_helpers.py -q` [VERIFIED: existing tests] |
| Full relevant suite | `npm run check:contracts && npm --workspace apps/renderer run test -- --run Settings.test.tsx && npm --workspace apps/renderer run typecheck && npm --workspace apps/electron-main run build && python -m pytest sidecar/tests/test_tts_manager.py sidecar/tests/test_audio_payload_helpers.py sidecar/tests/admin -q` [VERIFIED: package scripts/existing tests] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| TTS-01 | Active provider can be Piper or GPT-SoVITS only after gates | unit/integration | `python -m pytest sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/test_tts_manager.py -q` | ❌ Wave 0/Phase 17 add GPT tests [VERIFIED: glob tests] |
| TTS-02 | GPT-SoVITS base URL health check | unit with mocked HTTP | `python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py -q` | ❌ Wave 0 [ASSUMED filename] |
| TTS-03 | User-command launch/stop affects only app-owned process | unit | `python -m pytest sidecar/tests/tts/test_gpt_sovits_process.py -q` or Electron equivalent | ❌ Wave 0 [ASSUMED filename] |
| TTS-04 | Test synthesis hears result without chat turn and failure does not activate | integration + renderer | `python -m pytest sidecar/tests/admin/test_audio_test_tts_endpoint.py -q` and `npm --workspace apps/renderer run test -- --run Settings.test.tsx` | ❌ Wave 0 for endpoint [ASSUMED filename] |
| TTS-06 | Mid-turn GPT failure marks failed sentence; no silent Piper switch | unit | `python -m pytest sidecar/tests/test_tts_manager.py -q` | ✅ existing manager tests, ❌ GPT-specific failure case [VERIFIED: glob tests] |
| PRESET-01 | Preset CRUD with active deletion guard | unit | `npm --workspace apps/renderer run test -- --run Settings.test.tsx` plus Electron config tests | ❌ Wave 0 [ASSUMED] |
| PRESET-02 | Preset stores knobs/reference metadata, not base URL | contract/unit | `npm run check:contracts` | ❌ Wave 0 contract expansion [VERIFIED: package.json] |
| PRESET-03 | Reference audio import validates and copies to managed storage | unit | Electron main or sidecar validation tests | ❌ Wave 0 [ASSUMED] |
| PRESET-04 | Active avatar/session association does not mutate avatar catalog | unit/integration | Renderer/Electron config tests + avatar override regression | ❌ Wave 0 [ASSUMED] |

### Sampling Rate
- **Per task commit:** Run the narrow tests for touched tier: contracts codegen for contract changes, `test_gpt_sovits_provider.py` for provider changes, Settings tests for UI changes. [ASSUMED]
- **Per wave merge:** Run relevant sidecar provider/admin tests plus renderer Settings/typecheck. [ASSUMED]
- **Phase gate:** Full relevant suite green plus manual UAT against a real GPT-SoVITS server if available. [VERIFIED: local server unavailable]

### Wave 0 Gaps
- [ ] `packages/contracts/py/contracts/voice_preset.py` or equivalent — covers PRESET-01..04. [ASSUMED]
- [ ] `sidecar/tests/tts/test_gpt_sovits_provider.py` — covers TTS-02/TTS-04/TTS-06 with mocked HTTP. [ASSUMED]
- [ ] `sidecar/tests/admin/test_audio_test_tts_endpoint.py` — covers test synthesis activation semantics. [ASSUMED]
- [ ] Electron main config/reference-audio tests — cover sanitized copy and delete guards. [ASSUMED]
- [ ] Renderer Settings tests — cover activation gate, concise failure notice, and log-panel link/copy. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Local single-user app; no auth added by this phase. [VERIFIED: CLAUDE.md] |
| V3 Session Management | no | No multi-user sessions added. [VERIFIED: CLAUDE.md] |
| V4 Access Control | yes | Only stop/restart app-owned GPT-SoVITS process; never external servers. [VERIFIED: 17-CONTEXT.md] |
| V5 Input Validation | yes | Validate base URL, launch command presence/cwd, reference audio extension/duration/readability, language enums, preset ids. [VERIFIED: 17-CONTEXT.md; CITED: api_v2.py] |
| V6 Cryptography | low | No new secrets required for GPT-SoVITS; config storage still uses existing Electron safe-storage patterns. [VERIFIED: Phase 16 plans] |
| V8 Data Protection | yes | Reference audio paths/transcripts and logs should be redacted where appropriate; Phase 18 owns broader redaction. [VERIFIED: .planning/REQUIREMENTS.md] |
| V12 File and Resources | yes | Copy files to app-managed storage with sanitized names and block path traversal/deleting in-use assets. [VERIFIED: 17-CONTEXT.md] |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF-like arbitrary base URL | Tampering / Information Disclosure | Default localhost, validate http(s) URL, show host clearly, avoid sending secrets, and treat non-localhost as advanced warning. [ASSUMED] |
| Command injection in app-managed launch | Elevation of Privilege | Store and execute exactly user-supplied command; avoid shell interpolation where possible; no bundled templates. [VERIFIED: 17-CONTEXT.md] |
| Killing unrelated process | Denial of Service | Track process handle/PID tree started by app; stop only that tree. [VERIFIED: 17-CONTEXT.md] |
| Path traversal / private path leakage | Information Disclosure | Copy to generated sanitized app-managed path; redact original/home paths in logs. [VERIFIED: 17-CONTEXT.md] |
| Reference transcript privacy leakage | Information Disclosure | Keep transcript in settings; avoid dumping full transcript in normal logs/UI; detailed logs via existing panel. [VERIFIED: 17-CONTEXT.md] |

## Recommended Plan Decomposition

1. **Contracts + persistence + reference-audio asset store:** Extend Phase 16 audio contracts with GPT-SoVITS provider config, `VoicePreset`, `ReferenceAudioAsset`, and active association map; add migration/defaults and reference-audio import/delete guards. [VERIFIED: 17-CONTEXT.md]
2. **Sidecar GPT-SoVITS provider + admin health/test:** Implement `GptSoVitsProvider` with base URL, mocked HTTP tests, WAV decode, provider errors, health/test synthesis endpoints, and no activation on failed test. [CITED: api_v2.py; VERIFIED: Phase 16 plans]
3. **App-managed launch lifecycle:** Add user-command/cwd start/status/stop/restart, stdout/stderr logs, health polling, and app-owned-only termination. [VERIFIED: 17-CONTEXT.md]
4. **Renderer Settings/preset UX:** Add provider switch, candidate gate, preset CRUD, reference-audio import management, concise failure notices, and log-panel link. [VERIFIED: 17-CONTEXT.md]
5. **Failure semantics and final UAT:** Add mid-turn GPT failure tests, visible failed sentence/audio state, explicit next-turn Piper action, and manual GPT-SoVITS server UAT if available. [VERIFIED: 17-CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Project files may be named `voice_preset.py`, `test_gpt_sovits_provider.py`, etc. | Project structure / Validation | Low; planner can choose exact names. |
| A2 | Health strategy can use `/docs` or `/openapi.json` as API-shape probe before synthesis. | API findings | Medium; FastAPI docs could be disabled by user fork, so synthesis test must be definitive. |
| A3 | Store only a safe subset of GPT-SoVITS tuning knobs initially. | API findings | Low; exposing more knobs is compatible if schema versioned. |
| A4 | Non-localhost base URLs should be advanced/warned. | Security | Medium; project is localhost-first but user may intentionally run Docker/WSL/remote LAN. |
| A5 | Launch process manager can live in Electron main or sidecar. | Architecture | Low; planner should pick based on existing process patterns after Phase 16 implementation. |

## Open Questions (RESOLVED)

1. **Does the user's GPT-SoVITS server run in the same filesystem namespace as the Electron app?**
   - Resolution: Do not assume shared namespace. Phase 17 must copy reference audio into app-managed storage, but activation requires test synthesis using the copied path. If GPT-SoVITS cannot read that path, the candidate stays inactive and UI shows `GPT-SoVITS could not read the copied reference audio. Open logs for details.` [VERIFIED: 17-CONTEXT.md; 17-UI-SPEC.md]
2. **What exact Phase 16 contract names will exist after execution?**
   - Resolution: Phase 17 plans must read the actual Phase 16 implementation before editing. Known Phase 16 target names include `packages/contracts/py/contracts/audio_provider.py`, generated TS audio-provider contracts, sidecar `TTSProvider` shell, `PiperTTSProvider`, and `/admin/audio/status`. If names differ after execution, preserve the implemented Phase 16 API rather than reintroducing parallel names. [VERIFIED: Phase 16 plans; current STATE.md]
3. **Should `/set_gpt_weights` and `/set_sovits_weights` be exposed in Phase 17?**
   - Resolution: Do not expose model-weight switching UI in Phase 17. If needed, allow provider-level optional advanced fields in contracts without UI activation requirements. Presets must not own connection/model-weight fields. [VERIFIED: 17-CONTEXT.md D-07]

## Sources

### Primary (HIGH confidence)
- `.planning/phases/17-gpt-sovits-provider-voice-presets/17-CONTEXT.md` — locked user decisions and scope. [VERIFIED: local read]
- `.planning/REQUIREMENTS.md` — TTS/PRESET requirement IDs. [VERIFIED: local read]
- `.planning/ROADMAP.md` — Phase 17 goal/success criteria/dependencies. [VERIFIED: local read]
- `.planning/phases/16-audio-contracts-tts-provider-shell/*` — dependency contract/provider-shell plan. [VERIFIED: local read]
- `https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/api_v2.py` — current API v2 endpoint and request fields. [CITED: github.com/RVC-Boss/GPT-SoVITS/api_v2.py]
- `https://github.com/RVC-Boss/GPT-SoVITS` / README — install/runtime complexity, supported languages, V3/V4/V2Pro notes. [CITED: github.com/RVC-Boss/GPT-SoVITS]

### Secondary (MEDIUM confidence)
- `.planning/research/v3.0/SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `FEATURES.md` — milestone synthesis from earlier research. [VERIFIED: local read]

### Tertiary (LOW confidence)
- Assumed file names and exact UI layout choices in recommended structure/decomposition. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package versions and GPT-SoVITS API were verified against registry/upstream docs. [VERIFIED: pip index; CITED: api_v2.py]
- Architecture: HIGH — Phase 16 plans and v3.0 architecture define clear sidecar/provider boundaries. [VERIFIED: Phase 16 plans]
- Pitfalls: HIGH — key pitfalls come directly from locked decisions and official API shape. [VERIFIED: 17-CONTEXT.md; CITED: api_v2.py]
- Live behavior: MEDIUM — local GPT-SoVITS server was unavailable, so live synthesis could not be tested. [VERIFIED: local probe]

**Research date:** 2026-05-09  
**Valid until:** 2026-06-08 for API/stack assumptions; re-fetch `api_v2.py` before implementation if planning slips. [ASSUMED]
