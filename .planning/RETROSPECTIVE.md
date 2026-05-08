# Project Retrospective

## Milestone: v1.0 — Walking Skeleton

**Shipped:** 2026-05-08
**Phases:** 5
**Plans:** 17

### What Was Built

The project now has a usable walking skeleton: Electron launches a Python sidecar, the renderer talks over the OLVT-shaped WebSocket envelope, the LLM streams replies through the sentence/action pipeline, local TTS speaks sentence-by-sentence, and the sidecar drives VTube Studio directly through a 60 Hz compositor.

### What Worked

- UAT caught the right problems: no audio after setup, incorrect VTS mouth parameter IDs, `[joy]` vocabulary mismatch, and log floods from both speech-driver evidence and missing VTS params.
- Keeping VTS writes sidecar-direct avoided a renderer 60 Hz IPC path.
- The single-writer pyvts wrapper stayed load-bearing and absorbed later VTS dispatch needs cleanly.
- Codegen paid off immediately by making contract drift visible through `npm run check:contracts`.

### What Was Inefficient

- Phase 4 verification became stale after UAT-driven fixes; future milestone closure should regenerate verification after UAT fixes or explicitly mark UAT as superseding.
- The generic milestone archive CLI was too broad once v2.0 research existed in `.planning/phases/`; milestone archive operations need scoped phase selection.
- Body-sway research needed live VTS feedback earlier. The final decision was correct, but unsupported strategy controls briefly leaked into the product.

### Patterns Established

- Live VTS errors should disable missing parameters after the first structured `errorID=453` response instead of logging every frame.
- High-frequency evidence logs must be opt-in and throttled.
- Avatar-specific strategy controls should only surface when the avatar override file proves the required rig fields exist.

### Key Lessons

- For the Teto rig, `head_only` is the correct v1 body-motion strategy. Full body control belongs in the v2 plugin/HUD system where rig capabilities are explicit.
- Expression activation should use VTS expression APIs for expression files; raw parameter injection is only appropriate for verified tracking/input parameters.
- UAT artifacts are first-class closure evidence when they contain the operator-observed pass/fix loop.

## Cross-Milestone Trends

| Trend | v1.0 Observation |
|-------|------------------|
| Live-runtime dependencies | VTS, audio devices, and LM Studio require human/UAT checkpoints. |
| Contract drift | Generated contracts plus drift checks are worth keeping as a required gate. |
| Logging | Any 60 Hz loop can become unusable without throttling and opt-in evidence flags. |
