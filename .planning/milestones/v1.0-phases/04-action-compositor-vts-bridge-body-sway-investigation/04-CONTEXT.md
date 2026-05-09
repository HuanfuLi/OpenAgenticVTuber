# Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the §14 walking-skeleton headline. With VTube Studio running and Teto loaded, the avatar:

1. Idles continuously with visible micro-motion when no one is talking (head + eye-gaze Perlin drift, randomized blinks 2–6s with occasional double-blink, breathing if `Auto Breath` is writeable).
2. Speaks with synced lipsync via `ParamMouthOpenY` driven by Phase 3's `compositor_speech_queue` (real RMS — no stub).
3. Sways during TTS playback through one of two investigated strategies (`proxy_param` against `Lean Forward` and similar; `exp3_modulation` modulating an `.exp3.json` body-pose's strength by RMS) OR head-only with documented rationale + breathing/micro-shoulder layered as alternative liveliness.
4. Smoothly blends `[joy]`/etc. via `mode:"set"` + `weight` fade — ease-out cubic 300ms in, hold for sentence duration, ease-out cubic ~600ms out (NOT a hotkey pop).
5. Tracks the cursor over the VTS canvas region (sidecar Win32-poll-driven window-bounds detection); eases back with cubic 800ms when cursor leaves; honors an 80px dead-zone around face center.
6. Demonstrates the rare-discrete-trigger contract via one VTS hotkey fired through `HotkeyTriggerRequest` (target picked by planner from 04-00 smoke-pass output).
7. With an active webcam feed in VTS, ambient + speech contributions remain visible (proves `mode:"add"` for those layers).

The body-sway investigation IS the deliverable. Either a strategy ships with visible body sway OR head-only ships with breathing/micro-shoulder + a per-strategy investigation report (short video + RMS-vs-param plot + qualitative rating, committed under `.planning/skeleton-verification.md` per Phase 5 SC-01).

Out of this phase: real piper TTS internals (Phase 3), §14 verification document write-up (Phase 5), contracts codegen replacement (Phase 5), agent runtime, scheduler, skills, multi-thread/multi-avatar, voice input, pet mode (all later milestones).

</domain>

<decisions>
## Implementation Decisions

### Body-sway strategy slate (R-OPEN-1) — AVT-06

- **D-01: Strategy registry has three entries — `proxy_param`, `exp3_modulation`, `head_only`.** The two non-fallback strategies satisfy AVT-06's ≥2 minimum. `physics_chain` is **dropped** entirely because memory `project_unsolved_body_sway` already proves it failed on Teto via the OLVT IN-twin trick — running it as runnable evidence is rejected; the prior-attempt history is the evidence.
- **D-02: Head-only fallback flavor = head sway + breathing (`Auto Breath` if writeable) + micro-shoulder if any shoulder-region param accepts writes.** `head_only` is rarely literally head — when smoke-pass finds breathing or shoulder slots, layer subtle motion there for Neuro-sama-style liveliness. This is the visible default if both `proxy_param` and `exp3_modulation` fail to produce visible motion.
- **D-03: Strategy selection at boot = hardcoded compositor default (`head_only`) + per-rig override in `avatars/teto/teto_overrides.yaml`.** Aligns with the project rule (memory `project_capabilities_from_introspection`): `avatar.yaml` is for VTS-introspectable capabilities; `teto_overrides.yaml` is for engineer-determined deviations. Body-sway strategy is engineer-chosen, not VTS-discoverable, so it lives in overrides. Schema:
  ```yaml
  # avatars/teto/teto_overrides.yaml (engineer-curated)
  body_sway_strategy: proxy_param  # one of: head_only | proxy_param | exp3_modulation
  proxy_body_param: Lean Forward   # populated by 04-00 smoke-pass when proxy_param strategy is viable
  exp3_body_pose: null              # path to a body-tilt .exp3.json if exp3_modulation strategy is viable
  ```
- **D-04: Per-strategy investigation evidence = short video clip + RMS-vs-param-output plot + qualitative rating.** For each strategy attempted: (a) 5–10s screen recording of Teto playing TTS with strategy active; (b) matplotlib plot of input RMS time-series vs. strategy's chosen body-param output time-series; (c) one-paragraph rating (visible? coupled to speech? acceptable?). All three artifacts cited from the investigation report committed under `.planning/skeleton-verification.md` (Phase 5 SC-01 deliverable). Phase 4 produces the artifacts; Phase 5 references them.
- **D-05: 04-00 smoke-pass priority body-sway-candidate parameters = `Lean Forward` + `Auto Breath` (Teto-specific, found via inspection of `Live2D/重音テト/重音テト.vtube.json`).** Lean Forward (line 409) is a tilt-style parameter — the most likely `proxy_param` target. Auto Breath (line 217) is the breathing parameter the head-only fallback wants. Smoke-pass tests writes to both specifically AND scans the full parameter list via `InputParameterListRequest` for completeness. Records visible-vs-orphan status into `teto_overrides.yaml`.

### Avatar look (idle + intent decay) — AVT-02, AVT-08

- **D-06: Idle baseline driver writes Perlin drift on head + eye-gaze + breathing (if writeable).** Concrete:
  - Head: `ParamAngleX/Y/Z` Perlin drift, ~5° amplitude, octave count + frequency tunable.
  - Eye-gaze: `ParamEyeBallX/Y` Perlin drift, ~3° amplitude (less so the avatar does not appear to constantly stare at random points).
  - Breathing: `Auto Breath` (named per Teto's `vtube.json` parameter mapping) sine wave at ~0.25 Hz if writeable; skip if smoke-pass shows it's read-only or absent.
  - Blink scheduler: random uniform interval 2.0–6.0s; ~10% chance of immediate second blink (double-blink); each blink ~150ms close + ~80ms open via `ParamEyeLOpen/ParamEyeROpen`.
- **D-07: Blink cadence — random uniform 2–6s + 10% double-blink heuristic.** Mimics natural human variability without a rigid scheduler. Implementation: after each blink completes, schedule the next via `next_blink_at = now + uniform(2.0, 6.0)`; on each blink completion, with probability 0.1, schedule a second blink ~250ms after the first.
- **D-08: Intent overlay (e.g. `[joy]`) decay curve — ease-out cubic 300ms in, hold for sentence duration, ease-out cubic ~600ms out.** Decay starts at sentence-end (the per-sentence boundary the orchestrator already emits via `sentence_id` and `chain-end` infrastructure), NOT at chain-end (which would hold expression-face for an entire 5-sentence turn). Trigger fires at sentence-start; weight ramps 0 → 1 over 300ms via cubic ease-out; holds at 1 for the remainder of the sentence's audio playback; ramps 1 → 0 over 600ms via cubic ease-out at sentence-end.
  - **Per-sentence specificity preserved:** each sentence's `ActionIntent`s are independent. If sentence 1 has `[joy]` and sentence 2 has `[shy]`, joy decays as shy ramps in; the compositor handles the cross-fade via `mode:"set"` + `weight` per AVT-03.
  - **`mode:"set"` per AVT-03 invariant:** intent overlays are the only `mode:"set"` driver; ambient idle and speech driver use `mode:"add"`.

### Cursor tracker + DiscreteEvent — AVT-09, AVT-10

- **D-09: VTS window-bounds detection = sidecar Win32 polling at ~250ms.** `pywin32`'s `FindWindow(class_name, title)` discovers the VTS window once at sidecar boot; `GetWindowRect` re-queries every ~250ms in case the user moves/resizes VTS. Cursor position from `GetCursorPos`. Sidecar feeds the (cursor_x, cursor_y, vts_rect) tuple into the cursor tracker driver. **No renderer involvement on the hot path** — preserves the AVT-01 invariant (sidecar→VTS direct; renderer never carries 60Hz traffic). Renderer only handles the chrome shell.
- **D-10: Cursor tracking responsiveness — 60Hz native + cubic 800ms ease-back + 80px dead-zone around face center.** Polled at the same 60Hz as the compositor (no separate cursor task). When cursor exits the canvas region, `ParamAngleX/Y` (head) and `ParamEyeBallX/Y` (eye gaze) ease back to neutral via cubic ease-out over 800ms. Inside an 80px radius around model face center (face-center coordinates derived from VTS API's `ModelInfo` or hardcoded as fraction of window height — planner picks), no tracking applies (avoids cross-eyed look).
  - **Avatar-to-canvas mapping math is planner territory** — derive cursor → ParamAngle deflection from VTS window bounds + canvas center.
- **D-11 (Claude's discretion): DiscreteEvent demo target — planner picks first non-meta hotkey from 04-00 smoke-pass output.** Teto rig has 15 hotkeys configured in `重音テト.vtube.json`, all `ToggleExpression`-type, mapping 1:1 to expression files. 13 are non-meta; 2 are meta (`Remove All Toggles`, `Remove Water Mark`). Planner picks any non-meta entry — `Star Eye [7]`, `Heart Eye [6]`, `【Chibi】[Q]` etc. all valid. The demo's job is to exercise the `HotkeyTriggerRequest` API path; the visible result happens to mirror an expression activation.
  - **04-00 smoke-pass populates `avatars/teto/avatar.yaml`'s `hotkeys` list** via `HotkeysInCurrentModelRequest` (currently empty due to incomplete prior curation — operator only enumerated `.exp3.json` files; hotkeys live separately in VTS `.vtube.json`). Operator marks the 2 meta hotkeys with `is_meta: true` (or `llm_emittable: false`) in `teto_overrides.yaml`'s exclusion list.

### Strategy hot-switchability — investigation tooling

- **D-12: Body-sway strategy is live-switchable from a renderer dev-panel during the investigation phase.** Adds a "Body-sway strategy" radio control to the existing `apps/renderer/src/dev/DevPanel.jsx` (Phase 1 ported). Selection sends a WS control envelope (`{type:"control", text:"set-body-sway-strategy:proxy_param"}` or similar — planner names the message); sidecar's compositor swaps the active strategy at the next compositor tick. Same TTS audio plays through different strategies for direct A/B comparison — dramatically improves the per-strategy evidence (D-04). Estimated ~50 LOC across renderer + sidecar.
  - **Production gating:** dev-panel control is gated by `import.meta.env.DEV` (Phase 1 prototype already uses this pattern). When v1 ships, the switch disappears; production reads the strategy from `teto_overrides.yaml` and config-locks it.

### Claude's Discretion

The planner/researcher resolves these with documented defaults:

- **DiscreteEvent demo target (D-11):** any non-meta hotkey from 04-00 smoke-pass output. Recommend `Star Eye [7]` for visual punch; planner can swap.
- **Compositor scheduler internals:** asyncio `loop.call_later` vs `asyncio.sleep` based loop, jitter handling, single global compositor task vs per-driver tasks. Planner picks; 60Hz target with ≤2ms jitter is the implicit success bar.
- **Driver merge math + precedence:** AVT-03 locks the additive-vs-set semantics; planner specifies the per-tick merge order (idle → speech → intent → cursor-tracker, or a different ordering if needed for AVT-03 conformance) and the per-param accumulator pattern.
- **VTS unavailable / auth-prompt failure UX:** boot sequence when (a) VTS isn't running, (b) running but VTS API disabled in Settings, (c) running but auth pop-up unhandled. Planner designs the banner copy + retry flow + log emissions. Defaults: non-blocking renderer toast on VTS unreachable; sidecar logs all failure modes; auto-retry every 5s until VTS connects.
- **Boot sequence + VTS handshake timing:** when does sidecar handshake with VTS — at sidecar boot (eager) vs lazy on first compositor tick (deferred until needed)? Planner picks. Eager wins for clearer boot-time error reporting; lazy wins for VTS-not-running tolerance.
- **Per-strategy investigation timebox:** how long does 04-02 spend on each strategy before declaring failure? Planner suggests 1–2 dev-day per strategy; investigation report documents actual time spent. Failure mode for the deliverable: if both `proxy_param` and `exp3_modulation` fail visibly within their timebox, head-only ships and the report explains.
- **Test framework without real VTS:** unit-testing a 60Hz compositor with no VTS available. Planner picks: mock pyvts (simplest), capture-and-compare frame sequences (more rigorous), or skip-with-rationale (if the integration tests at 04-03/04-04 cover it). Defaults: mock pyvts at unit level; integration test happens against running VTS as the §14 verification.
- **Avatar-to-canvas mapping math (D-10 follow-up):** cursor → ParamAngle deflection formula. Default: linear with clamp at canvas edges, dead-zone radius hardcoded at 80px center. Planner refines.
- **Compositor `sentence_id` correlation:** Phase 3's `compositor_speech_queue` carries `sentence_id`; intent decay (D-08) needs to know which sentence's audio just ended. Planner specifies the correlation contract (probably an `audio-complete` signal published by `TTSTaskManager` carrying `sentence_id`).

### Folded Todos

None — `gsd-tools todo match-phase 4` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Live2D rig artifacts (ground-truth for the Teto rig)

- `Live2D/重音テト/重音テト.vtube.json` (2085 lines) — VTS-specific config for Teto. Lines 73–409 contain the Parameters mapping (head Z/X/Y, Eye Open Left/Right, Auto Breath at 217, **Lean Forward at 409**, etc.). Lines 424+ contain the Hotkeys[] array — 15 entries, all `ToggleExpression`-type, mapping 1:1 with expression files. **Operator MUST consult this file when populating teto_overrides.yaml's discovered_hotkeys section** rather than re-enumerating from the file system alone (the empty `hotkeys: []` curation in `avatars/teto/avatar.yaml` reflects an operator who skipped this file).
- `Live2D/重音テト/重音テト.physics3.json` (19,666 lines) — Teto's physics chain config. The OLVT IN-twin physics-chain trick failed on Teto (memory: `project_unsolved_body_sway`); read this if `proxy_param` and `exp3_modulation` strategies both fail and the planner reconsiders physics-chain authoring as a last-resort approach.
- `Live2D/重音テト/Expressions/*.exp3.json` (15 files) — body-pose / face-override expressions. The `exp3_modulation` strategy may target one of these for RMS-driven body tilt; smoke-pass identifies candidates.
- `Live2D/重音テト/Motions/*.motion3.json` (IDLE, Sleep) — animation files. Currently no `TriggerAnimation` hotkeys reference these in `vtube.json`; potentially relevant for the v2 idle-animation milestone.

### Project-level specs (decision authority)

- `PROJECT_DESIGN.md` §5.2 — Action compositor architecture (3-driver model, 60Hz `ParamFrame` stream, additive vs set merge semantics).
- `PROJECT_DESIGN.md` §5.3 — Action vocabulary (LLM-emittable tag list, kind classification).
- `PROJECT_DESIGN.md` §5.3.1 — VTS rig architecture realities. **The IN-twin physics-chain trick documented here is the failed attempt that motivates R-OPEN-1; treat as background, not as a proven pattern** (memory: `feedback_design_doc_attempts`).
- `PROJECT_DESIGN.md` §11 — Live2D rendering via VTS+pyvts; renderer-portability hedge to Pixi (post-MVP exploratory only per `.planning/PROJECT.md`).
- `PROJECT_DESIGN.md` §13.123 — Default shipping avatar = Live2D Inc. sample; Teto is dev-only.
- `PROJECT_DESIGN.md` §14 success criteria #1 (idle micro-motion), #2 (`[joy]` smooth blend = THE headline demo), #4 (speech-driven body OR head sway), #5 (cursor tracking).
- `.planning/PROJECT.md` Risks — R-OPEN-1 (body-sway-during-TTS unsolved on VTS rigs); R-OPEN-2 (VTS-only renderer locks out future mobile, accepted).
- `.planning/REQUIREMENTS.md` AVT-01 through AVT-10 — Phase 4's full requirement set.
- `.planning/ROADMAP.md` Phase 4 (lines 79–104) — phase goal, six success criteria, plan structure (04-00 entry gate, 04-01 pyvts wrapper, 04-02 compositor + body-sway, 04-03 cursor tracker + DiscreteEvent), open questions.

### Phase 1 + 2 + 3 carry-forward

- `.planning/phases/01-plumbing-process-lifecycle/01-CONTEXT.md`:
  - **D-01..D-05** — pyvts vendoring (Phase 4 exercises the vendored pyvts via the single-writer wrapper).
  - **D-11** — cursor-in-canvas tracking is OS-level cursor + VTS window bounds detection, **no transparent overlay window**. Phase 4 inherits.
  - **D-22** — chrome shell scope (Phase 4 cursor tracker does NOT change chrome).
- `.planning/phases/02-conversation-pipeline/02-CONTEXT.md`:
  - **D-07, D-08** — `avatars/teto/avatar.yaml` schema (capabilities + voice + entrance). Phase 4's `teto_overrides.yaml` is the engineer-deviation file (per memory: `project_capabilities_from_introspection`); the `body_sway_strategy` field lives there, NOT in `avatar.yaml`.
  - **D-11** — `compositor_intent_queue: asyncio.Queue` already exposed by orchestrator. Phase 4's intent overlay driver consumes from it.
  - **D-12, D-13** — `ActionIntent` shape + tag→kind classification. Phase 4's compositor pattern-matches on `kind` to route to idle/speech/intent/cursor drivers.
  - **D-19** — orchestrator KV-cache discipline. Phase 4 must NOT regress (compositor never touches `_memory`).
- `.planning/phases/03-tts-sentence-buffered-audio/03-CONTEXT.md`:
  - **D-01, D-02** — sidecar-side audio playback via `sounddevice`. Phase 4 does NOT introduce renderer-side audio.
  - **D-04** — linear interpolation between adjacent `volumes[i]` / `volumes[i+1]` for `ParamMouthOpenY`. Phase 4's speech driver implements the consume side: `t = ((now() - started_at) * 1000 % slice_length) / slice_length; mouth = volumes[i] * (1 - t) + volumes[i+1] * t`.
  - **D-05** — `compositor_speech_queue: asyncio.Queue[SpeechEnvelopePayload]`. Phase 4's speech driver consumes from it. Phase 3's no-op drainer is replaced by the real driver.
  - **D-13** — `sentence_id` is the cross-envelope correlation key. Phase 4's intent decay (D-08) uses it to bind to the right sentence.
  - **D-14** — `chain-end` fires after audio-complete. Phase 4's speech driver decays after this signal; intent decay starts at sentence-end (per-sentence) NOT at chain-end (per-turn).

### OLVT source (port reference where applicable)

The OLVT sibling project at `C:/Users/16079/Code/OpenLLM_Vtuber/` is consulted but mostly NOT directly ported in Phase 4 — the action compositor is Phase 4's UNIQUE VALUE-ADD per PROJECT_DESIGN §1.4. Specifically:

- OLVT's IN-twin physics-chain trick (referenced in PROJECT_DESIGN §5.3.1) failed on Teto and is NOT ported. Memory: `project_unsolved_body_sway`.
- OLVT's expression activation pattern (`live2d_model.py:170–185, 209–236`) was already adapted in Phase 2's `actions_extractor`; Phase 4 consumes the resulting `ActionIntent`s.
- OLVT does NOT have a 60Hz multi-driver compositor — that's our differentiator (PROJECT_DESIGN §1.4 differentiator #2). No verbatim port available.

### Research outputs

- `.planning/research/PITFALLS.md` — pyvts open issue #51 (`recv()` race during concurrent `asyncio.gather`) — AVT-04 single-writer task pattern is the mitigation.
- `.planning/research/ARCHITECTURE.md` — sidecar→VTS direct for `param-frame` traffic (NOT through renderer); compositor in sidecar, not Electron.
- `.planning/research/STACK.md` — pyvts 0.3.3 (vendored, dormant upstream); pywin32 for Win32 APIs.

### Convention / config

- `CLAUDE.md` (project root) — locked stack table; cursor-poll via Win32 acceptable; no PyAutoGUI for compositor work.
- `.planning/STATE.md` — current phase position, blockers/concerns, open risks.

### External (no in-repo path — paste URL in plans)

- VTube Studio API spec (`HotkeysInCurrentModelRequest`, `HotkeyTriggerRequest`, `ExpressionStateRequest`, `ExpressionActivationRequest`, `InputParameterListRequest`, `InjectParameterDataRequest`, `ParameterValue.mode` semantics): https://github.com/DenchiSoft/VTubeStudio
- pyvts upstream (vendored at `sidecar/vendor/pyvts/`): https://github.com/Genteki/pyvts
- pywin32 (FindWindow + GetWindowRect): https://timgolden.me.uk/pywin32-docs/
- Live2D Cubism `.vtube.json` schema: https://github.com/DenchiSoft/VTubeStudio/wiki
- Live2D Cubism `.exp3.json` (Expression3) schema: https://docs.live2d.com/en/cubism-editor-manual/expressions/
- Live2D Cubism `.physics3.json` schema: https://docs.live2d.com/en/cubism-editor-manual/physics/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (from Phases 1 + 2 + 3 + OLVT)

- **`sidecar/vendor/pyvts/`** (Phase 1 D-01..D-05) — vendored pyvts 0.3.3. Phase 4 first exercises it. AVT-04's single-writer asyncio task pattern wraps it; in-tree patches go to vendor with PROVENANCE.md updates.
- **`apps/sidecar/src/sidecar/orchestrator/orchestrator.py`** (Phase 2) — owns `compositor_intent_queue`. Phase 4 consumes; orchestrator's lifecycle stays unchanged.
- **`apps/sidecar/src/sidecar/orchestrator/orchestrator.py`** (Phase 3 amends) — owns `compositor_speech_queue`. Phase 4 consumes; the no-op drainer Phase 3 ships gets replaced by the real speech driver.
- **`apps/sidecar/src/sidecar/avatar/capabilities.py`** (Phase 2) — `AvatarCapabilities` loader reads `avatars/teto/avatar.yaml`. Phase 4 ADDS a sibling loader for `teto_overrides.yaml` (engineer-deviation file per AVT-07 + memory rule). The two loaders compose: `avatar.yaml` provides VTS-introspectable defaults; `teto_overrides.yaml` overrides specific fields (`body_sway_strategy`, `proxy_body_param`, `exp3_body_pose`, `discovered_hotkeys`, etc.).
- **`packages/contracts/py/contracts/`** (Phase 1 + 2 + 3) — Pydantic source-of-truth. Phase 4 ADDS `param_frame.py` (compositor's emit unit, NOT a WS message), `discrete_event.py` (rare-trigger payload), `body_sway_strategy.py` (literal-union enum). Hand-mirrored TS lands too (codegen replaces in Phase 5).
- **`apps/renderer/src/dev/DevPanel.jsx`** (Phase 1 D-24) — already in renderer. Phase 4 adds a "Body-sway strategy" radio (D-12) gated by `import.meta.env.DEV`.

### Established Patterns (from Phase 1 + 2 + 3)

- **Vendor + PROVENANCE.md pattern** (Phase 1 D-01..D-04). Phase 4 patches to pyvts (in-tree) update `sidecar/vendor/pyvts/PROVENANCE.md`.
- **Pub-sub via `asyncio.Queue`** (Phase 2 D-11, Phase 3 D-05). Phase 4 is the consumer of two queues; does NOT introduce a new queue (compositor pushes directly to pyvts via the single-writer wrapper).
- **WS envelope dispatch** (Phase 1 + 2). Phase 4 ADDS one new client→server `control` text variant (`set-body-sway-strategy:<name>` per D-12); no new server→client envelope variants (compositor → pyvts traffic is sidecar-internal).
- **Loguru log channel** (Phase 1 + 2 + 3). Phase 4 emits `[COMPOSITOR]` lines (60Hz tick rate; planner decides log-level filtering — likely DEBUG with default-INFO settings to avoid swamping the Logs drawer at 60Hz). `[SPEECH-DRIVER strategy=X param=Y value=Z rms=W]` lines are the per-strategy investigation evidence per D-04.

### Integration Points

- **Compositor → pyvts single-writer wrapper:** the wrapper owns the WS connection to VTS. Compositor's per-tick batched `InjectParameterDataRequest` is the dominant write path; `HotkeyTriggerRequest` (AVT-09) is a one-off via the same writer.
- **Sidecar → cursor tracker:** Phase 4 ADDS `apps/sidecar/src/sidecar/compositor/cursor_tracker.py` polling Win32 every ~250ms via pywin32. Pushes `(cursor_x, cursor_y, vts_rect)` tuples into a small ring buffer the compositor reads each tick.
- **Compositor → orchestrator (for chain-end signal):** orchestrator already emits `chain-end` to WS (Phase 2 D-04). Phase 4 needs the same signal sidecar-internally for intent decay timing — planner adds an in-process publish (could be a third asyncio.Queue or a callback).
- **Avatar capabilities + overrides loader integration:** at sidecar boot, capabilities loader reads `avatars/teto/avatar.yaml` (VTS-introspected defaults) and `avatars/teto/teto_overrides.yaml` (engineer deviations) and produces a merged `AvatarCapabilities + TetoOverrides` view that compositor reads for strategy selection (D-03), priority body-sway params (D-05), discovered hotkeys (D-11), etc.

### Greenfield additions (Phase 4 creates)

- **`apps/sidecar/src/sidecar/compositor/`** — new module:
  - `__init__.py`
  - `compositor.py` — main 60Hz tick loop + driver merge logic per AVT-02 + AVT-03.
  - `idle_driver.py` — Perlin head/eye-gaze drift + blink scheduler + breathing per D-06, D-07.
  - `speech_driver.py` — `compositor_speech_queue` consumer, lipsync (consume side of Phase 3 D-04), body-sway strategy dispatch.
  - `intent_driver.py` — `compositor_intent_queue` consumer, ease-out cubic per D-08.
  - `cursor_driver.py` — Win32 cursor poll + VTS window bounds + dead-zone math per D-09, D-10.
  - `body_sway/` — strategy registry:
    - `head_only.py`, `proxy_param.py`, `exp3_modulation.py`
    - `registry.py` — strategy lookup at boot per D-03.
  - `param_id_resolver.py` — AVT-05 ~30 LOC (VTS-path writes input-layer names; non-VTS branch raises `NotImplementedError`).
- **`apps/sidecar/src/sidecar/vts/`** — new module:
  - `pyvts_writer.py` — single-writer asyncio task per AVT-04 (issue #51 mitigation); owns the pyvts WS.
  - `discrete_dispatcher.py` — `HotkeyTriggerRequest`-driven discrete events per AVT-09.
  - `window_detect.py` — Win32 polling per D-09.
- **`apps/sidecar/src/sidecar/avatar/overrides.py`** — `TetoOverrides` Pydantic loader for `avatars/teto/teto_overrides.yaml`.
- **`avatars/teto/teto_overrides.yaml`** — actual engineer-curated file, populated by 04-00 smoke-pass + manual annotation. Per AVT-07 schema (orphan params, physics-chain proxies, sign inversions) + Phase 4 D-03 schema (body_sway_strategy, proxy_body_param, exp3_body_pose, discovered_hotkeys, is_meta exclusions).
- **`packages/contracts/py/contracts/param_frame.py`** + `body_sway_strategy.py` + `discrete_event.py` (Pydantic) + matching hand-mirrored TS in `packages/contracts/ts/`.
- **`apps/renderer/src/dev/DevPanel.jsx`** — body-sway strategy radio (D-12 dev-panel switch).
- **Phase 4 deps in `sidecar/pyproject.toml`:** `pywin32` (Windows-only conditional dep — `pywin32 ; sys_platform == "win32"`); `numpy` (already pulled by Phase 3 RMS path) for Perlin / interpolation math; potentially `noise` package for Perlin (~1 KB; planner picks vs. hand-rolled).

</code_context>

<specifics>
## Specific Ideas

- **Body-sway investigation IS the deliverable** (memory: `project_unsolved_body_sway`). The user has prior history with this exact problem from OLVT — the IN-twin physics-chain trick documented in PROJECT_DESIGN §5.3.1 was attempted and did NOT produce visible body sway on Teto. Phase 4 does NOT inherit the OLVT trick as a working pattern; it treats the problem as fresh research with `proxy_param` and `exp3_modulation` as the two attempted strategies. The investigation report (per D-04) is part of the §14 verification (Phase 5 SC-01).
- **`Lean Forward` is THE concrete proxy_param candidate** (verified at `Live2D/重音テト/重音テト.vtube.json:409`). Smoke-pass tests it specifically; if writes produce visible motion, `proxy_param` strategy ships with this as its target. If `Lean Forward` is an orphan (face-tracker-controlled, our writes don't stick), the strategy falls through to `exp3_modulation`.
- **The `avatar.yaml` `hotkeys: []` was an incomplete curation, not an absence of hotkeys** (memory: `project_capabilities_from_introspection`). The operator only enumerated `.exp3.json` files; hotkeys live separately in `vtube.json`'s `Hotkeys[]` array (line 424+). Teto actually has 15 hotkeys, all `ToggleExpression`-type. 04-00 smoke-pass MUST read `vtube.json` (or use VTS API's `HotkeysInCurrentModelRequest`) to populate the list — file system enumeration alone is insufficient.
- **OLVT-port preference defers** here (memory: `feedback_olvt_port_preference`) because OLVT does NOT have a 60Hz multi-driver compositor — that is Phase 4's UNIQUE VALUE-ADD per PROJECT_DESIGN §1.4. Some shape (e.g., Phase 2's actions_extractor + tts_filter chain) was already ported in earlier phases; Phase 4 originates the compositor design.
- **Live-switchable body-sway dev-panel control** (D-12) materially improves the per-strategy investigation evidence (D-04). A/B comparing strategies on the SAME TTS audio (rather than across separate sidecar boots) gives the investigation report's video clips a stronger comparative basis.
- **The Teto rig has substantial physics config** (`physics3.json` 19,666 lines). The OLVT IN-twin trick may have failed for IN-twin-specific reasons rather than because Teto lacks physics. If both `proxy_param` and `exp3_modulation` fail visibly within their timebox, planner can reconsider physics-chain authoring as a far-fallback (NOT ported from OLVT — original `<model>.vtube.json` editing).

</specifics>

<deferred>
## Deferred Ideas

- **`physics_chain` strategy with full IN-twin port from OLVT** — explicitly dropped from the registry per D-01. If both `proxy_param` and `exp3_modulation` fail, head-only ships and the report explains why physics-chain authoring was deemed not worth the timebox. Future milestone could revisit if a different rig exhibits IN-twin-friendly body params.
- **Renderer-side cursor + window-bounds detection** — explicitly dropped per D-09 in favor of sidecar-side Win32 polling (preserves AVT-01 invariant).
- **Mobile companion via Pixi-rendering** — R-OPEN-2 hedge. Post-MVP exploratory only per `.planning/PROJECT.md`. AVT-05's renderer-aware ParamID resolver pays the small forward-compat cost; non-VTS branch is a `NotImplementedError` stub.
- **Audio-to-params learned drivers** — PROJECT_DESIGN §5.6 v1.5 hint. Phase 4 ships rule-based DSP only (RMS-driven body sway). Learned drivers swap inside the compositor without touching Phase 4's contracts.
- **Multi-avatar compositor** — single-avatar in skeleton (always Teto). MULTI-01..04 territory. Compositor's strategy registry is per-rig; multi-avatar adds rig-routing logic.
- **Hit zones (`hitZones.json`) for click reactions on avatar regions** — UX-02 territory; Phase 4 does cursor tracking only, not click handling.
- **Per-avatar entrance motion** — UX-04 territory; Phase 4 ships continuous idle baseline only, no entrance ramp.
- **Compositor-driven goal-loop overlay** — agent runtime milestone; Phase 4 has no agent integration.
- **Pet mode click-through transparent window** — FORM-01 territory; Phase 4's cursor tracker assumes windowed VTS + windowed app, both visible.
- **Per-message reasoning-text expand chevron / "<think>" leak handling in compositor** — Phase 2 D-10 dropped reasoning capture entirely; Phase 4 inherits the no-think-tag stance.
- **`sentence_id`-correlated hard-stop interrupt of in-flight compositor speech driver** — Phase 3 D-09 is let-finish + queue. Phase 4 follows: compositor speech driver runs to completion of last `compositor_speech_queue` payload; no mid-sentence cancel.
- **Live debug-overlay HUD on the avatar canvas** (param values, RMS, strategy active) — useful for the investigation but renders on top of VTS which we don't control. Could land as a tiny unbranded transparent always-on-top window in dev builds. Defer; live dev panel (D-12) covers most A/B needs.

### Reviewed Todos (not folded)

None — todo cross-reference returned 0 matches.

</deferred>

---

*Phase: 04-action-compositor-vts-bridge-body-sway-investigation*
*Context gathered: 2026-05-07*
