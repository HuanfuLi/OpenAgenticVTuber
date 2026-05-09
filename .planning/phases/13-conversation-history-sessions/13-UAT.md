---
status: resolved
phase: 13-conversation-history-sessions
source:
  - 13-01-PLAN.md
  - 13-02-PLAN.md
  - 13-03-PLAN.md
started: 2026-05-09
updated: 2026-05-09T11:10:00-04:00
---

# Phase 13 UAT: Conversation History Sessions

## Current Test

[testing complete]

## Tests

### 1. Create a Session
expected: Open History, click New chat, and the app creates/selects an empty session titled `New chat`.
result: pass

### 2. Complete and Persist a Turn
expected: Send one message, wait for the full assistant reply to finish, and confirm the turn appears in Chat and History with a title derived from the first user message.
result: issue
reported: "Partial with issue: The new history has both original user first prompt and original LLM first response, not derived title. This is not standard way. Is this design intentional for better search/filter functionality? Or should we just use a more standard manner that only serves a derived title (LLM summarized) without showing LLM first response?"
severity: minor

### 3. Restart Restore
expected: Quit and relaunch the app. The active session and completed transcript restore from local history.
result: pass

### 4. Search, Switch, Rename, Delete
expected: History search filters by title/preview; selecting a session switches Chat; manual rename persists; deleting one session leaves a valid active session.
result: pass

### 5. Failed Turn Skip
expected: A failed/interrupted stream does not save a partial user/assistant turn to history.
result: pass

### 6. Settings Conversation Clear
expected: Settings > Conversation shows real session/message counts, clear-all asks for destructive confirmation, and confirming clears prior sessions while preserving provider settings.
result: pass

### 7. Memory Boundary
expected: Settings > Memory remains disabled/deferred and points to v4.0 agentic system plus memory; transcript history does not imply semantic memory or retrieval.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "History rows should present a standard session title derived from the conversation without making the first LLM response appear as primary history content."
  status: resolved
  reason: "User reported: Partial with issue: The new history has both original user first prompt and original LLM first response, not derived title. This is not standard way. Is this design intentional for better search/filter functionality? Or should we just use a more standard manner that only serves a derived title (LLM summarized) without showing LLM first response?"
  severity: minor
  test: 2
  root_cause: "HistorySheet visibly renders ConversationSessionSummary.preview under every row, and conversation-store derives preview from the last message, which is typically the assistant response. That makes the History list look like it contains both the first prompt/title and the first assistant response instead of a standard title-first session list."
  artifacts:
    - path: "apps/renderer/src/chrome/HistorySheet.tsx"
      issue: "Renders session.preview as visible row content."
    - path: "apps/electron-main/src/conversation-store.ts"
      issue: "Derives preview from the last stored message, usually the assistant response."
    - path: "apps/renderer/tests/HistorySheet.test.tsx"
      issue: "Covers preview-based filtering but not title-first/no-visible-assistant-preview UX."
  missing:
    - "Make History rows show title plus compact metadata only, not assistant-response preview."
    - "Keep search useful by filtering title plus non-visible transcript/search text if needed."
    - "Add regression coverage that assistant response preview text is not visibly rendered in normal History rows."
  resolved_by: "13-04-SUMMARY.md / commit 20d8333"
