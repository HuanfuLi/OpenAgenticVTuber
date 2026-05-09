# Phase 6: Plugin Runtime + Default Plugin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 06-plugin-runtime-default-plugin
**Areas discussed:** [joy] baseline reconciliation, Plumbing-week split + scope, Default plugin scope, Loader plumbing details

---

## Gray Areas Selected

| Area | Description | Selected |
|------|-------------|----------|
| [joy] baseline reconciliation | ROADMAP Phase 6 SC #2 says "identical to milestone-1 baseline" but Phase 8 D-A2-6 says "intentionally superseded; new visual"; ARCH-06 forbids plugin from calling pyvts directly. Plan-time MUST reconcile. | ✓ |
| Plumbing-week split + scope | Research recommends plumbing-week sub-phase; ROADMAP says ~2 plans. Confirm split granularity + concrete harness deliverable. | ✓ |
| Default plugin scope | body_sway 3 strategies, [joy] dispatch path under ARCH-06, on_load AvatarOverrides field reads. | ✓ |
| Loader plumbing details | plugins/default/ on-disk location, importlib resolve strategy, system-prompt template format. | ✓ |

---

## Area 1: [joy] baseline reconciliation

### Q1.1: How to reconcile Phase 6 SC #2 with Phase 8 D-A2-6 + ARCH-06?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Amend SC #2 — v2.0 baseline | Drop "identical to milestone-1 baseline" wording. ARCH-06 forces this; plugin physically cannot reproduce milestone-1's Love.exp3 path. | ✓ |
| (B) Force ParamFrame approximation | Default plugin attempts to approximate Love.exp3 visual within tolerance. High cost, fragile, likely to fail Phase 10. | |
| (C) System-side expression overlay | When plugin emits [joy], system also triggers Love.exp3 via PyvtsSafeWriter. Requires reopening Phase 8 D-A2-1/D-A2-5 decisions; re-couples rig+plugin layer. | |

**User's choice:** (A) Amend SC #2.
**Notes:** Recommended option accepted. The contradiction was real and forced by ARCH-06.

### Q1.2: When does v2.0 baseline get captured by the side-by-side harness?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Plumbing-week first-run + commit | 06-01 builds harness, runs with stub plugin, captures + commits baseline JSON | (proposed) |
| (B) Phase 6 close after 06-02 | Default plugin tuned by eye, then baseline captured | |
| (C) Phase 10 capture-and-verify | Single-run; no regression detection between Phase 6 and 10 | |

**User's response:** "I want to clarify these questions" then "What is SC". After explanation, user reframed the entire question.

### Q1.2 (re-framed): Should there be ANY automated baseline for SC #2?

User insight (verbatim): "当前的 head_only 虽然可以工作，但是实际上动作并不
自然，以此作为 SC 参照不合理，尤其还要记录容差。这可能导致实际上更好的实现
反而 fail."

This pivoted the area from "when to capture baseline" to "should we capture
baseline at all for visual-quality SCs."

| Option | Description | Selected |
|--------|-------------|----------|
| (α) Operator visual judgment, no automated baseline | Phase 10 operator runs canned prompts, judges [joy] visual quality, records PASS/PARTIAL/FAIL in skeleton-verification.md. NO JSON, NO tolerance bands. | ✓ |
| (β) Plumbing-week stub baseline + auto-diff | Lower-bound from stub plugin, upper-bound after default plugin tuned. Phase 10 verifies "lower ≤ output ≤ upper". User would still judge twice; double-baseline maintenance. | |
| (γ) Reduce SC #2 to "doesn't crash" | SC #2 verifies LLM emits [joy] → some observable param change happens. Y/N automated. Doesn't check "looks good". Too loose; SC #2 from demo headline to "doesn't crash". | |

**User's choice:** (α) Operator visual judgment.
**Notes:** Premise of regression-baseline-against-mediocre rejected; visual quality is inherently human-judgmental.

### Q1.3 (originally tolerance bands; reformulated): SC #3 (body sway during TTS) verification mechanism — same concern as SC #2?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Same as SC #2: operator judgment, no baseline | head_only is mediocre by user's own admission; locking it as regression baseline punishes future better implementations. | ✓ |
| (B) Keep VFY-05 harness, diff milestone-1 head_only output | Migrates head_only verbatim to plugins/default/body_sway/. Detects "refactor accidentally changed body sway output." Doesn't detect "is it natural." User concern flagged as separate R-OPEN item for milestone-3+. | |
| (C) Re-investigate as separate sub-phase | Phase 6 plumbing-week adds sub-phase to retry Phase 4's deprecated proxy_param / exp3_modulation strategies or others. Out of Phase 6 scope; promotes Phase 4 R-OPEN-1 to Phase 6 exit gate. | |

**User's choice:** (A) Same as SC #2.
**Notes:** Same rationale.

### Q1.4: When edit ROADMAP.md / REQUIREMENTS.md to reflect (α) + (A)?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Phase 6 plan-phase | Researcher amends docs as part of 06-01 plan creation | |
| (B) Now during discuss-phase | Edit immediately; lands in 06-CONTEXT.md commit. Audit advantage: upstream docs match decisions immediately. | ✓ |
| (C) Don't edit ROADMAP; CONTEXT records override | Cheapest but downstream agents read stale ROADMAP wording first. | |

**User's choice:** (B) Edit now.
**Notes:** Contradiction is real; deferring would let downstream agents read stale wording.

---

## Area 2: Plumbing-week split + scope

### Q2.1: How many plans for Phase 6?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) 2 plans (matches ROADMAP) | 06-01 plumbing-week + 06-02 default plugin | |
| (B) 3 plans (finer split) | 06-01 contracts / 06-02 plumbing surgery / 06-03 default plugin | ✓ |
| (C) 1 plan (everything together) | Backout cost high if issues surface; conflicts with research's "plumbing before behavior" recommendation | |

**User's choice:** (B) 3 plans.
**Notes:** Each plan has fewer tasks; rollback cost lower if issues surface mid-phase.

### Q2.2: 06-01 plumbing-week harness scope (after Area 1 reduction)?

Multi-select:

| Option | Selected |
|--------|----------|
| Lipsync RMS-vs-MouthOpen Pearson correlation — SC #1 automatable | ✓ |
| Idle micro-motion variance saturation — SC #4 automatable | ✓ |
| Cursor responsiveness — SC #5 automatable | ✗ (cursor polish OPTIONAL per VFY-01) |
| WS protocol shape — SC #6 automatable | ✗ (already verified by M1 Phase 1+2) |

**User's choice:** Lipsync + idle only.

---

## Area 3: Default plugin scope

### Q3.1: body_sway strategy migration — milestone-1 has 3, only head_only verified working

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Migrate only head_only; delete others | Strict scope; loses Phase 4 P04..P07 research artifacts | |
| (B) Migrate all 3 but only head_only registry-selectable | Code preserved as artifact; AvatarOverrides.body_sway_strategy accepts only head_only at load time | ✓ |
| (C) Migrate all 3, all registry-selectable | Conflicts with Phase 4 P04 conclusion ("proxy_param / exp3_modulation unverified") | |

**User's choice:** (B).
**Notes:** Preserves Phase 4 research investment without claiming production support.

### Q3.2: Plugin's input interface (raw sentence vs pre-extracted intents)?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Plugin receives raw sentence; runs own bracket-walker | Aligns with ARCH-03 "plugin chooses its own parser strategy"; plugin runs split-token-safe walker mirroring M1 SC #3 BLOCKER fix; orthogonal to Phase 7 code_extractor | ✓ |
| (B) Phase 6 ships partial code_extractor preview handling [a] only | Cleaner plugin interface but conflicts with ARCH-03 "plugin sees [joy] in surrounding context" | |
| (C) Plugin receives ActionIntent list (M1 shape) | Skips raw sentence — plugin can't use semantic context | |

**User's choice:** (A).

### Q3.3: on_load signature — which arguments?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) on_load(capabilities: RigCapabilities, overrides: AvatarOverrides) | Plugin reads sign_inversions / writable_param_ids from capabilities; body_sway_strategy / proxy_body_param / param_probes from overrides. Aligns with Phase 8 D-A1-2 boundary. | ✓ |
| (B) on_load(capabilities: RigCapabilities) — extend RigCapabilities to include the override fields | Single source for plugin. Bloats RigCapabilities; reopens Phase 8 contract; violates "engineer-curated stays on AvatarOverrides" boundary. | |
| (C) on_load() — plugin queries sidecar globals | Push-pattern broken; plugin's deps become implicit. | |

**User's choice:** (A).

---

## Area 4: Loader plumbing

### Q4.1 (round 1, original options): How to load plugins/default/ into sidecar?

| Option | Description | Selected (round 1) |
|--------|-------------|--------------------|
| (A) importlib.util.spec_from_file_location — file-path | Drop-folder works; no pip install. Plugin can't use relative imports. | |
| (B) Inject plugins/ into sys.path at boot + import | Plugin like normal package (relative imports work). sys.path pollution; conflicts. | |
| (C) Plugin requires pip install | Auto-deps via pip; user friction (drop-folder doesn't work). | (initially picked) |

User initially chose (C) but immediately raised a follow-up question:
"有一个问题是第三方 plugin 可能有自己的依赖项，这怎么处理？"

This produced re-explanation in Chinese and a re-framing of the question to
include the deps angle.

### Q4.1 (round 2, re-framed): Default plugin and future user plugins — same loader strategy or split?

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Hybrid: default = file-path; user-installed = pip | Default has zero new deps; user plugins with deps go through pip. Loader supports two paths. Code complexity. | |
| (B) All pip-install (including default) | Sidecar boot runs `uv pip install -e plugins/default/` if default not installed. User plugins same. Drop-folder doesn't work. | |
| (C) All file-path; deps are plugin author's documented prereq | Single loader path. Plugin author tells user "run uv pip install <deps> before enabling." User runs pip themselves. | ✓ |

**User's choice:** (C) all file-path.
**User's reasoning (verbatim):** "你需要知道目前这个项目阶段的目的是探索最好
的插件，所有插件开发者和'用户'其实都是开发者." (The current project phase's
purpose is exploring the best plugin design; all plugin developers and "users"
are actually developers.)
**Notes:** Saved as project memory `project_v2_plugin_exploratory_audience.md`.
This insight changes the audience model and aligns with ARCH-07's full-trust
model.

### Q4.2: System-prompt action-code section format

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Per-action one line + description | LLM sees `[joy] - avatar feels happy` format; plugin.yaml.action_codes[].description fed in; lex-sorted; KV-cache prefix-stable | ✓ |
| (B) Comma-joined list (M1 status quo) | LLM sees `[joy], [anger], ...`; description text wasted | |
| (C) JSON blob | LLM sees JSON object; quote-escape problems; LLMs handle JSON less naturally than prose | |

**User's choice:** (A).

---

## Claude's Discretion

Areas where Claude committed defaults rather than asking the user:

- **plugin.yaml manifest hot-reload (PLG-10)**: WARN log on action_codes set
  change OR description text change. Plan-time confirms wording.
- **Reserved-name list extension (PLG-06)**: floor list of 7 sentinels;
  plan-time researcher does sweep against current Anthropic / Gemini / OpenAI
  o-series sentinels. No user input needed.
- **API versioning policy (ARCH-11)**: api_version "1.0" floor; reject other
  major versions; minor mismatch = WARN only. Plan-time formalizes bump rule.
- **userData/plugins/ name collision behavior (ARCH-08)**: userData wins over
  in-tree with same name (WARN); two userData same-name → refuse boot with
  loud error.
- **Null plugin rest-state ParamFrame**: empty `add_params={}` and
  `set_params={}`. Compositor merge with idle/speech/cursor still happens.
- **Coalescing rate-limiter** (PluginAdapter): latest-frame-wins on over-rate;
  hold-last-frame on under-rate; flush-on-tick-boundary for bursty (per
  Pitfall 3 research).
- **Plumbing-week harness location**: `sidecar/scripts/plumbing_harness.py` +
  `.planning/baselines/v2.0/{lipsync,idle}.json`.

## Deferred Ideas

- Per-plugin venv / subprocess isolation — explicitly rejected by ARCH-07
- Plugin marketplace UX — out of scope per PROJECT.md
- Plugin signing / sandboxed execution — same trust model as skills
- Auto-install of Python deps from plugin.yaml — D-A4.1 rejected
- Mid-conversation plugin hot-swap — PLG-09 explicit no
- Conflict-resolution UI for two userData same-name plugins — Claude's discretion
  is loud error; UX layer not in v2.0 scope
- Side-by-side baseline harness for SC #2 / SC #3 / cursor SC / WS-shape SC —
  D-A2.2 + D-A1.2/3 reject
- proxy_param + exp3_modulation as registry-selectable strategies — D-A3.1
  rejects; preserved as source-only artifacts for future research
