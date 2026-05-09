# Phase 13: Conversation History Sessions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09T07:39:23.7717936-04:00
**Phase:** 13-Conversation History Sessions
**Areas discussed:** Session UX shape, Title behavior, Persistence and retention, Streaming pipeline integration, Settings > Conversation controls

---

## Session UX Shape

| Option | Description | Selected |
|--------|-------------|----------|
| ChatGPT-like | Use the existing History sheet as a session list with New Chat, date grouping, select, rename, and delete. | |
| Minimal manager | Only add create, switch, rename, and delete without date grouping or search polish. | |
| Full manager | Include search/filtering and richer management now, increasing Phase 13 surface area. | ✓ |

**User's choice:** Full manager.
**Notes:** Search/filtering and richer management are in scope for Phase 13. Detailed session management belongs in the History sheet, not Settings.

---

## Title Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-title plus rename | Start as "New chat", then auto-title from the first user message. User can still rename. | ✓ |
| Manual only | Every session stays "New chat" until manually renamed. | |
| LLM-generated title | Ask the model to summarize/title the thread after the first exchange. | |

**User's choice:** Auto-title plus rename.
**Notes:** Manual rename must override auto-title. Extra LLM title generation is not part of Phase 13.

---

## Persistence and Retention

| Option | Description | Selected |
|--------|-------------|----------|
| Local unlimited history | Persist every session locally, with delete single session and delete all history. No retention limit for now. | ✓ |
| Local capped history | Persist locally but cap by session count or age, so old sessions are removed automatically. | |
| Explicit save only | Only preserve sessions the user chooses to save; otherwise chats remain temporary. | |

**User's choice:** Local unlimited history.
**Notes:** Normal chat sessions are persistent by default after completed turns. Users need delete-single and delete-all controls.

---

## Streaming Pipeline Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Persist user immediately, assistant on completion | Save the user message right away. Treat the assistant reply as a draft while streaming, then persist the completed assistant message when the turn finishes. | |
| Persist every assistant chunk live | Write assistant content during streaming so partial text survives interruption, but storage gets more complex. | |
| Persist only complete turns | Save nothing until both user and assistant are done, which avoids partial turns but can lose the user prompt on failure. | ✓ |

**User's choice:** Persist only complete turns.
**Notes:** Failed or interrupted turns should not become saved history by default. The live UI can still show in-flight streaming messages before persistence.

---

## Settings > Conversation Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Summary plus clear-all | Show real history status/counts and local-only behavior, with a clear-all-history action. Keep detailed session management in the History sheet. | ✓ |
| Full management in Settings | Settings also lists sessions and supports switching, rename, and delete there. | |
| Summary only | Settings truthfully describes session persistence, but destructive controls stay out of Settings. | |

**User's choice:** Summary plus clear-all.
**Notes:** Settings should show real status/counts and a destructive clear-all action, while per-session management remains in the History sheet.

---

## the agent's Discretion

- Exact History sheet layout for grouping, row actions, empty state, and search/filtering.
- Exact persistence schema and IPC shape.
- Exact Settings copy and destructive confirmation wording.

## Deferred Ideas

- Semantic memory, retrieval, and per-avatar memory remain v4.0 with the agentic system.
- LLM-generated titles, retention limits, cloud sync, export/import, and cross-device history are later possibilities.
