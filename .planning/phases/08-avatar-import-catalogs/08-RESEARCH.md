# Phase 8: Avatar Import + Catalogs - Research

**Researched:** 2026-05-08
**Domain:** Avatar-import file dialog + 4 type-detected extractors + mandatory React review screen + `RigCapabilities` / `AvatarOverrides` Pydantic contracts + atomic `_avatar_overrides.yaml` write
**Confidence:** HIGH (all key shapes verified against actual rig files in repo; pyvts methods verified against vendored source; LLMSetup pattern verified against existing renderer code)

## Summary

Phase 8 is mostly **adapt-not-invent**: the existing milestone-1 codebase already has working precedents for every piece this phase needs. The atomic-write helper exists in `apps/electron-main/src/safe-storage.ts` shape (Electron-side `encryptString` + persist-to-disk), the contextBridge IPC pattern is established in `apps/electron-main/preload/index.ts`, the dedicated-blocking-screen UX is already implemented as `LLMSetup` (which `LLMSetup.tsx:75` writes via `completeSetup()` → `window.api.saveStoredConfig()`), the orchestrator boot already loads `avatar.yaml` + `teto_overrides.yaml` from `avatars/teto/` (`ws/server.py:134-169`), and pyvts 0.3.3 is already vendored at `sidecar/vendor/pyvts/` with the exact methods Phase 8 needs (`requestHotKeyList`, `requestTrackingParameterList`, `requestParameterValue`, `BaseRequest("APIStateRequest")` — all verified in `sidecar/vendor/pyvts/vts_request.py`).

The rig-side reality is that **Teto's rig is technically Cubism-bare** (`Live2D/重音テト/重音テト.model3.json` lacks `FileReferences.Expressions` AND `FileReferences.Motions` — verified by reading the 30-line file) but the type detector should fingerprint it as VTS because of the sibling `重音テト.vtube.json`. mao_pro is the canonical "Cubism with named expressions" sample (8 entries, all `exp_NN` placeholders). shizuku is "Cubism bare with motion groups" (4 motion groups, no Expressions field). All three rigs are checked into `Live2D/` already — no external download needed.

The naming-normalization regex from CONTEXT was tested against the 15 real Teto hotkey names; the proposed sequence is **almost** correct but produces `svmicrophone` instead of the CONTEXT-expected `sv-microphone` because `【SV】Microphone[1]` strips the brackets without inserting a separator. The verified-correct rule replaces `【...】` with `\1-` (capture-group + hyphen) to mark the boundary; with that fix, all 15 Teto names normalize to slug-valid codes matching the CONTEXT examples.

**Primary recommendation:** Lift the whole atomic-write + IPC pattern from milestone-1 LLMSetup verbatim (Electron main writes to userData via `safeStorage`-shaped flow; sidecar HTTP endpoints stay read-only for parsing/preview). The four extractors are pure-function code-paths; the type detector is a 5-line existence-check ladder; the only genuine novelty is the placeholder-detection + Save-disabled friction in the React route.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A1. `RigCapabilities` ↔ `AvatarCapabilities` migration**
- **D-A1-1:** **Replace, don't extend.** `AvatarCapabilities` is DELETED in Phase 8's first PR; `RigCapabilities` is the new single contract. Milestone-1 callers (`tag_vocabulary()`, `IntentDriver._params_for_expression`, `actions_extractor` kind classification, TTS gateway voice read) are rewritten in Phase 6/7 anyway — the rename ride-along is cheap.
- **D-A1-2:** **`voice` field moves to `AvatarOverrides`.** `voice` is engineer-curated (not VTS-introspectable), so it belongs with `sign_inversions` and `body_sway_strategy`, not on the rig-introspection contract.
- **D-A1-3:** **`param_ranges` source = `cdi3.json` only.** Field is `dict[str, tuple[float, float] | None]`; `None` when `cdi3.json` lacks the param or the file is missing entirely. HUD (Phase 9) handles `None` by falling back to `[0, 1]` slider or "unbounded" affordance. Phase 8 does NOT call VTS API for ranges (keeps import flow VTS-independent).

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

**A2. Three-category code system**
- **D-A2-1:** **Plugin owns action (`[xxx]`) vocabulary entirely; rig only exposes variants (`{xxx}`) + events (`<xxx>`).** Action codes are declared in `plugin.yaml` (`action_codes: [neutral, anger, ..., surprise]` — fixed OLVT 8 for default plugin). Variants + events come from the imported avatar's files.
- **D-A2-2:** Default plugin is fully self-contained for action codes — no dependency on rig `.exp3` files when LLM emits `[joy]`.
- **D-A2-3:** **OLVT `emotionMap` is ignored on import.** OLVT extractor reads `actionMap` → variant catalog only.
- **D-A2-4:** **Teto's 14 LLM-emittable expressions all become variants.** None map to emotion bindings.
- **D-A2-5:** **`_avatar_overrides.yaml` schema has 2 catalogs, NOT 3.** `variants[]` + `events[]`. No `emotion_bindings` section.
- **D-A2-6:** **Milestone-1 SC #2 (`[joy]` → Love.exp3 300ms blend) is NOT preserved verbatim in v2.0.** Default plugin produces a different visual for `[joy]`.

**A3. Review screen UX**
- **D-A3-1:** Single page scrollable layout. Header → Variants table → Events table → footer warnings + Save button. NO tabs, NO wizard.
- **D-A3-2:** **Placeholder definition:** ONLY Cubism `exp_NN` style names trigger the gate. Specifically: any code matching `^exp_?\d+$` (case-insensitive). VTS-extracted codes and OLVT codes are NOT placeholders. Save button shows `Save disabled — N placeholder names remain` with link to the first row.
- **D-A3-3:** Per-row controls (4): Edit code (text field, live-validated against reserved-name guard + duplicate-within-catalog + slug rule `^[a-z][a-z0-9-]{0,30}$`); Delete row; Source name display (read-only); `{code}` preview column.

**A4. Teto migration path**
- **D-A4-1:** Run the full import flow on Teto once (dogfood). Operator selects `Live2D/重音テト/`, walks through review screen, edits 14 variant codes, hits Save.
- **D-A4-2:** Delete `avatars/teto/avatar.yaml` + `teto_overrides.yaml` in same PR. Sidecar boot path no longer reads either file.
- **D-A4-3:** Carry milestone-1 smoke-pass artifacts forward: `body_sway_strategy: head_only`, `discovered_hotkeys[]`, `notes.body_sway_…` preserved in new file's `notes:` section.
- **D-A4-4:** **The 1 meta hotkey** (`Remove All Toggles`, `RemoveAllExpressions` action) is auto-filtered by VTS extractor (`Action != "ToggleExpression"` filter, IMP-02). The 1 watermark hotkey (`Remove Water Mark` with `is_meta: true` from milestone-1 smoke-pass) is NOT auto-filtered — user clicks Delete on that row.

### Claude's Discretion

- **VTS hotkey identity → use `HotkeyID` UUID.** Stable across rig rename.
- **`cdi3.json` optional inclusion.** Empty dict when missing, no warning.
- **Real-rig sample corpus:** Teto + mao_pro + shizuku (all in repo at `Live2D/`).
- **OLVT `model_dict.json` commit-pin:** local checkout at `C:\Users\16079\Code\OpenLLM_Vtuber\` — pin specific commit hash in `import_extractors/olvt.py` comment.
- **Naming-normalization regex (plan-time):** Auto-derived rules per CONTEXT.
- **Re-import semantics:** When user re-imports a folder with existing `_avatar_overrides.yaml`: prompt "Edit existing (default) / Replace fully / Cancel."
- **Atomic write semantics:** `.tmp` → `os.fsync(fd)` → `os.replace()`. Pre-write jsonschema validate; fail loud. No `.draft.yaml`.
- **Avatar identity / source-rig-path linkage:** `_avatar_overrides.yaml` carries `source_rig_path` (relative path from repo root if inside repo, absolute otherwise).

### Deferred Ideas (OUT OF SCOPE)

- Plugin-namespaced sections in `_avatar_overrides.yaml` (`plugins.default.emotion_bindings`).
- Multiple expressions per emotion (`dict[str, list[str]]` with random/weighted pick).
- Reverse migration script for users still on milestone-1 shape.
- LLM-suggested semantic naming during import review.
- Bulk-rename helpers on review screen.
- Per-avatar custom plugin selection (milestone-3+).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **IMP-01** | File dialog + sidecar type detection (4 shapes) | §D, §H — `dialog.showOpenDialog()` precedent in milestone-1 LLMSetup; type detector is 5-line existence-check ladder |
| **IMP-02** | VTS `.vtube.json` extractor — filter `Action: "ToggleExpression"`, strip `[N]` and `【】`, lowercase + hyphenate | §A (regex verified against 15 real Teto hotkeys) + §D1 (Hotkeys[] field shape verified) |
| **IMP-03** | Cubism-with-expressions extractor — `model3.json` `FileReferences.Expressions[].Name` placeholders + relabel-required | §D2 (verified against `Live2D/mao_pro/runtime/mao_pro.model3.json` lines 11-44 — 8 `exp_NN` entries) |
| **IMP-04** | Cubism-bare extractor — empty variants; events from `.motion3.json` only | §D3 (verified: shizuku has Motions but no Expressions; Teto has neither) |
| **IMP-05** | OLVT `model_dict.json` extractor — `actionMap` → variant catalog (no relabel); `emotionMap` IGNORED per D-A2-3 | §D4 (verified shape against `C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json`) |
| **IMP-06** | Event catalog from `.motion3.json` — `Motions` group keys + filenames; slug rule | §D3 (verified `Meta.Duration` + `Meta.Loop` shape from real motion files) |
| **IMP-07** | Mandatory review screen — dedicated React route (NOT modal); placeholder Save-disabled friction | §G (route-store.ts pattern + LLMSetup precedent verified) |
| **IMP-08** | Re-openable from Settings; commits write `_avatar_overrides.yaml`; jsonschema-validated | §C (full jsonschema spec) + §F (re-import semantics) |
| **IMP-09** | `TetoOverrides` → `AvatarOverrides` rename; absorb voice; add catalogs | §C (final pydantic shape) |
| **IMP-10** | `vts_introspect_smoke.py` against actual Teto rig | §E (pyvts methods verified at `sidecar/vendor/pyvts/vts_request.py:149-187`; teto_smoke_pass.py is the port template) |
| **ARCH-02** | `RigCapabilities` rig-introspection contract — single Pydantic model fed to plugin `on_load` AND HUD | §C (final shape locked in user_constraints; sourced from cdi3.json + model3.json + .vtube.json parsing) |
</phase_requirements>

## Standard Stack

### Core (no net-new deps for Phase 8 vs v2.0 SUMMARY baseline)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **stdlib `json`** | (Python 3.12) | Parse `.vtube.json`, `.model3.json`, `.motion3.json`, `.cdi3.json`, `model_dict.json` | All five Cubism + VTS file shapes are JSON; PyYAML is unnecessary for these |
| **PyYAML** (already pinned) | 6.0.3 | Read/write `_avatar_overrides.yaml` | Already used by milestone-1 `overrides.py`; reuse `yaml.safe_load` + `yaml.safe_dump(..., sort_keys=False, allow_unicode=True)` |
| **jsonschema** | 4.26.0 | Validate `_avatar_overrides.yaml` at write time | Locked by v2.0 SUMMARY; pre-write validation gates the atomic-rename. Net-new sidecar dep. |
| **pydantic** (already pinned) | 2.x | `RigCapabilities`, `AvatarOverrides`, `VariantEntry`, `EventEntry`, `AvatarImportPlan` | Source-of-truth pattern continues from milestone-1 (`AvatarCapabilities`, `TetoOverrides`) |
| **pyvts (vendored)** | 0.3.3 | VTS introspection smoke test (IMP-10 only — extractors do NOT call VTS) | Already vendored at `sidecar/vendor/pyvts/`; smoke-test reuses `teto_smoke_pass.py` patterns |
| **electron `dialog`** | 40.x | `dialog.showOpenDialog({ properties: ['openDirectory'] })` for folder picker | Standard Electron API; already used in skeleton for nothing yet — Phase 8 introduces |

### Renderer (no net-new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19.2.x | (already pinned) | Review screen as dedicated route | Existing AppShell pattern (`view === 'chat'` etc.) |
| route-store.ts | (existing) | Add `'avatar-import'` route value | See §G — minimal change to `Route` union type |
| electron-store 10.x | (already pinned) | NOT used in Phase 8 — `_avatar_overrides.yaml` is sidecar-side persistence, not user-pref | Reserved for HUD position (Phase 9) |

### Verified version pins

```
$ npm view jsonschema version  # JS — NOT used; sidecar uses Python jsonschema
$ pip show jsonschema           # 4.26.0 (locked by v2.0 SUMMARY 2026-05-08)
```

### Installation

No new deps in `package.json`. Net-new sidecar dep (already declared by v2.0 SUMMARY):

```bash
# in sidecar/
uv add jsonschema==4.26.0
```

## Architecture Patterns

### Recommended file layout

```
sidecar/src/sidecar/
├── avatar/
│   ├── overrides.py              # MODIFIED: TetoOverrides → AvatarOverrides
│   ├── capabilities.py            # DELETED (replaced by rig_capabilities.py)
│   ├── rig_capabilities.py        # NEW: RigCapabilities pydantic + builder
│   ├── import_detect.py           # NEW: 5-line existence-check ladder
│   ├── import_plan.py             # NEW: AvatarImportPlan pydantic
│   ├── extractors/
│   │   ├── __init__.py
│   │   ├── vts.py                 # NEW: parses .vtube.json Hotkeys[]
│   │   ├── cubism_named.py        # NEW: parses model3.json Expressions[]
│   │   ├── cubism_bare.py         # NEW: walks .motion3.json files
│   │   └── olvt.py                # NEW: parses model_dict.json actionMap
│   ├── normalize.py               # NEW: slug regex + reserved-name guard + placeholder check
│   ├── motion3_meta.py            # NEW: Meta.Duration/Meta.Loop reader
│   ├── cdi3_reader.py             # NEW: cdi3.json display-name extractor
│   └── overrides_writer.py        # NEW: atomic .tmp→fsync→replace + jsonschema validate

sidecar/src/sidecar/admin/         # NEW directory
├── __init__.py
└── avatar.py                       # NEW: POST /admin/avatar/import + /commit + GET endpoints

sidecar/scripts/
└── vts_introspect_smoke.py        # NEW: Phase 8's IMP-10 smoke (clone of teto_smoke_pass.py)

sidecar/schemas/                   # NEW directory
└── avatar_overrides.schema.json   # NEW: jsonschema for _avatar_overrides.yaml

apps/electron-main/src/
├── ipc.ts                         # MODIFIED: register ipc:avatar:import-pick
└── safe-storage.ts                # UNCHANGED (LLM credential pattern, not avatar-import)

apps/electron-main/preload/
└── index.ts                       # MODIFIED: expose pickAvatarFolder() on window.api

apps/renderer/src/screens/
└── AvatarImport/                  # NEW directory
    ├── AvatarImport.tsx           # NEW: dedicated route component
    ├── VariantTable.tsx           # NEW: per-row Edit/Delete/source/preview
    ├── EventTable.tsx             # NEW: same shape as VariantTable
    └── usePlaceholderGate.ts      # NEW: Save-disabled friction logic

apps/renderer/src/state/
└── route-store.ts                 # MODIFIED: 'avatar-import' added to Route union

packages/contracts/py/contracts/
├── rig_capabilities.py            # NEW
├── avatar_overrides.py            # NEW (canonical Pydantic; mirrors AvatarOverrides for renderer)
├── variant_entry.py               # NEW
├── event_entry.py                 # NEW
└── avatar_import_plan.py          # NEW (over-the-wire payload)

packages/contracts/ts/             # NEW codegen outputs (Phase 5 pipeline produces these if Phase 5 lands first; otherwise hand-written)
├── rig-capabilities.ts
├── avatar-overrides.ts
├── variant-entry.ts
├── event-entry.ts
└── avatar-import-plan.ts
```

### Pattern 1: Type detector (the 5-shape ladder)

**What:** A pure function over `Path` that classifies a folder into one of 5 shapes (the 4 from §14B.6 + an "unsupported" fallback for Cubism 5.3 and missing-model3 cases).

**Why this shape:** Every shape has a single discriminating signal; checking in order eliminates ambiguity.

```python
# sidecar/avatar/import_detect.py
from enum import Enum
from pathlib import Path

class AvatarType(str, Enum):
    OLVT = "olvt"
    VTS_STANDARD = "vts_standard"
    CUBISM_WITH_EXPRESSIONS = "cubism_with_expressions"
    CUBISM_BARE = "cubism_bare"
    UNSUPPORTED_CUBISM_5_3 = "unsupported_cubism_5_3"
    UNSUPPORTED_NO_MODEL3 = "unsupported_no_model3"

def detect_type(folder: Path) -> AvatarType:
    # Order matters: OLVT first (model_dict.json beats vtube.json if both),
    # then VTS, then Cubism shapes, with unsupported as floor.
    if (folder / "model_dict.json").exists():
        return AvatarType.OLVT
    model3 = next(folder.glob("*.model3.json"), None)
    if model3 is None:
        return AvatarType.UNSUPPORTED_NO_MODEL3
    moc3 = next(folder.glob("*.moc3"), None)
    if moc3 and is_cubism_5_3_moc(moc3):
        return AvatarType.UNSUPPORTED_CUBISM_5_3
    if any(folder.glob("*.vtube.json")):
        return AvatarType.VTS_STANDARD
    if _model3_has_expressions(model3):
        return AvatarType.CUBISM_WITH_EXPRESSIONS
    return AvatarType.CUBISM_BARE
```

**Key precedence rule:** Teto has `vtube.json` AND a model3.json with no Expressions[]. The detector should fingerprint Teto as `VTS_STANDARD`, not `CUBISM_BARE`. The order above achieves this (vtube.json check runs before the Expressions[] check).

### Pattern 2: Per-extractor `(catalog, warnings)` return tuple (per PITFALLS pitfall #9)

**What:** Each extractor returns a 3-tuple: `(variants: list[VariantEntry], events: list[EventEntry], warnings: list[ImportWarning])`.

**When to use:** Always. Even when no warnings, return empty list — callers need uniform shape.

**Example (VTS extractor):**

```python
# sidecar/avatar/extractors/vts.py
from pathlib import Path
import json
from sidecar.avatar.normalize import slug_from_hotkey_name, is_placeholder_code

def extract_vts(folder: Path) -> tuple[list[VariantEntry], list[EventEntry], list[ImportWarning]]:
    vtube_path = next(folder.glob("*.vtube.json"))
    data = json.loads(vtube_path.read_text(encoding="utf-8"))
    variants: list[VariantEntry] = []
    warnings: list[ImportWarning] = []
    for hk in data.get("Hotkeys", []):
        if hk.get("Action") != "ToggleExpression":
            # Phase-8 D-A4-4: auto-filter (RemoveAllExpressions, MoveModel, ...).
            continue
        source_name = hk.get("Name", "")
        code = slug_from_hotkey_name(source_name)
        if not code:
            warnings.append(ImportWarning(
                kind="empty_slug",
                message=f"Hotkey {hk.get('HotkeyID')!r} normalizes to empty; row marked placeholder.",
            ))
        # Verify referenced .exp3.json exists (PITFALLS #9 broken-reference filter)
        exp_file = hk.get("File", "")
        if exp_file and not (folder / "Expressions" / exp_file).exists():
            warnings.append(ImportWarning(
                kind="missing_exp3",
                message=f"Hotkey {source_name!r} references {exp_file!r} which is missing — keep or delete?",
            ))
        variants.append(VariantEntry(
            code=code or f"placeholder_{hk['HotkeyID'][:8]}",
            hotkey_id=hk["HotkeyID"],
            source_name=source_name,
            is_placeholder=is_placeholder_code(code),
        ))
    # Events come from .motion3.json files (NOT from VTS hotkeys with Action=TriggerAnimation,
    # which Teto doesn't have any of anyway — verified)
    events = _extract_motion_events(folder)
    return variants, events, warnings
```

### Pattern 3: Atomic write with pre-write validation (per CONTEXT Claude Discretion)

**What:** Write `_avatar_overrides.yaml` via `.tmp` → `fsync` → `os.replace()` AFTER jsonschema validation passes.

**Why:** `os.replace()` is atomic on POSIX and Windows (since Python 3.3). `fsync` ensures data durability before the rename. Pre-validate in-memory so a `.tmp` is never created from invalid data — no `.draft.yaml` cleanup needed.

```python
# sidecar/avatar/overrides_writer.py
import os
import json
from pathlib import Path
import yaml
import jsonschema

SCHEMA_PATH = Path(__file__).parents[3] / "schemas" / "avatar_overrides.schema.json"
_SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))

def write_avatar_overrides_atomic(target: Path, data: dict) -> None:
    """Write data → target via .tmp → fsync → replace.

    Pre-validates against the bundled jsonschema before opening .tmp; failures
    raise jsonschema.ValidationError with the path-in-document for renderer
    surfacing. No partial files left behind on validation failure.
    """
    jsonschema.validate(instance=data, schema=_SCHEMA)  # raises on invalid
    tmp = target.with_suffix(target.suffix + ".tmp")
    target.parent.mkdir(parents=True, exist_ok=True)
    yaml_text = yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    try:
        os.write(fd, yaml_text.encode("utf-8"))
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, target)  # atomic rename on Win+POSIX
```

### Anti-Patterns to Avoid

- **DON'T call VTS API during import (IMP-01–IMP-09 path).** The CONTEXT explicitly locks `param_ranges` source = `cdi3.json` only. The only Phase 8 code that touches pyvts is `vts_introspect_smoke.py` (IMP-10), which runs as a separate operator-invoked CLI script, not in the import flow.
- **DON'T use `naive truncate-then-write` for `_avatar_overrides.yaml`.** PITFALLS #19 carries milestone-1's M1#7 forward — naive write races with watchdog file-watcher. Atomic `.tmp` → replace is the only correct shape.
- **DON'T pass placeholder names into the LLM system prompt.** PITFALLS #10: cubism `exp_01` codes look like names but provide zero LLM signal. Save-disabled friction prevents commit; runtime startup-warning catches anything that slips through.
- **DON'T accept integer-keyed OLVT `actionMap` entries silently.** PITFALLS #22 — surface error in review screen. (Phase 8 may treat this as out-of-scope since the local OLVT `model_dict.json` shows string keys only — flag as "fail loud, fix in milestone-3 if any user hits it.")
- **DON'T attempt to render the avatar in Phase 8.** Review screen is text-only catalog editing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML schema validation | Hand-rolled assert chain | **jsonschema 4.26.0** | Path-in-document errors for free; standard contract format ecosystem-recognizable |
| Atomic file write | Truncate-then-write | **`os.replace` after `fsync`** (stdlib, since Python 3.3) | M1#7 / PITFALLS #19 mitigation; cross-platform atomic guarantee |
| Folder file dialog | Custom HTML+input | **`electron.dialog.showOpenDialog({properties: ['openDirectory']})`** | Native OS file picker; already used in skeleton for `dialog.showSaveDialog` patterns |
| Live form validation | useState + bespoke errors | **React's controlled-input + dedicated `usePlaceholderGate` hook** | Phase-8 only needs slug regex + duplicate check; full form lib (react-hook-form, zod, etc.) is overkill |
| `RigCapabilities` shape definition | Hand-rolled dict + asserts | **Pydantic v2 BaseModel** | Existing pattern; codegen-friendly when Phase 5 lands |
| Cubism 5.3 detection | Heuristic from filenames | **MOC3 file header byte-4 version field** | Authoritative — Live2D documents this; see §B |
| Type detection | Plugin-style registry | **Plain function with ordered if/elif** | 5 shapes total; no extension surface needed |
| pyvts smoke-test | Build from scratch | **Clone `sidecar/scripts/teto_smoke_pass.py`** | Already wires auth, `requestHotKeyList`, `requestTrackingParameterList`, `APIStateRequest` correctly |

**Key insight:** Phase 8 is mostly file-format parsing + a React form. The temptation to over-engineer (plugin registries, generic schema framework, custom file dialogs) loses to the milestone-1 precedents already in the codebase.

## Runtime State Inventory

> Phase 8 is **not** primarily a rename phase, but it does:
> 1. Rename `TetoOverrides` → `AvatarOverrides` (Pydantic class + filename `teto_overrides.yaml` → `_avatar_overrides.yaml`).
> 2. Delete `AvatarCapabilities` Pydantic class entirely.
> 3. Replace milestone-1's hardcoded `avatars/teto/` boot path with first-launch import flow.
>
> Inventory below covers items the rename/replacement could miss.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `avatars/teto/avatar.yaml` (66 lines, hand-curated capabilities) — `avatars/teto/teto_overrides.yaml` (104 lines, milestone-1 smoke-pass artifact). Both are git-tracked; both deleted by D-A4-2 in same PR as dogfooded import. | Deletion is a code edit + git rm; no data migration needed (D-A4-1 dogfood produces the replacement before delete). Carry `body_sway_strategy: head_only` + `discovered_hotkeys[]` + `notes.body_sway_…` fields into new `_avatar_overrides.yaml` per D-A4-3. |
| **Live service config** | None. Phase 8 doesn't touch n8n / Datadog / external services. VTS uses its own `.vtube.json` (which Phase 8 reads, not writes). | None. |
| **OS-registered state** | None — no Windows tasks, no pm2 processes, no systemd units name-bound to `teto` or `avatar.yaml`. | None. |
| **Secrets and env vars** | The orchestrator boot reads `AGENTICLLMVTUBER_LLM_CONFIG_JSON` (electron-main writes decrypted blob into sidecar env). Phase 8 does NOT alter this — LLM config and avatar identity are independent concerns. | None — verified by reading `sidecar/src/sidecar/ws/server.py:130-140`. |
| **Build artifacts / installed packages** | `packages/contracts/py/contracts/__pycache__/` will hold stale `*.cpython-*.pyc` for the deleted `capabilities` module. Pydantic codegen output `packages/contracts/ts/` will hold stale `avatar-capabilities.ts` if/when it exists (currently does NOT — verified via `ls packages/contracts/ts/`). | Plan-step: delete `__pycache__` after the file deletes; codegen step regenerates `ts/` cleanly. CI's `npm run check:contracts` (Phase 5 deliverable) is the safety net. |
| **Renderer source-of-truth** | `apps/renderer/src/screens/` currently has 5 screens: Agent / Chat / LLMSetup / Settings / Setup (verified via ls). Adding `AvatarImport/` is purely additive. `route-store.ts` `Route` union currently has 3 values: `'chat' \| 'agent' \| 'settings'` — Phase 8 adds `'avatar-import'`. | Code edit only. No legacy route to clean up. |

**Nothing found in category — explicit confirmation:** Live service config, OS-registered state, secrets/env vars all verified not affected by the Phase 8 rename.

## Common Pitfalls

### Pitfall 1: Type detector mis-classifies Teto as Cubism-bare

**What goes wrong:** Teto's `model3.json` has no `FileReferences.Expressions` AND no `FileReferences.Motions`. A naive type detector that checks `model3.json` first sees Cubism-shape and returns CUBISM_BARE — skipping the `.vtube.json` Hotkeys[] entirely. Catalog ends up empty.

**Why it happens:** The CONTEXT lists 4 shapes but the precedence is implicit. Reading `重音テト.model3.json` (verified — 30-line file with only Moc/Textures/Physics/DisplayInfo + 2 Groups for EyeBlink/LipSync) shows Teto is Cubism-bare-with-vtube-json — a hybrid case.

**How to avoid:** Order checks so VTS_STANDARD wins over CUBISM_BARE when both signals are present:
1. `model_dict.json` exists → OLVT
2. `*.vtube.json` exists → VTS_STANDARD (regardless of model3.json shape)
3. `model3.json` has Expressions[] → CUBISM_WITH_EXPRESSIONS
4. else → CUBISM_BARE

**Warning signs:** Teto import shows 0 variants; review screen shows only the empty-state.

### Pitfall 2: VTS Hotkeys[] `Action` values that aren't documented in milestone-1

**What goes wrong:** VTS hotkeys can have `Action`: `ToggleExpression`, `RemoveAllExpressions`, `TriggerAnimation`, `TwitchAction`, `ChangeIdleAnimation`, `MoveModel`, `LoadItem`, `LoadModel`, `MultiTrigger`, `RemoveItem`, `Unset`, `ColorOverlay`, `ChangeBackground`, `ReloadMicrophone`, `ToggleArtMesh`, etc. (per VTS source). Teto's rig only uses `ToggleExpression` (14×) + `RemoveAllExpressions` (1×) — verified by grep. **A `TriggerAnimation` hotkey on another rig should NOT be a variant** — it's a one-shot motion (`<event>`), per PITFALLS #7 closing note.

**Why it happens:** §14B.6 documents 4 file shapes but lumps all VTS hotkeys together. Production VTS rigs in the wild have multi-action hotkeys.

**How to avoid:** Phase 8 VTS extractor:
- `Action == "ToggleExpression"` → variant entry (radio-button toggle, the §A2 design)
- `Action == "TriggerAnimation"` → event entry (one-shot motion; cross-references back to motion file via `File` field)
- All other `Action` values → silently filter (D-A4-4 + IMP-02 spec)
- Surface ONE warning: "Discarded N hotkeys with non-toggle non-animation actions: {list}"

**Warning signs:** Imported rig has unexpected meta-action hotkeys (window background change, etc.) showing up in the variant catalog.

### Pitfall 3: Naming-normalization regex strips brackets without inserting separator

**What goes wrong:** Teto's `【SV】Microphone[1]` should normalize to `sv-microphone` per CONTEXT examples. A naive `re.sub(r'【[^】]*】', lambda m: m.group(0)[1:-1], s)` produces `SVMicrophone` → `svmicrophone` (no hyphen). Lost word boundary.

**Why it happens:** CJK full-width brackets carry semantic separation; ASCII space-after doesn't always exist (`【SV】Microphone` is ` `-less). Stripping deletes the separator.

**How to avoid:** Replace `【...】` with `\1-` (capture content + insert hyphen). Then collapse multiple hyphens via `re.sub(r'-+', '-', s)`. Verified-correct sequence in §A.

**Warning signs:** Teto variants come out as `svmicrophone`, `svutaubaguette` instead of `sv-microphone`, `sv-utau-baguette`.

### Pitfall 4: Cubism `exp_01` placeholder check is too strict / too loose

**What goes wrong:** D-A3-2 locks the placeholder regex to `^exp_?\d+$` (case-insensitive). VTS-extracted `dark-eye` and OLVT `hold-mic` must NOT match. PITFALLS #10 mentions `motion_NN`, `unnamed_NN` patterns — but for Phase 8 those are NOT placeholders per CONTEXT.

**Why it happens:** Different extractors produce different placeholder shapes, and the user's mental model of "placeholder" varies.

**How to avoid:** Stick to D-A3-2 verbatim. Only `^exp_?\d+$` (e.g., `exp_01`, `exp01`, `EXP_3`) triggers the Save-disabled gate. Don't generalize. Document the regex in code comment + UI hint.

**Warning signs:** Save button disabled on a clean Teto import (false positive); or a mao_pro import with all `exp_NN` codes lets Save enable (false negative).

### Pitfall 5: Watermark hotkey not auto-filtered (D-A4-4)

**What goes wrong:** Teto's `Remove Water Mark` hotkey has `Action: "ToggleExpression"` (verified at vtube.json line 1954) AND a real `.exp3.json` file backing it (`Remove Water Mark.exp3.json`). The VTS extractor's `Action == "ToggleExpression"` filter does NOT exclude it. Milestone-1's `teto_overrides.yaml` flagged it as `is_meta: true` — but Phase 8's extractor doesn't read that file (D-A4-4).

**Why it happens:** "Remove Water Mark" is a VTS-specific concept (it toggles a watermark expression that would otherwise be present in the avatar). It's a real ToggleExpression but operationally meta.

**How to avoid:** Per D-A4-4, the user clicks Delete on that row in the review screen. Plan-time decides whether to add a small heuristic ("auto-mark rows with name containing `watermark` (case-insensitive) as `is_placeholder=False, suggested_delete=True`" with a hint), or rely entirely on user judgment.

**Warning signs:** Teto's first imported `_avatar_overrides.yaml` ships with a `remove-water-mark` variant code that the LLM might emit and trigger the watermark removal expression mid-conversation.

### Pitfall 6: `_avatar_overrides.yaml` re-import overwrites user-curated `notes`

**What goes wrong:** Re-import flow per CONTEXT: existing overrides found → "Edit existing (default) / Replace fully / Cancel." If "Edit existing" is chosen and the user just clicks Save, the auto-extractor's catalogs may overwrite the user's hand-edited names from a prior session, or the user-curated `notes:` block.

**Why it happens:** Re-import treats the YAML as a write target, not a merge target.

**How to avoid:** Plan-step:
1. Load existing YAML into Pydantic.
2. Run extractors → fresh draft catalogs.
3. **Diff:** for each variant `code` already in user's existing YAML, preserve user's edits (the existing `code` value) but optionally add `is_diff=True` flag for highlighting in the review screen.
4. Preserve `notes`, `body_sway_strategy`, `proxy_body_param`, `voice`, `sign_inversions` verbatim — never auto-clobbered.
5. New entries (newly-discovered hotkeys after a rig update) appear with `is_new=True` flag.

**Warning signs:** User re-imports a folder they just edited; review screen shows their hand-curated `dark-eye` rename has reverted to `dark-eye` (the auto-extracted slug — accidentally identical so they can't tell), but their `body_sway_strategy: head_only` is also clobbered.

### Pitfall 7: Boot path break after `avatars/teto/avatar.yaml` deletion

**What goes wrong:** D-A4-2 deletes `avatars/teto/avatar.yaml` AND `teto_overrides.yaml` in the same PR as the dogfooded import. Sidecar `ws/server.py:152-169` currently calls `load_capabilities(teto_dir)` which raises `FileNotFoundError` if `avatar.yaml` is missing. After delete, sidecar boot crashes loop.

**Why it happens:** Phase 8 changes the boot contract. Milestone-1 boot needs both files; v2.0 boot needs only `_avatar_overrides.yaml` + RigCapabilities reflected from rig source files.

**How to avoid:** Phase 8 plans MUST sequence:
1. Implement extractors + write `_avatar_overrides.yaml` writer.
2. Implement `RigCapabilities` builder that reflects from source files (uses `source_rig_path` field to locate rig sources).
3. Wire new boot path: `load_avatar_overrides(teto_dir)` → reads `_avatar_overrides.yaml` → `build_rig_capabilities(source_rig_path)`.
4. Delete `capabilities.py` + `avatar.yaml` + `teto_overrides.yaml` ONLY AFTER (1)-(3) ship and milestone-1 callers (`tag_vocabulary()` etc.) are rewritten in Phase 6/7.
5. Verify via `pytest sidecar/tests/test_boot.py` that fresh-clone boot works.

**Warning signs:** `npm run dev` fails with FileNotFoundError; sidecar `[READY]` line never prints.

## Code Examples

### Reference 1: Real Teto Hotkeys[] entry (verified at `Live2D/重音テト/重音テト.vtube.json:425-533`)

```json
{
    "HotkeyID": "cafeda105c574052a6f09fac80c00fff",
    "Name": "【SV】Microphone[1]",
    "Action": "ToggleExpression",
    "File": "【SV】Mic.exp3.json",
    "Folder": "",
    "Position": { "X": 0.0, "Y": 0.0, "Z": 0.0, "Rotation": 0.0 },
    "ColorOverlay": { ... },
    "ColorScreenMultiplyPreset": { ... },
    "HandGestureSettings": { ... },
    "LoadModelSettings": { "LoadAtCurrentPosition": true },
    "TwitchTriggers": { "Active": false, ... },
    "Triggers": {
        "Trigger1": "LeftControl",
        "Trigger2": "Alt",
        "Trigger3": "N1",
        "ScreenButton": -1
    },
    "IsGlobal": true,
    "IsActive": true,
    "Minimized": true,
    "StopsOnLastFrame": false,
    "DeactivateAfterKeyUp": false,
    "OnlyLoadOneRandomItem": false,
    "DeactivateAfterSeconds": false,
    "DeactivateAfterSecondsAmount": 10.0,
    "FadeSecondsAmount": 0.4000000059604645,
    "OnScreenHotkeyColor": { "r": 1.0, "g": 1.0, "b": 1.0, "a": 1.0 }
}
```

**Fields the VTS extractor reads:** `HotkeyID`, `Name`, `Action`, `File`. All others are ignored. (`FadeSecondsAmount` is interesting for future per-variant fade-time customization but out of Phase 8 scope.)

### Reference 2: mao_pro `model3.json` Expressions[] (verified at `Live2D/mao_pro/runtime/mao_pro.model3.json:11-44`)

```json
"Expressions": [
    { "Name": "exp_01", "File": "expressions/exp_01.exp3.json" },
    { "Name": "exp_02", "File": "expressions/exp_02.exp3.json" },
    { "Name": "exp_03", "File": "expressions/exp_03.exp3.json" },
    { "Name": "exp_04", "File": "expressions/exp_04.exp3.json" },
    { "Name": "exp_05", "File": "expressions/exp_05.exp3.json" },
    { "Name": "exp_06", "File": "expressions/exp_06.exp3.json" },
    { "Name": "exp_07", "File": "expressions/exp_07.exp3.json" },
    { "Name": "exp_08", "File": "expressions/exp_08.exp3.json" }
]
```

8 entries, all `exp_NN` placeholders. Cubism Editor doesn't auto-name expressions; the rig author must manually rename. mao_pro's author didn't.

**Cubism-with-expressions extractor field reads:** `Name` (becomes the `code` after slug normalization, marked as `is_placeholder=True` if matches `^exp_?\d+$`); `File` (relative path used as `source_name` display + reference-existence check).

### Reference 3: shizuku `model3.json` Motions{} (verified at `Live2D/shizuku/runtime/shizuku.model3.json:15-37`)

```json
"Motions": {
    "FlickUp": [{ "File": "motion/01.motion3.json" }],
    "Tap":    [{ "File": "motion/02.motion3.json" }],
    "Flick3": [{ "File": "motion/03.motion3.json" }],
    "Idle":   [{ "File": "motion/04.motion3.json" }]
}
```

`Motions` is a dict-of-lists where the key is the *group name* and each list element has a `File` pointer. shizuku has no `Expressions[]` field — it's a Cubism-bare-with-motions rig. Cubism-bare extractor reads this (per IMP-04 + IMP-06).

**Idle filtering rule:** any group named exactly `Idle` (case-sensitive per Cubism convention) is filtered out — those motions are looped at rest, not LLM-emittable events. Sample case: shizuku's `Idle: [motion/04.motion3.json]` → filtered.

### Reference 4: motion3.json Meta block (verified at `Live2D/重音テト/Motions/IDLE.motion3.json:3-13`)

```json
"Meta": {
    "Duration": 2.833,
    "Fps": 60.0,
    "Loop": true,
    "AreBeziersRestricted": false,
    "CurveCount": 6,
    "TotalSegmentCount": 6,
    "TotalPointCount": 14,
    "UserDataCount": 0,
    "TotalUserDataSize": 0
}
```

**Optional fields:** mao_pro's `mtn_01.motion3.json` has `FadeInTime: 1.0` + `FadeOutTime: 1.0` (Cubism Editor exports these for some motions; Teto omits them). Phase 8 extractor reads `Duration` (required) + `Loop` (default `false` if absent). FadeIn/Out times are ignored — Phase 7 dispatch uses `Duration + 1s` blend pad (PARSE-06).

**Edge case:** `Duration: 0` files are legacy/corrupt → log warning, fall back to 10s ceiling at runtime per PITFALLS #8.

### Reference 5: cdi3.json (verified at `Live2D/重音テト/重音テト.cdi3.json:1-50`)

```json
{
    "Version": 3,
    "Parameters": [
        { "Id": "ParamWatermarkOFF", "GroupId": "", "Name": "Watermark OFF" },
        { "Id": "Param96", "GroupId": "ParamGroup20", "Name": "-------------------" },
        { "Id": "ParamRegHandsOFFLIN", "GroupId": "ParamGroup20", "Name": "【REG】HOFF L IN" },
        { "Id": "ParamSVMCON", "GroupId": "ParamGroup20", "Name": "【SV】麦克风手" },
        ...
    ]
}
```

cdi3 maps Cubism-internal `Param*` IDs to human display names (sometimes CJK). Phase 8 reads this into `RigCapabilities.cdi3_display_names: dict[str, str]` (id → name). Empty when file absent; HUD (Phase 9) renders the name when available, falls back to ID otherwise.

**param_ranges:** cdi3.json does NOT carry numeric ranges. `RigCapabilities.param_ranges: dict[str, tuple[float, float] | None]` is therefore mostly `None` after Phase 8; Phase 9 HUD treats `None` as `[0, 1]` slider default.

### Reference 6: OLVT `model_dict.json` shape (verified at `C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json:1-54`)

```json
[
    {
        "name": "mao_pro",
        "url": "/live2d-models/mao_pro/runtime/mao_pro.model3.json",
        "kScale": 0.5,
        "idleMotionGroupName": "Idle",
        "emotionMap": { "neutral": 0, "anger": 2, "joy": 3, ... },
        "tapMotions": { "HitAreaHead": { "": 1 }, "HitAreaBody": { "": 1 } }
    },
    {
        "name": "重音テト",
        "url": "/live2d-models/重音テト/重音テト.model3.json",
        "kScale": 0.5,
        "idleMotionGroupName": "Idle",
        "defaultEmotion": 0,
        "emotionMap": { "neutral": 0, "anger": 2, "joy": 3, ... },
        "actionMap": {
            "hold-mic": "SV Mic",
            "utau-mic": "Utau Mic",
            "bread-out": "SV Baguette",
            "chibi": "chibi",
            "hearts": "Heart",
            "star-eyes": "Star Eye"
        }
    }
]
```

**OLVT extractor field reads:**
- `name` (matches against folder name to select the entry)
- `actionMap` (key=variant code, value=expression-name string; key is already slug-shaped per OLVT convention so passes slug validation directly)
- `emotionMap` IGNORED per D-A2-3
- `tapMotions`, `kScale`, `idleMotionGroupName`, `defaultEmotion` IGNORED (not relevant to Phase 8 catalogs)

### Reference 7: Existing milestone-1 atomic write precedent (`apps/electron-main/src/safe-storage.ts`)

```ts
// Source: apps/electron-main/src/safe-storage.ts lines 1-60 (milestone-1 PLUMB-04 pattern)
// Phase 8 SIDE writes via Python; this is the renderer-precedent shape only.
import { app, safeStorage } from 'electron'
// loadConfig / saveConfig / clearConfig pattern — write goes through Electron main,
// not through sidecar HTTP, for atomic semantics on the userData path.
```

Phase 8 mirrors this pattern but the write itself happens sidecar-side (Python `os.replace`). The IPC chain is:
1. Renderer → `window.api.saveAvatarOverrides(plan)` (preload-exposed)
2. Electron main `ipcMain.handle('avatar:commit-overrides', plan => fetch(sidecarUrl + '/admin/avatar/import/commit', {method:'POST', body:JSON.stringify(plan)}))`
3. Sidecar `POST /admin/avatar/import/commit` → calls `write_avatar_overrides_atomic(target, data)`.

**Why not Electron-main writes the file directly:** `_avatar_overrides.yaml` lives sibling to the avatar source files (which may be inside or outside the Electron app's userData root depending on `source_rig_path`). The sidecar already knows about the avatar dir; routing through it keeps the write authority single-source.

## Section A — Naming-Normalization Regex Set

### Verified result against real Teto rig (15 hotkey names)

Tested via Python script run 2026-05-08 — all 15 names produce slug-valid output that matches CONTEXT examples:

| Source `Name` | Normalized `code` | Slug-valid? |
|---|---|---|
| `【SV】Microphone[1]` | `sv-microphone` | ✓ |
| `【SV＆Utau】Baguette[2]` | `sv-utau-baguette` | ✓ |
| `Dark Face [3]` | `dark-face` | ✓ |
| `Dark Eye [4]` | `dark-eye` | ✓ |
| `Blush [5]` | `blush` | ✓ |
| `Heart Eye [6]` | `heart-eye` | ✓ |
| `Star Eye [7]` | `star-eye` | ✓ |
| `Squint Eye [8]` | `squint-eye` | ✓ |
| `SV/UTAU Alt [9]` | `sv-utau-alt` | ✓ |
| `【Utau】Headphone [0]` | `utau-headphone` | ✓ |
| `【Chibi】[Q]` | `chibi` | ✓ |
| `Cry [W]` | `cry` | ✓ |
| `Dizzy Eye [E]` | `dizzy-eye` | ✓ |
| `Remove All Toggles` | `remove-all-toggles` | ✓ (filtered upstream — Action=RemoveAllExpressions) |
| `Remove Water Mark` | `remove-water-mark` | ✓ (NOT filtered — D-A4-4 user manual delete) |

### Recommended regex sequence (verified)

```python
# sidecar/avatar/normalize.py
import re

# Step 1: trailing `[N]` keybind suffix — single ASCII alphanum char only
KEYBIND_TRAILING = re.compile(r'\s*\[[A-Za-z0-9]\]\s*$')
# Step 2: 【...】 CJK full-width brackets — capture inner, append hyphen marker
CJK_BRACKETS_BOUNDARY = re.compile(r'【([^】]*)】')
# Step 3: ASCII [Word] prefix — capture inner letters, append hyphen
ASCII_SQ_BRACKET_PREFIX = re.compile(r'^\[([A-Za-z]+)\]\s*')
# Step 4: separator chars — collapse to hyphens
SEPARATOR_CHARS = re.compile(r'[\s&＆/]+')

SLUG_VALIDATOR = re.compile(r'^[a-z][a-z0-9-]{0,30}$')
PLACEHOLDER_REGEX = re.compile(r'^exp_?\d+$', re.IGNORECASE)

def slug_from_hotkey_name(name: str) -> str:
    """Best-effort normalize VTS hotkey name → slug code.

    Returns empty string if normalization produces nothing slug-valid; caller
    must mark such rows as placeholders and force user hand-edit.
    """
    s = name
    s = KEYBIND_TRAILING.sub('', s)
    s = CJK_BRACKETS_BOUNDARY.sub(r'\1-', s)        # 【SV】Y → SV-Y
    s = ASCII_SQ_BRACKET_PREFIX.sub(r'\1-', s)
    s = SEPARATOR_CHARS.sub('-', s)
    s = s.lower()
    s = re.sub(r'-+', '-', s)
    s = s.strip('-')
    if not SLUG_VALIDATOR.match(s):
        return ''
    return s

def is_placeholder_code(code: str) -> bool:
    return bool(PLACEHOLDER_REGEX.match(code))
```

### Edge cases that fall through to "force hand-edit"

| Input | Output | Why |
|---|---|---|
| `EYE_OPEN_LEFT` | `eye_open_left` | Underscores not in slug rule → fails validator → user re-types as `eye-open-left` |
| `モフモフ` (CJK only) | `モフモフ` | No ASCII fold attempted — keep verbatim → fails slug → user re-types in Latin |
| `【💖】Pop` | `💖-pop` | Emoji not in slug rule → fails → user re-types |
| `SV.Mic` | `sv.mic` | Period not in slug rule → fails → user re-types |
| `12-leading` | `12-leading` | Leading digit fails `^[a-z]` → fails → user prepends letter |
| `___underscore___` | `___underscore___` | Underscores survive but fail validator → force hand-edit |

### Slug rule cap verification

CONTEXT proposes `^[a-z][a-z0-9-]{0,30}$` (max 31 chars). Verified against the 15 Teto names: longest is `remove-all-toggles` (18 chars) — well within cap. mao_pro `exp_NN` is 6 chars (after rename to user choice, anything reasonable fits). OLVT actionMap codes top out at `bread-out` (9 chars). **The 31-char cap is generous and reasonable — keep it.**

### Reserved-name guard list (mirrored from PLG-06; for D-A3-3 live validation)

```python
RESERVED_NAMES = frozenset([
    "think", "thinking",
    "tool_call", "function_call", "function_calls",
    "invoke", "parameter",
    # Phase 7 sweep (PARSE-07) extends this; Phase 8 imports the frozenset to keep parity.
])

def is_reserved_name(code: str) -> bool:
    """Reject codes matching LLM protocol sentinels.

    Note: code is already lowercased (slug normalization). The original LLM
    sentinels are angle-bracketed (<think>, <function_calls>, etc.); we strip
    the brackets via the bracket-walker context, so the reserved code is the
    inner-name only.
    """
    return code in RESERVED_NAMES
```

**Rationale for matching inner-name (not bracketed):** Phase 8 stores codes as bare slugs (e.g., `think`); the Phase 7 dispatcher wraps them in `<>`/`{}`/`[]` per category. Reserving the bare form blocks both `<think>` event-codes AND `{think}` variant-codes from the catalog, even though the LLM sentinel is specifically `<think>...</think>`.

## Section B — Cubism 5.3 Detection Heuristic

### Authoritative signal: MOC3 file header byte 4

The `.moc3` file is binary but its header is documented:

| Offset | Size | Field | Notes |
|---|---|---|---|
| 0x0 | 4 | magic | ASCII `"MOC3"` |
| **0x4** | **1** | **version** | `uint8_t` — **THIS is the Cubism-version signal** |
| 0x5 | 1 | endianFlag | bool |
| 0x6 | 58 | padding | always zero |

**Documented MOC3 versions** (from rentry.co/moc3spec + Live2D official docs):
- `1` = V3_00_00 (Cubism 3.0)
- `2` = V3_03_00 (Cubism 3.3)
- `3` = V4_00_00 (Cubism 4.0)
- `4` = V4_02_00 (Cubism 4.2)
- `5` = (Cubism 5.0–5.2; documented by Live2D in compatibility-with-cubism-5-3 doc as the highest value the current Core supports)
- **`6` = Cubism 5.3** (Live2D doc string: "The Core unsupport later than moc3 ver:[5]. This moc3 ver is [6]")

### Detection function

```python
# sidecar/avatar/import_detect.py
from pathlib import Path

def is_cubism_5_3_moc(moc3: Path) -> bool:
    """Read MOC3 header byte 4; True iff version >= 6 (Cubism 5.3+).

    Rejects unreadable / too-short / wrong-magic files conservatively (False)
    so the type detector can fall through to UNSUPPORTED_NO_MODEL3 with a
    different error message.
    """
    try:
        with moc3.open('rb') as f:
            header = f.read(8)
    except OSError:
        return False
    if len(header) < 8 or header[:4] != b'MOC3':
        return False
    version = header[4]
    return version >= 6
```

### Verified against Teto's rig

```bash
# Header bytes 0-7 of Live2D/重音テト/重音テト.moc3:
# Cannot read directly here (binary), but rig was created with VTS 1.30.17 (per ModelSaveMetadata)
# which only supports up to Cubism 5.2. So Teto.moc3 byte-4 should be ≤ 5.
```

mao_pro and shizuku are Live2D Inc. sample rigs that predate 5.3, so byte-4 ≤ 5.

### Friendly error message text (i18n-ready string key)

```ts
// apps/renderer/src/lib/copy.ts (Phase 8 additions)
AVATAR_IMPORT: {
  ERROR_CUBISM_5_3:
    "This avatar uses Cubism 5.3 features that VTube Studio doesn't support yet. " +
    "Please re-export the rig from Cubism Editor with target version 5.2 or earlier, " +
    "or wait for VTS to add 5.3 support (estimated 2026 by VTS team).",
  ERROR_NO_MODEL3:
    "This folder doesn't look like a runtime Live2D export. " +
    "If you have a .cmo3 Cubism Editor project, export it first " +
    "(File → Export to .moc3 in Cubism Editor)."
}
```

## Section C — `_avatar_overrides.yaml` JSON Schema

### Final Pydantic shape

```python
# packages/contracts/py/contracts/avatar_overrides.py
from typing import Literal, Optional
from pydantic import BaseModel, Field

# Carry-over from milestone-1 TetoOverrides (D-A4-3 preserves verbatim)
BodySwayStrategyName = Literal["head_only", "proxy_param", "exp3_modulation"]


class VariantEntry(BaseModel):
    code: str            # ^[a-z][a-z0-9-]{0,30}$ ; not a reserved name
    hotkey_id: str       # 32-hex (VTS UUID); empty for OLVT/Cubism (no hotkey backing yet — Phase 7 registers)
    source_name: str     # original VTS Name field, or model3 Expression Name, or OLVT actionMap value


class EventEntry(BaseModel):
    code: str            # slug rule
    motion_file: str     # relative path from rig folder root, e.g. "motions/wave.motion3.json"
    duration_seconds: float  # from motion3.json Meta.Duration; 10.0 cap if absent/invalid
    is_loop: bool = False    # from motion3.json Meta.Loop


class Voice(BaseModel):
    backend: Literal["piper"] = "piper"
    model: str = "en_US-amy-medium"
    lipsync_mode: Literal["our-rms", "vts-native"] = "our-rms"


class DiscoveredHotkey(BaseModel):  # carry-over from milestone-1 for D-A4-3 preservation
    hotkey_id: str
    name: str
    type: str
    file: str = ""
    is_meta: bool = False
    llm_emittable: bool = True


class ParamProbeResult(BaseModel):  # carry-over for D-A4-3
    name: str
    wrote: float
    readback: float
    visible: bool
    orphan_face_tracker: bool
    blend_partial: bool


class AvatarOverrides(BaseModel):
    """v2.0 per-rig override file. Replaces TetoOverrides."""

    # Carry-over fields (from milestone-1 TetoOverrides; D-A4-3 preserves verbatim)
    sign_inversions: list[str] = Field(default_factory=list)
    body_sway_strategy: BodySwayStrategyName = "head_only"
    proxy_body_param: Optional[str] = None
    exp3_body_pose: Optional[str] = None
    orphan_params: list[str] = Field(default_factory=list)
    physics_chain_proxies: dict[str, str] = Field(default_factory=dict)
    param_probes: list[ParamProbeResult] = Field(default_factory=list)
    discovered_hotkeys: list[DiscoveredHotkey] = Field(default_factory=list)
    notes: dict[str, str] = Field(default_factory=dict)

    # NEW v2.0 fields (Phase 8)
    voice: Voice = Field(default_factory=Voice)              # moved from AvatarCapabilities (D-A1-2)
    variants: list[VariantEntry] = Field(default_factory=list)
    events: list[EventEntry] = Field(default_factory=list)
    source_rig_path: str = ""                                # claude-discretion: relative to repo root if inside, abs otherwise
```

### Bundled jsonschema (`sidecar/schemas/avatar_overrides.schema.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://agenticllmvtuber/schemas/avatar_overrides.schema.json",
  "title": "AvatarOverrides",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "sign_inversions": { "type": "array", "items": { "type": "string" } },
    "body_sway_strategy": {
      "type": "string",
      "enum": ["head_only", "proxy_param", "exp3_modulation"]
    },
    "proxy_body_param": { "type": ["string", "null"] },
    "exp3_body_pose": { "type": ["string", "null"] },
    "orphan_params": { "type": "array", "items": { "type": "string" } },
    "physics_chain_proxies": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "param_probes": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name", "wrote", "readback", "visible", "orphan_face_tracker", "blend_partial"],
        "properties": {
          "name": { "type": "string" },
          "wrote": { "type": "number" },
          "readback": { "type": "number" },
          "visible": { "type": "boolean" },
          "orphan_face_tracker": { "type": "boolean" },
          "blend_partial": { "type": "boolean" }
        }
      }
    },
    "discovered_hotkeys": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["hotkey_id", "name", "type"],
        "properties": {
          "hotkey_id": { "type": "string", "pattern": "^[0-9a-f]{32}$" },
          "name": { "type": "string" },
          "type": { "type": "string" },
          "file": { "type": "string" },
          "is_meta": { "type": "boolean" },
          "llm_emittable": { "type": "boolean" }
        }
      }
    },
    "notes": {
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "voice": {
      "type": "object",
      "additionalProperties": false,
      "required": ["backend", "model", "lipsync_mode"],
      "properties": {
        "backend": { "type": "string", "enum": ["piper"] },
        "model": { "type": "string" },
        "lipsync_mode": { "type": "string", "enum": ["our-rms", "vts-native"] }
      }
    },
    "variants": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["code", "hotkey_id", "source_name"],
        "properties": {
          "code": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,30}$",
            "not": {
              "enum": ["think", "thinking", "tool_call", "function_call", "function_calls", "invoke", "parameter"]
            }
          },
          "hotkey_id": { "type": "string", "pattern": "^([0-9a-f]{32})?$" },
          "source_name": { "type": "string" }
        }
      }
    },
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["code", "motion_file", "duration_seconds"],
        "properties": {
          "code": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9-]{0,30}$",
            "not": {
              "enum": ["think", "thinking", "tool_call", "function_call", "function_calls", "invoke", "parameter"]
            }
          },
          "motion_file": { "type": "string" },
          "duration_seconds": { "type": "number", "minimum": 0, "maximum": 60 },
          "is_loop": { "type": "boolean" }
        }
      }
    },
    "source_rig_path": { "type": "string" }
  }
}
```

**Note on `hotkey_id` regex `^([0-9a-f]{32})?$`:** allows empty string for variants from OLVT/Cubism extractors (no VTS hotkey yet — Phase 7 registers them at boot). Also allows the 32-hex VTS UUID format from `.vtube.json`.

**Note on cross-category uniqueness:** jsonschema does NOT enforce `plugin_action_codes ∩ variants ∩ events = ∅` (PARSE-07's domain — boot-time check, not file-time). Phase 8 only validates within-file shape; Phase 7's orchestrator does the cross-check.

## Section D — 4 Extractor Field-Shape Variation

### D1. VTS extractor (`*.vtube.json` Hotkeys[])

**Field shape (verified against `Live2D/重音テト/重音テト.vtube.json:425-2061`):**

Always present (15/15 hotkey entries verified):
- `HotkeyID`: 32-hex string UUID
- `Name`: display name (may contain CJK + emoji + ASCII brackets)
- `Action`: enum string
- `File`: relative path string (empty for some Action values like `RemoveAllExpressions`)
- `Folder`: relative subdir (often empty)
- 20+ other fields (Position, ColorOverlay, Triggers, ...) — Phase 8 extractor IGNORES all

**`Action` values found in Teto:** `ToggleExpression` (×14), `RemoveAllExpressions` (×1).

**`Action` values that exist in the wild (per VTS source, NOT Teto-present):**
- `ToggleExpression` — variant entry (Phase 8 keeps)
- `TriggerAnimation` — event entry (Phase 8 routes to event catalog if rig has any)
- `RemoveAllExpressions` — auto-filtered by `Action != "ToggleExpression"` (D-A4-4)
- `MoveModel`, `LoadItem`, `LoadModel`, `RemoveItem` — meta UI commands (auto-filtered)
- `TwitchAction`, `MultiTrigger` — event-platform integrations (auto-filtered)
- `ColorOverlay`, `ChangeBackground`, `ToggleArtMesh` — visual-only commands (auto-filtered)
- `ChangeIdleAnimation`, `ReloadMicrophone`, `Unset` — system commands (auto-filtered)

**Phase 8 filter rule:** Only `ToggleExpression` → variant, only `TriggerAnimation` → event, all others dropped silently with one summary warning ("Discarded N hotkeys with non-toggle non-animation actions").

**Edge cases:**
- Empty `Hotkeys[]` array → variant catalog empty (rig has no hotkeys); not an error.
- Hotkey with `Name: ""` → slug normalize returns empty → mark as placeholder with `code: f"placeholder_{HotkeyID[:8]}"` and `is_placeholder=True`.
- Hotkey with `File: ""` AND `Action: "ToggleExpression"` → log warning "hotkey N references no expression file"; user resolves in review screen by Delete or re-keying.
- Hotkey with `File` pointing to non-existent `.exp3.json` → log warning per PITFALLS #9 ("hotkey references missing expression file"); keep entry but mark warning.

### D2. Cubism with named expressions extractor (`model3.json.FileReferences.Expressions[].Name`)

**Field shape (verified against `Live2D/mao_pro/runtime/mao_pro.model3.json:11-44`):**

```json
"Expressions": [
    { "Name": "exp_01", "File": "expressions/exp_01.exp3.json" },
    ...
]
```

Each entry:
- `Name`: required (string; may be empty per Cubism spec — but verified-present in mao_pro)
- `File`: required (relative path from model3.json directory)

**Variant code derivation:** `Name` → slug-normalize → if matches `^exp_?\d+$` mark `is_placeholder=True`. Otherwise keep as-is.

**Edge cases:**
- `Expressions` field absent → fall through to CUBISM_BARE detector (already handled at type-detect level).
- `Expressions: []` empty array → variant catalog empty; rig is bare-with-expressions-array; treat as CUBISM_BARE.
- Entry with `Name: ""` → use `File` basename without extension as fallback name (e.g., `expressions/exp_01.exp3.json` → `exp_01`); mark as placeholder.
- `File` references missing `.exp3.json` → keep entry with warning; user deletes in review screen or fixes path.
- Duplicate `Name` values → first-wins; surface a warning ("duplicate expression name N — keeping first").

### D3. Cubism bare extractor (no Expressions, no .vtube.json)

**Detection:** `model3.json` exists; `FileReferences.Expressions` missing or `[]`; no sibling `.vtube.json`.

**Variant catalog = empty.** (CUBISM_BARE rigs expose no LLM-toggleable variants. Plugin runtime drives them via raw param writes.)

**Event catalog = scanned from `model3.json.FileReferences.Motions{}`:**

```json
"Motions": {
    "FlickUp": [{ "File": "motion/01.motion3.json" }],
    "Tap":    [{ "File": "motion/02.motion3.json" }],
    "Idle":   [{ "File": "motion/04.motion3.json" }]
}
```

Walk algorithm:
1. For each `(group_name, motion_list)` pair:
2. If `group_name == "Idle"` → SKIP (idle-loop, not LLM-emittable per IMP-04 + PARSE-06)
3. For each `motion in motion_list`:
4. Read `motion.File`; open the `.motion3.json`; extract `Meta.Duration` + `Meta.Loop`
5. Generate code: `slug_from_motion_path(motion.File)` — basename without `.motion3.json`, slug-normalized
6. Add to events catalog: `EventEntry(code, motion_file=motion.File, duration_seconds=Duration, is_loop=Loop)`

**Idle-loop filter:** Match group key `"Idle"` (case-insensitive); also match individual file basenames `IDLE`, `Idle`, `idle`, `Sleep`, `sleep` per Teto convention (Teto's only motions are IDLE.motion3 + Sleep.motion3 — both filtered). Plan-time: if a rig has `Sleep` outside the `Idle` group, surface as warning rather than silently filter.

**Per VTS-shape spec:** `model3.json.FileReferences.IdleAnimation` and `IdleAnimationWhenTrackingLost` — these are VTS-specific overrides (Teto's vtube.json:8-9 has `"IdleAnimation": "IDLE.motion3.json"`). Phase 8 reads them as additional filter input — any motion file referenced by these fields is dropped from the event catalog.

**Edge case:** `Motions: {}` empty dict (Teto's case after stripping idle) → event catalog empty; not an error.

### D4. OLVT extractor (`model_dict.json` per-avatar entry)

**Field shape (verified against `C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json`):**

The file is a JSON array of avatar entries; Phase 8 selects the entry by matching `name` field against the imported folder's basename (e.g., import `重音テト/` → match `entry["name"] == "重音テト"`).

```json
{
    "name": "重音テト",
    "url": "/live2d-models/重音テト/重音テト.model3.json",
    "actionMap": {
        "hold-mic": "SV Mic",
        "utau-mic": "Utau Mic",
        "bread-out": "SV Baguette",
        "chibi": "chibi",
        "hearts": "Heart",
        "star-eyes": "Star Eye"
    },
    "emotionMap": { "neutral": 0, "anger": 2, "joy": 3, ... }   // IGNORED per D-A2-3
}
```

**actionMap verbatim shape:**
- Key = variant code (already slug-shaped per OLVT convention)
- Value = display string referencing source expression name (used as `source_name` in VariantEntry)

**Phase 8 OLVT extractor:**
- Reads `actionMap` only (D-A2-3: ignore `emotionMap`).
- For each `(code, source_name)` pair: validate `code` against slug regex; reject if invalid (would never happen with current OLVT data — but defensive).
- `hotkey_id = ""` (OLVT rigs don't have VTS hotkeys until Phase 7's import-flow registers them; Phase 8 leaves the field empty).
- `is_placeholder = False` (OLVT codes are user-curated; no relabel-required friction).

**Edge cases:**
- `actionMap` absent → variant catalog empty; not an error (the avatar relies on `emotionMap` only, which Phase 8 ignores).
- `actionMap` empty `{}` → variant catalog empty.
- Integer-keyed entries (`{"0": "joy", ...}`) → per PITFALLS #22, surface error with friendly message ("OLVT integer-indexed actionMap requires resolving against rig's Expressions list — please rename keys to slug-shaped strings or click 'Continue without integer keys'"). Phase 8 plan-decision: flag as warning but still extract string-keyed entries; OR fail-loud and require user to fix `model_dict.json`. Recommendation: warn + skip int keys, since the local `model_dict.json` has none.
- Folder name mismatch (e.g., importing `mao-pro/` when `model_dict.json` has `name: "mao_pro"`) → fall back to first entry whose `url` contains the folder name as substring; if still no match, warn and treat as Cubism-bare (the folder probably has its own model3.json).
- VTS `.vtube.json` ALSO present in folder → OLVT extractor wins (precedence in `import_detect.py`); user is informed via the `detected_type` field in `AvatarImportPlan`.

## Section E — pyvts 0.3.3 introspection smoke-test

### Verified pyvts methods (via `sidecar/vendor/pyvts/vts_request.py:113-294`)

| Method | Returns request msg for | Phase 8 use |
|---|---|---|
| `requestHotKeyList()` | `HotkeysInCurrentModelRequest` | Variant + Event hotkey enumeration (compare to `.vtube.json` Hotkeys[]) |
| `requestTrackingParameterList()` | `InputParameterListRequest` | Writable param IDs (`RigCapabilities.writable_param_ids`) |
| `requestParameterValue(parameter)` | `ParameterValueRequest(name=parameter)` | Per-param probe (smoke test only — not used in import path) |
| `requestSetParameterValue(...)` | `InjectParameterDataRequest` | Smoke probe write (smoke test only) |
| `BaseRequest("APIStateRequest")` | `APIStateRequest` | Pre-flight: detect concurrent plugin claims |
| `requestExpressionActivation(file, active, fade_time)` | `ExpressionActivationRequest` | (Phase 7 dispatch — NOT Phase 8) |
| `requestTriggerHotKey(hotkeyID)` | `HotkeyTriggerRequest(hotkeyID)` | (Phase 7 dispatch — NOT Phase 8) |

### Smoke test assertions (IMP-10)

```python
# sidecar/scripts/vts_introspect_smoke.py — clone of teto_smoke_pass.py
# Differs from milestone-1 teto_smoke_pass.py in scope:
# - milestone-1 saves teto_overrides.yaml after probes
# - Phase 8 only ASSERTS pyvts compatibility; emits a verdict line; NO file writes

ASSERTIONS = [
    # 1. APIStateRequest returns a dict with a 'data' field
    ("APIStateRequest reachable",
     lambda r: isinstance(r.get("data"), dict)),

    # 2. requestHotKeyList response has data.availableHotkeys: list
    ("HotkeyList shape",
     lambda r: isinstance(r.get("data", {}).get("availableHotkeys"), list)),

    # 3. Each hotkey has hotkeyID + name + type fields
    ("Hotkey entry shape",
     lambda r: all(
         "hotkeyID" in h and "name" in h and "type" in h
         for h in r.get("data", {}).get("availableHotkeys", [])
     )),

    # 4. requestTrackingParameterList response has both customParameters + defaultParameters
    ("ParameterList shape",
     lambda r: "customParameters" in r.get("data", {})
            and "defaultParameters" in r.get("data", {})),

    # 5. Each parameter has a name field
    ("Parameter entry shape",
     lambda r: all(
         "name" in p
         for p in (r.get("data", {}).get("customParameters", [])
                 + r.get("data", {}).get("defaultParameters", []))
     )),
]
```

### Failure-mode behavior

If VTS not running: pyvts `client.connect()` raises `ConnectionRefusedError`. Smoke script catches → prints:
```
[SMOKE] FAIL: cannot connect to VTS at ws://localhost:8001
[SMOKE] Is VTube Studio running with the API enabled?
[SMOKE] Settings → Plugin Settings → Start API (port 8001 is the default)
```

If auth not granted: `request_authenticate_token()` raises after timeout → prints:
```
[SMOKE] FAIL: VTS authentication denied or timed out (waited 60s)
[SMOKE] Click "Allow" in VTS when the auth popup appears.
```

If `requestHotKeyList` shape doesn't match (pyvts upstream API drift): smoke script prints exact mismatch:
```
[SMOKE] FAIL: HotkeyList shape mismatch
[SMOKE]   expected: data.availableHotkeys: list
[SMOKE]   got:      data={'fooBar': [...]}  # whatever VTS returned
[SMOKE]   pyvts version: 0.3.3 (from sidecar/vendor/pyvts/pyproject.toml)
[SMOKE]   VTS API version: <reported>
[SMOKE] Phase 8 import flow MAY break with this VTS/pyvts combination.
```

### Reuse from milestone-1: copy-port plan

Direct copy from `sidecar/scripts/teto_smoke_pass.py`:
- Plugin info dict + token path (lines 46-51)
- `client.connect()` + `request_authenticate_token()` + `request_authenticate()` flow (lines 52-55)
- `APIStateRequest` concurrent-plugin guard (lines 57-72)
- `requestHotKeyList` call (lines 95-97)
- `requestTrackingParameterList` call (lines 78-83)

Write fresh:
- Drop param-writing probes (Phase 8 doesn't need probe data; that's milestone-1 04-00 territory)
- Drop hotkey persistence (milestone-1 saves to teto_overrides.yaml; Phase 8 just asserts)
- Add the 5 shape assertions and verdict print

## Section F — Sidecar boot sequence rewiring

### Where avatar_id comes from at boot

**Milestone-1 (current):** Hardcoded `avatars/teto/` (`ws/server.py:134`).

**v2.0 (post-Phase 8):** Read from `app.state` populated by Electron-main env var:

```python
# Plan-time approach
# 1. Electron-main reads electron-store key 'currentAvatarId' (default: 'teto' for dogfood).
# 2. Electron-main writes env var AGENTICLLMVTUBER_AVATAR_ID=teto into sidecar process env.
# 3. Sidecar boot reads os.environ['AGENTICLLMVTUBER_AVATAR_ID'] → avatar_dir = avatars / avatar_id.
# 4. Reads _avatar_overrides.yaml (NEW) instead of avatar.yaml + teto_overrides.yaml.
# 5. Builds RigCapabilities from source_rig_path inside the YAML (reflecting from rig source files).
```

### First-launch UX (no avatar imported)

If `_avatar_overrides.yaml` missing AND no `avatar_id` is set:
- Sidecar boots with `app.state.orchestrator = None` (existing pattern at `ws/server.py:142-150`).
- Renderer's AppShell shows a different placeholder route (`'no-avatar'`) instead of `'chat'`.
- That route prompts: "Import an avatar to start chatting" + button → routes to `'avatar-import'`.
- After successful Save, electron-store writes `currentAvatarId`, electron-main restarts sidecar, avatar loads, route switches to `'chat'`.

For Phase 8 dogfood (D-A4-1): operator manually imports Teto. Pre-launch: `currentAvatarId = 'teto'` is set in electron-store. Post-import: same value, but `avatars/teto/_avatar_overrides.yaml` now exists.

### After Teto's dogfooded import (D-A4-1) — boot path reads what

Per D-A4-2: `avatars/teto/avatar.yaml` + `teto_overrides.yaml` are DELETED. Boot reads:

1. `avatars/teto/_avatar_overrides.yaml` — the new file (ships with the dogfood commit)
2. `_avatar_overrides.source_rig_path` → resolves to `Live2D/重音テト/` (relative to repo root)
3. Reflects `RigCapabilities` from rig source files at `Live2D/重音テト/`:
   - `重音テト.model3.json` → list of writable param IDs from `Groups[].Ids` (sparse — only the EyeBlink/LipSync groups). Cross-reference with `重音テト.vtube.json` `ParameterSettings[].OutputLive2D` for the full param list.
   - `重音テト.cdi3.json` → display names (verified — has 100+ entries)
   - `重音テト.vtube.json` `Hotkeys[]` → re-derived (already in `_avatar_overrides.yaml.variants[]`, but RigCapabilities exposes a structured form for HUD)
4. `Expression` list from `_avatar_overrides.yaml.variants[].source_name` (mirrors milestone-1's `expressions: list[Expression]` field on AvatarCapabilities).

### `source_rig_path` field — relative to what

Per CONTEXT Claude Discretion: relative to repo root if rig folder is inside the repo, absolute path otherwise.

**Resolution at boot:**
```python
# sidecar/avatar/rig_capabilities.py
def resolve_source_rig_path(overrides: AvatarOverrides, repo_root: Path) -> Path:
    p = Path(overrides.source_rig_path)
    if p.is_absolute():
        return p
    return repo_root / p
```

For Teto: `source_rig_path: "Live2D/重音テト"` (relative). For user imports outside repo: e.g., `source_rig_path: "C:\\Users\\jane\\Desktop\\my-rig"` (absolute).

### `RigCapabilities` builder — where the code lives

NEW file: `sidecar/src/sidecar/avatar/rig_capabilities.py`. Old file `capabilities.py` is deleted in same PR (D-A1-1).

```python
# sidecar/src/sidecar/avatar/rig_capabilities.py (NEW)
from pathlib import Path
import json
from sidecar.avatar.overrides import AvatarOverrides

class Expression(BaseModel):
    name: str
    file: str

class Hotkey(BaseModel):
    name: str
    type: str
    hotkey_id: str

class RigCapabilities(BaseModel):
    writable_param_ids: list[str]
    param_ranges: dict[str, tuple[float, float] | None]
    expressions: list[Expression]
    hotkeys: list[Hotkey]
    cdi3_display_names: dict[str, str]
    sign_inversions: list[str]

def build_rig_capabilities(
    overrides: AvatarOverrides,
    rig_dir: Path,
) -> RigCapabilities:
    """Reflect RigCapabilities from rig source files + overrides.

    Reads:
    - rig_dir/*.model3.json    Groups[].Ids → writable_param_ids
    - rig_dir/*.cdi3.json       Parameters[] → cdi3_display_names + (param_ranges if numeric ranges added in future)
    - rig_dir/*.vtube.json      ParameterSettings[].OutputLive2D → augment writable_param_ids
    - overrides.variants[]      → derive expressions
    - overrides.discovered_hotkeys[] → augment hotkeys
    - overrides.sign_inversions → carry into RigCapabilities.sign_inversions
    """
    ...
```

## Section G — Renderer review screen routing

### Existing route mechanism

`apps/renderer/src/state/route-store.ts` (verified — 36 lines):

```ts
export type Route = 'chat' | 'agent' | 'settings'
let current: Route = 'chat'
const subs = new Set<(r: Route) => void>()
// ... getRoute / setRoute / useRoute ...
```

`AppShell.tsx` reads `view` from `useStore()` (alternate state path — `app-store.tsx` exposes `view`/`setView`). The two stores are kept in sync — `route-store.ts` exists as a standalone hook for dev-panel direct injection.

**Phase 8 changes:**
1. `route-store.ts`: extend `Route` union to `'chat' | 'agent' | 'settings' | 'avatar-import'`
2. `app-store.tsx`: extend `View` type identically
3. `AppShell.tsx`: add `{view === 'avatar-import' && <AvatarImport />}` rendering branch (line 70-73 area)

### Mount entrypoints

Plan-time: 2 navigation entrypoints to AvatarImport route:
1. **From Settings** (re-edit existing): `Settings.tsx` adds button "Edit avatar catalogs" → `setView('avatar-import')`. Sidecar API call: `GET /admin/avatar/import/current` returns the current `_avatar_overrides.yaml` parsed as `AvatarImportPlan`.
2. **From first-launch flow** (no avatar imported): The `'no-avatar'` placeholder route shows "Import an avatar →" button → opens file dialog via `window.api.pickAvatarFolder()` → on success, sets view to `'avatar-import'` with the import-plan response.

### Post-commit UX

Plan-time recommendation: redirect to `Chat` on successful Save with a success toast. Restart sidecar (so the new YAML loads at boot). Pattern matches milestone-1 `LLMSetup.tsx:75-85` (`completeSetup({...})` then redirects to chat).

```ts
// apps/renderer/src/screens/AvatarImport/AvatarImport.tsx (sketch)
const onSave = async (plan: AvatarImportPlan) => {
  await window.api.commitAvatarOverrides(plan)
  // electron-main side: writes electron-store currentAvatarId, restarts sidecar
  toasts.show('Avatar imported successfully')
  setView('chat')
}
```

## Section H — Electron IPC + Sidecar HTTP endpoints

### IPC channels (Electron main + preload)

**`apps/electron-main/src/ipc.ts` additions:**

```ts
// New for Phase 8
ipcMain.handle('avatar:pickFolder', async (): Promise<string | null> => {
  const r = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Choose avatar folder',
  })
  if (r.canceled || r.filePaths.length === 0) return null
  return r.filePaths[0]  // single folder
})

ipcMain.handle('avatar:requestImportPlan', async (_e, folder: string) => {
  // POST to sidecar /admin/avatar/import — sidecar parses + returns plan
  const url = `${sidecarUrl}/admin/avatar/import`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder })
  })
  return resp.json()  // AvatarImportPlan
})

ipcMain.handle('avatar:commitOverrides', async (_e, plan: AvatarImportPlan) => {
  const url = `${sidecarUrl}/admin/avatar/import/commit`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan)
  })
  if (!resp.ok) throw new Error(await resp.text())
  // Update electron-store + restart sidecar so new YAML loads
  store.set('currentAvatarId', plan.avatar_id)
  await restartSidecar()
  return resp.json()
})
```

**`apps/electron-main/preload/index.ts` additions** (extends existing 9-method `api` object):

```ts
const api = {
  // ... existing 9 methods ...
  pickAvatarFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('avatar:pickFolder'),
  requestImportPlan: (folder: string): Promise<AvatarImportPlan> =>
    ipcRenderer.invoke('avatar:requestImportPlan', folder),
  commitAvatarOverrides: (plan: AvatarImportPlan): Promise<void> =>
    ipcRenderer.invoke('avatar:commitOverrides', plan),
}
```

### Sidecar HTTP endpoints (`sidecar/src/sidecar/admin/avatar.py`)

```python
# sidecar/src/sidecar/admin/avatar.py (NEW directory + file)
from fastapi import APIRouter, HTTPException
from pathlib import Path

router = APIRouter(prefix="/admin/avatar")

@router.post("/import")
async def import_avatar(req: ImportRequest) -> AvatarImportPlan:
    """Detect type, run extractor, return draft AvatarImportPlan.
    Does NOT write anything. Pure parse + preview.
    """
    folder = Path(req.folder)
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(400, f"Folder does not exist: {folder}")

    avatar_type = detect_type(folder)
    if avatar_type == AvatarType.UNSUPPORTED_CUBISM_5_3:
        return AvatarImportPlan(
            detected_type=avatar_type,
            warnings=[ImportWarning(kind="cubism_5_3", message=COPY.ERROR_CUBISM_5_3)],
            variants=[], events=[],
        )
    if avatar_type == AvatarType.UNSUPPORTED_NO_MODEL3:
        return AvatarImportPlan(
            detected_type=avatar_type,
            warnings=[ImportWarning(kind="no_model3", message=COPY.ERROR_NO_MODEL3)],
            variants=[], events=[],
        )

    # Dispatch to extractor
    extractor = {
        AvatarType.OLVT: extract_olvt,
        AvatarType.VTS_STANDARD: extract_vts,
        AvatarType.CUBISM_WITH_EXPRESSIONS: extract_cubism_named,
        AvatarType.CUBISM_BARE: extract_cubism_bare,
    }[avatar_type]
    variants, events, warnings = extractor(folder)

    # Check for existing _avatar_overrides.yaml (re-import case)
    existing = None
    overrides_path = folder / "_avatar_overrides.yaml"
    if overrides_path.exists():
        existing = AvatarOverrides.model_validate(yaml.safe_load(overrides_path.read_text()))

    return AvatarImportPlan(
        detected_type=avatar_type,
        avatar_id=folder.name,
        avatar_name=folder.name,
        source_rig_path=str(folder),  # convert to relative if inside repo at commit time
        variants=variants,
        events=events,
        warnings=warnings,
        existing_overrides=existing,
    )

@router.post("/import/commit")
async def commit_avatar(plan: AvatarImportPlan) -> dict:
    """Atomic-write _avatar_overrides.yaml after jsonschema validation."""
    target = Path(plan.source_rig_path) / "_avatar_overrides.yaml"
    overrides = AvatarOverrides(
        variants=plan.variants,
        events=plan.events,
        voice=plan.voice or Voice(),
        source_rig_path=str(target.parent),
        # Carry-over fields from existing overrides if present (D-A4-3 logic)
        sign_inversions=plan.existing_overrides.sign_inversions if plan.existing_overrides else [],
        body_sway_strategy=plan.existing_overrides.body_sway_strategy if plan.existing_overrides else "head_only",
        # ... etc for D-A4-3 carry-over ...
    )
    write_avatar_overrides_atomic(target, overrides.model_dump(mode="json"))
    return {"status": "ok", "path": str(target)}

@router.get("/import/current")
async def get_current_avatar(avatar_id: str) -> AvatarImportPlan:
    """Read existing _avatar_overrides.yaml, return as plan for re-edit UX."""
    # Read and return as AvatarImportPlan
    ...
```

### Existing IPC pattern reference

`apps/electron-main/src/ipc.ts` (current, verified) uses `ipcMain.handle` + `ipcRenderer.invoke` (request-response pattern). LLM setup follows: `'config:save'` → `restartSidecar()` → success/failure echoes back via `webContents.send('sidecar:crash')` if needed. Phase 8 mirrors this structure for `avatar:commitOverrides`.

## Section I — `AvatarImportPlan` contract shape

```python
# packages/contracts/py/contracts/avatar_import_plan.py (NEW)
from typing import Optional
from pydantic import BaseModel
from .variant_entry import VariantEntry
from .event_entry import EventEntry
from .avatar_overrides import AvatarOverrides, Voice

class ImportWarning(BaseModel):
    kind: str  # "missing_exp3" | "empty_slug" | "cubism_5_3" | "no_model3" | "discarded_hotkeys" | ...
    message: str
    related_code: Optional[str] = None  # variant/event code if relevant

class AvatarImportPlan(BaseModel):
    """Over-the-wire payload from sidecar to renderer for review-screen population."""

    detected_type: str  # AvatarType enum value
    avatar_id: str = ""        # folder basename (Phase 8 stub; v2.0 may add UUID later)
    avatar_name: str = ""      # display name (defaults to folder basename)
    source_rig_path: str = ""  # absolute path at request time; converted to relative on commit if inside repo

    variants: list[VariantEntry] = []
    events: list[EventEntry] = []
    voice: Optional[Voice] = None  # null on first import → committed with Voice() defaults

    warnings: list[ImportWarning] = []

    # Re-import context
    existing_overrides: Optional[AvatarOverrides] = None  # populated when YAML already exists at source_rig_path
```

`VariantEntry` adds 1 field for the renderer (vs the persisted Pydantic shape):

```python
# packages/contracts/py/contracts/variant_entry.py (NEW)
class VariantEntry(BaseModel):
    code: str
    hotkey_id: str
    source_name: str
    is_placeholder: bool = False  # renderer-side flag; NOT persisted in YAML
```

`EventEntry`:

```python
class EventEntry(BaseModel):
    code: str
    motion_file: str
    duration_seconds: float
    is_loop: bool = False
    is_placeholder: bool = False  # renderer-side flag; NOT persisted in YAML
```

**The `is_placeholder` flag is a derived/computed field used only on the wire and in renderer state.** It's set by the extractor (`is_placeholder_code(code)`) for VariantEntry and is always False for EventEntry (events use motion-file basenames; no placeholder convention defined). The persisted YAML schema doesn't include `is_placeholder` — Phase 7 boot re-derives placeholder status if needed for runtime warnings (PITFALLS #10 startup-warning).

## State of the Art

| Old Approach (milestone-1) | Current Approach (v2.0 Phase 8) | When Changed | Impact |
|---|---|---|---|
| Hand-curated `avatars/teto/avatar.yaml` (`AvatarCapabilities`) | Imported `_avatar_overrides.yaml` (`AvatarOverrides`) reflecting from rig sources | Phase 8 dogfood | `avatar.yaml` deleted; `RigCapabilities` reflected at boot |
| `expressions: list[Expression]` flat list | `variants: list[VariantEntry]` (toggle) + `events: list[EventEntry]` (one-shot) | Phase 8 schema | Plugin runtime gets cleaner contract |
| No type-detection — assumed VTS-shape | `detect_type()` ladder over 5 shapes | Phase 8 IMP-01 | Supports OLVT + Cubism rigs without code change |
| `voice` field on `AvatarCapabilities` | `voice` field on `AvatarOverrides` | D-A1-2 | `voice` is engineer-curated, not introspectable; lives with overrides |
| `tag_vocabulary()` method on `AvatarCapabilities` | DELETED — Phase 6/7 plugin owns vocabulary | D-A1-1 | Cross-cutting refactor; system prompt assembly changes |

**Deprecated/outdated (Phase 8 deletes / replaces):**
- `sidecar/src/sidecar/avatar/capabilities.py` — entire file deleted (D-A1-1)
- `avatars/teto/avatar.yaml` — deleted post-dogfood (D-A4-2)
- `avatars/teto/teto_overrides.yaml` — deleted post-dogfood (D-A4-2)
- `TetoOverrides` Pydantic class — renamed to `AvatarOverrides` (IMP-09)

## Open Questions

1. **Does `model_dict.json` get committed-pinned, or is the local OLVT checkout sufficient?**
   - What we know: CONTEXT says "pin to OLVT HEAD at Phase 8 plan-time"; user has local checkout at `C:\Users\16079\Code\OpenLLM_Vtuber\`.
   - What's unclear: Is the pin a comment in `extract_olvt.py` referencing a specific OLVT commit hash, or is the file vendored?
   - Recommendation: Pin via comment + git submodule reference if user wants reproducibility. For Phase 8 dogfood, the local checkout is enough (no Phase 8 test imports OLVT-only without VTS sibling files).

2. **How should the renderer surface `existing_overrides` re-import diff?**
   - What we know: CONTEXT says "default opens the review screen pre-populated with current values + newly-detected entries diff-highlighted."
   - What's unclear: Diff visualization design (highlight color? before/after side-by-side?). Out of research scope; UI-design phase territory.
   - Recommendation: Phase 8 plan-time picks simplest surface (e.g., new entries shown with "NEW" badge; user-edited entries shown with "edited" badge); polish iterates.

3. **What happens if `RigCapabilities` reflection finds a mismatch with `_avatar_overrides.yaml.discovered_hotkeys[]`?**
   - What we know: Rig source files may change between import time and boot time (user updates `.vtube.json` outside the import flow).
   - What's unclear: Should boot fail loud if discovered hotkey IDs in the YAML don't match current `.vtube.json`?
   - Recommendation: Boot WARN log only ("hotkey N from saved overrides not found in rig — variant code may not dispatch"); user must re-import to refresh. Don't crash.

4. **Should the type detector handle `.zip` archives (per MULTI-02)?**
   - What we know: REQUIREMENTS.md MULTI-02 mentions "VTS .zip + raw Cubism folders" but MULTI-02 is v2 (deferred), not v2.0 (current).
   - What's unclear: Should Phase 8 lay the groundwork (extract zip → temp folder → detect type)?
   - Recommendation: NO — out of scope. Phase 8 supports folders only; .zip is post-v2.0 milestone work.

5. **`TriggerAnimation` action hotkeys — does Teto have any?**
   - What we know: Verified no `TriggerAnimation` in Teto's vtube.json (only `ToggleExpression` + `RemoveAllExpressions`).
   - What's unclear: Does mao_pro / shizuku have any? They have no `.vtube.json` so the question is moot for them.
   - Recommendation: Skip the `TriggerAnimation` event-routing code path in Phase 8 implementation — write the dispatch but don't unit-test against a fixture (PITFALLS #7's "rig has no toggle-off path" edge case is the same scenario; defer to user-imported-rig-test).

## Environment Availability

Phase 8 depends on local-only tools (no external services):

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | Sidecar | ✓ | (per `pyproject.toml`) | — |
| Node 22 LTS | Electron-main + renderer | ✓ | (already running) | — |
| Electron 40.x | File dialog (`dialog.showOpenDialog`) | ✓ | already installed | — |
| jsonschema 4.26.0 | Pre-write validation | ✗ | — | `uv add jsonschema==4.26.0` (locked by v2.0 SUMMARY) |
| pyvts 0.3.3 | IMP-10 smoke test | ✓ | vendored at `sidecar/vendor/pyvts/` | — |
| VTube Studio 1.32.71 | IMP-10 smoke test ONLY (extractors don't need VTS) | (operator runs separately when invoking smoke) | API "1.0" | Smoke fails with friendly error; extractor path still works |
| OpenLLM_Vtuber `model_dict.json` | OLVT extractor reference | ✓ | local at `C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json` | — |
| Live2D rig samples (Teto, mao_pro, shizuku) | Test fixtures | ✓ | all three at `Live2D/` in repo | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `jsonschema` — install via `uv add` per the documented v2.0 stack.

## Validation Architecture

**Note:** `.planning/config.json` has `workflow.nyquist_validation` not explicitly set to `false` — including this section per default.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x (already used in milestone-1; confirmed via `sidecar/tests/`) |
| Config file | `pyproject.toml` (uses `[tool.pytest.ini_options]`) |
| Quick run command | `uv run pytest sidecar/tests/avatar/ -x --no-header` |
| Full suite command | `uv run pytest sidecar/tests/ && cd apps/renderer && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | type detector returns correct enum for each shape | unit | `pytest sidecar/tests/avatar/test_import_detect.py -x` | ❌ Wave 0 |
| IMP-02 | VTS extractor on Teto produces 14 variants + 1 filtered meta | unit | `pytest sidecar/tests/avatar/test_extract_vts.py::test_teto -x` | ❌ Wave 0 |
| IMP-02 | naming-normalization regex matches CONTEXT examples | unit | `pytest sidecar/tests/avatar/test_normalize.py -x` | ❌ Wave 0 |
| IMP-03 | Cubism-named extractor on mao_pro produces 8 placeholder variants | unit | `pytest sidecar/tests/avatar/test_extract_cubism_named.py::test_mao_pro -x` | ❌ Wave 0 |
| IMP-04 | Cubism-bare extractor on shizuku produces 0 variants + 3 events (Idle filtered) | unit | `pytest sidecar/tests/avatar/test_extract_cubism_bare.py::test_shizuku -x` | ❌ Wave 0 |
| IMP-05 | OLVT extractor on local model_dict.json produces 6 mao_pro variants | unit | `pytest sidecar/tests/avatar/test_extract_olvt.py::test_mao_pro -x` | ❌ Wave 0 |
| IMP-06 | motion3.json Meta.Duration extracted correctly (Teto IDLE = 2.833s, Loop=true) | unit | `pytest sidecar/tests/avatar/test_motion3_meta.py -x` | ❌ Wave 0 |
| IMP-07 | placeholder detection regex catches `^exp_?\d+$` only | unit | `pytest sidecar/tests/avatar/test_normalize.py::test_placeholder -x` | ❌ Wave 0 |
| IMP-07 | review screen disables Save when placeholder present | integration (renderer) | `cd apps/renderer && npm test -- --run AvatarImport` | ❌ Wave 0 |
| IMP-08 | atomic write writes via .tmp → fsync → replace; pre-validates jsonschema | unit | `pytest sidecar/tests/avatar/test_overrides_writer.py -x` | ❌ Wave 0 |
| IMP-08 | re-import preserves user notes + body_sway_strategy | unit | `pytest sidecar/tests/avatar/test_reimport.py -x` | ❌ Wave 0 |
| IMP-09 | TetoOverrides → AvatarOverrides rename; existing teto_overrides.yaml still loads | unit (regression) | `pytest sidecar/tests/avatar/test_overrides_loader.py -x` | ❌ Wave 0 |
| IMP-10 | vts_introspect_smoke.py asserts pyvts 0.3.3 shape | manual-only (requires VTS running) | `uv run python sidecar/scripts/vts_introspect_smoke.py` | ❌ Wave 0 |
| ARCH-02 | RigCapabilities builds correctly from Teto's source rig files | unit | `pytest sidecar/tests/avatar/test_rig_capabilities.py::test_build_from_teto -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `uv run pytest sidecar/tests/avatar/ -x --no-header`
- **Per wave merge:** `uv run pytest sidecar/tests/` (full sidecar suite)
- **Phase gate:** `uv run pytest sidecar/tests/ && cd apps/renderer && npm test && uv run python sidecar/scripts/vts_introspect_smoke.py` (last requires VTS running)

### Wave 0 Gaps

- [ ] `sidecar/tests/avatar/__init__.py` — package marker
- [ ] `sidecar/tests/avatar/conftest.py` — shared fixtures: `teto_dir`, `mao_pro_dir`, `shizuku_dir` pointing to `Live2D/*` paths
- [ ] `sidecar/tests/avatar/test_import_detect.py` — covers IMP-01 with all 5 shapes
- [ ] `sidecar/tests/avatar/test_normalize.py` — covers naming-normalization (15 Teto names + edge cases)
- [ ] `sidecar/tests/avatar/test_extract_vts.py` — covers IMP-02
- [ ] `sidecar/tests/avatar/test_extract_cubism_named.py` — covers IMP-03
- [ ] `sidecar/tests/avatar/test_extract_cubism_bare.py` — covers IMP-04
- [ ] `sidecar/tests/avatar/test_extract_olvt.py` — covers IMP-05
- [ ] `sidecar/tests/avatar/test_motion3_meta.py` — covers IMP-06
- [ ] `sidecar/tests/avatar/test_overrides_writer.py` — covers IMP-08 atomic-write + jsonschema validation
- [ ] `sidecar/tests/avatar/test_reimport.py` — covers re-import diff/preservation logic
- [ ] `sidecar/tests/avatar/test_overrides_loader.py` — regression test for IMP-09 rename
- [ ] `sidecar/tests/avatar/test_rig_capabilities.py` — covers ARCH-02 build path
- [ ] `apps/renderer/src/screens/AvatarImport/__tests__/AvatarImport.test.tsx` — covers IMP-07 placeholder gate UX

## Project Constraints (from CLAUDE.md)

- **Tech stack locked:** Electron 40 + TypeScript + React 19.2 + Vite 6 + Python 3.12 + FastAPI 0.136.1 + Uvicorn 0.46.0 + LiteLLM 1.83.14 + pyvts 0.3.3 (vendored). Phase 8 adds `jsonschema 4.26.0` (sidecar). No renderer/build-chain bumps.
- **Local-first:** All Phase 8 IPC stays localhost-only (renderer ↔ Electron-main IPC + Electron-main ↔ sidecar HTTP via the existing `sidecarUrl`).
- **Single-user:** No multi-user/family-account considerations. Avatar import is per-machine.
- **No pnpm:** package manager remains npm. Phase 8 doesn't introduce new JS deps.
- **OLVT port preference (memory `feedback_olvt_port_preference.md`):** OLVT extractor follows OLVT's `model_dict.json` schema directly; deviations require explicit rationale. **D-A2-3 (ignore `emotionMap`) IS such a deviation** — rationale documented (plugin-author owns emotion vocabulary; cross-system mapping is wrong layer).
- **Capabilities from introspection (memory `project_capabilities_from_introspection.md`):** v2.0 swaps the source — milestone-1 used hand-curated `avatar.yaml` for capabilities; v2.0 reflects RigCapabilities from rig source files at boot, with `_avatar_overrides.yaml` for engineer-curated deviations only. **This phase IS the migration.**
- **KV cache prefix-stability (memory `project_kv_cache_discipline.md`):** Phase 8 doesn't touch the orchestrator chain; system-prompt assembly only changes if Phase 6/7's plugin-owned vocabulary changes. Phase 8's catalogs feed Phase 7's parser, not the prompt directly.
- **GSD workflow enforcement:** All Phase 8 work flows through `/gsd:execute-phase` (or `/gsd:quick` for tiny patches).

## Sources

### Primary (HIGH confidence)
- `Live2D/重音テト/重音テト.vtube.json` (verified — 2061+ line file with 15 hotkeys)
- `Live2D/重音テト/重音テト.model3.json` (verified — 30 lines; no Expressions, no Motions)
- `Live2D/重音テト/重音テト.cdi3.json` (verified — Parameters[] shape with `Id`/`GroupId`/`Name`)
- `Live2D/重音テト/Motions/IDLE.motion3.json` (verified — Meta.Duration=2.833, Meta.Loop=true)
- `Live2D/mao_pro/runtime/mao_pro.model3.json` (verified — 8 `exp_NN` Expressions[])
- `Live2D/shizuku/runtime/shizuku.model3.json` (verified — 4 motion groups, no Expressions)
- `C:\Users\16079\Code\OpenLLM_Vtuber\model_dict.json` (verified — actionMap shape for mao_pro + Teto)
- `sidecar/vendor/pyvts/vts_request.py` (verified — exact pyvts 0.3.3 method names + signatures)
- `sidecar/scripts/teto_smoke_pass.py` (verified — milestone-1 pyvts handshake template)
- `sidecar/src/sidecar/avatar/capabilities.py` (verified — file to delete)
- `sidecar/src/sidecar/avatar/overrides.py` (verified — file to rename + extend)
- `sidecar/src/sidecar/ws/server.py` (verified — boot path at lines 120-241)
- `apps/electron-main/src/ipc.ts` (verified — IPC pattern)
- `apps/electron-main/preload/index.ts` (verified — contextBridge pattern)
- `apps/renderer/src/state/route-store.ts` (verified — Route union shape)
- `apps/renderer/src/chrome/AppShell.tsx` (verified — view-rendering pattern)
- `apps/renderer/src/screens/LLMSetup/LLMSetup.tsx` (verified — mandatory-screen UX template)
- `avatars/teto/avatar.yaml` + `teto_overrides.yaml` (verified — files to delete)
- `.planning/research/v2.0/SUMMARY.md` (verified — net-new dep list, stack pins)
- `.planning/research/v2.0/ARCHITECTURE.md` (verified — file-affected tables for Phase 8)
- `.planning/research/v2.0/PITFALLS.md` (verified — pitfalls #9, #10, #19, #22 directly addressed)
- [Live2D Cubism SDK 5.3 Compatibility Doc](https://docs.live2d.com/en/cubism-sdk-manual/compatibility-with-cubism-5-3/) — confirms moc3 ver:[6] = Cubism 5.3
- [MOC3 File Format Spec (rentry.co/moc3spec)](https://rentry.co/moc3spec) — confirms header byte 4 = version field

### Secondary (MEDIUM confidence)
- Naming-normalization regex sequence verified by Python script execution (15/15 Teto names produce CONTEXT-expected outputs); script not committed but reproducible from this doc's §A code block
- VTS `Action` field enum extracted from VTubeStudio public docs + Teto's actual hotkeys; full enum list (`MoveModel`, `LoadItem`, etc.) cross-referenced from VTS source notes in PITFALLS

### Tertiary (LOW confidence)
- Integer-keyed OLVT `model_dict.json` handling — local file has none; behavior under PITFALLS #22 is recommendation not measurement
- `TriggerAnimation` action behavior in event extraction — Teto rig has none; pattern inferred from VTS source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — net-new dep `jsonschema 4.26.0` already verified in v2.0 SUMMARY (PyPI checked 2026-05-08)
- Architecture: HIGH — every integration point verified against actual repo files (server.py:120-241, ipc.ts, AppShell.tsx, route-store.ts)
- Pitfalls: HIGH — all 6 phase-specific pitfalls cross-referenced with milestone-1 evidence + rig-file verification
- Naming-normalization regex: HIGH — empirically verified against 15 real Teto hotkey names; output matches CONTEXT-stated expected outputs
- pyvts methods: HIGH — verified against vendored source `sidecar/vendor/pyvts/vts_request.py:113-294`
- Cubism 5.3 detection: MEDIUM — Live2D doc confirms moc3 ver:[6] but the rentry spec only documents up to ver=4; the 6 marker is from compatibility-with-cubism-5-3 doc string

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (30 days; rig-file shapes are stable, but pyvts/Live2D upstream may bump)
