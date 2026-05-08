---
phase: 06-plugin-runtime-default-plugin
verified: 2026-05-08T11:07:07Z
status: gaps_found
score: 7/8 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/8
  gaps_closed:
    - "Normal Orchestrator.turn() preserves bracketed plugin action text into PluginAdapter while display/TTS are stripped."
    - "plugin.yaml manifest watcher production path reparses manifests, logs restart-required warning, and does not rebuild prompt or hot-swap plugin."
  gaps_remaining:
    - "[joy] does not produce nonzero timed ParamFrame ramp values through the production supervised adapter path."
  regressions: []
gaps:
  - truth: "[joy] produces nonzero timed ParamFrame ramp values through adapter ticks and then decays in the normal production path"
    status: failed
    reason: "DefaultPlugin.render_frame(now) exists and works when PluginAdapter wraps DefaultPlugin directly, but sidecar production boot wraps the plugin in PluginSupervisor before constructing PluginAdapter. PluginSupervisor does not proxy render_frame(), so PluginAdapter.tick() cannot refresh the active ramp and instead holds the initial elapsed=0 all-zero frame."
    artifacts:
      - path: "sidecar/src/sidecar/plugins/supervisor.py"
        issue: "PluginSupervisor lacks a render_frame(now) proxy to the wrapped plugin."
      - path: "sidecar/src/sidecar/compositor/plugin_adapter.py"
        issue: "render_frame lookup checks only the adapter-wrapped object, which is PluginSupervisor in production."
      - path: "sidecar/src/sidecar/ws/server.py"
        issue: "Production boot passes PluginSupervisor into PluginAdapter, so the default plugin's render_frame hook is hidden."
    missing:
      - "Expose/proxy render_frame(now) from PluginSupervisor when the wrapped plugin supports it, or pass the render-capable plugin surface into PluginAdapter while preserving supervisor behavior."
      - "Add a regression test using PluginSupervisor.load_or_null(DefaultPlugin(...)) inside PluginAdapter, then enqueue_sentence('[joy]') and assert ticks at +150ms/+300ms are nonzero and later decay."
---

# Phase 6: Plugin Runtime + Default Plugin Verification Report

**Phase Goal:** The animation layer becomes plug-and-play. A developer can swap the body-motion strategy by changing one config line, restarting the sidecar, and observing the avatar move differently without touching idle/lipsync/cursor/pyvts-writer code. The default plugin ships with the system and absorbs milestone-1 IntentDriver + body-sway logic; `[joy]` should flow through the normal orchestrator path to the default plugin and produce timed ParamFrame ramp behavior. Phase 10 operator visual quality judgment remains deferred.
**Verified:** 2026-05-08T11:07:07Z
**Status:** gaps_found
**Re-verification:** Yes - after gap-closure execution

## Goal Achievement

The prior orchestrator text-flow gap is closed: `SentenceOutput.plugin_text` carries the post-sentence-divider, pre-display/pre-TTS sentence text, and `Orchestrator._emit_sentence()` enqueues that field into the plugin adapter. A behavioral spot-check delivered `Hello [joy] world.` to the adapter while display/TTS stayed `Hello world.`.

The prior manifest watcher gap is also closed: `watchdog==6.0.0` is installed, `start_manifest_change_watcher()` observes the active `plugin.yaml`, reparses it, calls `warn_if_manifest_changed()`, and `ws/server.py` starts/stops the watcher without rebuilding the prompt or replacing `app.state.plugin_manifest`.

One goal-blocking gap remains. The new timed render hook is hidden by the production supervisor wrapper. Direct `PluginAdapter(DefaultPlugin)` tests produce nonzero timed frames, but real sidecar boot constructs `PluginAdapter(plugin_supervisor)`. `PluginSupervisor` has no `render_frame` proxy, so production ticks hold the initial all-zero frame emitted at activation time.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Plugin API, manifest validation, discovery precedence, and deterministic prompt section exist | VERIFIED | `api.py`, `manifest.py`, and `loader.py` provide the planned contract, validation, discovery, entrypoint, and prompt-section helpers. |
| 2 | Sidecar boots through loader/supervisor with NullPlugin fallback | VERIFIED | `ws/server.py` discovers manifests, loads the active plugin, calls `PluginSupervisor.load_or_null()`, and constructs `PluginAdapter`. |
| 3 | Compositor is decoupled from IntentDriver and merges idle -> speech -> plugin -> cursor -> clamp -> writer | VERIFIED | `intent_driver.py` is absent from production, `compositor.py` accepts `plugin_driver`, merges plugin frames third, calls `clamp_and_validate()`, then `writer.inject_params()`. |
| 4 | Default plugin ships in-tree with exactly eight OLVT action codes and no pyvts/exp3 activation path | VERIFIED | `plugins/default/plugin.yaml` declares anger, disgust, fear, joy, neutral, sadness, smirk, surprise; `plugins/default/__init__.py` has no `import pyvts`, `.exp3`, or `requestExpressionActivation`. |
| 5 | Default body_sway exposes only head_only while preserving source artifacts | VERIFIED | `plugins/default/body_sway/registry.py` returns only `("head_only",)` and rejects other names; proxy/exp3 source files remain. |
| 6 | Normal Orchestrator.turn() sends plugin-visible `[joy]` while display and TTS are stripped | VERIFIED | Focused pytest passed; direct spot-check printed `received ['Hello [joy] world.']`, `display ['Hello world.']`, and expression actions remained present for the legacy path. |
| 7 | `[joy]` produces a smooth nonzero ParamFrame blend through production adapter ticks | FAILED | Supervised spot-check produced zero FaceAngle/EyeOpen values at 0.15s, 0.30s, and 0.95s because `PluginSupervisor` does not expose `render_frame`. |
| 8 | Manifest hot-reload warning path is production-wired and prompt remains frozen | VERIFIED | Focused watcher tests passed; source shows `start_manifest_change_watcher()` wired in lifespan, one boot-time `build_action_codes_section(plugin_manifest)` before `Orchestrator(...)`, and shutdown stop logic. |

**Score:** 7/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `sidecar/src/sidecar/plugins/api.py` | BodyMotionPlugin API contract | VERIFIED | ABC with `on_load`, `on_token_stream`, `on_unload`, `ApiVersion.V1`. |
| `sidecar/src/sidecar/plugins/manifest.py` | PluginManifest and action-code validation | VERIFIED | Reserved/bracketed/duplicate/incompatible-major guards present. |
| `sidecar/src/sidecar/plugins/loader.py` | Discovery, prompt utilities, manifest watcher | VERIFIED | Discovery/prompt helpers and watchdog-backed manifest watcher are present. |
| `sidecar/src/sidecar/plugins/supervisor.py` | Supervisor and NullPlugin | PARTIAL | Load timeout, fallback, circuit breaker, unload present; missing `render_frame` proxy blocks timed default-plugin ramps in production. |
| `sidecar/src/sidecar/compositor/plugin_adapter.py` | TickDriver adapter | PARTIAL | Supports optional `render_frame(now)`, but only on the wrapped object. Production wraps `PluginSupervisor`, not `DefaultPlugin`. |
| `sidecar/src/sidecar/compositor/compositor.py` | Plugin merge slot and clamp boundary | VERIFIED | Plugin slot and clamp before writer present. |
| `plugins/default/plugin.yaml` | Default plugin manifest | VERIFIED | Eight required OLVT action codes present. |
| `plugins/default/__init__.py` | DefaultPlugin behavior | VERIFIED | Parser, compositions, `render_frame(now)`, decay, and ParamFrame-only behavior present. |
| `plugins/default/body_sway/registry.py` | head_only-only strategy | VERIFIED | Only `head_only` selectable. |
| `sidecar/scripts/plumbing_harness.py` | Lipsync/idle harness | VERIFIED | Recent orchestrator regression gate passed. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ws/server.py` | plugin manifest discovery | `discover_manifests(_repo_root() / "plugins", _user_plugins_dir())` | WIRED | Repo and userData discovery are used at boot. |
| `ws/server.py` | plugin lifecycle | `_load_plugin_instance()` -> `PluginSupervisor.load_or_null()` | WIRED | Invalid load falls back to supervised NullPlugin. |
| `ws/server.py` | manifest watcher | `start_manifest_change_watcher(manifest_path, plugin_manifest)` | WIRED | Watcher starts after boot manifest load and stops during lifespan shutdown. |
| `ws/server.py` | orchestrator prompt | `build_action_codes_section(plugin_manifest)` -> `Orchestrator(...)` | WIRED | Prompt section is built once before orchestrator construction. |
| `Orchestrator` | `PluginAdapter` | `plugin_adapter.enqueue_sentence(sentence_output.plugin_text)` | WIRED | Bracketed plugin text reaches adapter while display/TTS are stripped. |
| `PluginAdapter` | `DefaultPlugin` | `on_token_stream(sentence)` through `PluginSupervisor` | PARTIAL | Activation reaches plugin, but `render_frame()` is hidden by the supervisor wrapper. |
| `Compositor` | VTS writer | `clamp_and_validate(...); writer.inject_params(frame)` | WIRED | Plugin output reaches writer through clamp. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `Orchestrator` -> `PluginAdapter` | `sentence` | `sentence_output.plugin_text` | Yes | FLOWING |
| `DefaultPlugin` | `action_codes` | `_extract_action_codes(sentence)` | Yes when `[joy]` is present | FLOWING |
| `DefaultPlugin` -> `PluginAdapter` direct | `ParamFrame.add_params` | `render_frame(now)` | Yes in direct adapter test | FLOWING |
| `DefaultPlugin` -> `PluginSupervisor` -> `PluginAdapter` production | `ParamFrame.add_params` | initial `on_token_stream()` frame only | No, all-zero frame is held | HOLLOW |
| Manifest watcher | `reloaded manifest` | `load_manifest(active plugin.yaml)` in watcher callback | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused orchestrator text-flow and watcher tests | `cd sidecar && uv run pytest tests/test_orchestrator_turn.py::test_plugin_adapter_receives_bracketed_sentence_while_display_and_tts_are_stripped tests/plugins/test_manifest_watcher.py -q` | 6 passed | PASS |
| Orchestrator delivers plugin-visible `[joy]` text | Python one-shot with `_FakeGateway(chunks=['Hello [joy] world.'])` and capture adapter | Adapter received `['Hello [joy] world.']`; display was `['Hello world.']`; action list retained legacy `joy` expression | PASS |
| Production supervised adapter ticks after direct `[joy]` enqueue produce ramp values | Python one-shot with `DefaultPlugin`, `PluginSupervisor.load_or_null(...)`, `PluginAdapter(supervisor)`, ticks at 0.15/0.30/0.95 | All joy params stayed `0.0`; `has_supervisor_render False`; `active joy` never decayed | FAIL |
| Recent regression gate | User-provided orchestrator gate | 106 sidecar tests passed, contracts check passed, renderer typecheck passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| PLG-01 | 06-01/02/03 | Single-active plugin manifest at startup | SATISFIED | `ws/server.py` selects active plugin name and loads manifest/entrypoint at boot. |
| PLG-02 | 06-01/02 | Sorted action codes contribute to system prompt once | SATISFIED | `build_action_codes_section(plugin_manifest)` is called once before `Orchestrator(...)`. |
| PLG-03 | 06-01/03 | BodyMotionPlugin lifecycle hooks | SATISFIED | ABC and default implementation present. |
| PLG-04 | 06-02 | Supervisor timeout/circuit breaker/null fallback | SATISFIED | `PluginSupervisor` implements timeout, stream failure tracking, and NullPlugin fallback. |
| PLG-05 | 06-01/02 | Clamp plugin ParamFrames | SATISFIED | `clamp_and_validate()` is called in compositor before writer injection. |
| PLG-06 | 06-01 | Manifest validation and reserved-name guard | SATISFIED | `PluginManifest` validators present. |
| PLG-07 | 06-03/04 | Default plugin in-tree absorbs IntentDriver/body-sway logic | BLOCKED | Default plugin exists and parses `[joy]`, but production supervised adapter path does not emit timed nonzero ramp frames. |
| PLG-08 | 06-01/02 | Discover repo and userData plugins | SATISFIED | `discover_manifests()` handles repo/userData precedence. |
| PLG-09 | 06-02/05 | Startup-only plugin switching | SATISFIED | Active plugin read at boot; watcher warns only and does not hot-swap. |
| PLG-10 | 06-05 | Manifest watcher reparse + WARN without reload | SATISFIED | Watchdog helper and lifespan wiring verified. |
| ARCH-01 | 06-01/03/04 | System owns LLM/VTS, plugin owns motion | PARTIAL | Separation exists, but supervised motion output does not complete the `[joy]` ramp path. |
| ARCH-03 | 06-04 | Plugin input is post-sentence-divider/pre-code-filter sentence text | SATISFIED | `plugin_text=sentence.text` and enqueue of `sentence_output.plugin_text` verified. |
| ARCH-04 | 06-02/04 | Plugin output through adapter buffers/ticks ParamFrame | BLOCKED | Adapter can call `render_frame`, but production supervisor wrapper hides it. |
| ARCH-05 | 06-02 | Fixed compositor merge order | SATISFIED | `Compositor._tick()` merges idle, speech, plugin, cursor, then clamps. |
| ARCH-06 | 06-02 | Single pyvts writer invariant | SATISFIED | Recent regression gate included architecture test; `rg` shows production `import pyvts` only in writer. |
| ARCH-07 | 06-01/03 | In-sidecar Python plugin model | SATISFIED | File-path loader and default plugin are in-process Python. |
| ARCH-08 | 06-01 | userData overrides in-tree plugin | SATISFIED | Discovery precedence implemented. |
| ARCH-09 | 06-01/02/05 | Boot-time vocabulary, no mid-conversation rebuild | SATISFIED | Watcher tests/source guard show prompt is not rebuilt by manifest changes. |
| ARCH-10 | 06-02/03 | IntentDriver deleted and logic migrates to plugin | SATISFIED | Production IntentDriver removed; default plugin owns action parsing/compositions. |
| ARCH-11 | 06-01 | api_version major compatibility gate | SATISFIED | Manifest validator rejects incompatible major versions. |
| ARCH-12 | 06-01/02 | Explicit system primitive override list | SATISFIED | `lock_filter.py` lists `MouthOpen` with lipsync ownership rationale. |
| ARCH-02 | User note | RigCapabilities contract | NOT REQUIRED | Moved to Phase 8; Phase 6 consumes existing contract only. |

All Phase 6 requirement IDs named by the user are accounted for. ARCH-02 is excluded as requested.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/plugins/supervisor.py` | class body | Missing `render_frame` proxy | Blocker | Hides the default plugin timed render hook from `PluginAdapter` in production. |
| `sidecar/src/sidecar/compositor/plugin_adapter.py` | 27/33 | Optional render hook lookup only on wrapped object | Blocker | Works in direct unit test but not with the production supervised plugin object. |

### Human Verification Required

The live VTS/operator checks remain valid UAT items, but they should run after the supervised `[joy]` data-flow blocker is fixed.

### 1. Active Plugin Swap

**Test:** Start with `AGENTICLLMVTUBER_ACTIVE_PLUGIN=default`, then restart with a replacement or invalid plugin.
**Expected:** Logs show default load first; replacement changes motion or invalid plugin falls back to NullPlugin.
**Why human:** Requires live sidecar/VTube Studio observation and log review.

### 2. `[joy]` Default Plugin Action

**Test:** Force a reply containing `[joy]`.
**Expected:** No VTS request-error flood, no exp3 activation, and visible head/eye/face ramp-in and decay.
**Why human:** Final visual quality is intentionally deferred to Phase 10/operator judgment, but the automated supervised data-flow blocker must be fixed first.

### 3. Speech Motion

**Test:** Send a 30s utterance.
**Expected:** Mouth movement tracks speech and head/body motion is non-flat.
**Why human:** Requires live audiovisual inspection.

### Gaps Summary

Gap-closure execution fixed the text-routing and manifest-watcher failures. Phase 6 still does not achieve the full goal because `[joy]` does not produce timed nonzero ParamFrame ramps through the same supervised adapter path used by production sidecar boot. The likely focused fix is to make `PluginSupervisor` proxy `render_frame(now)` to its wrapped plugin when available, with a regression test that builds `PluginAdapter(await PluginSupervisor.load_or_null(DefaultPlugin(...)))`.

---

_Verified: 2026-05-08T11:07:07Z_
_Verifier: Claude (gsd-verifier)_
