# Phase 8: Avatar Import + Catalogs - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 delivers the user-facing avatar import flow + the canonical
`RigCapabilities` / `AvatarOverrides` Pydantic contracts that Phase 6 plugin
runtime + Phase 9 HUD consume. In v2.0 execution order Phase 8 runs **first**
so the contracts are clean before Phase 6 plumbing-week needs them.

**In scope:**

1. **4 type-detected extractors** — VTS (`.vtube.json` `Hotkeys[]`), Cubism
   with named expressions (`model3.json` `FileReferences.Expressions`), Cubism
   bare (extract events from `.motion3.json` only), OLVT (`model_dict.json`).
2. **Type detector** (`import_detect.py`) — fingerprints folder shape, returns
   one of the 4 types (or "unsupported / Cubism 5.3" with a friendly error).
3. **Electron file dialog → sidecar import IPC chain** —
   `ipc:avatar:import-pick`, `POST /admin/avatar/import` returning
   `AvatarImportPlan`, `POST /admin/avatar/import/commit` writing the YAML
   atomically.
4. **Mandatory React review screen on a dedicated route** (NOT modal) — single
   page scrollable layout; per-row Edit/Delete/source-name/`{code}`-preview;
   Save disabled while `exp_NN` placeholders remain.
5. **`RigCapabilities` Pydantic contract definition** (ARCH-02 — moved here
   from Phase 6 with the 2026-05-08 order swap). Replaces milestone-1
   `AvatarCapabilities` (deleted in same PR; the four milestone-1 callers are
   already going to be rewritten in Phase 6/7 anyway).
6. **`AvatarOverrides` Pydantic contract definition + rename** —
   milestone-1 `TetoOverrides` → `AvatarOverrides`. Adds `variants` +
   `events` catalog fields and absorbs the `voice` field that previously
   lived on `AvatarCapabilities`.
7. **`_avatar_overrides.yaml` schema + jsonschema validator** — written
   atomically (`.tmp` → fsync → rename), validated at write time.
8. **VTS API introspection smoke-test** (`vts_introspect_smoke.py`) — confirms
   `pyvts 0.3.3` produces expected fields against the real Teto rig before the
   extractors land; pyvts vendor-patch lands here if needed.
9. **Teto migration via dogfooded import flow** (after Phase 8 ships) — run
   the import flow on `Live2D/重音テト/`, replace `avatars/teto/avatar.yaml`
   + `teto_overrides.yaml` with the new `_avatar_overrides.yaml`.

**Out of scope (architectural call from this discussion):**

- **No `emotion_bindings` field** on `RigCapabilities` or
  `_avatar_overrides.yaml`. Action vocabulary (`[joy]` etc.) is OWNED by the
  plugin (Phase 6); the rig only exposes `{variant}` and `<event>` codes.
  See `<decisions>` D-A2-1.
- **No OLVT `emotionMap` import** — OLVT users get variant catalog (from
  `actionMap`) only; their `emotionMap` is ignored. They re-curate emotion
  behavior in their plugin if they want it.
- **No bulk-rename helpers** (lowercase-all etc.) on the review screen — 14
  rows on Teto, manual edit cost is fine.

</domain>

<decisions>
## Implementation Decisions

### A1. `RigCapabilities` ↔ `AvatarCapabilities` migration

- **D-A1-1:** **Replace, don't extend.** `AvatarCapabilities` is DELETED in
  Phase 8's first PR; `RigCapabilities` is the new single contract.
  Milestone-1 callers (`tag_vocabulary()`, `IntentDriver._params_for_expression`,
  `actions_extractor` kind classification, TTS gateway voice read) are
  rewritten in Phase 6/7 anyway — the rename ride-along is cheap.
- **D-A1-2:** **`voice` field moves to `AvatarOverrides`.** `voice` is
  engineer-curated (not VTS-introspectable), so it belongs with
  `sign_inversions` and `body_sway_strategy`, not on the rig-introspection
  contract.
- **D-A1-3:** **`param_ranges` source = `cdi3.json` only.** Field is
  `dict[str, tuple[float, float] | None]`; `None` when `cdi3.json` lacks the
  param or the file is missing entirely. HUD (Phase 9) handles `None` by
  falling back to `[0, 1]` slider or "unbounded" affordance. Phase 8 does
  NOT call VTS API for ranges (keeps import flow VTS-independent).

**Final `RigCapabilities` shape:**

```python
class RigCapabilities(BaseModel):
    writable_param_ids: list[str]
    param_ranges: dict[str, tuple[float, float] | None]
    expressions: list[Expression]               # for plugin/HUD reference only
    hotkeys: list[Hotkey]                        # variant-dispatch hotkey IDs
    cdi3_display_names: dict[str, str]           # empty dict when cdi3 absent
    sign_inversions: list[str]                   # from AvatarOverrides
    # NO emotion_bindings field (D-A2-1)
```

### A2. Three-category code system — architecture clarification

- **D-A2-1:** **Plugin owns action (`[xxx]`) vocabulary entirely; rig only
  exposes variants (`{xxx}`) + events (`<xxx>`).** Action codes are declared
  in `plugin.yaml` (`action_codes: [neutral, anger, ..., surprise]` — fixed
  OLVT 8 for default plugin per PLG-07). Variants + events come from the
  imported avatar's files. **The rig knows nothing about emotion semantics;
  the plugin knows nothing about per-rig variant/event names.**
- **D-A2-2:** **Default plugin is fully self-contained for action codes.**
  When LLM emits `[joy]`, default plugin emits ParamFrames built from
  head/eye/face params alone (no dependency on rig's `Love.exp3.json` or any
  `.exp3` file). Plugin is rig-agnostic at the action-code level; per-rig
  body-sway strategy adaptation still uses `RigCapabilities` (e.g.,
  `body_sway_strategy: head_only` from `_avatar_overrides.yaml`).
- **D-A2-3:** **OLVT `emotionMap` is ignored on import.** OLVT extractor
  reads `actionMap` → variant catalog only. `emotionMap` (which maps
  `joy`→motion-index in OLVT) is dropped silently. Rationale: emotion
  vocabulary is plugin-author business; cross-system data mapping is wrong
  layer.
- **D-A2-4:** **Teto's 14 LLM-emittable expressions all become variants.**
  `Love`, `Blush`, `chibi`, `Cry`, `Dark Eye`, `Dark Face`, `Dizzy`,
  `Exp eye` (Squint Eye [8]), `Heart Eye`, `Star Eye`, `Sweat`,
  `【SV】Mic`, `【SV】Baguette`, `【Utau】Mic`, `SV Utau ALT`. None map to
  emotion bindings; LLM uses them via `{code}` syntax.
- **D-A2-5:** **`_avatar_overrides.yaml` schema has 2 catalogs, NOT 3.**
  `variants[]` + `events[]`. No `emotion_bindings` section. No
  `plugins.{plugin_name}.*` namespaced section.
- **D-A2-6:** **Milestone-1 SC #2 (`[joy]` → Love.exp3 300ms blend) is NOT
  preserved verbatim in v2.0.** This is a deliberate behavior change, not a
  regression. Default plugin produces a different visual for `[joy]` (head
  tilt + eye widening from ParamFrames; no Love.exp3 overlay unless user
  manually emits `{love}` for the variant toggle).

⚠ **Cross-phase flags downstream agents must respect:**

- **Phase 6 plumbing-week side-by-side §14 SC harness** must NOT compare
  against milestone-1 `IntentDriver` baselines for SC #2 / SC #3 — those
  baselines are intentionally invalidated. Harness instead captures the
  v2.0 default plugin's first-run output as the new baseline.
- **Phase 10 §14 verification** records SC #2 / SC #3 as PASS with a note
  "v2.0 default plugin behavior; milestone-1 baseline intentionally
  superseded per Phase 8 D-A2-6", not as PARTIAL or FAIL.
- **Phase 6 default plugin** must have zero hard dependency on rig exp
  files. Plugin reads `RigCapabilities` (sign_inversions, available param
  IDs) for adaptation; plugin does NOT read `_avatar_overrides.yaml`
  variants/events catalogs (those are Phase 7's domain).

### A3. Review screen UX

- **D-A3-1:** **Single page scrollable layout.** Header (avatar name + path
  + detected type) → Variants table → Events table (or "Avatar exposes no
  motion events" empty state) → footer warnings + Save button. NO tabs, NO
  wizard. Same affordance shape as Phase 9 HUD route (consistent dedicated-
  route UX vocabulary).
- **D-A3-2:** **Placeholder definition (Save-disabled friction):** ONLY
  Cubism `exp_NN` style names trigger the gate. Specifically: any code that
  matches `^exp_?\d+$` (case-insensitive). VTS-extracted codes
  (`sv-microphone` after dec-strip) and OLVT codes (`hold-mic`) are NOT
  placeholders. Single-page Save button shows `Save disabled — N
  placeholder names remain` with a link to the first such row.
- **D-A3-3:** **Per-row controls (4):**
  1. Edit code (text field; live-validated against reserved-name guard +
     duplicate-within-catalog check; jsonschema slug rule
     `^[a-z][a-z0-9-]{0,30}$`).
  2. Delete row (per-row trash icon; deleted entries are NOT registered as
     hotkeys at runtime — Phase 7 dispatch ignores them; equivalent to
     milestone-1's `is_meta=true` filter).
  3. Source name display (read-only secondary column showing the original
     `Star Eye [7]` style name; lets user trace what they're renaming).
  4. `{code}` preview column (renders e.g. `{star-eye}` so user sees
     LLM-facing syntax inline).

### A4. Teto migration path

- **D-A4-1:** **Run the full import flow on Teto once (dogfood).** After
  Phase 8 ships, operator selects `Live2D/重音テト/` in the file dialog,
  walks through review screen, edits 14 variant codes to semantic names,
  hits Save. Output: new `avatars/teto/_avatar_overrides.yaml`.
- **D-A4-2:** **Delete `avatars/teto/avatar.yaml` + `teto_overrides.yaml`
  in the same PR** that runs the dogfooded import. Sidecar boot path no
  longer reads either file; reads `_avatar_overrides.yaml` only. No
  legacy-fallback dual-read code.
- **D-A4-3:** **Carry milestone-1's smoke-pass artifacts forward**:
  `body_sway_strategy: head_only`, `discovered_hotkeys[]` (whose 14
  non-meta entries seed the `variants[]` codes), `notes.body_sway_…` fields
  preserved verbatim in the new file's `notes:` section.
- **D-A4-4:** **The 1 meta hotkey** (`Remove All Toggles`,
  `RemoveAllExpressions` action) is auto-filtered from the variants
  catalog by the VTS extractor (`Action !=
  "ToggleExpression"` filter, IMP-02). The 1 watermark hotkey
  (`Remove Water Mark` with `is_meta: true` from milestone-1's smoke-pass)
  is NOT auto-filtered — Phase 8 extractor doesn't look at the milestone-1
  file. **User clicks Delete on that row in the review screen** to suppress
  it. Plan-time decides whether to add a checkbox "include in catalog" or
  rely on the per-row Delete UX.

### Claude's Discretion

- **VTS hotkey identity → use `HotkeyID` UUID.** `_avatar_overrides.yaml`
  variants store `hotkey_id` (UUID), not `name`. Stable across rig rename;
  Phase 7 dispatch resolves by ID.
- **`cdi3.json` optional inclusion.** When present, populate
  `RigCapabilities.cdi3_display_names`. When missing, leave dict empty (no
  warning — cdi3 is optional in the Cubism format).
- **Real-rig sample corpus (plan-time):** Teto + Live2D Inc. samples
  (Hiyori / Mark / Wanderer) + 1 OLVT-shape rig from `OpenLLM_Vtuber/live2d-models/`
  (mao_pro is the natural pick). Community Cubism rigs deferred to a future
  milestone. 5-rig corpus is enough for hardening parser regex and
  type-detector fingerprints.
- **OLVT `model_dict.json` commit-pin (plan-time):** Pin to `OpenLLM_Vtuber`
  HEAD at Phase 8 plan-time (the local checkout at
  `C:\Users\16079\Code\OpenLLM_Vtuber\` is the reference). Schema has been
  stable; pinning a specific commit hash in `import_extractors/olvt.py`
  comment is the deliverable, not a vendored copy.
- **Naming-normalization regex (plan-time):** Auto-derived rules for VTS
  Hotkeys[] → variant code:
  1. Strip trailing `[N]` keybind suffix (`[1]`, `[Q]`, `[W]` etc.)
  2. Strip `【...】` decorative brackets (CJK full-width)
  3. Strip `[...]` ASCII square-bracket prefixes (e.g., `[SV]` if used)
  4. Replace ` ` and `&` and `＆` with `-`
  5. Lowercase + ASCII-fold (CJK ASCII-fold via romanization where
     possible; if non-romanizable, keep original CJK chars)
  6. Validate against slug rule `^[a-z][a-z0-9-]{0,30}$`; failure → row is
     marked placeholder and user must hand-edit.
  Examples Teto → expected output:
  - `【SV】Microphone[1]` → `sv-microphone`
  - `【SV＆Utau】Baguette[2]` → `sv-utau-baguette`
  - `Star Eye [7]` → `star-eye`
  - `【Chibi】[Q]` → `chibi`
- **Re-import semantics (plan-time):** When user re-imports a folder that
  already has an `_avatar_overrides.yaml` sibling, Phase 8 prompts:
  "Existing overrides found — Edit existing (default) / Replace fully /
  Cancel." Default opens the review screen pre-populated with current
  values + newly-detected entries diff-highlighted.
- **Atomic write semantics:** Write to `_avatar_overrides.yaml.tmp` →
  `os.fsync(fd)` → `os.replace()`. Pre-write jsonschema validate; fail
  loud (don't write `.tmp` if validation fails). No `.draft.yaml` retained
  on validation failure — the React state holds the draft until user
  fixes.
- **Avatar identity / source-rig-path linkage:** `_avatar_overrides.yaml`
  carries a `source_rig_path` field pointing to the imported folder
  (relative path from repo root if inside repo, absolute otherwise). Used
  at sidecar boot to locate the rig source files. Plan-time confirms.

### Folded Todos

None. (`todo match-phase 8` returned 0 matches.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope + requirements
- `.planning/ROADMAP.md` §"Phase 8: Avatar Import + Catalogs" — phase
  goals, requirements list (IMP-01..10 + ARCH-02), success criteria, plan
  stubs (08-01 / 08-02 / 08-03), and revised `8 → 6 → 7 → 9 → 10`
  execution order rationale.
- `.planning/REQUIREMENTS.md` §"Avatar Import + Catalog (Phase 8)" — 10
  IMP requirements verbatim, plus ARCH-02 row in the traceability table
  showing the 2026-05-08 move from Phase 6.
- `PROJECT_DESIGN.md` §14B (entire) — source-of-truth for the v2.0 plugin +
  animation-control milestone framing.

### Architectural invariants this phase produces
- `.planning/REQUIREMENTS.md` §"Plugin Architecture & Contracts" ARCH-01..12
  — read ARCH-01 (system/plugin separation), ARCH-02 (`RigCapabilities`
  contract — Phase 8 owns), ARCH-09 (KV-cache prefix-stable system prompt
  assembly — Phase 8 schema feeds this), ARCH-12 (system-primitive
  override list, currently `MouthOpenY`-only).

### Research synthesis
- `.planning/research/v2.0/SUMMARY.md` — milestone-level research synthesis;
  read §"Phase 8: Avatar Import + Catalog Auto-Extraction" for stack
  choices (stdlib `json`, `pyyaml`, `jsonschema 4.26.0`).
- `.planning/research/v2.0/PITFALLS.md` (if present) — phase-specific
  pitfalls with anchor IDs.
- `.planning/research/v2.0/architecture-domain.md` (if present) — section
  on avatar-import flow + four-extractor design.

### Cross-phase context
- `.planning/phases/04-action-compositor-vts-bridge-body-sway-investigation/04-CONTEXT.md`
  — milestone-1's `TetoOverrides` schema definition + rationale; D-decisions
  about per-rig override file shape that Phase 8's `AvatarOverrides`
  rename inherits.
- `.planning/phases/04-action-compositor-vts-bridge-body-sway-investigation/04-04-PLAN.md`
  + `04-PROVENANCE.md` — body-sway investigation evidence; informs which
  fields stay in `AvatarOverrides` (sign_inversions, body_sway_strategy,
  proxy_body_param) vs. which migrate to `RigCapabilities`.

### Live source files Phase 8 modifies/replaces
- `sidecar/src/sidecar/avatar/capabilities.py` — milestone-1
  `AvatarCapabilities` Pydantic class. **Phase 8 deletes this file** (D-A1-1).
- `sidecar/src/sidecar/avatar/overrides.py` — milestone-1 `TetoOverrides`
  Pydantic class. **Phase 8 renames + extends to `AvatarOverrides`** (IMP-09).
- `sidecar/src/sidecar/orchestrator/orchestrator.py` — current callers of
  `AvatarCapabilities.tag_vocabulary()`. Phase 6 rewrites this; Phase 8
  surfaces the deletion as a Phase 6 prerequisite.
- `sidecar/scripts/teto_smoke_pass.py` — milestone-1 04-00 entry-gate
  smoke-pass; Phase 8's `vts_introspect_smoke.py` (IMP-10) inherits its
  pyvts handshake pattern.
- `apps/electron-main/src/ipc.ts` — IPC handler registry. Phase 8 adds
  `ipc:avatar:import-pick`.
- `apps/renderer/src/screens/` — milestone-1 has Agent / Chat / LLMSetup /
  Settings / Setup. Phase 8 adds `AvatarImport`.

### External format specs
- [Live2D CubismSpecs / FileFormats](https://github.com/Live2D/CubismSpecs) —
  `model3.json`, `motion3.json`, `cdi3.json`, `exp3.json` canonical schemas.
- [DenchiSoft VTubeStudio repo + wiki](https://github.com/DenchiSoft/VTubeStudio)
  — `.vtube.json` Hotkeys[] shape; VTS API "1.0" introspection messages.
- `C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json` — local OLVT
  reference for `actionMap` extractor schema. Pin to OLVT HEAD at
  plan-time.

### Sample rig data for testing (in repo)
- `Live2D/重音テト/` — Teto rig source (VTS-shape; will dogfood Phase 8
  import flow). Note: `model3.json.FileReferences` lacks `Expressions[]`
  → rig is technically Cubism-bare with VTS Hotkeys[] augmentation. The
  type detector may fingerprint it as VTS (per `.vtube.json` presence)
  rather than Cubism-bare; plan-time confirms.
- `avatars/teto/avatar.yaml` + `teto_overrides.yaml` — milestone-1
  hand-curated state. **Both deleted by Phase 8 close.**
- `C:\Users\16079\Code\OpenLLM_Vtuber\live2d-models\mao_pro\` — natural
  OLVT-shape sample for `import_extractors/olvt.py` regression tests.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`apps/electron-main/src/ipc.ts`** — milestone-1 IPC handler registry.
  Phase 8 adds `ipc:avatar:import-pick` here. `dialog.showOpenDialog()`
  pattern present from PLUMB-04 LLM setup screen path.
- **`apps/renderer/src/screens/LLMSetup/`** (precise path TBD at plan-time)
  — milestone-1's mandatory-screen-blocking-app-entry pattern (PLUMB-04).
  Phase 8's review screen reuses the same "dedicated React route, blocks
  Save until friction satisfied" UX pattern.
- **`sidecar/src/sidecar/avatar/overrides.py`** — milestone-1
  `TetoOverrides` Pydantic. The file already has `model_validator` shape
  + safe-default loader / save_overrides serializer that
  `AvatarOverrides` will inherit verbatim (just rename + add
  `variants[]` + `events[]` + `voice` fields).
- **`sidecar/scripts/teto_smoke_pass.py`** — milestone-1 04-00 pyvts
  handshake + introspection script. Phase 8's `vts_introspect_smoke.py`
  (IMP-10) is a near-clone with `getModelInfo` / `getParameterList` /
  `getHotkeyList` calls verified against pyvts 0.3.3.
- **`packages/contracts/`** — milestone-1 contracts package (Pydantic
  source-of-truth + hand-written TS mirror). Phase 5 (executing in
  parallel) lands the codegen pipeline; Phase 8's new contracts
  (`RigCapabilities`, `AvatarOverrides`, `VariantEntry`, `EventEntry`,
  `AvatarImportPlan`) get codegen for free if Phase 5 lands first.

### Established Patterns

- **Pydantic-source-of-truth + hand-written TS mirror (until Phase 5
  codegen lands)** — milestone-1 D-decisions enforce this; Phase 8 follows
  same pattern.
- **Atomic file write (sidecar)** — milestone-1 doesn't have an
  established helper; Phase 8 writes its own (`_avatar_overrides.yaml.tmp`
  → fsync → replace) and exposes as a util the LLM-setup safe-storage
  path doesn't need.
- **Loud-failure boot loader** — milestone-1 D-08 (capabilities.py raises
  Pydantic ValidationError on schema drift; boot must abort). Phase 8's
  `_avatar_overrides.yaml` loader inherits this; jsonschema validation
  failure aborts boot rather than silently running with empty catalogs.
- **OLVT-direct port preference** — user feedback memory
  `feedback_olvt_port_preference.md`. Phase 8's OLVT extractor follows
  OLVT's `model_dict.json` schema directly; deviations require explicit
  rationale.

### Integration Points

- **Sidecar boot sequence** — `_avatar_overrides.yaml` loader runs at
  startup (currently `load_overrides(avatar_dir)` in `overrides.py`).
  Phase 8 expands this with the new schema; Phase 6 plugin runtime then
  reads from `RigCapabilities` (constructed from rig file parsing +
  `AvatarOverrides`) at `on_load(capabilities)`.
- **Renderer routing** — milestone-1 has 5 screens. Phase 8 adds the 6th
  (`AvatarImport`) on a dedicated route. AppShell routing pattern
  (`apps/renderer/src/chrome/AppShell.tsx`) is the integration touch
  point.
- **Electron `userData` path** — milestone-1 uses
  `app.getPath('userData')` for `safe-storage.ts` LLM credentials.
  Phase 8's user-imported avatars follow the same pattern:
  `userData/avatars/<id>/_avatar_overrides.yaml`. In-tree
  `avatars/teto/` stays for the dogfooded migration; future user
  imports go to `userData/avatars/`.

</code_context>

<specifics>
## Specific Ideas

- **User architectural insight (Area 2 mid-discussion):** "Plugin developers
  should add `[joy]` codes themselves; the import flow should only extract
  what the avatar actually exposes (variants + events). `Dizzy Eye` is a
  rig-exposed differential, so it goes in the variant bucket, not as an
  emotion-binding." This reframed the entire phase — emotion-bindings stop
  being a system-level catalog and become plugin-author concerns. The
  `_avatar_overrides.yaml` schema simplified from 3 catalogs to 2; the
  review screen UI simplified accordingly; OLVT `emotionMap` import was
  dropped entirely.

- **Dogfooding preference (Area 4):** User explicitly chose option (A)
  "run the full import flow on Teto" over the migration-script alternative,
  rationale being that running the actual user flow on the dev rig is the
  best validation that the import flow works at all. This means Phase 8's
  exit gate includes "operator successfully imported Teto and committed a
  working `_avatar_overrides.yaml`."

- **No bulk operations in review UI:** User declined the bulk-rename
  helpers consideration; 14 manual edits is acceptable. Plan-time should
  NOT add bulk ops without revisiting this.

- **Bracket walker reuse:** Phase 7 will REPLACE milestone-1
  `actions_extractor` with a unified `code_extractor`. Phase 8 does NOT
  need to touch the parser — it just produces the catalog data that
  Phase 7's parser validates against at boot.

</specifics>

<deferred>
## Deferred Ideas

- **Plugin-namespaced sections in `_avatar_overrides.yaml`** (e.g.,
  `plugins.default.emotion_bindings`) — discussed and explicitly
  rejected (Area 2 Q2). If a future plugin needs per-rig customization,
  the plugin author writes their own `<plugin_name>.yaml` next to the
  avatar file. Not a system contract.
- **Multiple expressions per emotion** (`dict[str, list[str]]` for
  emotion_bindings, with random/weighted pick) — not needed because
  emotion-bindings field doesn't exist.
- **Reverse migration script for users still on milestone-1 shape** — not
  needed; only avatar in milestone-1 was Teto, and Teto is dogfooded
  (D-A4-1).
- **LLM-suggested semantic naming during import review** — research
  flagged as anti-feature for milestone-3+; explicitly out of Phase 8
  scope.
- **Bulk-rename helpers on review screen** — declined per user, see
  Specifics.
- **Per-avatar custom plugin selection** — milestone-3+ feature
  (PROJECT_DESIGN.md §14B framing). Phase 8 does NOT add a "plugin to use
  for this avatar" field to `_avatar_overrides.yaml`.

### Reviewed Todos (not folded)

None — `todo match-phase 8` returned 0 matches.

</deferred>

---

*Phase: 08-avatar-import-catalogs*
*Context gathered: 2026-05-08*
