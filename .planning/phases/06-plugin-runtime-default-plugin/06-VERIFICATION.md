---
phase: 06-plugin-runtime-default-plugin
verified: 2026-05-08T11:57:55Z
status: human_needed
score: 8/8 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 7/8
  gaps_closed:
    - "Production-style PluginAdapter(PluginSupervisor(DefaultPlugin)) receives [joy], emits nonzero timed params at +150ms/+300ms, and decays by +950ms."
    - "PluginSupervisor.render_frame(now) safely proxies render-capable wrapped plugins and returns empty ParamFrame for missing hook/circuit-open/failure cases."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Active plugin swap"
    expected: "Restarting the sidecar with a different active plugin changes body-motion behavior or falls back safely for an invalid plugin."
    why_human: "Requires live sidecar/VTube Studio observation and log review."
  - test: "[joy] default plugin action"
    expected: "A forced [joy] reply shows visible head/eye/face ramp-in and decay with no VTS request-error flood or exp3 activation."
    why_human: "Final visual quality is intentionally deferred to Phase 10/operator judgment."
  - test: "Speech motion"
    expected: "A 30s utterance keeps mouth movement synced and head/body motion non-flat."
    why_human: "Requires live audiovisual inspection."
---

# Phase 6: Plugin Runtime + Default Plugin Verification Report

**Phase Goal:** The animation layer becomes plug-and-play. A developer can swap the body-motion strategy by changing one config line, restarting the sidecar, and observing the avatar move differently without touching idle/lipsync/cursor/pyvts-writer code. The default plugin ships with the system and absorbs milestone-1 IntentDriver + body-sway logic; `[joy]` flows through the normal orchestrator path to the default plugin and produces timed ParamFrame ramp behavior through the production supervised adapter path. Phase 10 operator visual quality judgment remains deferred.
**Verified:** 2026-05-08T11:57:55Z
**Status:** human_needed
**Re-verification:** Yes - after final gap-closure execution

## Goal Achievement

The previously remaining automated gap is closed. `PluginSupervisor.render_frame(now)` now proxies render-capable wrapped plugins, and the production-shaped `PluginAdapter(PluginSupervisor(DefaultPlugin))` path emits nonzero `[joy]` params at +150ms and +300ms, then decays to zero by +950ms.

Automated implementation is complete for Phase 6. Live VTS/operator checks remain human/UAT items, and Phase 10 still owns final visual quality judgment as the roadmap states.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Plugin API, manifest validation, discovery precedence, and deterministic prompt section exist | VERIFIED | `api.py`, `manifest.py`, and `loader.py` provide the planned contract, validation, discovery, entrypoint, prompt-section, and manifest watcher helpers. |
| 2 | Sidecar boots through loader/supervisor with NullPlugin fallback | VERIFIED | `ws/server.py` discovers manifests, loads the active plugin, calls `PluginSupervisor.load_or_null()`, then constructs `PluginAdapter(plugin_supervisor)`. |
| 3 | Compositor is decoupled from IntentDriver and merges idle -> speech -> plugin -> cursor -> clamp -> writer | VERIFIED | `intent_driver.py` is absent from production; `compositor.py` accepts `plugin_driver`, merges plugin frames, clamps, then writes. |
| 4 | Default plugin ships in-tree with exactly eight OLVT action codes and no pyvts/exp3 activation path | VERIFIED | `plugins/default/plugin.yaml` has 8 `code:` entries; `plugins/default/__init__.py` contains no `import pyvts`, `.exp3`, or `requestExpressionActivation`. |
| 5 | Default body_sway exposes only head_only while preserving source artifacts | VERIFIED | `plugins/default/body_sway/registry.py` returns only `("head_only",)` and rejects other names. |
| 6 | Normal `Orchestrator.turn()` sends plugin-visible `[joy]` while display and TTS are stripped | VERIFIED | `transformers.py` sets `plugin_text=sentence.text`; `orchestrator.py` enqueues `sentence_output.plugin_text`. |
| 7 | Production supervised `[joy]` path emits timed nonzero ParamFrame ramps and decays | VERIFIED | Spot-check produced `FaceAngleZ=0.05` at +150ms, `FaceAngleZ=0.1` at +300ms, and zero-valued joy params with `active None` at +950ms. |
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
| `DefaultPlugin` | `action_codes` | `_extract_action_codes(sentence)` | Yes when `[joy]` is present | FLOWING |
| `DefaultPlugin.render_frame(now)` | `ParamFrame.add_params` | active action + elapsed time | Yes | FLOWING |
| `DefaultPlugin` -> `PluginSupervisor` -> `PluginAdapter` | `ParamFrame.add_params` | supervised `render_frame(now)` proxy | Yes; +150ms/+300ms nonzero, +950ms decayed | FLOWING |
| Manifest watcher | `reloaded manifest` | `load_manifest(active plugin.yaml)` in watcher callback | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Supervised adapter regression and adapter/supervisor suite | `cd sidecar && uv run pytest tests/compositor/test_plugin_adapter.py::test_supervised_default_plugin_render_frame_drives_joy_ramp tests/plugins/test_supervisor.py tests/compositor/test_plugin_adapter.py -q` | 10 passed | PASS |
| Production-shaped `[joy]` data flow | Python one-shot with `DefaultPlugin`, `PluginSupervisor.load_or_null(...)`, `PluginAdapter(supervisor)`, ticks at 0.15/0.30/0.95 | +150ms `FaceAngleZ=0.05`; +300ms `FaceAngleZ=0.1`; +950ms all zero and `active None` | PASS |
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
| PLG-07 | Default plugin in-tree absorbs IntentDriver/body-sway logic | SATISFIED | Default plugin owns parser/compositions/body_sway, and supervised `[joy]` timed ramp path is verified. |
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

### 2. `[joy]` Default Plugin Action

**Test:** Force a reply containing `[joy]`.
**Expected:** No VTS request-error flood, no exp3 activation, and visible head/eye/face motion ramp-in and decay.
**Why human:** Final visual quality is intentionally deferred to Phase 10/operator judgment.

### 3. Speech Motion

**Test:** Send a 30s utterance.
**Expected:** Mouth movement tracks speech and head/body motion is non-flat.
**Why human:** Requires live audiovisual inspection.

### Gaps Summary

No automated gaps remain. The final gap-closure execution fixed the production supervised adapter path by adding `PluginSupervisor.render_frame(now)`, and verification confirms the `[joy]` timed ramp now flows through `PluginAdapter(PluginSupervisor(DefaultPlugin))`.

---

_Verified: 2026-05-08T11:57:55Z_
_Verifier: Claude (gsd-verifier)_
