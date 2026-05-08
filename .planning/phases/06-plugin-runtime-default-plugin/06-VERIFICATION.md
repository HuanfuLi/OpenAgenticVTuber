---
phase: 06-plugin-runtime-default-plugin
verified: 2026-05-08T10:36:33Z
status: gaps_found
score: 5/8 must-haves verified
gaps:
  - truth: "Plugin receives bracketed action codes from the orchestrator and [joy] can activate through the normal LLM pipeline"
    status: failed
    reason: "Orchestrator enqueues sentence_output.tts_text to the plugin adapter after display/tts filtering has stripped bracket codes; a spot-check with 'Hello [joy] world.' delivered 'Hello world.' to the plugin."
    artifacts:
      - path: "sidecar/src/sidecar/orchestrator/orchestrator.py"
        issue: "Line 205 passes sentence_output.tts_text to plugin_adapter.enqueue_sentence()."
      - path: "sidecar/src/sidecar/orchestrator/transformers.py"
        issue: "Line 208 strips bracket tags with filter_brackets before tts_text is built."
      - path: "plugins/default/__init__.py"
        issue: "DefaultPlugin parser expects bracketed action codes in on_token_stream(), but the runtime path removes them first."
    missing:
      - "Preserve and enqueue the post-sentence_divider/pre-filter sentence text, including plugin action tags, to the plugin adapter."
      - "Add a regression test proving [joy] reaches DefaultPlugin through Orchestrator.turn()."
  - truth: "[joy] produces a smooth nonzero ParamFrame blend through the runtime adapter"
    status: failed
    reason: "DefaultPlugin emits a single frame immediately after activation with elapsed=0, so all [joy] values are 0.0; PluginAdapter then holds that zero frame at later ticks instead of re-rendering ramp weights."
    artifacts:
      - path: "plugins/default/__init__.py"
        issue: "on_token_stream() yields only one frame per sentence; _render_active_frame() computes time-varying weights only when on_token_stream() is invoked again."
      - path: "sidecar/src/sidecar/compositor/plugin_adapter.py"
        issue: "tick() returns the held ParamFrame and does not ask the plugin to render the active ramp at the compositor clock."
    missing:
      - "Make the default plugin emit a timed frame sequence for active actions, or move active-action rendering behind a tick path that produces nonzero ramp-in and decay frames at runtime."
      - "Add an adapter-level regression test where enqueue_sentence('[joy]') followed by ticks at +150ms/+300ms yields nonzero FaceAngle/EyeOpen params."
  - truth: "plugin.yaml hot-reload path reparses manifests and logs restart-required warning without rebuilding prompt mid-session"
    status: failed
    reason: "warn_if_manifest_changed() exists and is unit-tested, but no production watcher or hot-reload path calls it for plugin.yaml changes."
    artifacts:
      - path: "sidecar/src/sidecar/plugins/loader.py"
        issue: "Defines warn_if_manifest_changed() only."
      - path: "sidecar/src/sidecar/ws/server.py"
        issue: "Loads plugin manifest at boot but has no watchdog/observer path for later plugin.yaml changes."
    missing:
      - "Wire a watchdog observer or equivalent production file-watch path that reloads plugin.yaml, calls warn_if_manifest_changed(), and leaves the active plugin/prompt unchanged until restart."
---

# Phase 6: Plugin Runtime + Default Plugin Verification Report

**Phase Goal:** The animation layer becomes plug-and-play: active body-motion plugin selection happens at startup, the default plugin ships in-tree, plugin motion reaches the compositor without touching idle/lipsync/cursor/pyvts-writer code, and `[joy]` should produce a smooth ParamFrame blend. Phase 10 operator judgment for live visual quality is intentionally deferred.
**Verified:** 2026-05-08T10:36:33Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

The foundation and most runtime wiring are present: plugin API, manifest validation, file-path discovery, supervisor fallback, adapter slot, compositor merge/clamp path, default manifest, default plugin class, head-only body_sway migration, and the single-pyvts-writer guard all exist and are wired.

The phase goal is not achieved yet because the normal LLM-to-plugin data flow drops `[joy]` before the plugin sees it, and even direct adapter injection of `[joy]` holds an all-zero first frame instead of producing a runtime ramp. PLG-10 is also incomplete: the hot-reload warning helper exists but is not connected to a production file watcher.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Plugin API, manifest validation, discovery precedence, and deterministic prompt section exist | VERIFIED | `api.py`, `manifest.py`, and `loader.py` pass artifact checks; discovery and prompt-section helpers are used from `ws/server.py`. |
| 2 | Sidecar boots through loader/supervisor with NullPlugin fallback | VERIFIED | `ws/server.py` discovers manifests, loads entrypoints, calls `PluginSupervisor.load_or_null()`, and constructs `PluginAdapter`. |
| 3 | Compositor is decoupled from IntentDriver and merges idle -> speech -> plugin -> cursor -> clamp -> writer | VERIFIED | `intent_driver.py` is absent; `compositor.py` accepts `plugin_driver`, merges plugin frame third, calls `clamp_and_validate()`, then `writer.inject_params()`. |
| 4 | Default plugin ships in-tree with exactly eight OLVT action codes and no pyvts/exp3 activation path | VERIFIED | `plugins/default/plugin.yaml` declares the eight codes; `plugins/default/__init__.py` has `DefaultPlugin` and no `import pyvts`, `requestExpressionActivation`, or `.exp3` reference. |
| 5 | Default body_sway exposes only head_only while preserving source artifacts | VERIFIED | `plugins/default/body_sway/registry.py` returns only `("head_only",)` and rejects other names; proxy/exp3 files remain present. |
| 6 | Plugin receives bracketed action codes from normal orchestrator output | FAILED | Spot-check delivered `['Hello world.']` to the plugin adapter for input `Hello [joy] world.` because brackets are stripped before enqueue. |
| 7 | `[joy]` produces a smooth nonzero ParamFrame blend through runtime adapter ticks | FAILED | Spot-check after `enqueue_sentence('[joy]')` returned zero-valued FaceAngle/EyeOpen params at tick0, +150ms, and +300ms. |
| 8 | Manifest hot-reload warning path is production-wired and prompt remains frozen | FAILED | `warn_if_manifest_changed()` exists, but `rg` found no watchdog/observer production caller for plugin manifest changes. |

**Score:** 5/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `sidecar/src/sidecar/plugins/api.py` | BodyMotionPlugin API contract | VERIFIED | ABC with `on_load`, `on_token_stream`, `on_unload`, `ApiVersion.V1`. |
| `sidecar/src/sidecar/plugins/manifest.py` | PluginManifest and action-code validation | VERIFIED | Reserved/bracketed/duplicate/incompatible-major guards present. |
| `sidecar/src/sidecar/plugins/loader.py` | Discovery, entrypoint, prompt utilities | PARTIAL | Discovery/prompt utilities verified; hot-reload helper is not production-wired. |
| `sidecar/src/sidecar/plugins/supervisor.py` | Supervisor and NullPlugin | VERIFIED | Load timeout, fallback, circuit breaker, tolerant unload present. |
| `sidecar/src/sidecar/compositor/plugin_adapter.py` | TickDriver adapter | PARTIAL | Latest-frame/hold/stale behavior present; does not produce timed default-plugin ramp frames. |
| `sidecar/src/sidecar/compositor/compositor.py` | Plugin merge slot and clamp boundary | VERIFIED | Plugin slot and clamp before writer present. |
| `plugins/default/plugin.yaml` | Default plugin manifest | VERIFIED | Eight required OLVT action codes present. |
| `plugins/default/__init__.py` | DefaultPlugin behavior | PARTIAL | Parser/compositions exist, but runtime delivery and timed emission do not achieve `[joy]` blend. |
| `plugins/default/body_sway/registry.py` | head_only-only strategy | VERIFIED | Only `head_only` selectable. |
| `sidecar/scripts/plumbing_harness.py` | Lipsync/idle harness | VERIFIED | Existing regression gate passed in orchestrator. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ws/server.py` | plugin manifest discovery | `discover_manifests(_repo_root() / "plugins", _user_plugins_dir())` | WIRED | Repo and userData discovery are used at boot. |
| `ws/server.py` | plugin lifecycle | `_load_plugin_instance()` -> `PluginSupervisor.load_or_null()` | WIRED | Invalid load falls back to NullPlugin. |
| `ws/server.py` | orchestrator prompt | `build_action_codes_section(plugin_manifest)` -> `Orchestrator(...)` | WIRED | Prompt section is frozen at orchestrator construction. |
| `Orchestrator` | `PluginAdapter` | `plugin_adapter.enqueue_sentence(sentence_output.tts_text)` | NOT_WIRED_CORRECTLY | Enqueued text is filtered and lacks `[joy]`; plugin cannot parse actions from normal LLM output. |
| `PluginAdapter` | `DefaultPlugin` | async `on_token_stream(sentence)` consumer | PARTIAL | Direct calls reach plugin, but held frame stays zero unless plugin is invoked repeatedly. |
| `Compositor` | VTS writer | `clamp_and_validate(...); writer.inject_params(frame)` | WIRED | Plugin output reaches writer through clamp. |
| manifest reload helper | production watcher | none found | NOT_WIRED | No production caller for `warn_if_manifest_changed()`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `Orchestrator` -> `PluginAdapter` | `sentence` | `sentence_output.tts_text` | No, action tags removed | HOLLOW |
| `DefaultPlugin` | `action_codes` | `_extract_action_codes(sentence)` | Only if sentence still contains `[action]` | DISCONNECTED in runtime |
| `DefaultPlugin` -> `PluginAdapter` | `ParamFrame.add_params` | `_render_active_frame()` | Direct path produces a frame, but first runtime frame is zero and held | HOLLOW |
| `Compositor` | `plugin_frame` | `self._plugin.tick(now)` | Yes for any submitted nonzero frame | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Orchestrator delivers plugin-visible `[joy]` text | Python one-shot with `_FakeGateway(chunks=['Hello [joy] world.'])` and capture adapter | Adapter received `['Hello world.']` | FAIL |
| Adapter ticks after direct `[joy]` enqueue produce ramp values | Python one-shot with `DefaultPlugin`, `PluginAdapter`, ticks at 0/+150/+300ms | All FaceAngle/EyeOpen values stayed `0.0` | FAIL |
| Manifest hot-reload production wiring exists | `rg "warn_if_manifest_changed|watchdog|Observer|FileSystemEventHandler" sidecar/src` | Only helper and unrelated parent watchdog found | FAIL |
| Regression gate | User-provided gate in orchestrator | 99 sidecar tests passed, contracts check passed, renderer typecheck passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| PLG-01 | 06-01/02/03 | SATISFIED | Boot selects one active manifest/plugin and loads its entrypoint. |
| PLG-02 | 06-01/03 | SATISFIED | Sorted action-code prompt section is built and frozen at orchestrator construction. |
| PLG-03 | 06-01/03 | SATISFIED | `BodyMotionPlugin` ABC and default implementation exist. |
| PLG-04 | 06-02/03 | SATISFIED | Supervisor handles load failure, timeout, stream circuit breaker, and NullPlugin fallback. |
| PLG-05 | 06-01/02 | SATISFIED | `clamp_and_validate()` drops unknown/nonfinite params and clamps values/weights before writer. |
| PLG-06 | 06-01 | SATISFIED | Manifest validation rejects reserved/bracketed/duplicate/incompatible-major action codes. |
| PLG-07 | 06-03 | BLOCKED | Default plugin exists, but its action path is disconnected from normal orchestrator output and does not produce runtime `[joy]` motion. |
| PLG-08 | 06-01/02 | SATISFIED | Discovery scans repo plugins and optional userData plugins with userData precedence. |
| PLG-09 | 06-01/02/03 | SATISFIED | Startup-only active plugin selection is implemented via `AGENTICLLMVTUBER_ACTIVE_PLUGIN`; no runtime hot-swap path found. |
| PLG-10 | 06-01/02 | BLOCKED | Hot-reload warning helper exists but is not wired to a production `plugin.yaml` watcher. |
| ARCH-01 | 06-01/03 | PARTIAL | System/plugin separation exists, but system does not route plugin action-tag input correctly. |
| ARCH-03 | 06-02/03 | BLOCKED | Plugin receives filtered TTS text, not the post-sentence_divider/pre-code-extractor sentence containing `[joy]`. |
| ARCH-04 | 06-02/03 | PARTIAL | Adapter buffers `ParamFrame` output, but default plugin does not emit a timed ramp sequence through it. |
| ARCH-05 | 06-02/03 | SATISFIED | Merge order and clamp boundary are implemented for current Phase 6 surface. |
| ARCH-06 | 06-02/03 | SATISFIED | Existing architecture gate passed; `import pyvts` remains constrained to writer code under `sidecar/src`. |
| ARCH-07 | 06-01/03 | SATISFIED | Plugins are in-sidecar Python loaded by file path. |
| ARCH-08 | 06-01 | SATISFIED | userData plugin override precedence implemented. |
| ARCH-09 | 06-01/02 | SATISFIED | Prompt vocabulary is built at boot and not rebuilt by turn. |
| ARCH-10 | 06-02/03 | SATISFIED | Production `IntentDriver` removed; plugin slot replaces intent driver in compositor. |
| ARCH-11 | 06-01 | SATISFIED | `api_version` major compatibility is enforced. |
| ARCH-12 | 06-01/02 | SATISFIED | Explicit system primitive override list exists for VTS `MouthOpen`; resolver maps model `ParamMouthOpenY` to this VTS input. |
| ARCH-02 | User note | NOT REQUIRED | Explicitly moved to Phase 8; Phase 6 consumes the contract only. |

All Phase 6 IDs named by the user are accounted for. ARCH-02 is excluded as requested.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/orchestrator/orchestrator.py` | 205 | Filtered `tts_text` sent to plugin | Blocker | Drops plugin action codes before DefaultPlugin can parse them. |
| `plugins/default/__init__.py` | 73/146 | Time-varying ramp only recomputed on new token-stream calls | Blocker | Runtime adapter holds an all-zero activation frame. |
| `sidecar/src/sidecar/plugins/loader.py` | 64 | Hot-reload helper without production caller | Warning | PLG-10 engineer-DX contract incomplete. |

### Human Verification Required

The existing `06-UAT.md` live checks remain valid after the automated blockers are fixed:

### 1. Active Plugin Swap

**Test:** Start with `AGENTICLLMVTUBER_ACTIVE_PLUGIN=default`, then restart with a replacement or invalid plugin.
**Expected:** Logs show default load first; replacement changes motion or invalid plugin falls back to NullPlugin.
**Why human:** Requires live sidecar/VTube Studio observation and log review.

### 2. `[joy]` Default Plugin Action

**Test:** Force a reply containing `[joy]`.
**Expected:** No VTS request-error flood, no exp3 activation, and visible head/eye/face ramp-in and decay.
**Why human:** Final visual quality is intentionally deferred to Phase 10/operator judgment, but the automated data-flow blockers must be fixed first.

### 3. Speech Motion

**Test:** Send a 30s utterance.
**Expected:** Mouth movement tracks speech and head/body motion is non-flat.
**Why human:** Requires live audiovisual inspection.

### Gaps Summary

Phase 6 is close structurally but fails the core default-plugin behavior. The system prompt tells the LLM about `[joy]`, but the normal orchestrator path strips `[joy]` before the plugin receives the sentence. Separately, even a direct `[joy]` injection into the adapter produces an all-zero held frame because the default plugin computes ramp weights only during `on_token_stream()` calls, not during compositor ticks or a generated frame sequence. Finally, PLG-10 needs production watcher wiring; the helper alone does not satisfy hot-reload behavior.

---

_Verified: 2026-05-08T10:36:33Z_
_Verifier: Claude (gsd-verifier)_
