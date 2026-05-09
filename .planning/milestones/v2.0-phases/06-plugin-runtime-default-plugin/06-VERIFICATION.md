---
phase: 06-plugin-runtime-default-plugin
verified: 2026-05-08T11:57:55Z
status: passed
score: 8/8 automated must-haves verified; F-1/F-2 closed by 06-07; F-3 closed by runtime UAT and tracking-range fix
re_verification_4:
  verified: 2026-05-08T23:50:00Z
  status: passed
  gaps_closed:
    - "`[joy]` UAT criterion corrected: `[joy]` is obsolete/invalid for the active imported Teto avatar catalog because it is absent from `avatars/重音テト/_avatar_overrides.yaml`."
    - "Default plugin prompt/manifest/runtime no longer advertise or accept `joy`; forced direct or split-token `[joy]` input is ignored safely with no active action and no nonzero ParamFrame."
    - "Model-owned production variant success for active Teto codes such as `heart-eye` is deferred to Phase 7 `{variant}` dispatch."
  gaps_remaining: []
  regressions: []
  evidence:
    - "cd sidecar && uv run pytest tests/plugins/test_teto_catalog_strict_variants.py tests/plugins/test_default_plugin.py tests/plugins/test_default_plugin_parser.py tests/plugins/test_default_plugin_integration.py tests/plugins/test_prompt_section.py tests/compositor/test_plugin_adapter.py -x --no-header"
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "Superseded by 06-08: production-style PluginAdapter(PluginSupervisor(DefaultPlugin)) uses declared default-plugin actions such as [smirk] for timed ParamFrame ramp coverage; [joy] is invalid/obsolete and absent from the active imported Teto avatar catalog."
    - "PluginSupervisor.render_frame(now) safely proxies render-capable wrapped plugins and returns empty ParamFrame for missing hook/circuit-open/failure cases."
  gaps_remaining: []
  regressions: []
re_verification_2:
  verified: 2026-05-08T18:09:47-04:00
  status: human_needed
  gaps_closed:
    - "F-1 closed: MouthOpen now emits from SpeechDriver into the compositor path; ws/server.py no longer constructs SpeechMouthDriver, mouth_speech_queue, mouth_task, _build_mouth_writer, or PyVTSParameterWriter."
    - "F-1 closed: split VTS writer modules were deleted: sidecar/src/sidecar/vts/speech_mouth_driver.py and sidecar/src/sidecar/vts/parameter_writer.py."
    - "F-2 closed: sidecar/tests/test_arch06_single_writer.py asserts VTS parameter write requests and VTS plugin identity ownership stay isolated to sidecar/src/sidecar/vts/pyvts_writer.py."
  gaps_remaining:
    - "F-3 remains human/runtime observation only: after writer consolidation, confirm live VTS lipsync and whether head_only multi-axis sway is visible."
  evidence:
    - "Targeted gate passed: cd sidecar; uv run pytest tests/test_arch06_single_writer.py tests/avatar/test_extract_olvt.py tests/test_orchestrator_turn.py -q -> 29 passed."
    - "Targeted writer/compositor gate passed: cd sidecar; uv run pytest tests/vts/test_pyvts_writer.py tests/test_orchestrator_turn.py tests/compositor/test_speech_driver.py -q -> 41 passed."
    - "Targeted post-harness gate passed: cd sidecar; uv run pytest tests/scripts/test_plumbing_harness.py tests/test_arch06_single_writer.py tests/vts/test_pyvts_writer.py tests/test_orchestrator_turn.py tests/compositor/test_speech_driver.py -q -> 47 passed."
    - "Full sidecar suite after 06-07: 235 passed, 2 skipped, 3 failed; all remaining failures are pre-existing avatar override file failures caused by missing avatars/teto/teto_overrides.yaml."
    - "Static grep: requestSetParameterValue/requestInjectParameterData under sidecar/src/*.py appears only in sidecar/src/sidecar/vts/pyvts_writer.py."
    - "Static grep: plugin_name under sidecar/src/*.py appears only in sidecar/src/sidecar/vts/pyvts_writer.py."
    - "Static grep: emit_mouth under sidecar/src/*.py appears zero times."
  boot_smoke:
    status: "human_needed"
    reason: "Requires live sidecar + VTube Studio session. Automated code path now constructs one PyvtsSafeWriter and one connect_and_authenticate(writer) task; live log confirmation remains UAT."
re_verification_3:
  verified: 2026-05-08T18:35:00-04:00
  status: passed
  gaps_closed:
    - "F-3 closed: operator UAT confirmed lipsync restored and body sway visible after preserving VTS tracking input ranges."
    - "Nyquist validation refreshed: 06-VALIDATION.md now maps Phase 6 plans 06-01 through 06-07 to automated tests and manual-only checks."
  gaps_remaining: []
  evidence:
    - "Commit 4e2ff12 fix(06): preserve VTS tracking input ranges."
    - "Phase validation gate passed: cd sidecar && uv run pytest tests/plugins tests/compositor tests/architecture/test_pyvts_writer_singleton.py tests/test_arch06_single_writer.py tests/scripts/test_plumbing_harness.py tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py tests/vts/test_pyvts_writer.py -q -> 119 passed."
    - "Contract gate passed: npm run check:contracts."
    - "Renderer typecheck passed: npm --workspace apps/renderer run typecheck."
post_verification_findings:
  discovered_at: 2026-05-08T13:30:00Z
  trigger: "Operator UAT — lipsync absent + body sway only along one axis"
  findings:
    - id: F-1
      severity: blocker
      kind: arch_violation
      reqs: [ARCH-05, ARCH-06]
      summary: "Lipsync (MouthOpen) flows through a SECOND VTS plugin identity + writer, not through the compositor's single PyvtsSafeWriter."
      evidence:
        - "sidecar/src/sidecar/vts/parameter_writer.py:12 — MOUTH_DRIVER_PLUGIN_NAME = 'AgenticLLMVTuber Phase3 Mouth Driver' — separate VTS plugin identity"
        - "sidecar/src/sidecar/vts/parameter_writer.py:27-66 — PyVTSParameterWriter wraps PyvtsSafeWriter independently, does its own connect_and_authenticate, calls requestSetParameterValue directly"
        - "sidecar/src/sidecar/vts/speech_mouth_driver.py:13-71 — independent driver class consuming a separate mouth_speech_queue"
        - "sidecar/src/sidecar/ws/server.py:268-275 — server lifespan instantiates SpeechMouthDriver alongside the compositor; mouth_task runs as a parallel coroutine"
        - "sidecar/src/sidecar/ws/server.py:288 — compositor's SpeechDriver instantiated with emit_mouth=False, so MouthOpen is intentionally suppressed in the compositor path"
      arch_quote: "ARCH-05: 'IdleDriver → SpeechDriver (lipsync only) → PluginAdapter → CursorDriver → ... → pyvts.inject_params'. ARCH-06: 'Every entry point flows through PyvtsSafeWriter.'"
      diagnosis: "The split mouth writer is an M1 Phase 3 (TTS-04) artifact that 06-02 plumbing surgery was meant to consolidate but didn't. Two separate VTS plugin identities, two WebSocket connections, two auth flows. The recent fix(06) commits ('authenticate mouth writer through safe handshake', 'restore VTS tracking params and token path') were patching the split path rather than removing it."
    - id: F-2
      severity: blocker
      kind: ci_test_gap
      reqs: [ARCH-06]
      summary: "ARCH-06 CI grep test ('import pyvts' count == 1) is too narrow — it catches direct imports but not second-class wrappers."
      evidence:
        - "sidecar/src/sidecar/vts/parameter_writer.py:10 — uses 'from sidecar.vts.pyvts_writer import PyvtsSafeWriter' (indirect), so does not contribute to the grep count"
        - "Actual count today: 1 (pyvts_writer.py only) → CI passes despite F-1 being live"
      diagnosis: "The grep guards module-level pyvts import, not 'how many writer classes own a VTS plugin identity / call requestSetParameterValue / requestInjectParameterData'. Need a stronger CI assertion."
    - id: F-3
      severity: investigate
      kind: runtime_quality
      reqs: [PLG-07]
      summary: "Operator reports body sway shows only forward-lean (FacePositionZ axis) — head_only is documented as 3-axis (FaceAngleZ + FaceAngleY + FacePositionZ)."
      evidence:
        - "plugins/default/body_sway/head_only.py:9-14 — strategy returns FaceAngleZ * 2.0, FaceAngleY * 1.0, FacePositionZ * -0.8"
      diagnosis: "Possible causes (not yet measured): (a) clamp drops FaceAngleZ/Y (look for [PLUGIN-FRAME-DROP] unknown logs); (b) Teto rig does not bind FaceAngleZ/Y to visible motion; (c) RMS amplitude too low so 2.0×/1.0× coefficients fall below perceptibility; (d) sign-inversion mismatch between rig probe and runtime. Defer root-cause to runtime-log inspection after F-1 is fixed (writer auth issues currently mask other failure modes)."
  proposed_closure: "06-07-PLAN.md — Writer consolidation gap closure"
  status_change_rationale: "Status drops from human_needed back to gaps_found. The 8/8 automated must-haves are still passing in their narrow scope, but F-1 violates ARCH-05/06 which were never automated to detect. Phase 6 cannot ship as 'code-complete' with split VTS plugin identities."
human_verification:
  - test: "Active plugin swap"
    expected: "Restarting the sidecar with a different active plugin changes body-motion behavior or falls back safely for an invalid plugin."
    why_human: "Requires live sidecar/VTube Studio observation and log review."
    blocked_by: "F-1 — until single-writer is restored, plugin swap masks the split-writer auth instability"
  - test: "[joy] invalid active Teto vocabulary"
    expected: "A forced [joy] reply is ignored safely because [joy] is obsolete/invalid for the active imported Teto avatar catalog and absent from avatars/重音テト/_avatar_overrides.yaml; no visual success criterion is expected."
    why_human: "Final visual quality is intentionally deferred to Phase 10/operator judgment."
  - test: "Speech motion"
    expected: "A 30s utterance keeps mouth movement synced and head/body motion non-flat."
    why_human: "Requires live audiovisual inspection."
    blocked_by: "F-1 — lipsync currently absent; F-3 — body sway visibility may need tuning"
---

# Phase 6: Plugin Runtime + Default Plugin Verification Report

**Phase Goal:** The animation layer becomes plug-and-play. A developer can swap the body-motion strategy by changing one config line, restarting the sidecar, and observing the avatar move differently without touching idle/lipsync/cursor/pyvts-writer code. The default plugin ships with the system and absorbs milestone-1 IntentDriver + body-sway logic; declared action codes such as `[smirk]` flow through the normal orchestrator path to the default plugin and produce timed ParamFrame ramp behavior through the production supervised adapter path. `[joy]` is obsolete/invalid for active Teto because it is absent from `_avatar_overrides.yaml`. Phase 10 operator visual quality judgment remains deferred.
**Verified:** 2026-05-08T11:57:55Z
**Status:** human_needed
**Re-verification:** Yes - after final gap-closure execution

## Goal Achievement

The previously remaining automated gap is closed. `PluginSupervisor.render_frame(now)` now proxies render-capable wrapped plugins, and the production-shaped `PluginAdapter(PluginSupervisor(DefaultPlugin))` path emits nonzero `[smirk]` params at +150ms and +300ms, then decays to zero by +950ms. The later 06-08 gap closure removes `[joy]` from the production prompt/manifest/runtime path and verifies forced `[joy]` is ignored safely.

Automated implementation is complete for Phase 6. Live VTS/operator checks remain human/UAT items, and Phase 10 still owns final visual quality judgment as the roadmap states.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Plugin API, manifest validation, discovery precedence, and deterministic prompt section exist | VERIFIED | `api.py`, `manifest.py`, and `loader.py` provide the planned contract, validation, discovery, entrypoint, prompt-section, and manifest watcher helpers. |
| 2 | Sidecar boots through loader/supervisor with NullPlugin fallback | VERIFIED | `ws/server.py` discovers manifests, loads the active plugin, calls `PluginSupervisor.load_or_null()`, then constructs `PluginAdapter(plugin_supervisor)`. |
| 3 | Compositor is decoupled from IntentDriver and merges idle -> speech -> plugin -> cursor -> clamp -> writer | VERIFIED | `intent_driver.py` is absent from production; `compositor.py` accepts `plugin_driver`, merges plugin frames, clamps, then writes. |
| 4 | Default plugin ships in-tree with current Phase 6 action codes and no pyvts/exp3 activation path | VERIFIED | `plugins/default/plugin.yaml` omits obsolete `joy`; `plugins/default/__init__.py` contains no `import pyvts`, `.exp3`, or `requestExpressionActivation`. |
| 5 | Default body_sway exposes only head_only while preserving source artifacts | VERIFIED | `plugins/default/body_sway/registry.py` returns only `("head_only",)` and rejects other names. |
| 6 | Normal `Orchestrator.turn()` sends plugin-visible declared action codes while display and TTS are stripped | VERIFIED | `transformers.py` sets `plugin_text=sentence.text`; `orchestrator.py` enqueues `sentence_output.plugin_text`. |
| 7 | Production supervised declared-action path emits timed nonzero ParamFrame ramps and decays | VERIFIED | `[smirk]` coverage exercises ramp/decay; `[joy]` is absent from active Teto and ignored safely when forced. |
| 8 | Manifest hot-reload warning path is production-wired and prompt remains frozen | VERIFIED | `ws/server.py` starts `start_manifest_change_watcher(...)`, builds the action-code section once before `Orchestrator(...)`, and stops the watcher on shutdown. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `sidecar/src/sidecar/plugins/api.py` | BodyMotionPlugin API contract | VERIFIED | ABC with `on_load`, `on_token_stream`, `on_unload`, and `ApiVersion.V1`. |
| `sidecar/src/sidecar/plugins/manifest.py` | PluginManifest and action-code validation | VERIFIED | Reserved/bracketed/duplicate/incompatible-major guards present. |
| `sidecar/src/sidecar/plugins/loader.py` | Discovery, prompt utilities, manifest watcher | VERIFIED | Discovery/prompt helpers and watchdog-backed manifest watcher are present. |
| `sidecar/src/sidecar/plugins/supervisor.py` | Supervisor, NullPlugin, render proxy | VERIFIED | Load timeout, fallback, circuit breaker, unload, and `render_frame(now)` fail-closed proxy are present. |
| `sidecar/src/sidecar/compositor/plugin_adapter.py` | TickDriver adapter | VERIFIED | Calls optional `render_frame(now)` on the wrapped supervised plugin and stamps `emitted_at_monotonic`. |
| `sidecar/src/sidecar/compositor/compositor.py` | Plugin merge slot and clamp boundary | VERIFIED | Plugin slot and clamp before writer are present. |
| `plugins/default/plugin.yaml` | Default plugin manifest | VERIFIED | Eight required OLVT action codes present. |
| `plugins/default/__init__.py` | DefaultPlugin behavior | VERIFIED | Parser, compositions, `render_frame(now)`, decay, and ParamFrame-only behavior present. |
| `plugins/default/body_sway/registry.py` | head_only-only strategy | VERIFIED | Only `head_only` selectable. |
| `sidecar/scripts/plumbing_harness.py` | Lipsync/idle harness | VERIFIED | Included in the 107-test Phase 6 gate. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ws/server.py` | plugin manifest discovery | `discover_manifests(_repo_root() / "plugins", _user_plugins_dir())` | WIRED | Repo and userData discovery are used at boot. |
| `ws/server.py` | plugin lifecycle | `_load_plugin_instance()` -> `PluginSupervisor.load_or_null()` | WIRED | Invalid load falls back to supervised NullPlugin. |
| `ws/server.py` | production adapter | `PluginAdapter(plugin_supervisor)` | WIRED | Production wraps the supervisor, matching the verified path. |
| `ws/server.py` | manifest watcher | `start_manifest_change_watcher(manifest_path, plugin_manifest)` | WIRED | Watcher starts after boot manifest load and stops during lifespan shutdown. |
| `ws/server.py` | orchestrator prompt | `build_action_codes_section(plugin_manifest)` -> `Orchestrator(...)` | WIRED | Prompt section is built once before orchestrator construction. |
| `Orchestrator` | `PluginAdapter` | `plugin_adapter.enqueue_sentence(sentence_output.plugin_text)` | WIRED | Bracketed plugin text reaches adapter while display/TTS are stripped. |
| `PluginAdapter` | `PluginSupervisor` | `getattr(self._plugin, "render_frame", None)` | WIRED | Adapter sees the supervisor render hook. |
| `PluginSupervisor` | `DefaultPlugin` | `getattr(self.plugin, "render_frame", None)` | WIRED | Supervisor delegates to wrapped plugin when available. |
| `Compositor` | VTS writer | `clamp_and_validate(...); writer.inject_params(frame)` | WIRED | Plugin output reaches writer through clamp. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `Orchestrator` -> `PluginAdapter` | `sentence` | `sentence_output.plugin_text` | Yes | FLOWING |
| `DefaultPlugin` | `action_codes` | `_extract_action_codes(sentence)` | Yes when a declared action such as `[smirk]` is present; no when obsolete `[joy]` is forced | FLOWING |
| `DefaultPlugin.render_frame(now)` | `ParamFrame.add_params` | active action + elapsed time | Yes | FLOWING |
| `DefaultPlugin` -> `PluginSupervisor` -> `PluginAdapter` | `ParamFrame.add_params` | supervised `render_frame(now)` proxy | Yes; +150ms/+300ms nonzero, +950ms decayed | FLOWING |
| Manifest watcher | `reloaded manifest` | `load_manifest(active plugin.yaml)` in watcher callback | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Supervised adapter regression and adapter/supervisor suite | `cd sidecar && uv run pytest tests/compositor/test_plugin_adapter.py tests/plugins/test_supervisor.py -q` | Adapter coverage passes with declared action codes such as `[smirk]` | PASS |
| Production-shaped declared-action data flow | `PluginAdapter(PluginSupervisor(DefaultPlugin))` ticks at 0.15/0.30/0.95 | `[smirk]` emits nonzero timed params and decays; forced `[joy]` emits no active action or nonzero ParamFrame | PASS |
| Supervisor render safety | Python one-shot for missing hook, circuit-open, and delegated render failure | All returned empty `ParamFrame`; render failure logged `[PLUGIN] render_frame failed` | PASS |
| Phase 6 regression gate | `cd sidecar && uv run pytest tests/plugins tests/compositor tests/test_orchestrator_turn.py tests/test_phase4_bootstrap.py tests/architecture/test_pyvts_writer_singleton.py tests/scripts/test_plumbing_harness.py -q` | 107 passed | PASS |
| Contract drift gate | User-provided recent final gate: `npm run check:contracts` | passed | PASS |
| Renderer typecheck | User-provided recent final gate: `npm --workspace apps/renderer run typecheck` | passed | PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| --- | --- | --- | --- |
| PLG-01 | Single-active plugin manifest at startup | SATISFIED | Boot selects active plugin name and loads manifest/entrypoint. |
| PLG-02 | Sorted action codes contribute to system prompt once | SATISFIED | `build_action_codes_section(plugin_manifest)` is called once before `Orchestrator(...)`. |
| PLG-03 | BodyMotionPlugin lifecycle hooks | SATISFIED | ABC and default implementation present. |
| PLG-04 | Supervisor timeout/circuit breaker/null fallback | SATISFIED | `PluginSupervisor` implements timeout, stream failure tracking, `render_frame` failure isolation, and NullPlugin fallback. |
| PLG-05 | Clamp plugin ParamFrames | SATISFIED | `clamp_and_validate()` is called in compositor before writer injection. |
| PLG-06 | Manifest validation and reserved-name guard | SATISFIED | `PluginManifest` validators present. |
| PLG-07 | Default plugin in-tree absorbs IntentDriver/body-sway logic | SATISFIED | Default plugin owns parser/compositions/body_sway, supervised declared-action timed ramp path is verified, and obsolete `[joy]` is ignored safely. |
| PLG-08 | Discover repo and userData plugins | SATISFIED | `discover_manifests()` handles repo/userData precedence. |
| PLG-09 | Startup-only plugin switching | SATISFIED | Active plugin is read at boot; watcher warns only and does not hot-swap. |
| PLG-10 | Manifest watcher reparse + WARN without reload | SATISFIED | Watchdog helper and lifespan wiring verified. |
| ARCH-01 | System owns LLM/VTS, plugin owns motion | SATISFIED | Plugin emits ParamFrames only; no default plugin pyvts/exp3 path. |
| ARCH-03 | Plugin input is post-sentence-divider/pre-code-filter sentence text | SATISFIED | `plugin_text=sentence.text` and enqueue of `sentence_output.plugin_text` verified. |
| ARCH-04 | Plugin output through adapter buffers/ticks ParamFrame | SATISFIED | Supervised adapter tick path emits timed frames and decays. |
| ARCH-05 | Fixed compositor merge order | SATISFIED | `Compositor._tick()` merges idle, speech, plugin, cursor, then clamps. |
| ARCH-06 | Single pyvts writer invariant | SATISFIED | Architecture test included in 107-test gate. |
| ARCH-07 | In-sidecar Python plugin model | SATISFIED | File-path loader and default plugin are in-process Python. |
| ARCH-08 | userData overrides in-tree plugin | SATISFIED | Discovery precedence implemented. |
| ARCH-09 | Boot-time vocabulary, no mid-conversation rebuild | SATISFIED | Watcher tests/source guard show prompt is not rebuilt by manifest changes. |
| ARCH-10 | IntentDriver deleted and logic migrates to plugin | SATISFIED | Production IntentDriver removed; default plugin owns action parsing/compositions. |
| ARCH-11 | api_version major compatibility gate | SATISFIED | Manifest validator rejects incompatible major versions. |
| ARCH-12 | Explicit system primitive override list | SATISFIED | `lock_filter.py` lists `MouthOpen`/mouth ownership rationale. |
| ARCH-02 | RigCapabilities contract | NOT REQUIRED | Moved to Phase 8; Phase 6 consumes the existing contract only. |

All Phase 6 requirement IDs named by the user are accounted for. ARCH-02 is excluded as requested.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/ws/server.py` | 58 | Pre-existing TODO about Electron env-var write | Info | Unrelated to Phase 6 plugin runtime goal and not a blocker. |

### Human Verification Required

### 1. Active Plugin Swap

**Test:** Start with `AGENTICLLMVTUBER_ACTIVE_PLUGIN=default`, then restart with a replacement or invalid plugin.
**Expected:** Logs show default load first; replacement changes motion or invalid plugin falls back to NullPlugin.
**Why human:** Requires live sidecar/VTube Studio observation and log review.

### 2. `[joy]` Invalid Active Teto Vocabulary

**Test:** Force a reply containing `[joy]`.
**Expected:** `[joy]` is ignored safely because it is obsolete/invalid for the active imported Teto avatar catalog and absent from `_avatar_overrides.yaml`; no active action, nonzero ParamFrame, model-expression semantics, or visual-success criterion is expected.
**Why human:** Final visual quality is intentionally deferred to Phase 10/operator judgment.

### 3. Speech Motion

**Test:** Send a 30s utterance.
**Expected:** Mouth movement tracks speech and head/body motion is non-flat.
**Why human:** Requires live audiovisual inspection.

### Gaps Summary

No automated gaps remain. The final gap-closure execution fixed the production supervised adapter path by adding `PluginSupervisor.render_frame(now)`, and 06-08 corrected the Phase 6/Phase 7 boundary: `[joy]` is obsolete/invalid and absent for active Teto, while model-owned variant success for tags such as `heart-eye` is deferred to Phase 7 `{variant}` dispatch.

---

_Verified: 2026-05-08T11:57:55Z_
_Verifier: Claude (gsd-verifier)_
