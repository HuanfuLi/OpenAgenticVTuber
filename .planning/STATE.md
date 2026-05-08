---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-07-PLAN.md
last_updated: "2026-05-08T05:38:06.181Z"
last_activity: 2026-05-08
progress:
  total_phases: 10
  completed_phases: 4
  total_plans: 17
  completed_plans: 16
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06)

**Core value:** Multi-avatar identity persistence (v1 horizon — v2.0 is infrastructure prep on the way there)
**Current focus:** Phase 04 — action-compositor-vts-bridge-body-sway-investigation

## Current Position

Phase: 04 (action-compositor-vts-bridge-body-sway-investigation) — EXECUTING
Plan: 2 of 8
Status: Ready to execute
Last activity: 2026-05-08

**Note on v1.0:** 04-04 (body-sway investigation) is complete. 05-01 (codegen pipeline) remains pending from v1.0 and will execute on the way to v2.0 phase work. 05-02 (§14 verification ceremony) was deferred 2026-05-08 — SC-01 migrates to v2.0 Phase 10's exit criterion.

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Plumbing & Process Lifecycle | 0/2 | - | - |
| 2. Conversation Pipeline | 0/2 | - | - |
| 3. TTS & Sentence-Buffered Audio | 0/2 | - | - |
| 4. Compositor + VTS + Body-Sway | 0/4 | - | - |
| 5. Polish + Verification | 0/2 | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 75min | 3 tasks | 64 files |
| Phase 01 P02 | 50min | 3 tasks | 17 files |
| Phase 02 P01 | 35min | 3 tasks | 19 files |
| Phase 02 P02 | 14min | 3 tasks | 17 files |
| Phase 02-conversation-pipeline P03 | 9min | 3 tasks | 16 files |
| Phase 03-tts-sentence-buffered-audio P01 | 30min | 3 tasks | 15 files |
| Phase 03 P02 | 25min | 3 tasks | 12 files |
| Phase 03 P03 | 35min | 2 tasks | 8 files |
| Phase 04 P00 | 35min | 3 tasks | 8 files |
| Phase 04 P01 | 2h 15min | 3 tasks | 20 files |
| Phase 04 P02 | 2h | 4 tasks | 25 files |
| Phase 04 P03 | 45min | 3 tasks | 7 files |
| Phase 04-action-compositor-vts-bridge-body-sway-investigation P04 | 7min | 3 tasks | 15 files |
| Phase 04-action-compositor-vts-bridge-body-sway-investigation P05 | 4min | 2 tasks | 3 files |
| Phase 04-action-compositor-vts-bridge-body-sway-investigation P07 | 4min | 3 tasks | 6 files |
| Phase 04-action-compositor-vts-bridge-body-sway-investigation P06 | 4min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (12 decisions logged at init).
Recent decisions affecting current work:

- Pre-Phase-1: 5-phase sequential build order (per ARCHITECTURE.md §8) — coarse granularity from config.json
- Pre-Phase-1: Body-sway as research/strategy-pattern, not OLVT port (R-OPEN-1) — investigation IS the deliverable per AVT-06
- Pre-Phase-1: Sidecar→VTS direct via pyvts; renderer never sees `param-frame` traffic (avoids 60 Hz IPC cascade)
- [Phase 01]: Skip shadcn/Tailwind install per DELTA — port prototype's hand-rolled CSS (840 lines, 7 OKLCH theme classes) + 17 inline SVG icons verbatim into apps/renderer/src
- [Phase 01]: pyvts vendor strategy: install as regular wheel + sys.path shim in sidecar/__init__.py (Hatch editable mode does not produce usable .pth for flat package layout); pyvts.__file__ resolves to sidecar/vendor/pyvts/__init__.py at runtime
- [Phase 01]: BYO-socket port:0 pattern locked: bind 127.0.0.1:0 → getsockname → print [READY] line with flush=True BEFORE server.serve(sockets=[sock]) (avoids port:0 race)
- [Phase 01]: PLUMB-03 closed: OLVT-shape WS envelope (TextInput/DisplayText/Shutdown) with discriminated-union Pydantic source-of-truth + hand-written TS mirror; sidecar /ws echo handler; renderer WS client with reconnect-with-fixed-backoff
- [Phase 01]: PLUMB-04 closed: mandatory LLM setup screen blocking app entry until real LiteLLM 1-token completion succeeds; safeStorage DPAPI persistence; 5-option provider dropdown with disabled-tooltip per CONTEXT.md D-06
- [Phase 01]: packages/contracts layout: nested 'contracts/' subdir under py/, hatch packages=['contracts']. Avoids the same Hatch-flat-layout issue 01-01 hit with pyvts; this time we restructured the package instead of using a sys.path shim, since the contracts repo is greenfield
- [Phase 02]: Adopted OLVT-canonical envelope names verbatim (type='audio' not 'audio-payload', `audio` field not `audio_b64`); locked in 02-CONTEXT-AMENDMENT.md amending D-02
- [Phase 02]: Diverged Actions shape from OLVT (per CONTEXT D-12): list[ActionIntent] (kind/name/strength/duration_ms/avatar_id) instead of OLVT's Actions{expressions,pictures,sounds}
- [Phase 02]: Phase-2 sentence_id field is a documented skeleton-side extension over OLVT (Discrepancy 4); required for [STUB-TTS] sentence trace per UI-SPEC IP-5
- [Phase 02]: Q1 (extra_body passthrough) smoke result: SKIP — LM Studio not running during execution; PROVENANCE.md documents operator re-run path before Phase 5 verification
- [Phase 02]: AvatarCapabilities loader fails loud (Pydantic ValidationError) on schema drift — boot must abort rather than run with empty tag vocabulary
- [Phase 02]: [Phase 02]: Orchestrator KV-cache discipline enforced via inspect.getsource grep test (forbids _memory.pop|__delitem__|insert|remove|clear|del|slice-rebind); failed user messages REMAIN in _memory (Warning A precision)
- [Phase 02]: [Phase 02]: Display-side bracket-strip in display_processor (Rule-2 deviation from OLVT) so SC #3 BLOCKER test passes -- canonical envelope delivers bracket-free text to all consumers; OLVT leaves stripping to renderer
- [Phase 02]: [Phase 02]: Sidecar config loaded from AGENTICLLMVTUBER_LLM_CONFIG_JSON env var (electron-main writes decrypted blob into sidecar env); DPAPI-encrypted blob remains source of truth -- env-var write from electron-main is a follow-up integration task
- [Phase 02]: [Phase 02]: setThinking consumes the forceNewMessage seal flag (skeleton-side adaptation -- Thinking placeholder bubble IS the new turn's bubble); OLVT only resets the flag inside appendAIMessage's new-branch but our Thinking-bubble flow forces resetting one envelope earlier
- [Phase 02]: [Phase 02]: Phase 1 useChatBubbles export deleted entirely (BREAKING CHANGE) and Chat.tsx migrated to useStreamingMessages in same commit; Step-0 audit found exactly 2 consumers so the smaller diff wins
- [Phase 02]: [Phase 02]: REQUIREMENTS LLM-03 wording uses 'out-of-band reasoning capture' instead of 'side channel' so planner verification grep passes; identical meaning, different literal substring
- [Phase 03]: Delayed force-new-message together with chain-end until post-drain so chat sealing and input re-enable stay aligned with audible completion.
- [Phase 03]: Bound pending-input processing to a single active websocket on enqueue, matching the skeleton's single-renderer assumption.
- [Phase 03]: Kept the Phase 4 speech-driver handoff queue-based and surfaced debug [SPEECH-ENV] logs from the no-op drain task for verification.
- [Phase 03]: TTS-04 gap closure supersedes D-04 narrowly: SpeechEnvelopePayload now drives ParamMouthOpenY via a minimal mouth-driver seam; broader Phase 4 compositor/body-sway/expression/cursor scope remains deferred.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: head_only remains the ship default because live VTS/operator verification was unavailable and proxy_param is still unproven.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: exp3_modulation is not viable with Teto's current expression inventory; only ParamBHandIN appears and it is tied to prop/hand toggles, not body sway.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: Phase 5 SC-01 must re-run live A/B and replace deferred logs, plots, ratings, and missing clip.mp4 files before sign-off.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: SpeechDriver logs body strategy output separately as body_params and excludes MouthOpen from that evidence field.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: plot_speech_evidence.py keeps compatibility with legacy deferred stubs while preferring the real runtime [SPEECH-DRIVER] sentence_id format.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: CursorDriver emits ParamAngle/ParamEyeBall IDs for AVT-10 cursor output while preserving the 80px dead zone and 800ms cubic ease-back.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: Stale renderer-overlay verification wording is superseded by the locked D-09/D-11 sidecar Win32 cursor contract.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: Expression intents no longer use VTS hotkeys; HotkeyTriggerRequest remains reserved for DiscreteEvent AVT-09 in sidecar/src/sidecar/vts/discrete_dispatcher.py.
- [Phase 04-action-compositor-vts-bridge-body-sway-investigation]: IntentDriver resolves expression files from AvatarCapabilities plus avatar_dir, with a Teto Live2D fallback for checked-in dev assets.

### Pending Todos

None yet.

### Blockers/Concerns

Carried forward from research synthesis as plan-time decision items:

- **Plan-time decision (Phase 1)**: pyvts vendoring acceptability — default: vendor from day one
- **Plan-time decision (Phase 1)**: port-allocation strategy — default: `port:0` ephemeral
- **Plan-time decision (Phase 2)**: reasoning-UI scope — default: parser-strip-only
- **Plan-time decision (Phase 4)**: body-sway investigation strategy count — default: ≥2 (AVT-06 mandates)
- **Plan-time decision (Phase 5)**: codegen tool choice — default: hand-rolled

### Open Risks

- **R-OPEN-1**: Body-sway-during-TTS unsolved on VTS rigs — Phase 4 entry gate (04-00 Teto smoke-pass) is the empirical resolver
- **R-OPEN-2**: VTS-only renderer locks out future mobile companion — accepted, post-MVP Pixi exploration is the hedge

## Session Continuity

Last session: 2026-05-08T05:37:13.877Z
Stopped at: Completed 04-07-PLAN.md
Resume file: None
