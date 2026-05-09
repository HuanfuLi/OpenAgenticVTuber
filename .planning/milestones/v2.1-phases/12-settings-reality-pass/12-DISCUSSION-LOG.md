# Phase 12: Settings Reality Pass - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09T06:44:21.4509634-04:00
**Phase:** 12-settings-reality-pass
**Areas discussed:** Avatar Settings Shape, VTube Studio Section Behavior, Conversation Truth Surface, Memory + Log Level Deferred Policy

---

## Folded Todo

| Option | Description | Selected |
|--------|-------------|----------|
| Yes | Treat the existing TODO as part of Phase 12 context so planner must account for it. | ✓ |
| No | Leave it as reviewed but not folded into Phase 12 decisions. | |

**User's choice:** Yes.
**Notes:** The folded TODO is `v2.1 Phase 12: replace Settings placeholders with real or accurately disabled states.`

---

## Avatar Settings Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Two real sections | `Avatars` shows active avatar + import/review entry; `Per-avatar settings` shows editable catalog/override state or precise disabled rows. | |
| One combined section | Collapse everything into `Avatars`, with active avatar, catalog editing, and per-avatar status together. | ✓ |
| Keep current `Avatar catalogs` section | Only update copy/actions and remove stale placeholder sections. | |

**User's choice:** One combined section.
**Notes:** Follow-up decisions: expose both `Edit current` and `Import/replace`; show active identity plus catalog counts; use truthful degraded state if sidecar metadata is unavailable.

---

## VTube Studio Section Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Compact status/help block | Keep a small VTS section for connection/auth state and avatar-motion troubleshooting. | ✓ |
| No standalone VTS section | Remove placeholder; rely on Status popover and Chat empty/error states. | |
| Full VTS controls section | Build reconnect/re-auth/token-reset controls now. | |

**User's choice:** Compact status/help block.
**Notes:** User questioned the need for a full VTS section and suggested status belongs in the upper-right Status bar. Final decisions: mirror live status inline in Settings, keep Status popover primary, expose `Restart sidecar` and `Reset/re-auth VTS token` behind a `Troubleshooting` disclosure.

---

## Conversation Truth Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Truth summary only | Single in-memory thread, clears on relaunch; no fake history/session controls. | ✓ |
| Truth summary + disabled future-history controls | Show intended history/session controls disabled and labeled future work. | |
| Remove Conversation Settings section | Rely on Chat empty/footer copy only. | |

**User's choice:** Truth summary only.
**Notes:** User asked whether ChatGPT-style conversation sessions could be included in Phase 12. It was classified as a new capability outside the Settings reality pass and deferred as its own future phase.

---

## Memory + Log Level Deferred Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled truthful Memory section | Keep Memory visible but disabled, saying memory ships with v4.0 agentic + memory scope. | ✓ |
| Remove Memory section | No Settings surface until memory work begins. | |
| Disabled with future controls preview | Show planned controls disabled, such as retrieval depth/delete memory. | |

**User's choice:** Disabled truthful Memory section.
**Notes:** Log-level follow-up decisions: implement a real log-level preference if feasible; first scope is renderer/main-process UI logging; expose `error`, `warn`, `info`, and `debug`.

---

## the agent's Discretion

- Exact visual layout and labels for the combined `Avatars` section.
- Exact VTS status copy and disclosure styling.
- Storage location and implementation details for renderer/main-process log-level preference.

## Deferred Ideas

- ChatGPT-style saved conversation history / sessions should be its own future phase, separate from Memory.
- Sidecar-wide Python log-level control can follow after renderer/main-process logging if not clean in Phase 12.
