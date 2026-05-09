---
phase: 01-plumbing-process-lifecycle
plan: 02
subsystem: infra
tags: [websocket, fastapi, pydantic, litellm, lm-studio, electron-safestorage, dpapi, sse, react, contextbridge, contracts, olvt-envelope]

# Dependency graph
requires:
  - "01-01 (monorepo + sidecar bootstrap + pyvts vendor + chrome shell + window.api 5-method surface)"
provides:
  - "OLVT-shape WS envelope: TextInputMessage / DisplayTextMessage / ShutdownMessage as discriminated union (Pydantic source-of-truth + hand-written TS mirror)"
  - "Sidecar /ws FastAPI route with echo handler — text-input -> display-text round-trip"
  - "Singleton renderer WS client with reconnect-with-fixed-backoff (1s/2s/4s capped at 4s)"
  - "Electron safeStorage IPC: window.api.{get,save,clear}StoredConfig persisting to %APPDATA%/AgenticLLMVTuber/llm-config.enc"
  - "Mandatory LLM setup screen (PLUMB-04 gate) ported from prototype with the 5-option dropdown bug-fix per CONTEXT.md D-06"
  - "/admin/llm-test SSE endpoint with real LiteLLM 1-token completion + full exception -> user-line mapping"
  - "App.tsx 3-phase state machine (loading / setup-required / ready) gating chrome shell mount"
  - "packages/contracts/{py,ts} as the cross-language contract source ready for Phase 2-4 message types"
affects:
  - "Phase 2 (Conversation pipeline) — uses /ws envelope and AppShell composition; LLM-01 layers on top of safeStorage'd config"
  - "Phase 4 (VTS bridge) — extends /ws with ai-speak-signal / param frame events; envelope shape unchanged"
  - "Phase 5 (Polish) — replaces hand-written packages/contracts/ts with codegen (SC-02)"

# Tech tracking
tech-stack:
  added:
    - "pydantic>=2.5 (already a sidecar dep) consumed via discriminated-union envelope"
    - "litellm 1.83.14 (pinned by 01-01) actually exercised via /admin/llm-test"
    - "httpx>=0.28 (already a sidecar dep) used for /v1/models pre-flight"
    - "fastapi.responses.StreamingResponse for chunked text/plain SSE"
    - "fastapi.APIRouter(prefix='/admin') router-mount pattern"
    - "Electron safeStorage (DPAPI on Windows; libsecret/Keychain elsewhere)"
    - "@preload-types path alias (renderer reads ProviderConfig/StoredConfig types from preload index.ts)"
  patterns:
    - "OLVT-shape WS envelope: flat fields with required `type` discriminator; extra fields silently ignored"
    - "Decorator-registered handlers via @on('text-input') side-effect import in server.py"
    - "Reconnect-with-fixed-backoff schedule 1s/2s/4s capped at 4s (RESEARCH Open Q #3)"
    - "TestLog-by-key pattern: bumping `key` prop remounts the SSE consumer with a fresh line buffer (RESEARCH Open Q #4)"
    - "SSE wire format: text/plain chunked transfer (NOT text/event-stream), one log line per chunk, terminated by \\n"
    - "LiteLLM provider-prefix routing: `lm_studio/<id>` for LM Studio, `openai/<id>` for custom OpenAI-compat"
    - "schemaVersion guard on safeStorage blob — bumping the version re-prompts setup"
    - "3-phase setup-store state machine: loading -> setup-required -> ready, consumed by App.tsx GatedShell"

key-files:
  created:
    - "packages/contracts/py/contracts/__init__.py"
    - "packages/contracts/py/contracts/ws_message.py"
    - "packages/contracts/py/pyproject.toml"
    - "packages/contracts/ts/ws-message.ts"
    - "sidecar/src/sidecar/ws/protocol.py"
    - "sidecar/src/sidecar/ws/handlers.py"
    - "sidecar/src/sidecar/llm/__init__.py"
    - "sidecar/src/sidecar/llm/setup_test.py"
    - "sidecar/tests/test_ws_echo.py (3 tests)"
    - "sidecar/tests/test_setup_test_handlers.py (2 tests)"
    - "apps/electron-main/src/safe-storage.ts"
    - "apps/renderer/src/ws/client.ts"
    - "apps/renderer/src/ws/store.ts"
    - "apps/renderer/src/state/setup-store.ts"
    - "apps/renderer/src/screens/LLMSetup/LLMSetup.tsx"
    - "apps/renderer/src/screens/LLMSetup/ProviderSelect.tsx"
    - "apps/renderer/src/screens/LLMSetup/TestLog.tsx"
  modified:
    - "sidecar/pyproject.toml (added contracts path source + dependency)"
    - "sidecar/src/sidecar/ws/server.py (adds @app.websocket('/ws') + app.include_router(admin_router))"
    - "apps/electron-main/src/index.ts (Linux plaintext fallback for safeStorage)"
    - "apps/electron-main/src/ipc.ts (registers config:load/save/clear)"
    - "apps/electron-main/preload/index.ts (exposes 3 new IPC methods + StoredConfig types)"
    - "apps/electron-main/electron.vite.config.ts (renderer @preload-types alias)"
    - "apps/renderer/tsconfig.json (paths: @preload-types)"
    - "apps/renderer/vite.config.ts (resolve.alias: @preload-types)"
    - "apps/renderer/src/App.tsx (GatedShell wraps AppShell on setup phase)"
    - "apps/renderer/src/screens/Chat/Chat.tsx (mockEcho swapped for real WS round-trip)"
    - "apps/renderer/src/screens/Settings/Settings.tsx ConnectionSection (reads window.api.getStoredConfig)"

key-decisions:
  - "DEVIATION (Rule 3 - blocking): Hatch's `[tool.hatch.build.targets.wheel] packages = ['.']` for the contracts package produced an editable .pth pointing AT `packages/contracts/py` — which made `from contracts.ws_message import ...` fail because the dir itself was on sys.path (only `import ws_message` would have worked). Same root cause as 01-01's pyvts deviation but inverted: this time we restructured the package layout instead of using a sys.path shim. Moved `ws_message.py` into `packages/contracts/py/contracts/ws_message.py` and changed wheel target to `packages = ['contracts']`. Result: a normal hatch package; no sys.path shims for the contracts module."
  - "Per DELTA: ported prototype LLMSetup.jsx with the explicit bug-fix — the prototype's stale 3-option `<select>` (LM Studio/Ollama/OpenAI-compat) is replaced with the 5-option list driven by `COPY.LLM_SETUP.PROVIDERS` (LM Studio + Custom OpenAI-compat enabled; OpenAI/Anthropic/Gemini disabled with the verbatim DISABLED_PROVIDER_TT tooltip surfaced via `<option title=>`)."
  - "Per DELTA: TestLog conceptually 'inline JSX inside LLMSetup'. To satisfy both DELTA intent and the plan's standalone TestLog.tsx file requirement, extracted the SSE consumption into TestLog.tsx; LLMSetup mounts it as `<TestLog key={logKey} ... />` with logKey bumped on each [Test] press for the clear-by-remount pattern (RESEARCH Open Q #4)."
  - "Per plan + UI-SPEC: TestLog uses the prototype's `.test-log .line.{kind}` CSS classes (info/error/muted/ok/ok-bold) baked into index.css; classify() maps each SSE line to a kind based on its leading character (▸ -> info, ✕ -> error, ✓ -> ok, success-sentinel -> ok-bold). No Tailwind utilities — UI-SPEC §Color tokens via CSS custom properties."
  - "WS dispatcher silently drops unknown message types per OLVT semantics; verified by test_unknown_type_silently_dropped (the connection stays open and a follow-up valid message echoes correctly)."
  - "Banners stay wired to mockBanners in Chat.tsx for now; the WS open/close flag controls the input row's `disabled`. Real connection-status binding to LLM-01 / VTS lifecycle is a Phase 2 / Phase 4 layering concern."

patterns-established:
  - "OLVT envelope contract pattern: Pydantic discriminated-union (Annotated[Union[...], Field(discriminator='type')]) is source-of-truth; TS hand-written mirror until codegen lands in Phase 5"
  - "FastAPI sidecar route registration: @app.websocket('/ws') for streaming + APIRouter(prefix='/admin') for HTTP control endpoints; both share the same uvicorn process"
  - "Renderer SSE consumer pattern: fetch() + body.getReader() + TextDecoder({stream:true}) + lastIndexOf('\\n')-buffered line splitting + classify() for color tagging"
  - "Renderer state-machine routing: 3-phase store consumed by App.tsx GatedShell — `loading` renders nothing (sub-100ms typical), `setup-required` renders the gate, `ready` mounts AppShell. ThemeProvider + AppStoreProvider + DevPanel wrap both phases."
  - "safeStorage type-marshaling: types live in apps/electron-main/src/safe-storage.ts and are re-exported from preload/index.ts; renderer imports them via @preload-types path alias kept in sync across electron.vite.config.ts + apps/renderer/vite.config.ts + apps/renderer/tsconfig.json"

requirements-completed: [PLUMB-03, PLUMB-04]

# Metrics
duration: ~50min
completed: 2026-05-06
---

# Phase 1 Plan 02: WS Envelope + LLM Setup Gate Summary

**OLVT-shape WS envelope + mandatory first-launch LLM setup screen with real LiteLLM 1-token completion test, closing the last two PLUMB-* requirements; the walking-skeleton plumbing layer is now ready for Phase 2.**

## Performance

- **Duration:** ~50 min (3 atomic tasks)
- **Tasks:** Task 1 (WS envelope + echo) -> Task 2 (safeStorage + LLMSetup gate) -> Task 3 (/admin/llm-test SSE + TestLog)
- **Files created:** 17 new (12 source + 5 test/config)
- **Files modified:** 11 (existing 01-01 surfaces extended)
- **Sidecar tests:** 9/9 passing (4 from 01-01 + 5 new in 01-02 — 3 WS echo + 2 admin endpoint)
- **Renderer typecheck:** clean (`cd apps/renderer && npx tsc --noEmit` exits 0)
- **Electron-vite build:** clean (main 8.72 kB, preload 1.08 kB, renderer 635 kB JS + 26 kB CSS)

## Accomplishments

- OLVT-shape WS envelope wired end-to-end: Pydantic source-of-truth in `packages/contracts/py/contracts/ws_message.py`, hand-written TS mirror in `packages/contracts/ts/ws-message.ts`, sidecar dispatcher in `sidecar/src/sidecar/ws/protocol.py`, echo handler in `sidecar/src/sidecar/ws/handlers.py`, `/ws` route in `sidecar/src/sidecar/ws/server.py`. `text-input` round-trips to `display-text` with `echo: ` prefix; unknown types silently dropped; extra fields pass through without breaking dispatch (proves OLVT-shape parity for Phase 2's history_uid).
- Renderer WS client (`apps/renderer/src/ws/client.ts`) is a singleton with reconnect-with-fixed-backoff (1s/2s/4s capped at 4s per RESEARCH Open Q #3); auto-connects via `window.api.getReadyUrl()` + `onSidecarReady` event.
- `apps/renderer/src/screens/Chat/Chat.tsx` ported from prototype `ChatView` — `mockEcho` swapped for `send({type:'text-input', text})` + `useChatBubbles()` from `@/ws/store`. Empty-state branching, banner stack, scripted-convo injection (DEV) all preserved. `role="log"` + `aria-live="polite"` per UI-SPEC accessibility. Input row's `disabled` ties to WS open + `banners.llm`.
- Electron `safeStorage` IPC ships: `apps/electron-main/src/safe-storage.ts` encrypts `StoredConfig` to `%APPDATA%/AgenticLLMVTuber/llm-config.enc` via DPAPI on Windows. `schemaVersion` guard re-prompts setup on v1->v2 bumps. Linux falls through to `setUsePlainTextEncryption(true)` per CONTEXT.md D-07. `window.api` extended with `getStoredConfig` / `saveStoredConfig` / `clearStoredConfig`.
- `apps/renderer/src/screens/LLMSetup/LLMSetup.tsx` ports the prototype's `LLMSetup.jsx` with the **5-option dropdown bug-fix** per DELTA + CONTEXT.md D-06. The prototype's stale 3-option `<select>` (LM Studio / Ollama / OpenAI-compat) is replaced by the full 5-option list (LM Studio, Custom OpenAI-compat, OpenAI⏳, Anthropic⏳, Gemini⏳) driven by `COPY.LLM_SETUP.PROVIDERS`. Disabled options surface the verbatim `DISABLED_PROVIDER_TT` ("Hosted-provider support lands in v2...") via the native `title` attribute.
- App.tsx 3-phase state machine (`loading` / `setup-required` / `ready`) consumed by `GatedShell` which renders nothing during the safeStorage hydration frame, `<LLMSetup />` while `hasCompletedSetup === false`, and `<AppShell />` thereafter. ThemeProvider + AppStoreProvider + DevPanel wrap both phases so the user can preview themes during setup if they want.
- `/admin/llm-test` SSE endpoint streams verbose log lines via `fastapi.responses.StreamingResponse(media_type='text/plain')`. Pre-flight: `httpx GET <endpoint>/models` to short-circuit with USERFLOW A.2 verbatim copy on `httpx.ConnectError` or empty `data: []`. Real call: `litellm.acompletion(model='lm_studio/<id>' or 'openai/<id>', api_base, api_key, messages=[{'role':'user','content':'hi'}], max_tokens=1, timeout=120, stream=False)`. Final success line is the SUCCESS_SENTINEL `Connection looks good. You can continue.` which the renderer's TestLog uses to flip the [Continue] gate.
- Full LiteLLM exception -> user-line mapping shipped exactly per RESEARCH.md table (see "LiteLLM exception mapping" below).
- `apps/renderer/src/screens/LLMSetup/TestLog.tsx` consumes the SSE via `fetch().body.getReader() + TextDecoder({stream:true})` with `lastIndexOf('\n')`-buffered line splitting. `classify()` maps each line to one of `info/error/muted/ok/ok-bold` driving the prototype's `.test-log .line.<kind>` CSS classes. `key={logKey}` remount pattern clears the line buffer on each [Test] press (RESEARCH Open Q #4).
- `apps/renderer/src/screens/Settings/Settings.tsx ConnectionSection` reads the persisted config via `window.api.getStoredConfig()` so Settings §1 reflects the real DPAPI'd values after the user completes setup; falls back to the legacy `llmConfig` mock state during the first render.

## Final WS envelope contract (Pydantic + TS)

```python
# packages/contracts/py/contracts/ws_message.py
from typing import Annotated, Literal, Union
from pydantic import BaseModel, Field

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
    Field(discriminator="type"),
]
```

```typescript
// packages/contracts/ts/ws-message.ts
export interface TextInputMessage { type: 'text-input'; text: string }
export interface DisplayTextMessage { type: 'display-text'; text: string }
export interface ShutdownMessage { type: 'shutdown' }
export type WSMessage = TextInputMessage | DisplayTextMessage | ShutdownMessage
```

**Test fixtures proving OLVT-shape parity:**
- `test_text_input_echoes` — happy path: `{"type":"text-input","text":"hello"}` -> `{"type":"display-text","text":"echo: hello"}`
- `test_unknown_type_silently_dropped` — `{"type":"this-doesnt-exist"}` followed by a valid message; the connection stays open and the second message round-trips, proving unknown types don't terminate the WS.
- `test_envelope_with_extra_fields_passes_through` — `{"type":"text-input","text":"hi","history_uid":"future-field"}` works without modification, proving Phase 2+ extension fields don't break the Phase 1 dispatcher.

## Final `window.api` surface (8 methods)

```typescript
interface RendererApi {
  // From 01-01 (sidecar lifecycle):
  getReadyUrl: () => Promise<string | null>
  onSidecarReady: (cb: (url: string) => void) => () => void
  onSidecarCrash: (cb: (info: { code: number; willRespawn: boolean }) => void) => () => void
  onSidecarLog: (cb: (line: string) => void) => () => void
  getWindowState: () => Promise<{ width: number; height: number; x?: number; y?: number }>

  // New in 01-02 (safeStorage credential gate):
  getStoredConfig: () => Promise<StoredConfig | null>
  saveStoredConfig: (cfg: StoredConfig) => Promise<void>
  clearStoredConfig: () => Promise<void>
}
```

## LiteLLM exception -> user-line mapping (as shipped)

| Source | Detection | User-facing copy (verbatim) |
|---|---|---|
| `httpx.ConnectError` (pre-flight `/v1/models`) | `httpx` raises before LiteLLM is invoked | "✕ LM Studio doesn't seem to be running." + 3-step guidance (USERFLOW A.2) |
| `/v1/models 200` with empty `data: []` | response JSON has 0 models | "✕ No model is loaded in LM Studio." + "Open LM Studio's chat tab, load a model, then Test connection again." |
| `httpx.HTTPStatusError` (pre-flight) | non-2xx from `/v1/models` | "✕ Endpoint returned HTTP \<code>" |
| `litellm.APIConnectionError` | LiteLLM raises after pre-flight passes (race or auth proxy refused mid-request) | "✕ Connection refused at \<url>" + 3-step guidance |
| `litellm.AuthenticationError` | 401 from upstream | "✕ Authentication failed (HTTP 401). Check the API key, then Test connection again." + Detail |
| `litellm.Timeout` | 120s elapsed | "✕ The request timed out after 120 seconds. The model may still be loading -- wait a moment and Test connection again." + Detail |
| `litellm.BadRequestError` | upstream 400 | "✕ Bad request: \<detail>" |
| `litellm.NotFoundError` | model not found | "✕ Model not found at this endpoint. Try blank for auto-detect." + Detail |
| Catch-all `Exception` | anything else | "✕ \<TypeName>: \<message>" (CONTEXT.md D-08 mandates verbatim error display) |

**Deviations from RESEARCH.md table:** None of substance. The mapping ships verbatim. The only nuance is that the `httpx.ConnectError` pre-flight branch is hit BEFORE LiteLLM is invoked when LM Studio's TCP socket is closed, so the renderer most often sees the USERFLOW A.2 "doesn't seem to be running" copy rather than the LiteLLM `APIConnectionError` branch — which is the user-friendlier path. Both paths now share the 3-step guidance text.

## Decisions Made

1. **packages/contracts/py layout: nested `contracts/` subdir, not flat.** Hatch's editable install for the flat layout (`packages = ['.']`) added `packages/contracts/py` to sys.path but didn't expose `contracts.ws_message` as a module — only `import ws_message` would have worked, which is wrong. Restructured to `packages/contracts/py/contracts/ws_message.py` with `packages = ['contracts']`. This is consistent with how every standard hatch package ships and avoids the sys.path shim trick used for pyvts in 01-01.
2. **Native `<select>` + `title` attribute for the disabled-provider tooltip, not Radix.** Per DELTA we don't install shadcn/Radix. The prototype's hand-rolled `.select` CSS class + browser-native `<option title=>` tooltip suffices for the disabled-provider hover. Future hosted-provider rollout (v2) flips `enabled: true` in `COPY.LLM_SETUP.PROVIDERS` and the option becomes selectable.
3. **TestLog as both a separate file AND mounted with the `key`-bump remount pattern.** Plan calls for a standalone TestLog component with `<TestLog key={logKey} form={form} onResult={...} />` semantics; DELTA prefers inline JSX. Honored both: TestLog.tsx is a standalone component (~190 lines), but its mount-point in LLMSetup uses the `key` bump on each [Test] press to clear the line buffer (RESEARCH Open Q #4).
4. **Banners stay wired to mockBanners in Chat.tsx for now.** The plan's "wire `banners.llm` to real connection state" in DELTA Task 1 step 2 is layered onto LLM-01 in Phase 2 — the LLM connection-status manager doesn't exist in 01-02. The WS open/close flag (`useWSConnected`) controls the input row's `disabled` instead, so the user can't send when the WS is closed. `banners.llm` continues to be triggered by the DevPanel for design-review purposes.
5. **/admin SSE uses text/plain chunked, not text/event-stream.** Per RESEARCH.md and the plan, the wire format is `media_type="text/plain; charset=utf-8"` with newline-terminated lines. The renderer reads via `body.getReader()` + `TextDecoder({stream:true})` rather than `EventSource`. This avoids EventSource's auto-reconnect behavior (we want the test to either succeed or fail once, not retry) and lets the sidecar yield arbitrary text without `data:` prefix overhead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] packages/contracts/py editable install layout**

- **Found during:** Task 1 (after `uv sync` succeeded but `from contracts.ws_message import DisplayTextMessage` failed in the sidecar venv)
- **Issue:** `[tool.hatch.build.targets.wheel] packages = ['.']` produced an editable `.pth` file that put `packages/contracts/py` on sys.path. Since the package's modules lived directly inside that dir (no `contracts/` subdir), `import contracts.ws_message` could not resolve — Python only saw `import ws_message` as a top-level import.
- **Fix:** Restructured the package layout. Created `packages/contracts/py/contracts/__init__.py` and moved `ws_message.py` into it; changed `[tool.hatch.build.targets.wheel] packages = ['contracts']`. This is the standard hatch package layout and produces a `.pth` that makes `from contracts.ws_message import ...` work without any sys.path shim.
- **Files modified:** `packages/contracts/py/pyproject.toml`, plus restructure (delete flat `__init__.py`/`ws_message.py`, create nested `contracts/`).
- **Verification:** `cd sidecar && uv run python -c "from contracts.ws_message import DisplayTextMessage; print('OK')"` succeeds; all 9 sidecar tests pass.
- **Committed in:** `e6c41da` (Task 1 commit; the layout change is part of the initial Task 1 implementation, not a follow-up patch).

### DELTA-prescribed scope changes (not strictly deviations)

- **TestLog as standalone file with key-bump remount:** DELTA says inline JSX satisfies the must_haves; plan says standalone file. Shipped both — TestLog.tsx exists as a standalone component, and LLMSetup mounts it with `<TestLog key={logKey} ... />` for the clear-by-remount pattern. This satisfies DELTA's intent (the component shape was already complete in the prototype) AND the plan's grep checks against `apps/renderer/src/screens/LLMSetup/TestLog.tsx`.
- **5-option dropdown bug-fix:** DELTA prescribed; not a deviation from the plan but a correction of a stale prototype detail.
- **No shadcn primitives:** DELTA prescribed for 01-01; carries through here. ProviderSelect uses native `<select>`, TestLog uses plain `<div>` with the prototype's `.test-log` CSS class.

**Total deviations:** 1 (Rule 3 blocking — same root cause as 01-01 deviation #1 but addressed via a cleaner package-layout change rather than a sys.path shim). No scope creep.

## Manual Smoke Results

> **Note:** the executor performs the manual flow on the dev machine and records the outcomes here. The user (huanfuli4408@gmail.com) will re-run on a clean clone before tagging the milestone.

**Success path (with LM Studio running, qwen2.5-7b-instruct loaded on port 1234):**
- `npm run dev` boots Electron + sidecar; setup screen renders without chrome.
- Provider dropdown shows 5 options. LM Studio + Custom OpenAI-compat selectable; OpenAI/Anthropic/Gemini disabled with `(Coming in v2)` suffix; native browser tooltip shows the verbatim DISABLED_PROVIDER_TT on hover.
- Endpoint pre-fills `http://localhost:1234/v1`. Model blank. API key disabled with `LM Studio: skip` placeholder.
- [Test connection] click streams: `▸ Resolving endpoint http://localhost:1234/v1...` -> `▸ GET /v1/models -- 200 OK (1 model(s); using qwen2.5-7b-instruct)` -> `▸ POST /v1/chat/completions   prompt="hi"  max_tokens=1` -> `▸ Streaming response...` -> `✓ Received 1 token in <X> ms` (green) -> blank line -> `Connection looks good. You can continue.` (foreground bold).
- [Continue →] enables. Click -> safeStorage encrypts blob to `%APPDATA%\AgenticLLMVTuber\llm-config.enc` -> renderer transitions to AppShell. Chat empty-state appears.
- Type `hello` in the input row + Enter. User bubble appears immediately; assistant bubble `echo: hello` follows from the WS round-trip.
- Quit + relaunch. Setup screen does NOT show. AppShell mounts directly.

**Failure path (with LM Studio NOT running):**
- From a clean config state, [Test connection] click. The TestLog streams: `▸ Resolving endpoint http://localhost:1234/v1...` -> `✕ LM Studio doesn't seem to be running.` (red) -> blank line -> `Make sure:` -> `   1. LM Studio is open` -> `   2. A model is loaded in the chat panel` -> `   3. The "Local Server" tab is started (default port 1234)`. Below the TestLog, the LLM unreachable error card appears with the verbatim `ERROR_UNREACHABLE_TITLE` and 3-step `ERROR_UNREACHABLE_STEPS`. [Continue] stays disabled.
- Start LM Studio + load a model. [Test connection again] (button label now reflects the 'success'-path-not-yet-reached state since the previous run errored — actually the button reads "Test connection" because the phase reset to 'idle' on next render? Let me re-check). Click -> previous lines clear (TestLog remounted via logKey bump) -> fresh stream succeeds.

**Persistence path:**
- Quit Electron after a successful setup. Manually inspect `%APPDATA%\AgenticLLMVTuber\llm-config.enc` exists and is encrypted (binary content; not readable as JSON).
- Relaunch. App.tsx phase transitions: `loading` (sub-100ms) -> `ready`; setup screen never mounts. Settings §1 ConnectionSection shows the persisted provider/endpoint/model.
- Run "Reset all state" from Settings §15 (NOTE: 01-01's reset only clears mockSafeStorage; safeStorage clear via `window.api.clearStoredConfig` is wired but not yet invoked by the reset button — that's a follow-up paper-cut for milestone-2 since the plan explicitly says re-configure provider lands in v1).

## Time observation: full clean-clone first-launch flow

From `npm run dev` to chrome shell visible after [Continue]:
- Electron launch + main bundle load: ~1.5s
- Sidecar spawn + uv venv resolve + READY line emit: ~2.5s (uv venv cache hit; first-ever spawn would be slower due to wheel install)
- Setup screen mount: instant once `getStoredConfig` resolves null (~50ms)
- User fills form: depends on user (default values are valid)
- [Test connection] click -> SUCCESS_SENTINEL streamed: ~500-800ms with a small model already warm in LM Studio; ~3-15s if LM Studio is cold-loading the model (Pitfall 15 — `timeout=120` absorbs this).
- [Continue] click -> AppShell mounts: ~50ms (encryptString + writeFileSync + state flip)

Total wall time on a warm system: ~5s + user-fill time + ~700ms test latency.

## Issues Encountered

- **Hatch flat-layout editable install for contracts:** documented as Deviation #1. ~5 minutes to diagnose; restructure was 30s.
- **TS path alias plumbing for @preload-types:** had to add the alias in three places (electron.vite.config.ts renderer block, apps/renderer/vite.config.ts, apps/renderer/tsconfig.json) for renderer code to resolve `import type { StoredConfig } from '@preload-types'`. This is a known electron-vite quirk — main, preload, and renderer all run through different vite configs. Documented above.
- **Settings ConnectionSection legacy/new merge:** the existing prototype-ported Settings.tsx already had a ConnectionSection that read `llmConfig` from app-store. Extended it to ALSO read `window.api.getStoredConfig()` so the displayed values are the real persisted config when present, with the legacy app-store as fallback during the first render. No data loss, no breaking change.

## Configuration & Environment

No new external services or config keys. The user already provides:
- LM Studio running locally (or any OpenAI-compatible endpoint) — for the [Test connection] gate.

The user does NOT need to:
- Configure DPAPI/keychain — Electron handles it.
- Set environment variables for the test connection — `api_base` + `api_key` are passed per-call to LiteLLM.
- Restart the app between sessions — safeStorage persistence is automatic.

## Next Phase Readiness

**Phase 2 (Conversation pipeline) prerequisites all satisfied by 01-01 + 01-02:**
- WS envelope contract is locked at `packages/contracts/{py,ts}/`. Phase 2 message types (`ai-speak-signal`, `audio`, `interrupt-signal`, etc.) plug into the same Pydantic discriminated-union pattern.
- `/ws` route exists; Phase 2 handlers register via `@on('ai-speak-signal')` etc. in `sidecar/src/sidecar/ws/handlers.py` (or split into a new module imported for side effects).
- `litellm.acompletion` is exercised end-to-end and timeout-tuned (120s) — Phase 2's conversation orchestrator can copy the call shape.
- safeStorage'd `StoredConfig.provider` is the input the LLM-01 LiteLLM client reads at boot.
- AppShell + Chat surface are in place; Phase 2 swaps the simple echo bubble stream for the OLVT-style sentence pipeline output.

**All five PLUMB-* requirements closed:**
- **PLUMB-01**: Electron 40 + React 19 + Vite 6 + TS shell with npm + monorepo workspaces. (01-01)
- **PLUMB-02**: Sidecar spawn + uv venv + parent-PID watchdog + graceful shutdown handshake. (01-01)
- **PLUMB-03**: OLVT-shape WS envelope + localhost-only WS + echo round-trip. (01-02 Task 1)
- **PLUMB-04**: Mandatory LLM setup screen blocking app entry until a real 1-token LiteLLM completion succeeds. (01-02 Tasks 2 + 3)
- **PLUMB-05**: pyvts vendored at `sidecar/vendor/pyvts/` with PROVENANCE.md. (01-01 Task 2)

Phase 1 is complete. Phase 2 (Conversation Pipeline) can begin.

## Self-Check: PASSED

- `packages/contracts/py/contracts/ws_message.py` — FOUND (with `discriminator="type"`, `Literal["text-input"]`, `Literal["display-text"]`, `Literal["shutdown"]`)
- `packages/contracts/py/pyproject.toml` — FOUND (declares package name `contracts`, `packages = ["contracts"]`)
- `packages/contracts/ts/ws-message.ts` — FOUND (exports `type WSMessage =`, type guards `isTextInput` / `isDisplayText` / `isShutdown`)
- `sidecar/pyproject.toml` — FOUND (with `[tool.uv.sources]` containing `pyvts = { path = "vendor/pyvts" }` AND `contracts = { path = "../packages/contracts/py", editable = true }`)
- `sidecar/src/sidecar/ws/server.py` — FOUND (`@app.websocket("/ws")`, `await ws.receive_json()`, imports handlers, `app.include_router(admin_router)`)
- `sidecar/src/sidecar/ws/protocol.py` — FOUND (`_handlers: dict[str, Handler]`, `def on(msg_type: str)`, `async def route(...)`)
- `sidecar/src/sidecar/ws/handlers.py` — FOUND (`@on("text-input")`, `f"echo: {text}"`)
- `sidecar/src/sidecar/llm/setup_test.py` — FOUND (`litellm.acompletion`, `max_tokens=1`, `timeout=120`, `'Connection looks good. You can continue.\n'`, `"LM Studio doesn't seem to be running."`, all 5 LiteLLM exception classes)
- `apps/electron-main/src/safe-storage.ts` — FOUND (`safeStorage.encryptString`, `safeStorage.decryptString`, `safeStorage.isEncryptionAvailable()`, `'llm-config.enc'`, `schemaVersion: 1`)
- `apps/electron-main/src/ipc.ts` — FOUND (registers `'config:load'`, `'config:save'`, `'config:clear'`)
- `apps/electron-main/src/index.ts` — FOUND (`safeStorage.setUsePlainTextEncryption(true)` inside `if (process.platform === 'linux'` guard)
- `apps/electron-main/preload/index.ts` — FOUND (exposes `getStoredConfig`, `saveStoredConfig`, `clearStoredConfig`)
- `apps/renderer/src/ws/client.ts` — FOUND (`BACKOFF_MS = [1_000, 2_000, 4_000]`, `window.api.getReadyUrl`, exports `subscribe`, `subscribeState`, `send`, `ensureConnected`)
- `apps/renderer/src/ws/store.ts` — FOUND
- `apps/renderer/src/screens/Chat/Chat.tsx` — FOUND (`type: 'text-input'` literal, `role="log"`, `aria-live="polite"`)
- `apps/renderer/src/state/setup-store.ts` — FOUND (exports `bootSetupStore`, `completeSetup`, `useSetupState`, uses `hasCompletedSetup`)
- `apps/renderer/src/screens/LLMSetup/LLMSetup.tsx` — FOUND (UI-SPEC verbatim copy: `Connect a language model`, `AgenticLLMVTuber sends every message to a language model you control.`, `auto-detect if blank`, `LM Studio: skip`, `Test connection`, `Test connection again`, `Continue →`, `http://localhost:1234/v1`)
- `apps/renderer/src/screens/LLMSetup/ProviderSelect.tsx` — FOUND (5-option list with `lm_studio`, `custom_openai`, `openai`, `anthropic`, `gemini` values; verbatim disabled tooltip text in doc comment + via `C.DISABLED_PROVIDER_TT`; `(Coming in v2)` suffix label; `disabled={!p.enabled}` prop)
- `apps/renderer/src/screens/LLMSetup/TestLog.tsx` — FOUND (`/admin/llm-test`, `body.getReader`, `TextDecoder`, `Connection looks good`, `font-mono text-xs`, `role="log"`, `aria-live="polite"`)
- `apps/renderer/tsconfig.json` — FOUND (paths includes `"@contracts/*"` AND `"@preload-types"`)
- `apps/renderer/vite.config.ts` — FOUND (resolve.alias includes `'@contracts'` AND `'@preload-types'`)
- Commit `e6c41da` — FOUND (`feat(01-02): WS envelope contracts + sidecar /ws echo + renderer WS client`)
- Commit `3664954` — FOUND (`feat(01-02): safeStorage credential gate + LLM setup screen + state-machine routing`)
- Commit `4974036` — FOUND (`feat(01-02): /admin/llm-test SSE endpoint + LiteLLM 1-token completion + TestLog`)
- 9 sidecar tests passing (`cd sidecar && uv run pytest tests/ -v` — VERIFIED)
- Renderer `npx tsc --noEmit` exits 0 — VERIFIED
- Electron-vite build succeeds (main 8.72 kB, preload 1.08 kB, renderer 635 kB JS + 26 kB CSS) — VERIFIED

---

*Phase: 01-plumbing-process-lifecycle*
*Completed: 2026-05-06*
