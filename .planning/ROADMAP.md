# Roadmap: AgenticLLMVTuber

## Milestones

- ✅ **v1.0 Walking Skeleton** — Phases 1-5 shipped 2026-05-08. Archive: `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v2.0 Plugin + Animation Control** — Phases 8, 6, 7, 9, 10 shipped 2026-05-09. Archive: `.planning/milestones/v2.0-ROADMAP.md`
- ✅ **v2.1 Mock/Reality Cleanup** — Phases 11-15 shipped 2026-05-09. Archive: `.planning/milestones/v2.1-ROADMAP.md`

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

<details>
<summary>✅ v2.1 Mock/Reality Cleanup (Phases 11-15) — SHIPPED 2026-05-09</summary>

- [x] Phase 11: Status & App State Reality — 2/2 plans complete
- [x] Phase 12: Settings Reality Pass — 4/4 plans complete
- [x] Phase 13: Conversation History Sessions — 4/4 plans complete
- [x] Phase 14: Plugin Developer Docs + Plugin Swap Hardening — 4/4 plans complete
- [x] Phase 15: Mock Boundary Audit — 1/1 plan complete

Full details: `.planning/milestones/v2.1-ROADMAP.md`
Requirements archive: `.planning/milestones/v2.1-REQUIREMENTS.md`
Phase execution archive: `.planning/milestones/v2.1-phases/`
Audit: `.planning/milestones/v2.1-MILESTONE-AUDIT.md`

</details>

## Progress

| Milestone | Scope | Plans Complete | Status | Shipped |
|-----------|-------|----------------|--------|---------|
| v1.0 Walking Skeleton | Phases 1-5 | 17/17 | Complete | 2026-05-08 |
| v2.0 Plugin + Animation Control | Phases 8, 6, 7, 9, 10 | 27/27 | Complete with accepted tech debt | 2026-05-09 |
| v2.1 Mock/Reality Cleanup | Phases 11-15 | 15/15 | Complete | 2026-05-09 |

## Next Milestone Intent

v3.0 should focus on STT and TTS: voice input, configurable TTS voice/backend settings, and integration with the existing conversation, history, TTS, and VTS lipsync pipeline.

v4.0 remains the agentic system plus memory milestone: agent mode, goal loop, scheduler/skills bridge, and per-avatar/shared memory.

## Coverage

- v1.0 requirements archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.
- v2.0 requirements archived in `.planning/milestones/v2.0-REQUIREMENTS.md`.
- v2.1 requirements archived in `.planning/milestones/v2.1-REQUIREMENTS.md`.
- v2.0 audit result: functionally complete with tech debt, 53/53 requirements satisfied, 5/5 phases complete, Nyquist compliant.
- v2.1 audit result: complete, 26/26 requirements satisfied, 5/5 phases complete, no open critical gaps.

## Accepted Deferred Items

- Phase 7 live `<event>` UAT is catalog-gated because active Teto currently has `events: []`; parser, routing, and completion tracking are covered by automated tests.
- Phase 10 no-VTS-rect cursor synthetic fallback still projects against the primary monitor only. The live DPI-aware VTS-window path is validated on a two-monitor Windows setup with VTS on the secondary display.
- Memory and per-avatar identity remain deferred to v4.0 with the agentic system.

---
*Last updated: 2026-05-09 after v2.1 milestone completion*
