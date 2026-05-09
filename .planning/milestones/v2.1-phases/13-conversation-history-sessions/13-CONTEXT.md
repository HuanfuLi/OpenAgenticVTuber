# Phase 13: Conversation History Sessions - Context

**Gathered:** 2026-05-09T07:39:23.7717936-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 adds real ChatGPT-style conversation history sessions and wires that real state into Settings. It replaces the current placeholder History sheet and single in-memory Conversation Settings copy with persistent local transcript sessions.

In scope:
- Create, switch, rename/title, search/filter, and delete sessions from the normal chat/history UI.
- Persist active session transcripts locally across app restart.
- Keep the existing LLM streaming, TTS, and VTS response pipeline intact.
- Update Settings > Conversation to show truthful session/history status and supported reset controls.

Out of scope:
- Semantic memory, retrieval, per-avatar memory, and shared user-fact storage.
- Agentic workflows or goal/task execution.
- Cloud sync, account-based history, cross-device history, or history export/import.

</domain>

<decisions>
## Implementation Decisions

### Session UX Shape

- **D-01:** The History sheet should become a full conversation-history manager, not a minimal CRUD list.
- **D-02:** It should support ChatGPT-style session browsing plus richer management in Phase 13: create new session, switch sessions, rename, delete, and search/filter sessions.
- **D-03:** Session management belongs in the existing normal chat/history UI surface, currently `HistorySheet`; Settings should not duplicate the full manager.

### Title Behavior

- **D-04:** New sessions start as "New chat".
- **D-05:** Sessions auto-title from the first user message once the first complete turn is saved.
- **D-06:** Manual rename remains supported and must override the auto-title.
- **D-07:** Do not add an extra LLM summarization/title-generation call in Phase 13.

### Persistence and Retention

- **D-08:** Persist conversation history locally with no automatic retention cap in this phase.
- **D-09:** Every completed session remains until the user deletes it.
- **D-10:** Provide delete-single-session and delete-all-history controls.
- **D-11:** Do not implement explicit-save-only behavior; normal chat sessions are persistent by default after completed turns.

### Streaming Pipeline Integration

- **D-12:** Persist only complete user/assistant turns.
- **D-13:** During an active turn, the existing streaming reducer may continue to render in-flight user and assistant bubbles, but persisted history should not be committed until the turn completes.
- **D-14:** Failed or interrupted turns should not become saved history by default. This avoids durable partial transcripts even though it may drop the failed prompt from persisted history.
- **D-15:** The existing LLM streaming, TTS, and VTS response pipeline must remain behaviorally unchanged while persistence is added around it.

### Settings > Conversation Controls

- **D-16:** Settings > Conversation should show real history status/counts and local-only behavior.
- **D-17:** Settings should expose a clear-all-history action with appropriate destructive-action confirmation.
- **D-18:** Settings should not list sessions or provide per-session switch/rename/delete; detailed session management stays in the History sheet.
- **D-19:** Settings copy must clearly distinguish transcript/session persistence from Memory, which remains deferred to v4.0 with the agentic system.

### the agent's Discretion

- Exact visual layout for date grouping, row actions, empty state, and search/filter presentation inside the History sheet.
- Exact local persistence schema and storage mechanism, provided it is real Electron/app persistence and supports migration-safe future extension.
- Exact wording for destructive confirmations and Settings summary copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Active v2.1 Scope
- `.planning/ROADMAP.md` — Phase 13 goal, requirements, success criteria, dependency on Phase 12, and Phase 14 mock-boundary dependency.
- `.planning/REQUIREMENTS.md` — HIST-01 through HIST-05, v2.1 boundaries, and Memory/agentic deferrals.
- `.planning/PROJECT.md` — project-level milestone intent and deferred v3.0/v4.0 scope.
- `.planning/STATE.md` — current workflow state and v2.1 progress.

### Prior Phase Decisions
- `.planning/phases/12-settings-reality-pass/12-CONTEXT.md` — Phase 12 explicitly made Conversation Settings truthful for a single in-memory thread and deferred saved sessions to this phase.

### Code Anchors
- `apps/renderer/src/chrome/HistorySheet.tsx` — current History sheet shell, placeholder thread list, disabled/search placeholder, and New Thread button behavior.
- `apps/renderer/src/screens/Chat/Chat.tsx` — current chat view, live send path, merge of dev-injected `chatMessages` with streaming reducer messages, and empty-state copy that says persistence is later.
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` — current single-turn streaming reducer and chain-start/audio/force-new/chain-end state machine.
- `apps/renderer/src/state/app-store.tsx` — current in-memory `chatMessages`, `setChatMessages`, `showThreadList`, reset behavior, and app-store patterns.
- `apps/renderer/src/screens/Settings/Settings.tsx` — current Conversation section showing single in-memory thread; target surface for real history summary and clear-all.
- `apps/renderer/src/lib/copy.ts` — user-visible copy for Chat, History, and Settings that must stop describing conversation persistence as future work after Phase 13.
- `apps/electron-main/src/window-store.ts` — current `electron-store` schema/patterns; no conversation history schema exists yet.
- `apps/electron-main/src/ipc.ts` — IPC registration pattern for renderer-accessible persisted app state.
- `apps/electron-main/preload/index.ts` — preload whitelist pattern for any new conversation-history API surface.
- `apps/renderer/tests/Chat.test.tsx` — existing chat behavior coverage; likely needs updates for persisted sessions and complete-turn commit behavior.
- `apps/renderer/tests/Settings.test.tsx` — Phase 12 tests currently assert the old Conversation truth surface and must be updated for Phase 13.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `HistorySheet` already provides the slide-in shell, close behavior, search row, grouped-list visual pattern, and New Thread button placement. Phase 13 should replace the placeholder data with real sessions instead of creating a separate history surface.
- `useStreamingMessages` already identifies user bubbles, assistant bubbles, thinking state, force-new boundaries, input-disabled state, speaking state, and stream banners. It is the key integration point for detecting complete turns without changing the sidecar pipeline.
- `window-store.ts` already uses typed `electron-store` schema defaults for durable local state such as chrome preferences, active avatar, and log level. Conversation persistence can follow that storage style or introduce a closely related store if schema size/shape warrants it.
- Settings already has a `ConversationSection` with the right anchor and section placement; Phase 13 should upgrade that section rather than adding a new Settings area.

### Established Patterns

- Renderer-to-main persistence goes through `window.api` preload methods backed by IPC handlers. New session/history operations should use that bridge rather than direct renderer filesystem access.
- Settings is a status/control summary surface. Phase 12 deliberately kept full feature workflows out of Settings when a normal product surface owns them.
- User-visible copy is centralized in `COPY`; changing persistence behavior requires updating Chat empty-state, History, and Settings copy together.
- Dev mocks and scripted fixtures still exist in Chat/History paths. Phase 13 should avoid expanding their role because Phase 14 will audit and isolate mock boundaries.

### Integration Points

- Replace `PLACEHOLDER_THREADS` usage in `HistorySheet` with real session query/search state.
- Replace `setChatMessages([])` as the New Thread implementation with real session creation/switching.
- Decide how the active session's persisted transcript hydrates into the rendered chat view while keeping in-flight streaming messages separate until turn completion.
- Add local persistence APIs for listing, creating, renaming, deleting, selecting, and clearing sessions.
- Update `Settings > Conversation` to consume session count/active-session metadata and clear-all-history capability.
- Update tests around History sheet management, session persistence across reload/restart boundaries, complete-turn persistence semantics, Settings summary/reset, and copy regressions.

</code_context>

<specifics>
## Specific Ideas

- The target user experience is explicitly ChatGPT-style conversation sessions.
- The user selected the richer manager shape for Phase 13, so search/filtering belongs in this phase rather than being deferred.
- The user selected complete-turn persistence. Planners should treat partial-turn durability as intentionally out of scope unless needed for technical consistency.

</specifics>

<deferred>
## Deferred Ideas

- Semantic memory, retrieval, and per-avatar memory remain v4.0 with the agentic system.
- LLM-generated conversation titles can be considered later if first-message titles feel insufficient.
- Retention limits, cloud sync, history export/import, and cross-device history are not part of Phase 13.

</deferred>

---

*Phase: 13-conversation-history-sessions*
*Context gathered: 2026-05-09T07:39:23.7717936-04:00*
