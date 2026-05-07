# Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 04-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 04-action-compositor-vts-bridge-body-sway-investigation
**Areas discussed:** Body-sway strategy slate, Avatar look (idle + intent decay), Cursor tracker tuning + DiscreteEvent pick, Strategy hot-switchability for the investigation

---

## Body-Sway Strategy Slate (R-OPEN-1)

### Q1: Strategy slate

| Option | Description | Selected |
|--------|-------------|----------|
| proxy_param + exp3_modulation | Drops physics_chain entirely (memory: known-broken on Teto) | ✓ |
| proxy_param + exp3_modulation + physics_chain (runnable evidence) | Keeps physics_chain non-shipping for documentation | |
| exp3_modulation only + head_only fallback | If smoke-pass shows no proxy_param targets | |
| All four (proxy_param, exp3_modulation, physics_chain, head_only) in registry | Maximum optionality | |

**User's choice:** proxy_param + exp3_modulation (recommended)

### Q2: Head-only fallback flavor

| Option | Description | Selected |
|--------|-------------|----------|
| Head sway + breathing + micro-shoulder if any shoulder param writes | Layered Neuro-sama-style liveliness | ✓ |
| Head sway + scripted body-tilt animation (no RMS) | Decoupled body motion | |
| Head-only literally — minimal floor | Investigation report carries the rationale | |

**User's choice:** Head sway + breathing (Auto Breath if present) + micro-shoulder if any shoulder param writes (recommended)

### Q3: Strategy selection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Field in avatars/teto/avatar.yaml: voice.body_sway_strategy | Per-avatar config | |
| Hardcoded compositor default + override in teto_overrides.yaml | Aligns with capabilities-from-introspection memory rule | ✓ |
| Boot-time auto-select from smoke-pass output | Most automated; hardest to A/B | |

**User's choice:** Hardcoded compositor default + override in teto_overrides.yaml (Recommended)
**Notes:** First responded "What does this mean?" — re-asked with plain-English explanation; user then picked the recommended option once the trade-off was clearer.

### Q4: Investigation evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Per-strategy: video clip + RMS-vs-param plot + qualitative rating | Strongest evidence, A/B-comparable | ✓ |
| Per-strategy: log-only (loguru lines) | Minimal scope | |
| Holistic: one paragraph + one video at end | Smallest scope; only winning strategy shown | |

**User's choice:** Per-strategy: short video clip + RMS-vs-param-output plot + qualitative rating (recommended)

---

## Avatar Look (Idle + Intent Decay)

### Q5: Idle micro-motion params

| Option | Description | Selected |
|--------|-------------|----------|
| Head + eye gaze + blinks + breathing if available | Layered alive feel; Neuro-sama-style baseline | ✓ |
| Head sway + blinks only | Simpler, less visible motion | |
| Head + blinks + eye gaze (no breathing) | Skip breathing param | |

**User's choice:** Head + eye gaze + blinks + breathing if available (recommended)

### Q6: Blink cadence pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Random interval 2-6s + occasional double-blink | Natural human variability | ✓ |
| Strictly random uniform, no double-blink | Slightly less lifelike, simpler | |
| Fixed cadence — every 4s exactly | Deterministic; debug-only | |

**User's choice:** Random interval 2-6s + occasional double-blink (recommended)

### Q7: Intent overlay decay curve + trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Ease-out cubic 300ms in, hold for sentence, ease-out cubic ~600ms out, sentence-start trigger / sentence-end decay | Concrete numbers locked | ✓ |
| Linear 300ms in / 300ms out, no hold | Simpler, less natural | |
| Hold until chain-end, decay over ~500ms | Per-turn, loses per-sentence specificity | |

**User's choice:** Ease-out cubic over 300ms in, hold for sentence duration, ease-out cubic over ~600ms out (recommended)

---

## Cursor Tracker + DiscreteEvent

### Q8: VTS window bounds detection

| Option | Description | Selected |
|--------|-------------|----------|
| Sidecar polls Win32 every ~250ms via FindWindow + GetWindowRect | Preserves AVT-01 invariant; renderer not on hot path | ✓ |
| Renderer captures cursor + sidecar tracks VTS bounds, two-source merge | More moving parts; loses renderer-not-on-hot-path | |
| Renderer-only via Electron screen API | Puts cursor data on WS hot path; opposite of AVT-01 | |

**User's choice:** Sidecar polls Win32 every ~250ms via FindWindow + GetWindowRect (recommended)

### Q9: Cursor responsiveness

| Option | Description | Selected |
|--------|-------------|----------|
| 60Hz native + 800ms cubic ease-back + 80px dead-zone | Layered with compositor; natural feel | ✓ |
| 60Hz native + 500ms linear ease-back + no dead zone | Snappier; risk of cross-eyed look | |
| 30Hz cursor poll + 1.5s ease + 50px dead zone | Calm; risk of feeling laggy | |

**User's choice:** 60Hz native + ease-back over 800ms cubic + 80px dead-zone around face center (recommended)

### Q10 (initial): DiscreteEvent demo target

| Option | Description | Selected |
|--------|-------------|----------|
| Curate one Teto hotkey in VTS Settings, add to avatar.yaml | Operator one-time action | |
| Repurpose an expression as the discrete event | No operator action; slightly violates AVT-09 wording | |
| Use Hiyori for the demo | Different rig; complicates dev loop | |

**User's reply:** "No, Teto actually has hotkeys. For example, remove watermark has hotkey Ctrl+Shift+Alt"

**Action taken:** Investigated `Live2D/重音テト/重音テト.vtube.json` — discovered Teto has 15 hotkeys configured, all `ToggleExpression`-type, mapping 1:1 to expression files. Earlier `avatar.yaml` curation (hotkeys: []) was incomplete because it only enumerated expression files, not VTS hotkey config. Re-asked Q10 with corrected understanding.

### Q10 (re-asked): DiscreteEvent demo target — picking from real hotkey list

| Option | Description | Selected |
|--------|-------------|----------|
| Smoke-pass discovers; fallback to operator-creates-one if only meta hotkeys | Was already the case before re-investigation | |
| Smoke-pass discovers; fallback to expression-as-discrete-event | Backup if no usable hotkey | |
| Hand-curate hotkeys at the same time as expressions | Skip introspection for hotkeys | |

**User's reply:** "Please investigate the actual Teto model file first to get insights. Path: C:\Users\16079\Code\AgenticLLMVTuber\Live2D\重音テト"

**Action taken:** Performed grep on `重音テト.vtube.json` for Hotkeys array — confirmed 15 hotkeys all `ToggleExpression`, listed concretely with their key bindings (Star Eye [7], Heart Eye [6], Chibi [Q], Cry [W], Dizzy Eye [E], etc.). Also identified `Lean Forward` (line 409) and `Auto Breath` (line 217) as concrete body-sway candidate parameters. Re-asked Q10 once more with full ground-truth.

### Q10 (final re-ask): DiscreteEvent demo target — pick a specific hotkey

| Option | Description | Selected |
|--------|-------------|----------|
| Star Eye [7] — visually distinctive | Recommended | |
| Heart Eye [6] — visually distinctive | Personal taste | |
| 【Chibi】[Q] — most dramatic visual change | Wow-shot | |
| First non-meta from smoke-pass (whichever) | Most flexible | |

**User's reply:** "I still don't understand what does this question mean."

**Action taken:** Explained AVT-09 in plain language (continuous param stream pipe vs rare-fire-once trigger pipe); deferred the specific hotkey choice to Claude's discretion (planner picks from 04-00 smoke-pass output).

**Final outcome:** D-11 in CONTEXT.md is Claude's-discretion — planner picks any non-meta hotkey from 04-00 smoke-pass output as the demo target. Recommend `Star Eye [7]` for visual punch.

### Q11: Smoke-pass body-sway priority targets

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 04-00 smoke-pass tests Lean Forward + Auto Breath specifically | Concrete predicted-targets | ✓ |
| No — generic scan-all-params, no bias | Maximum coverage, no presumption | |
| Hybrid — scan-all + flag Lean Forward + Auto Breath in report | Pre-investigation hypotheses + full coverage | |

**User's choice:** Yes — 04-00 smoke-pass tests writes to Lean Forward + Auto Breath specifically (recommended)

---

## Strategy Hot-Switchability

### Q12: Live-switchable from dev panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Live-switchable from a dev panel | A/B same TTS audio; ~50 LOC across renderer + sidecar | ✓ |
| Config-locked — restart required to change | Cleaner architecture; slower iteration | |
| Live-switch only in DEV builds (production config-locked) | Best of both | |

**User's choice:** Live-switchable from a dev panel (Recommended for the investigation phase)
**Notes:** Implicit production-gating via `import.meta.env.DEV` is acceptable per Phase 1 prototype precedent — captured in CONTEXT.md D-12 as the implementation pattern.

---

## Claude's Discretion

The user explicitly deferred (or by inability-to-decide deferred) these to planner judgment:

- **DiscreteEvent demo target (Q10 final outcome)** — planner picks first non-meta hotkey from 04-00 smoke-pass output.
- **Compositor scheduler internals** — asyncio loop pattern, jitter handling.
- **Driver merge math + per-tick precedence ordering** — AVT-03 conformance; planner picks ordering.
- **VTS unavailable / auth-prompt failure UX** — banner copy, retry flow.
- **Boot sequence + VTS handshake timing** — eager vs lazy.
- **Per-strategy investigation timebox** — planner-suggested 1–2 dev-day per strategy.
- **Test framework without real VTS** — mock pyvts at unit level.
- **Avatar-to-canvas mapping math** — cursor → ParamAngle deflection formula.
- **Compositor `sentence_id` correlation contract** — for intent decay timing.

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Notable items:
- `physics_chain` strategy with full IN-twin port (memory: known-broken on Teto)
- Renderer-side cursor + window-bounds detection (loses AVT-01 invariant)
- Mobile-companion via Pixi-rendering (post-MVP)
- Audio-to-params learned drivers (v1.5)
- Hit zones, entrance motion, agent overlay, pet mode (other phases)
- Hard-stop interrupt of in-flight TTS (Phase 3 D-09 deferred this)
- Live debug-overlay HUD on canvas (would need transparent always-on-top window in dev builds)
