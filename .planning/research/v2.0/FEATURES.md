# Feature Landscape — Milestone v2.0 Plugin + Animation Control

**Project:** AgenticLLMVTuber
**Milestone:** v2.0 (Plugin + Animation Control) — Phases 6–10 per `PROJECT_DESIGN.md` §14B
**Researched:** 2026-05-08
**Scope:** ONLY the new v2.0 surfaces. Existing milestone-1 features (LiteLLM gateway, sentence-buffered TTS, 60 Hz compositor, VTS bridge, single-thread chat, ParamFrame stream, `[joy]` smooth-blend SC) are treated as a fixed substrate, not re-researched.

**Reading guide:**
- *Table stakes* = absent → users say "this is broken" / "this is incomplete." Must ship.
- *Differentiator* = some apps have, some don't; presence sets the product apart. Ship if cheap; defer if costly.
- *Anti-feature* = some apps ship this, we explicitly do NOT. Documenting prevents scope creep.
- *Dep* = which milestone-1 surface a v2.0 requirement reaches into. Important because milestone-1 contracts (e.g. `ParamFrame` stream) are bytes-on-the-wire and shouldn't change for v2.0.
- *Complexity* = small (≤ 1 day) / medium (~1 week) / large (≥ 2 weeks single engineer).

---

## (a) Plugin Runtime — `BodyMotionPlugin` ABC + `plugin.yaml` manifest

### Plugin-runtime vs agent-runtime — the framing matters

§14B's "plugin runtime" is **a strategy/policy plug-in for body motion**, not the agent system (entire §9, deferred). The closest ecosystem analogues are:

- **napari plugin system** — manifest-declared commands and widgets, single-process Python ABC implementations, manifest is `napari.yaml` at top level of the package, manifest is registered through a `napari.manifest` setuptools entry point. Both YAML and TOML supported (YAML is the default). [napari Manifest Reference](https://napari.org/stable/plugins/contributions.html)
- **Home Assistant integrations** — `manifest.json` (JSON, not YAML, for HA) declares `domain`, `name`, `version`, dependencies; integration loaded as a Python module; `async_setup_entry` is the lifecycle hook. [HA Integration Manifest](https://developers.home-assistant.io/docs/creating_integration_manifest/)
- **OBS Studio plugins** — C-shared-library architecture with explicit lifecycle hooks (`obs_module_load`, `obs_module_post_load`, `obs_module_unload`); plugins register types into core registries. [OBS Plugin System](https://docs.obsproject.com/plugins)
- **Sublime Text plugins** — Python class auto-discovered by class-name suffix (`ExampleCommand` → `example`); no manifest, naming convention is the contract. [Sublime Plugin Docs](https://docs.sublimetext.io/guide/extensibility/plugins/)
- **VSCode extensions** — `package.json` contributions object declares `commands`, `configuration`, `keybindings`; activation events; the manifest *is* the contract surface. [VSCode Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- **stevedore (OpenStack)** — pure Python entry-points-based plugin loader; the canonical "ABC + entry-point + setuptools" pattern in 2026. [stevedore Tutorial](https://docs.openstack.org/stevedore/latest/user/tutorial/creating_plugins.html)

### Table stakes (must have)

| Feature | Complexity | Dep | Rationale |
|---|---|---|---|
| **Manifest file (`plugin.yaml`) per plugin** declaring `name`, `version`, `entrypoint`, `api_version`, `action_codes` | small | none new | Universal across napari/HA/VSCode/OBS. §14B.4 already specifies. YAML over TOML matches Python sidecar convention; TOML is fine if the team prefers — both are "table stakes" formats in 2026. |
| **Entrypoint as `module:class`** (Python import path) | small | sidecar venv | This is the dominant 2026 pattern (setuptools entry-points spec, napari `python_name`). Stevedore tutorial: `name = module:importable`. Don't invent a path syntax. |
| **`api_version` field with explicit compatibility check** | small | none | Without this, plugin loader cannot reject obsolete plugins; we'd silently load broken state. HA, VSCode, napari all enforce. Cheap to add now, hostile to retrofit. |
| **Lifecycle hooks: `on_load(capabilities)` / `on_unload()`** | small | RigCapabilities surface (new in v2.0) | §14B.4 already specifies. ABC pattern is the 2026 idiom (stevedore, napari, HA). The capabilities-injection-on-load pattern is what makes the "default plugin reads RigCapabilities and adapts" requirement implementable. |
| **Plugin discovery from two locations**: in-tree `plugins/` (ships defaults) + `userData/plugins/` (user-installed) | small | electron-store userData path | §14B.4 specifies. VSCode, OBS, napari all do split discovery. User vs builtin must be visually distinguishable in any future UI. |
| **System-prompt assembly from plugin's `action_codes` + descriptions** | medium | LLM system prompt template (milestone-1) | This is the *unique* requirement: plugin contributes vocabulary the LLM can emit. Closest analogue is VSCode's `contributes.commands` shaping the command palette — the manifest declares *what is callable*. The system-prompt fragment must be deterministic (KV-cache discipline, MEMORY-noted) — sort `action_codes` by name, fix the delimiter, fix the section header. |
| **Single-active plugin, switched at startup via developer config** | small | `model.yaml` or new `app.yaml` | §14B.4 explicit. Hot-swap is anti-feature for v2.0 (deferred). Simpler than runtime registry/swap. |
| **Reserved-name guard at plugin-registration time** (`<think>`, `<tool_call>`, `<function_call>`) | small | actions_extractor regex (milestone-1) | §14B.3 explicit. Without this, a plugin that names an action `[think]` collides with reasoning-block extraction. Fail loud at load — silent fallback corrupts the parsing layer. |
| **Cross-category uniqueness check** at load (no `[joy]` and `<joy>` simultaneously) | small | three-category parser (Phase 7) | §14B.3 explicit. Without it, the LLM can emit ambiguous tags. |

### Differentiator (consider for v2.0; defer if costly)

| Feature | Complexity | Worth it? |
|---|---|---|
| **Plugin author can declare optional config schema** in `plugin.yaml` (e.g., default plugin's body-sway amplitude, blink rate range) — JSON Schema or pydantic-style | medium | YES if cheap. VSCode's `contributes.configuration` is the gold standard. For v2.0, even a flat `config_defaults: {}` block + a per-plugin override file is enough. The slider HUD is config-discovery for runtime params; a static config block is config-discovery for tuning constants. |
| **Plugin-declared dependencies** (other Python packages it needs) | medium | NO for v2.0. §14B.9 explicit open question — default is "no isolation, plugins use host venv." Ecosystem lesson: HA went through this and it's painful (custom-component conflicts). Defer to milestone-3 if friction surfaces. |
| **Plugin metadata: author, license, homepage, description** | small | YES, free. Standard manifest hygiene. Matters for any future "browse plugins" UI; matters NOW for `--help` listings or settings pane. |
| **Plugin contributes to settings UI** (config form auto-generated from schema) | medium | NO for v2.0. Slider HUD covers runtime discovery; static config can be edited in `plugin.yaml` directly. UI auto-generation is a milestone-4 polish item. |
| **Default plugin written as a *reference implementation*** (deliberately verbose, well-commented, used as the template `cookiecutter`-style for third-party authors) | small | YES. Absorbs §14B.4's required "default plugin ships with system" deliverable. Costs nothing extra; pays back when plugin-3 lands. |

### Anti-features (explicitly NOT in v2.0)

| Anti-feature | Why we don't ship |
|---|---|
| **Hot-reload / runtime plugin swap** | §14B.4 explicit: "no runtime hot-swap in milestone-2." Hot reload requires `on_unload` to actually be a teardown, not a hint — significant testing surface. Defer. |
| **Multiple-active plugins (composition / mixing)** | §14B.4 single-active explicit. Composition needs an arbitration policy (which plugin wins on `MouthOpenY`?) and a UI for ordering — that's a milestone-3+ design exercise. |
| **Plugin sandboxing / permission model** | Local-first single-user; plugins run in the same Python sidecar as the rest. Permission model would be theatre (a malicious plugin can already `import os`). VSCode and OBS don't sandbox either. Document trust boundary clearly: plugins == code, treat like libraries. |
| **Plugin marketplace / registry** | PROJECT.md "Out of Scope (v1 entirely)" lists plugin/extension marketplace. |
| **Plugin code signing** | Same scope-out reasoning. |
| **Plugin written in TS / WASM / non-Python** | `BodyMotionPlugin` ABC is Python — runs in the sidecar where ParamFrame is generated. Cross-language plugin authoring is a milestone-N topic. |
| **Plugin-injected JavaScript into the renderer** | Slider HUD is the only "renderer plugin surface" in v2.0; it's first-party. Third-party renderer code needs a sandboxing story we don't have. |
| **Plugin-declared *new* parameter contributions to the LLM beyond action codes** (e.g., a plugin adds a new `<event>` category) | §14B.3 fixes the three categories. Plugin extends the *vocabulary* within a category, not the *grammar*. Matches VSCode's contributions: extensions add commands, not new contribution-point types. |

### Hand-wavy pitfalls to defend against in REQs

- **Default plugin must absorb the milestone-1 `[joy]` smooth-blend behavior verbatim** — that's the §14 SC #2 demo, deferred to Phase 10's verification re-run. If the default plugin breaks the joy blend, milestone-1 SC-01 fails on re-verification.
- **Plugin's `on_load` must receive enough rig capability data that "default plugin reads RigCapabilities and adapts" works on Teto** (whose `ParamBodyAngleX` is orphan per Phase 4 investigation). The capabilities surface is itself a v2.0 deliverable — see (e) below for what it must contain.
- **System-prompt assembly determinism is a KV-cache concern.** The MEMORY note "system prompt bytes-identical at boot" applies. Plugin-derived prompt fragments must be sorted, delimiter-fixed, and not include timestamps or runtime-varying state. Bake into the REQ.

---

## (b) Slider HUD with Per-Param Locks — live state inspector

### Genre map

The slider HUD lives at the intersection of three traditions:

- **Web/Electron debug panes** — Tweakpane, Leva, Theatric. Tweakpane is the 2026 vanilla-JS standard; Leva is React-first; Theatric is React-first with persistence. All support sliders, range bindings, monitor (read-only) bindings, folders. [Tweakpane Bindings](https://tweakpane.github.io/docs/input-bindings/), [Leva](https://github.com/pmndrs/leva), [Theatric](https://www.theatrejs.com/docs/latest/api/theatric).
- **Game-engine inspectors** — Unity Inspector (custom editors via IMGUI / UI Toolkit), Godot Remote Scene Tree (live property edit on running game). Godot's "tweak the player movement speed and directly see the effect live in the game without restarting" is the closest UX to what v2.0 needs. [Godot Remote Inspector](https://medium.com/@florian-trautweiler/remote-scene-tree-in-godot-4-af0bf4bc9d35).
- **DCC-tool channel boxes** — Maya channel box, Blender properties panel, Cubism Editor parameter panel. These show *all rig parameters* with sliders; lock toggles correspond to "set key" or "limit range." Cubism Editor itself is the closest analogue and the user already knows it.

### Table stakes

| Feature | Complexity | Dep | Rationale |
|---|---|---|---|
| **Scrollable list of all writable params** with name, current value, min/max, slider | medium | New IPC: HUD-mode channel; `RigCapabilities` enumeration | §14B.5 specifies. Tweakpane/Leva/Godot all do exactly this. |
| **Live value updates (read-only display)** at HUD's tap rate (15 Hz proposed, §14B.9 open) | small | Compositor sidecar tap | Universal in monitor bindings. Tweakpane defaults to 200ms (~5 Hz) for monitor refresh; we want faster (15 Hz = 67ms) because animation is the point. |
| **Per-param lock toggle** with auto-engage on slider drag | small | Compositor lock-filter (new) | §14B.5. UX precedent: Cubism Editor's "lock" icon on parameter rows; Photoshop layer-mask lock. The auto-engage on drag is the user-affordance the design wants — touching = locking; user explicitly clicks unlock to release. |
| **Lock semantics**: locked param → compositor skips writes from plugin and built-in drivers for that param | small | Compositor lock filter | §14B.5. The contract surface needs to be exactly one place (compositor's per-param mux) so plugins don't have to know about locks. |
| **System-primitive override of locks** (lipsync still wins on `MouthOpenY`) | small | Compositor lock filter + speech driver priority | §14B.5 explicit, with a documented exception. Speech without mouth movement looks broken. The override list must be a constant, not user-editable, and must be documented in-app (e.g., grayed lock with hover tooltip "lipsync overrides this lock"). |
| **Session-only persistence** — locks cleared on app restart | small | none | §14B.5 explicit. UX rationale: locks are a discovery tool. A user who locked `ParamBrowLY` last week and forgot will be confused next session by motionless brows. |
| **Throttling on the HUD-mode IPC channel** (proposed 15 Hz) | small | New IPC channel | §14B.5 + §14B.9. AVT-01's "renderer never sees 60 Hz traffic" rule preserved. 15 Hz is a defensible default — fast enough to read animation, slow enough to be ignorable bandwidth. |
| **HUD opens/closes cleanly** — channel only active when HUD open | small | IPC lifecycle | Same AVT-01 reasoning. Closed HUD = zero IPC traffic on that channel. |

### Differentiator

| Feature | Complexity | Worth it? |
|---|---|---|
| **Filters on the param list** ("show writable" / "show currently animating" / "show locked") | small | YES — already in §14B.5. With ~50–150 params on a typical Cubism rig, an unfiltered list is a discoverability disaster. The "currently animating" filter (delta exceeds threshold over last N frames) is the *parameter-discovery* killer feature — find which param is doing the body sway you can see, by watching it tick. |
| **Search / fuzzy match by param ID** | small | YES — costs ~10 LOC, scales the param-list affordance to non-trivial rigs. |
| **Range/bounds display** (min/max from `RigCapabilities`) | small | YES — Tweakpane and Leva both expect this. Slider without bounds is useless. |
| **Group-by-prefix folding** (`ParamAngleX/Y/Z` collapse under "Angle") | medium | NICE-TO-HAVE — defer to a polish pass. Tweakpane folders are trivial; deciding the grouping heuristic is the work. Cubism rigs lack consistent prefixes; might just be alphabetical. |
| **Visual indicator of which driver is currently writing this param** (idle vs speech vs plugin) | medium | DIFFERENTIATOR but EXPENSIVE. Requires the compositor to expose write-source attribution per param per frame. Defer unless debugging a specific bug. Phase 9 is the right place to flag it as out-of-scope. |
| **Snapshot & restore "preset"** of slider values | medium | NO for v2.0 — that's exactly what plugins are for. Encourage users to write a plugin instead of saving slider snapshots. |
| **Export current values as plugin-config-yaml stub** | small | DEFER — could be a useful "I tuned this manually, now make me a plugin" path, but it's milestone-3 polish. |

### Anti-features

| Anti-feature | Why not |
|---|---|
| **Persistent lock state across sessions** | §14B.5 explicit anti-feature. Surprises users. |
| **Read-write of milestone-1 chat / TTS / LLM-config state from the HUD** | The HUD is for the *parameter surface only*. Mixing in unrelated state turns it into a swiss-army settings panel; React-DevTools-style "edit any prop" is anti-pattern for a user-facing tool. |
| **Slider HUD as a remote-control protocol over the network** | Local-first constraint (CLAUDE.md). HUD is in-process renderer ↔ sidecar IPC, not a remote-debug surface. |
| **HUD-driven LLM tag firing** ("press a button to make it emit `[joy]`") | Confusion of layers. The LLM emit path is the LLM emit path; manual fire is a separate "test panel" affordance, not the slider HUD. Out-of-scope for v2.0. |
| **HUD as the canonical UI for setting plugin-config values** | The HUD is read-current-state-and-tweak-for-discovery. Plugin config is a separate `plugin.yaml` / config UI surface. Mixing them creates two conflicting persistence stories. |
| **Param graph timeline / scrubber** | That's a milestone-4+ debugging tool. Tweakpane doesn't ship it; we shouldn't either. |

### Pitfalls / open questions to bake into REQs

- **Lock arbitration when user grabs the slider on `MouthOpenY` while lipsync is writing** is in §14B.9 as an open question. The proposed answer ("lipsync still wins; system primitives override locks") is the right one — bake it into REQs and document the exception list. The exception list is short: lipsync (`MouthOpenY`/equiv), blink (`ParamEyeLOpen`/`R` — system blink scheduler is a primitive), idle breathing if it counts as one. Anything else: lock wins.
- **15 Hz is a proposal, not benchmarked** (§14B.9). Bake a "verify perceptually" task into Phase 9; budget for fall-back to 30 Hz if 15 Hz looks stuttery on fast-changing params.
- **`RigCapabilities` enumeration is a v2.0-net-new contract.** It's referenced by the plugin runtime AND the slider HUD. Define it once, use it twice. Source-of-truth is VTS introspection per MEMORY note ("capability data from VTS introspection, not overrides").

---

## (c) Avatar Import Flow with Mandatory User Review

### Genre map

- **VTube Studio's own model import** — drop folder into `Live2D Models/`, VTS auto-creates `<name>.vtube.json`, runs Auto-Setup ("look for default Live2D parameters in your model"). Auto-extract is universal; review is the *user's* problem inside VTS Hotkey tab. [VTS Loading Models](https://github.com/DenchiSoft/VTubeStudio/wiki/Loading-your-own-Models), [VTS Expressions Wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/Expressions-(a.k.a.-Stickers-or-Emotes))
- **Live2D Cubism Editor** — opens `model3.json`, displays parameter and part lists from `cdi3.json` if present. No "review" gate — it's an authoring tool, not a content pipeline.
- **Steam Workshop uploaders** (Garry's Mod, Skyrim, etc.) — auto-extract title/description from file, *mandatory* user-review form before publish. Recent (2025) Steam policy added an approval step for some types of UGC. [Steam Workshop Implementation](https://partner.steamgames.com/doc/features/workshop/implementation)
- **Game-mod managers** (Vortex, MO2) — read mod manifest, present user with conflicts/load-order, never silent. Review is *optional* post-install, not gating import.
- **Photo apps** (Lightroom import dialog) — auto-extract EXIF, surface for *review and rename* before commit. Closest UX template for v2.0's "auto-extract + mandatory review screen" requirement.

### What user expectation is "mandatory review vs auto-confirm"

Pattern across creator-facing apps in 2026: **auto-confirm if the metadata is unambiguously correct; mandatory review if the auto-extract requires human semantics.** Avatar import is firmly in the "human semantics" bucket because:
- Cubism `Expressions[].Name` is often `exp_01`, `exp_02` — useless to LLMs.
- VTS hotkey names often include keybind decorations like `[1] 笑顔【明るい】` — needs stripping.
- Motion file names often reflect numbered drafts (`mtn_01_v3.motion3.json`) not semantic intent.

The §14B.6 mandatory-review screen is the right call and matches the consensus pattern.

### Table stakes

| Feature | Complexity | Dep | Rationale |
|---|---|---|---|
| **Format detection from file shape** (VTS standard / Cubism w/expressions / Cubism bare / OLVT model_dict) | small | none new | §14B.6 explicit. |
| **Auto-extract from VTS `.vtube.json`** — pull hotkeys with `Action: "ToggleExpression"` as variants, derive names by stripping `[N]` and `【】` decorations, lowercase, hyphenate | medium | New file-format parser | §14B.6 spec. The naming-cleanup heuristic is the work — needs a regex inventory + tests. |
| **Auto-extract from Cubism `model3.json` `FileReferences.Expressions[]`** as variants list | small | New parser (Cubism file-format reader) | §14B.6. `model3.json` structure is well-documented (Live2D `CubismSpecs/FileFormats/model3.json.md`). [model3.json spec](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/model3.json.md) |
| **Auto-extract events from `.motion3.json` files** named after motion-group keys + filenames | small | Cubism file-format reader | §14B.6 explicit. |
| **OLVT `model_dict.json` drop-in** — read OLVT's existing format and pre-populate the review screen | medium | OLVT format reader (one-off) | §14B.6 explicit. Captures OLVT-port-preference (MEMORY-noted). |
| **Mandatory review screen** showing each auto-extracted catalog (variants, events) with: edit name / delete entry / add entry / skip | medium | New renderer surface | §14B.6 explicit. UX template: Lightroom import / Steam Workshop publish form. |
| **Persistence to `_avatar_overrides.yaml`** sibling to `avatar.yaml` | small | electron-store / `app.getPath('userData')` | §14B.6 explicit. The MEMORY note "capability data from VTS introspection, not overrides" still holds — overrides file is *naming and curation*, not capability data. |
| **Re-open review screen from settings** for catalog edits at any time | small | Settings UI surface | §14B.6 explicit. Without this, a user who clicked through too quickly is stuck. |
| **Reserved-name collision check** on user-edited names (no `<think>`, no duplicates within a category) | small | Three-category validator (Phase 7) | §14B.3 + §14B.6. Validation must run *during* the review screen, not at LLM-runtime. |

### Differentiator

| Feature | Complexity | Worth it? |
|---|---|---|
| **Surface `cdi3.json` parameter and part names** when present, into the slider HUD's param-name display | small | YES — costs almost nothing, transforms the HUD experience. cdi3.json is *exactly* the user-facing-name layer Cubism Editor uses. Many third-party rigs ship it; some don't. Graceful fallback: if cdi3.json absent, show raw IDs. |
| **Show preview thumbnail of each expression / motion** in the review screen | medium | NICE-TO-HAVE. Cubism doesn't ship pre-rendered thumbnails; we'd need to drive VTS to load and screenshot, or render motion3.json in-process. Probably defer to milestone-3. |
| **"Generate semantic names from filename via LLM" suggestion** for `exp_01` → `smile` | medium | INTERESTING but risky. The LLM is on. Could ask "based on this rig's expressions [list], suggest natural-language labels." Defer; the manual review path is fine for milestone-2. Add as Phase-8 stretch goal. |
| **Reject Cubism 5.3 rigs at import with helpful error** ("VTS doesn't support 5.3 yet, try 5.2 export") | small | YES — STACK.md "Cubism 5.3 NOT yet supported" + "What NOT to Use" line. CLAUDE.md flags this. Validate `model3.json` `Version` field at import; bail with link to docs. |
| **Validate `.vtube.json` schema integrity** before extraction | small | YES — corrupt or hand-edited `.vtube.json` is a real failure mode. Fail loudly, point to file. |
| **Diff view: "you previously edited these names; auto-extract found new entries"** when re-running on an updated rig | medium | YES — power users iterate on rigs. Without diff view, re-import overwrites their work. Defer if Phase-8 estimate runs over; flag as Phase-8 stretch. |

### Anti-features

| Anti-feature | Why not |
|---|---|
| **Silent auto-confirm** of catalogs without review | §14B.6 explicit ("No silent automation"). `exp_01`-style placeholders feed back into LLM prompts and make the bot unable to express. |
| **Per-avatar plugin override** ("avatar A uses plugin X, avatar B uses plugin Y") | Single-active plugin is a milestone-2 invariant. Per-avatar plugin selection is milestone-3+. |
| **Catalog editing during chat** (open a panel mid-conversation, rename) | Use the settings re-open path. Mid-chat edits create timing-and-persistence races against KV-cache discipline (system prompt would shift mid-thread → cache invalidation). |
| **Cloud-sync of overrides** | Local-first. PROJECT.md "Cloud-hosted memory sync" out of scope generalizes here. |
| **Avatar marketplace / share button** | Out of scope (PROJECT.md). |
| **Auto-import from ZIP without user click** | Friction is correct here. A ZIP could contain malware (e.g. Cubism textures replaced with executables in a poorly designed sandbox); user must consciously open the file picker. |

### Pitfalls

- **Cubism file-format parser is a real piece of work.** The format spec is stable but has corner cases (`Groups`, `HitAreas`, parameter group nesting). Phase 8 should budget time for a small but rigorous parser, possibly cribbed from existing OSS readers (Cubism SDK is the canonical source; OLVT's renderer-side code may have a partial parser).
- **VTS `.vtube.json` is human-readable but undocumented at field level.** The wiki documents the *concept* (hotkeys, expressions). The actual JSON shape requires inspection of real files. Phase 8 needs ~3–5 sample `.vtube.json` files from real rigs (Teto + Hiyori + Mark + a community model) to ensure parser robustness. Document the shape in `.planning/research/` once observed.
- **OLVT `model_dict.json` schema is a moving target** — OLVT-port-preference applies, but pin to a specific OLVT commit when Phase 8 lands and document the schema we support. Out-of-band schema drift is a known port-fragility.
- **The review screen's "save & continue" flow** must atomically write `_avatar_overrides.yaml` + register catalogs with the three-category parser. Half-written state is a recovery problem on next launch. Use a tmp-file + rename pattern.

---

## (d) Three-Category LLM Code System — `[action]` `{variant}` `<event>`

### Genre map of "extending an LLM's emit vocabulary"

- **OpenAI function calling / Anthropic tool use / MCP** — heavyweight, schema-typed, JSON-arg, agentic. The model is **trained** to emit these formats. Wrong shape for our use case (we're not doing tool calls; we're doing inline expressive markup mid-sentence).
- **Slack-emoji-style markup** (`:smile:` → emoji) — chat-tier, free-form, well-known to LLMs. Closest precedent for our `[joy]` style. Risk: overlap with chat-emoji conventions.
- **MUD command tokens** (`look`, `north`, `:emote`) — pre-LLM era, but the *parsing model* is identical: regex-tokenize a fixed vocabulary out of free text.
- **Discord bot custom emoji syntax** `<:name:id>` — interesting because Discord uses `<` `>` for non-trivial markup. Our `<event>` syntax is direct visual analogue. [Discord emoji format reference](https://maah.gitbooks.io/discord-bots/content/getting-started/custom-and-animated-emojis.html).
- **OLVT `emotionMap`** (single namespace, `[emotion]`) — milestone-1's foundation. Three-category is the v2.0 evolution. [OLVT Live2D Guide](http://docs.llmvtuber.com/en/docs/user-guide/live2d/).
- **POML / LLMON** (academic markup-for-LLMs proposals 2026) — heavyweight, structured, instruction-vs-data distinction. Wrong layer for us — we're below the system-prompt level, we're inline assistant-output markup. [POML overview](https://techcommunity.microsoft.com/blog/educatordeveloperblog/unlock-the-full-potential-of-llms-with-poml-the-markup-language-for-prompts/4447849).

### The three-category design choice (§14B.3) is right

Plan A locked in design discussion 2026-05-08: different syntax per category → zero collision possibility. This is the right choice over the alternatives:

| Alternative | Why not |
|---|---|
| Single namespace, type-prefix (`[action:joy]` `[variant:hold-mic]`) | Verbose, eats system-prompt tokens, easier for LLM to misformat. |
| JSON tool-call style | Wrong layer (tool-call interrupts speech; we want inline markup that doesn't break sentence flow). |
| YAML/XML blocks | Same — block-shaped, breaks streaming TTS sentence boundaries. |
| Slack-emoji `:joy:` / `:variant:hold-mic:` | Single-syntax → ambiguity; collides with chat-emoji conventions; users may type `:smile:` and surprise the parser. |
| Discord-style `<:name:id>` | Unique syntax good, but the `id`-suffix is irrelevant for us; cleaner to drop. |

### Table stakes

| Feature | Complexity | Dep | Rationale |
|---|---|---|---|
| **Per-category regex parsers** for `[xxx]` `{xxx}` `<xxx>` | small | actions_extractor decorator (milestone-1) | §14B.3 + §14B.7 (Phase 7). The `[xxx]` parser already exists in milestone-1's actions_extractor; v2.0 adds `{xxx}` and `<xxx>` parsers. |
| **Adversarial split-bracket robustness** (carry-over across token-stream chunks) for all three categories | small | Reuse milestone-1's `[xxx]` split-bracket fix (already programmatically verified) | Milestone-1 SC #3 BLOCKER closed. The same pattern needs to handle `{` `}` `<` `>` boundaries. Cost: extend the existing buffer-and-resume logic, ~50 LOC. |
| **Reserved-name guard** at plugin/avatar load time (`<think>`, `<tool_call>`, `<function_call>`) | small | Plugin runtime + avatar loader | §14B.3 explicit. These collide with reasoning-block / tool-call protocol shapes that some LLMs emit natively. |
| **Cross-category uniqueness check** at avatar+plugin load | small | Plugin runtime + avatar loader | §14B.3 explicit. |
| **System dispatch by category** — variants → VTS items/expressions, events → motions, actions → plugin | medium | Plugin runtime + VTS bridge (milestone-1) | §14B.7 Phase 7. Each category has a distinct dispatch path; mixing them would be a milestone-1 actions_extractor regression. |
| **Bracket-stripping from chat display** for all three categories | small | display_processor (milestone-1) | Existing `[xxx]` strip logic generalizes; Phase 7 extends it. Without this, `[joy] {hold-mic} <wave>` shows up in chat text. |
| **System-prompt assembly** documents the three-category vocabulary the LLM can emit, with examples | medium | Plugin manifest + avatar overrides | §14B.4 (action codes from plugin) + §14B.6 (variants/events from avatar). The LLM has to *know* about all three. Determinism note: see (a) above re KV-cache. |
| **Validation of LLM-emitted codes against the loaded catalog** — silently ignore (and log) unknown codes rather than crash | small | actions_extractor | The LLM hallucinates. A `[surprise]` emit when only `[joy]` is registered should fail gracefully, not abort the conversation. Milestone-1's tag system likely already does this; verify and document. |

### Differentiator

| Feature | Complexity | Worth it? |
|---|---|---|
| **Variant state-tracking** ("currently active variant" persisted in chat-state, displayed in HUD) | medium | YES — variants are *persistent* (toggle until next change), so without state-tracking the user can't tell what's currently on. Phase 7 should make this part of the dispatch. |
| **Variant-toggle as "off" semantics** — does emitting `{hold-mic}` while already in `hold-mic` toggle off, or no-op? | small (decision) | RESOLVE in Phase 7 design. §14B.3 says "Toggle (on until next change)" — implies emitting same variant is no-op, only a different variant changes state. Document the rule. |
| **Event timeout based on `motion3.json` Duration** (auto-complete) | small | Cubism file-format reader | §14B.9 explicit open question. Right answer: read `Duration` from the motion file, fall back to a hardcoded ceiling (5–10s) if missing. Cheap. |
| **LLM emits multiple categories in one response** (`[joy] {hold-mic} <wave>` in one sentence) | small | Per-category parser | §14B.7 explicitly tests this — Phase 7 deliverable is "LLM emits `[joy] {hold-mic} <wave>` in one response and three distinct paths fire." Already on the roadmap. |
| **Emit-vocabulary documentation auto-generated from registered codes** for inclusion in `--help`, settings, README | small | Plugin manifest + avatar overrides | NICE-TO-HAVE. Pays back in user-self-help. |

### Anti-features

| Anti-feature | Why not |
|---|---|
| **Letting plugins extend the *grammar*** (e.g., a plugin adds a new `(xxx)` category for parametric actions) | §14B.3 fixes the three categories. New grammar = LLM has to be reminded; system-prompt growth; KV-cache pressure. Plugins extend vocabulary within categories, period. |
| **JSON-schema-validated structured args** within tags (`[joy: {intensity: 0.7}]`) | Defeats the inline-markup design. If you want structured args, use tool-calls, but tool-calls are an agent-runtime thing (deferred). For now, args are *intensity-implicit* (the compositor decides) or *vocabulary-encoded* (`[joy-soft]` vs `[joy-loud]` as separate codes). |
| **Cross-category aliasing** (`[joy]` and `<joy>` doing the same thing) | §14B.3 uniqueness check forbids. Aliasing creates ambiguity for LLM training — pick one category per concept. |
| **User-defined regex for parsing** | Hardcoded grammars. The three brackets are a contract; user-extensible parsers turn config into a security issue. |
| **Streaming-in / mid-token tag rewriting** | The actions_extractor model is "extract from completed token chunks"; modifying mid-stream is a milestone-N research project. |

### Pitfalls

- **Reserved-name list must be complete and locked.** Add to it: `<think>`, `<tool_call>`, `<function_call>`, `<function_calls>` (Anthropic schema), `<invoke>` (also Anthropic), `<parameter>`, `<thinking>`. Some Gemini and o-series models emit different reasoning sentinels — research the current list before Phase 7 freezes the guard.
- **Catalog uniqueness check must be re-run when avatar and plugin combinations change** (default plugin + Teto-overrides → unique; user's plugin + Hiyori-overrides → must re-check). Phase 6 owns plugin load; Phase 7 owns the cross-check; Phase 8's avatar load triggers re-validation.
- **Chat-display stripping order matters.** If `[joy]` is stripped before reasoning-block extraction, a hypothetical `[joy<think>...</think>]` malformed emit could silently corrupt. Order: reasoning extraction → tag extraction → display strip. (Verify against milestone-1's actual order.)

---

## (e) Live2D / Cubism File Format Conventions

This section is the most concrete: which files exist, what each contains, and which fields the import flow can mine for catalog entries.

Sources are authoritative — Live2D's own `CubismSpecs` repo and `docs.live2d.com` site documentation.

### File inventory of a typical avatar package

| File | Purpose | Required? | User-facing names? | Catalog source for v2.0? |
|---|---|---|---|---|
| **`<model>.model3.json`** | Top-level manifest. `FileReferences` block points to all other files: `Moc`, `Textures`, `Physics`, `Pose`, `Expressions`, `UserData`. Also contains `Groups` (parameter groups for blink/lipsync) and `HitAreas`. | **YES** — without it, no avatar | No (mostly file paths) | **YES — drives format detection.** [model3.json spec](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/model3.json.md) |
| **`<model>.moc3`** | Compiled binary model (deformer math, mesh, parameters). Cubism-runtime opaque. | **YES** | No | NO — binary |
| **textures (`*.png`)** | Texture atlases | **YES** | No | NO |
| **`<model>.physics3.json`** | Physics-chain configuration (hair sway, etc.) | No (rig may have none) | No (internal IDs) | NO directly, but knowing it exists matters for body-sway investigation |
| **`<model>.pose3.json`** | Pose-part visibility groups | No | No | NO |
| **`<model>.cdi3.json`** | **Display names** for parameters, parts, parameter groups. The `Names` reference layer — what Cubism Editor's Inspector shows. | No (often missing on user-distributed rigs) | **YES — the only file with semantic names for *params*** | **YES — slider HUD reads this for human-readable param labels.** [cdi3.json info](https://docs.live2d.com/en/cubism-sdk-manual/json-unity/) |
| **`<model>.userdata3.json`** | Optional user metadata (artist comments) | No | Maybe (free-form) | Probably NO; surface in import-screen "info" if present |
| **`*.exp3.json`** (one per expression) | Expression motion: parameter-value blends + Type/FadeInTime/FadeOutTime; `Parameters[]` with `Id`, `Value`, optional `Blend` ("Add"/"Multiply"/"Overwrite"). | No (rig may have no expressions) | **Filename is a name**, but generic on user rigs (`exp_01.exp3.json`) | **YES — variants candidate.** Names in `model3.json` `FileReferences.Expressions[].Name` are the user-friendly handle if present. [exp3.json spec](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/exp3.json.md) |
| **`*.motion3.json`** (one per motion) | Animation curves over parameters; has `Meta.Duration`. Grouped via `Groups` in `model3.json` (e.g. `Idle`, `TapBody`). | No (rig may have no motions) | Filename is a name, plus group key | **YES — events catalog source per §14B.6.** Duration field answers §14B.9's auto-completion-timeout question. [motion3.json spec](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/motion3.json.md) |
| **`<model>.vtube.json`** | **VTS-only** (not Cubism-standard). Contains all VTS configuration: hotkeys (with `Action: ToggleExpression`/`TriggerHotkey`/etc.), parameter mappings, ON/OFF states, art-mesh tints, etc. Auto-created by VTS on first load. **Human-readable, JSON.** | YES if VTS user, otherwise absent | **YES** — hotkey names are user-authored | **YES — variants from `Action: "ToggleExpression"` hotkeys per §14B.6.** [VTS Model File Wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/VTube-Studio-Model-File) |

### What's *missing* on user-distributed models

Critical for setting Phase-8 expectations:

| Asset | Often missing on user rigs? | Implication for v2.0 |
|---|---|---|
| `cdi3.json` | **Often missing** — many community rigs ship without it | Slider HUD must gracefully fall back to raw param IDs (`ParamAngleX`, not "Angle X"). Document this. |
| Semantic expression names in `model3.json.FileReferences.Expressions[].Name` | **Often generic** (`exp_01`, `exp_02`) — rig authors fill these in last, if at all | Mandatory review screen is the right answer; user retypes to "smile", "surprised", etc. |
| Motion file names | **Often technical** (`mtn_idle_v3.motion3.json`) | Same — review screen fix-up. |
| `physics3.json` body-physics chains | **Variable** — some rigs have body sway built in; Teto's body params are orphaned (Phase-4 finding) | Body-sway plugin must read capabilities and adapt. R-OPEN-1 carries forward. |
| `<model>.vtube.json` hotkeys for non-VTS users | **Absent entirely** for raw Cubism rigs | Format detection must distinguish VTS-flavored vs Cubism-bare to pick the right extractor (§14B.6 already says this). |
| Motion `Meta.Duration` | **Always present** in valid `motion3.json` (it's required) | Event auto-completion timeout has a real answer per file (§14B.9). |
| `ParamBodyAngleX/Y/Z` deformer bindings | **Variable** — many rigs only animate face/head; Teto specifically has these orphaned | RigCapabilities must surface "writable but no visible motion" vs "writable and bound." VTS introspection may not distinguish; smoke-pass is the only certain method. |

### Table stakes for the import flow's file handling

| Feature | Complexity | Rationale |
|---|---|---|
| **Tolerate missing optional files** (`cdi3.json`, `physics3.json`, `pose3.json`, `userdata3.json`) | small | They're *all* optional in spec. Crashing on absence is the most common rookie bug. |
| **Validate `model3.json` `Version` field** at import; reject Cubism 5.3 with helpful error | small | STACK.md "Cubism 5.3 NOT yet supported." |
| **Validate file-references resolve** before declaring import successful | small | A `model3.json` pointing to missing textures is a rendering crash later. |
| **Read `cdi3.json` if present, fall back to raw IDs** for slider HUD param labels | small | Documented above. |
| **Read `motion3.json.Meta.Duration` for event auto-completion timeout** | small | Closes §14B.9 open question. |
| **Surface VTS-vs-Cubism format detection on the review screen** so user knows what was extracted | small | UX clarity. "VTS bundle detected — found 12 hotkeys, 5 motions" beats silent extraction. |

### Differentiator

| Feature | Complexity | Worth it? |
|---|---|---|
| **Surface `userdata3.json` artist info** on the avatar's about-screen | small | NICE — credit creators. Trivial cost. Defer to milestone-3 polish. |
| **Pre-scan for orphan params at import** (write each param, observe whether `RigCapabilities` reports any deformer downstream effect) | medium | DIFFERENTIATOR — captures Phase-4's "smoke pass" idea. Probably milestone-3 (it's a real test harness, not a parse). Phase 4's body-sway investigation report should inform Phase-8's decision on whether to ship a smoke-pass UX. |
| **Show parameter group structure (`Groups[]` in model3.json) in slider HUD folders** | small | YES if cheap. Cubism rigs declare semantic groups (lipsync params, blink params); the HUD can fold by group instead of alphabetically. |

### Anti-features

| Anti-feature | Why not |
|---|---|
| **Editing `.model3.json` from inside our app** | We're a consumer of Live2D files, not an authoring tool. Edits go to `_avatar_overrides.yaml` only. |
| **Re-encoding `.moc3`** | Binary format, vendor-controlled. |
| **Bundling Cubism SDK** | CLAUDE.md / §11 / §13.1 — VTS+pyvts is the rendering pipe; no Cubism SDK in the repo. |
| **Authoring expressions or motions** | Use Cubism Editor. |

---

## Cross-cutting Dependencies on Milestone-1 Surfaces

This map is what /gsd:new-milestone's REQ-defining step needs to see explicitly:

| v2.0 Capability | Reaches into (milestone-1 surface) | Risk if milestone-1 surface is brittle |
|---|---|---|
| Plugin runtime | LLM system-prompt assembler (LLM-02 in milestone-1); LiteLLM streaming hooks (LLM-01); actions_extractor regex (LLM-02) | KV-cache discipline — system prompt must remain bytes-identical at boot; plugin contributions must be deterministically sorted/serialized. MEMORY note `project_kv_cache_discipline.md` applies. |
| Three-category code system | actions_extractor (LLM-02 split-bracket fix) | Reusing the existing buffer-and-resume logic is the safe path. Re-implementing per-category invites regression of LLM-02's already-fixed BLOCKER. |
| Avatar import flow | electron-store userData path; settings UI surface (new but co-tenants with milestone-1's LLM-setup screen pattern); KV-cache discipline (overrides feed system prompt) | The LLM-setup-screen pattern (Phase-1 PLUMB-04) is the UI template; avatar review screen should mirror its "block until valid" affordance. |
| Slider HUD | Compositor output stream (60 Hz, milestone-1 pending); pyvts InjectParameterDataRequest path (milestone-1 pending) | Compositor must add a per-param lock filter in front of the existing driver-mux. The lock filter is the *only* new milestone-2 mutation of the milestone-1 60 Hz hot path. Risk: introducing latency if filter is naive — bake into Phase 9's perf test. |
| Cursor rewrite | pyvts client (milestone-1 pending); Reaction driver (milestone-1 pending) | Renderer-side cursor capture is being *deleted* — the reaction driver's input source moves from renderer-IPC to sidecar-OS-capture. Test: idle baseline doesn't lose tracking when HUD is open and cursor is out-of-window (the bug Phase-4 surfaced). |
| Default plugin port | All milestone-1 surfaces (it absorbs current Phase-4 behavior) | Phase 10 verification re-runs §14 SCs against refactored architecture; SC #2 (`[joy]` smooth-blend) is the integration tripwire. |

---

## MVP Recommendation for v2.0

**Prioritize (must ship for milestone-2 to be "done"):**

1. **Plugin runtime ABC + manifest + system-prompt assembly + default-plugin port** — Phase 6
2. **Three-category parser + reserved-name guard + cross-category uniqueness + dispatch paths** — Phase 7
3. **Avatar import flow with mandatory review screen + Cubism/VTS/OLVT format detection** — Phase 8
4. **Slider HUD with per-param locks + sidecar tap + 15 Hz IPC + lipsync override** — Phase 9
5. **Sidecar OS-level cursor capture replacing renderer-canvas tracker + §14 SC re-verification** — Phase 10

**Defer to milestone-3 (consciously, with rationale):**

- Plugin hot-reload / runtime swap
- Multiple-active plugin composition
- LLM-suggested semantic-naming during import review
- Smoke-pass orphan-param detection during import
- Parameter-group folding in slider HUD
- Diff view on re-import of edited rigs
- Snapshot/restore of slider values
- Plugin-config UI auto-generation

**Defer beyond v1 (PROJECT.md scope-out):**

- Plugin marketplace / sandboxing / signing
- Cloud-sync of overrides
- Avatar marketplace / share

---

## Open Questions This Research Couldn't Resolve

These need a Phase-specific micro-research sweep when their owning Phase plans:

1. **HUD-mode IPC throttle exact rate** — §14B.9. 15 Hz proposed; 30 Hz fallback option; needs perceptual benchmark on real fast-changing params. Phase 9 task.
2. **Plugin dependency story** — §14B.9. v2.0 default is "no isolation, plugins use host venv." Defer revisit unless friction surfaces.
3. **Multi-language LLM system prompts** — §14B.9. When user's chat language is non-English, are action-code descriptions translated or kept English-LLM-canonical? Phase 6 design owns this.
4. **`<:think:>` reserved-name list completeness** — current list is `<think>`, `<tool_call>`, `<function_call>`. Phase 7 should research current LLM-emit conventions across LiteLLM-supported providers (Claude, OpenAI, Gemini, LM Studio frontier models) before locking the guard.
5. **`RigCapabilities` contract** — referenced by both plugin runtime (Phase 6) and slider HUD (Phase 9). Needs single-source-of-truth definition in Phase 6, used by Phase 9. Source-of-truth is VTS introspection (MEMORY note); but the *shape* of the data structure (fields, units) needs design before Phase 6 lands.
6. **OLVT `model_dict.json` schema commit-pin** — Phase 8 task. Pin to a specific OLVT commit at design time and document.

---

## Sources

### HIGH confidence (authoritative)

- [Live2D Cubism file-format specs (`CubismSpecs` repo)](https://github.com/Live2D/CubismSpecs) — canonical for `model3.json`, `motion3.json`, `exp3.json`
- [model3.json spec (CubismSpecs)](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/model3.json.md)
- [motion3.json spec (CubismSpecs)](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/motion3.json.md)
- [exp3.json spec (CubismSpecs)](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/exp3.json.md)
- [Live2D Cubism SDK Manual — JSON file overview](https://docs.live2d.com/en/cubism-sdk-manual/json-unity/) — describes `cdi3.json`, `userdata3.json`, FileReferences
- [VTube Studio Model File Wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/VTube-Studio-Model-File) — `.vtube.json` is human-readable, auto-created on model load
- [VTS Loading Models Wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/Loading-your-own-Models)
- [VTS Expressions Wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/Expressions-(a.k.a.-Stickers-or-Emotes))
- [napari Manifest Reference](https://napari.org/stable/plugins/contributions.html) — YAML manifest, `python_name`, contribution-points pattern
- [VSCode Contribution Points](https://code.visualstudio.com/api/references/contribution-points) — manifest-as-contract surface
- [VSCode Activation Events](https://code.visualstudio.com/api/references/activation-events)
- [VSCode Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [Home Assistant Integration Manifest](https://developers.home-assistant.io/docs/creating_integration_manifest/) — `manifest.json` structure, `config_flow` enabling pattern
- [OBS Plugins Documentation](https://docs.obsproject.com/plugins) — module lifecycle hooks
- [OBS Module API Reference](https://docs.obsproject.com/reference-modules) — `obs_module_load`, `obs_module_post_load`, `obs_module_unload`, `obs_module_set_locale`
- [Sublime Text Plugin Docs](https://docs.sublimetext.io/guide/extensibility/plugins/) — Python-class auto-discovery via class-name suffix
- [stevedore Plugin Tutorial (OpenStack)](https://docs.openstack.org/stevedore/latest/user/tutorial/creating_plugins.html) — canonical Python ABC + entry-points + setuptools pattern
- [Tweakpane Bindings](https://tweakpane.github.io/docs/input-bindings/) — sliders, monitor (read-only) bindings, refresh interval
- [Tweakpane Monitor Bindings](https://tweakpane.github.io/docs/monitor-bindings/) — `{readonly: true}` pattern, default 200ms interval
- [Leva (pmndrs)](https://github.com/pmndrs/leva) — React-first GUI controls
- [Theatric (Theatre.js)](https://www.theatrejs.com/docs/latest/api/theatric) — React debug-pane with persistence
- [Godot Remote Scene Tree (Trautweiler 2024)](https://medium.com/@florian-trautweiler/remote-scene-tree-in-godot-4-af0bf4bc9d35) — live property edit on running game
- [OLVT Live2D Guide (docs.llmvtuber.com)](http://docs.llmvtuber.com/en/docs/user-guide/live2d/) — `emotionMap` system structure, expression keywords automatically loaded into system prompt
- [Steam Workshop Implementation Guide (Steamworks)](https://partner.steamgames.com/doc/features/workshop/implementation)
- [Discord Custom Emoji Format](https://maah.gitbooks.io/discord-bots/content/getting-started/custom-and-animated-emojis.html) — `<:name:id>` markup precedent

### MEDIUM confidence (multiple sources agree, ecosystem-level)

- [Python ABC + entry-points plugin pattern (Yu 2021)](https://chinghwayu.com/2021/11/how-to-create-a-python-plugin-system-with-stevedore/)
- [Python plugin systems guide (OneUptime 2026)](https://oneuptime.com/blog/post/2026-01-30-python-plugin-systems/view) — abstract methods for `name`, `version`, `initialize`, `execute`, `cleanup`
- [POML overview (Microsoft Tech Community)](https://techcommunity.microsoft.com/blog/educatordeveloperblog/unlock-the-full-potential-of-llms-with-poml-the-markup-language-for-prompts/4447849) — context for "LLM markup languages exist but are wrong layer for inline emit-vocabulary"
- [Steam Workshop content moderation policy update (Kotaku 2019, ongoing through 2025)](https://kotaku.com/steam-workshop-content-must-now-go-through-an-approval-1837149464) — context for "user-review is genre-standard for creator-facing imports"

### LOW confidence (single source / inferred / not directly verified)

- The exact regex patterns for cleaning `[N] 笑顔【明るい】`-style VTS hotkey names are not documented; they were inferred from §14B.6's description and the VTS naming-convention discussion. Phase 8 will validate against real `.vtube.json` samples.
- The complete reserved-name list (`<think>`, `<tool_call>`, `<function_call>`) is incomplete — current LLM emit conventions vary by provider and need Phase-7 verification. Some Anthropic models also emit `<thinking>`, `<invoke>`, `<parameter>`.
- `cdi3.json` "often missing on user-distributed rigs" is an ecosystem inference, not a measurement. Validate by inspecting 5+ community rigs at Phase-8 time.

---

**Confidence summary:** HIGH on file-format invariants and on the plugin-pattern ecosystem-consensus (manifest + ABC + entry-point is the pattern across napari/HA/OBS/VSCode/stevedore). MEDIUM on the user-review UX expectation (creator-tool consensus, not formal study). LOW on specific regex/heuristic details that need real-rig samples at Phase-8.
