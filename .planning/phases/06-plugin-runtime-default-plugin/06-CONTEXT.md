# Phase 6: Plugin Runtime + Default Plugin - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 refactors the animation layer from compositor-internal to plugin-driven.
The deliverable is a working `BodyMotionPlugin` ABC + manifest-based loader +
supervisor + safety clamp + rate-limiter + `PluginAdapter(TickDriver)`, plus a
default plugin that absorbs the milestone-1 `IntentDriver` + `compositor/body_sway/*`
logic. Plugin's `action_codes` (with descriptions) feed the system prompt under
a fixed delimiter, KV-cache prefix-stable. CI grep enforces `import pyvts` count == 1.

**In scope:**

1. **Plugin contracts (06-01)** — `BodyMotionPlugin` ABC with `api_version: "1.0"` enum;
   `PluginManifest` Pydantic + jsonschema 4.26.0 validator; reserved-name guard;
   manifest loader; `clamp_and_validate(frame, capabilities)` boundary stage; system-
   prompt action-code section assembly (per-action one-line-with-description format,
   code-key lex-sorted, KV-cache prefix-stable).
2. **Plumbing surgery (06-02)** — supervisor (5s `on_load` timeout + async-gen
   circuit breaker 60s/3-restart + null-plugin fallback) + `PluginAdapter(TickDriver)`
   + coalescing rate-limiter + `IntentDriver` DELETE + `compositor/body_sway/*` MOVE
   → `plugins/default/body_sway/` + `compositor.py` merge order rewrite per ARCH-05
   + `ws/server.py` lifespan rewire + `actions_extractor` decoupling +
   `live2d_expression_prompt.txt` template adjustment + CI `import pyvts` grep == 1
   + plumbing-week harness (lipsync + idle only).
3. **Default plugin port (06-03)** — `plugins/default/__init__.py` (DefaultPlugin
   class via file-path loader) + OLVT 8-emotion `action_codes` with descriptions in
   `plugin.yaml` + plugin-internal split-token-safe bracket-walker +
   `[joy]/[anger]/[disgust]/[fear]/[neutral]/[sadness]/[smirk]/[surprise]`
   ParamFrame compositions (head/eye/face params only; zero exp3 dependency) +
   body_sway strategy migration (head_only is the only selectable strategy) +
   `on_load(capabilities, overrides)` two-arg signature.
4. **ROADMAP.md + REQUIREMENTS.md edits committed in this CONTEXT.md commit**
   (per Area 1 decision B): SC #2 wording / VFY-03 SC #2+#3 wording /
   VFY-05 harness scope reduction / Phase 6 plan count 2 → 3.

**Out of scope (architectural call from this discussion):**

- **No SC #2 baseline JSON file.** SC #2 / SC #3 are operator-judged via Phase 10
  visual-review ceremony. Locking head_only ship state as a regression baseline
  would punish improved future implementations on a known-mediocre reference.
  See D-A1.1..A1.4.
- **No `[joy]` → exp3 overlay attempt.** Default plugin emits ParamFrames only
  (head/eye/face); exp3 file is NOT touched (Phase 8 D-A2-2 carry-over). The
  milestone-1 visual is intentionally superseded; ARCH-06 single-pyvts-writer rule
  also makes plugin-side exp3 dispatch impossible.
- **No proxy_param / exp3_modulation as registry-selectable strategies.**
  AvatarOverrides.body_sway_strategy field accepts only `head_only` value at
  load time. proxy_param.py + exp3_modulation.py source files are migrated to
  `plugins/default/body_sway/` for future reference but are NOT registry-wired.
  See D-A3.1.
- **No pip-installed plugins; no auto-deps install; no plugin marketplace UX.**
  All plugins (default + future user) loaded via `importlib.util.spec_from_file_location`.
  Plugin author documents Python deps prereq in plugin README. Aligns with
  v2.0-is-exploratory-phase audience model (project memory). See D-A4.1.

</domain>

<decisions>
## Implementation Decisions

### A1. SC #2 / SC #3 baseline reconciliation (highest-leverage decision)

- **D-A1.1:** **Amend Phase 6 SC #2 wording.** ROADMAP.md SC #2 is rewritten
  to drop "identical to milestone-1 Phase-4 baseline within tolerance"; replaced
  with "operator-judged via Phase 10 visual-review ceremony; the milestone-1
  visual is intentionally superseded under v2.0 architecture." Rationale: ARCH-06
  forbids plugin from calling pyvts directly; milestone-1's `[joy]` mechanism
  (Love.exp3 expression-activation via `writer.requestExpressionActivation`)
  cannot be reproduced in v2.0 plugin code; Phase 8 D-A2-2 already locked
  "default plugin produces a different visual; no exp3 dependency."
- **D-A1.2:** **SC #2 verification = operator visual judgment, no automated
  baseline.** Phase 10 ceremony script will define canned LLM prompts that
  elicit `[joy]` and a visual-quality checklist (smooth fade onset visible?
  decay visible? no jerky pop?). PASS / PARTIAL / FAIL recorded in
  `skeleton-verification.md`. NO JSON baseline file, NO tolerance bands for
  SC #2.
- **D-A1.3:** **SC #3 (body sway during TTS) verification = operator judgment,
  same rationale.** Current head_only ship state is itself unnatural (per
  user observation 2026-05-08). Capturing it as v2.0 regression baseline would
  fail any improved-but-different future implementation. Phase 10 operator
  watches a 30s utterance, judges body motion present + non-jerky, records
  PASS / PARTIAL / FAIL. NO JSON baseline.
- **D-A1.4:** **ROADMAP.md + REQUIREMENTS.md edits land in this CONTEXT.md
  commit (NOT deferred to Phase 6 plan-phase).** Edits affect 5 lines across
  the two files: ROADMAP.md Phase 6 SC #2 + Plans list + Phase 10 Goal + SC #1
  + SC #2 + Open-questions section; REQUIREMENTS.md VFY-03 + VFY-05 + traceability
  row + cross-phase notes. User chose (B) over (A) deferred-to-plan-phase
  because the contradiction is real now and downstream agents reading ROADMAP
  must see the corrected wording.

### A2. Plumbing-week sub-phase split + scope

- **D-A2.1:** **3 plans.** ROADMAP "~2 plans" is overridden:
  - **06-01 contracts** — ABC + manifest + jsonschema + reserved-name guard
    + clamp + system-prompt assembly. Sidecar boots with null plugin. SC #5
    closes here.
  - **06-02 plumbing surgery** — supervisor + PluginAdapter + IntentDriver
    DELETE + body_sway MOVE + compositor merge rewrite + ws/server lifespan
    rewire + actions_extractor decoupling + live2d_expression_prompt template
    + CI grep + plumbing-week harness. SC #1 / #3 / #4 close here. `[joy]`
    still inactive (plugin is null).
  - **06-03 default plugin port** — plugins/default/__init__.py +
    OLVT 8-emotion action_codes + bracket-walker + ParamFrame compositions
    + body_sway head_only migration + on_load signature. SC #2 closes here
    (operator-judged in Phase 10).
- **D-A2.2:** **Plumbing-week harness scope = lipsync RMS + idle micro-motion
  ONLY.** Specifically:
  - Lipsync: emit a fixed TTS sentence; capture RMS envelope + ParamMouthOpen
    output; compute Pearson correlation; threshold ≥ 0.7.
  - Idle: 30s static run; sum variance of `ParamAngle{X,Y,Z}` and
    `ParamEyeOpen{L,R}` from add_params; threshold non-zero AND < 0.5.
  - Cursor SC NOT in harness (per VFY-01 cursor polish is OPTIONAL in v2.0;
    no point capturing a baseline for behavior that may not land).
  - WS-protocol-shape SC NOT in harness (already verified by M1 Phase 1+2;
    refactor doesn't touch envelope shape).
  - SC #2 / SC #3 NOT in harness (operator-judged per D-A1.1..3).

### A3. Default plugin scope

- **D-A3.1:** **body_sway strategy migration: all 3 files moved, only head_only
  is registry-selectable.** `plugins/default/body_sway/{registry.py, head_only.py,
  proxy_param.py, exp3_modulation.py}`. registry.py modified so
  `available_strategy_names()` returns `("head_only",)` only;
  `build_strategy(name, ...)` raises `ValueError` for any value other than
  `head_only`. proxy_param.py + exp3_modulation.py source files preserved
  unchanged (Phase 4 P04..P07 evidence: neither verified working on Teto;
  retained as artifacts for future researchers, not as ship strategies).
  AvatarOverrides.body_sway_strategy field schema unchanged (Phase 8 lock),
  but load-time validator rejects values other than `head_only`.
- **D-A3.2:** **Plugin's input is the raw sentence string; plugin owns its
  own parser.** ABC signature: `on_token_stream(sentence: str) -> AsyncIterator[ParamFrame]`.
  Plugin internally runs a split-token-safe bracket-walker (mirrors M1 SC #3
  BLOCKER fix in `transformers._extract_intents`) to extract its own
  `[action]` codes from the sentence. Phase 7's `code_extractor` runs at the
  ORCHESTRATOR layer (for display strip + variant/event dispatch) and is
  ORTHOGONAL to plugin's parser. Both read the same sentence stream; neither
  blocks the other. Aligns with ARCH-03 verbatim ("plugin chooses its own
  parser strategy for its own action codes").
- **D-A3.3:** **`on_load` two-arg signature.** Final shape:
  ```python
  def on_load(
      self,
      capabilities: RigCapabilities,
      overrides: AvatarOverrides,
  ) -> None:
      ...
  ```
  Plugin reads from `capabilities`: `writable_param_ids`, `sign_inversions`,
  `cdi3_display_names`. Plugin reads from `overrides`: `body_sway_strategy`,
  `proxy_body_param`, `param_probes`. Aligns with Phase 8 D-A1-2 boundary
  (engineer-curated fields stay on AvatarOverrides; introspection-derived
  fields stay on RigCapabilities).

### A4. Loader plumbing

- **D-A4.1:** **All plugins loaded via file-path; no pip install required.**
  Loader uses `importlib.util.spec_from_file_location` against
  `<plugin_dir>/plugin.yaml` → resolves entrypoint path → loads .py file as
  isolated module. Default plugin in `plugins/default/`; future user plugins
  in `app.getPath('userData')/plugins/<name>/`. **Plugin author's Python deps
  are documented prereq** (plugin README or `plugin.yaml.description`); user
  runs `uv pip install <deps>` against sidecar venv before enabling. NO
  auto-install at runtime. NO per-plugin venv. Aligns with ARCH-07 (in-sidecar
  Python, no isolation, full trust) + project memory
  `project_v2_plugin_exploratory_audience.md` (v2.0 plugin phase is exploratory;
  authors == users == developers). **Default plugin must have ZERO new deps
  beyond sidecar's existing requirements.**
- **D-A4.2:** **System-prompt action-code section format = per-action one
  line with description.** Loader assembles:
  ```
  ## Available Actions (plugin: <name> v<version>)
  [<code1>] - <description1>
  [<code2>] - <description2>
  ...
  ```
  Codes are sorted lexicographically by code-key for KV-cache prefix-stability.
  Description text comes from `plugin.yaml.action_codes[].description`.
  `live2d_expression_prompt.txt` template gets a new placeholder
  `[<insert_action_codes_section>]` (replaces M1's `[<insert_action_keys>]`)
  that the loader substitutes at orchestrator construction. Aligns with
  ARCH-09 (KV-cache prefix-stable; assembly happens once at boot; sorted
  deterministically).

### Claude's Discretion

- **plugin.yaml manifest hot-reload behavior (PLG-10):** WARN log on any
  change to `action_codes` set OR `description` text of any existing code.
  Both invalidate the system-prompt frozen at boot. WARN message: "plugin.yaml
  changed — restart sidecar to apply (current session uses boot-time
  vocabulary)." Plan-time confirms wording.
- **Reserved-name list extension (Phase 6 open question):** floor is `<think>`,
  `<thinking>`, `<tool_call>`, `<function_call>`, `<function_calls>`, `<invoke>`,
  `<parameter>`. Plan-time researcher does the extension sweep against current
  Anthropic / Gemini / OpenAI o-series sentinels; no user input needed.
- **API versioning policy (ARCH-11):** `api_version: "1.0"` is the floor;
  loader rejects manifests with `api_version != "1.0"` major version
  (string-compare `split(".")[0]`). Minor version mismatches log WARN only.
  Plan-time formalizes the bump rule (breaking change to `BodyMotionPlugin`
  ABC or `RigCapabilities` shape ⇒ major bump; description/metadata changes
  ⇒ minor bump).
- **Plugin discovery precedence on conflict (ARCH-08):** if `userData/plugins/<X>/`
  and `plugins/<X>/` both exist with same `name` field, userData wins, log
  WARN naming both paths. If two userData plugins have same `name`, refuse to
  boot with loud error.
- **Null plugin rest-state ParamFrame content (PLG-04):** empty
  `add_params={}` and `set_params={}`. Compositor merge with idle/speech/cursor
  drivers still happens; the null plugin contributes nothing but doesn't break
  the merge. Preserves AVT-02 1-second re-injection rule (Idle driver writes
  baseline values; null plugin just doesn't add anything on top).
- **Coalescing rate-limiter behavior:** latest-frame-wins on over-rate;
  hold-last-frame on under-rate; flush-on-tick-boundary for bursty. Per research
  recommendation (Pitfall 3). Plan-time codifies in PluginAdapter.
- **Rest-state baseline for plugins (default plugin in particular):** plugin's
  ParamFrame default is "no contribution" (empty dict); plugin authors layer
  ON TOP of idle baseline. Plan-time documents in ABC docstring.
- **Plumbing-week harness location:** `sidecar/scripts/plumbing_harness.py`
  + `.planning/baselines/v2.0/lipsync.json` + `.planning/baselines/v2.0/idle.json`.
  Captures M1 baseline with current code; v2.0 replays after refactor; threshold
  bands per D-A1.1 amended VFY-05 wording.

### Folded Todos

None. (`todo match-phase 6` returned 0 matches.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 6: Plugin Runtime + Default Plugin" — phase
  goals, requirements list (PLG-01..10 + ARCH-01..12 minus ARCH-02), revised
  3-plan structure (06-01 / 06-02 / 06-03), open questions for plan-phase.
- `.planning/REQUIREMENTS.md` §"Plugin Architecture & Contracts" ARCH-01..12
  — load-bearing architectural invariants. ARCH-02 is OWNED by Phase 8 (consumed
  by Phase 6). ARCH-03 (plugin sees decorated stream), ARCH-04 (`AsyncIterator[ParamFrame]`
  ≤ 60 Hz), ARCH-05 (fixed merge order), ARCH-06 (single pyvts writer + CI grep),
  ARCH-07 (in-sidecar no-isolation full-trust), ARCH-08 (userData precedence),
  ARCH-09 (KV-cache prefix-stable system prompt), ARCH-10 (IntentDriver DELETED),
  ARCH-11 (`api_version: "1.0"`), ARCH-12 (system-primitive override list).
- `.planning/REQUIREMENTS.md` §"Plugin Runtime (Phase 6)" PLG-01..10 — concrete
  implementation requirements. PLG-04 (supervisor + circuit breaker), PLG-05
  (clamp at boundary), PLG-06 (jsonschema + reserved-name guard), PLG-07
  (default plugin OLVT 8-emotion vocabulary), PLG-09 (startup-only switching),
  PLG-10 (manifest hot-reload via watchdog 6.0.0).
- `PROJECT_DESIGN.md` §14B (entire) — source-of-truth for the v2.0 plugin +
  animation-control milestone framing.

### Phase 8 outputs (consumed by Phase 6)
- `.planning/phases/08-avatar-import-catalogs/08-CONTEXT.md` D-A1.1 (RigCapabilities
  replaces AvatarCapabilities), D-A1.2 (voice on AvatarOverrides), D-A1.3
  (param_ranges from cdi3 only), D-A2.1 (plugin owns action codes; rig only
  exposes variants + events), D-A2.2 (default plugin zero exp3 dependency),
  D-A2.3 (OLVT emotionMap ignored), D-A2.5 (`_avatar_overrides.yaml` has 2
  catalogs not 3), D-A2.6 (milestone-1 SC #2 NOT preserved verbatim).
- `sidecar/src/sidecar/avatar/rig_capabilities.py` — `RigCapabilities` builder
  Phase 6 plugin's `on_load(capabilities, ...)` consumes.
- `sidecar/src/sidecar/avatar/overrides.py` — `AvatarOverrides` Pydantic Phase 6
  plugin's `on_load(..., overrides)` consumes; `TetoOverrides` alias to be
  removed in 06-02 cleanup.

### Research synthesis
- `.planning/research/v2.0/SUMMARY.md` — milestone-level synthesis. §"Phase 6:
  Plugin Runtime + Default Plugin" lists 5 critical pitfalls and recommends
  plumbing-week sub-phase pattern (this CONTEXT splits into 3 plans).
- `.planning/research/v2.0/PITFALLS.md` Pitfalls 1-4 — Phase 6 NEW v2.0:
  loader crash safety, async-generator leaks, plugin output rate mismatch,
  safety-clamp bypass. Each has specific mitigations the planner must encode.
- `.planning/research/v2.0/ARCHITECTURE.md` §(a) Plugin Runtime Placement —
  files affected list (NEW / MODIFIED / DELETED), TickDriver Protocol
  preservation rationale, push-pattern rig discovery via `on_load(capabilities)`.

### Cross-phase context
- `.planning/phases/04-action-compositor-vts-bridge-body-sway-investigation/04-04-PLAN.md`
  + 04-05 / 04-06 / 04-07 PROVENANCE — body-sway strategy investigation evidence;
  informs D-A3.1 (head_only is the only verified-working strategy).

### Live source files Phase 6 modifies/replaces
- `sidecar/src/sidecar/compositor/intent_driver.py` — **DELETED in 06-02.**
  Logic migrates to default plugin's bracket-walker + ParamFrame compositions
  in 06-03. Note: M1 IntentDriver calls `writer.requestExpressionActivation`
  to fire Love.exp3 — that path is GONE in v2.0 (D-A1.1 + ARCH-06).
- `sidecar/src/sidecar/compositor/body_sway/` — **MOVED to `plugins/default/body_sway/`
  in 06-02.** registry.py modified per D-A3.1; head_only.py preserved verbatim;
  proxy_param.py + exp3_modulation.py preserved as artifacts.
- `sidecar/src/sidecar/compositor/compositor.py` — Constructor signature
  changes: `intent_driver` parameter removed, `plugin_adapter` parameter added.
  `_tick` merge order rewrite per ARCH-05.
- `sidecar/src/sidecar/avatar/capabilities.py` — **DELETED in 06-01.** Already
  reduced to compat shim by Phase 8 08-01. Final removal lands here when
  callers (orchestrator, transformers) are rewired.
- `sidecar/src/sidecar/orchestrator/orchestrator.py:30,63-73,80,93` — capabilities
  references removed; `_build_system_prompt(persona_text, plugin_manifest)`
  signature; `[<insert_action_keys>]` placeholder substitution replaced with
  `[<insert_action_codes_section>]` per D-A4.2.
- `sidecar/src/sidecar/orchestrator/transformers.py:75-122` — `actions_extractor`
  signature decoupled from AvatarCapabilities; takes a generic vocabulary
  set instead. Plan-time decides if M1's actions_extractor stays for orchestrator
  layer or merges into Phase 7's code_extractor preview.
- `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` —
  template adjustment; replace `[<insert_action_keys>]` with
  `[<insert_action_codes_section>]`.
- `sidecar/src/sidecar/ws/server.py:121-241` — lifespan rewire: load_capabilities
  → load_avatar_overrides + build_rig_capabilities + plugin_loader.load();
  Compositor constructor swap; remove direct IntentDriver import.

### New files Phase 6 creates (per ARCHITECTURE.md §(a))
- `sidecar/src/sidecar/plugins/__init__.py`
- `sidecar/src/sidecar/plugins/api.py` — `BodyMotionPlugin` ABC + `ApiVersion` enum
- `sidecar/src/sidecar/plugins/manifest.py` — `PluginManifest` Pydantic
- `sidecar/src/sidecar/plugins/loader.py` — discovery + entrypoint resolution
  + reserved-name guard + jsonschema validation
- `sidecar/src/sidecar/plugins/supervisor.py` — circuit breaker + null fallback
- `sidecar/src/sidecar/compositor/plugin_adapter.py` — TickDriver wrapper +
  rate-limiter
- `sidecar/src/sidecar/compositor/clamp.py` — `clamp_and_validate(frame, capabilities)`
- `sidecar/scripts/plumbing_harness.py` — Phase 6 plumbing-week harness
- `.planning/baselines/v2.0/lipsync.json` + `idle.json` — captured M1 baselines
- `plugins/default/plugin.yaml` (NEW repo-root)
- `plugins/default/__init__.py` (NEW repo-root)
- `plugins/default/body_sway/` (MOVED from `sidecar/src/sidecar/compositor/body_sway/`)

### External format specs
- [PEP 533](https://peps.python.org/pep-0533/) (draft) — async-iterator
  deterministic cleanup; informs Pitfall 2 mitigation.
- [Python issue #41229, #15635, #17468](https://github.com/python/cpython) —
  async-generator memory-leak edge cases; PluginAdapter must call `aclose()`
  on every termination path.
- [importlib.util — Importing libraries (Python docs)](https://docs.python.org/3.12/library/importlib.html#importlib.util.spec_from_file_location)
  — file-path module loading API used by D-A4.1.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`sidecar/src/sidecar/compositor/compositor.py:16-21`** — `TickDriver` and
  `IntentTickDriver` Protocols. Phase 6 PluginAdapter implements `TickDriver`
  (returns dict[str, float]); IntentTickDriver is removed when IntentDriver is
  deleted.
- **`sidecar/src/sidecar/compositor/idle_driver.py`, `speech_driver.py`,
  `cursor_driver.py`** — TickDriver implementations preserved unchanged through
  Phase 6 refactor. Plugin output enters merge in the third slot per ARCH-05.
- **`sidecar/src/sidecar/compositor/body_sway/registry.py`** — strategy
  selection at boot from `overrides.body_sway_strategy`. Pattern reused in
  default plugin's body_sway sub-package after the move.
- **`sidecar/src/sidecar/orchestrator/transformers.py:125-157`** —
  `_extract_intents` bracket-walker with split-token-safe state machine. Default
  plugin's plugin-internal parser COPIES this pattern verbatim for `[action]`
  extraction (D-A3.2). The plumbing is the M1 SC #3 BLOCKER fix.
- **`sidecar/src/sidecar/avatar/rig_capabilities.py:17-56`** — `build_rig_capabilities()`
  Phase 6 calls in lifespan to populate plugin's `on_load(capabilities, ...)`
  argument.
- **`sidecar/src/sidecar/avatar/overrides.py`** — `load_avatar_overrides()`
  Phase 6 calls in lifespan to populate plugin's `on_load(..., overrides)` argument.
  Phase 8 already added `variants[]` / `events[]` / `voice` / `body_sway_strategy`
  / `proxy_body_param` / `param_probes` fields; Phase 6 reads them.
- **`packages/contracts/py/contracts/`** — Phase 5 codegen pipeline produces
  TS mirrors for all Pydantic contracts. Phase 6 new contracts (`PluginManifest`,
  `ParamFrame` extensions if any) get TS codegen for free.

### Established Patterns

- **TickDriver Protocol seam (compositor merge)** — additive vs set semantics;
  plugin output enters merge as `set_params` (per ARCH-05); rate-limiter
  enforces ≤ 60 Hz at the seam, not in plugin.
- **Loud-failure boot loader (M1 D-08, Phase 8 inheritance)** — `clamp_and_validate`
  unknown-key WARN, NaN/Inf ERROR + frame drop, NOT silent forward.
- **Append-only `_memory` + KV-cache prefix-stable system prompt (M1 D-17)** —
  plugin manifest contributes to system prompt at orchestrator construction;
  bytes-identical across boots; switching plugins requires sidecar restart
  (PLG-09). Manifest hot-reload (PLG-10) WARNs but does not rebuild prompt.
- **Single pyvts writer (M1 AVT-04, ARCH-06)** — `PyvtsSafeWriter` is the only
  pyvts importer; CI grep enforces. Plugin code, variant dispatch, event
  dispatch, HUD locks, cursor frames all flow through it.
- **OLVT-direct port preference** — feedback memory `feedback_olvt_port_preference.md`.
  Default plugin's ParamFrame compositions for `[joy]/[anger]/.../[surprise]`
  port from OLVT's expression vocabulary where possible; deviations require
  explicit rationale.

### Integration Points

- **Sidecar boot sequence** — `ws/server.py:121-241` lifespan runs:
  1. `load_avatar_overrides(teto_dir)` (Phase 8 output)
  2. `build_rig_capabilities(overrides, teto_dir)` (Phase 8 output)
  3. NEW: `plugin_loader.load(<active_plugin_path>)` returning `BodyMotionPlugin` instance
  4. NEW: `plugin.on_load(capabilities, overrides)`
  5. NEW: `PluginAdapter(plugin)` wraps for compositor merge
  6. `Compositor(writer, idle, speech, plugin_adapter, cursor)` — replaces
     `intent_driver` slot
  7. `Orchestrator(gateway, plugin_manifest, persona, ...)` — system prompt
     assembled from manifest's action_codes
- **CI grep test** — `sidecar/tests/architecture/test_pyvts_writer_singleton.py`
  greps `sidecar/src/` for `import pyvts` lines; asserts count == 1
  (`sidecar/src/sidecar/vts/pyvts_writer.py`). Phase 6 06-02 lands this.
- **Plugin discovery** — `app.getPath('userData')/plugins/` (Electron) is
  passed to sidecar via `AGENTICLLMVTUBER_USER_DATA` env var (Phase 8 already
  introduced `AGENTICLLMVTUBER_REPO_ROOT`; same pattern). Loader scans both
  `<repo_root>/plugins/*/plugin.yaml` and `<userData>/plugins/*/plugin.yaml`;
  userData precedence per ARCH-08.
- **Active-plugin selection at boot** — config-file mechanism per Phase 6 SC #1.
  Plan-time decides exact location (`sidecar/config/active_plugin.yaml` or env
  var). Default value is `"default"` (the in-tree shipping plugin).

</code_context>

<specifics>
## Specific Ideas

- **User architectural insight (Area 1 mid-discussion):** "head_only 虽然可以
  工作，但是实际上动作并不自然，以此作为 SC 参照不合理，尤其还要记录容差。
  这可能导致实际上更好的实现反而 fail." This insight reframed Area 1 from
  "amend SC #2 wording" to a deeper question: should v2.0 lock current ship
  state as a regression baseline at all? The answer for visual-quality SCs
  (#2 / #3) is NO — operator-judged is the correct verification mechanism.
  For mechanism-preserving SCs (lipsync correlation, idle micro-motion
  variance), automated baseline still works because the math is mechanism-
  invariant. This produced D-A1.2, D-A1.3, and the harness scope reduction
  in D-A2.2.

- **User architectural insight (Area 4):** "目前这个项目阶段的目的是探索最好
  的插件，所有插件开发者和'用户'其实都是开发者." Saved as project memory
  `project_v2_plugin_exploratory_audience.md`. This is why D-A4.1 chose
  file-path loading without pip-install requirement — the audience is
  technical and can handle deps themselves. Reverse implication: if a future
  milestone changes audience to non-developer end-users, this decision needs
  redoing.

- **No bulk operations:** consistent with Phase 8 user preference. Plugin
  dispatch / loader code paths stay simple; no batch ops, no "load all plugins
  at once" mode.

- **Default plugin NOT a marketplace prototype:** plugin author docs and
  examples can come later. Phase 6 ships ONE plugin (default) and the runtime
  to load it. Future plugins are out of scope.

</specifics>

<deferred>
## Deferred Ideas

- **Per-plugin venv / subprocess isolation** — explicitly rejected by ARCH-07
  ("in-sidecar Python, no isolation, full trust"). If demand surfaces in
  milestone-3+, R-19 tracks this risk per PROJECT_DESIGN.md §15.
- **Plugin marketplace UX** (browse / search / install / star ratings) —
  PROJECT.md "Out of Scope (v1 entirely)" section explicitly excludes this.
- **Plugin signing / sandboxed execution** — same trust model as skills system
  (§13.122); explicit no-go for v1.
- **Auto-install of Python deps from `plugin.yaml`** — D-A4.1 rejected. Plugin
  author documents prereq; user runs `uv pip install` themselves.
- **Mid-conversation plugin hot-swap** — PLG-09 explicitly: startup-only
  switching. Hot-swap deferred to milestone-3+ if demand surfaces.
- **Conflict-resolution UI for two userData plugins with same name** — Claude's
  Discretion: refuse boot with loud error. UX layer to "rename one of them"
  not in v2.0 scope.
- **Side-by-side baseline harness for SC #2 / SC #3 / cursor / WS-shape** —
  D-A2.2 + D-A1.2/3 reject. SC #2 / #3 operator-judged; cursor SC depends on
  optional VFY-02 polish; WS-shape verified in M1.
- **proxy_param + exp3_modulation as registry-selectable strategies** — D-A3.1
  rejects for v2.0; preserved as source-only artifacts for future research.

### Reviewed Todos (not folded)

None — `todo match-phase 6` returned 0 matches.

</deferred>

---

*Phase: 06-plugin-runtime-default-plugin*
*Context gathered: 2026-05-08*
