# Phase 13: Conversation History Sessions - Research

**Date:** 2026-05-09T07:48:10.4688396-04:00
**Status:** Complete

## Research Boundary

Phase 13 adds local ChatGPT-style conversation sessions. The research focused on existing renderer chat state, Electron persistence/IPC patterns, History sheet UI, Settings wiring, and test coverage. It did not research memory/retrieval, cloud sync, accounts, or agentic workflows because those are explicitly deferred.

## Key Findings

### Existing Chat State Is Split

- `apps/renderer/src/screens/Chat/Chat.tsx` renders a merge of `app-store.chatMessages` and `useStreamingMessages()`.
- `chatMessages` currently exists for DEV-injected scripted conversations, while live messages come from the module-level streaming reducer.
- Phase 13 should not persist directly inside `app-store.chatMessages`; it should introduce a real conversation/session state surface and retire or isolate the scripted-conversation path from normal history rendering.

### Streaming Completion Has a Clear Event

- `apps/renderer/src/ws/store.ts` receives `conversation-chain-start`, audio payloads, `force-new-message`, and `conversation-chain-end`.
- The existing reducer has enough state to identify user and assistant bubbles, but it does not currently expose a production API for "the complete turn that just finished."
- Since the user selected complete-turn persistence, the implementation should commit only after `conversation-chain-end` and skip commit on `error` envelopes.

### Electron Persistence Pattern Is Already Established

- `apps/electron-main/src/window-store.ts` uses typed `electron-store` defaults and helpers for chrome/theme/current-avatar/log-level state.
- `apps/electron-main/src/ipc.ts` and `apps/electron-main/preload/index.ts` expose persisted state through whitelisted `window.api` methods.
- Conversation history should follow that main-process-owned persistence pattern. Renderer filesystem access is not appropriate.

### History Sheet Is the Correct Product Surface

- `apps/renderer/src/chrome/HistorySheet.tsx` already provides the 80%-width slide-in surface, search row, grouped list styling, Escape close, and New Thread placement.
- It currently imports `PLACEHOLDER_THREADS` from dev mocks and uses `setChatMessages([])` for New Thread. Both are placeholders that Phase 13 must replace.
- The existing CSS classes `.sheet`, `.group-title`, and `.thread-row` are reusable for a denser manager with search/filtering and row actions.

### Settings Is a Summary Surface

- `apps/renderer/src/screens/Settings/Settings.tsx` currently has `ConversationSection` with single in-memory copy from Phase 12.
- Phase 13 should update that section to real counts/status and clear-all history, while keeping per-session management in `HistorySheet`.
- Phase 12 tests in `apps/renderer/tests/Settings.test.tsx` currently assert the old truth-only copy and absence of history controls; these must change.

## Recommended Implementation Shape

1. Add a main-process conversation store with schema version, active session id, and session records.
2. Add typed preload/IPC APIs for list/get/create/select/rename/delete/clear/commit-turn/stats.
3. Add a renderer conversation-session state provider or app-store slice that hydrates from the bridge and exposes active persisted messages plus session summaries.
4. Update chat streaming integration so in-flight bubbles remain renderer-local and only completed turns are committed to the active session on chain-end.
5. Replace placeholder History sheet data with real sessions, search/filtering, grouping, rename/delete, and active-session selection.
6. Update Settings Conversation copy and controls to show local history status/counts and clear-all.
7. Add focused renderer tests for store/hook behavior, Chat complete-turn semantics, History manager behavior, and Settings summary/reset behavior.

## Risks and Constraints

- **Duplicate persistence risk:** If persistence watches message arrays naively, it can commit the same turn more than once when React re-renders or WS reconnects. Use an explicit pending/completed turn boundary and mark persisted turns.
- **Partial-turn risk:** Errors call `setInputDisabled(false)` today. Completion logic must distinguish `conversation-chain-end` from `error` and skip failed/interrupted turns.
- **Session switching risk:** Switching sessions during an in-flight turn can commit a reply to the wrong transcript. The simplest safe behavior is to disable session switching/delete while `turnInFlight` is true.
- **Mock boundary risk:** Phase 14 will audit mocks. Phase 13 should remove `PLACEHOLDER_THREADS` from normal History rendering and avoid adding more production dependencies on `SCRIPTED_CONVO`.
- **Storage growth risk:** User selected local unlimited history. The schema should still be migration-ready and structured enough for future retention/export, but no automatic cap belongs in this phase.

## Verification Targets

- `npm --workspace apps/renderer run test -- ConversationHistory.test.tsx HistorySheet.test.tsx Chat.test.tsx Settings.test.tsx`
- `npm --workspace apps/renderer run test -- useStreamingMessages.test.ts`
- `npm --workspace apps/renderer run typecheck`
- Manual restart UAT: create a session, complete a turn, relaunch, confirm active session and transcript restore.

## Research Complete

The phase can be planned as three waves: durable storage/bridge, Chat + History integration, then Settings/copy/regression coverage.
