# Stack Research

**Domain:** Local-first desktop AI companion app (Electron + React + Python sidecar; VTube Studio Live2D rendering; LLM gateway; opt-in computer-use agent)
**Researched:** 2026-05-06
**Confidence:** HIGH for runtime/build versions; MEDIUM for the VTS+pyvts axis (pyvts unmaintained since 2024-09; VTS Cubism 5.3 SDK still in flux); HIGH for alternatives positioning.

> **Reading note for the roadmapper.** PROJECT_DESIGN.md §13 locks 28 rounds of stack decisions (123 numbered resolutions). This file does **not** re-litigate them — it (a) pins the *current 2026 versions* of every locked choice, (b) documents the alternatives that were rejected so future-self knows what was considered, (c) flags a small number of choices that have *aged* since the design was written. Aged items are called out explicitly in §"Aged Decisions Worth Re-Reading" near the end.

---

## Recommended Stack

### Core Technologies

| Technology | Version (May 2026) | Purpose | Why Recommended |
|------------|---------------------|---------|-----------------|
| **Electron** | **40.x** (stable since 2026-01-13; 40/39/38 in support window) | Desktop shell, native windowing, sidecar process lifecycle | TS-end-to-end for a TS-fluent team; Chromium-bundled means Live2D canvas/WebGL "just works" identically across OS; OLVT also targets Electron-class shells, easing protocol reuse. §13.1 locked. |
| **electron-vite** | **5.0.x** | Build tooling for Electron (main / preload / renderer all under one Vite config) | Mainstream 2026 Electron+React+Vite scaffolding. Avoids bespoke Vite-glue in `vite.config.ts`. Cleaner alternative to rolling our own dual-config setup, less heavyweight than Electron Forge's Vite template (still marked experimental). |
| **electron-builder** | **25.x** | Packaging + (optional) auto-update server protocol | Mature, signs Windows/macOS, the de-facto choice for non-Forge Electron pipelines. We ship "notify-only" updates (§13.44) so we use the update *channel* without auto-install. |
| **React** | **19.2.x** (latest 19.2.5; React 19 stable since Dec 2024; recommended for prod since Jan 2026) | SPA framework | Mainstream, recruitable. React 19 brings the compiler + Actions, both relevant later for streaming chat UI and agent panel. **Pin to 19.2.1+** — earlier 19.0/19.1 had a Server-Components RCE; we're on the client and unaffected, but pinning current keeps audit clean. |
| **Vite** | **6.x** (current LTS line; v8 with Rolldown shipped 2026-03-12 but is brand new — see §"Aged Decisions") | Renderer bundler | Standard for React + TS in 2026. Sub-second HMR, ESM-native. Vite 6 stays the safe choice for the walking-skeleton; v8/Rolldown can land in a follow-up milestone. |
| **TypeScript** | **5.7.x** | All Electron + React code | Locked by §13.1 ("TS-end-to-end"). |
| **Node.js** | **22.x LTS** (Active LTS through 2026; Node 24 LTS lands Oct 2026) | Electron's runtime + dev toolchain | Electron 40 bundles Node 22; matching dev-time prevents native-module ABI mismatches. |
| **Python** | **3.12.x** (3.13 stable but ecosystem still consolidating ML wheels; 3.12 is the safest sidecar floor) | Sidecar runtime | OLVT pipeline is Python; faster-whisper/chromadb/onnxruntime/pyvts all have wheels for 3.12. Avoid 3.13 until faster-whisper / silero-vad / chromadb wheel parity is checked at packaging time. |
| **FastAPI** | **0.136.1** (latest as of 2026-04-23; requires Python 3.10+) | WebSocket protocol surface (localhost-only) | Locked §13.8. WebSocket support is built-in via Starlette. Sentence-pipeline streams + agent-panel updates fit FastAPI's streaming model cleanly. |
| **Uvicorn** | **0.46.0** (released 2026-04-23) | ASGI server hosting FastAPI | The default and most-tested ASGI server for FastAPI. Single-worker is correct for our single-user, in-process state. |
| **websockets** | **14.x** | Uvicorn's WS protocol implementation (one of three options; the other two are `wsproto` and `websockets-sansio`) | Default and most-battle-tested. No need to override unless we hit an edge case. |
| **LiteLLM** | **1.83.14** (stable as of 2026-04-26; v1.83.14-stable.patch.1 = 2026-05-04) | Unified LLM gateway (LM Studio default; OpenAI/Anthropic/Gemini/custom-OpenAI-compat) | Locked §5.5. Native Anthropic prompt-caching pass-through (§13.117). System-proxy honored via httpx (§5.5). **Use the v1.83-stable line specifically** — there was a March 2026 supply-chain incident; v1.83.0 introduced the v2 CI/CD pipeline that fixed it, so anything on the v1.83.x stable line is on the post-incident pipeline. |
| **httpx** | **0.28.x** | HTTP transport for LiteLLM + any direct provider calls | Honors `HTTPS_PROXY` / OS proxy settings out of the box (§5.5, §13.90). |
| **VTube Studio (external)** | **1.32.71** (current stable) — API version `"1.0"` | Live2D rendering pipe (user runs separately) | Locked §11. API spec at github.com/DenchiSoft/VTubeStudio. **Cubism 5.3 caveat:** as of 2026, VTS does not yet support Cubism 5.3 because Live2D Inc.'s Cubism 5.3 Unity SDK is still in early-beta with a URP rewrite that broke a previous VTS implementation attempt (scrapped December 2025). For our project this means: target Cubism 4 / 5.0–5.2 rigs only in the walking skeleton. Default avatar (Live2D Inc. sample, §13.123) is well within Cubism 4 range. |
| **pyvts** | **0.3.3** (released **2024-09-10**) — see ⚠ flag below | Python WS client to VTS API | Locked §11. **⚠ AGED:** no commits or releases since 2024-09 (~20 months stale at the time of this research). API version `"1.0"` has been stable so the client still works, but we should be ready to either fork-and-patch or write our own thin pyvts replacement if VTS bumps API to `2.0` or if we hit bugs. See "Aged Decisions" + "What NOT to Use" sections below. |
| **piper-tts** | **1.4.2** (released 2026-04-02; Python ≥3.9) | Local ONNX TTS backend (default) | Locked §13.28. Low-latency local synthesis, RMS envelope is trivially extractable for the speech driver (§5.6). Note: there are two distinct PyPI packages — **`piper-tts`** (main) and **`piper-onnx`** (smaller wrapper, ONNX-only). For us, `piper-tts` is the right pick because we want VITS+ONNX in one package and we don't need the wrapper layer. |

### Supporting Libraries

| Library | Version (May 2026) | Purpose | When to Use |
|---------|---------------------|---------|-------------|
| **chromadb** | **1.5.8 / 1.5.9** (released ~2026-05-05; 1.x line stable since 2024) | Embedded vector store for episodic memory + shared user-facts bucket | Whole memory subsystem (§5.4, §8). Embedded mode means zero service to run. |
| **sentence-transformers** | **5.3.x** (latest line in 2026 with new loss functions, hardness weighting) | Local embedding model loader for `bge-small-en` / `multilingual-e5-small` | Memory layer 2/3. Pin embedder choice in `model.yaml`; default `bge-small-en-v1.5` for English-primary use, switch to `multilingual-e5-small` if user's first avatar is non-English. |
| **rank_bm25** | **0.2.2** (stable, low-maintenance — last release was a few years ago, but the algorithm is complete) | BM25 lexical retrieval over the same chunks Chroma indexes | Hybrid retrieval (§5.4, §13.81). Pair with hand-rolled RRF (~30 LOC); standard 2026 pattern is exactly this. **Acceptable to ship on 0.2.2 — no behavioral CVEs, code is small, audit-able.** Alternative (`bm25s`) is also fine; rank_bm25 is in the design doc so stick with it. |
| **faster-whisper** | **1.2.1** | ASR (when voice input lands; out of skeleton scope) | §5.6 / §12.3. Default model size `small` (~244 MB) per §13.101. Skeleton ships text-only; this is here for the next milestone. |
| **silero-vad** | **6.2.1** (Python 3.12 wheels available) | Voice-activity detection | §12 VAD; skeleton is text-only so this lands in the voice milestone. ONNX-runtime backed; deterministic. |
| **pysbd** | **0.3.4** | Sentence segmentation in the OLVT pipeline | `sentence_divider` decorator (§5.1). OLVT-direct port. |
| **pyautogui** | **0.9.54** (stable; aging) + **PyDirectInput** for game/DirectX scenarios + **pywinauto** for native Windows controls | Mouse/keyboard for screen-control sub-agent | §5.7 ScreenControlSubAgent. Modern 2026 advice is **pynput first** for cross-platform low-level events; fall back to PyDirectInput for DirectX-only games (Genshin daily check-in) where pyautogui's SendInput path silently no-ops. Skeleton doesn't need any of this (agent OOS) — pin the choice in the agent-runtime milestone. |
| **mss** | **9.0.x** | Cross-platform screenshots | §5.7. Stable, fast. Skeleton OOS. |
| **OmniParser-v2** | **v2.0** (2025-02 release; **NOT superseded** in 2026) | Screen → labeled bbox list for click targeting | §5.7. v2 cut latency 60% over v1 (~0.6s/frame on A100, 0.8s on 4090). Skeleton OOS. |
| **claude-agent-sdk** | **0.1.73** (Python; released 2026-05-04; Python ≥3.10) | Computer-use sub-agent runtime + Claude Code CLI bundled | §5.7 + §13.3. **The package this design wants is `claude-agent-sdk`, NOT `claude-code-sdk`** (the latter was renamed/superseded; PyPI page warns to migrate). **Critical:** Opus 4.7 (claude-opus-4-7) requires Agent SDK ≥ 0.2.111 — but as of May 2026 the latest published version is **0.1.73**, so the design's "Opus 4.7" assumption needs a wait-or-pin call when this milestone lands. |
| **APScheduler** | **3.11.2.post1** (3.x is the current line — APScheduler 4 is **not yet released** as of May 2026) | Cron scheduler for saved goals | §5.7, §13.72. Skeleton OOS. **Heads-up:** the design doc casually mentions "APScheduler" — pin to 3.11.x explicitly; if APScheduler 4 lands during the agent-runtime milestone, that's a separate evaluation. |
| **watchdog** | **5.x** | Filesystem watch in Python sidecar (profile hot-reload) | §5.11. Skeleton's `teto_overrides.yaml` stub doesn't strictly need it but it costs nothing to wire. |
| **chokidar** | **3.6.x** (or **4.x** if pure-Node-native is acceptable) | Filesystem watch in Electron main | §5.11. Renderer-side reload notifications. |
| **electron-store** | **10.x** | Window pos/size, last avatar, theme persistence | §13.40. Stable, JSON-on-disk, no schema engine — fine for our scope. |
| **rank_bm25 + RRF (hand-rolled)** | n/a (~30 LOC) | Reciprocal rank fusion of vector + BM25 results | §13.81. The 2026 standard pattern; multiple production guides confirm this is the simplest correct hybrid retrieval. |
| **pyvts replacement candidate (FUTURE)** | n/a | If pyvts proves too aged, fork or write a thin asyncio WS client | The VTS API spec is ~30 message types with stable schemas; a from-scratch client is ~400 LOC. Don't pre-emptively replace — only if pyvts blocks us. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** (recommended) **OR npm** | JS package manager | **For the Electron+React+Vite combo, npm is the safer default in 2026.** pnpm is faster but its symlinked `node_modules` confuses electron-builder and asar packaging unless you set `node-linker=hoisted` in `.npmrc`. The dev-velocity gain isn't worth the packaging-time debugging for a single-engineer skeleton. Switch to pnpm post-MVP if monorepo splits become useful. |
| **uv** | Python package manager + venv + lockfile | **Strong recommend for 2026.** 10-100× faster than pip; one tool replaces pip+virtualenv+pyenv; lockfile is real. Astral's stewardship of Rye is folding into uv. The walking skeleton's "sidecar runs from venv" line in §14 should be a `uv venv` + `uv pip install -r requirements.txt` (or `uv sync` against `pyproject.toml`). Skeleton does not depend on this — pip works — but uv is the no-regrets pick. |
| **Ruff** | Python linter + formatter | Mainstream 2026 Python lint stack. Replaces flake8/black/isort. |
| **ESLint + Prettier** | TS/React lint + format | Standard. Use the official `@typescript-eslint` config + React plugins. |
| **datamodel-code-generator** | Generate TS types from Python pydantic / dataclass contracts | §6 codegen seam. Generates Python pydantic well; **TS generation is limited** in this tool. If we want TS types from the same source, the practical approach is: define the contracts as JSON Schema or OpenAPI, generate Python with datamodel-code-generator and TS with `quicktype` or `json-schema-to-typescript`. Or hand-write the TS surface — there are only ~10 contracts in §6. **Recommendation for skeleton: hand-write the TS contracts, document the source-of-truth-is-Python rule, defer codegen until contracts churn.** |
| **PyInstaller** | Sidecar binary packaging (deferred to post-skeleton milestone) | §13.31. PyOxidizer is the Rust-based alternative, smaller binaries but worse handling of native deps (onnxruntime, sentence-transformers C extensions). PyInstaller's binary-deps story is the reason it stays the default. Briefcase is also viable but PyInstaller has more mind-share for Python sidecars inside Electron. **Skeleton runs Python from venv (§14); PyInstaller is the next milestone.** |

---

## Installation

```bash
# ─── Project bootstrap (Electron + React + Vite scaffold) ───────────
npm create @quick-start/electron@latest agentic-llm-vtuber -- --template react-ts
# Or manually scaffold from electron-vite if preferred:
#   npm create electron-vite@latest

cd agentic-llm-vtuber

# ─── Renderer / shell deps ──────────────────────────────────────────
npm install react@^19.2 react-dom@^19.2
npm install electron-store@^10
npm install chokidar@^3.6

# Dev deps
npm install -D electron@^40 electron-vite@^5 electron-builder@^25
npm install -D vite@^6 typescript@^5.7
npm install -D @types/react@^19 @types/react-dom@^19
npm install -D eslint prettier @typescript-eslint/eslint-plugin

# ─── Python sidecar (use uv, not pip) ───────────────────────────────
cd sidecar  # or wherever the Python lives

# Initialize project
uv init
uv python pin 3.12

# Core
uv add fastapi==0.136.1 uvicorn==0.46.0 websockets
uv add httpx
uv add litellm==1.83.14
uv add pyvts==0.3.3                 # ⚠ stale package — see notes
uv add piper-tts==1.4.2
uv add pysbd

# Memory layer (skeleton-deferred but pin now to lock the surface)
uv add chromadb==1.5.8
uv add sentence-transformers
uv add rank-bm25

# Voice/agent layer (skeleton-deferred — pin during the agent milestone)
# uv add faster-whisper==1.2.1
# uv add silero-vad==6.2.1
# uv add pyautogui mss
# uv add claude-agent-sdk
# uv add apscheduler==3.11.2.post1
# uv add watchdog
# (and OmniParser-v2 from its repo or via the Microsoft model artifact)

# Dev deps
uv add --dev ruff pytest
```

---

## Alternatives Considered

| Recommended | Alternative | When the Alternative Wins |
|-------------|-------------|---------------------------|
| **Electron** | **Tauri 2.x** | When bundle size is a release-blocker (Tauri ~5–10 MB vs Electron ~150 MB) AND the team is Rust-fluent. Per §13.1, this lost on language-end-to-end-TS for our team. Stays a viable v2 swap if size matters later. |
| **Electron** | **Wails (Go)** | When the team is Go-fluent and bundle size matters. Uses WebView2 instead of bundled Chromium → smaller. We're TS-fluent so this loses on the same axis as Tauri. |
| **Electron** | **Neutralino** | When app is essentially a static HTML/CSS/JS toy with very narrow OS hooks. Loses for us because we need persistent local sidecar lifecycle, system tray, click-through window, and global hotkeys — all of which Neutralino is thin on. |
| **electron-vite** | **Electron Forge + Vite template** | When you want one tool to handle *both* dev and packaging and you don't mind that the Vite template is still marked experimental. Forge's makers/publishers are nicer than electron-builder for some flows. We pick electron-vite because it's pure dev-tooling and lets electron-builder handle packaging — clearer separation. |
| **electron-vite** | **Manually wired Vite + Electron** | When you want zero opinionated scaffolding. Costs ~100 lines of glue per project. Not worth it for a single-engineer 2-week skeleton. |
| **React** | Solid.js / Vue 3 / Svelte 5 | Solid is genuinely faster but we're TS-fluent in React-land. Vue and Svelte have smaller bundles but recruitability and OLVT-renderer-portability lean React. |
| **Vite 6** | **Vite 8 + Rolldown** | Vite 8 (released 2026-03-12) ships Rolldown as a unified Rust-based bundler — 10–30× faster builds. We pick Vite 6 for the skeleton because it's only 2 months old and we don't need its perf gain. **Migrate after walking skeleton ships and any plugin-compat issues are public knowledge.** |
| **Python sidecar (FastAPI)** | **Node sidecar / pure-Node backend** | When OLVT pipeline reuse isn't a goal and you want zero process boundary. We have OLVT pipeline reuse as a hard goal (§13.8), so Python wins. |
| **uv** | **pip + venv** | When you literally only need `pip install`. uv is strictly better for any team that values speed, lockfiles, or Python-version management. The walking skeleton doesn't need uv but won't regret using it. |
| **uv** | **Poetry / Rye / pdm** | Poetry is venerable but slow and noisy. Rye is being absorbed into uv (Astral). pdm is fine but smaller community. uv has the momentum in 2026. |
| **npm** | **pnpm** | When you have a monorepo with shared deps. Costs Electron-packaging debugging unless `.npmrc` `node-linker=hoisted` is set. Stay on npm for the walking skeleton; revisit if multi-package layout emerges. |
| **LiteLLM** | **LangChain LLM clients / direct OpenAI SDK / direct Anthropic SDK** | Direct SDKs win when you're committed to a single provider and want maximum surface area (e.g., Anthropic's batches API). LiteLLM wins for our "OpenAI-compatible to LM Studio + 4 cloud providers in a dropdown" goal. |
| **chromadb** | **lancedb / qdrant / faiss** | LanceDB is the next-gen choice if Chroma's perf disappoints (§7 already flags this). Qdrant is service-shaped (we want embedded). FAISS is bare-bones (we want metadata + filtering). chromadb is the cheapest path to "works"; swap to lancedb if a memory milestone surfaces real perf issues. |
| **VTS + pyvts** | **live2d-py (EasyLive2D)** | Genuinely interesting option in 2026: actively maintained, supports model loading + lipsync + click test, OpenGL-based. Could render Live2D in our Electron renderer without VTS as an external process. **But** it does not solve the §5.3.1 routing problem (VTS rigs need IN-twin routing or `<model>.vtube.json` parsing); using live2d-py means re-implementing what VTS does internally. Stays a v1.5 / v2 candidate alongside pixi-live2d-display, not a v1 swap. |
| **VTS + pyvts** | **pixi-live2d-display** | Already the v1.5 plan per the design. Note: maintenance has slowed (no Cubism 5 support, last meaningful update older than a year); the actively-maintained fork is **`pixi-live2d-display-advanced`** (PixiJS v7-compatible). Pixi remains a future mobile-portability hedge per §11. |
| **VTS + pyvts** | **Native Cubism Web SDK** | Deferred per §11. License needs review for distribution; runtime is freely usable for personal/non-commercial. Mobile path. |
| **piper** | **edge-tts** / **GPT-SoVITS** / **ComfyUI** | All three are already on the post-skeleton roadmap (§5.6). edge-tts is online-free natural voices; SoVITS is voice-clone (user runs the service); ComfyUI is graph-based for advanced users. Skeleton ships piper-only. |
| **claude-agent-sdk** | **Direct Anthropic SDK + ReAct loop** | The DIY path mentioned in §5.7. Wins if you need fine control over the agent loop or want to swap the LLM provider for the agent specifically. Loses on tool-use scaffolding being already-written. Design's call: SDK for v1 with DIY swap-interface preserved. |
| **claude-code (subprocess)** | **OpenInterpreter** | OpenInterpreter is the offline fallback per §5.7 / §7. Actively maintained in 2026 (recent updates April 2026). Use claude-code online; OpenInterpreter offline. |
| **Tavily (web search)** | **Brave Search API / Exa.ai / Perplexity Sonar** | Tavily was acquired by Nebius in Feb 2026 → roadmap/pricing uncertainty. Brave benchmarks slightly higher (14.89 vs ~14 score in Aimultiple's 2026 agentic-search benchmark) and has independent index. Exa.ai is the semantic-search winner. **For the agent-runtime milestone, treat Tavily as one option among several rather than the chosen one** — even though §7 names Tavily, the post-acquisition uncertainty earns this a re-decision when the milestone lands. |
| **APScheduler 3.x** | **APScheduler 4 / `croniter` + custom loop** | APScheduler 4 isn't released yet. Custom loop is fine if you outgrow APScheduler's job-store complexity, but for our scope (a few user-saved cron jobs) 3.x is overkill in the *good* direction. |
| **datamodel-code-generator** | **Hand-written TS contracts** | Recommended for the skeleton — only ~10 contracts in §6, churn is low until milestone-2. Codegen earns its keep when contracts grow past ~50 types. |
| **PyInstaller** | **PyOxidizer / Briefcase / Nuitka** | PyOxidizer makes smaller binaries but worse handling of native deps (onnxruntime in particular). Briefcase is BeeWare's option; mature enough but smaller community for sidecar-inside-Electron. Nuitka compiles Python to C — fastest but slowest to build and the deps story is fragile. Stay on PyInstaller. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`claude-code-sdk` (the older PyPI name)** | Renamed and deprecated; PyPI page itself directs migration | **`claude-agent-sdk`** |
| **PyAutoGUI alone for game automation** | DirectX games (anti-cheat or otherwise) ignore PyAutoGUI's `keybd_event`-style input | **PyDirectInput** for DirectX game scenarios; **pynput** for general modern input; PyAutoGUI is fine for non-game GUI |
| **pixi-live2d-display (original `guansss/pixi-live2d-display`) for new work** | No longer maintained; only Cubism 4 and below; no Cubism 5 path | **`pixi-live2d-display-advanced`** (active fork, PixiJS v7-compatible) — but only if/when the v1.5 Pixi exploration starts. Stay on VTS+pyvts for v1. |
| **Live2D Cubism 5.3 rigs in the walking skeleton** | VTS 1.32.71 does not yet support Cubism 5.3 (Live2D Inc.'s 5.3 Unity SDK is mid-rewrite to URP; an earlier VTS attempt was scrapped Dec 2025; Cubism 5.3 ETA from VTS dev is "sometime this year [2026]") | **Cubism 4.x or 5.0–5.2 rigs only.** Default Live2D Inc. sample (Hiyori/Mark/Wanderer, §13.123) is fine. Teto (dev-only) is fine. Document this limit so the avatar-import milestone validates rig versions on import. |
| **Vite 7 / Vite 8 in the walking skeleton** | Vite 8 is only 2 months old (released 2026-03-12); Rolldown is brand new; plugin-compatibility regressions surface in months 2-4 of a major | **Vite 6.x.** Migrate after skeleton ships and Rolldown ecosystem has a few months of bake. |
| **pnpm with Electron (without `.npmrc node-linker=hoisted`)** | pnpm's symlinked `node_modules` breaks electron-builder's asar packaging in subtle ways | **npm** for the skeleton; pnpm with `node-linker=hoisted` is fine if you specifically need it |
| **Python 3.13 for the sidecar (early 2026)** | Some ML wheels (faster-whisper, silero-vad, parts of the chromadb dep tree) lag 1–2 minor versions on new Python releases | **Python 3.12.x.** Re-evaluate at the voice-input milestone. |
| **Native Anthropic SDK directly for the conversation pipeline** | Locks the conversation provider to Anthropic; design explicitly wants LiteLLM as the single client (§5.5) | **LiteLLM.** Direct Anthropic SDK is acceptable *only* inside the agent runtime if claude-agent-sdk insists on it (which it does — and that's fine because the agent is intentionally Claude-coupled per §5.7). |
| **Wake-word libraries (Picovoice, Snowboy, openWakeWord)** | Explicitly out of scope per §13.45 / round-10 | Raw VAD via silero-vad. |
| **LangChain for orchestration** | Heavyweight; the conversation pipeline is OLVT-direct (sentence_divider → actions_extractor → tts_filter → TTS queue) and does not benefit from LangChain abstractions | Hand-rolled decorator pipeline (already in OLVT codebase). |
| **Zep / Letta / MemGPT for memory** | Heavier than needed; locks you into their schemas (§8 explicitly rejects these) | Hybrid Chroma + rank_bm25 + RRF, ~150 LOC. |

---

## Stack Patterns by Variant

**If the team grows past one engineer:**
- Switch JS package manager to **pnpm** with `.npmrc node-linker=hoisted`
- Move `packages/contracts/` to a real monorepo (Turborepo or pnpm workspaces)
- Add **datamodel-code-generator** for the contract→TS pipeline

**If bundle size becomes a release-blocker:**
- Re-evaluate **Tauri 2.x** — would require a TS→Rust learning curve for shell code
- Or strip unused Chromium features via Electron's `disable_features` plumbing — usually a 30-50 MB win without the rewrite

**If pyvts proves blocking (bug, missing API method, or VTS bumps to API 2.0):**
- Fork pyvts (it's MIT-licensed, ~1000 LOC) and patch in-tree as `vendor/pyvts/`
- Or write a thin asyncio replacement (~400 LOC for the message types we use: auth, model load, parameter inject, hotkey trigger, expression activate)

**If the user is strongly multilingual-first (Japanese avatar primary):**
- Embed with **`multilingual-e5-small`** instead of `bge-small-en-v1.5`
- Default piper voice to a Japanese voice model (piper has trained JP voices)
- ASR: faster-whisper `medium` instead of `small` (voice milestone) — the JP→EN ratio in `small` is weaker

**If LM Studio is replaced as default by Ollama or vLLM:**
- LiteLLM handles all three uniformly via OpenAI-compatible endpoint — no code change
- Update the LLM-setup screen's "default URL" copy and the suggested-providers list

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Electron 40.x | Node 22.x ABI | Don't mix with Node 24 in dev — native modules will need rebuilds |
| Python 3.12 | All sidecar deps current as of May 2026 | Re-verify at voice-input milestone (3.13 wheel parity) |
| FastAPI 0.136.1 | Uvicorn 0.46.0, websockets 14.x | Standard stack; no known issues |
| LiteLLM 1.83.14 | claude-agent-sdk 0.1.73 | Both clients can coexist; LiteLLM for conversation, claude-agent-sdk for agent — they don't share state |
| pyvts 0.3.3 | VTS API "1.0", VTS app 1.32.71 | Holding stable; pyvts 0.3.3 was published 2024-09-10 against API 1.0 and the API hasn't bumped |
| chromadb 1.5.x | sentence-transformers 5.x | Pin embedder model in `model.yaml`; chromadb does not enforce dimensionality compatibility, you do |
| React 19.2.x | Vite 6.x, electron-vite 5.x | Pin React ≥19.2.1 to dodge the SCS RCE in 19.0/19.1 (we're client-only but pin for audit) |
| piper-tts 1.4.2 | Python 3.9–3.13 | Skeleton uses 3.12; piper has 3.12 wheels |
| Cubism rig version | VTube Studio 1.32.71 | Cubism 4.x and 5.0–5.2 supported; **Cubism 5.3 NOT yet supported** (mid-2026 ETA from VTS) |

---

## Aged Decisions Worth Re-Reading

These are stack choices in PROJECT_DESIGN.md that have *aged* since the design was written. None invalidate the design's locked decisions; all are flagged so the roadmapper can decide whether to revisit them at a milestone boundary.

1. **pyvts staleness (HIGH attention).** pyvts 0.3.3 has been the latest release since September 2024. The library *works* — VTS API hasn't bumped — but if a bug surfaces during the speech-driver-body-sway investigation (R-OPEN-1) or the import-pipeline milestone, we won't get an upstream fix. **Mitigation:** treat pyvts as vendored from day 1 (copy into `sidecar/vendor/pyvts/` and patch in-tree if needed). Don't pre-emptively replace.

2. **Tavily acquisition (MEDIUM attention, agent-runtime milestone only).** Tavily was acquired by Nebius in February 2026; PROJECT_DESIGN.md §7 still names Tavily as the web-search choice. By the time the agent-runtime milestone starts, evaluate **Brave Search API** (independent index, slightly better benchmark, $5/1000 reqs) and **Exa.ai** (semantic search) as alternatives. Skeleton-irrelevant.

3. **Cubism 5.3 timing (MEDIUM attention, avatar-import milestone).** Cubism 5.3 rigs are starting to appear in the wild; VTS doesn't support them yet (URP rewrite is mid-flight). The skeleton is fine because the dev avatar (Teto) and shipping default (Live2D Inc. sample) are pre-5.3. The avatar-import milestone needs to detect Cubism version on import and refuse 5.3 rigs with a helpful message until VTS catches up.

4. **APScheduler 4 (LOW attention).** §5.7 / §13.72 mentions APScheduler without a version. APScheduler 4 isn't released as of May 2026 — pin to 3.11.x. If 4.0 lands during the goal-scheduler milestone, separately evaluate.

5. **OmniParser-v2 status (LOW attention, agent-runtime milestone).** §7 names OmniParser v2; v2 is still current and *not* superseded as of May 2026. No action needed; flagging because the design predates the v2.0 stability check.

6. **Vite version drift (LOW attention).** §7 doesn't pin a Vite version; design doc was likely written assuming Vite 5 (current at the time). 2026 reality is Vite 6 is stable and Vite 8 is brand new. Pin Vite 6 in the skeleton. Migrate to Vite 8 + Rolldown post-skeleton if the build perf matters.

7. **Anthropic SDK / Claude Agent SDK naming (LOW attention).** The design doc says "Anthropic Claude Agent SDK" (§7); the actual PyPI package is **`claude-agent-sdk`** (formerly `claude-code-sdk`, deprecated). Roadmapper should ensure phase research uses the current package name.

---

## Sources

### Authoritative (HIGH confidence)
- [Electron Releases (releases.electronjs.org)](https://releases.electronjs.org/) — Electron 40 stable on 2026-01-13; 38/39/40 in support window
- [Electron Timelines (electronjs.org)](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) — Verified Electron 40 active stable
- [React 19 release post (react.dev)](https://react.dev/blog/2024/12/05/react-19) — React 19 stable Dec 2024
- [React versions (react.dev/versions)](https://react.dev/versions) — 19.2.5 latest as of April 2026
- [Vite blog: Vite 6.0 announcement](https://vite.dev/blog/announcing-vite6) — Vite 6 stable late 2024
- [Vite changelog](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md) — Vite 8.0.0 released 2026-03-12 with Rolldown
- [FastAPI Release Notes (fastapi.tiangolo.com)](https://fastapi.tiangolo.com/release-notes/) — 0.136.1 on 2026-04-23
- [Uvicorn (uvicorn.dev)](https://uvicorn.dev/) — 0.46.0 on 2026-04-23
- [LiteLLM Release Notes (docs.litellm.ai)](https://docs.litellm.ai/release_notes) — 1.83.14 stable on 2026-04-26; v1.83.14-stable.patch.1 on 2026-05-04
- [LiteLLM Security Update March 2026](https://docs.litellm.ai/blog/security-update-march-2026) — confirms v1.83.x is the post-incident stable line
- [pyvts on PyPI](https://pypi.org/project/pyvts/) — 0.3.3 published 2024-09-10 (verified via WebFetch)
- [pyvts releases on GitHub (Genteki/pyvts)](https://github.com/Genteki/pyvts/releases) — no commits or releases in 2025–2026 (verified via WebFetch)
- [piper-tts on PyPI](https://pypi.org/project/piper-tts/) — 1.4.2 on 2026-04-02
- [chromadb on PyPI](https://pypi.org/project/chromadb/) — 1.5.8/1.5.9 May 2026
- [faster-whisper on PyPI](https://pypi.org/project/faster-whisper/) — 1.2.1
- [silero-vad on PyPI](https://pypi.org/project/silero-vad/) — 6.2.1
- [Claude Agent SDK PyPI](https://pypi.org/project/claude-agent-sdk/) — 0.1.73 on 2026-05-04
- [Claude Agent SDK GitHub releases](https://github.com/anthropics/claude-agent-sdk-python/releases) — Python ≥3.10; Opus 4.7 needs ≥0.2.111
- [VTubeStudio API GitHub (DenchiSoft/VTubeStudio)](https://github.com/DenchiSoft/VTubeStudio) — API version "1.0"; min refresh 1Hz; no documented max rate (verified via WebFetch)
- [VTube Studio Cubism 5.3 status (X/Twitter @VTubeStudio)](https://x.com/VTubeStudio/status/1960590322120941752) — Cubism 5.3 unsupported, URP rewrite ongoing
- [OmniParser-v2 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/omniparser-v2-turning-any-llm-into-a-computer-use-agent/) — v2 current as of 2025-02; not superseded
- [Astral uv docs (docs.astral.sh/uv)](https://docs.astral.sh/uv/) — uv as the 2026 Python package-manager consensus

### Ecosystem (MEDIUM confidence — multiple sources agree)
- [pnpm vs npm 2026 comparison (DevToolReviews)](https://www.devtoolreviews.com/reviews/pnpm-vs-npm-vs-yarn-2026-comparison) — pnpm fastest; Electron caveat documented
- [Why npm not pnpm for Electron+React+Vite (dev.to/yurirxmos)](https://dev.to/yurirxmos/why-you-should-use-npm-and-not-pnpm-yet-to-build-electron-react-vite-tailwind-apps-4oc9) — Electron-builder + pnpm symlink issues
- [PyAutoGUI alternatives in 2026 (slashdot)](https://slashdot.org/software/p/PyAutoGUI/alternatives) — pynput / PyDirectInput / pywinauto positioning
- [Best Open-Source Embedding Models in 2026 (BentoML)](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models) — bge-small / multilingual-e5 still standard
- [Tavily alternatives (firecrawl.dev)](https://www.firecrawl.dev/blog/tavily-alternatives) — Brave / Exa positioning post-Nebius acquisition
- [Hybrid Search with BM25 + RRF (multiple 2026 articles)](https://glaforge.dev/posts/2026/02/10/advanced-rag-understanding-reciprocal-rank-fusion-in-hybrid-search/) — RRF is the 2026 standard hybrid pattern
- [Wails / Neutralino vs Electron 2026 (pkgpulse.com)](https://www.pkgpulse.com/blog/best-desktop-app-frameworks-2026) — bundle-size comparison
- [Best Python Package Managers 2026 (scopir.com)](https://scopir.com/posts/best-python-package-managers-2026/) — uv consensus
- [pixi-live2d-display maintenance status (multiple)](https://github.com/guansss/pixi-live2d-display) — original is stale; pixi-live2d-display-advanced is the active fork

### Confidence summary
- **HIGH:** Electron, React, Vite, FastAPI, Uvicorn, LiteLLM, piper-tts, chromadb, faster-whisper, silero-vad, claude-agent-sdk version pins (all verified via PyPI / official changelogs)
- **HIGH:** pyvts is 0.3.3 from 2024-09-10 with no 2025/26 activity (WebFetch-verified GitHub + PyPI)
- **HIGH:** VTS API "1.0" stable; Cubism 5.3 not supported (WebFetch-verified GitHub wiki + dev's own statements)
- **MEDIUM:** package-manager and Tauri/Wails positioning (multiple ecosystem articles agree, but article-quality varies)
- **MEDIUM:** datamodel-code-generator TS-output limitations (one detailed source + library author's own discussion)

---

*Stack research for: AgenticLLMVTuber walking-skeleton + downstream milestones*
*Researched: 2026-05-06*
