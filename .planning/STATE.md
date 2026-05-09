---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Plugin + Animation Control
status: executing
stopped_at: Completed 07-06-PLAN.md
last_updated: "2026-05-09T00:40:40.156Z"
last_activity: 2026-05-09
progress:
  total_phases: 10
  completed_phases: 7
  total_plans: 37
  completed_plans: 36
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-08)

**Core value:** Multi-avatar identity persistence (v1 horizon — v2.0 is infrastructure prep on the way there)
**Current focus:** Phase 07 — three-category-code-parsing-dispatch

## Current Position

Phase: 07 (three-category-code-parsing-dispatch) — EXECUTING
Plan: 7 of 7
Status: Ready to execute

  - re_verification_3 passed 2026-05-08T18:35 (06-VERIFICATION.md status: passed)
  - F-1 closed by 06-07 (split VTS writer deleted; MouthOpen flows compositor SpeechDriver → single PyvtsSafeWriter)
  - F-2 closed by `tests/test_arch06_single_writer.py` (asserts requestSetParameterValue / requestInjectParameterData / plugin_name ownership single-file)
  - F-3 closed by follow-on commits: 946abd7 (head_only lateral sway) + 4e2ff12 (preserve VTS tracking input ranges)
  - F-4/joy-vocabulary gap closed by 06-08: active Teto catalog is strict, `joy` is absent/invalid, forced `[joy]` is ignored safely, and `heart-eye` variant dispatch remains Phase 7 work
  - Phase validation gate: 119 passed (pytest tests/plugins tests/compositor tests/architecture/... etc.)
  - boot_smoke remains formally human_needed in 06-VERIFICATION but operator UAT confirmed lipsync + body sway live (re_verification_3)

Last activity: 2026-05-09

**Phase 8 status:** Complete 2026-05-08 — VERIFICATION passed 5/5 must-haves (re-verified after gap closure 08-05). RigCapabilities + AvatarOverrides contracts available for Phase 6/7/9 consumers. Dogfooded `_avatar_overrides.yaml` produced for Teto rig.

**Anti-pattern flag (recorded 2026-05-08 PM, RESOLVED):** External agent analyzing F-1 proposed pivoting away from VTS+pyvts to live2d-py and creating "Phase 6.5 mocap pipeline" with new MotionCaptureFrame contract. This proposal was rejected — it conflated "implementation violates documented architecture" with "documented architecture is wrong." ARCH-05/06 are correct as written; the fix is consolidate-to-match-spec, not pivot. PROJECT.md / REQUIREMENTS.md / ROADMAP architectural intent remained unchanged. 06-07 took the narrow path: delete split writer, harden CI assertion. Outcome confirms the diagnosis was correct — implementation alignment was the right fix. Keep this flag here as a reference for future agents who hit similar "should we re-architect?" temptations.

**Note on v1.0:** Phase 4 body-sway investigation and Phase 5 codegen are complete. 05-02 (§14 verification ceremony) was deferred 2026-05-08 — SC-01 migrates to v2.0 Phase 10's exit criterion.

**Milestone archive:** v1.0 Walking Skeleton archived on 2026-05-08. See `.planning/MILESTONES.md`, `.planning/v1.0-MILESTONE-AUDIT.md`, and `.planning/milestones/v1.0-ROADMAP.md`.

**Note on v2.0 order (REVISED 2026-05-08):** v2.0 execution order changed from 6→8→7→9→10 to **8→6→7→9→10**. Phase 8 now runs first because it produces the data + defines the `RigCapabilities` and `AvatarOverrides` Pydantic contracts that Phase 6 plugin runtime consumes. ARCH-02 requirement moved from Phase 6 → Phase 8. Decision recorded in ROADMAP.md "Overview (v2.0)" + REQUIREMENTS.md v2.0 header. Discovered during /gsd:discuss-phase 6 — the discussion was paused; user runs /gsd:discuss-phase 8 next.

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
| Phase 05-polish-contracts-codegen-14-verification P01 | 9min | 2 tasks | 21 files |
| Phase 08-avatar-import-catalogs P01 | 13min | 4 tasks | 31 files |
| Phase 08-avatar-import-catalogs P02 | 55min | 5 tasks | 25 files |
| Phase 08-avatar-import-catalogs P03 | 7min | 3 tasks | 11 files |
| Phase 08-avatar-import-catalogs P04 | 6min | 2 tasks | 17 files |
| Phase 06-plugin-runtime-default-plugin P01 | 7min | 3 tasks | 11 files |
| Phase 06-plugin-runtime-default-plugin P02 | 12min | 4 tasks | 35 files |
| Phase 06-plugin-runtime-default-plugin P03 | 7min | 4 tasks | 6 files |
| Phase 06-plugin-runtime-default-plugin P05 | 9min | 2 tasks | 5 files |
| Phase 06-plugin-runtime-default-plugin P04 | 5min | 2 tasks | 8 files |
| Phase 06-plugin-runtime-default-plugin P06 | 3min | 2 tasks | 3 files |
| Phase 06-plugin-runtime-default-plugin P08 | 5 min | 3 tasks | 11 files |
| Phase 07-three-category-code-parsing-dispatch P01 | 5min | 1 tasks | 10 files |
| Phase 07-three-category-code-parsing-dispatch P04 | 3min | 1 tasks | 4 files |
| Phase 07-three-category-code-parsing-dispatch P03 | 7min | 1 tasks | 7 files |
| Phase 07-three-category-code-parsing-dispatch P05 | 6min | 1 tasks | 5 files |
| Phase 07-three-category-code-parsing-dispatch P02 | 8min | 1 tasks | 14 files |
| Phase 07-three-category-code-parsing-dispatch P06 | 250min | 2 tasks | 11 files |

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
- [Phase 05-polish-contracts-codegen-14-verification]: force_required marks const, anyOf-null, and defaulted Pydantic fields required before TypeScript generation.
- [Phase 05-polish-contracts-codegen-14-verification]: Cross-file duplicate declarations are removed by OWNER_FILE mapping and replaced with import type statements.
- [Phase 05-polish-contracts-codegen-14-verification]: Generated contract drift is guarded by npm run check:contracts.
- [Phase 08-avatar-import-catalogs]: Plan 08-01 kept capabilities.py as a temporary empty compatibility shim until Phase 6 rewrites legacy AvatarCapabilities callers.
- [Phase 08-avatar-import-catalogs]: Plan 08-01 forces jsonschema==4.26.0 through uv override-dependencies because litellm==1.83.14 pins jsonschema==4.23.0.
- [Phase 08-avatar-import-catalogs]: Plan 08-01 includes cdi3 parameter IDs in RigCapabilities.writable_param_ids so HUD/plugin consumers see the full Teto rig surface.
- [Phase 08-avatar-import-catalogs]: Phase 5 codegen is active, so Phase 8 TS mirrors are generated from Pydantic instead of hand-written.
- [Phase 08-avatar-import-catalogs]: Structured commit endpoint errors are normalized before rendering so jsonschema failures appear inline.
- [Phase 08-avatar-import-catalogs]: AvatarImport tests live under apps/renderer/tests because the current Vitest include pattern does not discover src/**/__tests__.
- [Phase 08-avatar-import-catalogs]: Settings uses the existing useStore().setView path instead of adding a second route-store dependency.
- [Phase 08-avatar-import-catalogs]: Plan 08-04 preserves OLVT emotionMap entries through DefaultPluginActionBinding rather than generic emotion_bindings.
- [Phase 08-avatar-import-catalogs]: Plan 08-04 applies the existing reserved-name rejection policy to default plugin action_code validation in persisted avatar overrides.
- [Phase 06-plugin-runtime-default-plugin]: Plugin manifests reject incompatible API major versions while accepting the v1.x contract line.
- [Phase 06-plugin-runtime-default-plugin]: userData plugin manifests override repo plugin manifests with the same name; duplicate userData names fail loudly.
- [Phase 06-plugin-runtime-default-plugin]: MouthOpen is the only system primitive override because lipsync owns the VTS mouth input.
- [Phase 06-plugin-runtime-default-plugin]: The orchestrator does not emit plugin action codes as ActionIntent values; plugins receive raw sentence text separately.
- [Phase 06-plugin-runtime-default-plugin]: The default plugin keeps OLVT emotion names but renders them as ParamFrame head/eye/face compositions instead of VTS expression activations.
- [Phase 06-plugin-runtime-default-plugin]: Default plugin parsing is stateful across sentence chunks so split bracket tokens can still activate plugin actions.
- [Phase 06-plugin-runtime-default-plugin]: body_sway_strategy values other than head_only warn at plugin load and fall back to head_only; proxy_param and exp3_modulation remain source artifacts only.
- [Phase 06-plugin-runtime-default-plugin]: Manifest changes are warning-only: plugin.yaml is reparsed for comparison, but active manifest, prompt section, and plugin runtime remain boot-time values until restart.
- [Phase 06-plugin-runtime-default-plugin]: Manifest watcher tests exercise event callbacks directly instead of relying on filesystem timing.
- [Phase 06-plugin-runtime-default-plugin]: Plugin action codes are preserved on SentenceOutput.plugin_text while display_text and tts_text remain bracket-stripped.
- [Phase 06-plugin-runtime-default-plugin]: DefaultPlugin action parsing remains plugin-owned; PluginAdapter.tick() is the authoritative runtime ramp renderer.
- [Phase 06-plugin-runtime-default-plugin]: Timed default-plugin frames remain ParamFrame-only with no pyvts, exp3, or requestExpressionActivation path.
- [Phase 06-plugin-runtime-default-plugin]: PluginSupervisor is the production render-capable surface: it proxies render_frame(now) to the active wrapped plugin when available.
- [Phase 06-plugin-runtime-default-plugin]: Supervisor render failures fail closed to ParamFrame() and count toward the existing circuit breaker only when an event loop is available.
- [Phase 06-plugin-runtime-default-plugin]: For active Teto, joy is obsolete/invalid production vocabulary because it is absent from avatars/重音テト/_avatar_overrides.yaml.
- [Phase 06-plugin-runtime-default-plugin]: Phase 6 keeps default plugin action dispatch only; model-owned variant/event dispatch such as heart-eye remains Phase 7 work.
- [Phase 07-three-category-code-parsing-dispatch]: ActionIntent was deleted from the Python contracts package rather than aliased; Dispatch is the sole Phase 7 contract surface.
- [Phase 07-three-category-code-parsing-dispatch]: TriggerAnimation entries use real motion3 Meta.Duration only when finite and within 0 < duration <= 10.0; fallback entries carry duration_is_fallback=True.
- [Phase 07-three-category-code-parsing-dispatch]: Reserved-name enforcement is exposed as a boot-time validation primitive; parser/runtime hot paths do not consult the reserved list.
- [Phase 07-three-category-code-parsing-dispatch]: The reserved LLM protocol list is a fixed system invariant covering the PLG-06 floor plus the 28-entry Phase 7 research sweep.
- [Phase 07-three-category-code-parsing-dispatch]: code_extractor leaves sentence.text unchanged so plugin-visible text keeps bracketed context.
- [Phase 07-three-category-code-parsing-dispatch]: Leaked <think> is not stripped at parse time; it is treated as an unknown event and emits no dispatch.
- [Phase 07-three-category-code-parsing-dispatch]: EventFire.duration_ms is computed from EventEntry at parse time, using 10s exactly for fallback entries and duration_seconds*1000+1000 otherwise.
- [Phase 07-three-category-code-parsing-dispatch]: Variant state is session-local shadow state; idempotent re-emits no-op.
- [Phase 07-three-category-code-parsing-dispatch]: EventCompletionTracker treats positive EventFire.duration_ms as the final completion delay with no blend pad or upper clamp.
- [Phase 07-three-category-code-parsing-dispatch]: Generated TS mirrors expose a named Dispatch union rather than repeating ActionCode | VariantToggle | EventFire inline.
- [Phase 07-three-category-code-parsing-dispatch]: Nested generated schemas for avatar import/overrides were committed because the global contract drift guard covers all packages/contracts/generated output.
- [Phase 07-three-category-code-parsing-dispatch]: Plan 07-06 kept valid_expression_names as a backward-compatible constructor alias for plugin action code parsing while routing through Dispatch records.
- [Phase 07-three-category-code-parsing-dispatch]: Plan 07-06 logs DISPATCH-DROP for missing plugin adapters, full action queues, and missing event hotkey IDs instead of raising from the orchestrator hot path.
- [Phase 07-three-category-code-parsing-dispatch]: Plan 07-06 audio payload emission uses dispatches only; stale actions assertions were updated in directly affected orchestrator-turn tests.

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

Last session: 2026-05-09T00:40:40.148Z
Stopped at: Completed 07-06-PLAN.md
Resume file: None
