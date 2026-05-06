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
result: [pending]

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
