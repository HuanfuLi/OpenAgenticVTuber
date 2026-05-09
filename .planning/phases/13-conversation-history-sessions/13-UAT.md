---
status: pending
phase: 13-conversation-history-sessions
source:
  - 13-01-PLAN.md
  - 13-02-PLAN.md
  - 13-03-PLAN.md
started: 2026-05-09
updated: 2026-05-09
---

# Phase 13 UAT: Conversation History Sessions

## Current Test

Manual verification for local transcript/session persistence after Phase 13 execution.

## Tests

### 1. Create a Session
expected: Open History, click New chat, and the app creates/selects an empty session titled `New chat`.
result: pending

### 2. Complete and Persist a Turn
expected: Send one message, wait for the full assistant reply to finish, and confirm the turn appears in Chat and History with a title derived from the first user message.
result: pending

### 3. Restart Restore
expected: Quit and relaunch the app. The active session and completed transcript restore from local history.
result: pending

### 4. Search, Switch, Rename, Delete
expected: History search filters by title/preview; selecting a session switches Chat; manual rename persists; deleting one session leaves a valid active session.
result: pending

### 5. Failed Turn Skip
expected: A failed/interrupted stream does not save a partial user/assistant turn to history.
result: pending

### 6. Settings Conversation Clear
expected: Settings > Conversation shows real session/message counts, clear-all asks for destructive confirmation, and confirming clears prior sessions while preserving provider settings.
result: pending

### 7. Memory Boundary
expected: Settings > Memory remains disabled/deferred and points to v4.0 agentic system plus memory; transcript history does not imply semantic memory or retrieval.
result: pending

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
