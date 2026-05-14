# Roadmap: AgenticLLMVTuber

## Milestones

- ✅ **v1.0 Walking Skeleton** — Phases 1-5 shipped 2026-05-08. Archive: `.planning/milestones/v1.0-ROADMAP.md`
- ✅ **v2.0 Plugin + Animation Control** — Phases 8, 6, 7, 9, 10 shipped 2026-05-09. Archive: `.planning/milestones/v2.0-ROADMAP.md`
- ✅ **v2.1 Mock/Reality Cleanup** — Phases 11-15 shipped 2026-05-09. Archive: `.planning/milestones/v2.1-ROADMAP.md`
- ✅ **v3.0 Rich Voice Configuration + Voice Input** — Phases 16-22 plus inserted Phases 20.1 and 20.2 shipped 2026-05-14. Archive: `.planning/milestones/v3.0-ROADMAP.md`

## Current Status

No active milestone is planned in this roadmap file. v3.0 is complete and archived; run the next milestone planning flow before adding new active phases.

**Next milestone intent:** v4.0 Agentic System + Memory.

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

<details>
<summary>✅ v3.0 Rich Voice Configuration + Voice Input (Phases 16-22, 20.1, 20.2) — SHIPPED 2026-05-14</summary>

- [x] Phase 16: Audio Contracts + TTS Provider Shell — 4/4 plans complete
- [x] Phase 17: GPT-SoVITS Provider + Voice Presets — 12/12 plans complete
- [x] Phase 18: Rich Voice Settings + Persistence — 3/3 plans complete
- [x] Phase 19: STT Provider Abstraction + Local/Cloud Providers — 6/6 plans complete
- [x] Phase 20: Renderer Voice Capture + PTT/VAD Preview UX — 10/10 plans complete
- [x] Phase 20.1: Settings UX Refactor + Enablement Simplification — 7/7 plans complete
- [x] Phase 20.2: CPU Local STT Enhancement — 5/5 plans complete
- [x] Phase 21: Code-Switch Evaluation + Hardening — 5/5 plans complete
- [x] Phase 22: AEC Spike + No-Headphones Decision — 5/5 plans complete

Full details: `.planning/milestones/v3.0-ROADMAP.md`
Requirements archive: `.planning/milestones/v3.0-REQUIREMENTS.md`
Phase execution archive: `.planning/milestones/v3.0-phases/`
Audit: `.planning/milestones/v3.0-MILESTONE-AUDIT.md`

</details>

## v3.0 Closure Summary

v3.0 turned the app from text-first chat with Piper output into a configurable voice companion. It preserves ordered sentence playback, renderer audio payloads, RMS/lipsync, VTube Studio compositor behavior, and conversation-history semantics while adding rich TTS configuration and final-only speech input.

Delivered capabilities:

- TTS provider abstraction with Piper baseline safety and explicit provider health/failure states.
- GPT-SoVITS output with external-server/app-managed modes, activation, named presets, reference audio, test synthesis, and visible failure handling.
- Whole-screen Settings refactor with clearer information architecture and optional standalone tests instead of mandatory test-before-enable gates.
- STT provider layer with FunASR local default, faster-whisper local fallback, OpenAI/Groq cloud providers behind explicit consent, local model cache controls, and redacted diagnostics.
- Final-only push-to-talk and VAD voice input with visible readiness/listening state, active-turn queueing, stop-current-turn, and edit/regenerate typo recovery.
- Locked bilingual/code-switch corpus, provider scorecard, no-translation checks, and Settings copy reflecting FunASR as the current local-first recommendation while faster-whisper remains limited for code-switch quality.
- AEC/no-headphones empirical decision: current support is Limited for the tested setup, Unsafe remains the default for unverified hardware, and VAD is paused/guarded during active TTS.

Accepted limitations:

- GPT-SoVITS installer, training, and voice-cloning UI remain out of scope; users supply their own model/server.
- faster-whisper CUDA depends on NVIDIA CUDA 12 runtime libraries; CPU and FunASR paths remain available.
- Cloud STT stays explicit opt-in and credential-gated.
- No-headphones support is hardware-dependent and not claimed as universally safe.
- Wake word, barge-in, translation, and agentic memory remain deferred.

## Next Milestone Seed

v4.0 is expected to carry the agentic system plus memory work:

- agent mode and goal loop
- saved goals and scheduler
- screen-control skills and CLI sub-agent routing
- per-avatar episodic memory and shared user facts
- memory-backed avatar identity and multi-avatar switching

Concrete v4.0 phases should be generated from fresh requirements rather than appended to the closed v3.0 roadmap.
