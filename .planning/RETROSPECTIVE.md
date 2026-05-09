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

## Milestone: v2.0 — Plugin + Animation Control

**Shipped:** 2026-05-09
**Phases:** 5
**Plans:** 27

### What Was Built

v2.0 moved animation control out of one-off compositor intent logic and into a plugin/catalog architecture. The project now has avatar import and review artifacts, `RigCapabilities` and `AvatarOverrides`, a supervised default body-motion plugin, three-category LLM dispatch, a live slider HUD with locks, and a refreshed §14 verification record with all six success criteria passing.

### What Worked

- Executing Phase 8 before Phase 6 avoided compatibility shims: plugin runtime could consume the real catalog/capabilities contracts.
- Live UAT found the highest-risk animation gaps: supervised smirk dispatch, cursor eye routing/sign, and blink ownership.
- The single-writer VTS rule remained a useful architectural guard when plugin, variant, event, HUD, and cursor paths all needed VTS access.
- The HUD quickly exposed rig reality: fewer visible operator sliders than raw writable params is correct for a useful discovery surface.

### What Was Inefficient

- Several validation docs became stale after gap-only fixes and needed retroactive Nyquist refreshes.
- Cursor behavior mixed three concerns at first: namespace, eye surface/sign, and fallback projection. Separating live VTS-window projection from synthetic fallback debt made the close decision cleaner.
- Event UAT depends on importing an event-bearing avatar; Teto could not validate that live path because its active catalog has `events: []`.

### Patterns Established

- Avatar catalogs are boot-frozen contracts shared by prompt assembly, parser runtime, plugin load, HUD population, and verification.
- VTS owns normal idle blinking. Future deliberate eye gestures are allowed only as explicit bounded plugin/action/variant output.
- HUD surfaces should be capability-filtered for operator usefulness, not raw dumps of every writable Cubism parameter.

### Key Lessons

- Treat real rig catalogs as prerequisites for live UAT. If the active avatar cannot express a category, record that as prerequisite-gated instead of fabricating evidence.
- A plugin supervisor must proxy the full production plugin surface, not only lifecycle methods; otherwise tests can pass while live action dispatch is a no-op.
- Multi-monitor cursor support is mostly solved by the authoritative VTS HWND rect. The remaining robustness issue is only the fallback path when no VTS rect is available.

## Milestone: v2.1 — Mock/Reality Cleanup

**Shipped:** 2026-05-09
**Phases:** 5
**Plans:** 15

### What Was Built

v2.1 made the existing product surface truthful before voice and agentic work. Status chrome now reflects real provider/model, sidecar, and VTS state; Settings sections are wired to shipped capabilities or accurately deferred; conversation history sessions persist locally and feed restored context back into the sidecar; plugin authoring and plugin switching are documented and diagnosable; and production renderer flows no longer rely on development mocks or scripted fixtures.

### What Worked

- UAT quickly caught the important product-level mismatches: provider/model reconfiguration, avatar re-edit behavior, history row design, plugin restart fallout, and mock leakage.
- Adding conversation history before STT/TTS gives voice work a real session model to integrate with instead of another placeholder.
- Treating plugin swap as a restart-driven operation made user expectations and runtime behavior match.
- Mock-boundary tests are a useful guardrail now that development controls still exist but production chrome must stay real.

### What Was Inefficient

- Some settings copy and history behavior needed multiple small gap closures because the first implementation matched data availability more than standard user expectations.
- The old mock/demo surfaces were spread across state, UI, and shell bridge layers, so the cleanup needed both static greps and behavioral tests.
- The unavailable `gsd-sdk query` path means milestone-close audits still need a local/manual fallback in this repo.

### Patterns Established

- Settings must either call real shipped behavior or explicitly say why a capability is deferred.
- History rows should be title-first and avoid exposing assistant-response previews by default.
- Dev mock modules can remain in the tree only when production import boundaries are tested.
- Sidecar restarts must reconnect chat clients to the newest ready URL; otherwise plugin changes can strand the input.

### Key Lessons

- A cleanup milestone can be strategically valuable when it removes product ambiguity before larger capability work.
- User-facing truthfulness is a feature: hardcoded status, fake alerts, and optimistic placeholders create real UAT failures even when core pipelines work.
- Archiving phase evidence immediately after completion keeps future planning cleaner and reduces stale active-milestone context.

## Cross-Milestone Trends

| Trend | v1.0 Observation | v2.0 Observation | v2.1 Observation |
|-------|------------------|------------------|------------------|
| Live-runtime dependencies | VTS, audio devices, and LM Studio require human/UAT checkpoints. | VTS rig catalogs also gate what can be live-tested; event UAT needs an event-bearing avatar. | Real provider/model, sidecar restart, VTS state, and persisted settings need UAT because mocks can hide product drift. |
| Contract drift | Generated contracts plus drift checks are worth keeping as a required gate. | Contract codegen had to handle nested generated schemas and discriminated HUD unions; drift checks stayed useful. | IPC/preload/state tests are the practical contract guard for renderer/Electron truthfulness. |
| Logging and diagnostics | Any 60 Hz loop can become unusable without throttling and opt-in evidence flags. | Dispatch logs and HUD stream telemetry were useful, but validation docs must be refreshed immediately after UAT gap fixes. | Diagnostics and Settings copy should expose real fallback/restart states instead of forcing users to infer them from logs. |
