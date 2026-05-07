---
status: partial
phase: 01-plumbing-process-lifecycle
source: [01-VERIFICATION.md]
started: 2026-05-06T23:35:00Z
updated: 2026-05-06T23:50:00Z
---

## Current Test

Test #1 failed; tests #2-4 cannot proceed until window content renders.

## Tests

### 1. `npm run dev` on a clean clone boots the full stack
expected: Electron window opens, sidecar spawns from venv, log panel shows `[READY]` line, status icon turns green
result: FAILED — empty deep-blue screen on launch, no content visible
diagnosis: Preload-script path mismatch in `apps/electron-main/src/index.ts:33` — references `'../preload/index.js'` but electron-vite emits the ESM preload as `out/preload/index.mjs`. With sandbox:false + ESM preload, electron-vite produces `.mjs`; main bundle stays `.js` (CJS). Preload fails to load → `window.api` is undefined on the renderer → `bootSetupStore()` rejects on `window.api.getStoredConfig()` (uncaught) → setup-store stays at `phase: 'loading'` → `GatedShell` renders `null`. Theme system is working: `prefers-color-scheme: dark` resolves to `theme-midnight-sky` and paints `--background` deep blue. The blue IS the empty body — content layer never mounts.
fix: Change line 33 from `'../preload/index.js'` to `'../preload/index.mjs'`.

### 2. Force-quit Electron via Task Manager and immediately relaunch
expected: Sidecar process terminates within ~2s of Electron death (watchdog poll cycle); next launch picks a new ephemeral port and starts cleanly
result: [pending]

### 3. Real LM Studio /admin/llm-test 1-token completion succeeds end-to-end
expected: With LM Studio running on localhost:1234 with a model loaded, [Test connection] streams success lines and SUCCESS_SENTINEL "Connection looks good. You can continue." enables [Continue]; [Continue] persists safeStorage blob and unblocks the chrome shell
result: FAILED — TestLog showed `✕ Test failed: Failed to fetch` for both blank-model (auto-detect) and explicit-model paths. CSP fix did not change the symptom because a second gate (CORS preflight) blocks the same request with the same generic surface error.
diagnosis: Two-gate cross-origin failure. (Gate 1 — CSP) Renderer CSP `default-src 'self'` blocks cross-origin fetches; renderer at `http://localhost:5173` in dev cannot reach `http://127.0.0.1:<ephemeral-port>`. (Gate 2 — CORS) FastAPI app has no CORSMiddleware, so the browser's preflight OPTIONS for a POST with `Content-Type: application/json` returns 405, browser blocks the actual POST. Both gates surface as `TypeError: Failed to fetch` — the second gate was masked by the first until CSP was opened. Sidecar pytest tests passed because FastAPI TestClient does in-process calls, not cross-origin browser fetches; integration gap that existed regardless of plan execution. Independent verification: `curl http://localhost:1234/v1/models` returned 10+ models in 220ms — LM Studio itself was healthy throughout.
fix: Two-part fix. (1) `apps/renderer/index.html` — expand CSP with `connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*;` so the browser permits the request to leave the renderer. (2) `sidecar/src/sidecar/ws/server.py` — add FastAPI `CORSMiddleware` with `allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|null)$"` so the sidecar's preflight response satisfies the browser. The regex covers Vite dev (localhost:5173 / 127.0.0.1:5173, http or https) and production where the renderer's origin is the literal string `null` (file:// loading). Localhost-only socket binding is unchanged — CORS only widens who can READ the response, not who can reach the socket.

### 4. Type 'hello' in the chat input and observe 'echo: hello' as an assistant bubble
expected: User bubble with 'hello' renders immediately; assistant bubble with 'echo: hello' follows after WS round-trip (~10-50ms)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
