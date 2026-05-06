# Architecture Research

**Domain:** Local-first desktop Live2D companion app — Electron + React + Python sidecar with VTube Studio renderer
**Researched:** 2026-05-06
**Confidence:** HIGH (architecture is fully specified in `PROJECT_DESIGN.md` §4–§13; this document validates the shape against current best practices and provides build-order + module-boundary recommendations for the §14 walking skeleton)

> **Scope of this document.** This is *not* a re-derivation of the architecture — `PROJECT_DESIGN.md` already locks 112 decisions across 28 brainstorming rounds and §13 is closed. The job here is to (1) validate the locked architecture against current 2026 ecosystem patterns, (2) translate the §14 walking-skeleton scope into a concrete build order with explicit component boundaries, (3) propose the `packages/contracts/` layout, and (4) give the body-sway investigation a real architecture instead of a hopeful note.

---

## 1. Skeleton-Scoped System Overview

The full architecture in §4 covers the entire v1 (memory, agent, scheduler, skills, multi-thread, multi-avatar). The walking skeleton is a **vertical slice** through it — every layer exists, but each is the minimum viable depth needed to validate the layered design end-to-end.

Skeleton-scoped layout (collapsed from §4):

```
┌─────────────────── Desktop (Electron — TS) ─────────────────────┐
│  Electron main                                                   │
│   ├─ Window mgmt: windowed mode ONLY (pet mode deferred)         │
│   ├─ Sidecar lifecycle: eager spawn + watchdog (venv path)       │
│   ├─ Global hotkeys: kill (deferred), 1× test hotkey for prop    │
│   └─ IPC bridge to renderer                                      │
│                          │ IPC                                   │
│  Renderer (React + Vite + TS)                                    │
│   ├─ LLM Setup screen (mandatory on first launch)                │
│   ├─ Chat panel (single in-memory thread; no FTS, no sidebar)    │
│   ├─ Avatar canvas overlay (cursor tracking only — VTS owns      │
│   │                          the actual rendering window)        │
│   └─ In-app log panel (WS + sidecar errors visible)              │
│                          │ WebSocket (localhost only)            │
│  Python sidecar (FastAPI + uvicorn — venv, no PyInstaller)       │
│   ├─ WS endpoint /ws — typed JSON, OLVT-shape protocol           │
│   ├─ Conversation orchestrator                                   │
│   │     LLM stream → sentence_divider → actions_extractor        │
│   │                  → tts_filter → TTSTaskManager               │
│   ├─ LLM gateway (LiteLLM → LM Studio @ localhost:1234)          │
│   ├─ TTS gateway (piper ONNX only)                               │
│   ├─ Action compositor (60 Hz mixer)                             │
│   │     idle baseline + speech driver + intent overlay           │
│   ├─ Renderer-aware ParamID resolver (~30 LOC stub)              │
│   └─ VTS bridge (pyvts → VTube Studio @ ws://localhost:8001)     │
│                          │                                       │
└──────────────────────────│───────────────────────────────────────┘
                           ↓
                   ┌────────────────┐
                   │ VTube Studio   │ ← user runs this; we are a plugin
                   │ (Teto, dev)    │
                   └────────────────┘
```

**The five process boundaries** (each is a real OS-level boundary):

1. **Electron main ↔ Electron renderer** — Chromium IPC
2. **Electron renderer ↔ Python sidecar** — WebSocket on a localhost port
3. **Python sidecar ↔ VTube Studio** — WebSocket via pyvts to VTS plugin API (`ws://localhost:8001`)
4. **Python sidecar ↔ LM Studio** — HTTP to OpenAI-compatible endpoint (`http://localhost:1234/v1`)
5. **Python sidecar ↔ piper subprocess** — stdio (or library binding; piper-python ships either way)

**Validation against 2026 ecosystem patterns:** the Electron + Python-sidecar-via-WebSocket pattern is the current convention for local-AI desktop apps where the AI logic is Python-native (transformers, ONNX models, etc.). FastAPI's first-class WebSocket support over Starlette is the standard 2026 choice — see [FastAPI WebSocket docs](https://fastapi.tiangolo.com/advanced/websockets/) and [the 2026 lightning-fast AI backends overview](https://nerdleveltech.com/building-lightning-fast-ai-backends-with-fastapi-2026-edition). The architecture in §4 is on the well-trodden path, not the bleeding edge — which is right for a 2-week skeleton.

---

## 2. Component Responsibilities — TS vs Python Split

The single most important boundary is **Electron-side (TS) vs sidecar-side (Python)**. Get this wrong and everything regresses.

### 2.1 Electron main responsibilities (TS)

| Component | Responsibility | Skeleton scope |
|-----------|----------------|----------------|
| Sidecar lifecycle | spawn `python -m app.main` in venv on app start; restart on exit; kill on app quit | Yes — minimum viable: `child_process.spawn`, log piping, kill on `before-quit` |
| WS port discovery | sidecar prints `[READY] ws://127.0.0.1:<port>/ws` to stdout; main parses and forwards to renderer via IPC | Yes — avoids hardcoded ports, enables future multi-instance |
| Window mgmt | one BrowserWindow, transparent canvas region NOT needed (VTS owns the avatar window) | Minimal — single window, no pet mode |
| Global hotkeys | one test hotkey to fire a `DiscreteEvent` (prop) — proves the hotkey path | Yes (1 hotkey only) |
| IPC bridge | preload script exposes `window.api.{getSidecarUrl, …}` to renderer | Yes — type-safe via shared contracts |

**Anti-pattern to avoid:** running uvicorn from the Electron main process via `python-shell` or by importing it as a Node module. Spawn it as a real child process so a sidecar crash doesn't take Electron down. This matters because [child processes spawned by FastAPI applications can become orphaned and reassigned to PID 1 once the main process is killed](https://github.com/Kludex/uvicorn/issues/2289) — Electron must own the lifecycle, not delegate it.

### 2.2 Renderer responsibilities (React + TS)

| Component | Responsibility | Skeleton scope |
|-----------|----------------|----------------|
| WS client | one connection to `getSidecarUrl()`; reconnect-on-drop; emits typed events | Yes — Zustand or RxJS; pick the simpler one (Zustand for skeleton) |
| LLM Setup screen | mandatory first-launch gate — POST `/admin/llm-test`, block until 200 | Yes (success criterion §14) |
| Chat panel | streaming sentence-by-sentence rendering synced with TTS audio playback | Yes — single in-memory thread |
| Avatar canvas | **does NOT render the Live2D model** — VTS does. Renderer only tracks cursor and sends `cursor_move` events | Yes — small overlay div, transparent, captures mouse events |
| Audio playback | receives `audio` WS message, plays via Web Audio API; emits `playback_started`/`playback_ended` for UI sync | Yes — **single audio queue, no parallel playback** |
| Log panel | tails a WS `log` message stream | Yes (debugging aid) |

**Critical clarification on the avatar canvas.** The renderer does NOT host a Live2D canvas in v1. VTube Studio is a separate native window that renders the avatar; our renderer's "avatar canvas" is conceptually a *transparent overlay that captures cursor events near where VTS is drawing*. The pixi-live2d-display path (post-MVP, deferred) is what would put rendering inside our renderer. **Don't build the canvas integration the skeleton doesn't need** — the cursor-tracking element is a `<div>` with `onMouseMove`, not a Pixi/Three.js scene.

### 2.3 Python sidecar responsibilities

The sidecar is the brain. Internal modules:

| Module | Responsibility | Skeleton scope |
|--------|----------------|----------------|
| `app/ws/protocol.py` | typed message envelopes; route `{type, payload}` JSON | Yes — OLVT-shape |
| `app/ws/server.py` | FastAPI WS endpoint, connection lifecycle | Yes |
| `app/orchestrator/pipeline.py` | OLVT-style decorator chain: token → sentence → action → TTS | Yes |
| `app/llm/gateway.py` | LiteLLM client; provider config from settings | Yes (LM Studio only) |
| `app/tts/gateway.py` | piper backend; **exposes RMS feature tap** to compositor | Yes |
| `app/compositor/core.py` | 60 Hz frame loop; merges drivers; emits `ParamFrame` | Yes |
| `app/compositor/drivers/idle.py` | Perlin drift + blink scheduler | Yes |
| `app/compositor/drivers/speech.py` | TTS RMS → head/body sway | Yes (head guaranteed; body = open problem, see §6) |
| `app/compositor/drivers/intent.py` | `[joy]` etc. → smooth blend | Yes |
| `app/compositor/drivers/reaction.py` | cursor → eye/head tracking | Yes (skeleton success #5) |
| `app/renderer/resolver.py` | logical-name → `ParamID` lookup, renderer-aware | Yes (~30 LOC stub) |
| `app/renderer/vts_bridge.py` | pyvts client; `InjectParameterDataRequest` per frame | Yes |
| `app/avatar/loader.py` | reads `teto_overrides.yaml`; supplies orphan-list to resolver | **Stub only** (loads empty overrides) |
| `app/contracts/` | generated TS-mirror types (Pydantic source-of-truth) | Yes |
| `app/state/snapshot.py` | crash recovery snapshots | Deferred |
| `app/memory/*` | episodic + RAG + FTS | Deferred (memory milestone) |
| `app/agent/*` | router + sub-agents | Deferred (agent milestone) |

**Skeleton excludes:** memory subsystem, agent runtime, skills loader, permissions controller, hot-reload watcher, audit logger, scheduler. Each is a complete subdirectory in the full v1 layout — the skeleton just doesn't import them.

---

## 3. Recommended Project Structure (Monorepo)

```
AgenticLLMVTuber/
├── apps/
│   ├── electron-main/              # TS — process boundary 1
│   │   ├── src/
│   │   │   ├── main.ts             # app entry, window mgmt
│   │   │   ├── sidecar.ts          # spawn + watchdog + port discovery
│   │   │   ├── hotkeys.ts          # global hotkey registration (1 hotkey)
│   │   │   └── ipc.ts              # typed IPC channel definitions
│   │   ├── preload.ts              # contextBridge.exposeInMainWorld('api', ...)
│   │   └── package.json
│   │
│   ├── renderer/                   # TS + React + Vite — process boundary 1
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx             # router: setup-screen | chat-screen
│   │   │   ├── ws/
│   │   │   │   ├── client.ts       # singleton WS connection
│   │   │   │   └── store.ts        # Zustand store fed by WS messages
│   │   │   ├── audio/
│   │   │   │   └── player.ts       # Web Audio queue + playback events
│   │   │   ├── screens/
│   │   │   │   ├── LLMSetup.tsx
│   │   │   │   └── Chat.tsx        # input + sentence-streamed display
│   │   │   └── canvas/
│   │   │       └── CursorTracker.tsx  # transparent overlay → cursor events
│   │   └── package.json
│   │
│   └── sidecar/                    # Python — process boundary 2
│       ├── app/
│       │   ├── main.py             # uvicorn entry; prints [READY] line
│       │   ├── ws/
│       │   │   ├── protocol.py     # message envelopes + dispatcher
│       │   │   └── server.py       # FastAPI app + /ws endpoint
│       │   ├── orchestrator/
│       │   │   ├── pipeline.py     # decorator chain
│       │   │   ├── sentence_divider.py
│       │   │   ├── actions_extractor.py
│       │   │   └── tts_filter.py
│       │   ├── llm/gateway.py
│       │   ├── tts/
│       │   │   ├── gateway.py
│       │   │   ├── piper_backend.py
│       │   │   └── features.py     # RMS envelope tap
│       │   ├── compositor/
│       │   │   ├── core.py
│       │   │   ├── frame_clock.py
│       │   │   └── drivers/
│       │   │       ├── base.py     # Driver Protocol — see §6
│       │   │       ├── idle.py
│       │   │       ├── intent.py
│       │   │       ├── reaction.py
│       │   │       └── speech/
│       │   │           ├── __init__.py  # active = head_only_v1
│       │   │           ├── head_only.py
│       │   │           ├── physics_chain.py    # IN-twin attempt (known broken)
│       │   │           ├── exp3_modulation.py  # alternative 1
│       │   │           └── proxy_param.py      # alternative 2
│       │   ├── renderer/
│       │   │   ├── resolver.py
│       │   │   └── vts_bridge.py
│       │   └── avatar/
│       │       ├── overrides.py    # loads teto_overrides.yaml
│       │       └── loader.py
│       ├── tests/
│       └── pyproject.toml
│
├── packages/
│   └── contracts/                  # cross-language source-of-truth
│       ├── schemas/
│       │   └── control.py          # Pydantic models — single source
│       ├── generated/
│       │   ├── ts/
│       │   │   └── control.ts      # generated by codegen
│       │   └── py/                 # alias re-export of schemas
│       ├── codegen.sh              # runs datamodel-code-generator pipeline
│       └── package.json
│
├── avatars/
│   └── teto/                       # dev-only; .gitignored except for the override stub
│       └── teto_overrides.yaml     # checked in (stub) — schema established
│
├── PROJECT_DESIGN.md
├── README.md
├── package.json                    # workspace root (npm/pnpm workspaces)
└── .planning/
```

### 3.1 Why this structure

- **`apps/` for runnable processes, `packages/` for shared libs.** Standard JS-monorepo convention; matches what pnpm/npm/yarn workspaces expect.
- **`apps/sidecar/` is a Python project, not a npm workspace.** That's fine — npm workspaces tolerate non-Node directories; `pyproject.toml` handles its own dependency resolution. The Electron main process spawns it with an absolute path.
- **`packages/contracts/` is the only shared package in the skeleton.** Don't pre-create empty `packages/utils/`, `packages/ui/` etc. — adding a workspace later is one-line.
- **`avatars/teto/` is dev-only** and `.gitignored` except for `teto_overrides.yaml` — that file is checked in to establish the per-avatar override schema even though the import-pipeline tooling that consumes it is deferred.

---

## 4. Data Contracts Layout (`packages/contracts/`)

This is asked for explicitly in the brief. The proposed layout:

### 4.1 Source of truth: Pydantic v2 models

`packages/contracts/schemas/control.py` is the *only* place these types are defined. Both Python and TypeScript consume generated artifacts.

```python
# packages/contracts/schemas/control.py
from pydantic import BaseModel, Field
from typing import Literal

class ParamFrame(BaseModel):
    avatar_id: str
    params: dict[str, float]
    t_ms: int

class ActionIntent(BaseModel):
    kind: Literal["expression", "action", "reaction"]
    name: str
    strength: float = 1.0
    duration_ms: int | None = None
    avatar_id: str

class DiscreteEvent(BaseModel):
    kind: Literal["hotkey", "model-variant-swap", "prop-spawn", "prop-clear"]
    name: str
    avatar_id: str

# WS envelope — wraps any payload with a type tag
class WSMessage(BaseModel):
    type: Literal[
        "text-input",          # client → server
        "interrupt-signal",    # client → server
        "cursor-move",         # client → server
        "hotkey-fired",        # client → server
        "audio-payload",       # server → client
        "display-text",        # server → client
        "param-frame",         # server → client (60 Hz)
        "log",                 # server → client
        "error",               # server → client
    ]
    payload: dict  # narrowed by `type` — discriminated union in TS
```

### 4.2 Codegen pipeline

```bash
# packages/contracts/codegen.sh
#!/usr/bin/env bash
set -euo pipefail

# 1. Pydantic → JSON Schema
python -c "
from schemas.control import *
from pydantic import BaseModel
import json, sys
models = [ParamFrame, ActionIntent, DiscreteEvent, WSMessage]
schema = {'\$defs': {m.__name__: m.model_json_schema() for m in models}}
print(json.dumps(schema, indent=2))
" > generated/control.schema.json

# 2. JSON Schema → TypeScript via json-schema-to-typescript
npx json-schema-to-typescript generated/control.schema.json \
    --output generated/ts/control.ts
```

### 4.3 Why this approach

- **Pydantic-first not TS-first**: the sidecar is the producer of all interesting state; the renderer is mostly a consumer. Generating TS from Python keeps the source of truth where the logic lives.
- **JSON Schema as intermediate**: avoids tying the codegen to either side's framework. Future swap to msgspec or attrs doesn't break the TS generation path.
- **`datamodel-code-generator` is not the right tool here** — despite the search-result framing, datamodel-code-generator goes JSON Schema/OpenAPI → Pydantic. For Pydantic → TS the chain is `model.model_json_schema()` → `json-schema-to-typescript`. (Verified via [the datamodel-code-generator README](https://github.com/koxudaxi/datamodel-code-generator) — it generates Python types from data sources, not the reverse.)
- **Pydantic v2 over dataclasses** despite §6 of `PROJECT_DESIGN.md` showing dataclasses: dataclasses don't have a built-in JSON Schema export. The brief allows this — §6's contracts are illustrative, not committed-to as `@dataclass`. Switch the spec illustration to Pydantic when contracts package lands.
- **OLVT protocol-shape match**: WSMessage uses `{type, payload}` envelope, [matching OLVT's `_route_message()` pattern](https://deepwiki.com/Open-LLM-VTuber/Open-LLM-VTuber/3-system-architecture). Plumbing fixes copy back.

### 4.4 Confidence

MEDIUM. The codegen direction (Pydantic → TS) is right but the exact tool choice deserves a 30-minute spike when the package is built. Alternatives to evaluate: `pydantic2ts`, `typia` (the reverse direction wouldn't apply), hand-written TS. **For the skeleton, hand-written TS that mirrors the Pydantic models is acceptable** — codegen can land in a follow-up PR; the volume of types is small (maybe 10 models in skeleton).

---

## 5. Data Flow — One User Message End to End

This is the canonical path through the skeleton. Trace it carefully because every component lies on it.

```
[user types "hello" in chat panel]
         │
         ▼
Renderer Chat.tsx → ws.send({type: "text-input", payload: {text, thread_id}})
         │
         ▼   ───── localhost WS boundary ─────
Sidecar /ws receives → protocol.dispatch → orchestrator.run(msg)
         │
         ▼
Orchestrator.run():
  prompt = build_prompt(text, history)
  llm_stream = llm_gateway.stream(prompt)
  pipeline = sentence_divider(llm_stream)
           → actions_extractor()
           → tts_filter()
  
  for sentence_output in pipeline:
      # sentence_output = {display_text, tts_text, actions: [ActionIntent]}
      
      # Fan out 1: display
      ws.send({type: "display-text", payload: {text, sentence_id}})
      
      # Fan out 2: actions to compositor (sparse intents)
      for intent in sentence_output.actions:
          compositor.add_intent(intent)   # joy/shy/wave fade in
      
      # Fan out 3: TTS synthesis (parallel, ordered queue)
      tts_task = tts_queue.submit(sentence_output.tts_text)
      # awaits in order — first sentence plays while second synthesizes
      audio_bytes, rms_envelope = await tts_task.result
      
      # Fan out 4: speech driver gets RMS *before* audio plays
      compositor.start_speech(sentence_id, rms_envelope, duration_ms)
      
      # Fan out 5: send audio to renderer
      ws.send({type: "audio-payload",
               payload: {sentence_id, audio_b64, duration_ms}})
      # (renderer plays via Web Audio — its own clock; we sync via timestamps)

# Meanwhile, in a separate task — the compositor frame loop:
async def compositor_loop():
    while running:
        t_ms = monotonic_ms()
        params = {}
        params |= idle_driver.frame(t_ms)
        params |= speech_driver.frame(t_ms)   # active during sentences
        params |= intent_driver.frame(t_ms)   # active joy/shy
        params |= reaction_driver.frame(t_ms) # cursor-driven
        
        frame = ParamFrame(avatar_id="teto", params=params, t_ms=t_ms)
        
        # Renderer-aware ParamID resolution
        resolved = resolver.resolve(frame, renderer="vts")
        
        # → VTS bridge
        await vts_bridge.inject(resolved)
        
        # Optional: also send to renderer for debug overlay
        ws.send({type: "param-frame", payload: frame.dict()})
        
        await sleep_until(t_ms + 16)  # 60 Hz
```

### 5.1 Why this flow has the shape it does

- **Sentence-buffered TTS** ([§13.100, §5.6](../../PROJECT_DESIGN.md)): first sentence plays while second synthesizes. Perceived latency = first-sentence-synth-time, not total. Implemented as ordered async queue.
- **Compositor runs on its own clock**, not driven by sentences. This is the key insight — the avatar should produce frames during silence too (idle baseline). Sentences just *add* an active speech driver and intent overlays.
- **RMS envelope passed before audio plays.** The speech driver needs the envelope to drive head/body sway. Since the renderer plays audio on its own Web Audio clock, the sidecar's compositor uses its *own* monotonic-ms timestamp on `start_speech` and assumes the renderer plays the audio with low latency. **Drift between TTS-audio-clock and compositor-clock is the dominant lipsync defect to watch for.** Mitigation: piper synth latency is tens of ms; one-shot VTS round-trip is sub-ms; observe drift in dev, add a sync correction if needed.
- **`param-frame` over WS to renderer is debug-only.** The actual renderer for v1 is VTS, reached directly from the sidecar via pyvts. The renderer process never touches `ParamFrame`s in skeleton (cursor events flow the other way). This is a **simpler architecture than the full §4** — it removes one boundary cross during the high-frequency 60 Hz loop.

### 5.2 Latency-critical paths

| Path | Acceptable | Mitigation |
|------|------------|------------|
| `text-input` → first-sentence audio start | ~1–3s (LM Studio dependent) | sentence-buffered streaming |
| Compositor frame → VTS deformer update | <5ms | direct pyvts; same-machine WS |
| `[joy]` extracted → expression visible | ~300ms ramp (success criterion §14 #2) | intent-driver fade curve, not hotkey |
| `cursor-move` → eye tracking visible | <50ms | low-rate cursor events (15 Hz throttled) |

---

## 6. Speech-Driver Body-Sway Investigation Architecture

This is the single biggest open architectural question — body-sway-during-TTS is unsolved on VTS rigs (R-OPEN-1). The OLVT Phase 4 IN-twin physics-chain trick (`ParamAngleXIN`/`ParamAngleZIN`) **did not** produce visible body sway. The skeleton needs a credible *investigation* architecture, not a baked-in broken assumption.

### 6.1 Strategy-pattern speech driver

```python
# app/compositor/drivers/speech/base.py
from typing import Protocol

class SpeechDriver(Protocol):
    """Contract: given an active sentence's RMS envelope and its
    elapsed time, return param contributions for this frame."""
    
    def start(self, sentence_id: str, rms_envelope: list[float],
              duration_ms: int) -> None: ...
    def frame(self, t_ms: int) -> dict[str, float]: ...
    def stop(self, sentence_id: str) -> None: ...

# app/compositor/drivers/speech/__init__.py
from .head_only import HeadOnlySpeechDriver
from .physics_chain import PhysicsChainSpeechDriver  # OLVT broken approach, kept for re-test
from .exp3_modulation import Exp3ModulationSpeechDriver
from .proxy_param import ProxyParamSpeechDriver

REGISTRY = {
    "head_only": HeadOnlySpeechDriver,
    "physics_chain": PhysicsChainSpeechDriver,
    "exp3_modulation": Exp3ModulationSpeechDriver,
    "proxy_param": ProxyParamSpeechDriver,
}

# Selectable in dev via env var or settings file:
#   SPEECH_DRIVER=physics_chain python -m app.main
```

**The four implementations to investigate** (one wins; the rest stay as `# noqa` reference):

| Driver | Approach | Hypothesis |
|--------|----------|------------|
| `head_only` | drives only `ParamAngleX/Y/Z` from RMS; body stays still | guaranteed visible (head is non-orphan); fallback if everything else fails |
| `physics_chain` | OLVT approach: writes `ParamAngleXIN`/`ParamAngleZIN`, hopes physics chain forwards to body | known not-working on Teto; preserved so future rigs can re-test |
| `exp3_modulation` | scales an `.exp3.json` body-pose expression by RMS instead of additive injection | new approach — VTS expression blending is well-tested; modulating an expression's strength curves with RMS may produce visible body motion through a path that already works |
| `proxy_param` | smoke-passes the rig at startup to find a non-orphan body param (e.g., `ParamBodyAngleX_proxy_via_HairFront` if such a thing exists) and writes that with RMS | requires the smoke-pass tool; per-rig discovery; documented as the "right" answer if the rig has any non-orphan body param at all |

### 6.2 Why a strategy interface and not just hard-coding head-only

Three reasons:

1. **The investigation is the deliverable, not the answer.** §14 success criterion is "speech driver produces visible body/head sway *or* a written rationale documenting what was tried." A strategy interface produces *both*: the winning driver becomes the default; the others stay as runnable evidence of what was attempted.
2. **Per-rig variation is real.** The Teto rig is one rig. The Live2D Inc. sample model (Hiyori — the actual ship default per §13.123) is a different rig and may have different orphan params. The strategy interface lets the project onboard a new rig by trying drivers in turn.
3. **Avoids the biggest design failure mode**: silently inheriting a broken assumption from OLVT. With the strategy pattern, "OLVT's IN-twin trick didn't work on Teto" is a *runnable test*, not a prose footnote.

### 6.3 What ships

For the §14 deliverable: the **default** speech driver is whichever produces visible body sway in dev. If none do, the default is `head_only` and the project ships with documented rationale (per §14 success criterion). The other drivers stay in the codebase as `# investigated, see decisions log`.

This **does not** justify a full renderer abstraction (the brief is explicit about this). It's a strategy interface inside one driver inside one component. The renderer-aware ParamID resolver remains the ~30 LOC stub described next.

### 6.4 Confidence

MEDIUM-HIGH on the architecture (strategy pattern is textbook for this — see [Strategy pattern overview](https://refactoring.guru/design-patterns/strategy)); LOW on which driver will win (that's empirical and the whole point).

---

## 7. Renderer-Aware ParamID Resolver (~30 LOC)

The brief is emphatic: **don't build a multi-renderer abstraction**. Just build the small thing that prevents a future renderer swap from being a compositor rewrite.

### 7.1 What it is

```python
# app/renderer/resolver.py
from typing import Literal
from contracts import ParamFrame

class ParamIDResolver:
    """Maps logical-name → renderer-specific ParamID.
    
    The compositor's drivers emit logical names (e.g. "head_x", "blink").
    This resolver translates to whatever the active renderer wants.
    For VTS: write to input layer (ParamAngleX) — VTS handles routing.
    For non-VTS (post-MVP): write to IN twin or routed deformer input.
    """
    
    LOGICAL_TO_VTS = {
        "head_x": "ParamAngleX",
        "head_y": "ParamAngleY",
        "head_z": "ParamAngleZ",
        "blink": "ParamEyeLOpen",  # symmetric blink in skeleton
        "blink_l": "ParamEyeLOpen",
        "blink_r": "ParamEyeROpen",
        "mouth_y": "ParamMouthOpenY",
        "brow_l_y": "ParamBrowLY",
        "brow_r_y": "ParamBrowRY",
        "body_x": "ParamBodyAngleX",  # may be orphan — see overrides
        "body_z": "ParamBodyAngleZ",
    }
    
    def __init__(self, renderer: Literal["vts", "pixi"], overrides: dict):
        self._renderer = renderer
        self._orphans = set(overrides.get("orphans", []))
        self._proxies = overrides.get("proxies", {})  # {"body_x": "head_x_in"}
    
    def resolve(self, frame: ParamFrame) -> ParamFrame:
        if self._renderer == "vts":
            out = {}
            for logical, value in frame.params.items():
                pid = self.LOGICAL_TO_VTS.get(logical)
                if pid is None:
                    continue  # unknown logical name — silent skip
                if pid in self._orphans:
                    # try proxy
                    if logical in self._proxies:
                        proxy_pid = self.LOGICAL_TO_VTS.get(self._proxies[logical])
                        if proxy_pid:
                            out[proxy_pid] = out.get(proxy_pid, 0.0) + value
                    continue  # orphan, no proxy → skip
                out[pid] = value
            return ParamFrame(avatar_id=frame.avatar_id, params=out, t_ms=frame.t_ms)
        else:
            raise NotImplementedError(
                f"Renderer '{self._renderer}' not supported in v1. "
                f"VTS is the whole-MVP renderer; pixi is post-MVP exploratory."
            )
```

### 7.2 Why this design

- **The non-VTS branch raises a helpful error** rather than silently doing nothing or having scaffolding that doesn't work. When/if the post-MVP Pixi attempt happens, the developer hits this exception immediately and knows what to implement.
- **Logical names live in the compositor; ParamIDs live here.** Drivers never see `ParamAngleX`. This is the abstraction the brief asks for, no more.
- **Per-avatar overrides plug in cleanly** — `teto_overrides.yaml` provides the orphan list and proxy mapping. The skeleton ships with empty lists.
- **30-ish LOC.** The point is to pay a tiny tax now to preserve a renderer-swap option later, not to build a full renderer abstraction.

### 7.3 What it does NOT do

- No routing emulation (that's a Pixi-bridge problem, deferred).
- No `<model>.vtube.json` parsing (deferred to import-pipeline milestone).
- No smoothing curves (VTS handles those).
- No multi-renderer dispatch table — the renderer choice is set at sidecar startup and constant for the session.

---

## 8. Build Order — Coarse Granularity (Per `config.json`)

`.planning/config.json` sets `granularity: coarse` — the user wants 5 sequential or 3 parallel chunks. Given §14's tight 2-week budget and the high coupling between modules, **sequential is right here**. Each chunk produces a runnable artifact; integration happens within chunks, not at the end.

### Chunk 1 — Plumbing skeleton (Days 1–2)

**Deliverable:** `npm run dev` boots Electron, which spawns the Python sidecar, the renderer connects to the sidecar's WS, and a hardcoded "echo" round-trip works (`text-input` → server logs → `display-text` reply).

**Components:**
- `apps/electron-main/` — sidecar spawn + watchdog + port discovery
- `apps/renderer/` — WS client + minimal chat input that emits `text-input`
- `apps/sidecar/app/ws/` — FastAPI WS endpoint, dispatcher
- `packages/contracts/schemas/control.py` — `WSMessage` + handful of payload types
- Hand-written TS mirror in `apps/renderer/src/types/control.ts` (codegen later)

**Acceptance:** type "hello" → see "echo: hello" in the chat panel. No LLM, no TTS, no avatar.

**Why first:** every other chunk depends on the round-trip. Get this rock-solid before adding I/O complexity. **This is the OLVT-protocol-shape bootstrap moment** — fix the message envelope here and propagating it through the rest of the codebase is mechanical.

### Chunk 2 — Conversation pipeline (Days 3–5)

**Deliverable:** real LLM reply with sentence-streamed display, no audio, no avatar yet.

**Components:**
- `apps/sidecar/app/llm/gateway.py` — LiteLLM → LM Studio
- `apps/sidecar/app/orchestrator/pipeline.py` — sentence_divider + actions_extractor + tts_filter (placeholder TTS that returns silence)
- `apps/renderer/src/screens/LLMSetup.tsx` — first-launch gate (success criterion: setup screen blocks until LM Studio reachable)
- Mandatory LM-Studio-test endpoint on sidecar

**Acceptance:**
1. Cold-start with no config → setup screen blocks until LM Studio reachable.
2. Type "tell me a 3-sentence story" → see 3 sentences appear sequentially in chat.
3. LLM emits `[joy]` in text → sidecar logs an extracted `ActionIntent` (visible in log panel).

**Why second:** validates the LiteLLM/LM-Studio glue and the OLVT decorator chain *before* introducing audio timing. The pipeline is the most lifted-from-OLVT piece — proving it ports cleanly de-risks half the skeleton.

### Chunk 3 — TTS + audio playback (Days 6–8)

**Deliverable:** avatar's reply is *spoken* with sentence-buffered playback. No avatar visuals yet.

**Components:**
- `apps/sidecar/app/tts/piper_backend.py` — piper synth → audio bytes
- `apps/sidecar/app/tts/features.py` — RMS envelope extraction
- `apps/sidecar/app/orchestrator/pipeline.py` — TTSTaskManager (parallel synth + ordered queue)
- `apps/renderer/src/audio/player.ts` — Web Audio queue
- `audio-payload` WS message wired end-to-end

**Acceptance:**
1. Type a 3-sentence reply → first sentence plays while second is still synthesizing (verifiable via logs).
2. Sentence text appears in chat *as* TTS plays it (not before).
3. Drift between text and audio is sub-second over a 30-second reply.

**Why third:** TTS adds the only really new I/O complication (audio clock vs sidecar clock). Doing it before the compositor means the RMS feature tap is real, not stubbed. Compositor's speech driver in chunk 4 just consumes the existing tap.

### Chunk 4 — Action compositor + VTS bridge (Days 9–12)

**Deliverable:** the **§14 success deliverable**. Avatar (Teto in VTS) idles, talks, blinks, sways, blends in `[joy]` smoothly, tracks cursor.

**Components:**
- `apps/sidecar/app/renderer/vts_bridge.py` — pyvts auth + `InjectParameterDataRequest` per frame
- `apps/sidecar/app/renderer/resolver.py` — the ~30 LOC resolver
- `apps/sidecar/app/avatar/overrides.py` — loads `teto_overrides.yaml` (initially empty)
- `apps/sidecar/app/compositor/core.py` — 60 Hz frame clock
- `apps/sidecar/app/compositor/drivers/idle.py` — Perlin drift + blink scheduler
- `apps/sidecar/app/compositor/drivers/intent.py` — `[joy]` etc. → fade
- `apps/sidecar/app/compositor/drivers/reaction.py` — `cursor-move` event → eye/head tracking
- `apps/sidecar/app/compositor/drivers/speech/head_only.py` — guaranteed-working baseline
- `apps/sidecar/app/compositor/drivers/speech/{physics_chain,exp3_modulation,proxy_param}.py` — investigation drivers (one will become the default if it works)
- `apps/renderer/src/canvas/CursorTracker.tsx` — emits throttled `cursor-move` events
- `apps/electron-main/src/hotkeys.ts` — 1× test hotkey emitting `hotkey-fired`
- `avatars/teto/teto_overrides.yaml` — the override-schema stub

**Acceptance:** all six §14 success criteria pass.
1. "hello" → spoken reply with sync'd lipsync (driven by RMS → `mouth_y`)
2. `[joy]` → smooth 300ms blend, decays after sentence
3. Idle → micro-motion visible (drift + blinks + saccades)
4. Speech → continuous head sway (guaranteed) and body sway (if a speech driver wins) through utterance
5. Cursor over canvas → eye/head tracking
6. Test hotkey → 1 prop appears via VTS hotkey path (proves DiscreteEvent path)

**Why fourth and largest:** this is where the compositor — the unique value-add — lives. Everything before this chunk was OLVT-style port work. Allow ~half the time budget here. The body-sway investigation eats most of the unscheduled budget.

### Chunk 5 — Polish, contracts codegen, success-criteria validation (Days 13–14)

**Deliverable:** demo-able end-to-end run; contracts codegen replaces hand-written TS mirror; one `teto_overrides.yaml` schema documented; phase-out report on body-sway investigation written.

**Components:**
- `packages/contracts/codegen.sh` — Pydantic → JSON Schema → TS pipeline
- `apps/renderer/src/types/control.ts` — replaced by generated file; old hand-written copy removed
- README updates with run instructions
- Body-sway report: which driver won, or why head-only ships and what was tried
- Crash recovery snapshot — **deferred** unless time remains

**Acceptance:** clean clone → `pnpm install && python -m venv ... && pnpm dev` → all six §14 criteria pass.

### Build-order rationale

The chunks form a **strict-dependency chain**: each chunk's acceptance test exercises and validates everything before it. This is intentional — the skeleton's whole purpose is end-to-end validation, so the build order *is* the validation order. Skipping or reordering means a later chunk has more failure modes to debug at once.

The most failure-prone chunk is #4 (compositor + VTS) because it's the unique work and the body-sway investigation is open-ended. Loading it last means earlier chunks' failures are decoupled from compositor confusion.

---

## 9. Architectural Patterns (Validated)

### Pattern 1: Decorator-chained streaming pipeline (orchestrator)

**What:** The conversation pipeline is `sentence_divider → actions_extractor → tts_filter → TTSTaskManager`, each decorating an async iterator that yields refined `SentenceOutput` objects.

**When to use:** any token-streamed transformation where each stage needs to see complete-units (sentences, not raw tokens) and downstream stages need progressively-more-structured data.

**Why for skeleton:** lifted directly from OLVT — proven to work, plumbing fixes can copy back. The OLVT pattern is a known-good shape.

```python
async def pipeline(token_stream):
    async for sentence in sentence_divider(token_stream):
        async for tagged in actions_extractor(sentence):
            async for filtered in tts_filter(tagged):
                yield filtered
```

### Pattern 2: 60 Hz mixer with driver layers (compositor)

**What:** Multiple `Driver` objects each contribute a `dict[str, float]` of param contributions per frame; the mixer merges them (later layers can override or sum) and emits a single `ParamFrame`.

**When to use:** real-time animation systems where multiple independent signals (idle, speech, intent, UI) need to coexist on the same continuous output.

**Trade-offs:** mixer-merge semantics matter (sum vs override vs blend) — the skeleton's choice is **last-write-wins per param ID**, except for blink which sums. Document in `compositor/core.py`.

### Pattern 3: Strategy interface for the speech driver

**What:** `SpeechDriver` Protocol; multiple implementations registered; one selected via env var/settings. See §6.

**When to use:** when the right algorithm is empirically unknown and the code wants to keep the alternatives runnable rather than deleted-after-failed-attempt.

### Pattern 4: Single source of truth for cross-language types

**What:** Pydantic-first contracts in `packages/contracts/schemas/`; codegen produces TS via JSON Schema intermediate.

**When to use:** any cross-process boundary where Python and TS need the same wire format and you'd rather not write the schema twice.

---

## 10. Anti-Patterns (To Avoid)

### Anti-Pattern 1: Renderer abstraction in v1

**What people do:** Build `IRenderer` interface with VTS and Pixi implementations, declaring "we'll use Pixi later."

**Why it's wrong:** the brief is explicit — **VTS is the whole-MVP renderer**; Pixi is post-MVP exploratory and may be abandoned. Building an abstraction for a second backend that may never ship is YAGNI taken to its purest form.

**Do this instead:** build the ~30 LOC ParamID resolver (§7) and call it done. The non-VTS branch is a `NotImplementedError`, not a stub implementation.

### Anti-Pattern 2: Putting the avatar canvas in the renderer process

**What people do:** Add Pixi/Three.js/canvas-based Live2D code to the React renderer because "it's an avatar app, the avatar should be in the UI."

**Why it's wrong:** v1 uses VTS as the renderer. VTS is its own native window. Our renderer doesn't draw the avatar — it just hosts a transparent overlay for cursor-tracking events.

**Do this instead:** the React renderer's `CursorTracker.tsx` is a `<div>` with `onMouseMove`. The avatar window is whatever VTS shows. If the user wants pet mode (deferred), that's an Electron BrowserWindow concern (transparent + always-on-top), not a renderer-canvas concern.

### Anti-Pattern 3: Inheriting OLVT's broken IN-twin physics-chain assumption

**What people do:** Port OLVT Phase 4's `ParamAngleXIN` body-sway code verbatim, see no body sway, conclude "the rig is broken."

**Why it's wrong:** the rig isn't broken — the assumption that physics chains forward `ParamAngleXIN` to `ParamBodyAngleX` is rig-specific and was wrong for Teto. Silently inheriting a broken assumption masks the real architectural question.

**Do this instead:** keep the physics-chain driver as one strategy among several (§6); document in `decisions log` why it doesn't work on Teto; investigate alternatives in parallel.

### Anti-Pattern 4: Compositor frames going through the renderer process

**What people do:** sidecar sends `param-frame` WS messages to the renderer 60×/sec, renderer forwards to VTS via electron IPC.

**Why it's wrong:** unnecessary process-boundary cross at 60 Hz. The renderer doesn't render the avatar — VTS does. The sidecar can talk to VTS directly via pyvts.

**Do this instead:** sidecar talks to VTS directly. `param-frame` WS messages to renderer are *debug-only*, sent at lower rate (or off in production). The renderer only originates UI-event traffic (cursor, hotkey, text input).

### Anti-Pattern 5: WebSocket connection management without reconnection

**What people do:** open one WS, never plan for sidecar restart.

**Why it's wrong:** sidecar will crash during dev (it's the most-modified code). Renderer needs to reconnect or the dev loop is "kill electron, restart everything" every iteration.

**Do this instead:** WS client in renderer reconnects with backoff; sidecar `[READY]` line in stdout signals "safe to (re)connect"; Electron main forwards new URL via IPC.

---

## 11. Integration Points

### 11.1 External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| VTube Studio | WebSocket plugin API via pyvts (`ws://localhost:8001`) | First connect requires user-grant in VTS popup; pyvts handles auth-state persistence per [pyvts docs](https://genteki.github.io/pyvts/). High-frequency `InjectParameterDataRequest` is the documented mechanism for 60 Hz writes — [VTS API confirms parameters need re-sending at minimum 1 Hz to retain control](https://github.com/DenchiSoft/VTubeStudio), so our 60 Hz cadence is well within range. |
| LM Studio | HTTP via LiteLLM → `http://localhost:1234/v1` (OpenAI-compatible) | Connection test on first launch; retry+backoff on failure (§13.32) |
| piper TTS | subprocess or library binding (piper-python or piper CLI invocation) | Local, fast, ONNX. RMS envelope computed from synthesized PCM in `tts/features.py`. |

### 11.2 Internal boundaries (skeleton scope)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Electron main ↔ Electron renderer | Chromium IPC (typed channels via preload contextBridge) | One channel: `getSidecarUrl`; one event: `hotkeyFired` |
| Electron renderer ↔ Python sidecar | WebSocket localhost (typed `WSMessage` envelopes) | Bidirectional; reconnects on drop |
| Sidecar orchestrator ↔ compositor | direct in-process method call (`compositor.add_intent`, `compositor.start_speech`) | Same Python process; no async queue needed for skeleton |
| Sidecar compositor ↔ VTS bridge | direct in-process await on `vts_bridge.inject` | pyvts handles WS to VTS internally |
| Sidecar TTS ↔ compositor | RMS envelope passed by reference at `start_speech` | Pre-computed; no streaming RMS in skeleton (post-MVP optimization) |

### 11.3 The boundaries that look fragile

The brief asks where boundaries look fragile. Three flags:

1. **Conversation orchestrator ↔ compositor ↔ TTS queue.** These three components share the temporal domain — sentence N starts speaking, sentence N+1 is synthesizing, intent overlay from sentence N is fading, idle baseline runs always. Naïve coupling causes glitches: speech driver still runs after audio ended; intent overlay decays during the wrong sentence; TTS-N+1's RMS arrives before TTS-N finished playing. **Mitigation:** every sentence carries a `sentence_id`; compositor drivers track `(sentence_id, expected_end_t_ms)`; explicit `stop(sentence_id)` calls when audio playback completes. Renderer's audio player MUST emit `playback_ended` so compositor can stop the right speech driver.

2. **`packages/contracts/` codegen freshness.** If the codegen doesn't run on every Pydantic edit, TS drifts and the WS boundary becomes an untyped string-soup. **Mitigation:** pre-commit hook OR `pnpm dev` includes a watch on `packages/contracts/schemas/*.py`. Skeleton ships hand-written TS that mirrors Pydantic — codegen lands in chunk 5.

3. **VTS auth state.** First connect prompts user for VTS plugin grant. Subsequent connects use a token pyvts stores. If the token is corrupted or VTS resets, the next connect prompts again — which silently fails if the user closed the prompt or VTS isn't focused. **Mitigation:** sidecar logs auth-state changes; renderer surfaces "Avatar disconnected from VTS" via in-app log panel; first-time setup tour can document the grant popup explicitly. Per [pyvts tutorial](https://genteki.github.io/pyvts/toctree2_tutorial.html), the auth-state file path is configurable — checking it into the dev environment as part of the README setup helps avoid surprise re-prompts.

---

## 12. Scaling Considerations

This is a single-user local app, not a service. "Scale" here means *use-case scale*, not user count.

| Scale | Architecture adjustments |
|-------|--------------------------|
| Skeleton (1 user, 1 avatar, 1 thread) | as designed; in-memory only |
| Memory milestone (1 user, 1 avatar, multi-thread + Chroma) | adds `memory/` subsystem; orchestrator builds prompt from RAG retrieval |
| Multi-avatar milestone (1 user, N avatars) | per-avatar Chroma collection; avatar-switch flushes compositor state; each avatar has its own override file |
| Agent milestone (everything above + screen control) | adds permission controller as gate before agent actions; goal-loop runs in tray-aware Electron main |

### Scaling priorities for the skeleton specifically

1. **First bottleneck: WS message volume at 60 Hz.** If the renderer subscribes to `param-frame` for debug, that's 60 messages/sec just from compositor. Mitigation: `param-frame` is opt-in via dev flag; compositor talks directly to VTS.
2. **Second bottleneck: piper synth latency.** First-sentence-synth-time is the perceived latency. Mitigation: warm piper at sidecar startup (synth a silent token); cache frequent prefixes if needed (skeleton: don't bother).
3. **Third bottleneck: VTS rate limiting.** [Per VTS API docs, parameters retain plugin control by re-sending at least once per second](https://github.com/DenchiSoft/VTubeStudio); our 60 Hz is comfortable. Mitigation in skeleton: none needed.

---

## 13. Sources

### Locked design (source of truth)
- [PROJECT_DESIGN.md §4 Architecture](../../PROJECT_DESIGN.md) — high-level shape
- [PROJECT_DESIGN.md §5 Component Breakdown](../../PROJECT_DESIGN.md) — module responsibilities
- [PROJECT_DESIGN.md §5.3.1 VTS Rig Architecture Realities](../../PROJECT_DESIGN.md) — orphan/IN-twin/physics-chain failure modes
- [PROJECT_DESIGN.md §6 Data Contracts](../../PROJECT_DESIGN.md) — wire formats
- [PROJECT_DESIGN.md §11 Live2D Approach](../../PROJECT_DESIGN.md) — three-layer separation
- [PROJECT_DESIGN.md §13 Decisions Log](../../PROJECT_DESIGN.md) — 123 locked decisions
- [PROJECT_DESIGN.md §14 Walking Skeleton scope](../../PROJECT_DESIGN.md) — success criteria
- [.planning/PROJECT.md](../PROJECT.md) — Active list (skeleton scope)

### Validation sources (HIGH confidence — official)
- [VTubeStudio API GitHub (DenchiSoft)](https://github.com/DenchiSoft/VTubeStudio) — `InjectParameterDataRequest` rate limits and parameter constraints
- [pyvts documentation](https://genteki.github.io/pyvts/) — Python client library
- [FastAPI WebSockets official docs](https://fastapi.tiangolo.com/advanced/websockets/) — server-side WS pattern
- [datamodel-code-generator GitHub](https://github.com/koxudaxi/datamodel-code-generator) — direction confirmation (JSON Schema → Pydantic, not the reverse)

### Ecosystem context (MEDIUM confidence — community)
- [Open-LLM-VTuber System Architecture (DeepWiki)](https://deepwiki.com/Open-LLM-VTuber/Open-LLM-VTuber/3-system-architecture) — confirms `_route_message()` typed-JSON shape we're matching
- [Building Lightning-Fast AI Backends with FastAPI 2026 Edition](https://nerdleveltech.com/building-lightning-fast-ai-backends-with-fastapi-2026-edition) — current FastAPI WS conventions
- [Live2D Cubism Editor Manual — Physics Settings](https://docs.live2d.com/en/cubism-editor-manual/physical-operation-setting/) — input → output param chain semantics relevant to body-sway investigation
- [Strategy pattern (Refactoring.Guru)](https://refactoring.guru/design-patterns/strategy) — design pattern reference for §6 speech-driver investigation

### Cautionary sources (LOW confidence — single source / inferred)
- [Uvicorn child-process orphaning issue](https://github.com/Kludex/uvicorn/issues/2289) — informs sidecar lifecycle; specific Uvicorn-version-dependent behavior, treat as "be aware" not "always true"

---

*Architecture research for: AgenticLLMVTuber walking-skeleton (PROJECT_DESIGN.md §14)*
*Researched: 2026-05-06*
