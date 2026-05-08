# Architecture Integration: v2.0 Plugin + Animation Control

**Confidence:** HIGH for integration points (verified against actual files); MEDIUM for HUD path choice and phase ordering.

## Executive Synthesis

The walking skeleton's compositor at `sidecar/src/sidecar/compositor/compositor.py` already has the seams v2.0 needs: `TickDriver` Protocol, lifespan injection point at `ws/server.py:152-241`, and explicit `add_acc` / `set_acc` merge that absorbs new contributors. **Most of v2.0 is additive.** Two pieces are genuinely greenfield: plugin runtime + manifest loader, and avatar import flow. HUD piggybacks on FastAPI with a second WS route plus a compositor tap.

The `[joy]`/`{variant}`/`<event>` parser is best done as a **decorator inserted in place of `actions_extractor`** rather than a separate `sidecar/parsers/` module — re-uses the proven bracket-walker pattern from `transformers._extract_intents` (lines 125-157), preserves orchestrator-chain source-of-truth, and lets `display_processor`'s `filter_brackets` strip all three syntaxes in one pass.

## (a) Plugin Runtime Placement

**Loader location:** `sidecar/src/sidecar/plugins/{api,loader,manifest}.py` (ABC + loader + pydantic manifest). Plugin instances live at repo-root `plugins/default/` and `userData/plugins/` per §14B.4.

**Rig discovery — push pattern:** plugin's `on_load(capabilities)` receives existing `AvatarCapabilities` + `TetoOverrides`. Plugins MUST NOT call pyvts directly — only `PyvtsSafeWriter` (sidecar/vts/pyvts_writer.py) talks to VTS, because pyvts 0.3.3 races on concurrent callers. Plugin doing its own pyvts query reintroduces AVT-04 deadlock.

**Plugin output → compositor — pull pattern via TickDriver Protocol:** `PluginAdapter(TickDriver)` wraps the plugin's async generator. `tick(now)` returns the buffer's last ParamFrame, decayed if stale (matches `IntentDriver`'s decay pattern). Zero compositor changes beyond adding the new driver to merge.

**System prompt assembly:** orchestrator.py:91-93 freezes `_system_prompt` at `__init__` (KV-cache discipline, load-bearing). Plugin manifest loaded at sidecar boot; system-prompt assembly happens once in `_build_system_prompt()`. Plugin's action_codes + descriptions append under fixed delimiter; variant + event catalogs append under their own delimiters; reserved-name guard runs at registration time, not assembly time. Existing `[<insert_action_keys>]` substitution mechanism stays — just gets richer template inputs.

**Files affected (Phase 6):**
| File | New / Modified | Note |
|---|---|---|
| `sidecar/src/sidecar/plugins/api.py` | NEW | `BodyMotionPlugin` ABC, ApiVersion enum |
| `sidecar/src/sidecar/plugins/loader.py` | NEW | manifest discovery + entrypoint import + reserved-name guard |
| `sidecar/src/sidecar/plugins/manifest.py` | NEW | `PluginManifest` pydantic |
| `plugins/default/plugin.yaml` | NEW (repo root) | OLVT 8-emotion vocabulary + descriptions |
| `plugins/default/__init__.py` | NEW | absorbs current `IntentDriver` + body-sway logic |
| `sidecar/src/sidecar/compositor/plugin_adapter.py` | NEW | `PluginAdapter(TickDriver)` |
| `sidecar/src/sidecar/orchestrator/orchestrator.py` | MODIFIED | `_build_system_prompt` signature + plugin-token feed |
| `sidecar/src/sidecar/orchestrator/prompts/live2d_expression_prompt.txt` | MODIFIED | three-category template additions |
| `sidecar/src/sidecar/ws/server.py` | MODIFIED | lifespan loads plugin, plumbs adapter; removes direct `IntentDriver` |
| `sidecar/src/sidecar/compositor/intent_driver.py` | DELETED | logic migrates to default plugin |
| `sidecar/src/sidecar/compositor/body_sway/*` | MOVED → `plugins/default/body_sway/` | rig-specific |

Critical preservation: `Compositor`, `IdleDriver`, `SpeechDriver` (lipsync only post-v2), `CursorDriver`, `PyvtsSafeWriter` all stay untouched at the protocol seam.

## (b) Three-Category Code Parser Layering

**Location:** **replace `actions_extractor` with `code_extractor`** — a single decorator yielding `(SentenceWithTags, list[ActionIntent], list[VariantToggle], list[EventFire])`. Three separate decorators would re-scan the sentence and complicate ordering when adjacent tags appear (`[joy]{hold-mic}<wave>`). Bracket walker scans once, dispatching on opener char.

**Decorator chain ordering (Phase 7):**
```
@tts_filter
@display_processor          # NOW strips [...], {...}, <...> in filter_brackets
@code_extractor(...)        # was actions_extractor — yields all three categories
@sentence_divider(...)
```

`display_processor` must run AFTER `code_extractor` so brackets aren't erased before extraction. `filter_brackets` (tts_preprocessor.py) extends to all three syntaxes — one regex change.

**`<event>` motion fires:** use existing `PyvtsSafeWriter.request()` with `requestTriggerHotKey` (matches `discrete_dispatcher.py:23` precedent). Phase 8 import flow registers each `.motion3.json` motion as a VTS hotkey of `Type=TriggerAnimation`; `EventFire` carries the registered `hotkey_id`. Motions without hotkey backing get flagged at import-review time.

**Reserved-name guard at TWO points:**
1. Plugin-load time (`plugins/loader.py`) — reject `action_codes` matching reserved names
2. Catalog-load time (`avatar/import.py`) — reject extracted variants/events matching reserved names

**Cross-category uniqueness check** at orchestrator construction: `plugin_action_codes ∩ variants ∩ events` must be empty. Loud failure at boot.

**Files affected (Phase 7):**
| File | New / Modified |
|---|---|
| `sidecar/src/sidecar/orchestrator/transformers.py` | MODIFIED — `actions_extractor` → `code_extractor` |
| `sidecar/src/sidecar/orchestrator/output_types.py` | MODIFIED — `SentenceOutput.variants` + `.events` |
| `sidecar/src/sidecar/orchestrator/tts_preprocessor.py` | MODIFIED — `filter_brackets` covers three syntaxes |
| `sidecar/src/sidecar/orchestrator/orchestrator.py` | MODIFIED — `_emit_sentence` dispatches variants + events |
| `sidecar/src/sidecar/avatar/catalog.py` | NEW — `VariantCatalog`, `EventCatalog` + reserved-name validators |
| `packages/contracts/py/contracts/{variant_toggle,event_fire}.py` | NEW |
| `packages/contracts/ts/{variant-toggle,event-fire}.ts` | NEW (codegen output) |

## (c) HUD-mode IPC Channel

**Recommended: separate WS endpoint `/hud/ws`** (not new message types on `/ws`). Reasons: (1) main `/ws` carries conversational traffic — adding 15 Hz × ~50 params forces filtering on every tick; (2) §14B.5 says "separate from main protocol; only active when HUD open" — separate path makes "only active when open" trivially correct (open on HUD mount, close on unmount); (3) FastAPI absorbs another `@app.websocket("/hud/ws")` for free.

**Throttling — sidecar-side gate inside compositor's emit step:**
```python
frame = ParamFrame(add_params=add_acc, set_params=set_acc, ...)
self._hud_tap.maybe_emit(frame, now)   # 15 Hz gate
await self._writer.inject_params(frame)
```
`HudTap` holds connected-clients set + last-emitted timestamp. Drop if `now - last_emitted < 1/15`.

**Rig capabilities for HUD UI:** new `GET /admin/rig-capabilities` fetch endpoint (not WS). Data is static for the avatar's session lifetime — fetch on HUD mount is fine. Existing CORS in `ws/server.py:304-309` covers it.

**Lock state — sidecar single-source-of-truth:**
- Sidecar holds `LockState = dict[str, float]` mapping `param_id → user_set_value`. Lives in `compositor.lock_state`.
- Compositor merge applies locks LAST, with system-primitive override for `MouthOpen`/`MouthOpenY` (lipsync wins per §14B.5).
- Renderer optimistic mirror: drag → fire `set-lock` over `/hud/ws` → 15 Hz HUD frame confirms.
- Session-only persistence: process memory in sidecar; cleared on restart.

**Files affected (Phase 9):**
| File | New / Modified |
|---|---|
| `sidecar/src/sidecar/compositor/hud_tap.py` | NEW — 15 Hz gate + fanout |
| `sidecar/src/sidecar/compositor/compositor.py` | MODIFIED — wire `hud_tap` + absorb `lock_state` into merge |
| `sidecar/src/sidecar/ws/server.py` | MODIFIED — `@app.websocket("/hud/ws")` |
| `sidecar/src/sidecar/admin/avatar.py` | NEW — rig-capabilities fetch |
| `apps/renderer/src/screens/HUD/{HUD,useHudStream}.tsx` | NEW |
| `apps/renderer/src/state/route-store.ts` | MODIFIED — add `'hud'` route |
| `apps/renderer/src/chrome/{AppShell,BottomRail}.tsx` | MODIFIED |
| `packages/contracts/py/contracts/hud_message.py` | NEW |
| `packages/contracts/ts/hud-message.ts` | NEW (codegen) |

## (d) Avatar Import Flow

**Dispatcher split:**
- File dialog: Electron-main (`dialog.showOpenDialog()`). Add `ipc:avatar:import-pick` handler in `apps/electron-main/src/ipc.ts`.
- Type detection + auto-extraction: sidecar (Python). Reasons: (1) Cubism file shapes parsed best by code that already reads YAML rig files; (2) `_avatar_overrides.yaml` schema is single-source-of-truth in sidecar; (3) naming normalization is single-source.
- Bridge: `POST /admin/avatar/import` returns `AvatarImportPlan` JSON; review screen edits in renderer state; `POST /admin/avatar/import/commit` writes yaml.

**Type detector — pure Python, no IO beyond existence checks:**
```python
def detect_type(folder: Path) -> AvatarType:
    if (folder / "model_dict.json").exists(): return AvatarType.OLVT
    if any(folder.glob("*.vtube.json")): return AvatarType.VTS_STANDARD
    model3 = next(folder.glob("*.model3.json"), None)
    if model3 and read_expressions(model3): return AvatarType.CUBISM_WITH_EXPRESSIONS
    return AvatarType.CUBISM_BARE
```

Per-shape extractors live alongside as `extract_{vts,cubism,olvt}.py`.

**Review screen — dedicated React route, NOT modal.** Multi-row editor; gate-quality importance per §14B.6 ("user *always* sees"). React form-state for edits; single POST on commit. Re-open from settings hits the same route, pre-populated from yaml.

**`TetoOverrides` rename → `AvatarOverrides`** (sidecar/avatar/overrides.py:46). Breaking change for compositor + handlers; track explicitly.

**Files affected (Phase 8):**
| File | New / Modified |
|---|---|
| `apps/electron-main/src/ipc.ts` + preload | MODIFIED |
| `sidecar/src/sidecar/avatar/{import_detect,extract_vts,extract_cubism,extract_olvt,import_plan}.py` | NEW |
| `sidecar/src/sidecar/avatar/overrides.py` | MODIFIED — rename `TetoOverrides`, add catalog fields |
| `sidecar/src/sidecar/admin/avatar.py` | NEW — three POST/GET endpoints |
| `apps/renderer/src/screens/AvatarImport/{AvatarImport,CatalogEditor}.tsx` | NEW |
| `apps/renderer/src/screens/Settings/Settings.tsx` | MODIFIED — re-edit button |
| `packages/contracts/py/contracts/avatar_import.py` | NEW |
| `packages/contracts/ts/avatar-import.ts` | NEW (codegen) |

## (e) Cursor Sensor Relocation

**Critical finding:** `sidecar/compositor/cursor_driver.py` + `sidecar/vts/window_detect.py` are **already sidecar-side and OS-level**. Phase 4 implemented this. Walking skeleton accidentally implemented v2.0's design.

**What Phase 10 actually needs:**
1. Drop the in-VTS-window gate at `cursor_driver.py:27-28` (currently returns `{}` outside canvas)
2. Keep `_cursor_to_param_angles` math
3. Multi-monitor handling already correct (`win32gui.GetCursorPos()` returns virtual-screen coords; deltas are correct relative to VTS rect via `GetWindowRect`)
4. Synthetic-canvas fallback when no VTS window detected (primary monitor centered)

**Renderer-side cursor tracker deletion:** verified — there is nothing to delete in `apps/renderer/src/`. Phase 4's port was complete. Phase 10 verification step grep confirms.

**Files affected (Phase 10):**
| File | Note |
|---|---|
| `sidecar/src/sidecar/compositor/cursor_driver.py` | drop in-canvas gate; add attenuation outside; synthetic fallback |
| `sidecar/src/sidecar/vts/window_detect.py` | minor — primary-monitor rect fallback |
| `sidecar/tests/compositor/test_cursor_driver.py` | new test cases for outside-canvas behavior |

This phase is the smallest. Most of the wall-clock is the §14 SC re-verification.

## (f) Build Order

**Hard dependencies:**
- Phase 6 (Plugin Runtime) → Phase 7 (action codes need a target)
- Phase 8 (Catalogs) → Phase 7 (variant/event parsers need catalogs to validate against)
- Phase 6 + 7 + 8 → Phase 9 (HUD lock-aware merge depends on plugin output)
- All → Phase 10 (verification re-run by definition last)

**§14B.7's table lists 6→7→8→9→10, but its own gating paragraph says "Phase 8 must produce variant/event catalogs before Phase 7's variant/event parsers have anything to validate against."**

**Recommended order: 6 → 8 → 7 → 9 → 10.** Honors the gating-language interpretation. Roadmapper should pick one explicitly with rationale.

**Intra-phase parallelism:**
- Phase 6: ABC + manifest + loader (Track A) ‖ default-plugin port (Track B), converging at PluginAdapter (Track C)
- Phase 8: four extractors are independent (VTS / Cubism-w-exp / Cubism-bare / OLVT)
- Phase 9: sidecar HUD tap ‖ React HUD UI against fixture
- Phase 7: least parallel (decorator chain is sequential by nature)
- Phase 10: ~30 LOC + verification ceremony

**Cross-phase parallelism:**
- Avatar import UI design can start during Phase 6 (fixture data)
- HUD UI design can start during Phase 7
- Phase 10 cursor changes can land during Phase 9 (no cursor_driver.py touch in Phase 9)

## Phase 8 is the largest

§14B.8 estimate of 5–8 weeks holds; lean toward 6–7 weeks. Phase 8 is 1.5–2 weeks (greenfield UI + 4 extractors). Phases 6, 7, 9 fit single developer-week each. Phase 10 is < 1 week.

## Open Questions for Roadmapper

1. **Phase ordering** — §14B.7 table (6→7→8→9→10) vs gating-derived (6→8→7→9→10). Recommend 6→8→7→9→10; confirm with user.
2. **Plugin location** — repo-root `plugins/` (per §14B.4) vs sidecar-internal `plugins/`. Recommend honoring §14B.4 verbatim.
3. **HUD WS path vs message type** — recommend separate `/hud/ws` path.
4. **`TetoOverrides` rename** — breaking change tracked explicitly in Phase 8's plan.

## File References

- `PROJECT_DESIGN.md` §14B (lines 1603-1731), §5.2/5.3 (lines 384-422)
- `.planning/PROJECT.md` (milestone v2.0 at lines 13-29)
- `sidecar/src/sidecar/compositor/compositor.py` (TickDriver Protocol + merge at 16-110)
- `sidecar/src/sidecar/compositor/intent_driver.py` (logic to migrate)
- `sidecar/src/sidecar/compositor/cursor_driver.py` (already sidecar-side)
- `sidecar/src/sidecar/vts/{window_detect,pyvts_writer,discrete_dispatcher}.py`
- `sidecar/src/sidecar/orchestrator/orchestrator.py` (system prompt freeze at 91-93; chain at 220-225)
- `sidecar/src/sidecar/orchestrator/transformers.py` (bracket walker at 125-157)
- `sidecar/src/sidecar/orchestrator/tts_preprocessor.py` (filter_brackets target)
- `sidecar/src/sidecar/avatar/{capabilities,overrides}.py`
- `sidecar/src/sidecar/ws/server.py` (lifespan at 152-241)
- `packages/contracts/py/contracts/param_frame.py`
- `packages/contracts/ts/ws-message.ts`
- `apps/electron-main/src/ipc.ts`, `apps/renderer/src/{App,state/route-store,chrome/AppShell}.tsx`
- `avatars/teto/{avatar,teto_overrides}.yaml`
