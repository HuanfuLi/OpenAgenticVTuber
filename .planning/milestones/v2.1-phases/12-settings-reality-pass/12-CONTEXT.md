# Phase 12: Settings Reality Pass - Context

**Gathered:** 2026-05-09T06:44:21.4509634-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 makes Settings truthful for shipped capabilities and accurately disabled for deferred capabilities. It replaces stale milestone placeholders in Settings for Avatars, VTube Studio, Conversation, Memory, and Log level. It may wire existing shipped surfaces into Settings, but it must not add unrelated new product capabilities.

In scope:
- Replace the current avatar/per-avatar placeholders with one real `Avatars` section backed by the existing avatar import/catalog flow.
- Replace the VTube Studio placeholder with a compact status/help block that mirrors live VTS status and exposes real troubleshooting actions.
- Replace fake Conversation controls/copy with a truthful statement of the current single in-memory thread behavior.
- Keep Memory visible but disabled, with copy that points to v4.0 agentic + memory scope.
- Replace the disabled Log level placeholder with a real renderer/main-process log-level preference if feasible.

Out of scope:
- Implementing saved conversation sessions/history.
- Implementing Memory, retrieval, deletion, or per-avatar identity storage.
- Adding new avatar importer formats or first-class multi-avatar switching.
- Re-architecting VTS ownership; VTS remains sidecar-owned through the existing pyvts/single-writer path.

</domain>

<decisions>
## Implementation Decisions

### Avatar Settings Shape

- **D-01:** Collapse avatar-related Settings into one combined `Avatars` section. Do not keep separate stale `Avatars`, `Avatar catalogs`, and `Per-avatar settings` surfaces.
- **D-02:** The combined `Avatars` section exposes both `Edit current` and `Import/replace` actions. `Edit current` should load the existing current-avatar review/catalog path; `Import/replace` should start the folder-picker/import flow.
- **D-03:** The read-only state in the `Avatars` section shows active identity plus catalog counts: avatar id/name, source path, variant count, event count, and voice if available.
- **D-04:** If current avatar metadata cannot be loaded from the sidecar, Settings shows a truthful degraded state. It may show the active avatar id from Electron store if available, marks catalogs unavailable, and keeps `Import/replace` enabled. Do not silently assume Teto.

### VTube Studio Section Behavior

- **D-05:** VTS live status primarily belongs in the upper-right Status popover/bar. Settings should not become a large VTS control surface.
- **D-06:** Settings keeps a compact VTS status/help block. The block shows the same live VTS status inline and gives practical guidance for avatar-motion failures.
- **D-07:** The compact VTS block exposes real troubleshooting actions for `Restart sidecar` and `Reset/re-auth VTS token`.
- **D-08:** Troubleshooting actions must sit behind a small `Troubleshooting` disclosure or equivalent collapsed affordance. Copy should make clear that normal reconnect is automatic and these are not everyday controls.

### Conversation Truth Surface

- **D-09:** Phase 12 does not implement saved conversation sessions/history. That is a new capability and is deferred to its own future phase.
- **D-10:** Conversation Settings shows a truth summary only: the current product has a single in-memory thread that clears on relaunch. Do not expose fake history/session controls.

### Memory and Log Level Policy

- **D-11:** Memory remains visible in Settings as a disabled truthful section. Copy must state that Memory ships with the v4.0 agentic + memory scope.
- **D-12:** Log level should become a real preference if feasible in Phase 12.
- **D-13:** The first real log-level scope is renderer/main-process UI logging. Sidecar log-level control can follow later if it is not cleanly supported by existing plumbing.
- **D-14:** Expose `error`, `warn`, `info`, and `debug` levels.

### Folded Todos

- **v2.1 Phase 12 TODO:** `replace Settings placeholders with real or accurately disabled states.` This is folded into Phase 12 context and should be explicitly handled by planning.

### the agent's Discretion

- Exact visual layout and labels for the combined `Avatars` section.
- Whether `Edit current` is implemented as a direct preloaded route or a route plus sidecar request, as long as the user sees the current avatar catalogs rather than a blank import flow.
- Exact VTS status copy and disclosure styling.
- Where the renderer/main-process log-level preference is stored, provided it is real and does not rely on dev mocks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Active v2.1 Scope
- `.planning/ROADMAP.md` — Phase 12 goal, requirements, success criteria, and v2.1 milestone boundary.
- `.planning/REQUIREMENTS.md` — SET-01 through SET-07, plus v2.1 out-of-scope boundaries.
- `.planning/PROJECT.md` — current milestone intent, deferred Memory/v4.0 decision, and current product state.
- `.planning/STATE.md` — active milestone state and folded Phase 12 pending TODO.

### Prior Phase Decisions
- `.planning/milestones/v2.0-phases/08-avatar-import-catalogs/08-CONTEXT.md` — existing avatar import/catalog contracts and Settings route precedent.
- `.planning/milestones/v2.0-phases/09-slider-hud-per-param-lock/09-CONTEXT.md` — Settings entry pattern for the HUD and VTS/compositor ownership constraints.
- `.planning/milestones/v2.0-phases/10-cursor-polish-14-sc-re-verification/10-CONTEXT.md` — current VTS/cursor/operator verification state and VTS troubleshooting context.

### Code Anchors
- `apps/renderer/src/screens/Settings/Settings.tsx` — current Settings implementation, stale placeholders, mock retest/status mutations, disabled log-level row, and avatar catalog entry.
- `apps/renderer/src/lib/copy.ts` — user-visible Settings copy and stale milestone wording to update.
- `apps/renderer/src/state/app-store.tsx` — current renderer state, single in-memory chat state, mock status/storage dependencies that Phase 12 must avoid extending.
- `apps/electron-main/preload/index.ts` — renderer API surface for sidecar, config, avatar import, and HUD actions.
- `apps/electron-main/src/ipc.ts` — existing IPC handlers for avatar import, config save/restart, and HUD open; likely integration point for restart/token/log actions.
- `apps/electron-main/src/window-store.ts` — current `currentAvatarId` persistence source.
- `apps/electron-main/src/sidecar.ts` — sidecar restart support and active avatar/plugin env handoff.
- `sidecar/src/sidecar/admin/avatar.py` — `/admin/avatar/import/current` and import/commit endpoints for current avatar metadata.
- `sidecar/src/sidecar/vts/handshake.py` — VTS auth/token handshake behavior.
- `sidecar/src/sidecar/vts/pyvts_writer.py` — current VTS token path and single-writer VTS ownership.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `AvatarImport` route and bridge APIs already exist. Phase 12 should reuse them rather than inventing a second avatar editor.
- `/admin/avatar/import/current?avatar_id=...` already returns an `AvatarImportPlan` for current-avatar review when overrides exist.
- Electron `window-store` already persists `currentAvatarId`, which can power degraded avatar identity when sidecar metadata is unavailable.
- `restartSidecar()` already exists in `apps/electron-main/src/sidecar.ts` and is used after config/avatar changes.
- VTS token storage is already in the sidecar VTS writer/handshake path, making reset/re-auth feasible as a maintenance action if exposed carefully.

### Established Patterns

- Settings uses a long-scroll section layout with anchor pills; Phase 12 should update sections in that pattern instead of introducing a new navigation concept.
- User-visible copy is centralized in `COPY`; stale milestone wording should be fixed there rather than inlining ad hoc copy.
- Existing renderer-to-main access goes through whitelisted `window.api` preload methods; new actions should follow that bridge pattern.
- Sidecar-owned VTS control is a hard architectural constraint. Renderer Settings may request high-level troubleshooting actions, but must not call pyvts or own VTS state directly.

### Integration Points

- Replace `PlaceholderSection` usage for avatar, VTS, Conversation, and Memory with explicit real/disabled sections.
- Add or extend preload + IPC methods for current-avatar lookup, sidecar restart, VTS token reset/re-auth, and log-level preference as needed.
- Update Settings tests around stale copy, disabled states, avatar actions, VTS troubleshooting, and log-level behavior.
- Ensure mock-only imports such as `mockStatus` do not remain in normal Settings flows after Phase 12.

</code_context>

<specifics>
## Specific Ideas

- The user questioned whether a full VTS Settings section is necessary. Final decision: keep VTS compact and status-oriented, with the upper-right Status popover/bar as the primary live status surface.
- The user explicitly distinguished Conversation history from Memory. Saved sessions are considered easier than Memory, but still not part of this Settings-reality phase.
- `Reset/re-auth VTS token` means deleting the stored VTS plugin token and forcing VTube Studio to show the plugin authorization prompt again. This should be framed as troubleshooting, not a normal reconnect path.

</specifics>

<deferred>
## Deferred Ideas

- ChatGPT-style saved conversation history / sessions should be its own future phase, separate from Memory. It is smaller than Memory but still needs persistence, thread schema, Chat/History UI behavior, reset/migration rules, and tests.
- Sidecar-wide Python log-level control can follow later if renderer/main-process log preference lands first and sidecar support is not clean in Phase 12.

</deferred>

---

*Phase: 12-settings-reality-pass*
*Context gathered: 2026-05-09T06:44:21.4509634-04:00*
