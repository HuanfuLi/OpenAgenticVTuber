# Technology Stack — Milestone v2.0 (Plugin + Animation Control)

**Project:** AgenticLLMVTuber
**Researched:** 2026-05-08
**Scope:** Additions/changes only — milestone-1 stack (Electron 40, React 19.2, Vite 6, Python 3.12, FastAPI 0.136.1, Uvicorn 0.46.0, LiteLLM 1.83.14, piper-tts 1.4.2, pyvts 0.3.3 vendored, chromadb/sentence-transformers/rank_bm25 pinned, electron-vite 5, electron-builder 25, json-schema-to-typescript@15) is **locked**. Do not re-pin.
**Overall confidence:** HIGH for the additions; only one MEDIUM (PyYAML vs ruamel.yaml choice — judgment call, not a verification gap).

---

## TL;DR — What v2.0 Actually Adds

| Capability | What's needed | New deps |
|---|---|---|
| Plugin runtime (manifest + ABC + entrypoint loader) | YAML manifest parsing, importlib-based entrypoint resolution, async-generator ABC | **none new** — `pyyaml>=6.0` already in `sidecar/pyproject.toml`; `importlib.metadata` and `abc` are stdlib |
| Three-category code parser | Regex over the existing OLVT actions_extractor decorator surface | **none new** |
| Avatar import — Live2D file parsing | JSON parsing of `.model3.json` / `.motion3.json` / `.exp3.json` / `.vtube.json` | **none new** — Python stdlib `json` is sufficient; **no Cubism Python SDK exists or is needed** |
| Avatar import — schema validation of overrides | Validate user-edited `_avatar_overrides.yaml` against a schema | **`jsonschema` 4.26.0** (one new dep, ~250 KB) |
| Slider HUD — sidecar-side throttling + IPC | Compositor tap, 15 Hz throttle, separate WS channel | **none new** — reuses FastAPI WebSocket + existing contracts codegen |
| Cursor capture (sidecar, OS-level global) | Win32 `GetCursorPos` for primary; cross-platform fallback | **`pywin32` already pinned** (`311 ; sys_platform == 'win32'` in `sidecar/pyproject.toml` line 21); add **`pynput` 1.8.1** as the cross-platform fallback for non-Windows dev/test runs |
| Avatar review screen — UI editor for catalogs | React form UI; nothing new at the framework level | **none new** |
| Manifest hot-reload (deferred but cheap to wire) | Filesystem watch on `plugins/` and `app.getPath('userData')/plugins/` | **`watchdog` 6.0.0** — already in milestone-1 supporting-libs list (§5.11); not yet in `pyproject.toml`, add now |
| In-app `.mp4` demo clips (engineer-curated, e.g., HUD walkthrough recordings, plugin-swap demos) | Git LFS for binary tracking | **`.gitattributes` extension** — milestone-1 already uses Git LFS for `sidecar/models/piper/*.onnx`; just add a tracking pattern |

**Net new deps: 2** (`jsonschema`, `pynput`) **+ 1 promotion** (`watchdog` from "pinned-but-not-installed" to active).

---

## Detailed Picks

### 1. Plugin runtime — entrypoint loading

**Pick: stdlib `importlib.import_module` + manifest-declared `module:class` string. NO setuptools entry_points. NO pluggy.**

| Aspect | Pick | Verified version | Why |
|---|---|---|---|
| Module/class resolution | `importlib.import_module(module_path)` then `getattr(mod, class_name)` | stdlib (Python 3.12) | `plugin.yaml` declares `entrypoint: "package.module:ClassName"`. Two `str.split(":", 1)` lines + one `import_module` + one `getattr`. ~10 LOC. Zero dependency. |
| Manifest format | YAML | **PyYAML 6.0.3** (released 2025-09-25; already pinned `pyyaml>=6.0` in `sidecar/pyproject.toml`) | Already in the dep tree. No new install. Use `yaml.safe_load`. |
| ABC base class | `abc.ABC` with `@abstractmethod` on `on_load`, `on_token_stream`, `on_unload` | stdlib | `on_token_stream` is an async generator — `AsyncGenerator[ParamFrame, None]` from `typing` (stdlib). |
| Plugin discovery | Manual `os.listdir` over `plugins/` (in-tree) and `app.getPath('userData')/plugins/` (user) | stdlib | Discovery is "find directories containing `plugin.yaml`". 15 LOC. |

**Why NOT setuptools entry_points / `importlib.metadata`:**
- Entry points require plugins to be installed Python packages (`pip install`). Milestone-2 plugins ship as **directories** with a `plugin.yaml` next to a Python file — the user (or engineer-shipped default plugin) doesn't `pip install` to add a body-motion strategy. Entry points add a packaging ceremony that doesn't fit the "drop a folder in `userData/plugins/`" UX in §14B.4.
- Entry points are the right answer when you want third-party PyPI packages to register plugins to *your* host (pytest plugins, Sphinx extensions). Our case is the inverse: the host loads from a known directory.

**Why NOT pluggy 1.6.0:**
- Pluggy is a hookspec/hookimpl system optimized for **multiple registered plugins, each contributing to a hook list** (pytest's model: many plugins, each with hookimpls, results collected). §14B.4 specifies **single-active plugin, switched at startup**. Pluggy adds an abstraction layer (PluginManager + `@hookspec` markers + result-collection semantics) for a problem we don't have.
- Pluggy also doesn't help with manifest parsing or the system-prompt-assembly contribution surface — both of which are entirely our domain.
- Reconsider in milestone-3 only if multi-plugin composition becomes a feature.

**Async-generator ABC pattern (verified pattern, HIGH confidence):**
```python
from abc import ABC, abstractmethod
from typing import AsyncGenerator
from contracts import ParamFrame, RigCapabilities

class BodyMotionPlugin(ABC):
    api_version: str = "1.0"

    @abstractmethod
    async def on_load(self, capabilities: RigCapabilities) -> None: ...

    @abstractmethod
    async def on_token_stream(
        self, tokens: AsyncGenerator[str, None]
    ) -> AsyncGenerator[ParamFrame, None]:
        # Pyright/mypy require a `yield` somewhere in the body (or `if False: yield`)
        # to type-evaluate this as an async generator rather than a coroutine.
        # See: github.com/microsoft/pyright/issues/10524
        if False:
            yield  # pragma: no cover

    @abstractmethod
    async def on_unload(self) -> None: ...
```

The "tagged abstract async generator with no-op yield" pattern is the documented workaround for pyright/mypy treating a yieldless `async def` as a coroutine, not a generator. Cite this in a code comment at the ABC.

**Sources:**
- [PyPA entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/) — confirms entry points are for installed-package metadata, not directory-discovery
- [Python `importlib.metadata` docs](https://docs.python.org/3/library/importlib.metadata.html) — modern recommended runtime API for discovering entry points (used by libraries like stevedore); we still don't need it for our directory-based discovery
- [pluggy on PyPI](https://pypi.org/project/pluggy/) — 1.6.0 (released 2025-05-15); confirmed registration-based, hookspec/hookimpl model
- [pyright issue #10524](https://github.com/microsoft/pyright/issues/10524) — abstract `AsyncGenerator` return-type misinterpretation; `yield` in body is the workaround

---

### 2. YAML manifest parsing

**Pick: PyYAML 6.0.3 (already pinned `pyyaml>=6.0`). Do NOT add ruamel.yaml.**

| Aspect | PyYAML 6.0.3 | ruamel.yaml 0.19.1 | Verdict |
|---|---|---|---|
| Already in `sidecar/pyproject.toml` | Yes (line 19) | No | PyYAML wins on zero new deps |
| Round-trip preserve comments + formatting | No | Yes | We don't need this for `plugin.yaml` (read-only manifest); for `_avatar_overrides.yaml` (user-edited via review screen) the round-trip matters but we **read full + rewrite full** since the review screen is the editor |
| Schema validation pairing | Pair with `jsonschema` (load → dict → validate) | Pair with `jsonschema` (same) | Tie |
| Maintenance | Active (6.0.3 on 2025-09-25) | Active (0.19.1 on 2026-01-02) | Tie |

**Verdict:** PyYAML stays. ruamel.yaml's only differentiator (round-trip preservation) doesn't apply when our edit path goes through a UI that fully serializes the document. Adding ruamel.yaml would cost a dep tree entry for no behavioral gain.

**Sources:**
- [PyYAML on PyPI](https://pypi.org/project/PyYAML/) — 6.0.3 (2025-09-25); Python 3.12 wheels confirmed
- [ruamel.yaml on PyPI](https://pypi.org/project/ruamel.yaml/) — 0.19.1 (2026-01-02); roundtrip is the documented core feature

---

### 3. Manifest schema validation

**Pick: `jsonschema` 4.26.0 — NEW dependency.**

| Aspect | Pick | Why |
|---|---|---|
| Package | **jsonschema 4.26.0** (released 2026-01-07) | The de-facto Python implementation of Draft 7/2019-09/2020-12. ~250 KB install. |
| Schema source | `packages/contracts/generated/json-schema/plugin-manifest.schema.json` | Reuse the existing codegen pipeline (Pydantic source-of-truth → JSON Schema → TS) — define `PluginManifest` as a Pydantic model in `packages/contracts/py/contracts/plugin_manifest.py`, codegen produces both the JSON Schema (for runtime validation) and the TS type (for renderer if it ever displays manifests). Same pattern as the existing 6 contracts. |
| When it runs | At plugin load (sidecar startup); also at avatar import for `_avatar_overrides.yaml` | Loud failure with a useful pointer beats silent KeyError on `manifest["entrypoint"]`. |

**Why this lands cleanly:**
- The codegen.sh pipeline already emits `packages/contracts/generated/json-schema/*.schema.json` — adding two more schemas (`plugin-manifest.schema.json` + `avatar-overrides.schema.json`) is one line per file in `codegen.py`.
- TS side gets typed manifests for free. Useful if a future "plugin info" UI surfaces.
- `jsonschema`'s validator API returns structured errors (path + message) that map cleanly to the avatar-import review screen's "this entry is malformed" UX.

**Why not Pydantic-validate-at-runtime instead:**
- Could do `PluginManifest.model_validate(yaml.safe_load(text))` and skip `jsonschema`. Two reasons not to:
  1. The renderer cannot import Pydantic — it's Python. To validate a manifest *in the renderer* (e.g., during a future "drop plugin folder onto the app" UX), the JSON Schema is the cross-language source of truth.
  2. The existing codegen pipeline emits JSON Schema as the intermediate; `jsonschema` validation is the runtime mirror of what codegen.py produces. Symmetric.
- Pydantic validation **also** runs (because the manifest becomes a `PluginManifest` instance for type-safe access in sidecar code). `jsonschema` validates first for richer error messages; Pydantic re-validates implicitly on construction.

**Sources:**
- [jsonschema on PyPI](https://pypi.org/project/jsonschema/) — 4.26.0 (2026-01-07); HIGH confidence

---

### 4. Cursor capture — sidecar OS-level global

**Pick: `pywin32` 311 (already pinned, Win32 `GetCursorPos` direct) + `pynput` 1.8.1 (NEW, cross-platform fallback for dev/test on macOS/Linux).**

| Layer | Win32 path | Cross-platform path |
|---|---|---|
| Cursor position read | `win32api.GetCursorPos()` returns `(x, y)` in screen coords; ~zero overhead | `pynput.mouse.Controller().position` returns `(x, y)` |
| Polling rate | Sidecar polls at 60 Hz on a dedicated asyncio task | Same |
| Multi-monitor | `GetCursorPos` returns virtual-screen coords (handles multi-monitor natively on Win10+) | `pynput` matches OS native behavior |
| Already installed | Yes (`pywin32==311 ; sys_platform == 'win32'` line 21 of `sidecar/pyproject.toml`) | No — add `pynput==1.8.1` |

**Why `pywin32` direct over `mss` for cursor:**
- `mss` 10.2.0 (released 2026-04-23) is screen-capture only — the PyPI page does **not** advertise cursor-position read. Verified via PyPI WebFetch. mss stays useful for screenshot-based agent runtime work (deferred milestone), not cursor capture.
- `pywin32`'s `win32api.GetCursorPos()` is a single Win32 syscall (`GetCursorPos` from User32.dll). Cheaper than spinning up `pynput`'s thread-pool listener for a poll-only use case.
- Could also use `ctypes.windll.user32.GetCursorPos` directly with no pywin32 dep — but pywin32 is already pinned, the import is one line, and pywin32's wrapper handles the `POINT` struct. Save the ctypes complexity for a future "drop pywin32" milestone (which won't happen).

**Why `pynput` and not `pyautogui` for the cross-platform fallback:**
- `pyautogui` is in the milestone-1 stack research as the agent-runtime mouse driver — but its cursor-position read goes through the same SendInput-era code path as its keystroke injection, which is what the milestone-1 STACK.md flags as aging. Read-only cursor position via `pynput.mouse.Controller().position` is the cleaner 2026 pick.
- `pynput` is also classified by the milestone-1 STACK as the modern cross-platform input library; using it for cursor-read keeps the agent milestone's "swap pyautogui to pynput" decision easy.

**Architecture detail:**
- Sidecar runs cursor poll → publishes `CursorPosition` events on the main WS protocol (or a dedicated channel; design decision belongs to PLAN-phase, but `param-frame.ts`-style `discrete-event.ts` could handle it).
- Compositor consumes `CursorPosition` → produces the `Reaction (cursor)` driver outputs (head/eye angle proportional to cursor delta from canvas center). This replaces the milestone-1 renderer-side canvas-relative tracker entirely (deletion, not refactor).

**Sources:**
- [pywin32 on PyPI](https://pypi.org/project/pywin32/) — 311 (2025-07-14); Python 3.12 wheel HIGH confidence
- [pynput on PyPI](https://pypi.org/project/pynput/) — 1.8.1 (2025-03-17); Windows + macOS cursor-position support confirmed
- [mss on PyPI](https://pypi.org/project/mss/) — 10.2.0 (2026-04-23); does NOT advertise cursor read (verified via WebFetch — only screenshot capture)

---

### 5. Live2D / Cubism file format parsing

**Pick: stdlib `json` only. NO Live2D Python SDK exists; none is needed.**

The avatar-import flow per §14B.6 reads four file types. All four are JSON or YAML. Stdlib + PyYAML cover everything.

#### `.model3.json` (Cubism, all variants)

Schema (verified against [Live2D/CubismSpecs/FileFormats/model3.json.md](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/model3.json.md)):

```json
{
  "Version": 3,
  "FileReferences": {
    "Moc": "...moc3",
    "Textures": ["...png"],
    "Physics": "...physics3.json",
    "Pose": "...pose3.json",
    "DisplayInfo": "...cdi3.json",
    "Expressions": [
      {"Name": "string", "File": "...exp3.json"}
    ],
    "Motions": {
      "GroupName": [
        {
          "File": "...motion3.json",
          "FadeInTime": 0.5,    // optional
          "FadeOutTime": 0.5,   // optional
          "Sound": "...wav",    // optional
          "MotionSync": "..."   // optional
        }
      ]
    },
    "UserData": "...userdata3.json"
  },
  "Groups": [...],
  "HitAreas": [...]
}
```

**v2.0 mapping:**
- `FileReferences.Expressions` → variants catalog (Cubism w/ expressions branch). Each `{Name, File}` becomes a `{variant}` entry; user names default to `Name` (often generic like `exp_01`, hence the mandatory review screen).
- `FileReferences.Motions` → events catalog. Group names + motion filenames produce `<event>` codes; e.g., `Idle` group with files `idle_01.motion3.json`, `idle_02.motion3.json` → events `<idle-1>` and `<idle-2>` (slug rule TBD in PLAN phase).

#### `.motion3.json` (motion duration for event auto-completion timeout — §14B.9)

Schema (verified against [Live2D/CubismSpecs/FileFormats/motion3.json.md](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/motion3.json.md)):

```json
{
  "Version": 3,
  "Meta": {
    "Duration": 1.0,       // seconds — verified
    "Fps": 30,
    "Loop": true,
    "AreBeziersRestricted": false,
    "CurveCount": 12,
    "TotalSegmentCount": 144,
    "TotalPointCount": 432,
    "UserDataCount": 0,        // optional
    "TotalUserDataSize": 0     // optional
  },
  "Curves": [...],
  "UserData": [...]
}
```

**v2.0 use:** Read `Meta.Duration` (seconds) at avatar-import time, store in catalog, dispatcher uses it as the event auto-completion timeout. Resolves §14B.9 open question "motion3.json-based event auto-completion timeout — motion files have a duration; system uses that vs hardcoded ceiling." **Use Duration directly; no hardcoded ceiling needed.**

#### `.exp3.json` (expression file, named-Cubism variant flow)

Cubism schema; not deeply parsed in v2.0 — the import flow only needs the *list* of expressions (which comes from `model3.json` `FileReferences.Expressions`). Expression *content* (which params each `.exp3.json` modifies) is exposed at runtime through VTS's `ExpressionStateRequest` (with `details: true`), not by parsing the file. We avoid an extra parse path.

#### `.vtube.json` (VTube Studio model file)

VTS-specific format (no formal Live2D spec; documented at github.com/DenchiSoft/VTubeStudio). Contains hotkey definitions:

```json
{
  "Hotkeys": [
    {
      "Name": "joy_blush",
      "Action": "ToggleExpression" | "TriggerAnimation" | "PlaySound" | ...,
      "File": "...exp3.json or .motion3.json",
      "KeyCombination": ["F1"],
      "OnScreenButtonID": -1
    }
  ]
}
```

**v2.0 mapping (per §14B.6):** Filter `Hotkeys` where `Action == "ToggleExpression"` → variants list. Strip `[N]` keybind suffix from `Name`, strip `【】` decorative brackets, lowercase, hyphenate.

#### Why no Live2D Python SDK?

- Live2D Inc. publishes Cubism SDKs for Native (C++), Web (JS/TS), and Unity. **No first-party Python SDK exists.** We don't need one — we're not rendering Cubism in Python; VTS does the rendering. We just parse the JSON sidecar files for catalog extraction.
- `live2d-py` (EasyLive2D) exists as a third-party Python binding to the Native SDK. It's a *renderer*, not a parser. Out of scope (see milestone-1 STACK.md "Alternatives Considered").

**Sources:**
- [Live2D CubismSpecs/FileFormats/model3.json.md](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/model3.json.md) — HIGH confidence; canonical spec
- [Live2D CubismSpecs/FileFormats/motion3.json.md](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/motion3.json.md) — HIGH confidence; Duration is in seconds (verified)
- [Live2D model3.json overview at docs.live2d.com](https://docs.live2d.com/en/cubism-sdk-manual/json-unity/) — secondary verification of FileReferences shape
- VTube Studio `.vtube.json` shape: Hotkey schema documented in the [VTubeStudio repo](https://github.com/DenchiSoft/VTubeStudio); milestone-1 already uses this for hotkey trigger calls

---

### 6. VTS API introspection endpoints

**No new dependency — `pyvts 0.3.3` (vendored) already supports all required endpoints. Verify each at PLAN phase by hand-running.**

§14B.6 needs auto-extraction not just from files but from a **live VTS session** (so a user-imported avatar reflects the rig as VTS actually sees it, after VTS applies its own hotkey/expression discovery). The relevant VTS API endpoints (verified via [DenchiSoft/VTubeStudio](https://github.com/DenchiSoft/VTubeStudio)):

| VTS API endpoint | Returns | v2.0 use |
|---|---|---|
| **HotkeysInCurrentModelRequest** | `availableHotkeys[]` with `name`, `type`, `description`, `file`, `hotkeyID`, `onScreenButtonID` | Variants extraction (filter by `type: "ToggleExpression"` or expression-related types) — covers VTS-shape avatars where hotkeys are pre-bound. Catches everything `.vtube.json` parsing would, with the bonus that VTS may have applied user customizations. |
| **ExpressionStateRequest** (with `details: true`) | `expressions[]` with `name`, `file`, `active`, `deactivateWhenKeyIsLetGo`, `autoDeactivateAfterSeconds`, `usedInHotkeys[]`, `parameters[]` | Variants enrichment — knowing which parameters each expression touches lets the lock filter respect "if the user locked `ParamFaceBlush`, don't apply expressions that write to it" if we choose to enforce that. **Optional in milestone-2** — locks operate per-param at write time so this enrichment isn't required for correctness, only for "explain why this expression is grayed out" UX. |
| **ItemListRequest** | `availableItemFiles[]`, `itemInstancesInScene[]` | Out of scope for v2.0 catalog extraction (items are scene props, not avatar variants/events). Skip. |
| **InputParameterListRequest** | `customParameters[]` + `defaultParameters[]` with `name`, `value`, `min`, `max`, `defaultValue` | **Critical for slider HUD** — this is the writable-param surface the HUD displays. Sidecar fetches once at avatar load, caches as `RigCapabilities`. |
| **Live2DParameterListRequest** | `parameters[]` (raw rig params, including ones not exposed as input parameters) | Slider HUD's "advanced" view if engineer/user wants to see raw rig surface. Probably not needed for milestone-2 default UX. |
| **ParameterValueRequest** | `name`, `value`, `min`, `max`, `defaultValue`, `addedBy` | Single-param polling. Not used in milestone-2 — compositor *writes* params, the sidecar tap reads what was sent before pyvts forwards. No need to poll VTS for current values. |

**Verification check at PLAN phase (single milestone-2 dependency):**
- Run a smoke script against the actual VTS instance (Teto rig) calling each of `HotkeysInCurrentModelRequest`, `ExpressionStateRequest(details=True)`, `InputParameterListRequest` and dump the JSON. Confirm field shapes match what pyvts 0.3.3 returns and what the docs claim. This is one ~30-LOC script; goes in `sidecar/scripts/vts_introspect_smoke.py`.
- Why bother: pyvts is aged (no commits since 2024-09); confirm the message-builder helpers map to current API field names before writing the import flow against assumptions.

**Sources:**
- [VTubeStudio API GitHub repo](https://github.com/DenchiSoft/VTubeStudio) — endpoints verified via WebFetch on 2026-05-08; HIGH confidence

---

### 7. Filesystem watch (manifest hot-reload, deferred but cheap)

**Pick: `watchdog` 6.0.0 — NEW install (already pinned in milestone-1 design but not in current `pyproject.toml`).**

| Aspect | Pick | Verified | Why |
|---|---|---|---|
| Library | **watchdog 6.0.0** (released 2024-11-01) | PyPI HIGH | The milestone-1 STACK.md already lists `watchdog 5.x`; v6.0.0 is the current line as of May 2026. Bump and install. |
| Use | Watch `plugins/` and `userData/plugins/` for `plugin.yaml` changes | — | Useful for plugin author DX — they edit `plugin.yaml` and the sidecar reloads without an app restart. |
| Wire-up cost | One Observer + one PatternMatchingEventHandler | — | ~30 LOC. |

**Note on scope:** §14B.4 says "no runtime hot-swap in milestone-2 (deferred to milestone-3 if demand surfaces)." Hot-reload of the *manifest* (action codes appended to system prompt) is technically distinct from hot-swap of the *plugin instance* (replacing the running async generator) — the manifest reload is a strictly easier subset. Milestone-2 might want manifest hot-reload for engineer DX without the harder live-swap problem. PLAN phase decides.

**Sources:**
- [watchdog on PyPI](https://pypi.org/project/watchdog/) — 6.0.0 (2024-11-01); HIGH confidence

---

### 8. Git LFS for `.mp4` demo clips

**Pick: extend existing `.gitattributes` (Git LFS already in use for `*.onnx`).**

| Aspect | Pick | Verified |
|---|---|---|
| LFS already configured | Yes — `.gitattributes` line 1: `sidecar/models/piper/*.onnx filter=lfs diff=lfs merge=lfs -text` | Read directly from repo |
| Add for v2.0 | Append a pattern for engineer-curated demo clips, e.g.: `docs/demos/*.mp4 filter=lfs diff=lfs merge=lfs -text` | — |
| Storage budget | GitHub free tier: 10 GB storage + 10 GB/month bandwidth (Pro: same; Team/Enterprise: 250 GB) | Verified WebSearch |
| Real risk | A few `.mp4` clips at ~5 MB each are fine. Watch out: every CI checkout pulls LFS objects; if CI runs frequently the bandwidth quota burns fast. | — |

**Recommendation:**
- Add `*.mp4` under a constrained directory like `docs/demos/` rather than globally — avoids accidentally LFS-tracking node_modules-mp4-detritus or test fixtures.
- If milestone-2 plans many clips (e.g., per-feature demos), set CI to **skip LFS pulls** unless explicitly needed (`GIT_LFS_SKIP_SMUDGE=1` env var) and have a separate LFS-aware job for demos-build only.
- Long-term escape hatch (post-MVP): replace GitHub LFS with Cloudflare R2 proxy or a vendored binary asset CDN if free-tier limits become a recurring blocker. This is a **future** decision, not a v2.0 one.

**Sources:**
- [`.gitattributes`](C:\Users\16079\Code\AgenticLLMVTuber\.gitattributes) — verified line 1 in current repo
- [GitHub LFS billing docs](https://docs.github.com/billing/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage) — 10 GB free tier confirmed

---

## Integration Points with Existing Stack

### Codegen pipeline (`packages/contracts/codegen.sh`)

Two new contracts add to the pipeline. No tooling change.

| New contract | Pydantic source | JSON Schema output | TS output |
|---|---|---|---|
| `PluginManifest` | `packages/contracts/py/contracts/plugin_manifest.py` | `packages/contracts/generated/json-schema/plugin-manifest.schema.json` | `packages/contracts/ts/plugin-manifest.ts` |
| `RigCapabilities` | `packages/contracts/py/contracts/rig_capabilities.py` | `packages/contracts/generated/json-schema/rig-capabilities.schema.json` | `packages/contracts/ts/rig-capabilities.ts` |
| `AvatarOverrides` (extends Phase-1's `teto_overrides.yaml` schema with variants/events catalogs) | `packages/contracts/py/contracts/avatar_overrides.py` | `packages/contracts/generated/json-schema/avatar-overrides.schema.json` | `packages/contracts/ts/avatar-overrides.ts` |
| `CursorPosition` event (if not folded into `DiscreteEvent`) | `packages/contracts/py/contracts/cursor_position.py` | `packages/contracts/generated/json-schema/cursor-position.schema.json` | `packages/contracts/ts/cursor-position.ts` |

The renderer's HUD imports `PluginManifest` and `RigCapabilities` types via the `@contracts/*` Vite alias (already configured per `apps/renderer/vite.config.ts`). Same pattern as ws-message, action-intent, param-frame.

### FastAPI WebSocket — HUD-mode IPC channel

§14B.5 specifies a separate channel "preserves AVT-01's renderer-never-sees-60-Hz-traffic rule." Two implementation paths, both within FastAPI's WebSocket surface:
1. **Separate WS endpoint** at `/ws/hud` (vs main `/ws`). Renderer opens this only when HUD is open. Cleanest separation.
2. **Topic discriminator** on the existing `/ws` channel — server filters HUD-frame messages to only the connection that sent a `hud:subscribe` message.

Path 1 has fewer subtle bugs (no risk of a forgotten `if hud_subscribed:` check leaking 15 Hz traffic to the chat channel). Recommendation for PLAN phase: **separate endpoint**.

### pyvts vendoring (already done in milestone-1)

`sidecar/vendor/pyvts` is the source-of-truth path. v2.0 introspection scripts hit this vendored copy; if a smoke check reveals an API drift, patch in-tree at `vendor/pyvts/` rather than waiting for upstream (which has been silent since 2024-09).

### electron-vite / electron-builder

No build-chain changes for v2.0. The HUD-mode IPC adds a new WebSocket subscription in the renderer; no preload-bridge changes. New Pydantic contracts re-run codegen; same `package.json` `codegen:contracts` script.

---

## What NOT to Add (out of v2.0 scope, flagged so PLAN doesn't accidentally pull these in)

| Avoid | Why | If it comes up |
|---|---|---|
| **Plugin marketplace** (any UI for browsing/installing third-party plugins) | Explicitly out of scope per `PROJECT.md` "Plugin/extension marketplace" line and v1-entirely OOS list | Defer indefinitely. Plugins ship via filesystem drop, not via app UI. |
| **Plugin sandboxing** (RestrictedPython, subprocess isolation, container-per-plugin, capability limits) | §14B.4 lifecycle is "single-active, switched at startup (developer config)" — implies plugins run in-process with full host privilege. The whole milestone treats plugins as engineer-trusted code, not user-installed-from-internet code. Sandboxing is a milestone-N+ concern when third-party plugin distribution becomes real. | If a security-minded reviewer raises sandboxing: defer, document as "plugins are trusted code; if multi-source distribution arrives, sandboxing is its precondition." |
| **`pluggy` 1.6.0** | Wrong abstraction shape for single-active-plugin model (see §1 above). Adds a hookspec/hookimpl mental model the codebase doesn't otherwise use. | Reconsider only if multi-plugin composition becomes a feature in milestone-3. |
| **`setuptools` entry_points / `importlib.metadata` for plugin discovery** | Requires plugins to be `pip install`-ed packages. UX is "drop folder in `userData/plugins/`" not "pip install my-plugin." | Don't bother. Stdlib `importlib.import_module` + `os.listdir` is enough. |
| **`live2d-py` / `pixi-live2d-display` / native Cubism SDK as a renderer** | VTube Studio is the v1 rendering pipe (locked). v2.0 refactors animation control, not rendering. | Stays the milestone-1 rule. Pixi exploration is post-MVP, not v2.0. |
| **Live2D Cubism Python parser / SDK wrapper** | None exists; none needed. Stdlib `json` + `pyyaml` parse all four file types (`.model3.json`, `.motion3.json`, `.exp3.json`, `.vtube.json`). | Don't go looking for a parser library. The format is documented JSON. |
| **`pyautogui` for cursor read** | The aging-input-API path (milestone-1 STACK flagged this). `pywin32` direct (Win32) + `pynput` (cross-platform fallback) are the right 2026 picks for read-only position. | Save `pyautogui` for the deferred agent-runtime milestone where it might be the screen-control mouse driver — and even there, `pynput` first per the milestone-1 flag. |
| **`mss` for cursor read** | Screenshot-only. No cursor-position API on the PyPI page (verified). | Use `mss` if the agent-runtime milestone needs OS-level screenshot capture; not for cursor. |
| **`ruamel.yaml`** | Round-trip preservation isn't useful when our edit path is a UI that fully serializes the document. Adds a dep for no behavioral gain. | Stay on PyYAML 6.0.3. |
| **Agent runtime, scheduler, memory subsystem, voice input, multi-thread chat, multi-avatar switching** | All in the locked OOS-this-milestone list. v2.0 is animation-architecture only. | Defer to their respective milestones. |
| **PyInstaller packaging** | Milestone-1 deferred this; v2.0 still runs sidecar from venv per §14 unchanged. | Lands when the "shippable installer" milestone arrives, post v2.0. |
| **Vite 8 / Rolldown migration** | Milestone-1 STACK.md flags this as "wait until skeleton ships and Rolldown ecosystem has bake time." We're past skeleton-ship but the Rolldown ecosystem is still early — not a v2.0 priority. | Reconsider in a dedicated dev-tooling milestone, not as part of v2.0 animation work. |

---

## Net Sidecar Dependency Diff

```diff
 # sidecar/pyproject.toml [project.dependencies]
   "fastapi==0.136.1",
   "uvicorn==0.46.0",
   "websockets>=14,<15",
   "pydantic>=2.5",
   "httpx>=0.28",
   "psutil>=7.0",
   "litellm==1.83.14",
   "pyvts==0.3.3",
   "piper-tts==1.4.2",
   "langdetect>=1.0.9",
   "loguru>=0.7",
   "pysbd==0.3.4",
   "pyyaml>=6.0",
   "sounddevice==0.5.5",
   "pywin32==311 ; sys_platform == 'win32'",
   "opensimplex==0.4.5.1",
   "numpy>=1.26",
   "matplotlib>=3.8",
   "contracts",
+  "jsonschema==4.26.0",                                  # plugin manifest + avatar overrides validation
+  "pynput==1.8.1 ; sys_platform != 'win32'",             # cursor capture cross-platform fallback
+  "watchdog==6.0.0",                                     # plugin manifest hot-reload (engineer DX)
```

Three additions. Total install footprint ~3 MB. None has compiled C/Rust extensions that complicate `uv sync` on Python 3.12. Each verified against PyPI on 2026-05-08.

No renderer-side npm changes. (`json-schema-to-typescript@15.0.4` is already in `package.json` for codegen; new contracts ride that pipeline.)

---

## Version Compatibility — v2.0 Additions

| Package A | Compatible With | Notes |
|---|---|---|
| jsonschema 4.26.0 | Python 3.9+ | 3.12 wheel n/a (pure-Python); installs anywhere |
| pynput 1.8.1 | Python 3.9+; Windows + macOS + Linux/X11 | We use it only as a cross-platform fallback; production Windows runs use pywin32 directly |
| watchdog 6.0.0 | Python 3.9+ | 3.12 wheels published |
| pywin32 311 | Python 3.12 | Already pinned, no change |
| PyYAML 6.0.3 | Python 3.8+ | Already pinned `>=6.0`, no change |

All v2.0 additions stay within the existing `requires-python = ">=3.12,<3.13"` band declared in `sidecar/pyproject.toml`.

---

## Confidence Summary

| Area | Confidence | Reason |
|---|---|---|
| Plugin entrypoint pattern (stdlib importlib + manifest string) | HIGH | Standard Python practice; verified entry-points alternative is wrong shape |
| `jsonschema` 4.26.0 | HIGH | PyPI verified 2026-01-07 release |
| `pynput` 1.8.1 cross-platform | HIGH | PyPI verified; Windows + macOS confirmed |
| `pywin32` 311 GetCursorPos | HIGH | Already pinned + Win32 API stable since NT 4.0 |
| `mss` does NOT do cursor read | HIGH | PyPI page explicitly screenshot-only (verified WebFetch) |
| `.motion3.json` Meta.Duration in seconds | HIGH | Live2D CubismSpecs canonical doc verified |
| `.model3.json` FileReferences shape | HIGH | Live2D CubismSpecs canonical doc verified |
| VTS API endpoint shapes | HIGH | DenchiSoft/VTubeStudio repo verified |
| `pluggy` is wrong abstraction for our case | HIGH | Pluggy's hookspec/hookimpl model is for multi-plugin-composition; we're single-active |
| GitHub LFS free-tier limits | HIGH | Multiple sources (GitHub docs + community) agree on 10 GB / 10 GB |
| Choice of PyYAML over ruamel.yaml | MEDIUM | Judgment call; both libraries work — PyYAML wins on "no new dep" |
| `watchdog` 6.0.0 currency in May 2026 | HIGH | PyPI verified November 2024 release; no successor 7.x as of writing |

No LOW-confidence findings in this research.

---

## Sources

### Authoritative (HIGH confidence)
- [Live2D CubismSpecs/FileFormats/model3.json.md](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/model3.json.md) — model3.json FileReferences shape
- [Live2D CubismSpecs/FileFormats/motion3.json.md](https://github.com/Live2D/CubismSpecs/blob/master/FileFormats/motion3.json.md) — motion3.json Meta.Duration in seconds
- [Live2D SDK Manual: JSON file types](https://docs.live2d.com/en/cubism-sdk-manual/json-unity/) — secondary verification
- [DenchiSoft/VTubeStudio](https://github.com/DenchiSoft/VTubeStudio) — VTS API endpoint shapes
- [PyPI: jsonschema](https://pypi.org/project/jsonschema/) — 4.26.0 (2026-01-07)
- [PyPI: pynput](https://pypi.org/project/pynput/) — 1.8.1 (2025-03-17)
- [PyPI: pywin32](https://pypi.org/project/pywin32/) — 311 (2025-07-14)
- [PyPI: PyYAML](https://pypi.org/project/PyYAML/) — 6.0.3 (2025-09-25)
- [PyPI: ruamel.yaml](https://pypi.org/project/ruamel.yaml/) — 0.19.1 (2026-01-02)
- [PyPI: watchdog](https://pypi.org/project/watchdog/) — 6.0.0 (2024-11-01)
- [PyPI: mss](https://pypi.org/project/mss/) — 10.2.0 (2026-04-23); cursor-read not advertised
- [PyPI: pluggy](https://pypi.org/project/pluggy/) — 1.6.0 (2025-05-15)
- [PyPA Entry points specification](https://packaging.python.org/en/latest/specifications/entry-points/) — entry-points are for installed-package metadata
- [Python `importlib.metadata` docs](https://docs.python.org/3/library/importlib.metadata.html) — modern entry-point runtime API
- [GitHub LFS billing docs](https://docs.github.com/billing/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage) — 10 GB free tier
- [pyright issue #10524 — abstract AsyncGenerator typing](https://github.com/microsoft/pyright/issues/10524) — `if False: yield` workaround pattern

### Ecosystem / context (MEDIUM confidence)
- [Stanza: Protocols vs Abstract Base Classes](https://www.stanza.dev/courses/python-architecture/protocols/python-architecture-protocols-vs-abc) — ABC vs Protocol guidance
- [GitHub LFS rant — wlcx.cc](https://wlcx.cc/blog/github-lfs-rant/) — practical LFS-quota cautions
- [Replacing GitHub LFS with Cloudflare R2](https://dbushell.com/2024/07/15/replace-github-lfs-with-cloudflare-r2-proxy/) — long-term escape-hatch reference
