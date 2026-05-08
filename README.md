# AgenticLLMVTuber

Local-first desktop companion app for a VTube Studio Live2D avatar. The app runs
an Electron/React shell with a Python sidecar, streams replies from a local or
OpenAI-compatible LLM, speaks through local Piper TTS, and drives avatar motion
directly into VTube Studio.

The long-term product goal is multi-avatar identity persistence: each avatar
should eventually have its own memory, personality, and relationship history
rather than being a generic chatbot behind a different model.

## Status

**v1.0 Walking Skeleton shipped on 2026-05-08.**

The current milestone is **v2.0 Plugin + Animation Control**. v2.0 is refactoring
the animation layer so body-motion behavior can be owned by swappable plugins,
rig capabilities can be inspected and edited through a HUD, and future avatar
import work has explicit contracts instead of Teto-specific assumptions.

### Working Today

- Electron desktop shell with React/Vite renderer.
- Python sidecar launched and supervised by Electron.
- First-launch LLM setup gate with LM Studio as the default local endpoint.
- LiteLLM streaming conversation pipeline.
- OLVT-style sentence buffering, tag extraction, display filtering, and
  text-to-speech queueing.
- Local Piper TTS with sentence-buffered playback.
- RMS-driven mouth movement through VTube Studio.
- 60 Hz sidecar-owned VTS compositor with idle motion, speech/head motion,
  smooth `[joy]` expression activation, cursor tracking, and a discrete hotkey
  demo path.
- Pydantic contracts as source of truth with generated TypeScript mirrors and
  JSON Schema intermediates.

### Current v2.0 Work

- Avatar import and catalog extraction.
- `RigCapabilities` and `AvatarOverrides` contracts.
- Plugin runtime for body-motion strategies.
- Three-category LLM code system: `[action]`, `{variant}`, and `<event>`.
- Slider HUD with per-parameter locks.
- Re-run of the migrated §14 verification ceremony against the refactored
  plugin architecture.

## Important Scope Notes

- The current renderer path is VTube Studio + pyvts. VTube Studio must be run
  separately by the user.
- Teto is the dev rig. Shipping/default avatar decisions are still separate from
  the current dev workflow.
- Phase 4 established that Teto's supported v1 body-motion fallback is
  `head_only`; proxy/body-param and exp3 modulation strategies are not exposed
  unless avatar overrides prove the required rig fields exist.
- Agent mode, persistent memory, scheduler, skills, multi-thread chat,
  multi-avatar switching, voice input, and pet mode are planned later milestones,
  not part of the shipped v1.0 skeleton.

## Requirements

- Windows is the primary development target right now.
- Node.js 22+ and npm 10+.
- Python 3.12 managed through `uv` for the sidecar.
- VTube Studio with the public API enabled for avatar runtime testing.
- LM Studio or another OpenAI-compatible endpoint for local LLM testing.

## Development

Install JavaScript dependencies:

```powershell
npm install
```

Install/sync the Python sidecar environment:

```powershell
cd sidecar
uv sync
cd ..
```

Run the desktop app:

```powershell
npm run dev
```

Useful checks:

```powershell
npm --workspace apps/renderer run typecheck
npm run check:contracts
cd sidecar
uv run pytest
```

`npm run check:contracts` regenerates the TypeScript contract mirrors from the
Pydantic models and fails if generated files drift.

## Repository Layout

- `apps/electron-main/` - Electron main process, sidecar lifecycle, IPC.
- `apps/renderer/` - React/Vite renderer.
- `sidecar/` - FastAPI/Python runtime, LLM/TTS/orchestrator/compositor/VTS code.
- `packages/contracts/` - Pydantic contracts, generated TypeScript mirrors, JSON
  Schema intermediates, and codegen tooling.
- `avatars/` - dev avatar configuration.
- `Live2D/` - local/dev Live2D assets.
- `.planning/` - milestone plans, verification, UAT, and archived roadmap docs.
- `PROJECT_DESIGN.md` - full design history and product/architecture decisions.

## Milestones

- **v1.0 Walking Skeleton** - shipped 2026-05-08. See
  `.planning/MILESTONES.md` and the `v1.0` git tag.
- **v2.0 Plugin + Animation Control** - in progress. Starts with Phase 8 avatar
  import and catalogs, then plugin runtime, parser dispatch, HUD, and final
  verification.

## Predecessor Context

This project succeeds work done in
[`Open-LLM-VTuber`](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber),
specifically the Vivid Actions phase explored in a fork. Lessons from that work
shape the hotkey/parameter-stream split, IDLE pin conventions, and `actionMap`
style planning used here.
