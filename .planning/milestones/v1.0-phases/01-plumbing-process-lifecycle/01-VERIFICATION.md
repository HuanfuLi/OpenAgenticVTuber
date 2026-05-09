---
phase: 01-plumbing-process-lifecycle
verified: 2026-05-06T23:30:00Z
status: passed
score: 5/5 must-haves verified; 4/4 human-verification items also passed live after four targeted fixes (see 01-HUMAN-UAT.md and commits d1e221e/5b59959/5300a24/9bc78f0)
re_verification: 2026-05-07T00:35:00Z
human_verified: true
human_verification:
  - test: "npm run dev on a clean clone boots the full stack"
    expected: "Electron window opens, sidecar spawns from venv, log panel shows [READY] line, status icon turns green"
    why_human: "Requires launching the actual Electron GUI; programmatic check verifies all underlying machinery (sidecar boot test passes, [READY] regex correct, IPC bridge wired) but cannot observe a live window"
  - test: "Force-quit Electron via Task Manager and immediately relaunch"
    expected: "Sidecar process terminates within ~2s of Electron death (watchdog poll cycle); next launch picks a new ephemeral port and starts cleanly"
    why_human: "Requires Task Manager interaction on a running system; port:0 ephemeral binding makes collision impossible by construction (sock.bind(127.0.0.1, 0) + SO_REUSEADDR), and parent_watchdog with psutil.pid_exists at 2s polling kills the orphan, but live verification needs human Task Manager kill + observation"
  - test: "Real LM Studio /admin/llm-test 1-token completion succeeds end-to-end"
    expected: "With LM Studio running on localhost:1234 with a model loaded, [Test connection] streams success lines and SUCCESS_SENTINEL 'Connection looks good. You can continue.' enables [Continue]; [Continue] persists safeStorage blob and unblocks the chrome shell"
    why_human: "Requires a running LM Studio instance with a loaded model — external service the executor cannot stand up. The sidecar code path (litellm.acompletion with max_tokens=1, real exception mapping for httpx.ConnectError / AuthenticationError / Timeout / etc.) is verified by code inspection + tests/test_setup_test_handlers.py, but the success path is gated on a third-party app"
  - test: "Type 'hello' in the chat input and observe 'echo: hello' as an assistant bubble"
    expected: "User bubble with 'hello' renders immediately; assistant bubble with 'echo: hello' follows after WS round-trip (~10-50ms)"
    why_human: "End-to-end click-through; the underlying round-trip is programmatically verified by sidecar test_text_input_echoes (PASSED) which confirms text-input -> display-text echo at the WS layer"
---

# Phase 1: Plumbing & Process Lifecycle — Verification Report

**Phase Goal:** "A typed WebSocket round-trip works end-to-end — `npm run dev` boots Electron, which spawns the Python sidecar from venv, the renderer connects via WS, an 'echo' message round-trips, and the mandatory LLM setup screen blocks first launch until LM Studio answers a real completion call."

**Verified:** 2026-05-06T23:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #   | Truth                                                                                                                                | Status        | Evidence                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm run dev` boots the full stack on a clean clone (Electron + sidecar + READY)                                                     | ? HUMAN       | Programmatic: package.json has `dev: npm --workspace apps/electron-main run dev` -> `electron-vite dev`; sidecar boot test passes (test_sidecar_boots_and_emits_ready_line PASSED); electron-vite build clean. Live GUI launch needs human eyes to confirm window opens and StatusIcon shows green. |
| 2   | Force-quitting Electron + immediate relaunch is collision-free; orphan handling works                                                | ? HUMAN       | Programmatic: port:0 ephemeral bind (sidecar/main.py:24-26) makes collision structurally impossible; parent-PID watchdog (sidecar/lifecycle/watchdog.py) calls `psutil.pid_exists` at 2s polling and `os._exit(0)` on orphan. Real Task-Manager kill needs human verification.                                                                  |
| 3   | First-launch flow shows mandatory LLM setup screen, blocks until real 1-token LM Studio completion                                   | ? HUMAN       | Programmatic: `App.tsx` GatedShell renders `<LLMSetup />` when `phase==='setup-required'` (setup-store.ts:34); `setup_test.py` calls `litellm.acompletion(max_tokens=1, timeout=120)` on LiteLLM 1.83.14; full exception->user-line mapping verified. Real LM Studio handshake needs human.                                                     |
| 4   | Typing 'hello' in chat input round-trips through sidecar and renders 'echo: hello'                                                   | ✓ VERIFIED    | sidecar test_text_input_echoes PASSED — sends `{"type":"text-input","text":"hello"}` over real WS, receives `{"type":"display-text","text":"echo: hello"}`. Renderer Chat.tsx wires send + appendUserMessage; ws/store.ts subscribes display-text -> assistant bubble. Live click-through nice-to-have but core round-trip programmatically verified. |
| 5   | `sidecar/vendor/pyvts/` exists and is importable; vendor stub-loads without contacting VTS                                          | ✓ VERIFIED    | All 3 pyvts tests pass: test_pyvts_imports, test_pyvts_resolves_to_vendor_path (asserts pyvts.\_\_file\_\_ contains "vendor/pyvts"), test_pyvts_import_does_not_open_websocket. PROVENANCE.md present (upstream SHA 2792d6a..., MIT, PyPI v0.3.3).                                                                                              |

**Score:** 2/5 fully programmatically verified; 3/5 require human verification due to GUI / external-service dependencies. All underlying machinery for the human-verification items is programmatically verified.

### Required Artifacts

| Artifact                                                  | Expected                                                                       | Status     | Details                                                                                                                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/electron-main/src/sidecar.ts`                       | spawn + READY-parse + watchdog + crash circuit-breaker; contains `READY_RE`    | ✓ VERIFIED | 180 lines. `READY_RE = /^\[READY\] (ws:\/\/127\.0\.0\.1:(\d+)\/ws)$/`, `CRASH_WINDOW_MS=30_000`, `CRASH_RESPAWN_LIMIT=3`, spawn('uv', ['run','python','-m','sidecar']), shell:true on Windows. |
| `apps/electron-main/src/index.ts`                         | Electron app entry; whenReady -> spawn sidecar -> createWindow                  | ✓ VERIFIED | `app.whenReady().then(...)` mounts window, registerIpc, spawnSidecar (line 70+); before-quit calls shutdownSidecar.                                                                              |
| `apps/electron-main/preload/index.ts`                     | contextBridge.exposeInMainWorld API                                            | ✓ VERIFIED | `contextBridge.exposeInMainWorld('api', api)` exposes 8 methods (5 from 01-01 + 3 from 01-02 safeStorage).                                                                                       |
| `sidecar/src/sidecar/main.py`                             | port:0 socket bind + READY line + uvicorn serve(sockets=[sock])                 | ✓ VERIFIED | `sock.bind(("127.0.0.1", 0))`, `print(f"[READY] ws://127.0.0.1:{port}/ws", flush=True)`, `await server.serve(sockets=[sock])`. SO_REUSEADDR set.                                                |
| `sidecar/src/sidecar/lifecycle/watchdog.py`               | psutil parent-PID watchdog at 2s polling                                       | ✓ VERIFIED | `psutil.pid_exists(parent_pid)` with `poll_interval: float = 2.0`; `os._exit(0)` on orphan.                                                                                                       |
| `sidecar/pyproject.toml`                                  | uv project config with pyvts path source + Python 3.12 pin                      | ✓ VERIFIED | `[tool.uv.sources] pyvts = { path = "vendor/pyvts" }`, `requires-python = ">=3.12,<3.13"`, contracts also path-sourced.                                                                          |
| `sidecar/vendor/pyvts/PROVENANCE.md`                      | Vendor record (upstream, license, snapshot, patch log)                          | ✓ VERIFIED | Upstream: github.com/Genteki/pyvts; License: MIT; Snapshot: PyPI release v0.3.3; Upstream commit SHA: 2792d6a33a4e51bf24670225244f7e2a586ea83e; patch log section present.                       |
| `apps/renderer/src/chrome/AppShell.tsx`                   | Top bar + bottom rail + route content slot + drawer mounting (≥30 lines)        | ✓ VERIFIED | 69 lines; mounts TopBar, BottomRail, HistorySheet, LogsDrawer, ToastStack; routes Chat/Agent/Settings via `view` state.                                                                          |
| `apps/renderer/src/chrome/PlaceholderPage.tsx`            | Branded placeholder (≥10 lines)                                                | ✓ VERIFIED | 23 lines.                                                                                                                                                                                         |
| `packages/contracts/py/contracts/ws_message.py`           | Pydantic discriminated-union envelope                                           | ✓ VERIFIED | `WSMessage = Annotated[Union[TextInputMessage, DisplayTextMessage, ShutdownMessage], Field(discriminator="type")]`. Note: lives at nested `contracts/` per Hatch packaging fix (see Deviations). |
| `packages/contracts/ts/ws-message.ts`                     | Hand-written TS mirror; `type WSMessage =`                                     | ✓ VERIFIED | All three message types + WSMessage union + isTextInput/isDisplayText/isShutdown type guards.                                                                                                     |
| `sidecar/src/sidecar/ws/protocol.py`                      | OLVT-shape dispatcher: route(websocket, raw)                                    | ✓ VERIFIED | `_handlers: dict[str, Handler]`, `def on(msg_type)`, `async def route(...)`. Unknown types silently dropped per OLVT semantics.                                                                  |
| `sidecar/src/sidecar/ws/handlers.py`                      | Echo handler for text-input -> display-text                                     | ✓ VERIFIED | `@on("text-input")` and `@on("shutdown")`; echo prefix `f"echo: {text}"`.                                                                                                                         |
| `sidecar/src/sidecar/llm/setup_test.py`                   | POST /admin/llm-test SSE with litellm.acompletion + max_tokens=1                 | ✓ VERIFIED | `litellm.acompletion(model=model_arg, api_base=..., max_tokens=1, timeout=120, stream=False)`; full exception mapping for APIConnectionError, AuthenticationError, Timeout, BadRequest, NotFound, httpx.ConnectError. |
| `apps/electron-main/src/safe-storage.ts`                  | ProviderConfig + StoredConfig encrypt/decrypt                                   | ✓ VERIFIED | `safeStorage.encryptString` / `safeStorage.decryptString` to `llm-config.enc` in userData; schemaVersion guard for v2 re-prompt.                                                                  |
| `apps/renderer/src/screens/LLMSetup/LLMSetup.tsx`         | Mandatory setup screen — blocks until successful test (≥80 lines)              | ✓ VERIFIED | 230 lines; 5-option provider select (LM Studio / Custom OpenAI / OpenAI⏳ / Anthropic⏳ / Gemini⏳); [Continue] disabled until `phase === 'success'`; calls `completeSetup` on continue.            |
| `apps/renderer/src/screens/LLMSetup/TestLog.tsx`          | Verbose multi-line streamed log panel (≥40 lines)                              | ✓ VERIFIED | 193 lines; consumes `/admin/llm-test` via `fetch().body.getReader() + TextDecoder({stream:true})`; `classify()` colors lines info/error/muted/ok/ok-bold; SUCCESS_SENTINEL flips parent phase.   |
| `apps/renderer/src/ws/client.ts`                          | Singleton WS client w/ reconnect 1s/2s/4s capped (≥40 lines)                    | ✓ VERIFIED | 117 lines; `BACKOFF_MS = [1_000, 2_000, 4_000]`, `window.api.getReadyUrl`, `subscribe`/`subscribeState`/`send`/`ensureConnected` exports.                                                        |

**All 17 artifacts pass exists + substantive + wired (Levels 1-3).** Two artifacts (Chat data flow, App gating) further verified at Level 4 below.

### Key Link Verification

| From                                                             | To                                  | Via                                                              | Status     | Details                                                                                                                                                       |
| ---------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/electron-main/src/sidecar.ts`                              | `sidecar/src/sidecar/main.py`       | `child_process.spawn('uv', ['run','python','-m','sidecar'])`     | ✓ WIRED    | Line 61-69: `spawn('uv', ['run', 'python', '-m', 'sidecar'])` with cwd=sidecarRoot, PYTHONUNBUFFERED=1, shell:true on Windows.                                |
| `sidecar/src/sidecar/main.py`                                    | stdout READY line                   | `print('[READY] ws://127.0.0.1:%d/ws' % port, flush=True)`       | ✓ WIRED    | Line 31: `print(f"[READY] ws://127.0.0.1:{port}/ws", flush=True)`.                                                                                            |
| `apps/electron-main/preload/index.ts`                            | renderer (contextBridge)            | `window.api.getReadyUrl(), onSidecarCrash(cb)`                   | ✓ WIRED    | `contextBridge.exposeInMainWorld('api', api)` (line 41); 8 methods exposed; renderer types via `@preload-types` alias.                                        |
| `sidecar/pyproject.toml`                                         | `sidecar/vendor/pyvts`              | `[tool.uv.sources] pyvts = { path = "vendor/pyvts" }`            | ✓ WIRED    | Lines 18-19; supplemented by sys.path shim in `sidecar/__init__.py` so import resolves to vendor copy.                                                       |
| `apps/renderer/src/screens/Chat/Chat.tsx`                        | `apps/renderer/src/ws/client.ts`    | `send({type: 'text-input', text})`                               | ✓ WIRED    | Line 60: `const ok = send({ type: 'text-input', text })`. `appendUserMessage(text)` (line 58) renders user bubble.                                            |
| `apps/renderer/src/ws/client.ts`                                 | `ws://127.0.0.1:<port>/ws`          | `new WebSocket(url) where url = window.api.getReadyUrl()`        | ✓ WIRED    | Line 77: `const url = await window.api.getReadyUrl()`; line 44: `const socket = new WebSocket(url)`. Auto-bootstraps via `void ensureConnected()` at module load. |
| `sidecar/src/sidecar/ws/server.py`                               | `sidecar/src/sidecar/ws/handlers.py`| `@app.websocket('/ws')` -> `protocol.route(ws, raw)`              | ✓ WIRED    | Line 20-28: `@app.websocket("/ws")` calls `await route(ws, raw)`. `handlers.py` import (line 7) registers @on decorators via side effect.                    |
| `apps/renderer/src/screens/LLMSetup/TestLog.tsx`                 | `/admin/llm-test`                   | `fetch(http://127.0.0.1:<port>/admin/llm-test)` + getReader      | ✓ WIRED    | Line 96-105: `fetch(url, {method: 'POST', body: JSON.stringify({...})})` where `url = ws.replace(/^ws/, 'http').replace(/\/ws$/, '') + '/admin/llm-test'`.    |
| `apps/electron-main/src/safe-storage.ts`                         | `%APPDATA%/AgenticLLMVTuber/...enc` | `fs.writeFileSync(storePath, safeStorage.encryptString(json))`   | ✓ WIRED    | Lines 58-62: `safeStorage.encryptString(json)` -> `fs.writeFileSync(storePath(), buf, {mode: 0o600})` to `app.getPath('userData')/llm-config.enc`.            |
| `apps/renderer/src/App.tsx`                                      | `window.api.getStoredConfig()`      | `if (!cfg?.hasCompletedSetup) -> LLMSetup; else -> AppShell`     | ✓ WIRED    | App.tsx GatedShell uses `useSetupState()`; setup-store.ts:31 `await window.api.getStoredConfig()`; line 32-36 sets phase based on `hasCompletedSetup`.       |

**All 10 key links verified WIRED.**

### Data-Flow Trace (Level 4)

| Artifact                                | Data Variable                  | Source                                                          | Produces Real Data | Status    |
| --------------------------------------- | ------------------------------ | --------------------------------------------------------------- | ------------------ | --------- |
| `Chat.tsx` (assistant bubbles)          | `wsBubbles` from `useChatBubbles()` | ws/store.ts subscribes to `client.subscribe()`; on display-text -> pushBubble | Yes — real WS messages dispatched from sidecar handlers.py echo handler | ✓ FLOWING |
| `App.tsx` (GatedShell phase)            | `setup` from `useSetupState()`     | setup-store.ts boot calls `window.api.getStoredConfig()` -> ipcMain `config:load` -> safe-storage.ts `loadConfig()` -> reads `llm-config.enc` | Yes — real safeStorage decrypted JSON | ✓ FLOWING |
| `AppShell.tsx` (logsDrawer logLines)    | `logLines` (state)             | useEffect subscribes to `window.api.onSidecarLog` -> ipcRenderer 'sidecar:log' -> ipc.ts `onLog` callback -> sidecar.ts `subscribers.log` -> stdout/stderr 'data' event from spawned child | Yes — real sidecar process stdout | ✓ FLOWING |
| `TestLog.tsx` (lines)                   | `lines` (state)                | `fetch('/admin/llm-test')` -> setup_test.py StreamingResponse -> real `litellm.acompletion` (with max_tokens=1) -> yields per-line text/plain chunks | Yes — real LiteLLM call when LM Studio reachable; mapped exception text otherwise | ✓ FLOWING |
| `Chat.tsx` (`wsOpen` for input disable) | `wsOpen` from `useWSConnected()`   | ws/store.ts subscribes to `subscribeState` -> client.ts emits on socket.open/close events | Yes — real WS connection state | ✓ FLOWING |

All data sources produce real data — no hardcoded empty arrays, no static fallback returns. The `mockBanners` flags in Chat.tsx are explicitly DEV-only (gated behind devpanel triggers; production tree-shakes them).

### Behavioral Spot-Checks

| Behavior                                                    | Command                                                            | Result                                                                  | Status |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------ |
| Sidecar boots and emits READY line within 15s              | `cd sidecar && uv run pytest tests/test_sidecar_boot.py -v`       | PASSED (24.72s suite total)                                             | ✓ PASS |
| Echo round-trip (text-input -> display-text)                | `cd sidecar && uv run pytest tests/test_ws_echo.py -v`            | 3/3 PASSED (echo, unknown-dropped, extra-fields-passthrough)            | ✓ PASS |
| pyvts vendor import resolves to sidecar/vendor/pyvts        | `cd sidecar && uv run pytest tests/test_pyvts_import.py -v`       | 3/3 PASSED                                                              | ✓ PASS |
| /admin/llm-test endpoint exists and validates body          | `cd sidecar && uv run pytest tests/test_setup_test_handlers.py -v`| 2/2 PASSED                                                              | ✓ PASS |
| Renderer typecheck                                          | `cd apps/renderer && npx tsc --noEmit`                             | Exit code 0 (no output)                                                 | ✓ PASS |
| Electron-vite production build                              | `cd apps/electron-main && npx electron-vite build`                  | Main 8.72 kB, preload 1.08 kB, renderer 635 kB JS + 26 kB CSS — clean    | ✓ PASS |
| Live `npm run dev` launch                                   | (would launch Electron GUI)                                        | Skipped — needs human eyes                                              | ? SKIP |

**Total automated checks: 6/6 PASS.** All 9 sidecar pytest cases pass.

### Requirements Coverage

| Requirement | Source Plan(s)        | Description                                                                                                                                                       | Status      | Evidence                                                                                                                                                                                                                                              |
| ----------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PLUMB-01    | 01-01                 | Electron + React + Vite + TS shell with npm package manager                                                                                                       | ✓ SATISFIED | Electron 40.4.0, React 19.2.0, Vite 6.4.2, TypeScript 5.9.3 in apps/electron-main + apps/renderer; npm workspaces in root package.json; electron-vite build clean.                                                                                    |
| PLUMB-02    | 01-01                 | Electron main spawns Python sidecar under uv venv with eager-start, parent-PID watchdog, graceful-shutdown handshake                                              | ✓ SATISFIED | sidecar.ts `spawn('uv', ['run','python','-m','sidecar'])` inside `app.whenReady`; lifecycle/watchdog.py psutil polling at 2s; before-quit calls shutdownSidecar with 5s soft timeout. test_sidecar_boots_and_emits_ready_line PASSED.                  |
| PLUMB-03    | 01-02                 | Localhost-only WebSocket whose envelope shape matches OLVT; port-allocation strategy is decided at planning (port:0 ephemeral chosen)                              | ✓ SATISFIED | sidecar binds 127.0.0.1:0 (port:0 ephemeral); WSMessage discriminated union (TextInput/DisplayText/Shutdown); test_text_input_echoes + test_unknown_type_silently_dropped + test_envelope_with_extra_fields_passes_through all PASSED.                |
| PLUMB-04    | 01-02                 | Mandatory LLM setup screen with provider URL/key + test-connection round-trip; blocks app until successful test; LM Studio default at localhost:1234/v1 pre-filled | ? SATISFIED (programmatic) / NEEDS HUMAN (live) | LLMSetup.tsx + ProviderSelect.tsx + TestLog.tsx render setup screen; `phase === 'success'` gates [Continue]; setup_test.py calls real litellm.acompletion(max_tokens=1, timeout=120). Real LM Studio handshake needs human verification. |
| PLUMB-05    | 01-01                 | pyvts vendored at sidecar/vendor/pyvts/ from day one with PROVENANCE.md and in-tree patch capability                                                              | ✓ SATISFIED | sidecar/vendor/pyvts/__init__.py + vts.py + vts_request.py + config.py + error.py + LICENSE + PROVENANCE.md present. PyPI v0.3.3, upstream SHA recorded. All 3 import tests PASSED.                                                                  |

**Coverage:** 5/5 requirements present. 4/5 fully satisfied programmatically; PLUMB-04's live LM Studio handshake needs human spot-check (the code path is verified — only the third-party-app integration step is not).

**Orphaned requirements:** None. REQUIREMENTS.md maps PLUMB-01..05 to Phase 1, and all 5 are claimed by either 01-01 or 01-02.

### Anti-Patterns Found

None. Grep for `TODO|FIXME|XXX|HACK|PLACEHOLDER|placeholder|coming soon|will be here|not yet implemented` against `apps/electron-main/src`, `sidecar/src`, and `apps/renderer/src` returned zero matches.

The "(Coming in v2)" suffixes on disabled provider options in ProviderSelect.tsx are intentional UI copy (sourced from COPY.LLM_SETUP.PROVIDERS), not stub markers — they communicate which dropdown options will become functional in v2 per CONTEXT.md D-06.

The `mock-backend.ts` and `DevPanel.tsx` files are DEV-only scaffolding tree-shaken by `import.meta.env.DEV` at consumer mount sites; they are not anti-patterns but design-review tooling.

### Human Verification Required

#### 1. `npm run dev` boot on a clean clone

**Test:** From a fresh clone of the repo (or after `rm -rf node_modules sidecar/.venv`), run `npm install`, `cd sidecar && uv sync`, `cd .. && npm run dev`.
**Expected:** Within ~5 seconds, the Electron window opens. The LLM Setup screen renders (no chrome shell yet — the gate is in front). The LogsDrawer (toggle from settings) shows lines like `INFO:     Started server process ...`, `INFO:     Uvicorn running on ...`, etc., and at least one `[READY] ws://127.0.0.1:<port>/ws` line.
**Why human:** Programmatic boot test passes, but live GUI launch needs eyes. The integration glue (window.api wired via contextBridge, sidecar.ts subscriber pattern, setup-store boot flow) has been verified by code inspection.

#### 2. Force-quit recovery

**Test:** With the app running, open Task Manager (or `taskkill /F /IM electron.exe` on Windows / `kill -9` on POSIX), confirm the python.exe sidecar process dies within ~2-3s. Immediately relaunch with `npm run dev`.
**Expected:** No port-collision error; the new sidecar binds a fresh ephemeral port; READY line emits as before; setup screen or chrome shell mounts as appropriate (depending on whether safeStorage was already populated).
**Why human:** Force-kill semantics differ slightly across OSes; the watchdog's `psutil.pid_exists` polling at 2s is verified by code, but observing the timing on a real system ensures no hidden race exists in WSL/macOS/etc.

#### 3. Real LM Studio 1-token completion success path

**Test:** Start LM Studio. Load a model (any small instruct model — qwen2.5-7b-instruct or similar). Start the local server on default port 1234. Run `npm run dev`. On the LLM Setup screen, leave defaults. Click [Test connection].
**Expected:** TestLog streams: `▸ Resolving endpoint http://localhost:1234/v1...` -> `▸ GET /v1/models -- 200 OK (1 model(s); using <id>)` -> `▸ POST /v1/chat/completions   prompt="hi"  max_tokens=1` -> `▸ Streaming response...` -> `✓ Received 1 token in <X> ms` -> blank line -> `Connection looks good. You can continue.` (bold). [Continue →] enables. Click it. Chrome shell mounts.
**Why human:** Requires a running LM Studio app — third-party software the executor cannot install/configure. The sidecar code path is verified by code inspection + the `test_admin_llm_test_endpoint_exists` integration test (which exercises the unreachable-endpoint branch end-to-end).

#### 4. Echo round-trip live click-through

**Test:** After completing setup (or with safeStorage pre-populated), in the chrome shell's Chat surface, type `hello` and press Enter.
**Expected:** Within ~50ms, a user bubble with "hello" appears, followed by an assistant bubble with "echo: hello".
**Why human:** Programmatically verified by `test_text_input_echoes` PASSED at the WS layer. The renderer plumbing (Chat.tsx -> ws/client.ts -> ws/store.ts assistant-bubble dispatch) is code-inspected and typechecked clean. Live click-through is a reasonable nice-to-have spot-check before declaring the phase complete.

### Gaps Summary

**No gaps blocking goal achievement.** All 17 artifacts exist, are substantive, and are wired. All 10 key links verified. All 5 data flows trace to real sources (no hardcoded empties or static fallbacks). All 9 sidecar tests pass; renderer typecheck clean; electron-vite build clean.

The 3 SC items flagged ?HUMAN are programmatically gated by external dependencies (live Electron GUI, OS Task Manager, third-party LM Studio app) — the underlying machinery is fully verified and the human spot-check is a final live confirmation before the phase tag.

**Notable design strengths verified:**

- Port:0 ephemeral binding makes port-collision impossible by construction (PLUMB-02 SC-2 satisfied at the architectural level).
- Parent-PID watchdog at 2s polling kills orphan sidecars within ~2-3s on Windows (no PR_SET_PDEATHSIG dependency).
- OLVT-shape envelope contract is locked: TextInput/DisplayText/Shutdown discriminated union, unknown types silently dropped, extra fields pass through. test_envelope_with_extra_fields_passes_through proves Phase 2+ extension fields (history_uid etc.) won't break the dispatcher.
- DELTA-prescribed prototype port (CSS, icons, chrome components) shipped without shadcn/Tailwind — smaller surface and verified renderer typecheck-clean.
- Hatch packaging pivots in both 01-01 (pyvts sys.path shim) and 01-02 (contracts nested-layout) are documented in their respective SUMMARYs and verified by tests.

**Acceptance hooks pre-acknowledged by 01-PROTOTYPE-DELTA.md:**

The DELTA explicitly supersedes shadcn-presence checks, the original `screens/LLMSetup/TestLog.tsx` separate-file requirement (compromise: standalone file with `key`-bump remount pattern shipped), and OKLCH-token greps. All DELTA-prescribed deviations are verified-as-shipped (no shadcn install, hand-rolled CSS at 840 lines, inline SVG icons, native `<select>` for ProviderSelect with title-attribute disabled tooltip).

---

_Verified: 2026-05-06T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
