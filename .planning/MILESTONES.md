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
