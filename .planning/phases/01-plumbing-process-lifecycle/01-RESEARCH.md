# Phase 1: Plumbing & Process Lifecycle — Research

**Researched:** 2026-05-06
**Domain:** Electron 40 + electron-vite 5 monorepo bootstrap; Python 3.12 sidecar (FastAPI/uvicorn) lifecycle on Windows; OLVT-shape WebSocket envelope; Electron `safeStorage` credential gate; LiteLLM 1.83 LM-Studio 1-token completion test; uv local-path vendor of pyvts 0.3.3
**Confidence:** HIGH on stack pins, OLVT envelope shape, LiteLLM exception surface, uv path-source syntax, electron-vite project layout. MEDIUM on the exact stdout READY-line plumbing across electron-vite 5's main-process stdio piping (no canonical doc). LOW on no items — every Phase 1 facet has at least one HIGH-confidence source verified during this research session.

## Summary

Phase 1 is the project's bootstrap phase — every component is greenfield. The good news is that Phase 1 sits squarely on a well-documented stack: Electron 40 + electron-vite 5 + React 19.2 + Vite 6 + Python 3.12 + FastAPI 0.136 + uvicorn 0.46 + LiteLLM 1.83. Each pin was verified against PyPI / official changelogs during the project research synthesis (2026-05-06) and re-verified for Phase 1 specifics during this session (electron-vite directory layout, LiteLLM exception surface, uv `[tool.uv.sources]` path syntax). The 60-Hz compositor lives in Phase 4; Phase 1's protocol surface is `client-message` text in → `server-response` echo text out, demonstrating the OLVT envelope (`{type, ...payload-fields}` flat shape, NOT a wrapped `{type, payload}` object — verified via OLVT's `_route_message`).

The single most consequential choice the planner needs to lock is **how the renderer discovers the sidecar's ephemeral port**. CONTEXT.md picks `port:0` + stdout `[READY]` line; this research confirms the standard 2026 pattern is to bind your own socket and pass it to uvicorn (`uvicorn.Server(config).run(sockets=[sock])`), then call `sock.getsockname()[1]` to read back the bound port. Uvicorn does not expose its bound socket cleanly otherwise. The READY line is then `print("[READY] ws://127.0.0.1:%d/ws" % port, flush=True)` BEFORE `await server.serve()` enters the accept loop — otherwise Electron may parse the line and connect before uvicorn is ready. This sequencing is the single non-obvious correctness point.

**Primary recommendation:** Scaffold via `npm create @quick-start/electron@latest` with `--template react-ts`, then refactor the resulting `src/main/`, `src/preload/`, `src/renderer/` into the monorepo's `apps/electron-main/`, `apps/electron-main/preload/`, `apps/renderer/` per CONTEXT.md D-Discretion. Sidecar pyproject lives at `sidecar/pyproject.toml` with `[tool.uv.sources] pyvts = { path = "vendor/pyvts" }`. Renderer stays on hand-written TS contracts in `packages/contracts/ts/` mirroring `packages/contracts/py/` Pydantic — codegen lands in Phase 5 per SC-02.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### pyvts vendoring (PLUMB-05)

- **D-01: Vendor mechanism — plain copy + PROVENANCE.md.** Copy the upstream snapshot into `sidecar/vendor/pyvts/`, commit a `sidecar/vendor/pyvts/PROVENANCE.md` recording upstream commit SHA, license (MIT), and any patches we apply. No git subtree / submodule juggling.
- **D-02: Snapshot — pin to PyPI v0.3.3 release (2024-09-10).** Reproducible; matches what `uv add pyvts==0.3.3` would have resolved. Avoids drift if Genteki/pyvts later bumps HEAD with unreleased changes.
- **D-03: Import path — uv local-path source.** `pyproject.toml` declares `[tool.uv.sources] pyvts = { path = "sidecar/vendor/pyvts" }` so `import pyvts` works the same in dev, CI, and packaged builds. No `sys.path` manipulation; lockfile-aware; IDE/type-checker friendly.
- **D-04: Patch policy — in-tree edits with PROVENANCE.md log.** When bugs surface (Phase 4 will hit pyvts open issue #51), edit the vendored files directly and append a patch entry to PROVENANCE.md (purpose + diff summary). Upstream is dormant, so adapter-wrapper indirection has no payoff worth the file overhead.
- **D-05: Phase 1 scope is import-only.** Success criterion #5 is satisfied by `import pyvts` succeeding without contacting VTS. The single-writer asyncio wrapper (AVT-04) is Phase 4's deliverable, not Phase 1's — do not pre-build it here.

#### LLM setup screen (PLUMB-04, LLM-01)

- **D-06: Provider dropdown scope — LM Studio + Custom OpenAI-compatible (working) + OpenAI / Anthropic / Gemini (grayed-out stubs).** The two LLM-01 providers are fully functional. The three hosted providers appear in the dropdown but are disabled with a "Coming in v2" tooltip — sets expectations in UI, costs no LiteLLM wiring, but the disabled-state CSS + tooltip copy are now part of Phase 1's UI surface.
- **D-07: Credential storage — Electron `safeStorage` (DPAPI-encrypted on Windows).** Built into Electron 40; no native module rebuild burden. Linux without a keyring drops to plaintext (acceptable per OS-isolation stance). The `electron-store` package stays for non-secret state (window pos, last avatar, theme — per CLAUDE.md). Provider URL + API key + model name + the `hasCompletedSetup` flag all go through safeStorage.
- **D-08: Test-connection UI — verbose log panel during test.** Show step-by-step status to the user with `▸ Resolving URL...`, `▸ Sending 1-token completion...`, `✓ Received 1 token in 423 ms` lines. On failure, show the LiteLLM error message verbatim. Logs persist in the panel until the user retries — they do not auto-clear. This is a real UI build — design a `<TestLog>` component, not just a status badge.
- **D-09: First-launch unblock criterion — persist `hasCompletedSetup: true` flag in safeStorage after a successful test.** Subsequent launches skip the setup screen and proceed to the chat panel. A "Re-test connection" surface in settings is deferred to v2.
- **D-10: Test-completion contract — real 1-token completion call via LiteLLM.** Locked by PLUMB-04 / SC #3 — `/v1/models` ping is **not** sufficient. Test prompt is fixed (`"hi"`) with `max_tokens=1` to minimize latency.

#### Chrome IA & User Flow (D-11 through D-22)

Locked v1-target chrome architecture. Skeleton **builds the chrome shell + placeholders** (Path 1) so v1 surfaces drop into pre-existing slots without rewrites. Highlights:

- **D-11: Single chat-only window; VTS runs separately.** No transparent overlay window in our app.
- **D-12: 400×700 default, resizable, any aspect ratio, bottom rail always visible.**
- **D-13: Top bar (~32px) + bottom rail (~48px).** UI-SPEC tightened to 36px / 56px.
- **D-14: Status icon format C** — single composite `⬢` icon, worst-of-three color, click expands popover with `[Re-test connection]`.
- **D-15: History slide-in covers chat ~80% width**, dimmed strip dismisses.
- **D-16: Logs drawer entirely hidden when off.** Toggle in Settings → Diagnostics. State persists.
- **D-17: Agent — toggle in top bar (session enable) + tab in bottom rail (manage).** Top-bar toggle is per-session, resets to OFF on app close.
- **D-18: Agent in-chat reporting — portal-card pattern**, Claude-Code-tool-call style, with `[Modify]` inline-expand within card (not modal).
- **D-19: One active agent session at a time.**
- **D-20: Manual goal entry — `[+ New goal]` at top of Sessions list in Agent page.**
- **D-21: Settings — single long scroll, sectioned, 16 sections.** Anchor pills at top.
- **D-22: Skeleton scope — Path 1 (chrome shell + placeholders).** All non-functional surfaces render as branded placeholder copy.

### Claude's Discretion

User chose to defer these to research/planner judgment with documented defaults:

- **Port-allocation strategy (PLUMB-03):** Default per ROADMAP.md is `port:0` ephemeral with stdout `[READY] ws://127.0.0.1:<port>/ws` line that Electron main parses. Planner: lock the exact READY-line regex (proposed `^\[READY\] ws://127\.0\.0\.1:(\d+)/ws$`) and the discovery timeout (proposed 10s; uvicorn typically hits READY in <1s, but cold venv on Windows can be slower).
- **Sidecar lifecycle on Windows (PLUMB-02):** Reasonable defaults that planner should lock —
  - Watchdog: child sidecar polls parent PID every 2s via `psutil.Process(os.getppid()).is_running()` and self-exits if False (Windows has no `prctl(PR_SET_PDEATHSIG)` equivalent).
  - Graceful shutdown: Electron's `before-quit` sends WS `{type:"shutdown"}`; sidecar runs cleanup (close pyvts, flush logs); 5s soft timeout, then `child.kill()`.
  - Crash mid-session: Electron logs the exit code, surfaces a non-blocking renderer toast ("Sidecar crashed — restarting..."), auto-respawns once. Two crashes within 30s → surface a permanent error banner with a "Retry" button.
  - Planner: validate these on a real Windows force-quit test (Task Manager → End Task) per success criterion #2.
- **Reasoning-UI scope in Phase 1's setup-screen test:** Parser-strip-only per ROADMAP.md cross-cutting default. If the test prompt (`"hi"` with `max_tokens=1`) somehow reaches a DeepSeek-R1 distill mid-`<think>`, strip the `<think>` block at the LiteLLM-gateway boundary before showing it in the test-log panel. The chevron-expand UX is UX-01, deferred to v2.
- **Monorepo layout:** Default per research/SUMMARY.md is `apps/electron-main/` + `apps/renderer/` + `sidecar/` + `packages/contracts/`. Phase 1 will create all four directories; `packages/contracts/` ships hand-written Pydantic + hand-mirrored TS in skeleton (codegen replaces the hand-written TS in Phase 5 per SC-02).
- **WS envelope shape:** OLVT-mirror per PLUMB-03. Planner: read OLVT's `_route_message()` and freeze the exact envelope contract (this research has done that for you — see "Architecture Patterns → OLVT WebSocket Envelope" below) into `packages/contracts/py/ws_message.py` + the matching hand-mirrored TS. The echo message becomes the first concrete `WSMessage` subtype that exercises the envelope end-to-end.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1 scope. The reasoning-UI per-message expand chevron (UX-01) was already deferred to v2 in REQUIREMENTS.md before the discuss session and was not re-litigated.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PLUMB-01** | Electron shell (windowed mode only) wraps a React + Vite + TypeScript renderer with TS-end-to-end shell config; npm package manager (not pnpm) | Standard Stack → Electron 40 + electron-vite 5 + React 19.2 + Vite 6 + TS 5.7; Architecture Patterns → "electron-vite scaffold + monorepo refactor" |
| **PLUMB-02** | Electron main spawns a Python sidecar (FastAPI + uvicorn) under a uv-managed venv with eager-start at boot, parent-PID watchdog so the sidecar exits when Electron crashes, and graceful-shutdown handshake on normal close | Architecture Patterns → "Python sidecar lifecycle on Windows" + "Sidecar process spawn from Electron main"; Don't Hand-Roll → child_process spawn vs python-shell |
| **PLUMB-03** | Sidecar exposes a localhost-only WebSocket endpoint whose message envelope shape matches Open-LLM-VTuber's protocol; port-allocation strategy decided at phase-1 planning (`port:0` per CONTEXT.md) | Architecture Patterns → "OLVT WebSocket envelope" (verified `_route_message` shape) + "Ephemeral port:0 binding pattern in FastAPI/uvicorn"; Code Examples → READY-line plumbing |
| **PLUMB-04** | First-launch flow shows a mandatory LLM setup screen (provider URL/key + test-connection round-trip); blocks until a successful 1-token LM Studio completion succeeds; LM Studio default at `http://localhost:1234/v1` is pre-filled | Architecture Patterns → "Electron safeStorage credential pattern" + "LiteLLM 1.83.x LM-Studio test-completion call"; Code Examples → completion call + verbose-log mapping |
| **PLUMB-05** | pyvts vendored into the sidecar from day one (`sidecar/vendor/pyvts/`), with in-tree patches applied as needed without forking the project | Architecture Patterns → "uv local-path source for vendored pyvts" + "PROVENANCE.md template"; Don't Hand-Roll → vendor copy vs git subtree |
</phase_requirements>

## Standard Stack

### Core (verified pins, May 2026)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 40.x | Desktop shell + sidecar lifecycle owner | Active stable since 2026-01-13; bundles Node 22 LTS (matches our dev Node). Locked §13.1. |
| electron-vite | 5.0.x | Build tooling for Electron+React+Vite (main + preload + renderer in one config) | The 2026 mainstream Electron+React+Vite scaffold. Cleaner than rolling Vite glue; less heavyweight than Forge's Vite template. |
| `@quick-start/electron` (scaffolder) | latest (npm-create) | One-shot project bootstrapper | `npm create @quick-start/electron@latest <name> -- --template react-ts` produces electron-vite + React + TS + electron-builder + @electron-toolkit/utils + ESLint + Prettier in one shot. |
| electron-builder | 25.x | Packaging (deferred to Phase 5 / post-skeleton; `npm run dev` only in Phase 1) | De-facto Electron pipeline; Phase 1 doesn't ship installers. |
| React | 19.2.1 minimum, 19.2.5 latest | Renderer SPA framework | React 19 stable since Dec 2024. **Pin ≥19.2.1** to dodge the SCS RCE in 19.0/19.1 (we're client-only and unaffected, but pin keeps audit clean). |
| Vite | 6.x | Renderer bundler | Vite 8 + Rolldown is 2 months old (2026-03-12 release); Vite 6 stays the safe walking-skeleton choice. |
| TypeScript | 5.7.x | All Electron + React code | Locked §13.1 ("TS-end-to-end"). |
| Node.js | 22.x LTS | Electron's runtime + dev toolchain | Electron 40 bundles Node 22; matching dev-time prevents native-module ABI mismatches. **Verified present:** dev machine has Node 22.19.0. |
| `@electron-toolkit/utils` | latest (ships with quick-start template) | `electronApp.setAppUserModelId()`, `optimizer.watchWindowShortcuts()`, `is.dev` helpers | Eliminates ~50 lines of boilerplate that every Electron+Vite project re-derives. Already a quick-start template dep. |
| `electron-store` | 10.x | Window pos/size, last avatar, theme persistence — NON-SECRET state only | Locked §13.40. JSON-on-disk; no schema engine. **Coexists with safeStorage** — they hold different things (see "Architecture Patterns → State storage split"). |
| Python | 3.12.x | Sidecar runtime | Python 3.13's ML-wheel ecosystem is still consolidating; 3.12 is the safest sidecar floor. **Verified present:** dev machine has cpython-3.12.11 already installed via uv at `~/AppData/Roaming/uv/python/`. `uv python pin 3.12` will pick it up. |
| FastAPI | 0.136.1 | WebSocket protocol surface (localhost-only) | Locked §13.8. WebSocket support via Starlette is built-in; no separate websockets-server lib needed. |
| uvicorn | 0.46.0 | ASGI host for FastAPI | Default + most-tested; single-worker is correct for our single-user, in-process state. |
| websockets | 14.x | Uvicorn's WS protocol implementation | Default + battle-tested; no need to override unless we hit an edge case. |
| LiteLLM | 1.83.14 (or 1.83.x stable line) | LLM gateway for setup-screen 1-token test | Use the v1.83-stable line specifically — March 2026 supply-chain incident; v1.83.0 introduced the v2 CI/CD pipeline that fixed it. **Phase 1 uses LiteLLM only for the test-completion call**, not the full conversation pipeline (Phase 2). |
| httpx | 0.28.x | HTTP transport for LiteLLM | Honors `HTTPS_PROXY` / OS proxy out of the box. |
| pydantic | 2.x (transitively from FastAPI) | `WSMessage` envelope contracts | Pydantic v2 has `model_json_schema()` which the Phase 5 codegen consumes; Phase 1 uses BaseModel for typed dispatch. |
| psutil | 7.x | Sidecar's parent-PID watchdog (`Process(os.getppid()).is_running()`) | Cross-platform; the only correct way to do parent-death detection on Windows. |
| pyvts | 0.3.3 (PyPI 2024-09-10 snapshot, vendored) | VTS WebSocket client — **Phase 1: import-only smoke test** | Locked §11; vendored per CONTEXT.md D-01 through D-05. **Phase 1 only verifies `import pyvts` works**; no auth, no `pyvts.vts.VTS()` connection. |

### Supporting (Phase 1 dev-deps only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/react` | ^19 | TS types for React 19 | Renderer dev-dep; auto-installed by quick-start template. |
| `@types/react-dom` | ^19 | TS types for ReactDOM | Renderer dev-dep. |
| `@vitejs/plugin-react` | ^4 | React Fast Refresh in Vite | Auto-installed by quick-start template. |
| ESLint + Prettier + `@typescript-eslint` | latest | TS/React lint+format | Standard. Already wired by quick-start template. |
| Ruff | latest | Python lint+format (replaces flake8/black/isort) | Mainstream 2026 Python lint stack. |
| pytest | latest | Sidecar test runner | For the echo round-trip integration test (optional in Phase 1; CONTEXT.md doesn't require tests this phase). |

### Alternatives Considered (and why rejected for Phase 1)

| Instead of | Could Use | Why we picked the standard |
|------------|-----------|----------------------------|
| `@quick-start/electron` template | Electron Forge + Vite template | Forge's Vite template is still marked experimental (May 2026). quick-start uses electron-vite directly + electron-builder explicitly — clearer separation. |
| `@quick-start/electron` template | Manual Vite + Electron wiring | ~100 lines of Vite/Electron glue; not worth it for a single-engineer skeleton. |
| `child_process.spawn` | `python-shell` library | python-shell imports the Python interpreter as a Node module → sidecar crash takes Electron down. Spawn-as-real-child is the correct boundary. |
| psutil-based parent-PID watchdog | `prctl(PR_SET_PDEATHSIG)` | Linux/Mac only. We're Windows-primary in dev; psutil polling is the only cross-platform pattern. |
| psutil-based parent-PID watchdog | Job Objects on Windows / detached process groups | Job Objects work but require more native-handle plumbing; psutil polling is 5 lines and works on all three OSes. CONTEXT.md picked this default. |
| Pydantic-first contracts in `packages/contracts/py/` + hand-written TS in `packages/contracts/ts/` | Codegen via `datamodel-code-generator` or `pydantic2ts` from day 1 | Per SC-02, codegen lands in Phase 5. Phase 1 has ~3 message types (`client-message`, `server-response`, `shutdown`); hand-writing the TS mirror is faster than wiring the codegen. |
| Pydantic-first contracts | TS-first with Python mirror | Sidecar is the producer of all interesting state; TS is the consumer. Source-of-truth follows the producer. |
| `npm create @quick-start/electron` | `npm create electron-vite@latest` (the older alias) | quick-start is the actively-maintained scaffolder by the same author (alex8088). The alias may still work; pick quick-start to be unambiguous. |

**Installation (one-shot for the whole monorepo):**

```bash
# 1. Scaffold the Electron app — produces apps/electron-app/ with src/main, src/preload, src/renderer
npm create @quick-start/electron@latest agentic-llm-vtuber -- --template react-ts

# 2. Refactor into monorepo (see Architecture Patterns below for the exact mapping)
#    Result: apps/electron-main/, apps/renderer/, sidecar/, packages/contracts/

# 3. Renderer + main process additions
cd apps/renderer
npm install react@^19.2 react-dom@^19.2
# (electron, electron-vite, electron-builder, vite, ts, eslint, prettier are already dev-deps from the template)

cd apps/electron-main
npm install electron-store@^10
# safeStorage is in Electron core — no install needed

# 4. Sidecar bootstrap
cd ../../sidecar
uv init
uv python pin 3.12
uv add fastapi==0.136.1 uvicorn==0.46.0 websockets pydantic httpx psutil
uv add litellm==1.83.14
# pyvts is vendored; declare via [tool.uv.sources] in pyproject.toml — see "Architecture Patterns → uv local-path source for vendored pyvts"
uv add --dev ruff pytest

# 5. From the monorepo root
npm install   # workspace install picks up apps/* + packages/*
```

**Version verification (run before locking the table):**

```bash
npm view electron version            # expect 40.x
npm view electron-vite version       # expect 5.0.x
npm view react version               # expect 19.2.5
npm view vite version                # expect 6.x latest
npm view electron-store version      # expect 10.x

uv pip install --dry-run fastapi==0.136.1 uvicorn==0.46.0 litellm==1.83.14 pyvts==0.3.3
uv python list | grep 3.12           # confirm 3.12.x available
```

The pins above were verified against PyPI / npm / official changelogs as of 2026-05-06 in `.planning/research/STACK.md`. No drift detected during this Phase 1 research session.

## Architecture Patterns

### Recommended Monorepo Project Structure

The locked CONTEXT.md layout, refined with electron-vite 5's quick-start template conventions:

```
AgenticLLMVTuber/
├── apps/
│   ├── electron-main/                      # TS — process boundary 1
│   │   ├── src/
│   │   │   ├── index.ts                    # app entry; createWindow + whenReady
│   │   │   ├── sidecar.ts                  # spawn + READY-parse + watchdog + IPC bridge
│   │   │   ├── ipc.ts                      # contextBridge channel definitions
│   │   │   └── safe-storage.ts             # provider config + hasCompletedSetup persistence
│   │   ├── preload/
│   │   │   └── index.ts                    # contextBridge.exposeInMainWorld('api', {...})
│   │   ├── electron.vite.config.ts         # main + preload + renderer build targets
│   │   ├── electron-builder.yml            # Phase 5 concern; Phase 1 ships empty stub
│   │   └── package.json
│   ├── renderer/                           # TS + React + Vite — process boundary 1
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx                     # router: setup | chat (chrome shell)
│   │   │   ├── ws/
│   │   │   │   ├── client.ts               # singleton WS connection w/ reconnect
│   │   │   │   └── store.ts                # Zustand store (or React state) fed by WS
│   │   │   ├── screens/
│   │   │   │   ├── LLMSetup/
│   │   │   │   │   ├── LLMSetup.tsx
│   │   │   │   │   ├── TestLog.tsx         # verbose multi-line connection-test panel (D-08)
│   │   │   │   │   └── ProviderSelect.tsx  # 5-option dropdown w/ disabled + tooltip (D-06)
│   │   │   │   └── Chat/
│   │   │   │       └── Chat.tsx            # echo input + display
│   │   │   ├── chrome/                     # D-13 top-bar + bottom-rail components
│   │   │   │   ├── TopBar.tsx
│   │   │   │   ├── BottomRail.tsx
│   │   │   │   ├── StatusIcon.tsx          # composite ⬢ + popover (D-14)
│   │   │   │   ├── HistorySheet.tsx        # slide-in placeholder (D-15)
│   │   │   │   ├── LogsDrawer.tsx          # collapsible (D-16)
│   │   │   │   └── ...
│   │   │   ├── settings/                   # D-21 — 16 sections, all rendered
│   │   │   │   └── Settings.tsx
│   │   │   ├── agent/                      # D-17, D-22 — placeholder copy in Phase 1
│   │   │   │   └── Agent.tsx
│   │   │   └── types/
│   │   │       └── ws-message.ts           # hand-written TS mirror of packages/contracts/py
│   │   ├── index.html
│   │   ├── vite.config.ts                  # (electron-vite manages this via electron.vite.config.ts above)
│   │   └── package.json
│   └── (electron-main/preload is conceptually a third "app" but ships under electron-main/)
├── sidecar/                                # Python — process boundary 2
│   ├── src/sidecar/
│   │   ├── __init__.py
│   │   ├── __main__.py                     # `python -m sidecar` entrypoint
│   │   ├── main.py                         # uvicorn launch; READY-line print; watchdog start
│   │   ├── ws/
│   │   │   ├── server.py                   # FastAPI app + /ws endpoint
│   │   │   ├── protocol.py                 # WSMessage dispatcher mirrors OLVT _route_message
│   │   │   └── handlers.py                 # echo handler ("client-message" → "server-response")
│   │   ├── llm/
│   │   │   └── setup_test.py               # 1-token completion call for /admin/llm-test
│   │   ├── lifecycle/
│   │   │   └── watchdog.py                 # 2s poll on os.getppid()
│   │   └── contracts/                      # alias re-export of packages/contracts/py
│   ├── vendor/
│   │   └── pyvts/                          # VENDORED — copy of pyvts 0.3.3 from PyPI
│   │       ├── __init__.py
│   │       ├── vts.py
│   │       ├── ...
│   │       └── PROVENANCE.md               # SHA + license + patch log (template below)
│   ├── tests/
│   │   └── test_echo_roundtrip.py          # Phase 1 integration test (optional)
│   └── pyproject.toml                      # [tool.uv.sources] pyvts = { path = "vendor/pyvts" }
├── packages/
│   └── contracts/
│       ├── py/
│       │   ├── __init__.py
│       │   └── ws_message.py               # Pydantic source-of-truth
│       └── ts/
│           └── ws-message.ts               # hand-written mirror (codegen replaces in Phase 5 SC-02)
├── avatars/
│   └── teto/
│       └── teto_overrides.yaml             # AVT-07 stub — empty in Phase 1, populated in Phase 4
├── package.json                            # workspace root (npm workspaces)
├── package-lock.json
├── CLAUDE.md
├── PROJECT_DESIGN.md
├── README.md
└── .planning/
```

**Key clarifications about this layout:**

1. **Why `apps/electron-main/` holds both `src/` and `preload/`.** electron-vite 5's `electron.vite.config.ts` declares three build targets — `main`, `preload`, `renderer` — pointing at three separate source trees. The quick-start template puts them at `src/main/`, `src/preload/`, `src/renderer/` inside one project. We're splitting the renderer into a sibling app (`apps/renderer/`) but keeping main + preload colocated since the preload script is logically part of the main-process boundary (it's what main exposes to renderer via `contextBridge`). This costs one electron-vite config edit (point the renderer target at `../renderer/src/main.tsx` instead of `./src/renderer/`).
2. **Sidecar is a Python project, not a Node workspace.** npm workspaces tolerate non-Node directories — they're just listed as `apps/*` and `sidecar/` won't have a `package.json`. This is fine; Electron main's spawn uses an absolute path resolved from `process.cwd()` or `app.getAppPath()`.
3. **`packages/contracts/py/` and `packages/contracts/ts/` are sibling subdirectories**, not a single package — there's no Pydantic↔TS auto-generation in Phase 1. The sidecar's `pyproject.toml` adds `packages/contracts/py` as a dev path-source so `from contracts.ws_message import WSMessage` works. The renderer imports `../../packages/contracts/ts/ws-message.ts` directly via a TS path alias.
4. **`avatars/teto/teto_overrides.yaml` is created in Phase 1** even though AVT-07 is a Phase 4 deliverable. CONTEXT.md doesn't mandate this — but the schema stub costs one file and AVT-07 explicitly says ship-the-schema-from-skeleton. The planner's call whether to land it in Phase 1 plan 01-01 or punt to Phase 4 04-00.

### Pattern: electron-vite 5 quick-start scaffold then refactor (PLUMB-01)

**What:** Use `npm create @quick-start/electron@latest agentic-llm-vtuber -- --template react-ts` to produce a working baseline, then move files into the monorepo layout.

**When:** Phase 1 plan 01-01, first task. The scaffold gives you correct `electron.vite.config.ts`, `electron-builder.yml`, `package.json`, ESLint+Prettier configs, and `tsconfig.{json,node.json,web.json}` triplet — all of which are tedious to derive from scratch.

**Default scaffold output (verified via the `alex8088/quick-start` repo):**

```
agentic-llm-vtuber/
├── .vscode/
├── build/                       # icon assets for electron-builder
├── resources/                   # static assets bundled into app
├── src/
│   ├── main/
│   │   └── index.ts             # app.whenReady() + createWindow() — ~70 LOC starter
│   ├── preload/
│   │   └── index.ts             # contextBridge.exposeInMainWorld('api', { ... })
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           └── env.d.ts
├── electron.vite.config.ts      # 3 build targets: main, preload, renderer
├── electron-builder.yml
├── package.json                 # scripts: dev, build:win/mac/linux, format, lint
├── tsconfig.json
├── tsconfig.node.json           # main + preload (Node ESM)
├── tsconfig.web.json            # renderer (DOM)
├── eslint.config.mjs
└── .prettierrc.yaml
```

**`package.json` scripts the template provides** (paraphrased — verify after scaffold):

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "build:win": "electron-vite build && electron-builder --win",
    "build:mac": "electron-vite build && electron-builder --mac",
    "build:linux": "electron-vite build && electron-builder --linux",
    "format": "prettier --write .",
    "lint": "eslint . --ext .ts,.tsx --fix"
  }
}
```

**Refactor steps for the monorepo:**

1. `mv src/main → apps/electron-main/src/`
2. `mv src/preload → apps/electron-main/preload/`
3. `mv src/renderer → apps/renderer/src/` (drop the inner `src/` nesting; flatten one level)
4. Edit `electron.vite.config.ts` so `renderer.root` points at `apps/renderer/`
5. Move `electron.vite.config.ts`, `electron-builder.yml`, `tsconfig.node.json` to `apps/electron-main/`
6. Move `tsconfig.web.json` to `apps/renderer/`
7. Promote root `package.json` to a workspace manifest (`"workspaces": ["apps/*", "packages/*"]`)
8. Each `apps/*` gets its own `package.json` declaring the deps relevant to it

**Acceptance:** `npm run dev` from the monorepo root invokes `electron-vite dev` in `apps/electron-main/` and Electron boots with the renderer served from `apps/renderer/`.

**Sources:** [electron-vite getting started](https://electron-vite.org/guide/), [@quick-start/electron-react-ts template tree](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/react-ts) — directory structure verified via WebFetch this session.

### Pattern: Python sidecar lifecycle on Windows (PLUMB-02)

**What:** Electron main spawns the sidecar as a real child process, parses a `[READY] ws://127.0.0.1:<port>/ws` line from stdout to discover the bound port, and the sidecar runs a parent-PID poll loop that self-exits if Electron dies.

**Spawn pattern (TypeScript, in `apps/electron-main/src/sidecar.ts`):**

```typescript
import { spawn, ChildProcess } from 'node:child_process'
import { app } from 'electron'
import * as path from 'node:path'

const READY_RE = /^\[READY\] (ws:\/\/127\.0\.0\.1:(\d+)\/ws)$/
const READY_TIMEOUT_MS = 10_000  // CONTEXT.md "Claude's Discretion" default

interface SidecarHandle {
  child: ChildProcess
  wsUrl: string
  port: number
}

export async function spawnSidecar(): Promise<SidecarHandle> {
  const sidecarRoot = path.join(app.getAppPath(), '..', '..', 'sidecar')
  // dev: invoke uv-managed venv. packaged build (Phase 5): bundled python or PyInstaller.
  const child = spawn('uv', ['run', 'python', '-m', 'sidecar'], {
    cwd: sidecarRoot,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },  // critical — line-buffer stdout
    stdio: ['ignore', 'pipe', 'pipe'],
    // detached: false on Windows (intentional — we want job-object-style parent attachment)
  })

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Sidecar did not emit [READY] within ${READY_TIMEOUT_MS}ms`))
    }, READY_TIMEOUT_MS)

    child.stdout!.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split('\n')) {
        const m = line.trim().match(READY_RE)
        if (m) {
          clearTimeout(timer)
          resolve({ child, wsUrl: m[1], port: Number(m[2]) })
        }
        // forward all stdout to renderer's logs drawer via IPC
        // (don't dispatch in this tight loop — debounce in production)
      }
    })

    child.stderr!.on('data', (chunk) => {
      // forward stderr too; LiteLLM and uvicorn warnings land here
    })

    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      // if exited before READY, reject; otherwise this is a crash event handled elsewhere
    })
  })
}
```

**Sidecar entrypoint (Python, in `sidecar/src/sidecar/main.py`):**

```python
import asyncio
import os
import socket
import sys
import psutil
import uvicorn
from .ws.server import app  # FastAPI instance


async def parent_watchdog(parent_pid: int, poll_interval: float = 2.0) -> None:
    """Self-terminate if Electron parent dies. Windows has no PR_SET_PDEATHSIG."""
    while True:
        await asyncio.sleep(poll_interval)
        try:
            if not psutil.pid_exists(parent_pid):
                # Parent gone. Exit immediately — don't await graceful shutdown,
                # we're orphaned and there's no one to receive a goodbye.
                os._exit(0)
            # Edge case: PID reuse. Verify parent is still our parent.
            current_ppid = os.getppid()
            if current_ppid != parent_pid:
                # We've been re-parented (POSIX: to init/PID 1; Windows: to ???)
                # On Windows, if the original parent died, getppid() returns the
                # original PID indefinitely (cached). So we rely on pid_exists().
                # On POSIX, current_ppid != original is a definite orphan signal.
                os._exit(0)
        except (psutil.NoSuchProcess, ProcessLookupError):
            os._exit(0)


def main() -> None:
    parent_pid = os.getppid()

    # Bind ephemeral socket so we can read the chosen port back BEFORE serving.
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]

    # Emit READY line BEFORE uvicorn enters the accept loop.
    # flush=True is critical — Electron's stdout reader will hang otherwise.
    print(f"[READY] ws://127.0.0.1:{port}/ws", flush=True)

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
        # We provide our own socket; uvicorn won't try to re-bind.
    )
    server = uvicorn.Server(config)

    async def runner() -> None:
        watchdog_task = asyncio.create_task(parent_watchdog(parent_pid))
        try:
            await server.serve(sockets=[sock])
        finally:
            watchdog_task.cancel()

    asyncio.run(runner())


if __name__ == "__main__":
    main()
```

**Critical correctness points (do not deviate without thinking hard):**

1. **`PYTHONUNBUFFERED=1` in the spawn env** — without this, Python may line-buffer stdout in pipe mode, and Electron's READY-line parser hangs.
2. **`print(..., flush=True)` BEFORE `await server.serve()`** — otherwise the renderer can connect before uvicorn starts accepting connections. This is the #1 race condition in port:0 plumbing.
3. **`pid_exists(parent_pid)` not just `getppid() != parent_pid`** — on Windows, `getppid()` returns the *cached* parent PID even after the parent dies. `psutil.pid_exists()` is the authoritative check.
4. **2s watchdog poll, not faster** — psutil polling is cheap but not free; 2s is the CONTEXT.md default and gives plausible Windows-Task-Manager → relaunch latency without hammering the OS.
5. **`os._exit(0)` not `sys.exit()`** — when orphaned, we want immediate termination; `sys.exit()` runs cleanup which may include WS-shutdown waits that no one is listening for.

**Graceful shutdown (the happy path, when Electron exits normally):**

- Electron's `app.before-quit` handler:
  1. Send `{"type": "shutdown"}` over the WS
  2. Set a 5-second timer
  3. If sidecar's exit event fires before the timer → all good
  4. Otherwise call `child.kill()` (SIGTERM on POSIX, hard-kill equivalent on Windows)

- Sidecar's `shutdown` WS handler:
  1. Cancel the watchdog task
  2. Run any registered cleanup hooks (Phase 4: pyvts close)
  3. `server.should_exit = True` to make uvicorn drain
  4. Process exits within ~100ms

**Crash mid-session (auto-respawn + circuit breaker):**

- Electron main tracks `(crashTimestamps: number[])`
- On `child.exit` with non-zero code:
  - If `crashTimestamps.filter(t => Date.now() - t < 30_000).length >= 2` (i.e., this is the 3rd crash in 30s) → surface permanent banner, do not respawn, expose `[Restart]` button
  - Otherwise: append timestamp, respawn after 1s backoff, surface non-blocking toast

**Sources:** [psutil 7.x docs](https://psutil.readthedocs.io/), [FastAPI port discussion #14783](https://github.com/fastapi/fastapi/discussions/14783) (confirms the "bring your own socket" pattern is the only reliable way to know the bound port), CONTEXT.md "Claude's Discretion → Sidecar lifecycle on Windows".

### Pattern: OLVT WebSocket envelope (PLUMB-03)

**What:** Match OLVT's `_route_message()` shape so any plumbing fixes Open-LLM-VTuber publishes can be backported with minimal diff.

**OLVT envelope shape (verified this session via WebFetch of `websocket_handler.py`):**

OLVT uses a **flat-fields-with-required-`type`** envelope, NOT a nested `{type, payload}` object. The `type` field is required; everything else is optional and message-type-specific. From `_route_message`:

```python
async def _route_message(self, websocket: WebSocket, client_uid: str,
                        data: WSMessage) -> None:
    msg_type = data.get("type")
    handler = self._message_handlers.get(msg_type)
    if handler:
        await handler(websocket, client_uid, data)
```

**OLVT's `WSMessage` TypedDict fields** (verified):

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `type` | ✅ | `str` | The dispatch key |
| `action` | ❌ | `str` | Optional sub-operation specifier |
| `text` | ❌ | `str` | Text content (used by `text-input`, `display-text`, etc.) |
| `audio` | ❌ | `list[float]` | Float array for raw-audio messages |
| `images` | ❌ | `list[str]` | Base64-encoded image strings |
| `history_uid` | ❌ | `str` | Thread identifier |
| `file` | ❌ | `str` | Filename for fetch/load operations |
| `display_text` | ❌ | `dict` | Structured display metadata |
| (passthrough) | ❌ | `dict[str, Any]` | Additional fields like `invitee_uid`, `target_uid` accepted untyped |

**OLVT's full `_message_handlers` registry (20 types verified):**

`add-client-to-group`, `remove-client-from-group`, `request-group-info`, `fetch-history-list`, `fetch-and-set-history`, `create-new-history`, `delete-history`, `interrupt-signal`, `mic-audio-data`, `mic-audio-end`, `raw-audio-data`, `text-input`, `ai-speak-signal`, `fetch-configs`, `switch-config`, `fetch-backgrounds`, `audio-play-start`, `request-init-config`, `heartbeat`, `frontend-playback-complete`.

**Phase 1's WSMessage subset (3 types only):**

| Type | Direction | Fields | Phase 1 Purpose |
|------|-----------|--------|-----------------|
| `text-input` | client → server | `text: str` | The "hello" the user types in the chat input |
| `display-text` | server → client | `text: str` (echo of input prefixed with `"echo: "`) | The "echo: hello" the renderer renders |
| `shutdown` | client → server | (none) | Sent by Electron main on `app.before-quit` |

**Why these names specifically:**
- `text-input` is OLVT's name verbatim — Phase 2 will use the same type for the real LLM input
- `display-text` is OLVT's name verbatim — Phase 2 will use the same type for sentence-streamed display
- `shutdown` is our name (OLVT doesn't use the WS for shutdown — but our process boundary needs it)

**Pydantic source-of-truth (`packages/contracts/py/ws_message.py`):**

```python
from pydantic import BaseModel, Field
from typing import Literal, Optional, Union, Annotated

# OLVT-mirror: flat fields, type as discriminator. Pydantic v2's
# discriminated unions handle this idiomatically.

class TextInputMessage(BaseModel):
    type: Literal["text-input"] = "text-input"
    text: str

class DisplayTextMessage(BaseModel):
    type: Literal["display-text"] = "display-text"
    text: str

class ShutdownMessage(BaseModel):
    type: Literal["shutdown"] = "shutdown"

WSMessage = Annotated[
    Union[TextInputMessage, DisplayTextMessage, ShutdownMessage],
    Field(discriminator="type")
]
```

**Hand-written TS mirror (`packages/contracts/ts/ws-message.ts`):**

```typescript
// Hand-written mirror of packages/contracts/py/ws_message.py.
// Codegen replaces this in Phase 5 (SC-02). Pydantic is source-of-truth.

export interface TextInputMessage {
  type: 'text-input'
  text: string
}

export interface DisplayTextMessage {
  type: 'display-text'
  text: string
}

export interface ShutdownMessage {
  type: 'shutdown'
}

export type WSMessage = TextInputMessage | DisplayTextMessage | ShutdownMessage

// Type guards
export const isTextInput = (m: WSMessage): m is TextInputMessage => m.type === 'text-input'
export const isDisplayText = (m: WSMessage): m is DisplayTextMessage => m.type === 'display-text'
```

**Sidecar dispatcher (`sidecar/src/sidecar/ws/protocol.py`):**

```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Callable, Awaitable, Any
from contracts.ws_message import WSMessage

Handler = Callable[[WebSocket, dict[str, Any]], Awaitable[None]]
_handlers: dict[str, Handler] = {}

def on(msg_type: str) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        _handlers[msg_type] = fn
        return fn
    return deco

async def route(websocket: WebSocket, raw: dict[str, Any]) -> None:
    """Mirror of OLVT's _route_message — dispatch on `type` field."""
    msg_type = raw.get("type")
    if not msg_type:
        # Drop silently or log; OLVT's behavior is silent drop.
        return
    handler = _handlers.get(msg_type)
    if handler is None:
        # OLVT logs unknown types and ignores. Match.
        return
    await handler(websocket, raw)
```

**Phase 1 echo handler (`sidecar/src/sidecar/ws/handlers.py`):**

```python
from .protocol import on
from fastapi import WebSocket
from contracts.ws_message import DisplayTextMessage

@on("text-input")
async def handle_text_input(ws: WebSocket, msg: dict) -> None:
    text = msg.get("text", "")
    reply = DisplayTextMessage(text=f"echo: {text}")
    await ws.send_json(reply.model_dump())

@on("shutdown")
async def handle_shutdown(ws: WebSocket, msg: dict) -> None:
    # Caller (main.py) is responsible for setting server.should_exit.
    # Here we just acknowledge.
    pass
```

**Sources:** OLVT `websocket_handler.py` source verified via WebFetch this session (envelope shape + 20-type registry confirmed). [Open-LLM-VTuber DeepWiki — System Architecture](https://deepwiki.com/Open-LLM-VTuber/Open-LLM-VTuber/3-system-architecture).

### Pattern: port:0 ephemeral binding in FastAPI/uvicorn (PLUMB-03)

**What:** Bind a Python socket explicitly to `("127.0.0.1", 0)`, read the OS-assigned port back via `getsockname()[1]`, then pass the socket to `uvicorn.Server.serve(sockets=[...])`. This is the only reliable way to know the bound port — uvicorn does not expose its internal socket otherwise.

**Why not just call `uvicorn.run(host="127.0.0.1", port=0)` and read it back from `server.servers`?** The `Server.servers` collection is populated only after the accept loop starts running, so there's a race window between `serve()` returning a started state and the renderer attempting to connect. Bringing your own socket eliminates the race entirely.

**Implementation:** see "Sidecar entrypoint" code block under "Python sidecar lifecycle on Windows" above.

**READY-line regex (locked):** `^\[READY\] ws://127\.0\.0\.1:(\d+)/ws$`

**Discovery timeout (locked):** 10s. Empirically uvicorn hits READY in <1s on a warm venv. Cold venv on Windows + first-run uv-resolve can be 3-5s. 10s leaves margin.

**Sources:** [FastAPI Discussion #14783 — How Uvicorn Listens on an Open Port](https://github.com/fastapi/fastapi/discussions/14783), [Uvicorn Settings docs](https://uvicorn.dev/settings/).

### Pattern: Electron `safeStorage` credential gate (PLUMB-04, D-07, D-09)

**What:** Use Electron's built-in `safeStorage` (DPAPI on Windows, Keychain on macOS, libsecret/kwallet on Linux) to encrypt the LLM provider config + `hasCompletedSetup` flag. Persist the encrypted blob to disk under `app.getPath('userData')`.

**API surface (Electron 40, verified via official docs):**

| Method | Purpose | Returns |
|--------|---------|---------|
| `safeStorage.isEncryptionAvailable()` | Sync check; on Linux returns true only after `app.ready` | `boolean` |
| `safeStorage.encryptString(plain: string)` | Encrypt | `Buffer` |
| `safeStorage.decryptString(encrypted: Buffer)` | Decrypt | `string` |
| `safeStorage.encryptStringAsync(plain)` / `decryptStringAsync(buf)` | Async variants supporting key-rotation hint | `Promise<Buffer>` / `Promise<{shouldReEncrypt, result}>` |
| `safeStorage.getSelectedStorageBackend()` | Linux-only — returns `"kwallet"`/`"gnome-libsecret"`/`"basic-text"`/etc. | `string` |
| `safeStorage.setUsePlainTextEncryption(true)` | Linux-only opt-in to plaintext when no keyring is available | `void` |

**Critical caveat:** `safeStorage` MUST be called after `app.whenReady()`. On Linux, `isEncryptionAvailable()` returns `false` before ready. On Windows it works at any time but main-process-init in our flow happens after `whenReady` anyway.

**Storage location:** Electron docs do NOT mandate where to put the encrypted blob. Convention is `app.getPath('userData')` — on Windows that resolves to `%APPDATA%\Roaming\<appName>\`. CONTEXT.md D-07 confirms.

**JSON shape for the provider-config record:**

```typescript
// apps/electron-main/src/safe-storage.ts
import { app, safeStorage } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'

const STORE_FILE = 'llm-config.enc'

export interface ProviderConfig {
  provider: 'lm_studio' | 'custom_openai' | 'openai' | 'anthropic' | 'gemini'
  // Per D-06, the latter three are dropdown-disabled in Phase 1; the type
  // accepts them so v2 can flip the disabled flag without a contract change.
  endpointUrl: string         // e.g. "http://localhost:1234/v1"
  apiKey: string              // empty string for LM Studio
  modelName: string           // empty string = auto-detect (LM Studio only)
}

export interface StoredConfig {
  provider: ProviderConfig
  hasCompletedSetup: boolean
  schemaVersion: 1
}

const storePath = (): string => path.join(app.getPath('userData'), STORE_FILE)

export function loadConfig(): StoredConfig | null {
  const p = storePath()
  if (!fs.existsSync(p)) return null
  if (!safeStorage.isEncryptionAvailable()) {
    // Linux-no-keyring fallback: app should already have set
    // setUsePlainTextEncryption(true); decryptString will succeed against
    // the obfuscated-but-not-encrypted blob.
    return null
  }
  try {
    const buf = fs.readFileSync(p)
    const json = safeStorage.decryptString(buf)
    return JSON.parse(json) as StoredConfig
  } catch (e) {
    // Corrupted blob: treat as not-configured. User redoes setup.
    return null
  }
}

export function saveConfig(cfg: StoredConfig): void {
  const json = JSON.stringify(cfg)
  const buf = safeStorage.encryptString(json)
  fs.writeFileSync(storePath(), buf, { mode: 0o600 })
}

export function clearConfig(): void {
  const p = storePath()
  if (fs.existsSync(p)) fs.unlinkSync(p)
}
```

**Why both `safeStorage` AND `electron-store`?**

| What | Tool | Why |
|------|------|-----|
| LLM provider URL | `safeStorage` | URL alone is low-sensitivity but keeping it adjacent to api-key in one encrypted blob is simpler than splitting. |
| LLM api-key | `safeStorage` | Secret. Mandatory encrypt. |
| `hasCompletedSetup` flag | `safeStorage` | CONTEXT.md D-09 explicitly puts this in safeStorage so a corrupted credentials blob → forces re-setup (atomic invariant). |
| Window pos/size | `electron-store` | Non-secret, needs to load fast at boot before whenReady (electron-store is synchronous JSON-on-disk, no encryption overhead). |
| Theme preference | `electron-store` | Same. |
| Last-used avatar | `electron-store` | Same; non-secret. |
| Logs-drawer enabled flag (D-16 persists across launches) | `electron-store` | Non-secret. |

**Linux-no-keyring caveat:** When `getSelectedStorageBackend()` returns `"basic-text"`, the encrypt/decrypt cycle is obfuscation, not security. CONTEXT.md "Linux without a keyring drops to plaintext (acceptable per OS-isolation stance)." Document this in Phase 1 plan 01-02.

**IPC contract for the renderer:**

```typescript
// apps/electron-main/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import type { StoredConfig, ProviderConfig } from '../src/safe-storage'

contextBridge.exposeInMainWorld('configApi', {
  load: (): Promise<StoredConfig | null> => ipcRenderer.invoke('config:load'),
  save: (cfg: StoredConfig): Promise<void> => ipcRenderer.invoke('config:save', cfg),
  clear: (): Promise<void> => ipcRenderer.invoke('config:clear'),
})
```

**Sources:** [Electron safeStorage docs](https://www.electronjs.org/docs/latest/api/safe-storage), CONTEXT.md D-07/D-09.

### Pattern: LiteLLM 1.83.x LM Studio test-completion call (PLUMB-04, D-10)

**What:** The setup screen's [Test connection] button MUST issue a real `chat.completions.create` call (not just `/v1/models`) per CONTEXT.md D-10 and per Pitfall 15 in `.planning/research/PITFALLS.md` ("LM Studio bug-tracker #944 — 300-second timeout when model lazy-loads"). The verbose log panel (D-08) reflects the full call lifecycle.

**Sidecar endpoint contract:** The Electron renderer triggers the test by sending an HTTP POST to a sidecar admin endpoint (NOT a WS message — the test is a one-shot synchronous-ish call, and HTTP-with-streaming-response gives us natural per-step log granularity). The sidecar streams the test-log lines back as SSE; renderer renders them into `<TestLog>`.

**Why HTTP+SSE not WS:** the WS connection in Phase 1 is the chat round-trip surface. The setup test is a separate concern with a different lifecycle (one-shot, can fail before the WS even opens cleanly, error states map to HTTP semantics). Splitting the test into HTTP keeps the WS protocol clean.

**Sidecar code (`sidecar/src/sidecar/llm/setup_test.py`):**

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import litellm
import time

router = APIRouter(prefix="/admin")

class TestLLMRequest(BaseModel):
    provider: str  # "lm_studio" or "custom_openai"
    endpoint_url: str  # e.g. "http://localhost:1234/v1"
    api_key: str = ""
    model_name: str = ""  # empty → auto-detect (LM Studio only)


@router.post("/llm-test")
async def test_llm(req: TestLLMRequest) -> StreamingResponse:
    async def gen():
        try:
            yield f"▸ Resolving endpoint {req.endpoint_url}...\n"

            # Step 1 — list models to confirm LM Studio is up + has a model loaded.
            # /v1/models alone is NOT sufficient (D-10) but is a useful pre-flight
            # to give a precise error message before the slower completion call.
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{req.endpoint_url.rstrip('/')}/models")
                r.raise_for_status()
                models = r.json().get("data", [])
                if not models:
                    yield "✕ LM Studio is reachable but no model is loaded.\n"
                    yield "  Open LM Studio's chat tab, load a model, then Test again.\n"
                    return
                model_id = req.model_name or models[0]["id"]
                yield f"▸ GET /v1/models — 200 OK ({len(models)} model(s); using {model_id})\n"

            # Step 2 — the real 1-token completion call (D-10).
            yield f"▸ POST /v1/chat/completions\n"
            yield f"   prompt=\"hi\"  max_tokens=1\n"
            t0 = time.monotonic()

            # LiteLLM 1.83.x — model name format: lm_studio/<id>
            # api_base is passed per-call (not via env var) so we don't pollute
            # global state during multi-test (user changes provider mid-setup).
            model_arg = (
                f"lm_studio/{model_id}" if req.provider == "lm_studio"
                else f"openai/{model_id}"  # Custom OpenAI-compat uses openai/ prefix
            )

            response = await litellm.acompletion(
                model=model_arg,
                api_base=req.endpoint_url,
                api_key=req.api_key or "lm-studio",  # LM Studio accepts any non-empty key
                messages=[{"role": "user", "content": "hi"}],
                max_tokens=1,
                timeout=120,  # Pitfall 15 — LM Studio cold-load can take this long
                stream=False,  # one-shot for the test
            )

            elapsed_ms = int((time.monotonic() - t0) * 1000)
            content = response.choices[0].message.content or "(empty)"
            yield f"▸ Streaming response...\n"
            yield f"✓ Received 1 token in {elapsed_ms} ms\n"
            yield "\n"
            yield "Connection looks good. You can continue.\n"

        except litellm.APIConnectionError as e:
            yield f"✕ Connection refused at {req.endpoint_url}\n"
            yield "\n"
            yield "LM Studio doesn't seem to be running.\n"
            yield "Make sure:\n"
            yield "   1. LM Studio is open\n"
            yield "   2. A model is loaded in the chat panel\n"
            yield "   3. The \"Local Server\" tab is started (default port 1234)\n"
        except litellm.AuthenticationError as e:
            yield f"✕ Auth failed: {e.message}\n"
        except litellm.Timeout as e:
            yield f"✕ Request timed out after {e.message}\n"
            yield "  LM Studio may be loading the model — try again in 30s.\n"
        except litellm.BadRequestError as e:
            yield f"✕ Bad request: {e.message}\n"
        except Exception as e:
            # Anything else — show the message verbatim per D-08
            yield f"✕ {type(e).__name__}: {e}\n"

    return StreamingResponse(gen(), media_type="text/plain")
```

**LiteLLM exception → user-facing line mapping (D-08 verbose log):**

| Exception | HTTP code | What we show |
|-----------|-----------|--------------|
| `litellm.APIConnectionError` | 500 (LiteLLM-internal) | "Connection refused at {endpoint}" + 3-step "Make sure LM Studio is running" guidance (matches USERFLOW.md A.2 failure copy). |
| `litellm.Timeout` | 408 | "Request timed out — LM Studio may be loading the model — try again in 30s." Pitfall 15 hint embedded. |
| `litellm.AuthenticationError` | 401 | "Auth failed: {e.message}" — relevant for Custom OpenAI-compat with bad API key. |
| `litellm.BadRequestError` | 400 | "Bad request: {e.message}" — covers malformed model name, missing fields. |
| `litellm.ContextWindowExceededError` | 400 | (Should not occur for "hi" + max_tokens=1, but include for defensiveness.) |
| Anything else | varies | `"✕ {type(e).__name__}: {e}"` — D-08 mandates verbatim error display. |

**Renderer's `<TestLog>` component contract:**

```typescript
// apps/renderer/src/screens/LLMSetup/TestLog.tsx
import { useState } from 'react'

export function TestLog({ provider, endpointUrl, apiKey, modelName }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [success, setSuccess] = useState(false)

  async function runTest() {
    setLines([])
    setRunning(true)
    setSuccess(false)
    const res = await fetch('http://127.0.0.1:' + sidecarPort + '/admin/llm-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, endpoint_url: endpointUrl, api_key: apiKey, model_name: modelName }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      setLines(prev => [...prev, ...chunk.split('\n').filter(Boolean)])
      if (chunk.includes('Connection looks good')) setSuccess(true)
    }
    setRunning(false)
  }

  return (
    <div className="font-mono text-xs">
      {lines.map((line, i) => <div key={i}>{line}</div>)}
      {running && <span className="animate-pulse">▸ ...</span>}
    </div>
  )
}
```

**Sidecar URL discovery for the test endpoint:** Same `[READY]` line tells Electron the WS port; the HTTP endpoints live on the same uvicorn server, so reuse the port from `getReadyUrl()`. Renderer constructs `http://127.0.0.1:${port}/admin/llm-test`.

**Sources:** [LiteLLM Exception Mapping docs](https://docs.litellm.ai/docs/exception_mapping) — verified this session; [LiteLLM LM Studio provider docs](https://docs.litellm.ai/docs/providers/lm_studio) — verified this session; CONTEXT.md D-08, D-10; PITFALLS.md Pitfall 15.

### Pattern: uv local-path source for vendored pyvts (PLUMB-05)

**What:** CONTEXT.md D-03 — declare `[tool.uv.sources] pyvts = { path = "vendor/pyvts" }` in `sidecar/pyproject.toml` so `import pyvts` resolves to the vendored copy in dev, CI, and packaged builds without `sys.path` shenanigans.

**`sidecar/pyproject.toml` (Phase 1 minimum):**

```toml
[project]
name = "sidecar"
version = "0.1.0"
requires-python = ">=3.12,<3.13"
dependencies = [
    "fastapi==0.136.1",
    "uvicorn==0.46.0",
    "websockets",
    "pydantic>=2.5",
    "httpx>=0.28",
    "psutil>=7.0",
    "litellm==1.83.14",
    "pyvts==0.3.3",                # ← will resolve via [tool.uv.sources] below
]

[tool.uv.sources]
pyvts = { path = "vendor/pyvts" }
# Optional dev-time: contracts as a path source so `from contracts.ws_message import WSMessage` works.
# contracts = { path = "../packages/contracts/py" }

[tool.uv]
dev-dependencies = [
    "ruff",
    "pytest",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/sidecar"]

[tool.hatch.metadata]
allow-direct-references = true   # required when [tool.uv.sources] uses path = "..."
```

**`vendor/pyvts/PROVENANCE.md` template:**

```markdown
# pyvts vendor provenance

**Upstream:** https://github.com/Genteki/pyvts
**License:** MIT (preserved verbatim in vendor/pyvts/LICENSE)
**Snapshot:** PyPI release v0.3.3, published 2024-09-10
**Upstream commit SHA:** <fill in from `git ls-remote https://github.com/Genteki/pyvts.git refs/tags/v0.3.3` at vendor time>
**Vendored at:** 2026-05-NN (yyyy-mm-dd by the engineer who ran the snapshot)

## Why vendored

Upstream maintenance has been dormant since 2024-09-10 (verified via PyPI release date and GitHub releases page). Per CONTEXT.md D-01 through D-05, we vendor from day one so the project owns its dependency graph for VTS WebSocket communication. The single-writer asyncio wrapper that prevents pyvts open issue #51 (`recv()` race during concurrent `asyncio.gather`) is implemented in Phase 4 (AVT-04) — Phase 1's deliverable is import-only.

## Patches applied

(None as of vendoring date.)

## Patch log format

When a patch is applied, append an entry below:

### YYYY-MM-DD — short-description

**Author:** name
**Files touched:** path/to/file.py
**Reason:** one-line summary of why we patched
**Diff summary:** copy of `git diff --stat` for the change
**Upstream issue/PR (if any):** https://github.com/Genteki/pyvts/issues/NN
**Tests added:** path/to/test (if applicable)

(Diff body is recorded in git; this log is the human-readable index.)
```

**Phase 1 verification (success criterion #5):**

```python
# sidecar/tests/test_pyvts_import.py — Phase 1 smoke test
def test_pyvts_imports_without_contacting_vts():
    """SC #5: vendor stub-loads without contacting VTS."""
    import pyvts  # noqa: F401
    # Don't call pyvts.vts.VTS() — that opens a WS connection.
    # Just confirm the module is importable and is the vendored copy.
    assert pyvts.__file__.endswith(("vendor/pyvts/__init__.py", "vendor\\pyvts\\__init__.py"))
```

**Sources:** [uv Configuring projects](https://docs.astral.sh/uv/concepts/projects/config/), [uv Managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/) — `[tool.uv.sources] = { path = "..." }` syntax verified this session; CONTEXT.md D-01 through D-05.

### Pattern: state storage split (electron-store vs safeStorage)

**What:** Two persistence mechanisms coexist; each holds different things.

| Mechanism | What it holds | Why this and not the other |
|-----------|---------------|----------------------------|
| `safeStorage` (DPAPI on Windows) | Provider URL, API key, model name, `hasCompletedSetup`, `schemaVersion` | Secrets + the gate flag; encrypted so non-admin local users on a shared machine can't read keys. CONTEXT.md D-07/D-09. |
| `electron-store` (JSON on disk, unencrypted) | Window x/y/w/h, theme, last-used-avatar, logs-drawer-enabled, logs-drawer-height | Non-secret UX state; needs to load synchronously at window-create time; encryption overhead would be silly for "window was 400×700 last time." Locked §13.40. |

**File locations** (both under `app.getPath('userData')` = `%APPDATA%\Roaming\AgenticLLMVTuber\`):
- `llm-config.enc` — safeStorage blob
- `config.json` — electron-store JSON (default name)

### Anti-Patterns to Avoid (Phase 1 specific)

- **Spawning the sidecar at module-init top-level instead of inside `app.whenReady()`.** Hot-reload in dev re-runs main.ts and double-spawns. PITFALLS.md Pitfall 12. Always spawn inside `whenReady`.
- **Calling `safeStorage.encryptString()` before `app.ready`.** On Linux returns false from `isEncryptionAvailable()` until ready. Defer first config-write until after the setup screen renders, which is itself post-`whenReady`.
- **Putting the api-key into `electron-store`.** electron-store is JSON-on-disk plaintext. Even though our threat model is single-user-local, "logs leak api-key on bug report" is a classic mistake — keep secrets in safeStorage by discipline. PITFALLS.md → Security Mistakes.
- **Using `port: 1234` or any fixed port for the sidecar in dev.** Orphan-process from a previous force-quit holds the port → next launch fails. CONTEXT.md picks `port: 0`; do not regress to fixed-port "for simplicity."
- **Forgetting `flush=True` on the READY-line print.** Python line-buffers stdout when piped; renderer's READY parser hangs. Pitfall 11 cousin.
- **Mounting `/v1/models` as the test-connection check.** D-10 explicitly forbids this — `/v1/models` returns 200 even when no model is loaded; the user gets a green checkmark and then their first real message hangs for 60s. Real 1-token completion is the contract.
- **Using `pip install pyvts` instead of vendoring.** PLUMB-05 + D-01 mandate the vendor. The PyPI install would also work (currently) but it locks us to upstream's dormant cadence. Vendor from day one.
- **Wrapping pyvts in a single-writer asyncio task in Phase 1.** AVT-04 is Phase 4. Phase 1 only verifies `import pyvts` works. Don't pre-build the wrapper. CONTEXT.md D-05 explicit.
- **Building Pydantic→TS codegen in Phase 1.** SC-02 is Phase 5. Phase 1 hand-writes 3 TS interfaces — that's faster than wiring `datamodel-code-generator` or `pydantic2ts` and getting the JSON Schema intermediate right.
- **Trying to share the WS connection across renderer reloads.** Vite's HMR re-mounts the renderer's WS-client module; the previous WS instance becomes garbage. Make the WS client a module-singleton with reconnect-on-mount; don't try to make it survive HMR.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Electron+Vite+React+TS scaffold | Hand-wire Vite + Electron entrypoints | `npm create @quick-start/electron@latest -- --template react-ts` | ~100 LOC of glue + 3 tsconfig files + ESLint config you'd otherwise re-derive. The template is maintained by alex8088 (electron-vite author) and is the canonical 2026 starting point. |
| Encrypting api-key on disk | Write your own AES-GCM wrapper around `crypto.subtle` | `electron.safeStorage` | Built into Electron 40 — DPAPI on Windows, Keychain on macOS, libsecret/kwallet on Linux. No native module rebuild burden. Per-OS isolation handled for you. |
| Window position persistence | Hand-roll JSON write on `BrowserWindow.on('move')` | `electron-store` | Battle-tested; debounced writes; atomic-rename on save; handles corrupted-file gracefully. Locked §13.40. |
| WS protocol envelope from scratch | Invent a new `{op, body}` shape | OLVT's `{type, ...flat-fields}` shape | PLUMB-03 mandates OLVT-shape. We get OLVT bug fixes for free; Phase 2's pipeline ports cleanly. Verified shape this session. |
| Spawning Python from Node | `python-shell` (Python-as-a-Node-module) | `child_process.spawn` | python-shell imports the interpreter into the Node process; sidecar crash takes Electron down. Real-child-process is the correct boundary. |
| Parent-death detection on Windows | Job Objects + native handle plumbing | `psutil.pid_exists(os.getppid())` polling | psutil is 5 lines and works on all three OSes. Job Objects work but require kernel32 binding. Premature for a single-engineer skeleton. |
| LLM client SDK | Direct `openai` SDK + custom routing | LiteLLM 1.83.x | Locked §5.5. We need 5 providers in a dropdown; LiteLLM's OpenAI-compatible bridge gets us all of them with one client. Even Phase 1's single LM Studio call goes through LiteLLM so Phase 2's pipeline doesn't refactor it. |
| Reading the bound port from uvicorn after `serve()` starts | Poll `server.servers` collection | Bind your own socket; `sock.getsockname()[1]`; pass to `server.serve(sockets=[sock])` | The first approach has a race — server.servers populates after accept loop starts, so renderer might connect before uvicorn ready. BYO-socket is the documented 2026 pattern. |
| pyvts vendoring mechanism | Git submodule or git subtree | `cp -r` + PROVENANCE.md + `[tool.uv.sources] = { path = ... }` | CONTEXT.md D-01. Submodules require contributors to remember `git submodule update --init`; subtrees mangle history. Plain copy + log is simplest and most reproducible. |
| TS↔Python codegen | `datamodel-code-generator` (wrong direction) or `pydantic2ts` (works but adds dep) | Hand-write 3 TS interfaces in Phase 1 | SC-02 commits to codegen in Phase 5. Phase 1 has 3 message types — the maintenance cost of hand-writing is < the wiring cost of codegen. Earn the codegen when contracts grow past ~50 types. |
| HTTP→SSE streaming for the test-log | Hand-roll `Response` chunked encoding | FastAPI `StreamingResponse(gen(), media_type="text/plain")` + `fetch().body.getReader()` on the renderer | StreamingResponse handles chunked-transfer-encoding correctly out of the box. Browser `ReadableStream` API is supported in Electron's Chromium 120+ unconditionally. |
| Reasoning-block stripping | Custom regex-on-stream | `re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)` after the response completes (Phase 1's test prompt is 1 token, so this is unlikely to even trigger) | Phase 1 only needs the strip to happen at the LiteLLM-gateway boundary IF a reasoning model is configured. CONTEXT.md "parser-strip-only" + the prompt is `"hi"` with `max_tokens=1` — `<think>` is unlikely. Defer the streaming state machine to Phase 2 LLM-03. |

**Key insight:** Phase 1 is mostly **scaffold-and-don't-build**. The unique work in this phase is the integration glue (READY-line plumbing, the OLVT-shape envelope, the safeStorage IPC shape) — not new abstractions. The temptation will be to design beautiful interfaces; resist, and lean on the boring components that already exist.

## Common Pitfalls

These are inherited from `.planning/research/PITFALLS.md` and filtered to Phase 1 scope. Pitfalls #1, #3, #4, #5, #6, #7, #8, #9, #10 (the VTS / pipeline / TTS-specific ones) are Phase 2-4 problems and are excluded. The five below WILL be hit in Phase 1.

### Pitfall 11: Orphan Python process holds sidecar port after Electron crash (Skeleton-blocker in dev)

**What goes wrong:** Force-quit Electron via Task Manager mid-session. The Python sidecar keeps running. Next `npm run dev` tries to bind the (fixed) port and fails with `EADDRINUSE` / `WinError 10048`. Without recovery UX, the user sees "sidecar failed to start" with no path forward except hunting `python.exe` in Task Manager.

**Why it happens:** Windows has no `prctl(PR_SET_PDEATHSIG)` equivalent. Electron's `child_process.spawn` defaults don't enable any cross-platform "die when parent dies" mechanism.

**How to avoid:**
- **CONTEXT.md mitigation already chosen:** `port: 0` ephemeral binding eliminates port-collision entirely — the OS hands us whatever's free.
- **AND** the sidecar runs the `psutil.pid_exists(parent_pid)` watchdog at 2s polling, so even orphaned sidecars from a previous session die within 2s of detecting the parent gone. The next launch's brand-new ephemeral port has no collision risk.

**Warning signs (still possible despite mitigation):**
- After force-quit, `Task Manager → Python` shows orphans persisting for >5s before they self-exit (watchdog poll too slow).
- Logs show `psutil.NoSuchProcess` exceptions in the watchdog loop.

**Phase to address:** Phase 1, plan 01-01 (sidecar lifecycle).

### Pitfall 12: Hot-reload-during-development double-spawning the sidecar

**What goes wrong:** Vite/electron-vite hot-reloads the renderer cleanly. But if main-process code is edited and electron-vite's main-watcher restarts the Electron process, every reload spawns a new Python sidecar without killing the old one. After 5 main-process edits in 10 minutes you have 5 `python.exe` instances, only the latest connected.

**Why it happens:** electron-vite 5's main-process hot-reload doesn't run our `before-quit` hook. The previous main process exits (taking the previous spawn's stdio pipes with it) but the orphan sidecar's parent-PID watchdog at 2s polling means there's a 2s window where two sidecars co-exist.

**How to avoid:**
- Spawn inside `app.whenReady()` only (not at module top-level — multiple Electron processes mean each does its own spawn cleanly).
- The 2s watchdog is the safety net: orphans die within 2s.
- Optionally — a PID file in `app.getPath('userData')`: on spawn attempt, check the file; if a process at that PID is alive AND responds to a health-check, reuse instead of spawning. Probably overkill for Phase 1.

**Warning signs:** After 30 minutes of main-process edits, Task Manager shows ≥2 `python.exe` instances. The 2s watchdog should mean ≤2 for ≤2s.

**Phase to address:** Phase 1, plan 01-01.

### Pitfall 13: Sidecar crash leaves the UI alive but mute — no error surfaced

**What goes wrong:** Sidecar segfaults (e.g., a bug in `setup_test.py` triggers an unhandled exception). Renderer is unaffected; UI is fully responsive. User types "hello", expects the echo response, and sees nothing. No toast, no error. The watchdog is the only safety net.

**Why it happens:** No crash-recovery infrastructure in Phase 1 (it's deferred to a later milestone in §5.12). The watchdog handles parent-death; nothing handles child-death.

**How to avoid:**
- **CONTEXT.md "Claude's Discretion" mitigation:** Electron logs the exit code, surfaces a non-blocking toast ("Sidecar crashed — restarting..."), auto-respawns once. Two crashes within 30s → permanent banner with `[Retry]` button.
- Heartbeat ping from renderer to sidecar every 5s; renderer detects stale heartbeat → reconnecting indicator.
- Capture sidecar stdout/stderr to a rolling log file in `app.getPath('userData')/logs/sidecar.log`; banner links to "Open log folder."

**Phase to address:** Phase 1, plan 01-01 (specifically the lifecycle wiring).

### Pitfall 15: LiteLLM + LM Studio first-call timeout when model isn't pre-loaded

**What goes wrong:** LM Studio's OpenAI-compatible server lazy-loads models on first request. First LiteLLM call takes 30–60s to load the model into VRAM. LiteLLM's default per-request timeout (≈30s) can fail outright. The user sees "Test connection" hang or fail; they assume their config is wrong.

**Why it happens:** LM Studio bug-tracker #944 documents up-to-300-second model-load times.

**How to avoid:**
- **CONTEXT.md D-10 mitigation already locked:** real 1-token completion (not `/v1/models`) is the test contract.
- **Set LiteLLM `timeout=120` explicitly** in the test call (see "Pattern: LiteLLM 1.83.x LM Studio test-completion call" code).
- **The verbose log panel (D-08) shows progress** — `▸ Sending 1-token completion...` with no terminal line means it's still waiting; on Timeout exception we surface "LM Studio may be loading the model — try again in 30s."

**Phase to address:** Phase 1, plan 01-02 (LLM setup gate).

### Pitfall (port:0 specific): Renderer connects before uvicorn accepts (race window)

**What goes wrong:** Sidecar prints `[READY] ws://...` to stdout; Electron parses; renderer opens the WS — but uvicorn is still in the millisecond-window between socket bind and accept-loop entry. Connection refused; renderer retries; usually works on retry but the first cycle looks broken.

**Why it happens:** Without socket-pre-binding (BYO-socket pattern), uvicorn binds + listens + accept-loops in sequence inside `serve()`. The READY line could fire before any of those if you put it there.

**How to avoid:**
- **The pattern in this RESEARCH.md** (see "Pattern: Python sidecar lifecycle on Windows" code) **fixes this:** we bind the socket ourselves first, then print READY, then call `server.serve(sockets=[sock])`. The OS is already in `LISTEN` state on `127.0.0.1:<port>` before READY ships, so any `connect()` from the renderer succeeds (uvicorn's accept loop drains the SYN queue when it starts).
- Renderer should still implement WS reconnect-with-backoff for general robustness — but the race is closed correctly.

**Warning signs:** Renderer logs show "WebSocket connection refused" once on first launch, succeeds on retry. → READY-line position is wrong.

**Phase to address:** Phase 1, plan 01-01.

## Code Examples

(All code blocks above in "Architecture Patterns" are verified — drawing from those rather than re-listing here. The planner can pull them into task action specs verbatim.)

Quick index of the canonical examples:

- **Electron main spawn pattern** — under "Pattern: Python sidecar lifecycle on Windows" → `apps/electron-main/src/sidecar.ts`
- **Sidecar entrypoint with port:0** — under same → `sidecar/src/sidecar/main.py`
- **WSMessage Pydantic + TS mirror** — under "Pattern: OLVT WebSocket envelope"
- **Echo handler + dispatcher** — under same
- **safeStorage IPC** — under "Pattern: Electron `safeStorage` credential gate"
- **LiteLLM 1-token test call** — under "Pattern: LiteLLM 1.83.x LM Studio test-completion call"
- **`<TestLog>` SSE consumer** — under same
- **`sidecar/pyproject.toml` with vendored pyvts** — under "Pattern: uv local-path source for vendored pyvts"
- **PROVENANCE.md template** — under same

## State of the Art

| Old Approach | Current Approach (May 2026) | When Changed | Impact |
|--------------|------------------------------|--------------|--------|
| Vite 5 + electron-vite 4 | Vite 6 + electron-vite 5 | electron-vite 5 released alongside Vite 6 stable line | Project pin per CLAUDE.md / STACK.md |
| `claude-code-sdk` PyPI package | `claude-agent-sdk` | Renamed; old package deprecated, redirects on PyPI | Phase 1 doesn't use either; relevant for agent-runtime milestone. |
| Vite + Electron manual wiring | electron-vite single-config | electron-vite 1.x in 2023, mainstream by 2024 | Phase 1 uses the mainstream path. |
| `pip + virtualenv + pyenv` | `uv` (single tool, Rust-fast, lockfile-aware) | uv 1.0 stable in 2025; consensus pick by 2026 | Phase 1's sidecar uses uv. |
| Hard-coded WS ports | port:0 + READY-line discovery | Mainstream pattern in language-server protocols since LSP era; standard for Electron+Python sidecars 2026 | CONTEXT.md picks port:0. |
| Custom AES wrapper for credentials | `electron.safeStorage` (DPAPI/Keychain/libsecret) | Electron 15+ shipped safeStorage; mainstream by Electron 25 | CONTEXT.md D-07 picks safeStorage. |
| `pnpm` for Electron monorepos | `npm` for Electron+React+Vite combos | pnpm's symlinked `node_modules` breaks electron-builder asar packaging without `node-linker=hoisted` | CLAUDE.md / STACK.md pick npm. |

**Deprecated/outdated to NOT use in Phase 1:**

- `pixi-live2d-display` (original `guansss` repo) — original is stale; `pixi-live2d-display-advanced` is the active fork. Phase 1 doesn't touch any Live2D code; this is here only because PROJECT.md tags v1.5/v2 Pixi exploration.
- `python-shell` Node module — runs Python in-process; we want a real child boundary.
- Vite 7/Vite 8 (Vite 8 + Rolldown is brand new, March 2026; not skeleton-ready). CLAUDE.md "What NOT to use".
- `claude-code-sdk` (deprecated PyPI alias) — not relevant to Phase 1, but flagged in CLAUDE.md for the agent-runtime milestone.
- Python 3.13 for the sidecar — ML-wheel ecosystem still consolidating. CLAUDE.md.

## Open Questions

1. **Should `avatars/teto/teto_overrides.yaml` (the AVT-07 stub) land in Phase 1 plan 01-01, or wait for Phase 4 04-00?**
   - What we know: AVT-07 says "skeleton ships a stub teto_overrides.yaml checked into the repo". CONTEXT.md doesn't mention this file. ROADMAP.md maps AVT-07 to Phase 4. The schema is empty in skeleton — costs 1 file.
   - What's unclear: pre-creating it in Phase 1 means Phase 4 doesn't trip over file-creation timing; deferring to 04-00 keeps the phase boundary clean.
   - Recommendation: **Punt to Phase 4 04-00.** Phase 1 has enough surface area without front-loading a Phase 4 deliverable. If the planner sees a clean opportunity to fold it in (e.g., the monorepo scaffold task already creates `avatars/`), fine — but don't make it a separate task.

2. **Hot-reload behavior for the sidecar's Python code in dev — does electron-vite's main-process watcher trigger sidecar respawn, or does the sidecar restart manually?**
   - What we know: electron-vite 5 watches `apps/electron-main/src/`, not `sidecar/`. Editing sidecar Python doesn't trigger any restart by default.
   - What's unclear: Do we want sidecar hot-reload in dev? Probably yes (faster iteration on the WS protocol).
   - Recommendation: **Defer to Phase 1 implementation experience.** A simple `--reload` flag on uvicorn during dev would respawn the Python process on file change, but that interacts with our READY-line plumbing in subtle ways (uvicorn's `--reload` spawns a worker subprocess that prints READY at a different time). Suggest the planner adds a "dev convenience" task scoped to "consider uvicorn `--reload` after the basic loop works." Don't block Phase 1 on it.

3. **Should the renderer's WS-client implement reconnect-on-drop with exponential backoff in Phase 1?**
   - What we know: PITFALLS.md → Anti-Pattern 5 says "yes, sidecar will crash during dev." CONTEXT.md mentions auto-respawn + 2-crashes/30s banner.
   - What's unclear: How robust should the renderer's WS code be in Phase 1 specifically? Phase 1's success criteria don't test reconnect behavior.
   - Recommendation: **Implement minimal reconnect-with-fixed-backoff (e.g., 1s, 2s, 4s capped at 4s).** Don't build a full state machine with offline mode; just don't drop messages permanently on the first sidecar restart. The crash-banner UI (CONTEXT.md "Claude's Discretion → Sidecar lifecycle") is the user-visible signal; reconnect is the bridge.

4. **Does the verbose `<TestLog>` panel persist its lines across [Test connection] retries (D-08 says "Logs persist in the panel until the user retries — they do not auto-clear")?**
   - What we know: D-08 verbatim: "Logs persist in the panel until the user retries — they do not auto-clear."
   - What's unclear: Does "until the user retries" mean "until [Test again] is clicked, at which point we clear and start fresh" or "we append to the previous log"?
   - Recommendation: **Clear on [Test again] click, append within a single test run.** USERFLOW.md A.2 shows a fresh log for each test cycle; the literal reading of D-08 ("persist until retry") matches that — they persist across, e.g., a user reading the failure message, then clicking Retest, at which point a fresh log replaces the old. The planner should confirm with the user if ambiguity remains; Phase 1 plan 01-02 ships with "clear on [Test again]" by default.

5. **Where exactly does the 1-token completion test endpoint live — same uvicorn server as the WS, or a separate FastAPI app?**
   - What we know: The Architecture Patterns section above proposes same uvicorn server, HTTP route at `/admin/llm-test`. This is the simpler design.
   - What's unclear: A separate process gives crash isolation, but Phase 1 doesn't need that complexity.
   - Recommendation: **Same uvicorn server, route `/admin/llm-test`.** One process, one port (the ephemeral one Electron knows). The renderer constructs `http://127.0.0.1:${port}/admin/llm-test`. Phase 5 might revisit if `/admin` gets noisier.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥22 LTS | Electron 40 dev runtime + npm | ✓ | 22.19.0 (matches Electron 40 ABI) | — |
| npm ≥10 | JS package manager | ✓ | 10.9.3 | — |
| Python 3.12.x | Sidecar runtime | ✓ | cpython-3.12.11 (uv-managed at `~/AppData/Roaming/uv/python/`) | None — Phase 1 cannot proceed without 3.12 (3.13 has known ML-wheel-parity issues per CLAUDE.md). `uv python pin 3.12` will pick up the existing install. |
| uv ≥0.10 | Python package manager + lockfile | ✓ | 0.10.4 (released 2026-02-17) | None mandated — pip+venv would also work for Phase 1 but loses lockfile reproducibility. |
| Electron 40 | Desktop shell | will-install | — | Auto-installed by `@quick-start/electron` template via `npm install`. |
| LM Studio (external app) | LLM provider for setup-screen test | not auto-checkable from this environment | — | User installs separately (PROJECT.md / USERFLOW.md §5 pre-launch state). The Phase 1 test gracefully fails with "Connection refused" + 3-step guidance per D-08 if LM Studio is absent. **Not a Phase 1 blocker** — the dev can scaffold the entire shell + sidecar + protocol + setup screen without LM Studio running, and only need it for the [Test connection] integration sanity-check at the end of plan 01-02. |
| VTube Studio (external app) | Phase 4 deliverable; Phase 1 only does `import pyvts` | not required for Phase 1 | — | Skeleton SC #5 is `import pyvts` working — VTS itself is not exercised. |
| Git | Repo + PROVENANCE.md commits | ✓ (clean working tree per init context) | — | — |

**Missing dependencies with no fallback:** None for Phase 1.

**Missing dependencies with fallback:** None for Phase 1.

**Dependencies that will be installed during Phase 1 execution:** Electron 40, electron-vite 5, React 19.2, Vite 6, electron-builder 25, electron-store 10, FastAPI 0.136.1, uvicorn 0.46.0, websockets 14, Pydantic 2.x, httpx 0.28, psutil 7, LiteLLM 1.83.14, pyvts 0.3.3 (vendored). All have HIGH-confidence pins from STACK.md.

**External services not blocking Phase 1 implementation:** LM Studio + VTube Studio are user-managed apps that need to be running ONLY for the manual smoke-test of plan 01-02's [Test connection] success path and SC #1's "Electron window opens, sidecar starts, log panel shows [READY]". The user/dev is expected to have them installed per USERFLOW.md §5.

## Sources

### Primary (HIGH confidence)

- [Electron Releases — releases.electronjs.org](https://releases.electronjs.org/) — Electron 40 stable since 2026-01-13
- [Electron safeStorage docs](https://www.electronjs.org/docs/latest/api/safe-storage) — full API surface verified this session (encryptString, decryptString, isEncryptionAvailable, async variants, Linux backend selection)
- [LiteLLM Exception Mapping docs](https://docs.litellm.ai/docs/exception_mapping) — full exception list + status codes + try/except patterns verified this session
- [LiteLLM LM Studio provider docs](https://docs.litellm.ai/docs/providers/lm_studio) — model name format `lm_studio/<id>`, api_base usage verified this session
- [LiteLLM Release Notes](https://docs.litellm.ai/release_notes) — v1.83.14 stable as of 2026-04-26 (project-research-cited)
- [LiteLLM Security Update March 2026](https://docs.litellm.ai/blog/security-update-march-2026) — v1.83.x is the post-incident stable line
- [FastAPI Release Notes](https://fastapi.tiangolo.com/release-notes/) — 0.136.1 on 2026-04-23
- [Uvicorn settings](https://uvicorn.dev/settings/) — 0.46.0 on 2026-04-23
- [FastAPI Discussion #14783 — How Uvicorn Listens on an Open Port](https://github.com/fastapi/fastapi/discussions/14783) — confirms BYO-socket pattern is standard for known-port discovery
- [pyvts on PyPI](https://pypi.org/project/pyvts/) — 0.3.3 published 2024-09-10
- [pyvts on GitHub (Genteki/pyvts)](https://github.com/Genteki/pyvts) — no commits or releases since 2024-09 (verified via project research)
- [uv Configuring projects docs](https://docs.astral.sh/uv/concepts/projects/config/) — `[tool.uv.sources] path = "..."` syntax verified this session
- [uv Managing dependencies](https://docs.astral.sh/uv/concepts/projects/dependencies/) — local-path dependency examples (editable + non-editable) verified this session
- [Open-LLM-VTuber `websocket_handler.py`](https://raw.githubusercontent.com/Open-LLM-VTuber/Open-LLM-VTuber/main/src/open_llm_vtuber/websocket_handler.py) — `_route_message` dispatcher + `WSMessage` TypedDict + 20-type registry verified this session
- [@quick-start/create-electron on npm](https://www.npmjs.com/package/@quick-start/create-electron) — current scaffolder
- [@quick-start react-ts template tree](https://github.com/alex8088/quick-start/tree/master/packages/create-electron/playground/react-ts) — directory structure verified this session
- [psutil 7.x docs](https://psutil.readthedocs.io/) — `pid_exists()`, `Process().ppid()` Windows behavior

### Secondary (MEDIUM confidence — multiple sources or inferred from documentation)

- [electron-vite Getting Started](https://electron-vite.org/guide/) — confirms 3-target build (main/preload/renderer); exact directory tree for the canonical scaffold inferred from quick-start template
- [Open-LLM-VTuber DeepWiki — System Architecture](https://deepwiki.com/Open-LLM-VTuber/Open-LLM-VTuber/3-system-architecture) — corroborates the typed-JSON envelope pattern
- [Why npm not pnpm for Electron+React+Vite (dev.to)](https://dev.to/yurirxmos/why-you-should-use-npm-and-not-pnpm-yet-to-build-electron-react-vite-tailwind-apps-4oc9) — electron-builder + pnpm symlink interaction
- [LM Studio bug-tracker #944 — 300-second timeout](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/944) — Pitfall 15 source

### Tertiary (LOW confidence — single source or inferred patterns)

- The exact `package.json` scripts in the `@quick-start/electron` react-ts template — paraphrased from search-result snippets; verify after running the scaffold command
- The 2s watchdog poll interval as the right tradeoff between responsiveness and OS overhead — taken as CONTEXT.md "Claude's Discretion" default; no empirical bench-mark

### Internal references (project artifacts read this session)

- `.planning/phases/01-plumbing-process-lifecycle/01-CONTEXT.md` — locked decisions D-01 through D-22
- `.planning/phases/01-plumbing-process-lifecycle/01-USERFLOW.md` — flows A.1–A.7 (cold launch + setup screen), B (warm launch), C (conversation), D (history), G (status icon)
- `.planning/phases/01-plumbing-process-lifecycle/01-UI-SPEC.md` — design tokens, component contracts (read partially — first 100 lines)
- `.planning/REQUIREMENTS.md` — PLUMB-01 through PLUMB-05 verbatim
- `.planning/PROJECT.md` — Active list, Constraints, Risks (R-OPEN-1, R-OPEN-2)
- `.planning/STATE.md` — current phase position
- `.planning/ROADMAP.md` — Phase 1 success criteria + cross-phase notes
- `.planning/research/SUMMARY.md` — synthesis context
- `.planning/research/STACK.md` — version pins
- `.planning/research/ARCHITECTURE.md` — boundaries, layout, lifecycle patterns
- `.planning/research/PITFALLS.md` — Pitfalls 11, 12, 13, 15 (Phase 1 relevant subset)
- `CLAUDE.md` — project constraints + "What NOT to use"
- `PROJECT_DESIGN.md` §5.5, §13.1, §13.8, §13.40, §14, §16

## Project Constraints (from CLAUDE.md)

These directives carry the same authority as locked decisions; research must not recommend approaches that contradict them. Phase 1 plans must verify compliance.

| Constraint | Source | Phase 1 implication |
|------------|--------|---------------------|
| **Tech stack: Electron (TS) + React + Vite + Python 3 sidecar (FastAPI + uvicorn)** | §13.1, §13.8 | Phase 1 instantiates this exact stack; no Tauri / Wails / Node-sidecar substitution. |
| **Live2D rendering: VTube Studio + pyvts is the v1 path** | §11 | Phase 1's PLUMB-05 vendor checkout supports this. No Cubism SDK / pixi-live2d-display in the repo. |
| **LLM gateway: LiteLLM single client** | §5.5 | Phase 1's setup-screen test uses LiteLLM, not the openai SDK directly. |
| **Local-first: WebSocket protocol localhost-only** | §10 | Sidecar binds to `127.0.0.1` (NOT `0.0.0.0`); Pitfall on the same. |
| **Single-user: no multi-user/family accounts** | §13.7 | Phase 1's safeStorage credential blob is single-user; no per-user partitioning. |
| **Default avatar (shipping): Live2D Inc. sample model** | §13.123 | N/A in Phase 1 (no avatar code yet). |
| **npm not pnpm** | CLAUDE.md / STACK.md | Phase 1's monorepo uses npm workspaces. |
| **Vite 6, NOT Vite 7/8** | CLAUDE.md "What NOT to use" | Phase 1 pins Vite 6.x. |
| **Python 3.12, NOT 3.13** | CLAUDE.md "What NOT to use" | Phase 1's sidecar pins Python 3.12 in `pyproject.toml` (`requires-python = ">=3.12,<3.13"`). |
| **`claude-agent-sdk`, NOT `claude-code-sdk`** | CLAUDE.md "What NOT to use" | Phase 1 doesn't use either; relevant when agent-runtime milestone lands. |
| **electron-store for non-secrets only** | §13.40 | Phase 1's secret state goes through safeStorage; window pos goes through electron-store. Don't conflate. |
| **GSD workflow enforcement: no direct edits outside a GSD command** | CLAUDE.md "GSD Workflow Enforcement" | The planner / executor must use `/gsd:execute-phase` for Phase 1 implementation. Researcher honors this by writing only this RESEARCH.md. |
| **piper-tts NOT piper-onnx** | CLAUDE.md / STACK.md | N/A in Phase 1 (TTS is Phase 3). |
| **VTube Studio API "1.0" — Cubism 4.x or 5.0–5.2 rigs only** | CLAUDE.md "What NOT to use" | N/A in Phase 1. |

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every pin verified via PyPI / official changelog (project research synthesis on 2026-05-06; re-spot-checked this session for LiteLLM 1.83.14, pyvts 0.3.3, FastAPI 0.136.1).
- Architecture (electron-vite scaffold + monorepo refactor + monorepo layout): **HIGH** — quick-start template tree verified this session; refactor plan is mechanical.
- Architecture (Python sidecar lifecycle): **HIGH** — psutil + BYO-socket + READY-line is the documented 2026 pattern (FastAPI Discussion #14783 + psutil docs both confirm).
- Architecture (OLVT envelope): **HIGH** — `_route_message` source verified this session; 20-type registry confirmed.
- Architecture (safeStorage): **HIGH** — Electron 40 official docs verified this session.
- Architecture (LiteLLM test call): **HIGH** — exception mapping + LM Studio provider docs verified this session.
- Architecture (uv local-path source): **HIGH** — astral.sh/uv docs verified this session.
- Pitfalls: **HIGH** for Pitfall 11/12/13 (port collision, double-spawn, crash banner — straight from PITFALLS.md research synthesis); **HIGH** for Pitfall 15 (LM Studio timeout — bug-tracker source).
- Open questions: **MEDIUM** — these are decisions deferred to plan-time per CONTEXT.md and have reasonable defaults but lack empirical validation until plan 01-01 runs.

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days for stable stack pins; Phase 1's domain doesn't move fast). Re-verify if any of LiteLLM 1.83.x / Electron 40 / pyvts upstream / @quick-start/electron template see major version bumps before Phase 1 ships.
