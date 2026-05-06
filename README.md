# AgenticLLMVTuber

Local-first desktop companion app: a VTube Studio Live2D avatar with an
opt-in agent mode that can take actions on the user's screen — daily
GUI routines, GUI automation, scheduled goals — while remaining a
conversational companion the rest of the time.

**Status:** pre-implementation. Design captured in
[PROJECT_DESIGN.md](./PROJECT_DESIGN.md).

## Highlights of the design

- **Continuous, non-hotkey-driven avatar liveliness** — 60 Hz action
  compositor mixing idle baseline + speech-driven motion + intent
  overlays + reactions. Hotkeys reserved for rare discrete events.
- **Multi-avatar identity** — per-avatar episodic memory, shared
  user-facts bucket, full personality switching from a dropdown.
- **Saved + scheduled agent goals** — turn the avatar into a daily
  automation (e.g. game daily check-ins) running while you watch.
- **Two-skill-system architecture** — claude-code's CLI skills for
  code/file/web tasks; in-app screen-control skills (manifest +
  auto-parser fallback) for GUI-control extensions.
- **TS-fluent stack** — Electron shell + React renderer + Python
  sidecar (the OLVT pipeline as the cheapest possible head-start).

## Predecessor context

This project succeeds work done in
[`Open-LLM-VTuber`](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
— specifically the Vivid Actions phase explored in a fork's
`.planning/phases/04-vivid-actions/`. Lessons learned about the
hotkey/parameter-stream split, IDLE pin conventions, and the
`actionMap` pattern feed directly into the design here.

## Layout

(empty until walking-skeleton lands; design doc only at this stage)

## Roadmap

See PROJECT_DESIGN.md §14 for the walking-skeleton scope. Each
subsequent feature surface (memory, agent runtime, scheduler, skills,
multi-thread chat, pet mode) is a 1–3 week chunk on top.
