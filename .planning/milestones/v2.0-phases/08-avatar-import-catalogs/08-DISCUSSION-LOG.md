# Phase 8: Avatar Import + Catalogs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 08-avatar-import-catalogs
**Areas discussed:** RigCapabilities↔AvatarCapabilities migration, Three-bucket semantics for Teto's 14 expressions, Review screen layout, Teto milestone-1 data migration

---

## Gray Areas Selected

| Area | Description | Selected |
|------|-------------|----------|
| RigCapabilities ↔ AvatarCapabilities migration | ARCH-02 moved to Phase 8; existing AvatarCapabilities has expressions/hotkeys/parameters/voice; new RigCapabilities needs additional fields. Replace / extend / compose? | ✓ |
| Teto's 14 expressions three-bucket migration | Where do existing milestone-1 LLM-emittable codes go in v2.0's variant/event/emotion-binding split? | ✓ |
| Review screen layout (3 catalogs how shown) | Single-page scrollable / Tabs / Wizard? | ✓ |
| Teto milestone-1 data migration mechanism | Run import flow / migration script / keep legacy? | ✓ |

---

## RigCapabilities ↔ AvatarCapabilities migration

### Q1.1: Migration shape

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Replace — delete AvatarCapabilities | New RigCapabilities is the sole class. Milestone-1 callers will be rewritten in Phase 6/7 anyway (IntentDriver deletion, tag_vocabulary → plugin action_codes, actions_extractor → code_extractor). Cleanest contract. | ✓ |
| (B) Extend — RigCapabilities(AvatarCapabilities) | Inherits expressions/hotkeys/parameters/voice + adds v2.0 fields. M1 callers untouched but two names coexist 6+ months. | |
| (C) Compose — RigCapabilities contains avatar: AvatarCapabilities field | Most explicit but adds indirection. | |

**User's choice:** (A) Replace
**Notes:** User accepted the recommended option. milestone-1 callers being rewritten anyway eliminates the "compatibility" argument for (B)/(C).

### Q1.2: voice field new home

| Option | Description | Selected |
|--------|-------------|----------|
| (b) AvatarOverrides | Co-locate with sign_inversions / emotion_bindings / body_sway_strategy — all engineer-curated, not VTS-introspectable. | ✓ |
| (a) Keep on RigCapabilities | Less code change but voice is not a rig capability semantically. | |
| (c) Separate voice.yaml | TTSv2-04 future shape, premature for Phase 8. | |

**User's choice:** (b) AvatarOverrides
**Notes:** Recommended option accepted.

### Q1.3: param_ranges source

| Option | Description | Selected |
|--------|-------------|----------|
| (a) cdi3.json only — None when missing | Simple. Teto rig has cdi3.json. HUD handles None on display. No VTS API dependency in Phase 8. | ✓ |
| (b) Cubism standard table + cdi3 override | Built-in table for known IDs (ParamAngleX±30, etc.) + cdi3 override. More accurate but maintenance burden. | |
| (c) VTS API introspection probe | Most accurate but requires VTS running during import (adds verification path dependency). | |

**User's choice:** (a) cdi3.json only
**Notes:** Recommended option accepted.

---

## Teto's 14 expressions three-bucket migration

### Initial framing (Q2 round 1)

I initially asked about "where do eye toggles (Dark Eye / Dizzy / Exp eye / Heart Eye / Star Eye / Squint Eye) go?" with options:

| Option | Description | Selected |
|--------|-------------|----------|
| (A) All variants (matches OLVT actionMap) | OLVT model_dict.json has Star Eye in actionMap (variant), not emotionMap. Eye toggles are state, not reactions. | (rejected) |
| (B) Heart/Star/Dizzy as emotion-bindings (mapped to surprise/joy) | Hybrid. But 1:1 emotion_bindings means choosing which eye style "is joy". | (rejected) |
| (C) Dark Eye → anger augment, others variants | Dark Face already anger; Dark Eye supplements. Eye toggles otherwise variants. | (rejected) |

And separately: "How many of OLVT's 8 emotions does Teto cover?":

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Only what Teto has assets for | joy/anger/sadness mapped; surprise/fear/disgust null — plugin fallbacks. | (rejected) |
| (B) Fill all 8 — reuse Sweat/Blush/Squint Eye for fear/disgust/smirk | Forces full coverage but "smirk = Squint Eye" is semantically off. | (rejected) |
| (C) Only the milestone-1 joy→Love.exp3 | Far too narrow; PLG-07 requires full OLVT 8 vocabulary. | (rejected) |

**User's response:** "I want to clarify. I haven't thought it through."

### Re-framing (Q2 round 2 — discussion)

I laid out the conceptual framework:

- `[action]` = LLM reports inner feeling (short, 300ms ramp); 1:1 emotion_bindings
- `{variant}` = LLM consciously toggles costume/state (persistent, radio-button)
- `<event>` = LLM fires one-shot motion (motion3.json + 1s pad)

Then identified the crux: **what's the semantic difference between emotion-binding and variant?** Answered: emotion is reactive side-effect; variant is conscious change. Showed Teto's 14 expressions sorted into a proposal table with confidence levels.

### User's architectural insight (the actual decision)

User responded: **"Should we remove `[joy]` style codes that the model doesn't expose? Only handle variant codes that the rig exposes, and let the LLM decide variant switches. `[joy]` style codes should be plugin-author's concern. So Dizzy Eye, being a rig-exposed differential, should be a variant code."**

This reframed the phase entirely. New architecture:
- Plugin owns `[action]` vocabulary (declared in `plugin.yaml`)
- Rig only exposes `{variant}` + `<event>` codes (extracted by Phase 8)
- `RigCapabilities.emotion_bindings` field DELETED
- `_avatar_overrides.yaml` has 2 catalogs, not 3
- OLVT `emotionMap` ignored on import

### Q2-confirm: 4 implication checks

| Question | Answer |
|----------|--------|
| Q1: New architecture (plugin owns action vocab; rig only exposes variants + events)? | Yes |
| Q2: Plugin's per-rig customization mechanism? (α) plugin self-contained / (β) plugin-namespaced yaml section / (γ) skip | (α) plugin self-contained |
| Q3: OLVT emotionMap on import? (i) translate to plugin section / (ii) ignore | (ii) ignore |
| Q4: Milestone-1 [joy]→Love.exp3 in v2.0? (depends on Q2) | (ii) ignore |

**Notes:** User's strong, decisive calls. Resulting decisions:
- Plugin completely self-contained for action codes (no rig-file dependency)
- OLVT users lose `emotionMap` data on import — they re-curate emotion behavior in their plugin
- milestone-1 SC #2 baseline (`[joy]`→Love.exp3 300ms blend) NOT preserved verbatim. Default plugin produces a different visual; this is intentional, not a regression. Phase 6/10 baseline harness must capture v2.0 output as the new baseline.
- All 14 Teto expressions become variants; no emotion-binding extraction needed.

---

## Review screen layout

### Q3.1: Layout shape

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Single page scrollable | Header + Variants table + Events table (or empty) + Save bar. Consistent with Phase 9 HUD route shape. | ✓ |
| (B) Tabs (Variants / Events) | Tab switching. Risk: hidden placeholders in unselected tab. | |
| (C) Wizard (Step 1 / Step 2 / Review) | Multi-step. Annoying when re-opened from Settings. | |

**User's choice:** (A) Single page scrollable
**Notes:** Recommended option accepted. With architecture Q2 reducing catalogs from 3 → 2, single page is even more obviously right.

### Q3.2: Placeholder definition (Save-disabled friction)

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Only Cubism `exp_NN` style names | Targets Cubism w-exp extractor's auto-named placeholders. Other extractors produce semantic names that don't trigger the gate. | ✓ |
| (B) Any name with digits | Stricter but normalization regex would have stripped most digit suffixes. | |
| (C) Any name with CJK / special chars | Most strict — forces ASCII-only. But would force users to dec all CJK rig names. | |

**User's choice:** (A) Only `exp_NN`
**Notes:** Recommended option accepted.

### Q3.3: Per-row controls (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Edit code | Mandatory. User changes auto-derived to preferred. | ✓ |
| Delete row | Hides this hotkey from LLM (Phase 7 dispatch unregisters). Equivalent to milestone-1 is_meta filter. | ✓ |
| View source name (hover/readonly column) | Shows original `Star Eye [7]` so user knows what they renamed. | ✓ |
| Preview LLM syntax `{code}` | Inline `→ LLM emits: {hold-mic}`. Increases user comfort. | ✓ |

**User's choice:** All four
**Notes:** All controls selected; no single feature deemed superfluous.

---

## Teto milestone-1 data migration

### Q4: Migration mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| (A) Run full import flow once (dogfood) | After Phase 8 ships, operator imports Live2D/重音テト/ folder, walks review screen, edits 14 codes, commits new _avatar_overrides.yaml. Validates the import flow itself. | ✓ |
| (B) Write sidecar/scripts/migrate_teto_to_v2.py | Script reads two milestone-1 files → writes new file. Repeatable but bypasses dogfood. | |
| (C) Keep legacy fixture | Teto stays milestone-1 shape; only new imports use v2.0. Sidecar walks dual-read. | |

**User's choice:** (A) Run full import flow (dogfood)
**Notes:** Recommended option accepted. Phase 8 exit gate now includes "operator successfully completed import flow on Teto."

---

## Claude's Discretion

Areas where I committed defaults rather than asking the user:

- VTS hotkey identity → `HotkeyID` UUID (stable across rig rename); Phase 7 dispatch resolves by ID.
- `cdi3.json` optional inclusion: present → populate; absent → empty dict, no warning.
- Real-rig sample corpus: Teto + Live2D Inc. samples (Hiyori/Mark/Wanderer) + 1 OLVT-shape (`mao_pro` from local OpenLLM_Vtuber checkout). Community Cubism rigs deferred.
- OLVT `model_dict.json` commit-pin: pin to `OpenLLM_Vtuber` HEAD at plan-time; no vendored copy.
- Naming-normalization regex set: documented sequence of strip-rules (CJK brackets, ASCII brackets, [N] suffix, & → -, lowercase, ASCII-fold) + slug-validation `^[a-z][a-z0-9-]{0,30}$` with row-becomes-placeholder fallback on validation failure.
- Re-import semantics: prompt "Edit existing / Replace fully / Cancel" with Edit-existing default.
- Atomic write: `.tmp` → `fsync` → `os.replace()`; jsonschema validate before write; no `.draft.yaml` retention.
- `_avatar_overrides.yaml` carries `source_rig_path` field linking to imported rig folder.
- Bulk-rename helpers explicitly NOT included on review screen.

## Deferred Ideas

- Plugin-namespaced sections in `_avatar_overrides.yaml` (rejected in Area 2 Q2; plugin authors write own `<plugin>.yaml` next to avatar)
- Multiple expressions per emotion (not needed; emotion_bindings field eliminated)
- Reverse migration script for milestone-1 users (only Teto exists; dogfooded)
- LLM-suggested semantic naming during import review (anti-feature per research)
- Bulk-rename helpers on review screen (user declined)
- Per-avatar plugin selection field (milestone-3+ scope)
