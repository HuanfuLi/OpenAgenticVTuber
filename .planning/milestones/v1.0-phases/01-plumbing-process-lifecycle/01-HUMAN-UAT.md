---
status: complete
phase: 01-plumbing-process-lifecycle
source: [01-VERIFICATION.md]
started: 2026-05-06T23:35:00Z
updated: 2026-05-07T00:30:00Z
---

## Current Test

All four tests pass after four root-cause fixes (preload extension, CSP, CORS, watchdog parent PID).

## Tests

### 1. `npm run dev` on a clean clone boots the full stack
expected: Electron window opens, sidecar spawns from venv, log panel shows `[READY]` line, status icon turns green
result: PASSED (after fix)
diagnosis: Preload-script path mismatch in `apps/electron-main/src/index.ts:33` — references `'../preload/index.js'` but electron-vite emits the ESM preload as `out/preload/index.mjs`. With sandbox:false + ESM preload, electron-vite produces `.mjs`; main bundle stays `.js` (CJS). Preload fails to load → `window.api` is undefined on the renderer → `bootSetupStore()` rejects on `window.api.getStoredConfig()` (uncaught) → setup-store stays at `phase: 'loading'` → `GatedShell` renders `null`. Theme system is working: `prefers-color-scheme: dark` resolves to `theme-midnight-sky` and paints `--background` deep blue. The blue IS the empty body — content layer never mounts.
fix: `d1e221e` — change line 33 from `'../preload/index.js'` to `'../preload/index.mjs'`.

### 2. Force-quit Electron via Task Manager and immediately relaunch
expected: Sidecar process terminates within ~2s of Electron death (watchdog poll cycle); next launch picks a new ephemeral port and starts cleanly
result: PASSED (after fix)
diagnosis: Two-bug Windows watchdog failure. (Bug A) `apps/electron-main/src/sidecar.ts` spawns with `shell: true`, producing the chain `electron.exe -> cmd.exe -> uv.exe -> python.exe`. `sidecar/src/sidecar/main.py` called `os.getppid()` to find Electron, but that returns uv.exe's PID — uv stays alive as long as python does, so the watchdog's `psutil.pid_exists()` always returned True. (Bug B) Windows does not auto-kill orphan processes outside of a Job Object, so the cmd.exe and uv.exe descendants of a Task-Manager-killed Electron just keep waiting on python forever. Why pytest passed: `test_sidecar_boots_and_emits_ready_line` spawns the sidecar directly from a Python subprocess (no Electron, no shell, 1-level chain), so getppid() coincidentally returned the right PID — the Windows-specific 4-level chain was never tested.
fix: `9bc78f0` — pass Electron's PID via env var `AGENTICLLMVTUBER_PARENT_PID` from sidecar.ts; main.py prefers the env var over getppid() with the latter as fallback (preserves pytest's direct-spawn path). Once Python detects Electron's PID is gone (≤2s poll), `os._exit(0)` cascades: python dies → uv exits (its child died) → cmd.exe drains (its child died).

### 3. Real LM Studio /admin/llm-test 1-token completion succeeds end-to-end
expected: With LM Studio running on localhost:1234 with a model loaded, [Test connection] streams success lines and SUCCESS_SENTINEL "Connection looks good. You can continue." enables [Continue]; [Continue] persists safeStorage blob and unblocks the chrome shell
result: PASSED (after fix)
diagnosis: Two-gate cross-origin failure. (Gate 1 — CSP) Renderer CSP `default-src 'self'` blocks cross-origin fetches; renderer at `http://localhost:5173` in dev cannot reach `http://127.0.0.1:<ephemeral-port>`. (Gate 2 — CORS) FastAPI app has no CORSMiddleware, so the browser's preflight OPTIONS for a POST with `Content-Type: application/json` returns 405, browser blocks the actual POST. Both gates surface as `TypeError: Failed to fetch` — the second gate was masked by the first until CSP was opened. Sidecar pytest tests passed because FastAPI TestClient does in-process calls, not cross-origin browser fetches; integration gap that existed regardless of plan execution. Independent verification: `curl http://localhost:1234/v1/models` returned 10+ models in 220ms — LM Studio itself was healthy throughout.
fix: Two-part fix. (1) `5b59959` — `apps/renderer/index.html` expand CSP with `connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*;`. (2) `5300a24` — `sidecar/src/sidecar/ws/server.py` add FastAPI `CORSMiddleware` with `allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|null)$"`. Localhost-only socket binding (D-04) is unchanged — CORS only widens who can READ the response, not who can reach the socket.

### 4. Type 'hello' in the chat input and observe 'echo: hello' as an assistant bubble
expected: User bubble with 'hello' renders immediately; assistant bubble with 'echo: hello' follows after WS round-trip (~10-50ms)
result: PASSED

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(None — all four tests passed after fixes; see individual `fix:` lines for commit refs.)

## Carry-forward note

The StatusIcon popover's LLM and VTS rows still display the prototype's hardcoded mock data (`qwen2.5-7b · LM Studio · last reply 423ms`, `awaiting connection`). Acknowledged by user as not a Phase 1 blocker — wiring the LLM row to the real saved provider config is in-scope for Phase 2 (LLM-01 wires the conversation pipeline, which makes "last reply Xms" meaningful); VTS row wiring is a Phase 4 concern (AVT-04). The misleading model-name string is still cosmetically wrong until then.
