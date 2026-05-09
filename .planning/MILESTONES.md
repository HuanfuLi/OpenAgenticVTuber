# Project Milestones: AgenticLLMVTuber

## v1.0 Walking Skeleton (Shipped: 2026-05-08)

**Delivered:** A local-first Electron + Python sidecar walking skeleton that can chat through a real LLM, speak through local Piper TTS, drive VTube Studio through a 60 Hz compositor, and validate the action/control architecture with the Teto dev rig.

**Phases completed:** 1-5 (17 plans total)

**Key accomplishments:**

- Built the Electron/React shell, Python sidecar lifecycle, localhost WebSocket protocol, and first-launch LLM setup gate.
- Landed the LiteLLM streaming conversation pipeline with OLVT-style sentence buffering, tag extraction, bracket stripping, and single-thread in-memory chat.
- Added local Piper TTS with sentence-buffered ordered playback, RMS envelope extraction, and VTS mouth movement.
- Shipped the VTS action compositor with idle motion, speech/head motion, smooth `[joy]` expression blend, cursor tracking, and discrete hotkey dispatch.
- Closed the contracts drift risk with Pydantic-to-TypeScript codegen and committed JSON Schema intermediates.

**Known adjustments:**

- SC-01, the formal §14 skeleton-verification ceremony, was migrated to v2.0 Phase 10 because the animation layer is being refactored into a plugin-driven system.
- Teto body sway ships as `head_only`; unsupported strategy controls are hidden unless avatar overrides configure their required VTS parameters.

**Stats:**

- 5 phases complete
- 17 plans complete
- 25 v1 requirements resolved: 24 complete plus SC-01 migrated to v2.0 Phase 10
- Git range: `640dc3d` -> `3df6e4b`

**Archive:**

- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`
- `.planning/v1.0-MILESTONE-AUDIT.md`

**What's next:** v2.0 Plugin + Animation Control, starting from Phase 8 Avatar Import + Catalogs.

---

## v2.0 Plugin + Animation Control (Shipped: 2026-05-09)

**Delivered:** A plugin-driven animation architecture with avatar catalog import, three-category LLM dispatch, a live slider HUD, and a refreshed §14 verification record against the refactored system.

**Phases completed:** 8, 6, 7, 9, 10 (27 plans total)

**Key accomplishments:**

- Built avatar import/catalog infrastructure around `AvatarOverrides` and `RigCapabilities`, including review/edit/write flows and Teto dogfooding.
- Replaced compositor-owned expression/body intent logic with a single-active `BodyMotionPlugin` runtime, default plugin, supervisor, manifest validation, and single-writer VTS guardrails.
- Shipped the `[action]`, `{variant}`, and `<event>` parser/dispatch system with reserved-name and cross-category collision protection.
- Added a dedicated HUD window backed by `/admin/rig-capabilities` and `/hud/ws`, focused visible sliders, live stream telemetry, and session-only per-param locks.
- Closed the migrated §14 verification ceremony: lipsync, smirk/action dispatch, idle motion, body sway, cursor head/eye tracking, blink ownership, and protocol shape are all recorded PASS.

**Known deferred items at close:**

- Phase 7 live `<event>` UAT remains externally catalog-gated because active Teto currently has `events: []`; automated parser/routing/tracker coverage is present.
- Phase 10 no-VTS-rect cursor synthetic fallback remains primary-monitor-only. The live DPI-aware VTS-window path was validated on a two-monitor Windows setup with VTS on the secondary display.

**Stats:**

- 5 phases complete
- 27 plans complete
- 53 v2.0 requirements satisfied
- Audit status: `tech_debt` with no critical gaps
- Nyquist status: compliant

**Archive:**

- `.planning/milestones/v2.0-ROADMAP.md`
- `.planning/milestones/v2.0-REQUIREMENTS.md`
- `.planning/milestones/v2.0-MILESTONE-AUDIT.md`
- `.planning/milestones/v2.0-phases/`

**What's next:** Start the next milestone with `$gsd-new-milestone`; it will create fresh requirements for the next scope.

---
