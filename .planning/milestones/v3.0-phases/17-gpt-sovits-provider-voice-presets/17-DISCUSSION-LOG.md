# Phase 17: GPT-SoVITS Provider + Voice Presets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09T18:19:52-04:00
**Phase:** 17-GPT-SoVITS Provider + Voice Presets
**Areas discussed:** Connection modes, Preset model, Failure UX, Reference audio

---

## Connection Modes

| Question | Selected | Options considered |
|----------|----------|--------------------|
| For GPT-SoVITS external-server mode, what should the user enter as the primary connection target? | Base URL | Base URL; Full endpoint URLs; Preset server profiles |
| How should app-managed GPT-SoVITS launch behave? | User command only | User command only; Command templates; External only |
| What should count as ready before GPT-SoVITS can be selected for chat output? | Health plus test | Health plus test; Health only; Allow untested |
| If the app launched GPT-SoVITS, how aggressive should stop/restart controls be? | Only app-owned process | Only app-owned process; Ask before killing; Never stop |

**Notes:** External servers are user-owned. Stop/restart only applies to the process launched by this app.

---

## Preset Model

| Question | Selected | Options considered |
|----------|----------|--------------------|
| Where should voice presets live conceptually? | Global library | Global library; Per-avatar only; Per-session only |
| How should Phase 17 associate a preset with the current avatar/session without editing avatar import catalogs? | App setting override | App setting override; Session default only; Avatar note reference |
| When a preset is selected, how much can it override provider settings? | Preset owns voice knobs | Preset owns voice knobs; Preset owns everything; Preset only names voice |
| What should happen if the active preset is deleted? | Require reassignment | Require reassignment; Fall back to Piper; Leave missing state |

**Notes:** Presets are reusable assets. Active association belongs in app audio settings, not avatar import catalogs.

---

## Failure UX

| Question | Selected | Options considered |
|----------|----------|--------------------|
| If GPT-SoVITS fails during a chat turn, what should happen to that sentence? | Show failed sentence | Show failed sentence; Retry then fail; Use Piper for sentence |
| After a GPT-SoVITS turn failure, when can Piper be used as fallback? | Next turn after notice | Next turn after notice; Automatically next turn; Never automatically |
| What error detail should users see for GPT-SoVITS failures? | Reuse existing log panel | Plain summary plus details; Plain summary only; Raw provider error |
| How should test synthesis failures affect the active preset/provider? | Do not activate | Do not activate; Activate with warning; Save but inactive |

**Notes:** User specifically called out that the app already has a log panel and should reuse it.

---

## Reference Audio

| Question | Selected | Options considered |
|----------|----------|--------------------|
| When importing GPT-SoVITS reference audio, should the app copy the file or reference it in place? | Copy into app storage | Copy into app storage; Reference original path; Ask each import |
| How strict should reference-audio validation be in Phase 17? | Basic usable checks | Basic usable checks; Strict quality gate; Provider accepts it |
| What reference-audio metadata should the preset require from the user? | Text and language | Text and language; Text only; Optional metadata |
| How should delete behave for reference audio used by one or more presets? | Block while in use | Block while in use; Cascade delete presets; Leave broken refs |

**Notes:** Reference audio should be stable and sanitized in app-managed storage.

---

## the agent's Discretion

No explicit “you decide” areas were delegated.

## Deferred Ideas

None.
