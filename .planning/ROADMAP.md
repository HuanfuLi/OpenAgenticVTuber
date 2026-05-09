# Roadmap: AgenticLLMVTuber

## Milestones

- ✅ **v1.0 Walking Skeleton** — Phases 1-5 shipped 2026-05-08. Archive: `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v2.0 Plugin + Animation Control** — Phases 8, 6, 7, 9, 10 shipped 2026-05-09. Archive: `.planning/milestones/v2.0-ROADMAP.md`
- 🚧 **v2.1 Mock/Reality Cleanup** — Phases 11-15 planned.

## Shipped Phases

<details>
<summary>✅ v1.0 Walking Skeleton (Phases 1-5) — SHIPPED 2026-05-08</summary>

- [x] Phase 1: Plumbing & Process Lifecycle — 2/2 plans complete
- [x] Phase 2: Conversation Pipeline — 3/3 plans complete
- [x] Phase 3: TTS & Sentence-Buffered Audio — 3/3 plans complete
- [x] Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation — 8/8 plans complete
- [x] Phase 5: Polish, Contracts Codegen, §14 Verification — 1/1 plan complete; §14 ceremony migrated to v2.0 Phase 10

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Plugin + Animation Control (Phases 8, 6, 7, 9, 10) — SHIPPED 2026-05-09</summary>

- [x] Phase 8: Avatar Import + Catalogs — 5/5 plans complete
- [x] Phase 6: Plugin Runtime + Default Plugin — 8/8 plans complete
- [x] Phase 7: Three-Category Code Parsing + Dispatch — 8/8 plans complete
- [x] Phase 9: Slider HUD + Per-Param Lock — 2/2 plans complete
- [x] Phase 10: Cursor Polish + §14 SC Re-Verification — 4/4 plans complete

Full details: `.planning/milestones/v2.0-ROADMAP.md`
Phase execution archive: `.planning/milestones/v2.0-phases/`
Audit: `.planning/milestones/v2.0-MILESTONE-AUDIT.md`

</details>

## Progress

| Milestone | Scope | Plans Complete | Status | Shipped |
|-----------|-------|----------------|--------|---------|
| v1.0 Walking Skeleton | Phases 1-5 | 17/17 | Complete | 2026-05-08 |
| v2.0 Plugin + Animation Control | Phases 8, 6, 7, 9, 10 | 27/27 | Complete with accepted tech debt | 2026-05-09 |
| v2.1 Mock/Reality Cleanup | Phases 11-15 | 10/13 | In Progress; Phase 13 visual recheck pending | - |

## Current Milestone: v2.1 Mock/Reality Cleanup

v2.1 replaces remaining mocked or hardcoded user-facing surfaces with truthful state before v3.0 STT/TTS work, adds first-class conversation history sessions, and documents/hardens the plugin developer path so v2.0's plugin architecture is operable before audit. It does not implement memory or the agentic system; memory is deferred to v4.0 with agentic workflows.

### Phase 11: Status & App State Reality

**Goal:** The status bar, app store, and setup-derived state report real provider/model, sidecar, and VTS status instead of mock or hardcoded values.

**Depends on:** v2.0 archive
**Requirements:** STAT-01, STAT-02, STAT-03, STAT-04, STAT-05
**Plans:** 2 complete

Plans:
- [x] 11-01-PLAN.md — Replace mock/hardcoded status and persistence paths with real app state.
- [x] 11-02-PLAN.md — Restore post-setup LLM provider/model reconfiguration in Settings.

**Success Criteria:**
1. Status popover shows the configured provider/model from persisted setup state, not hardcoded `qwen2.5`.
2. Sidecar status remains driven by Electron sidecar lifecycle events.
3. VTS status is real or truthfully disabled/unavailable; normal chrome no longer mutates `mockStatus`.
4. Production state persistence no longer depends on `mockSafeStorage`.
5. Settings > Connection / Models can edit and save provider/model settings after first-run setup.

### Phase 12: Settings Reality Pass

**Goal:** Settings sections for Avatars, per-avatar settings, VTube Studio, Conversation, Memory, and Log level become wired or truthfully disabled based on shipped capabilities.

**Depends on:** Phase 11
**Requirements:** SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07
**Plans:** 4 complete

Plans:
- [x] 12-01-PLAN.md — Replace Settings placeholders with real section content or accurate deferred states.
- [x] 12-02-PLAN.md — Close UAT gaps for Avatar current-edit loading and log-level descriptions.
- [x] 12-03-PLAN.md — Close UAT gaps for current avatar re-edit reliability and About version copy.
- [x] 12-04-PLAN.md — Clarify known-ID avatar degraded warning copy.

**Success Criteria:**
1. Avatar and VTube Studio settings link to existing import/review and real connection/auth state.
2. Conversation settings accurately describe the current single in-memory thread behavior.
3. Memory is disabled/deferred with copy naming v4.0 agentic + memory scope.
4. Log level is either functional or disabled with accurate copy; no "Coming in milestone-2" wording remains.

### Phase 13: Conversation History Sessions

**Goal:** Add ChatGPT-style conversation history sessions and wire the real session state into Settings.

**Depends on:** Phase 12
**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04, HIST-05
**Plans:** 4 complete

Plans:
- [x] 13-01-PLAN.md — Add durable local conversation store, typed IPC/preload bridge, and renderer state surface.
- [x] 13-02-PLAN.md — Wire Chat and History sheet to real sessions with complete-turn persistence.
- [x] 13-03-PLAN.md — Wire Settings Conversation summary/reset, copy, regression tests, and UAT checklist.
- [x] 13-04-PLAN.md — Close UAT gap: title-first History rows without visible assistant-response preview and add close animation.

**Success Criteria:**
1. Users can create, switch, rename/title, and delete conversation sessions from normal chat/history UI.
2. Active session messages persist across app restart and restore without relying on scripted conversation fixtures.
3. Sending a message appends to the active session while preserving the existing LLM/TTS/VTS response pipeline.
4. Settings > Conversation reflects real session/history behavior and exposes truthful controls for retention/reset where supported.
5. Conversation history remains transcript/session persistence only; memory and retrieval remain deferred to v4.0.

### Phase 14: Plugin Developer Docs + Plugin Swap Hardening

**Goal:** Motion plugin developers have accurate human and AI-facing documentation, and the app's plugin selection/swap path exposes real validation, restart, and fallback state instead of silently accepting broken plugins.

**Depends on:** Phase 13
**Requirements:** PLUGDOC-01, PLUGDOC-02, PLUGDOC-03, PLUGDOC-04, PLUGDOC-05
**Plans:** 2 planned

Plans:
- [ ] 14-01-PLAN.md — Write code-verified plugin developer docs, AI-agent brief, and default-plugin worked example.
- [ ] 14-02-PLAN.md — Harden plugin listing/selection/restart/status behavior and cover invalid/fallback cases with tests.

**Success Criteria:**
1. Human plugin developers can find the plugin directory layout, manifest schema, lifecycle hooks, `ParamFrame` semantics, dependency expectations, and testing workflow in top-level docs.
2. AI coding agents have a compact implementation brief naming the plugin invariants, required source files, forbidden patterns, and regression commands.
3. Selecting a different plugin clearly applies through a sidecar restart or an explicit restart-required state; users are not left thinking a boot-time setting hot-swapped live.
4. Invalid manifests, missing entrypoints, incompatible API versions, and `NullPlugin` fallback are visible through Settings/status/log surfaces with truthful copy.
5. Tests cover plugin discovery/listing parity, active-plugin persistence, restart behavior, and invalid-plugin/fallback reporting.

### Phase 15: Mock Boundary Audit

**Goal:** Normal user flows no longer depend on dev mocks, scripted fixtures, or mock alert actions; remaining mocks are isolated to dev/test surfaces.

**Depends on:** Phase 14
**Requirements:** MOCK-01, MOCK-02, MOCK-03, MOCK-04
**Plans:** 1 planned

Plans:
- [ ] 15-01-PLAN.md — Audit and enforce mock boundaries with tests and production-flow cleanup.

**Success Criteria:**
1. `mockStatus`, `mockBanners`, `mockToasts`, `mockSafeStorage`, and scripted conversation fixtures are absent from normal production chrome/user flows.
2. Dev-only mock controls remain available only through explicit development utilities.
3. Mock alert actions for logs/docs are replaced with real actions or disabled truthful controls.
4. Tests cover status, Settings, persistence, and mock-boundary regressions.

## Coverage

- v1.0 requirements archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.
- v2.0 requirements archived in `.planning/milestones/v2.0-REQUIREMENTS.md`.
- v2.0 audit result: functionally complete with tech debt, 53/53 requirements satisfied, 5/5 phases complete, Nyquist compliant.
- v2.1 requirements live in `.planning/REQUIREMENTS.md` with all active requirements mapped to phases 11-15.

## Accepted Deferred Items

- Phase 7 live `<event>` UAT is catalog-gated because active Teto currently has `events: []`; parser, routing, and completion tracking are covered by automated tests.
- Phase 10 no-VTS-rect cursor synthetic fallback still projects against the primary monitor only. The live DPI-aware VTS-window path is validated on a two-monitor Windows setup with VTS on the secondary display.

---
*Last updated: 2026-05-09 after Phase 13 gap closure implementation; visual recheck pending*
