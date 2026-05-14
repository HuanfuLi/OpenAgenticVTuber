# AgenticLLMVTuber

Local-first desktop companion app for a VTube Studio Live2D avatar. The app runs
an Electron/React shell with a Python sidecar, streams replies from a local or
OpenAI-compatible LLM, speaks through configurable local/rich voice backends,
accepts final speech input through PTT or VAD, and drives avatar motion directly
into VTube Studio.

The long-term product goal is multi-avatar identity persistence: each avatar
should eventually have its own memory, personality, and relationship history
rather than being a generic chatbot behind a different model.

## Status

**v3.0 Rich Voice Configuration + Voice Input shipped on 2026-05-14.**

Shipped milestones:

- **v1.0 Walking Skeleton** - Electron/Python sidecar, LLM streaming, Piper TTS,
  VTube Studio compositor, and generated contracts.
- **v2.0 Plugin + Animation Control** - avatar catalogs, rig capabilities,
  body-motion plugin runtime, three-category code parsing, HUD, and refactored
  verification.
- **v2.1 Mock/Reality Cleanup** - truthful status/settings surfaces,
  conversation history sessions, plugin developer workflow, and production mock
  boundary.
- **v3.0 Rich Voice Configuration + Voice Input** - configurable TTS/STT,
  GPT-SoVITS voice output, local/cloud STT providers, final-only voice input,
  stop/edit recovery, code-switch evaluation, and no-headphones/AEC policy.

There is currently no active milestone. The next planned direction is **v4.0
Agentic System + Memory**.

## Working Today

- Electron desktop shell with React/Vite renderer.
- Python sidecar launched and supervised by Electron.
- First-launch LLM setup gate with LM Studio as the default local endpoint.
- LiteLLM streaming conversation pipeline.
- OLVT-style sentence buffering, tag extraction, display filtering, and
  text-to-speech queueing.
- Local Piper TTS baseline with sentence-buffered ordered playback.
- GPT-SoVITS TTS provider with external-server or app-managed launch modes,
  health/test synthesis, activation, named voice presets, reference audio
  validation, and visible failure handling.
- RMS-driven mouth movement and speech envelopes through VTube Studio.
- 60 Hz sidecar-owned VTS compositor with idle motion, speech/head motion,
  expression activation, cursor tracking, and plugin-controlled body motion.
- Avatar import/catalog contracts with `RigCapabilities`, `AvatarOverrides`, and
  a focused HUD for live parameter discovery/locking.
- Three-category LLM code system: `[action]`, `{variant}`, and `<event>`.
- ChatGPT-style persisted conversation history sessions.
- Whole-screen Settings UI for LLM, voice output, voice input, avatars, VTube
  Studio, conversation, memory status, and diagnostics.
- STT provider layer with FunASR/SenseVoiceSmall as the current local-first
  recommendation, faster-whisper as local fallback, and OpenAI/Groq as explicit
  opt-in cloud providers.
- Local STT model cache controls and redacted provider diagnostics.
- Final-only voice input through push-to-talk or conservative VAD auto-submit.
- Stop-current-turn and edit/regenerate from a user message for typo recovery.
- AEC/no-headphones status policy: Limited for the tested setup, Unsafe by
  default for unverified hardware.
- Pydantic contracts as source of truth with generated TypeScript mirrors and
  JSON Schema intermediates.

## Important Scope Notes

- The current renderer path is VTube Studio + pyvts. VTube Studio must be run
  separately by the user.
- Teto is the dev rig. Shipping/default avatar decisions are separate from the
  current dev workflow.
- GPT-SoVITS installer, training, and voice-cloning UI are out of scope; users
  supply their own model/server.
- Voice configuration diagnostics are standalone and optional. Tests should not
  be required just to enable a configuration when required fields are complete.
- faster-whisper CUDA acceleration depends on local NVIDIA CUDA 12 runtime
  libraries. CPU mode and FunASR remain available when CUDA is not usable.
- Cloud STT providers are never enabled by default and require explicit
  credentials/consent.
- No-headphones support is hardware-dependent. VAD remains conservative and
  should not be treated as universally echo-safe.
- Agent mode, scheduler, skills, semantic memory, per-avatar identity memory,
  multi-avatar switching, wake word, translation, barge-in, pet mode, and mobile
  companion support are later milestones.

## Requirements

- Windows is the primary development target right now.
- Node.js 22+ and npm 10+.
- Python 3.12 managed through `uv` for the sidecar.
- VTube Studio with the public API enabled for avatar runtime testing.
- LM Studio or another OpenAI-compatible endpoint for local LLM testing.
- Optional: GPT-SoVITS server/model for rich voice output.
- Optional: local STT model downloads for FunASR or faster-whisper.
- Optional: cloud STT credentials for OpenAI or Groq transcription.

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
npm --workspace apps/renderer run test
npm --workspace apps/electron-main run test
npm run check:contracts
cd sidecar
uv run pytest
```

`npm run check:contracts` regenerates the TypeScript contract mirrors from the
Pydantic models and fails if generated files drift.

## Repository Layout

- `apps/electron-main/` - Electron main process, sidecar lifecycle, IPC, secure
  settings persistence, and conversation-store bridges.
- `apps/renderer/` - React/Vite renderer, Chat, Settings, HUD/status chrome,
  voice capture, and browser audio handling.
- `sidecar/` - FastAPI/Python runtime, LLM/TTS/STT/orchestrator/compositor/VTS
  code, provider registries, and admin endpoints.
- `packages/contracts/` - Pydantic contracts, generated TypeScript mirrors, JSON
  Schema intermediates, and codegen tooling.
- `avatars/` - dev avatar configuration.
- `plugins/` - body-motion plugin assets and examples.
- `Live2D/` - local/dev Live2D assets.
- `docs/` - project-facing reference docs.
- `.planning/` - current project state plus archived milestone plans,
  verification, UAT, requirements, and audit docs.
- `PROJECT_DESIGN.md` - full design history and product/architecture decisions.

## Milestones

- **v1.0 Walking Skeleton** - shipped 2026-05-08. See the `v1.0` git tag.
- **v2.0 Plugin + Animation Control** - shipped 2026-05-09. See the `v2.0` git
  tag.
- **v2.1 Mock/Reality Cleanup** - shipped 2026-05-09. See the `v2.1` git tag.
- **v3.0 Rich Voice Configuration + Voice Input** - shipped 2026-05-14. See the
  `v3.0` git tag.

Detailed milestone archives live in `.planning/MILESTONES.md` and
`.planning/milestones/`.

## Predecessor Context

This project succeeds work done in
[`Open-LLM-VTuber`](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber),
specifically the Vivid Actions phase explored in a fork. Lessons from that work
shape the hotkey/parameter-stream split, IDLE pin conventions, ASR/VAD reference
patterns, and `actionMap` style planning used here.
