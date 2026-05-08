# Project Research Summary — Milestone v2.0 (Plugin + Animation Control)

**Project:** AgenticLLMVTuber
**Domain:** Plugin runtime + animation-architecture refactor for an Electron + Python-sidecar VTuber companion (5 phases — 6, 7, 8, 9, 10 per `PROJECT_DESIGN.md` §14B.7)
**Researched:** 2026-05-08
**Confidence:** HIGH

## Executive Summary

Milestone v2.0 takes the milestone-1 walking skeleton and refactors body-motion generation from compositor-internal to plugin-driven, while adding three user-facing surfaces: a slider HUD with per-param locks, a mandatory-review avatar import flow, and three-category LLM emit codes (`[action]` / `{variant}` / `<event>`). The research is unambiguous on the integration points — the existing compositor's `TickDriver` Protocol, lifespan injection, and explicit `add_acc`/`set_acc` merge already provide the seams v2.0 needs. **Most of v2.0 is additive**, not invasive. The greenfield pieces concentrate in two phases: Phase 6 (plugin runtime, manifest, ABC, default plugin) and Phase 8 (avatar import flow with four file-format extractors and a dedicated React review screen).

The recommended approach keeps the milestone-1 stack locked and adds only **3 net new sidecar dependencies**: `jsonschema 4.26.0`, `pynput 1.8.1`, and `watchdog 6.0.0`. No renderer/build-chain bumps. Plugin loading is stdlib `importlib.import_module` against a `module:class` string in `plugin.yaml` — explicitly *not* setuptools entry-points or pluggy. Avatar files are JSON+YAML (no Cubism Python SDK exists or is needed). Cubism `motion3.json` `Meta.Duration` resolves §14B.9's open question on event auto-completion timeout.

The dominant risk concentrates in Phase 6: **5 critical pitfalls** (loader crash safety, async-generator leaks, plugin-output rate mismatch, safety clamping bypass, manifest schema drift) all attach to the plugin runtime, and the contracts set there cascade through 7/9/10. Recommendation: treat Phase 6 as a "plumbing-week" sub-phase that sets the supervisor + clamp + writer contracts before the default plugin's behavior gets debugged. Phase 10 is paradoxically the smallest in code (~30 LOC cursor adjustment — Phase 4 already implemented v2.0's cursor design) but the largest in verification ceremony (six §14 SCs re-run with side-by-side tolerances against milestone-1 baselines).

## Key Findings

### Recommended Stack

The milestone-1 stack is locked (Electron 40, React 19.2, Vite 6, Python 3.12, FastAPI 0.136.1, Uvicorn 0.46.0, LiteLLM 1.83.14, piper-tts 1.4.2, pyvts 0.3.3 vendored, electron-vite 5, electron-builder 25, json-schema-to-typescript@15) and not re-pinned. v2.0 adds three sidecar deps:

- **`jsonschema` 4.26.0** — runtime validation of `plugin.yaml` and `_avatar_overrides.yaml`.
- **`pynput` 1.8.1** — cross-platform cursor read for non-Windows dev/test; production Windows uses already-pinned `pywin32 311` directly.
- **`watchdog` 6.0.0** — manifest hot-reload for engineer DX (read-only; runtime hot-swap deferred to milestone-3).
- **stdlib `importlib.import_module` + manifest `module:class`** — plugin entrypoint resolution. NOT setuptools entry-points (wrong shape — requires `pip install`); NOT pluggy (wrong abstraction — multi-plugin composition).
- **stdlib `json` + already-pinned `pyyaml`** — covers all four Cubism file types.

### Expected Features

**Must have (table stakes):**
- Plugin manifest with `entrypoint: module:class`, `api_version`, `action_codes`, `description`.
- `BodyMotionPlugin` ABC with `on_load(capabilities)` / `on_token_stream(tokens)` / `on_unload()`.
- Plugin discovery from in-tree `plugins/` + `userData/plugins/`.
- Single-active plugin, switched at startup; no runtime hot-swap.
- Three-category code system with reserved-name guard, cross-category uniqueness, per-category dispatch.
- Avatar import flow with mandatory review screen, four extractors, persisted to `_avatar_overrides.yaml`.
- Slider HUD with per-param lock toggle (auto-engages on drag), session-only persistence, lipsync override of locks on `MouthOpenY`.
- 15 Hz HUD-mode IPC channel (separate WS `/hud/ws`), only active when HUD mounted.
- Sidecar OS-level cursor capture (Phase 4 already implemented; Phase 10 polish).
- Default plugin ships with system, absorbs current `IntentDriver` + body-sway code.

**Should have (differentiators):**
- `cdi3.json` parameter-display-names surfaced in slider HUD when present.
- Filters on slider HUD param list (writable / animating / locked).
- Plugin manifest declares optional `config_defaults: {}` block.
- Reject Cubism 5.3 rigs at import with helpful error.
- `motion3.json` `Meta.Duration` drives event auto-completion timeout.

**Defer (anti-features for milestone-3+):**
- Plugin hot-reload / runtime swap.
- Multiple-active plugins / composition.
- Plugin sandboxing / signing / marketplace.
- Per-avatar plugin selection.
- Snapshot/restore of slider values.
- LLM-suggested semantic naming during import review.

### Architecture Approach

The compositor already exposes the `TickDriver` Protocol that v2.0 hangs new contributors off; the plugin's async generator is wrapped in a `PluginAdapter(TickDriver)` whose `tick(now)` returns the buffered last `ParamFrame`. System prompt assembly stays at orchestrator construction (KV-cache prefix-stability is load-bearing); plugin manifest contributes deterministic, sorted action-code descriptions under a fixed delimiter. The three-category parser is a single `code_extractor` decorator replacing `actions_extractor` (one bracket-walker, dispatching on opener char). HUD uses a separate WS path `/hud/ws` with sidecar-side 15 Hz throttling and renderer optimistic-lock on drag. Cursor sensor is already sidecar-side; Phase 10 drops the in-VTS-window gate and adds synthetic-canvas fallback.

**Major components:**
1. **Plugin runtime (`sidecar/src/sidecar/plugins/`)** — NEW. ABC + manifest pydantic + loader with reserved-name guard, supervised async-gen task, defensive try/except wrappers, rate-limiter coalescer.
2. **`PluginAdapter(TickDriver)`** — NEW single seam. Zero compositor structural change.
3. **Default plugin (`plugins/default/`)** — NEW (repo root). Absorbs the current `IntentDriver` + `compositor/body_sway/*` logic.
4. **`code_extractor` decorator** — REFACTORED from `actions_extractor`. Single-pass bracket walker; reuses milestone-1's split-bracket buffer logic.
5. **Avatar import** — NEW. Type detector + 4 independent extractors + dedicated React route + atomic write to `_avatar_overrides.yaml`.
6. **HUD** — NEW. 15 Hz gate inside compositor's emit step, dedicated WS endpoint, sidecar single-source-of-truth `LockState`.
7. **Cursor driver adjustments** — POLISH. Drop in-canvas gate, attenuation outside, synthetic fallback, multi-monitor virtual-screen rect normalization, DPI-awareness bootstrap.

**Critical preservation:** `Compositor`, `IdleDriver`, `SpeechDriver` (lipsync only post-v2), `CursorDriver`, `PyvtsSafeWriter` keep their protocol seams. Single pyvts writer rule (M1#3) carries over to all new entry points.

### Critical Pitfalls

1. **Plugin loader crash safety (Phase 6)** — wrap every lifecycle hook in `try/except → PluginCrashed`, fall back to null plugin emitting rest-state ParamFrames at 60 Hz. Supervisor with circuit breaker.
2. **Async-generator leaks across turn boundaries (Phase 6)** — orchestrator wraps call in `async with`, `gen.aclose()` on every termination path. CI grep-test rejects `importlib.reload(plugin_module)`.
3. **Plugin output rate mismatch / silent backpressure (Phase 6)** — loader inserts coalescing rate-limiter; compositor merge runs at 60 Hz monotonic-clock cadence; hold-last-frame on under-rate preserves M1#9 1-second re-injection.
4. **Safety-clamp bypass (Phase 6)** — single `clamp_and_validate(frame, capabilities)` at compositor → renderer boundary; unknown keys WARN, NaN/Inf drops frame.
5. **Three-category token-boundary parsing (Phase 7)** — extend split-bracket fix to `{xxx}` and `<xxx>`; `<` collides with `<think>`. Order load-bearing: reasoning-stripper FIRST, then sentence-buffer, then unified extractor; reserved-name guard blocks `<think>`/`<thinking>`/`<tool_call>`/`<function_call>`/`<function_calls>`/`<invoke>`/`<parameter>`.
6. **Cursor DPI awareness on Windows (Phase 10)** — `SetProcessDpiAwareness(2)` before any other Win32-touching import. Use virtual-screen-rect for normalization.
7. **§14 SC re-run silent regression (Phase 10)** — milestone exit gate. Default plugin must produce output within tolerance of milestone-1 compositor for the same input. SC #2 (`[joy]` smooth fade) and SC #4 (body sway) are highest-risk because responsibilities migrated.
8. **Single pyvts writer carry-over (M1#3)** — every new v2.0 entry point goes through writer queue. CI grep-test enforces `grep "import pyvts" src/ | wc -l == 1`.

See `PITFALLS.md` for 28 numbered pitfalls + per-phase test-plan anchors.

## Implications for Roadmap

`PROJECT_DESIGN.md` §14B.7 lists phases **6 → 7 → 8 → 9 → 10**. Architecture research flags an internal contradiction: §14B.7's gating paragraph says "Phase 8 must produce variant/event catalogs before Phase 7's variant/event parsers have anything to validate against." **Recommended order is therefore 6 → 8 → 7 → 9 → 10.** Roadmapper should pick one explicitly.

### Phase 6: Plugin Runtime + Default Plugin
**Rationale:** Foundation for all other phases. Treat as plumbing-week sub-phase: ABC + manifest + loader + supervisor + clamp + rate-limiter contracts MUST land before default plugin's behavior gets debugged.
**Delivers:** `BodyMotionPlugin` ABC, `PluginManifest` pydantic, loader with reserved-name guard, `PluginAdapter(TickDriver)`, default plugin absorbing current `IntentDriver` + body-sway, system-prompt assembly with action-code section.
**Stack uses:** `jsonschema 4.26.0`, stdlib `importlib`, `watchdog 6.0.0`.

### Phase 8: Avatar Import + Catalog Auto-Extraction (recommended before Phase 7)
**Rationale:** Phase 7's variant/event parsers need catalogs to validate against. Largest phase in scope (1.5–2 weeks single engineer).
**Delivers:** `import_detect.py`, four extractors (VTS / Cubism w/exp / Cubism bare / OLVT), dedicated React route (NOT modal), `TetoOverrides` → `AvatarOverrides` rename, `_avatar_overrides.yaml` schema (jsonschema-validated), VTS introspection smoke-test, mandatory review screen with placeholder-density Save-disabled friction.
**Stack uses:** stdlib `json`, `pyyaml`, `jsonschema`.

### Phase 7: Three-Category Code Parsing + Dispatch
**Rationale:** Catalogs from Phase 8 are inputs; default plugin from Phase 6 is the action-code consumer. Least parallelizable phase.
**Delivers:** `code_extractor` replacing `actions_extractor`, three-category sentence-buffer parser, reserved-name guard sweep, variant policy decision (recommended: radio-button single-active), event auto-completion via `motion3.json` `Meta.Duration` + 1s blend pad, hardcoded 10s ceiling fallback.

### Phase 9: Slider HUD + Per-Param Lock
**Rationale:** Depends on plugin output (Phase 6) for compositor merge with lock filter; HUD perf testing requires the integrated system.
**Delivers:** `compositor/hud_tap.py` (15 Hz gate + fanout), separate WS endpoint `/hud/ws`, `LockState: dict[str, float]` in compositor merge, lipsync exception override on `MouthOpenY`, dedicated React route, optimistic lock on drag, override-badge UX, bulk introspection.
**Stack uses:** existing FastAPI WebSocket, electron-store for HUD position.

### Phase 10: Cursor Rewrite + §14 SC Verification
**Rationale:** Final phase. Smallest in code (~30 LOC) but largest in verification ceremony (six §14 SCs re-run with side-by-side tolerance against milestone-1 baselines).
**Delivers:** `cursor_driver.py` adjustments, `vts/window_detect.py` primary-monitor fallback, DPI-awareness bootstrap, side-by-side §14 SC comparison harness.
**Stack uses:** `pywin32` (already pinned), `pynput` (cross-platform fallback only).

### Phase Ordering Rationale

- **Hard dependencies:** Phase 6 → all (plugin contracts cascade); Phase 8 → Phase 7 (catalogs feed parsers); Phase 6 + 7 + 8 → Phase 9 (HUD lock-aware merge depends on plugin output); All → Phase 10 (verification re-run by definition last).
- **Recommended order 6 → 8 → 7 → 9 → 10** honors the gating-language interpretation. **Flag for user/roadmapper decision** which to follow.
- **Cross-phase parallelism:** Phase 8 UI design starts during Phase 6; Phase 9 HUD UI design starts during Phase 7; Phase 10 cursor changes can land during Phase 9.
- **Phase 6 is pitfall-heavy** — recommend a plumbing-week sub-phase that lands ABC + manifest + supervisor + clamp + rate-limiter before debugging default-plugin behavior.
- **Phase 8 is the largest scope** (1.5–2 weeks).
- **Phase 10 is small in code but heavy in verification ceremony.**

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 6:** Reserved-name list completeness sweep (Anthropic + Gemini + o-series sentinels); `RigCapabilities` contract design (shared with Phase 9); plugin API versioning policy.
- **Phase 7:** Variant collision policy (radio-button vs additive vs grouped) — recommended radio-button.
- **Phase 8:** OLVT `model_dict.json` schema commit-pin; VTS introspection smoke-test against actual Teto rig; real-rig sample collection (5+ community rigs).
- **Phase 9:** HUD throttle benchmark (15 Hz vs 30 Hz); window behavior (recommended floating + always-on-top).

**Phases with standard patterns (skip research-phase):**
- **Phase 10:** Cursor sensor work — Phase 4 already implemented design; Win32 GetCursorPos + DPI awareness is well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All net-new deps verified via PyPI on 2026-05-08; milestone-1 stack locked. |
| Features | HIGH | Cubism file-format invariants verified against `CubismSpecs`; plugin pattern ecosystem-consensus consistent. |
| Architecture | HIGH | Integration points verified against actual repo files. MEDIUM on HUD path choice and phase ordering. |
| Pitfalls | HIGH | §14B-explicit risks + milestone-1 cross-checks + Python issue tracker + Win32 docs all verified. |

**Overall confidence:** HIGH

### Gaps to Address

- **Phase ordering decision** (table 6→7→8→9→10 vs gating-derived 6→8→7→9→10) — flag explicitly for roadmapper.
- **Reserved-name guard list completeness** — sweep at Phase 7 plan-phase.
- **VTS introspection smoke-test** is a Phase 8 prereq; pyvts 0.3.3 is aged.
- **`RigCapabilities` contract shape** is shared by Phase 6 and Phase 9; design needed in Phase 6 plan.
- **§14 SC tolerance bands** for Phase 10 re-run are sane defaults; tune when baselines are recorded.

## Sources

### Primary (HIGH)
- `PROJECT_DESIGN.md` §14B.1–14B.9, §15 R-19, §5.3.1, §11
- `.planning/research/PITFALLS.md` (milestone-1) — carry-over reference
- `.planning/PROJECT.md`
- [Live2D CubismSpecs/FileFormats](https://github.com/Live2D/CubismSpecs) — model3/motion3/exp3 canonical
- [DenchiSoft/VTubeStudio repo + wiki](https://github.com/DenchiSoft/VTubeStudio) — VTS API + `.vtube.json` + Cubism 5.3 status
- PyPI: jsonschema 4.26.0, pynput 1.8.1, watchdog 6.0.0, pywin32 311, PyYAML 6.0.3
- [Win32 GetCursorPos / DPI Awareness — Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcursorpos)
- [Python issues #41229, #15635, #17468 — async generator memory leak](https://bugs.python.org/issue41229)
- [napari Manifest](https://napari.org/stable/plugins/contributions.html), [VSCode Contribution Points](https://code.visualstudio.com/api/references/contribution-points), [Home Assistant Manifest](https://developers.home-assistant.io/docs/creating_integration_manifest/), [stevedore](https://docs.openstack.org/stevedore/latest/), [OBS Plugins](https://docs.obsproject.com/plugins)
- [PyPA Entry points](https://packaging.python.org/en/latest/specifications/entry-points/) — confirms wrong-shape rationale

### Secondary (MEDIUM)
- [Hex Shift — WebSocket backpressure in FastAPI](https://hexshift.medium.com/managing-websocket-backpressure-in-fastapi-applications-893c049017d4)
- [Pierce Freeman — Python hot reloading misadventures](https://pierce.dev/notes/misadventures-in-python-hot-reloading)
- Tweakpane, Leva (pmndrs), Theatric, Godot Remote Scene Tree — slider-HUD genre map
- [pyautogui issue #663](https://github.com/asweigart/pyautogui/issues/663) — DPI on import

### Tertiary (LOW)
- Token-boundary BPE behavior for `{}`/`[]`/`<>` (generalizes from M1#5; specific tokenizers may differ).
- HUD perf threshold (50ms p95) — sane default.
- Variant collision-policy recommendation (radio-button) — argument-based.
- §14 SC re-run tolerance bands — tune when baselines land.
- `cdi3.json` "often missing" — ecosystem inference; validate at Phase 8.

---
*Research completed: 2026-05-08*
*Ready for roadmap: yes*
