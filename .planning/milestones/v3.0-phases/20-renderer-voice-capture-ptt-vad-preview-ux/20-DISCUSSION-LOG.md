# Phase 20: Renderer Voice Capture + PTT/VAD Preview UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-10T00:10:17.2364891-04:00
**Phase:** 20-Renderer Voice Capture + PTT/VAD Preview UX
**Areas discussed:** PTT/VAD activation model; roadmap-locked voice flow

---

## PTT/VAD Activation Model

| Option | Description | Selected |
|--------|-------------|----------|
| PTT first, VAD secondary | Add a mic/PTT button in the chat input row; VAD is an explicit toggle/control nearby only after STT is enabled and ready. | yes |
| Equal modes | Present PTT and VAD as two peer modes, with the user choosing one active voice-input mode. | |
| VAD-forward | Make always-listening/VAD the main voice path, with PTT as fallback. | |

**User's choice:** PTT first, VAD secondary.
**Notes:** Chat voice controls should prioritize hold-to-talk while keeping VAD explicit and secondary.

| Option | Description | Selected |
|--------|-------------|----------|
| Mouse press + keyboard shortcut | Hold the mic button or a configurable PTT hotkey. | yes |
| Mouse press only | Simpler Phase 20 scope, but less useful while typing or using other windows. | |
| Toggle-to-record | Click once to start, click again to stop. Easier accessibility, but higher accidental capture risk. | |

**User's choice:** Mouse press plus configurable keyboard shortcut.
**Notes:** Shortcut configuration should not clutter the Chat surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Settings hotkey area | Chat gets the mic button; Settings owns the keyboard binding. | yes |
| Inline in Chat | Put a small shortcut picker near the mic button. | |
| Fixed default only | Ship a default shortcut and defer customization. | |

**User's choice:** Reuse Settings hotkey area.
**Notes:** This aligns with future global hotkeys.

| Option | Description | Selected |
|--------|-------------|----------|
| Visible disabled state with setup link | Mic button is present but disabled until STT readiness passes; missing permission prompts request and clear error state. | yes |
| Hide voice controls until ready | Keeps Chat clean, but hides discoverability. | |
| Always clickable with guided errors | Clicking explains what is missing, but can feel broken. | |

**User's choice:** Visible disabled state with setup link.
**Notes:** Missing mic permission should request permission and surface a clear state.

---

## Roadmap-Locked Voice Flow

The user corrected the discussion flow: preview/final submission, queueing, and conservative VAD/no-headphones behavior were already covered by roadmap/context and should not be re-asked as duplicate questions.

Captured as locked context:
- Preview text is transient and must not enter conversation history.
- Only final STT text enters the existing chat pipeline unchanged.
- Speech captured while a turn is in progress queues safely instead of corrupting active TTS/playback state.
- VAD remains conservative until Phase 22 AEC/no-headphones evidence.

## the agent's Discretion

Exact implementation names, thresholds, keyboard default, component structure, and route/API naming remain planner discretion within CONTEXT.md decisions.

## Deferred Ideas

None.
