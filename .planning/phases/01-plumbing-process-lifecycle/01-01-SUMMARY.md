---
phase: 01-plumbing-process-lifecycle
plan: 01
subsystem: infra
tags: [electron, electron-vite, react, vite, typescript, fastapi, uvicorn, uv, pyvts, psutil, contextbridge, ipc, monorepo, npm-workspaces]

# Dependency graph
requires: []
provides:
  - "Monorepo skeleton: apps/electron-main + apps/renderer + sidecar + packages/contracts (npm workspaces)"
  - "Electron 40 main entry with electron-store window-state persistence (400×700 default, 320×480 minimums)"
  - "Python 3.12 sidecar w/ uv-managed venv, FastAPI 0.136.1 + uvicorn 0.46.0 + psutil 7.x parent-PID watchdog"
  - "port:0 ephemeral binding + [READY] ws://127.0.0.1:<port>/ws line plumbing (sidecar BYO-socket pattern)"
  - "pyvts 0.3.3 vendored at sidecar/vendor/pyvts/ with PROVENANCE.md (PLUMB-05 / D-01..D-05)"
  - "contextBridge `window.api` surface: getReadyUrl, onSidecarReady, onSidecarCrash, onSidecarLog, getWindowState"
  - "Crash circuit-breaker: 3 crashes within 30s -> permanent banner state"
  - "Chrome shell: 36px TopBar + 56px BottomRail + StatusIcon (worst-of-three) + HistorySheet + LogsDrawer + 16-section Settings"
  - "7-theme system (D-23): blush/sunrise/ember/midnight-{sky,pewter}/onyx-{sky,pewter}"
  - "DevPanel for design-review (DEV-only, gated by import.meta.env.DEV)"
affects:
  - "01-02 (Wave 2 — LLM setup gate, /admin/llm-test SSE, echo WS round-trip)"
  - "Phase 2 (Conversation pipeline — uses sidecar app + WS plumbing)"
  - "Phase 4 (VTS bridge — uses pyvts vendor at sidecar/vendor/pyvts/)"

# Tech tracking
tech-stack:
  added:
    - "Electron 40.4.0 (main shell)"
    - "electron-vite 5.0.5 (build tooling)"
    - "electron-builder 25.1.8 (packaging — config only, no installers built)"
    - "electron-store 10.1.0 (window state persistence)"
    - "@electron-toolkit/utils 4.0.0 (boilerplate helpers)"
    - "React 19.2.0 + react-dom 19.2.0 (renderer)"
    - "Vite 6.4.2 + @vitejs/plugin-react 4.7.0 (renderer bundler)"
    - "TypeScript 5.9.3 (strict mode)"
    - "Python 3.12.11 (sidecar runtime, uv-managed)"
    - "FastAPI 0.136.1 + uvicorn 0.46.0 + websockets 14.2 (sidecar HTTP/WS)"
    - "psutil 7.2.2 (parent-PID watchdog)"
    - "litellm 1.83.14 (pinned for plan 01-02 LLM test, not used in 01-01)"
    - "pyvts 0.3.3 vendored at sidecar/vendor/pyvts/ (upstream SHA 2792d6a33a4e51bf24670225244f7e2a586ea83e)"
    - "pytest 9.0.3 + pytest-asyncio 1.3.0 (sidecar tests)"
  patterns:
    - "BYO-socket port:0 pattern: bind socket -> read getsockname() -> print [READY] -> uvicorn.serve(sockets=[sock])"
    - "Parent-PID watchdog via psutil.pid_exists @ 2s polling (Windows has no PR_SET_PDEATHSIG)"
    - "Crash circuit-breaker: track crashTimestamps in 30s window, disable respawn on 3rd"
    - "uv local-path source for vendored packages: [tool.uv.sources] pyvts = { path = 'vendor/pyvts' }"
    - "vendor sys.path shim in sidecar/__init__.py + tests/conftest.py (vendor/ pre-pended) so import pyvts resolves to vendor/pyvts/__init__.py"
    - "contextBridge whitelist pattern: every ipcRenderer channel goes through preload/index.ts surface"
    - "Hand-rolled inline SVG icons (no lucide-react) — local-first per UI-SPEC"
    - "7-theme class system on <html> (resolveThemeClass + prefers-color-scheme)"
    - "DEV-mock backend tree-shaken via import.meta.env.DEV gate"

key-files:
  created:
    - "package.json (npm workspaces root)"
    - "apps/electron-main/package.json"
    - "apps/electron-main/electron.vite.config.ts"
    - "apps/electron-main/electron-builder.yml"
    - "apps/electron-main/src/index.ts (app entry; whenReady -> createWindow + spawnSidecar + registerIpc)"
    - "apps/electron-main/src/sidecar.ts (spawn + READY-parse + crash circuit-breaker)"
    - "apps/electron-main/src/ipc.ts (registerIpc bridge)"
    - "apps/electron-main/src/window-store.ts (electron-store typed schema)"
    - "apps/electron-main/preload/index.ts (contextBridge.exposeInMainWorld('api', ...))"
    - "apps/electron-main/preload/index.d.ts (Window.api type augmentation)"
    - "apps/renderer/package.json"
    - "apps/renderer/vite.config.ts"
    - "apps/renderer/index.html"
    - "apps/renderer/src/main.tsx, App.tsx, env.d.ts, index.css (~840 lines, prototype port)"
    - "apps/renderer/src/lib/copy.ts (typed `as const`)"
    - "apps/renderer/src/lib/icons.tsx (17 inline SVG icons)"
    - "apps/renderer/src/lib/utils.ts (cn helper)"
    - "apps/renderer/src/state/{theme-provider,app-store,route-store,chrome-store}.{ts,tsx}"
    - "apps/renderer/src/chrome/{AppShell,TopBar,BottomRail,StatusIcon,HistorySheet,LogsDrawer,PlaceholderPage,ToastStack}.tsx"
    - "apps/renderer/src/screens/Chat/Chat.tsx, screens/Agent/Agent.tsx, screens/Settings/Settings.tsx (16 sections)"
    - "apps/renderer/src/dev/DevPanel.tsx + dev/__mocks__/mock-backend.ts (DEV-only)"
    - "sidecar/pyproject.toml + uv.lock + .python-version"
    - "sidecar/src/sidecar/__init__.py (vendor sys.path shim), __main__.py, main.py"
    - "sidecar/src/sidecar/lifecycle/watchdog.py"
    - "sidecar/src/sidecar/ws/server.py (FastAPI app, /health)"
    - "sidecar/tests/conftest.py + test_pyvts_import.py (3 tests) + test_sidecar_boot.py (1 test)"
    - "sidecar/vendor/pyvts/{__init__.py,vts.py,vts_request.py,config.py,error.py,LICENSE,pyproject.toml,PROVENANCE.md}"
    - ".gitignore (updated; sidecar/.venv/, .vite/ added)"
  modified: []

key-decisions:
  - "DEVIATION (Rule 3 — blocking): Hatch's editable-install mode for the flat vendor/pyvts/ layout (where __init__.py lives directly inside the package dir, not under vendor/pyvts/pyvts/) does not produce a usable .pth file pointing at vendor/'s parent. Workaround: install pyvts as a regular wheel (so the dependency resolves) AND prepend `vendor/` to sys.path in sidecar/__init__.py + tests/conftest.py so `import pyvts` resolves to `vendor/pyvts/__init__.py` at runtime — which is what must_haves.truths require. Verified via pyvts.__file__ check."
  - "Per DELTA: skipped shadcn/Tailwind install entirely. Ported prototype's hand-rolled CSS (~840 lines, 7 OKLCH theme classes per D-23) verbatim into apps/renderer/src/index.css. Dropped tailwindcss / @tailwindcss/postcss / class-variance-authority / clsx / tailwind-merge / lucide-react from renderer dependencies. The 17 prototype icons are inline SVGs in apps/renderer/src/lib/icons.tsx."
  - "Per DELTA: ported chrome components verbatim from prototype src/shell.jsx (TopBar/BottomRail/StatusIcon/HistorySheet/LogsDrawer/ChatView/AgentView/ToastStack) and src/views/SettingsView.jsx, replacing window.{COPY,ICONS,useStore} registry pattern with ESM imports. Drop the macOS faux title-bar dots (Electron supplies real chrome)."
  - "Sidecar `app.isQuitting` flag added via TS module augmentation (declare module 'electron') so before-quit handlers cooperate."
  - "Renderer Chat empty-state and Settings sections use the prototype's typography/spacing classes (`.empty-state`, `.section`, `.kv-row`) defined in index.css — heights enforced via CSS not Tailwind utilities."

patterns-established:
  - "Sidecar lifecycle: spawn from inside app.whenReady (Pitfall 12), parse READY via locked regex, kill on shutdownSidecar() in before-quit"
  - "Crash circuit-breaker template (3-strikes-30s) — reusable for any future child process"
  - "Vendored Python package pattern: sidecar/vendor/<pkg>/ with PROVENANCE.md + uv local-path source + sys.path shim for editable resolution"
  - "Renderer state pattern: AppStoreProvider (single useStore hook) + ThemeProvider on top; standalone observable hooks (route-store, chrome-store) for non-Provider consumers"
  - "Theme resolution: resolveThemeClass(prefs, prefersDark) -> one of 7 named classes applied to <html>; OS prefers-color-scheme listener for mode='auto'"
  - "DEV-only mocks: dev/__mocks__/ tree-shaken in production via import.meta.env.DEV gate at consumer mount sites"

requirements-completed: [PLUMB-01, PLUMB-02, PLUMB-05]

# Metrics
duration: ~75min
completed: 2026-05-06
---

# Phase 1 Plan 01: Plumbing & Process Lifecycle — Bootstrap Summary

**Electron 40 + React 19 + Vite 6 monorepo with Python 3.12 sidecar (FastAPI + uv venv + pyvts vendored), READY-line plumbing, parent-PID watchdog, contextBridge IPC, and the v1-target chrome shell ported from the design prototype.**

## Performance

- **Duration:** ~75 min (3 atomic tasks)
- **Started:** 2026-05-06T~21:15Z (approximate — derived from first commit)
- **Completed:** 2026-05-06T22:31Z
- **Tasks:** 3 (Task 1 scaffold, Task 2 sidecar+pyvts, Task 3 chrome)
- **Files modified:** 64 created (no pre-existing files modified outside .gitignore/STATE.md/config.json)
- **Sidecar tests:** 4/4 passing
- **Renderer typecheck:** clean (`npx tsc --noEmit` exits 0)
- **Electron-vite build:** clean (main 7.49 kB, preload 0.83 kB, renderer 616 kB JS + 26 kB CSS)

## Accomplishments

- Greenfield → working monorepo skeleton in one wave: 7 directory roots (`apps/{electron-main,renderer}`, `apps/electron-main/{src,preload}`, `apps/renderer/src`, `sidecar/{src/sidecar,vendor/pyvts,tests}`, `packages/contracts/{py,ts}`)
- Electron-main spawns the sidecar from inside `app.whenReady()`, parses `[READY] ws://127.0.0.1:<port>/ws` via the locked regex, exposes the URL through `contextBridge` (PLUMB-01 + PLUMB-02 satisfied)
- Python sidecar boots via `uv run python -m sidecar` from a uv-managed venv, prints the READY line BEFORE entering uvicorn's accept loop (with `flush=True`), runs the parent-PID watchdog at 2s polling
- pyvts 0.3.3 vendored at `sidecar/vendor/pyvts/` with PROVENANCE.md (upstream SHA `2792d6a33a4e51bf24670225244f7e2a586ea83e`); `import pyvts` resolves to vendor copy via sys.path shim (PLUMB-05 / D-01..D-05 satisfied)
- Crash circuit-breaker: 3 crashes within 30s flips a `respawnDisabled` flag (CONTEXT.md "Claude's Discretion → Sidecar lifecycle")
- Renderer ships D-22 Path 1: chrome shell (36px top bar + 56px bottom rail + StatusIcon + HistorySheet + LogsDrawer) + Settings 16-section + Chat empty-state + Agent placeholder + 7-theme picker
- Real sidecar lifecycle wired into chrome state: `window.api.onSidecarReady` flips StatusIcon's sidecar row green; `onSidecarCrash` flips amber/red; `onSidecarLog` feeds the LogsDrawer (cap 200 lines)

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-execution policy — orchestrator validates hooks once after the wave):

1. **Task 1: Monorepo scaffold + prototype CSS port** — `8c64805` (feat)
2. **Task 2: Sidecar bootstrap + pyvts vendor + Electron spawn** — `6903559` (feat)
3. **Task 3: Chrome shell port from prototype + 16-section Settings + DevPanel** — `2c75bcf` (feat)

**Plan metadata commit:** added separately via `/gsd:execute-phase` flow (this SUMMARY + STATE + ROADMAP).

## Files Created/Modified

See `key-files.created` in frontmatter for the full list. Highlights:

- `apps/electron-main/src/sidecar.ts` — supervisor with READY_RE regex, READY_TIMEOUT_MS=10_000, CRASH_WINDOW_MS=30_000, CRASH_RESPAWN_LIMIT=3, shell:true on Windows for `uv.cmd` resolution, PYTHONUNBUFFERED=1 in spawn env
- `apps/electron-main/preload/index.ts` — exposes `getReadyUrl, onSidecarReady, onSidecarCrash, onSidecarLog, getWindowState` via `contextBridge.exposeInMainWorld('api', ...)`
- `sidecar/src/sidecar/main.py` — BYO-socket pattern: bind 127.0.0.1:0 → read `sock.getsockname()[1]` → print `[READY] ws://127.0.0.1:%d/ws` with `flush=True` → `server.serve(sockets=[sock])` → `parent_watchdog` async task wraps the lifetime
- `sidecar/src/sidecar/lifecycle/watchdog.py` — `psutil.pid_exists(parent_pid)` poll @ 2s with `os._exit(0)` on orphan
- `sidecar/vendor/pyvts/PROVENANCE.md` — upstream SHA + license + patch log template
- `apps/renderer/src/index.css` — 840 lines ported verbatim from prototype `<repo>/src/index.css`; 7 theme classes (`.theme-blush`/`-sunrise`/`-ember`/`-midnight-sky`/`-midnight-pewter`/`-onyx-sky`/`-onyx-pewter`)
- `apps/renderer/src/lib/copy.ts` — every user-visible string typed `as const`
- `apps/renderer/src/lib/icons.tsx` — 17 hand-rolled inline-SVG icons (Menu, Hexagon, MessageSquare, Wand2, Settings, ChevronUp/Down, X, Plus, Send, Search, Folder, Wrench, Cpu, ExternalLink, RotateCw, Circle)
- `apps/renderer/src/state/app-store.tsx` — single `useStore()` Provider; bridges `window.api.onSidecarReady/onCrash` into `mockStatus.sidecar` so popover stays consistent
- `apps/renderer/src/chrome/{AppShell,TopBar,BottomRail,StatusIcon,HistorySheet,LogsDrawer,ToastStack,PlaceholderPage}.tsx` — chrome components ported verbatim from prototype `<repo>/src/shell.jsx`
- `apps/renderer/src/screens/Settings/Settings.tsx` — 16-section IA: §1 Connection (functional), §2-§13 placeholders, §14 Appearance (functional 7-theme picker), §15 Diagnostics (Show log toggle + reset dialog), §16 About

## Decisions Made

- **Skip shadcn install entirely (per CONTEXT.md D-24 / DELTA).** The prototype's hand-rolled CSS + inline SVGs ship the entire chrome surface in ~840 lines + 17 icons + 11 components — smaller and more complete than the equivalent shadcn boilerplate. Tradeoff documented; no Tailwind utility classes (`h-9`, `h-14`, `min-h-[48px]`) — heights enforced via plain CSS class definitions in `index.css`.
- **uv local-path source + sys.path shim for vendored pyvts.** Hatch's editable mode produced an unusable `.pth` for our flat `vendor/pyvts/__init__.py` layout (would have required nesting as `vendor/pyvts/pyvts/__init__.py`, contradicting the must_haves artifact requirement). Compromise: install as regular wheel for dependency resolution, prepend `vendor/` to sys.path in `sidecar/__init__.py` + `tests/conftest.py`. Verified: `pyvts.__file__` resolves to `C:\...\sidecar\vendor\pyvts\__init__.py`.
- **Bridge real sidecar events into mockStatus.** The chrome's StatusIcon reads from the AppStoreProvider's `status` snapshot (which is fed by `mockStatus`). For Phase 1 we wire `window.api.onSidecarReady/onCrash` -> `mockStatus.set({sidecar: 'green'/'amber'/'red'})` so the icon reflects real lifecycle while the LLM/VTS rows stay on dev-mocks until 01-02 / Phase 4.
- **DevPanel mounted via `import.meta.env.DEV` gate** — production builds tree-shake the entire `dev/` and `dev/__mocks__/` modules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] pyvts editable-install path resolution**
- **Found during:** Task 2 (after `uv sync` succeeded but `test_pyvts_resolves_to_vendor_path` failed)
- **Issue:** `[tool.uv.sources] pyvts = { path = 'vendor/pyvts', editable = true }` produced a `.pth` file pointing at `vendor/pyvts` itself, not its parent. Python could not resolve `import pyvts` because the package's `__init__.py` lives directly inside that dir (not under a nested `pyvts/`). Hatch's `dev-mode-dirs = ['..']` directive in the editable target was silently ignored.
- **Fix:** Drop `editable=true`. Install pyvts as a regular wheel (so its dependencies — `websockets`, `aiofiles`, `opencv-python` — resolve normally and the wheel ends up in site-packages). Add a sys.path shim in `sidecar/__init__.py` and `tests/conftest.py` that prepends `<repo>/sidecar/vendor/` so `import pyvts` resolves to `vendor/pyvts/__init__.py` at runtime — which is what `must_haves.truths` requires.
- **Files modified:** `sidecar/pyproject.toml`, `sidecar/vendor/pyvts/pyproject.toml`, `sidecar/src/sidecar/__init__.py` (added shim), `sidecar/tests/conftest.py` (new file)
- **Verification:** All 4 sidecar tests pass; `uv run python -c "import sidecar; import pyvts; print(pyvts.__file__)"` prints `C:\...\sidecar\vendor\pyvts\__init__.py`.
- **Committed in:** `6903559` (Task 2 commit)

**2. [Per DELTA — not strictly a deviation but worth noting] shadcn/Tailwind install dropped**
- **Found during:** Task 1 reading
- **Issue:** Plan Task 1 Step 1.6 instructs `npx shadcn@latest init` + 13 primitive installs. DELTA explicitly supersedes this: "skip the shadcn install entirely; port `<repo-root>/src/index.css` verbatim".
- **Fix:** Followed DELTA. Renderer package.json declares only React + Vite + TS. Hand-rolled inline SVGs from prototype's `src/lib/icons.jsx` ported into `apps/renderer/src/lib/icons.tsx`. The 17 OKLCH tokens + 7 theme classes ship in `apps/renderer/src/index.css`.
- **Files modified:** `apps/renderer/package.json`, `apps/renderer/src/index.css` (840 lines), no `components.json` / `tailwind.config.ts` / `postcss.config.js`
- **Verification:** Renderer `tsc --noEmit` clean; electron-vite build succeeds (renderer bundle 616 kB JS + 26 kB CSS).
- **Committed in:** `8c64805` (Task 1 commit)

---

**Total deviations:** 2 (1 Rule 3 blocking; 1 DELTA-prescribed scope change). Both essential. No scope creep — DELTA-prescribed shadcn drop is a smaller surface than the original plan, not larger.
**Impact on plan:** All must_haves.truths satisfied. The pyvts shim is a minor runtime hook that future patches to vendor/pyvts/ will pick up automatically without re-running `uv sync` (in fact more useful than the editable install would have been).

## Issues Encountered

- **Hatch editable-install with flat package layout** — addressed via deviation #1 above. Ate ~10 min trying multiple `[tool.hatch.build.targets.editable]` configurations before reaching for the sys.path shim.
- **`mockSafeStorage.get('logsDrawer')` typing** — needed `Partial<LogsDrawerState>` cast since `unknown` doesn't spread cleanly into `LogsDrawerState`. The trailing `enabled: false` re-override (which the prototype source had) caused a TS1117 "duplicate property" error — fixed by removing the leading `enabled: false` and relying solely on the spread + override.

## User Setup Required

None — no external service configuration required. The user must:
- Have Node 22 + npm 10 installed (verified: dev machine has 22.19.0 + 10.9.3)
- Have `uv` 0.10+ installed (verified: 0.10.4)
- Have Python 3.12 available to uv (verified: cpython-3.12.11 already installed via uv)

VTube Studio is NOT required for Phase 1 plan 01-01 — pyvts is import-only here. VTS becomes mandatory in Phase 4.

## Next Phase Readiness

**Plan 01-02 (Wave 2) prerequisites all satisfied:**
- `window.api` contextBridge surface present (preload/index.d.ts is the consumable contract)
- Sidecar FastAPI app at `sidecar/src/sidecar/ws/server.py` ready for `/ws` + `/admin/llm-test` to be added
- Chrome shell has slots for the LLM Setup gate (replace `App.tsx`'s root-component routing with `hasCompletedSetup ? <AppShell /> : <LLMSetup />`) and the real Chat surface (swap `mockEcho` for WS round-trip in `screens/Chat/Chat.tsx`)
- LiteLLM 1.83.14 already in sidecar deps (resolved by `uv sync`); can be imported directly in 01-02 Task 3

**Concrete handoff for 01-02:**
- The `window.api` surface shipped:
  ```typescript
  interface RendererApi {
    getReadyUrl: () => Promise<string | null>
    onSidecarReady: (cb: (url: string) => void) => () => void
    onSidecarCrash: (cb: (info: { code: number; willRespawn: boolean }) => void) => () => void
    onSidecarLog: (cb: (line: string) => void) => () => void
    getWindowState: () => Promise<{ width: number; height: number; x?: number; y?: number }>
  }
  ```
  01-02 will extend this with `setStoredValue / getStoredValue` (Electron safeStorage IPC).

- Sidecar `[READY]` line format locked: `[READY] ws://127.0.0.1:<port>/ws` (no whitespace variations).

- pyvts vendor SHA recorded for Phase 4 patch tracking: `2792d6a33a4e51bf24670225244f7e2a586ea83e`.

- Files added to `sidecar/` not in plan's `files_modified`:
  - `sidecar/uv.lock` (intentional — locked dependency graph)
  - `sidecar/tests/conftest.py` (new — vendor sys.path shim for tests)
  - `sidecar/vendor/pyvts/error.py` (vendored from upstream sdist; the plan's file list missed this minor module)

- Files added to `apps/renderer/src/` not in plan's `files_modified`:
  - `apps/renderer/src/lib/copy.ts`, `lib/icons.tsx` (DELTA-introduced; prototype port)
  - `apps/renderer/src/state/{theme-provider,app-store}.tsx` (DELTA-introduced; replaces shadcn's theming + tooltip primitives)
  - `apps/renderer/src/dev/DevPanel.tsx` + `dev/__mocks__/mock-backend.ts` (DELTA-prescribed)
  - `apps/renderer/src/chrome/ToastStack.tsx` (DELTA-prescribed; mounted by AppShell)

## Self-Check: PASSED

- `apps/electron-main/src/sidecar.ts` — FOUND (with READY_RE, PYTHONUNBUFFERED, spawn('uv', …))
- `apps/electron-main/preload/index.ts` — FOUND (with exposeInMainWorld('api', …))
- `sidecar/src/sidecar/main.py` — FOUND (with `[READY] ws://127.0.0.1:` and `flush=True`)
- `sidecar/src/sidecar/lifecycle/watchdog.py` — FOUND (with psutil.pid_exists, os._exit(0), 2.0s poll)
- `sidecar/pyproject.toml` — FOUND (with `[tool.uv.sources]`, `path = "vendor/pyvts"`, Python 3.12 pin)
- `sidecar/vendor/pyvts/__init__.py` — FOUND
- `sidecar/vendor/pyvts/PROVENANCE.md` — FOUND (with upstream SHA, MIT license note, PyPI release v0.3.3)
- `apps/renderer/src/chrome/AppShell.tsx` — FOUND (54 lines)
- `apps/renderer/src/chrome/PlaceholderPage.tsx` — FOUND (24 lines)
- Commit `8c64805` — FOUND (`feat(01-01): scaffold Electron+React+Vite monorepo with prototype CSS`)
- Commit `6903559` — FOUND (`feat(01-01): bootstrap Python sidecar + vendor pyvts 0.3.3 + Electron spawn`)
- Commit `2c75bcf` — FOUND (`feat(01-01): port chrome shell + 16-section settings + dev panel from prototype`)
- 4 sidecar tests passing — VERIFIED
- Renderer `npx tsc --noEmit` exits 0 — VERIFIED
- Electron-vite build succeeds (main 7.49 kB, preload 0.83 kB, renderer 616 kB) — VERIFIED

---

*Phase: 01-plumbing-process-lifecycle*
*Completed: 2026-05-06*
