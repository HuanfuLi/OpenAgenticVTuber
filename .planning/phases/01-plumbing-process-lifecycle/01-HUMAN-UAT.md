---
status: partial
phase: 01-plumbing-process-lifecycle
source: [01-VERIFICATION.md]
started: 2026-05-06T23:35:00Z
updated: 2026-05-06T23:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. `npm run dev` on a clean clone boots the full stack
expected: Electron window opens, sidecar spawns from venv, log panel shows `[READY]` line, status icon turns green
result: [pending]

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
