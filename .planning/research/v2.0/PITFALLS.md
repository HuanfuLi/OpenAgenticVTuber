# v2.0 Pitfalls — Plugin Runtime + Animation Architecture Refactor

**Domain:** Adding plugin runtime + three-category code system + avatar import flow + slider HUD + sidecar cursor capture to an *existing* milestone-1 architecture (Electron + Python sidecar, 60 Hz compositor in sidecar, pyvts → VTS, LiteLLM-driven OLVT decorator chain, Pydantic-source-of-truth contracts → TS via codegen, single Teto rig).

**Researched:** 2026-05-08
**Confidence:** HIGH on §14B-explicit risks (R-19, lock arbitration, IN-twin) and on findings cross-checked against milestone-1 PITFALLS.md, Python `importlib`/asyncgen issue tracker, Win32 DPI awareness docs, FastAPI WS backpressure literature; MEDIUM on inferred refactor traps where the only source is the design-doc + milestone-1 lessons; LOW where flagged inline.

**Scope discipline:** every pitfall maps to one of Phases 6–10 (`PROJECT_DESIGN.md` §14B.7) or to a cross-cutting integration point introduced by the refactor. Pitfalls already covered exhaustively in milestone-1 (`.planning/research/PITFALLS.md`) are *referenced* here with a "carries-over" tag and a delta — not re-derived. Genuinely new pitfalls are tagged "**NEW v2.0**".

**Carry-over notation:**
- **CARRY-OVER M1#N** — pitfall N from milestone-1 PITFALLS.md still applies; v2.0 changes the surface where it lands but the failure mode is the same.
- **NEW v2.0** — only surfaces because of the refactor; no milestone-1 analog.
- **MUTATED M1#N** — milestone-1 pitfall N changes shape; the milestone-1 mitigation no longer covers the new failure mode.

---

## Critical Pitfalls

These can sink a phase, force re-architecture, or silently degrade a milestone-1 success criterion in a way that won't surface until the §14 SC re-run in Phase 10.

---

### Pitfall 1 [Phase 6, NEW v2.0]: Untrusted plugin code crashes the sidecar; no isolation = no recovery

**What goes wrong:**
`plugin.yaml` + Python entrypoint loads a `BodyMotionPlugin` subclass directly into the sidecar process. R-19 already accepts the no-sandbox trust model. Concrete failure modes that *will* hit during dev (not hypothetical):

- Plugin's `__init__` raises (typo, missing dep) → sidecar startup aborts with cryptic traceback if loader doesn't catch
- Plugin's `on_load(capabilities)` does blocking I/O (e.g., loads a 200 MB ONNX model via `torch.load`) → compositor warmup blocks for 30s, watchdog crash-loops the sidecar (Pitfall M1#13 territory) before plugin even finishes loading
- Plugin's `on_token_stream` raises mid-utterance → async generator dies, compositor never receives the next frame, body motion freezes for the rest of the conversation until next user turn
- Plugin imports `import torch` at module-top → 5-10s import latency added to *every* sidecar boot, even if the user never enables the plugin
- Plugin calls `os.system("rm -rf ~/")` — yes, "no sandbox" means this works. Same trust model as skills (§13.122) but the team needs to internalize that "default plugin ships with the system, third-party plugins are install-at-your-own-risk."

**Why it happens:**
Python doesn't isolate inside CPython — Python Security docs explicitly say "don't try to sandbox inside Python; once arbitrary code runs you get full process access." The clean fix (subprocess + IPC) is explicitly out of scope per R-19. The not-clean fix (defensive loader) is the only remaining lever.

**Severity:** **Critical** for plugin-runtime correctness; **important** for security (matches existing skills trust model).

**Prevention:**
- **Plugin loader wraps every lifecycle hook in try/except** with a typed `PluginCrashed` exception. On crash:
  1. Log with plugin name + stage (`on_load` / `on_token_stream` / `on_unload`)
  2. Fall back to a built-in null plugin that emits the rest-state ParamFrame at 60 Hz (preserves Pitfall M1#9 — the 1-second re-injection rule still has to be honored even if the plugin is dead)
  3. Surface UI banner: "Plugin '{name}' crashed at {stage}. See logs."
- **`on_load` timeout: 5 seconds.** If the plugin doesn't return within 5s, kill the load attempt and fall back to null plugin. Document this ceiling in the `BodyMotionPlugin` ABC docstring.
- **`on_token_stream` runs in its own asyncio task** with a supervisor that restarts it on exception (max 3 restarts in 60s, then fall back to null plugin — same circuit-breaker pattern as M1#13 watchdog).
- **Plugin imports happen lazily inside `on_load`**, not at manifest-discovery time. Loader only reads `plugin.yaml` until the user actually selects the plugin.
- **README warning:** "Plugins run with full sidecar privileges. Only install plugins from sources you trust." Identical wording to skills system's trust disclaimer per §13.122.

**Early-warning sign:**
- Sidecar boot time grows from ~2s (milestone-1) to >5s after any plugin enable
- "Animation frozen" in chat after a single intent without other symptoms (compositor running, TTS playing, pyvts connected — only motion is dead) → asyncgen task crashed
- Test suite passes but real-app sessions show occasional motion stalls → unsupervised asyncgen pattern leaked through

**Phase to address:** **Phase 6** (Plugin Runtime + Default Plugin). The loader is the integration point; once shipped, retrofitting supervisors is invasive.

---

### Pitfall 2 [Phase 6, NEW v2.0]: Async generator leaks across plugin reload — even though §14B says "no hot-swap"

**What goes wrong:**
`BodyMotionPlugin.on_token_stream(tokens)` is an *async generator* yielding `ParamFrame`. Async generators have well-documented memory-leak edge cases (Python issue #41229, #15635, #17468). Even with §14B's "no runtime hot-swap in milestone-2" rule, the async-gen lifecycle bites in three places that will surface during dev:

1. **Conversation turn boundary.** When the LLM finishes a response, the orchestrator stops feeding tokens. The async generator is left suspended on `async for token in tokens:`. If the orchestrator doesn't explicitly call `aclose()`, the gen sits forever holding references to closure variables (potentially: the entire token-buffer history, the previous ParamFrame, the plugin's internal RMS state).
2. **Sidecar shutdown / Electron-close.** Pending async generators that never received a `GeneratorExit` keep `__del__`-style cleanup pending — and if the task loop is torn down before generators are closed, you get the "Task was destroyed but it is pending!" warning that drops finalization on the floor. Plugin `on_unload` may never fire.
3. **Developer-reflex hot-swap.** The "no hot-swap in milestone-2" rule is *exactly* the kind of constraint that gets quietly violated when a developer thinks "but I'll just add a SIGUSR1 handler that re-imports the plugin module..." — and the leftover gen from the old module instance keeps writing frames over the new plugin's output for the next turn. **Flag this as a likely scope creep at code review time.**

**Why it happens:**
Async generators don't implement `aclose()` automatically on garbage collection in all interpreter paths. PEP 533 (deterministic cleanup for iterators) is still draft. The orchestrator → plugin contract has to make cleanup explicit.

**Severity:** **Critical** for plugin-runtime correctness; latent memory leak that's hard to detect in short test sessions.

**Prevention:**
- **Per-turn lifecycle contract:** orchestrator wraps the plugin call in `async with` — a context manager that calls `gen.aclose()` on turn end (success, error, or cancel). Codify in `BodyMotionPlugin` ABC's docstring:
  ```python
  # Orchestrator owns the turn boundary. Plugin's on_token_stream
  # MUST tolerate being aclose()'d at any await point.
  ```
- **Loader-level kill-switch:** at `on_unload`, the loader cancels any outstanding async-gen tasks via `task.cancel()` then awaits with timeout. If the gen doesn't yield to cancellation in 1s, log a leak warning (don't hang shutdown).
- **No hot-swap policy in code review:** reject any PR that adds `importlib.reload(plugin_module)` or SIGUSR1 reload paths in milestone-2. §14B is explicit — "deferred to milestone-3 if demand surfaces." Add a CODEOWNERS rule or grep-test in CI: `assert no "importlib.reload" in src/plugin_runtime/`.
- **Test fixture: 100-turn conversation against a no-op plugin**, observe sidecar RSS over time; should be flat after the first 20 turns. Anything above +5 MB / 100 turns is a leaked-gen smell.

**Early-warning sign:**
- Sidecar memory grows monotonically across conversation turns (linear in turn count)
- "Task was destroyed but it is pending!" warnings in logs at sidecar shutdown
- A developer's PR description mentions "and now plugins reload without restart" — *reject and link to §14B*

**Phase to address:** **Phase 6** (Plugin Runtime + Default Plugin). The async-gen contract is an ABC-design decision; once subclasses ship, retrofitting `aclose()` semantics is a breaking change.

---

### Pitfall 3 [Phase 6, NEW v2.0]: Plugin output rate exceeds compositor ingest rate — silent backpressure / queue overflow

**What goes wrong:**
The compositor runs at 60 Hz (16.67ms/frame). The plugin yields `ParamFrame` at whatever rate its `on_token_stream` happens to produce — could be 30 Hz (slow plugin), 60 Hz (matched), 120 Hz (over-eager plugin emitting on every audio sample boundary), or *bursty* (plugin yields 5 frames at once when a token arrives, then nothing for 200ms). Three failure modes:

- **Over-rate:** plugin yields 120 frames/s, compositor `Queue` has bounded `maxsize`. Either `await queue.put()` blocks (plugin's gen stalls, never recovers steady rate), or `queue.put_nowait()` raises `QueueFull` (plugin's gen dies — see Pitfall 2 — and never restarts).
- **Under-rate:** plugin yields 30 frames/s, compositor expects 60. Naive compositor merge code interpolates *or* writes the same value twice, depending on implementation. Both are wrong: interpolation hides plugin bugs, repetition causes 1-second re-injection violations (Pitfall M1#9) when plugin briefly stops yielding.
- **Bursty:** plugin yields 5 frames in a single async-loop tick, then 200ms of silence. Compositor's "merge plugin output with idle baseline" step runs once per tick — only the *last* of the 5 frames lands; first 4 are dropped. Visually: motion freezes for 200ms then jumps.

**Why it happens:**
The plugin's emit rate is not part of the ABC contract — `on_token_stream` is "yield ParamFrame whenever you have one." Without a contractual rate, every plugin author picks differently. Combined with FastAPI/asyncio's no-built-in-backpressure default (per Hex Shift's WS-backpressure writeup), the compositor has to enforce the rate.

**Severity:** **Critical** for milestone-1 SC #4 (no flat moments) regression. Will degrade the §14 verification re-run in Phase 10 if not caught earlier.

**Prevention:**
- **ABC contract: `on_token_stream` yields at *most* 60 frames/s.** Document explicitly. Plugins yielding faster get rate-limited at the loader.
- **Loader inserts a coalescing rate-limiter** between plugin output and compositor ingest. Latest-frame-wins on over-rate (drop intermediates); hold-last-frame on under-rate (compositor sees a continuous stream); flush-on-tick-boundary for bursty (collapse multiple yields per tick into one).
- **Compositor merge runs at 60 Hz monotonic-clock cadence** (Pitfall M1 performance-trap "Action compositor sleep-driven instead of monotonic-clock-driven" — same fix). Plugin output is read at tick boundary, not at yield boundary.
- **Hold-last-frame rule:** if plugin hasn't yielded a new frame in 16ms, compositor reuses the previous frame. **Crucial for M1#9 (1-second re-injection rule)**: if plugin stalls for 200ms, compositor still writes the held frame at 60 Hz so VTS doesn't release ownership. This couples Pitfall 3's fix to M1#9's continuous-write requirement.
- **Test fixture: three rate-pathological plugins** (slow / fast / bursty) — compositor output should be 60 Hz steady regardless, with a rate-violation warning logged.

**Early-warning sign:**
- "QueueFull" exceptions in sidecar logs after demoing on a fast machine
- Body motion freezes for ~200ms intervals during streaming responses (bursty plugin smell)
- VTS releases param ownership during long pauses despite plugin "running" (under-rate smell — hold-last-frame missing)

**Phase to address:** **Phase 6** (Plugin Runtime + Default Plugin). The merge-tick contract is set in the compositor refactor; getting it wrong cascades.

---

### Pitfall 4 [Phase 6, NEW v2.0]: Plugin output bypasses safety clamping — invalid 0-1 values crash VTS

**What goes wrong:**
Per R-19: "ParamFrame values clamped to `[0, 1]` before pyvts send (compositor safety pass)." Easy to miss in the refactor because milestone-1's compositor *generated* its own ParamFrames internally (drivers were trusted). After milestone-2 the compositor *receives* ParamFrames from plugin code (untrusted). If the safety-clamp pass isn't a separate stage that runs unconditionally on every frame regardless of source, a buggy plugin can:

- Emit `ParamMouthOpenY: 1.5` → VTS UI rejects the value silently or clamps server-side; mouth visibly snaps to max-open and stays there
- Emit `ParamAngleX: float('nan')` → pyvts serializes `NaN` to JSON, VTS receives `null`, parameter ownership drops, M1#9 cascade
- Emit `ParamAngleX: -200` → some VTS rigs accept extreme values (they're floats, not bounded by VTS) and the rig deforms grotesquely
- Emit a key that isn't in `RigCapabilities` → pyvts accepts it, VTS logs "unknown parameter" but doesn't error; param appears to do nothing, dev wastes hours debugging "why doesn't this driver work" before realizing the plugin had a typo

**Why it happens:**
The safety-clamp was implicit in milestone-1 because all driver code was first-party. Refactoring to plugins makes "trusted producer" assumption invalid; if the clamp is implemented inside individual drivers (rather than at the compositor → renderer boundary), every plugin author has to remember to clamp.

**Severity:** **Critical** for VTS rendering correctness; **important** for plugin-author DX (the "unknown parameter" silent-no-op is a 4-hour debugging session).

**Prevention:**
- **Single safety-clamp pass at compositor → renderer boundary.** All ParamFrames pass through `clamp_and_validate(frame, capabilities) -> ParamFrame` regardless of producer (plugin / built-in driver / HUD lock override).
- **Validate against `RigCapabilities`:**
  - Unknown param keys → drop with WARN log (don't silently forward to pyvts)
  - Out-of-range values → clamp to [0, 1] with INFO log (info, not warn — plugins iterating to find the right range will hit this constantly)
  - NaN / Inf → drop the entire frame, log ERROR, increment a counter; if counter exceeds N/sec, kill plugin (Pitfall 1's circuit breaker)
- **Test fixture: malicious plugin** that emits NaN, unknown keys, and out-of-range values. Compositor output to pyvts must be clean every frame; sidecar must not crash.
- **In `BodyMotionPlugin` ABC docstring**, describe the clamping behavior so plugin authors know "out-of-range is silently clamped" — prevents DX confusion when their `gain * 1.5` works because the clamp catches it.

**Early-warning sign:**
- VTS rig deformation looks "grotesque" or "stuck open mouth" after switching plugins
- Sidecar logs flood with "unknown parameter" after plugin enable (typo in `plugin.yaml` action codes)
- Adding plugin → mouth lipsync stops working (plugin probably writing MouthOpenY incorrectly, bypassing clamp)

**Phase to address:** **Phase 6** (Plugin Runtime + Default Plugin) — the boundary stage is part of compositor refactor. Safety-clamp must be in place *before* Phase 7 wires the three-category dispatch (Phase 7 is just feeding the same boundary, but with more producers).

---

### Pitfall 5 [Phase 7, MUTATED M1#5]: Three-category parser breaks on token boundaries — milestone-1 fix doesn't cover `{xxx}` and `<xxx>`

**What goes wrong:**
Milestone-1 PITFALLS #5 covers the bracket-pair tokenization issue for `[xxx]` (action codes). Milestone-1 mitigation was "buffer-then-extract at sentence boundary, regex `\[[a-z\-]+\]`." That covers exactly *one* delimiter pair. Milestone-2 introduces two more: `{xxx}` (variant) and `<xxx>` (event), per §14B.3. The single-regex fix doesn't cover them; worse, **token boundary splits will land differently across `{}`, `<>`, `[]`** because BPE vocabularies tokenize them differently:

- `{hold-mic}` may arrive as `{hold`, `-`, `mic}` (3 deltas) — same boundary risk as `[joy]` / `[hold-mic]`
- `<wave>` may arrive as `<`, `wave`, `>` (3 deltas) or `<wave`, `>` (2 deltas) — and `<` alone collides with `<think>` reasoning tags (Pitfall 6 below)
- Mixed code like `[joy] {hold-mic} <wave>` in one response (per §14B.7 Phase 7 acceptance criterion) is *guaranteed* to span multiple stream deltas — pysbd may even hit a sentence boundary inside the gap, which means the post-sentence regex sweep needs to handle three patterns simultaneously

**Why it happens:**
Milestone-1's "extract at sentence boundary" works because all tags were `[]`-shaped and pysbd never split inside `[]`. Now the parser has to handle three different bracket pairs and one of them (`<>`) is *also* used by the LLM protocol (`<think>`, `<tool_call>`).

**Severity:** **Critical** for Phase 7's headline acceptance criterion ("LLM emits `[joy] {hold-mic} <wave>` and three distinct paths fire").

**Prevention:**
- **One unified parser pass at sentence-buffer level**, not three independent regexes:
  ```python
  # Order matters: <think> stripped first (LLM-protocol),
  # then [action], {variant}, <event> extracted in any order.
  CATEGORY_PATTERNS = {
      "action":  r'\[([a-z][a-z\-]*)\]',
      "variant": r'\{([a-z][a-z\-]*)\}',
      "event":   r'<([a-z][a-z\-]*)>',
  }
  ```
  Each pattern's character class excludes the delimiters of the other two — `[a-z\-]` matches all three categories' allowed names per §14B.3.
- **Reserved-name guard runs *after* extraction, *before* dispatch.** `<think>`, `<tool_call>`, `<function_call>` blocked at registration time per §14B.3. Parser strips reasoning tags via the milestone-1 `<think>...</think>` state machine *before* the category regex sees them — the state machine consumes the entire reasoning block, the surviving content has `<think>` removed, only user-emitted `<event>` codes survive.
- **Adversarial test fixture:** stream emits `[`, `joy`, `]`, ` `, `{hold`, `-`, `mic}`, ` `, `<`, `wave`, `>` as 11 separate deltas. Parser should produce exactly three categorized codes and zero leakage to TTS or chat. Mirror milestone-1's M1#5 fixture with three categories.
- **Cross-category collision check at startup** (§14B.3 "catalog uniqueness within a category enforced at avatar+plugin load"): the action catalog from plugin's `plugin.yaml` and the variant/event catalogs from `_avatar_overrides.yaml` are loaded and validated at startup. Different syntaxes mean *cross-category* uniqueness isn't required (Plan A locked 2026-05-08), but *within-category* uniqueness must error loudly. False positives to watch for: case-sensitivity (`[Joy]` vs `[joy]` — normalize to lowercase before compare), and Unicode normalization (NFC vs NFD for non-ASCII catalog names — see Pitfall 17).

**Early-warning sign:**
- TTS pronounces "open brace hold mic close brace" or fragments thereof
- Chat panel briefly shows `{hold` then it disappears (one-delta-late stripping)
- Phase 7 acceptance test passes for `[joy]` alone but fails for the combined `[joy] {hold-mic} <wave>` line

**Phase to address:** **Phase 7** (Three-Category Code Parsing). The sentence-buffer parser is the unit refactored.

---

### Pitfall 6 [Phase 7, MUTATED M1#6]: `<think>` reasoning tags collide with `<event>` syntax — milestone-1 fix actually helps but the precedence is fragile

**What goes wrong:**
Milestone-1 PITFALLS #6 ships a `<think>...</think>` stripper at the orchestrator's input boundary. That stripper turns out to be exactly what milestone-2 needs to dodge the `<think>` vs `<event>` collision. **But:** the precedence is now load-bearing in a way it wasn't before. If a developer "improves" the order during refactor — say, runs the three-category extractor first to "save a regex pass" — `<think>` becomes a registered-but-reserved event name, and DeepSeek-R1's reasoning text is silently treated as one giant `<think>` event firing for the entire reasoning duration, plus all the prose inside is leaked to chat (because the event-extractor only consumes the tag, not the content between tags).

Concretely:
- Stream: `<think>let me check the user's name... </think>Hello, Alice!`
- If `<think>` extractor runs first: catches `<think>` as event-code, dispatches "wave motion" or whatever someone has bound (or, more likely, "no such event" silent drop), and forwards `let me check the user's name... </think>Hello, Alice!` to TTS. **Catastrophic — internal reasoning read aloud, including "Alice" if the model leaks PII.**
- If `<think>...</think>` stripper runs first: catches the entire block, forwards to reasoning side-channel; the surviving stream is `Hello, Alice!`; event-extractor sees no `<event>` codes; correct.

**Why it happens:**
The reserved-name guard at registration time blocks `<think>` from being a *user-defined* event name, but the parser's per-stream behavior is what matters when an LLM emits `<think>` as protocol. Reserved-name guard blocks the *catalog*; the runtime stripper protects the *stream*.

**Severity:** **Critical** for any user who picks a reasoning model. Same severity as M1#6 but with a new attack surface (refactor-order dependency).

**Prevention:**
- **Codify the order in the orchestrator pipeline** with an explicit comment block:
  ```python
  # Order load-bearing — see PITFALLS-v2 #6:
  # 1. reasoning_stripper (M1#6)         -- consumes <think>...</think>
  # 2. sentence_buffer (pysbd)           -- batches by sentence boundary
  # 3. three_category_extractor (#5)     -- extracts [a]/{v}/<e>
  # 4. tts_filter / chat_panel_emit
  # Reordering steps 1 and 3 reintroduces the <think>-as-event bug.
  ```
- **Test fixture: DeepSeek-R1 emits `<think>I should wave</think><wave>Hi!`.** Expected: reasoning side-channel gets "I should wave"; event dispatcher fires `<wave>`; TTS speaks "Hi!". If the wave fires before the reasoning is stripped, or "I should wave" reaches TTS, fail.
- **Reserved-name guard at catalog load** (§14B.3) is necessary but not sufficient — keep both layers. Catalog guard prevents `_avatar_overrides.yaml` from defining `<think>` as an event; runtime stripper prevents the LLM from sneaking the same string through.
- **Same guard for `<tool_call>` / `<function_call>`** even though we don't use tool-calling in milestone-2. Future-proofs against Phase 11 (agent runtime, deferred). If a user pastes a reasoning model's tool-call output into the chat history (replay), the parser shouldn't dispatch.

**Early-warning sign:**
- Avatar reads "let me think about this..." aloud after switching to reasoning model
- Event dispatch logs show `<think>` event firing (with action: drop/no-op) every conversation turn
- Reasoning side-channel is empty even though the model is a reasoning model — stripper not running first

**Phase to address:** **Phase 7** (Three-Category Code Parsing). Document the precedence in code-comment + pipeline-test fixture.

---

### Pitfall 7 [Phase 7, NEW v2.0]: Variant-code persistence collision — old variant still active when new variant arrives

**What goes wrong:**
Variants are *toggle / persistent* per §14B.3 ("on until next change"). No design-doc-level policy for what happens when:

- LLM emits `{hold-mic}` → mic prop visible
- LLM emits `{bread-out}` 5 sentences later, before user dismisses mic → ?

Three plausible policies, each with different bugs:

1. **New replaces old (radio-button semantics):** `{bread-out}` displaces `{hold-mic}`. But VTS toggle-expression hotkeys are *individual* toggles — the system has to remember the previously-active variant and explicitly toggle it off before toggling the new one on, otherwise both stay on, which on most rigs looks broken (mic *and* bread, overlapping z-order).
2. **New layers on old (additive):** both visible. Often visually wrong (see above), but matches naive "LLM said {x}, system did {x}" semantics.
3. **Variants-are-scoped (one-active-per-namespace):** rig declares variant groups (`prop`, `mood`, `outfit`), one active per group. More correct semantically but requires §14B.6 import-flow to ask the user to assign each variant to a group, which is pure scope creep.

The design doc punts; PROJECT.md doesn't address it. Phase 7 plan-phase has to pick.

**Severity:** **Important** — visible bug if mishandled, but workaround is "LLM stops emitting variants" which most users won't do.

**Prevention:**
- **Phase 7 plan-phase decides explicitly** between policy 1, 2, 3 — *do not leave to runtime emergence*. Recommended default: **policy 1 (radio-button), with all variants in a single global "active variant" slot.** Simplest, easiest to explain ("only one variant active at a time"), and the rare cases where users want layering (mood + prop) can be handled in milestone-3 by adding optional variant groups.
- **Compositor maintains `active_variants: dict[str, str]`** keyed by group (default group `_global` if no grouping configured). On new `{x}` arriving, look up the variant's group, find the previous active variant in that group, dispatch the toggle-off VTS hotkey first, then the toggle-on for the new one. Sequence both into the writer's discrete-event queue (Pitfall M1#3 — pyvts single-writer).
- **Edge case: LLM re-emits the same variant.** Don't toggle off then back on — that's a visible flicker. Compare incoming variant to active; no-op if identical.
- **Edge case: rig has no toggle-off path.** Some VTS hotkeys are one-shot motions, not toggles. Variant catalog at import (Phase 8) should distinguish — if the hotkey's `Action` field is `"TriggerHotkey"` not `"ToggleExpression"`, the variant is *one-shot* and shouldn't be in the variant catalog at all (it's an `<event>`). Import-flow must enforce this categorization.
- **Test fixture: LLM emits `{hold-mic} ... {bread-out} ... {hold-mic} ... <none>`.** Verify mic toggles on, bread replaces mic (mic off + bread on), mic replaces bread, then `<none>` (or session end / user-clear) toggles bread off.

**Early-warning sign:**
- Multiple props visible on rig simultaneously after a long conversation
- Toggling variants in test causes VTS to "queue up" toggles that fire after the test ends (writer queue buildup)
- Re-emitting the same variant causes prop flicker

**Phase to address:** **Phase 7**. The active-variant state lives in the compositor; the policy decision is plan-phase work.

---

### Pitfall 8 [Phase 7, NEW v2.0]: Event motion-completion timing — `.motion3.json` Meta.Duration vs hardcoded ceiling vs VTS-reported

**What goes wrong:**
Events are *one-shot* per §14B.3. System needs to know when the motion finishes so it can report "event complete" to the orchestrator (for chained events) and so the next event in the queue can fire. §14B.9 explicitly defers this: "`motion3.json`-based event auto-completion timeout (motion files have a duration; system uses that vs hardcoded ceiling)."

Three sources of truth, each with failure modes:

1. **`Meta.Duration` from `.motion3.json`:** authoritative for the motion's keyframe length. But:
   - Doesn't account for VTS's blend-in / blend-out time (default 0.5s each side per VTS settings)
   - Loop motions (`Meta.Loop: true`) have infinite effective duration; using `Duration` for them stalls the event queue forever
   - Some `.motion3.json` files have `Duration: 0` (legacy / corrupt) → events never auto-complete
2. **Hardcoded ceiling (e.g., 5s):** safe fallback but cuts long motions short or extends short motions unnecessarily, causing perceptible "stuck mid-motion" or "delayed before next motion fires" gaps.
3. **VTS-reported completion:** VTS API has no `EventMotionFinishedEvent` — there's no callback. Polling `requestParameterValueListRequest` to detect "rig is back at rest" is a heuristic, not authoritative.

**Severity:** **Important** — wrong timeout means events feel sluggish or step on each other. Not a critical bug but visibly wrong.

**Prevention:**
- **Phase 8 import-flow extracts `Meta.Duration` and `Meta.Loop` per motion file** and stores them in `_avatar_overrides.yaml` event entries. Loop motions get a documented "loop until next event" semantic; non-loop get `Duration + 1s` (1s pad for blend-in/out).
- **Hardcoded ceiling 10s** as the safety net — if `Duration` is 0/missing/clearly wrong, fall back to 10s, log a WARN suggesting the user re-import or hand-edit the override.
- **Phase 7 dispatcher uses the per-event `expected_duration`** from override config; does *not* poll VTS for completion. If a long motion overruns its expected duration, the next event's hotkey trigger may interrupt it — this is acceptable per VTS's own behavior (hotkey trigger pre-empts current motion).
- **Test fixture:** import a rig with a loop motion (e.g., breathing) and a one-shot motion (e.g., wave). Dispatch a sequence of three events; verify queue drains correctly without stalling on the loop and without stepping on the wave's ~1.2s actual duration.

**Early-warning sign:**
- Events feel "delayed" after each other (timeout too long)
- Events visibly step on each other / cut off mid-motion (timeout too short)
- Loop motions cause the event queue to never advance

**Phase to address:** **Phase 7** + **Phase 8 (import-time extraction)**. Phase 8 captures the data; Phase 7 consumes it.

---

### Pitfall 9 [Phase 8, NEW v2.0]: Avatar import edge cases that silently produce a broken catalog

**What goes wrong:**
§14B.6 defines four file shapes: VTS-with-`.vtube.json`, Cubism with named expressions, Cubism bare, and OLVT `model_dict.json` import. Real-world rigs have a long tail of edge cases that none of the four shapes anticipate cleanly:

- **`.moc3` is binary** — no Python-readable metadata; importer has no way to extract anything useful from the .moc3 directly. (Cubism Editor source `.cmo3` is also binary, also unreadable.) If a user drops a folder containing only `.moc3` + textures (no `.model3.json`), the importer should fail loudly, not silently produce an empty catalog.
- **`.model3.json` `FileReferences.Expressions` field absent** — many rigs (Teto included, per Phase-4 evidence) have no expressions. Cubism Editor doesn't auto-populate this field. Importer must handle missing-key, not crash.
- **`.motion3.json` files in subdirectories** — convention is `motions/idle/idle_01.motion3.json` (group/file structure). Importer must walk subdirs and use the parent dir name as the group, per the design's "named after `Motions` group keys + filenames."
- **`<model>.vtube.json` hotkeys reference expression files that don't exist** — rig was renamed, hotkey points to old name. Importer must filter these out at extraction time, not save the catalog with broken references.
- **User pastes Cubism Editor project** (has `.cmo3` + textures, but no exported `.moc3` / `.model3.json`) — looks like a Cubism rig but there's nothing to import. Need explicit "this looks like a source project, not a runtime export" error.
- **OLVT `model_dict.json` integer-indexed expressions** — OLVT allows both `{"0": "joy"}` and `{"joy": "joy"}` styles. Our system uses string-named only; importer must reject integer-keyed entries with a clear error or coerce by index → expression-name mapping (requires reading `.model3.json` Expressions list to resolve indices).
- **Missing physics file** — design doc not affected directly, but if importer logs warnings about missing physics, it conflates "rig is incomplete" with "rig is fine, just no physics" (some rigs intentionally have no physics).

**Severity:** **Important** for Phase 8 acceptance ("new avatar imported via UI yields working variant + event catalogs after user review"). A silently-broken catalog at import means the LLM emits codes that resolve to nothing and the user blames the avatar.

**Prevention:**
- **Type-detection has a fifth shape: "unrecognized / incomplete"** — if no `.model3.json` exists, error out: "This folder doesn't look like a runtime Live2D export. If you have a `.cmo3` Cubism Editor project, export it first via File → Export to Cubism (.moc3)." Do not attempt extraction.
- **Per-shape extractor returns `(catalog, warnings)` tuple.** Warnings surface in the review screen as inline yellow bubbles next to affected entries: "this hotkey references `flick.exp3.json` which is missing — entry skipped." User can re-confirm before saving.
- **Subdirectory walk in motion extraction:** use `pathlib.Path(motion_dir).rglob("*.motion3.json")` (recursive) and use `path.parent.name` as the group; flatten if all motions are in the root directory.
- **Integer-keyed OLVT model_dict — explicit error.** "OLVT integer-indexed expressions require resolving indices against the rig's `.model3.json` Expressions list. Click 'Resolve' to attempt automatic mapping or 'Edit manually' to type names." Don't silently coerce — the user has signal here.
- **Test fixtures: 6 representative rigs** — VTS standard, Cubism w/ expressions, Cubism bare (Teto-shape), OLVT-imported (string-keyed), OLVT-imported (int-keyed), and an intentionally-broken rig (missing model3.json). Each should produce the expected catalog or expected error, never a silent empty.

**Early-warning sign:**
- Review screen shows entries with names like `exp_01`, `motion_05`, `unnamed_3` — auto-extraction worked but produced placeholders that need user relabeling. **(This is by design per §14B.6 — but if user clicks past too fast, it ships broken to runtime. See Pitfall 10.)**
- LLM emits a code that resolves to nothing and the avatar does nothing — catalog has the entry but the underlying rig file doesn't (broken reference, not filtered)
- Importer succeeds on Teto-shape rigs but fails on a complete-rig sample — extractor not handling absent-expressions case

**Phase to address:** **Phase 8** (Avatar Import + Catalog Auto-Extraction). The extractor + review-screen warnings are core deliverables.

---

### Pitfall 10 [Phase 8, NEW v2.0]: Review screen "click past" — user accepts auto-extracted placeholder names, ships broken vocabulary to LLM

**What goes wrong:**
§14B.6 mandates the review screen ("user always sees the auto-extracted catalogs and edits names"). But Cubism rigs with generic expression names (`exp_01`, `exp_02`) produce catalogs that are *technically valid* (no broken references) but *semantically useless to the LLM*:

- LLM system prompt now contains "available variants: `{exp_01}`, `{exp_02}`, `{exp_03}` — choose appropriate variant for context."
- LLM has no information about what `exp_01` does (smile? frown? blush?) so it picks at random or doesn't pick at all
- User sees avatar's variants firing inappropriately and concludes "the LLM is broken" — actually the catalog is broken because the user clicked "Save" before relabeling

The mandatory-review-screen rule prevents *silent* automation but doesn't prevent *negligent* review. Phase 8 has to design for "user reads three entries, clicks Save, ships broken catalog."

**Severity:** **Important** — quality issue, not a crash. But the failure mode is hard to diagnose because the system *did* what the user accepted.

**Prevention:**
- **Friction proportional to placeholder density.** If auto-extracted names contain >50% generic patterns (`exp_NN`, `motion_NN`, `unnamed_NN`), the Save button is disabled with copy: "Several entries have generic names. Rename them so the LLM knows what to use them for. (You can use 'Skip this entry' to exclude entries you don't want.)"
- **Suggested-renaming inline** if possible: hint text below `exp_01` slot reading "Common names for first expression: smile, blink, neutral. Type a name or click 'Skip'."
- **At runtime, log a startup warning** if any catalog entry name matches placeholder regex (`r'(exp|motion|expr|unnamed)_?\d+'`): "Avatar 'Teto' has 3 unrenamed catalog entries. LLM may not use them effectively." Surface in dev console; not user-facing toast (would be noise).
- **Review screen has a 'Help me name these' button** that opens documentation: "How to choose good names for variants/events." Not blocking, but signals what good looks like.
- **Test fixture:** import a rig with all `exp_NN` names; click Save without editing; assert Save is disabled with the friction message. Edit one name to `smile`; assert Save is still disabled (>50% threshold not met). Edit all but one; assert Save enabled.

**Early-warning sign:**
- Catalog files (`_avatar_overrides.yaml`) checked into the repo with `exp_01`-style names
- Users report "the LLM doesn't seem to know how to use my avatar's expressions"
- Phase 8 acceptance test passes (catalog produced) but Phase 7's dispatch test fails with "LLM emitted no variants" because the LLM didn't pick from the placeholder list

**Phase to address:** **Phase 8** (Avatar Import + Catalog Auto-Extraction). UX-design phase work.

---

### Pitfall 11 [Phase 9, NEW v2.0]: HUD IPC backpressure — 15 Hz × 50 params × WS overhead during heavy chat

**What goes wrong:**
§14B.5 spec: "compositor output stream tapped before pyvts send, throttled to 15 Hz, forwarded to renderer as a HUD-mode IPC channel." Math at peak: 15 fps × 50 params × ~30 bytes/param JSON = ~22.5 KB/s sustained while HUD is open. Looks small. But:

- Localhost WebSocket on Windows has surprising kernel-buffer behavior under concurrent traffic. Main protocol channel (chat tokens, audio bytes for lipsync if streamed, action codes) may already use 100+ KB/s during a streaming response. HUD adds another channel competing for the same socket if not multiplexed correctly.
- FastAPI / Starlette's `send_json` does a fresh `json.dumps` per call — at 15 Hz × 50 keys this is non-trivial CPU on the sidecar's main asyncio loop, which is *also* running the 60 Hz compositor and pyvts writer.
- React renderer side: receiving 15 fps of slider-position updates and re-rendering 50 sliders means 750 re-renders/sec if naive (`useState` per slider, no memoization). React DevTools shows that this freezes the UI on slower machines.
- Even when HUD isn't *visible* (window hidden / different tab), if the IPC channel stays open the sidecar keeps emitting. "HUD-mode IPC channel; only active when HUD open" is the design rule — must be enforced at channel-lifecycle, not at "user can't see it" level.

**Severity:** **Important** for Phase 9 acceptance. Not a crash, but HUD opening visibly degrades chat responsiveness if naive.

**Prevention:**
- **Channel lifecycle is open-on-HUD-open / close-on-HUD-close**, not always-on. Renderer sends `{type: "hud_open"}` on mount, `{type: "hud_close"}` on unmount. Sidecar starts/stops the 15 Hz tap accordingly. **Enforce via test:** open HUD, observe channel sends; close HUD, observe sends stop within 100ms.
- **Diff-encode at sidecar:** only send param values that changed since last send. Locked params don't change, so once a HUD has 30 locked params the bandwidth drops accordingly. JSON shape: `{params: {ParamAngleX: 0.234, ParamAngleY: -0.12}}` (only changed keys), with periodic full-resync every 5s.
- **React-side: `useSyncExternalStore` or zustand for slider state**, one slider per memoized component; avoid `useState` per row + parent re-render on update. Slider reads its own param key from a single-source store.
- **Throttle floor not ceiling:** the design spec says "throttled to 15 Hz" — interpret as *upper* bound. If compositor output is at rest (idle baseline only), tap can drop to 5 Hz without UX hit. Saves bandwidth + CPU.
- **Test fixture: open HUD during peak (LLM streaming response, TTS playing).** Measure: chat token latency (p50/p95) with HUD closed vs open. Must be within 50ms p95.

**Early-warning sign:**
- Sidecar CPU jumps from 5% to 15% on HUD open
- Chat replies feel "draggy" while HUD is open even though motion is fine
- React DevTools profiler shows 50ms+ render commits during HUD-open chat-streaming

**Phase to address:** **Phase 9** (Slider HUD + Per-Param Lock).

---

### Pitfall 12 [Phase 9, NEW v2.0]: Lock-state desync race — user drags, lock auto-engages renderer-side, sidecar hasn't received the lock

**What goes wrong:**
§14B.5: "Lock auto-engages on slider drag." Implementation reflex: renderer sets local lock=true on drag-start, sends WS message to sidecar. Sidecar receives ~50ms later (localhost RTT + queue jitter). During those 50ms, the compositor is still *unlocked* for that param — it accepts plugin/driver writes and sends them to VTS. When the user drags, they see *their* slider value fight the plugin/driver value for ~50ms (visible flicker, stutter, or just-feels-wrong drag response).

Worse: if user drags fast and releases within those 50ms, lock-on then lock-off events arrive at sidecar back-to-back; ordering must be preserved. WS `send_json` is in-order over a single channel, but if HUD uses a separate channel from the main protocol, ordering relative to other compositor commands is undefined.

**Severity:** **Important** for HUD UX; visible "fighting" on drag is exactly the antipattern §14B.5 lock semantics is supposed to prevent.

**Prevention:**
- **Optimistic lock at renderer:** the moment user starts dragging, renderer applies the slider value *locally over the displayed param* and assumes the lock takes effect. Sidecar's confirmed lock arrives ~50ms later; until then, the displayed value is whatever the user dragged to. If the WS message fails (rare on localhost), renderer surfaces "lock failed" error.
- **Sidecar-side: lock state is part of the compositor's per-frame merge**, not a separate flag checked elsewhere. Lock arriving mid-frame is fine — next tick honors it. Avoid mutex or thread-safety bug surface.
- **Document the 50ms "contested writes" window** in the test plan: "Drag fast; observe up to 50ms of value disagreement between displayed slider and avatar position; this is acceptable. Drag slow; observe immediate alignment after lock confirmed."
- **HUD uses *same* WS channel as main protocol** (multiplex via message type, don't open separate channel). Preserves ordering; reduces channel lifecycle complexity.
- **Test fixture: rapid drag-and-release** (drag for 30ms, release). Lock-on, lock-off events arrive in order; final compositor state matches "lock released, plugin back in control." No state where lock is on but never received the off signal.

**Early-warning sign:**
- Slider drag feels "rubber-bandy" — value snaps back briefly after grab
- Lock indicator flickers on/off during drag
- Logs show out-of-order lock events (lock_off before lock_on for same param)

**Phase to address:** **Phase 9** (Slider HUD + Per-Param Lock).

---

### Pitfall 13 [Phase 9, NEW v2.0]: Lipsync exception sticks but isn't documented in HUD UI — user thinks lock is broken

**What goes wrong:**
§14B.5: "lipsync still wins on `MouthOpenY` even when locked (system primitives override locks for safety)." Functionally correct — speech without mouth movement looks broken. But users grabbing the `ParamMouthOpenY` slider during TTS playback see their lock visually engage, then the param immediately moves anyway. Bug? Feature? They didn't read the design doc.

**Severity:** **Minor** — UX confusion, not functional bug. Still important for §14B.5's "Documented exception, not silent."

**Prevention:**
- **Visual lock state indicator distinguishes 3 states:** `unlocked` / `locked` / `locked-but-overridden-by-system` (badge with tooltip explaining why).
- **Sidecar sends per-param status** alongside value: `{ParamMouthOpenY: {value: 0.5, locked: true, override: "lipsync"}}`. Renderer renders the override badge.
- **In-app help text** on HUD's first-open: "Some parameters (mouth, voice-driven head motion) are overridden by system primitives even when locked. Look for the badge."
- **Same exception list available for future system primitives** (breathing, blinking) — don't hardcode `ParamMouthOpenY` as the only override. Compositor declares an override-list; HUD reads it.
- **Test fixture: lock MouthOpenY, trigger TTS playback, verify lock badge shows override + tooltip.**

**Early-warning sign:**
- User reports / dev sees "lock doesn't work on mouth"
- Tooltip empty / wrong on the override badge
- Adding a new system primitive (e.g., milestone-3 breathing driver) doesn't surface in HUD overrides

**Phase to address:** **Phase 9** (Slider HUD + Per-Param Lock).

---

### Pitfall 14 [Phase 10, MUTATED M1]: Cursor sensor cross-monitor + DPI awareness on Windows

**What goes wrong:**
§14B.2: cursor sensor moves from renderer (canvas-relative) to sidecar (OS-level global). Win32's `GetCursorPos` is the obvious choice on Windows (matches design intent). Several traps that don't exist in the renderer-canvas-relative version:

- **DPI virtualization:** if the Python sidecar process isn't DPI-aware, `GetCursorPos` returns *virtualized* coordinates (scaled to the lowest-DPI monitor's coord space). On a 4K monitor at 200% scale, the cursor reports at half its true position. Verified via Microsoft Win32 hi-DPI docs — `SetProcessDpiAwareness(2)` must be called before any other GUI-related Win32 call.
- **Multi-monitor coordinate origin:** primary monitor at (0,0), but secondary monitors *to the left of* primary have *negative* coordinates. Naive normalization (`x / screen_width`) maps negative to negative; the head-angle projection then sends the avatar looking the wrong direction or hits divide-by-screen-width with a wrong screen.
- **Per-monitor DPI changes mid-session:** user drags a window from a 100% monitor to a 200% monitor; if sidecar didn't request `PROCESS_PER_MONITOR_DPI_AWARE` (level 2, not level 1 system-DPI-aware), the coordinates from `GetCursorPos` change semantics under the sidecar's feet.
- **PyAutoGUI import side-effect** (cited in milestone-1 Pitfall #14 ecosystem note + verified via pyautogui issue #663): importing pyautogui on Windows resets DPI awareness if it was set before pyautogui import. Order matters: set DPI awareness first, then import any libraries that might touch user32.dll.
- **Cross-platform fallback:** mss is cross-platform for screenshot; we don't need cursor capture on Mac/Linux for milestone-2 (skeleton ships single-user Windows-primary), but the fallback path (`pynput.mouse.Controller().position` works cross-platform without DPI worries because it goes through the OS abstraction) should at least exist as a stub.

**Severity:** **Critical** for Phase 10 acceptance ("cursor outside VTS window still tracked"); **important** for the §14 verification re-run because milestone-1's renderer-canvas cursor "worked" while the sidecar version may regress on a multi-monitor dev machine.

**Prevention:**
- **Sidecar `bootstrap.py` calls `ctypes.windll.shcore.SetProcessDpiAwareness(2)` *before any other import that might touch Windows display APIs.*** Document the order with a comment block. Wrap in `try/except OSError` for Windows < 8.1 / non-Windows fallback.
- **Verify DPI awareness on connect:** sidecar exposes a `/diag/dpi` introspection endpoint that returns the current process DPI awareness level. CI smoke test asserts level 2 on Windows.
- **Coordinate normalization uses virtual-screen rect**, not primary-monitor rect: `GetSystemMetrics(SM_XVIRTUALSCREEN)` / `SM_YVIRTUALSCREEN` / `SM_CXVIRTUALSCREEN` / `SM_CYVIRTUALSCREEN`. Maps the cursor across the *whole* multi-monitor workspace into 0-1.
- **Head-angle projection sign convention** declared in `_avatar_overrides.yaml` (per-rig), not hardcoded:
  ```yaml
  cursor_projection:
    invert_x: false       # cursor right → head turn right (default)
    invert_y: false       # cursor up → head tilt up (default)
    range_x: [-30, 30]    # head turn degrees
    range_y: [-15, 15]
  ```
  Some rigs invert (especially imported from non-Live2D-Inc-style conventions). Default false; user toggles in import-flow review screen if needed.
- **Capture rate locked to 60 Hz in the sidecar** (matches compositor rate; "free" because the asyncio loop already ticks at 60 Hz).
- **Renderer-side cursor tracker deletion is destructive — actually delete the code, not just unwire.** Searches for "renderer cursor subscriber" must return zero hits in `src/renderer/`. Otherwise dead-code subscribes to a removed WS event and throws. Add a Phase 10 grep-test in CI: `assert not file_exists("src/renderer/cursor_tracker.ts")`.
- **Test fixture on a multi-monitor dev machine:** move cursor to all four corners of the multi-monitor virtual rect; assert head turn angles match expected for each corner.

**Early-warning sign:**
- Cursor on a 4K secondary monitor produces head turns half what the user expects
- Avatar suddenly looks the wrong direction after dragging the chat window to a different monitor
- pyautogui import in sidecar (e.g., for future agent-runtime planning) silently breaks cursor coordinates
- Renderer console error after Phase 10 deploy: "Cannot read property of undefined" from leftover cursor-subscriber

**Phase to address:** **Phase 10** (Cursor Rewrite + Milestone Verification). DPI awareness is the bootstrap-order decision; sign convention is the per-avatar override schema.

---

### Pitfall 15 [Phase 10, NEW v2.0]: Phase 10 §14 SC re-run regresses silently — milestone-1 SC passed under old compositor; refactor changes responsibilities

**What goes wrong:**
§14B.7 Phase 10 commits to "re-run all six §14 SCs against the refactored architecture." After Phases 6-9 the compositor's responsibilities have *changed* (per §14B.2 table: "Idle + Speech (full) + Reaction + Intent + Discrete" → "Idle + Speech (lipsync only) + Reaction (cursor) + plugin-output ingest + lock filter"). SCs that were *previously* validated against the old compositor may degrade in subtle ways:

- SC #2 ("`[joy]` smooth fade-in"): in milestone-1, intent overlay was compositor-internal with hardcoded fade timing. Now it's plugin-driven. Default plugin must implement equivalent fade or SC #2 fails.
- SC #4 ("body/head sway throughout the utterance, no flat moments"): milestone-1 head-only fallback was compositor-internal. Now plugin's responsibility. If default plugin's body emulation (head/face-driven body sway) doesn't produce equivalent visual motion, SC #4 silently fails.
- SC #1 ("user types hello → avatar speaks reply within 3s"): compositor refactor + plugin warmup may add latency to first response. Even if plugin `on_load` is fast, the new sidecar tap for HUD (even when closed) adds asyncio task scheduling overhead.
- SC re-run is *milestone-2's exit criterion*; if any SC silently degrades, the milestone ships broken even though Phase 6-9 individual acceptance tests passed.

**Severity:** **Critical** — milestone exit gate. The whole reason §14 SC #1 was deferred from milestone-1 to milestone-2 is to verify under refactored architecture; if Phase 10 doesn't run them rigorously, the deferral was meaningless.

**Prevention:**
- **Phase 10 ships before Phase 11/agent-runtime starts**, so SC re-run failures block downstream work. No "we'll fix SC #4 in a hotfix" — the regression has to land in milestone-2 or the milestone doesn't ship.
- **Each SC has a *side-by-side comparison test*:** record expected outputs (param frame timeline, audio waveform, latency measurements) from a milestone-1-known-good run; replay the same input under milestone-2 architecture; diff. Tolerances per SC (e.g., latency ±100ms, param values ±0.05). Hard-fail outside tolerance.
- **Default plugin is the "milestone-1 compositor in plugin form"** — its acceptance test is "produces output within tolerance of milestone-1 compositor for the same input." Phase 6 acceptance includes this comparison; Phase 10 re-runs it against the integrated system.
- **Specifically watch SC #4 (body sway).** Milestone-1's head-only fallback (PROJECT.md R-OPEN-1) is the most likely SC to silently regress because the body emulation in default plugin is greenfield code. Phase 6 must ship an explicit "body sway smoke pass" matching the milestone-1 pattern, not just a working default plugin.
- **Phase 10 regression budget:** if 5+ of 6 SCs pass and 1 degrades, document and ship; if 2+ degrade, halt milestone and triage. Hard-coded threshold prevents "well it kind of works" milestone-completion drift.

**Early-warning sign:**
- Phase 6 acceptance passes ("plugin loads and produces ParamFrames") but body motion in real avatar looks visibly different from milestone-1
- Phase 9 HUD-open testing reveals 200ms+ first-response latency increase that didn't exist in milestone-1
- §14 SC #2 fade is "still smooth, just different" — undocumented divergence that may compound across milestones

**Phase to address:** **Phase 10** (Cursor Rewrite + Milestone Verification) for the actual re-run; **Phase 6** for the comparison-test infrastructure.

---

## Cross-Cutting Pitfalls

These don't map to one phase but recur across the milestone — easier to flag once than catch six times.

---

### Pitfall 16 [All phases, NEW v2.0]: Codegen drift — new v2.0 contracts (`PluginManifest`, `RigCapabilities`, HUD WS envelopes, cursor IPC)

**What goes wrong:**
Milestone-1 establishes Pydantic-source-of-truth → TS via codegen. Milestone-2 introduces ~6 new contract types:

- `PluginManifest` (mirrors `plugin.yaml`)
- `RigCapabilities` (compositor-side rig surface)
- `HudFrame` (15 Hz HUD-mode IPC envelope)
- `LockState` (per-param HUD lock)
- `CursorPosition` (sidecar→renderer, replacing renderer-internal type)
- `AvatarImportCatalog` (Phase 8 review-screen contract)

Pattern of failure: Pydantic side gets the new fields, codegen runs *late* or *incompletely* (developer reflex: "I'll regenerate before merging"), TS mirrors stale, TypeScript compile passes (because the renderer references hand-typed substitutes or `any`), runtime mismatches surface only on integration.

**Severity:** **Important** — not a single failure, a recurring class. Each occurrence costs ~2 hours of debug.

**Prevention:**
- **Codegen runs in pre-commit hook** that fails if generated TS files are out of sync with Pydantic source. CI also runs the same check. If milestone-1's codegen is invoked manually, change it — make the source-of-truth transition atomic.
- **No `any` types accepted in renderer for v2.0 contracts.** Code review enforces; ESLint rule (`@typescript-eslint/no-explicit-any` set to `error`) covers the typical reflex.
- **Each new contract is added in a single PR** that includes Pydantic def + regenerated TS + first consumer in renderer. Avoid the "I'll add the type now and the TS later" anti-pattern.
- **Test: integration smoke per contract.** Each new envelope type has a sidecar→renderer round-trip test that decodes on the renderer side and asserts shape. Catches schema drift before merge.

**Early-warning sign:**
- TypeScript compiles, runtime fails with "property X is undefined"
- Renderer hand-edits a type that "should be generated"
- Codegen output dir has uncommitted changes (regenerator was forgotten)

**Phase to address:** All Phases 6-10. Set up enforcement in **Phase 6** prep (when first new contract — `PluginManifest` — lands).

---

### Pitfall 17 [All phases, NEW v2.0]: Unicode in plugin names / catalog names — breaks YAML, breaks shell-based test commands, breaks Windows path handling

**What goes wrong:**
Plugin names, variant names, event names can theoretically contain non-ASCII (CJK, emoji, accented chars). Concrete failure modes:

- **YAML parsing:** `plugin.yaml` with `name: 重音テト` parses fine in PyYAML if the file is UTF-8 (default in 2026 Python), but on Windows console output (cp1252 default) prints garbled. Logs become useless for diagnostic.
- **Catalog YAML (`_avatar_overrides.yaml`):** variant name `{怒}` (Japanese "anger") works in the catalog but the LLM system-prompt assembly may concatenate it into a non-UTF-8 buffer somewhere downstream and crash.
- **NFC vs NFD normalization:** `é` (U+00E9, NFC) vs `é` (U+0065 + U+0301, NFD) compare unequal in cross-category collision check (Pitfall 5). Mac filesystem stores filenames as NFD; Windows / most Python text as NFC. User imports on Mac → exports config to Windows → comparison fails silently.
- **Filename encoding:** Avatar named `重音テト` produces `avatars/重音テト/avatar.yaml`. Windows handles UTF-8 paths fine since 3.6, but old `pathlib` patterns + some libraries still trip on it.
- **Shell-based test commands:** `pytest -k 重音` may fail in PowerShell with default code page. CI in non-UTF-8 locale fails to find tests by name.

**Severity:** **Important** — feels minor, but compounds: one Unicode-related bug at every layer is six bugs over the milestone.

**Prevention:**
- **All file I/O explicitly UTF-8:** `open(path, encoding="utf-8")` everywhere; never rely on platform default. PyYAML's `yaml.safe_load` reads bytes — open in binary, decode UTF-8 explicitly.
- **All YAML files saved with `allow_unicode=True`** when re-serializing (pyyaml default is `False`, escapes non-ASCII as `\uXXXX`).
- **NFC normalize all catalog identifiers at parse time:** `unicodedata.normalize("NFC", name)`. Cross-category collision check and reserved-name check use NFC-normalized strings.
- **Plugin loader rejects entrypoint module names with non-ASCII** (Python module names should be ASCII per PEP 8; importlib accepts non-ASCII but it's a foot-gun). Catalog names (`action_codes`, variant/event names) can be Unicode — only the entrypoint module name is restricted.
- **Console logging on Windows:** force UTF-8 stdout via `sys.stdout.reconfigure(encoding='utf-8')` at sidecar boot. Electron's spawned-process stdout reader assumes UTF-8 anyway.
- **Path handling: `pathlib.Path` exclusively, never string-concat with `os.sep`.** Already implicit in Python 3.12 codebase.
- **Test fixture: import an avatar named `重音テト` with variants `{怒}`, `{笑}`, events `<ジャンプ>`. Round-trip through YAML save/load, compositor dispatch, LLM system-prompt assembly. No mojibake.**

**Early-warning sign:**
- Logs contain `\uXXXX` escapes instead of native chars
- Catalog comparison fails on Mac → Windows config copy
- Avatar import succeeds but cataloged variant doesn't fire on LLM emit (Unicode normalization mismatch between catalog and parser)

**Phase to address:** **Phase 6** (set the UTF-8 + NFC contract early); enforce in **Phase 7** parser, **Phase 8** import, **Phase 10** verification.

---

### Pitfall 18 [Phases 6-10, CARRY-OVER M1#3, M1#4, M1#9]: pyvts / VTS-API milestone-1 critical pitfalls all carry over

**What goes wrong:**
Milestone-1 ships 4 critical pyvts/VTS pitfalls (single-writer #3, rate-limit batching #4, parameter-ownership #8, 1-second re-injection #9). After milestone-2 the *producers* of writes change (plugin replaces compositor's intent driver) but the writer task and pyvts wrapper are unchanged. **However**, two new entry points to the writer exist that didn't in milestone-1:

- **HUD lock state changes** — when user releases a lock, compositor resumes writing. New code path; must respect the single-writer contract (writes go through the existing queue, not direct).
- **HUD slider drag** — when user drags slider, the *user's* value is the source of truth temporarily; this value must hit pyvts at the same 60 Hz cadence as compositor output, batched into the same per-frame `InjectParameterDataRequest` (M1#4 contract).
- **Variant dispatch** (Phase 7) — `{hold-mic}` toggles a VTS hotkey via `HotkeyTriggerRequest`. This is a discrete event, not a param frame; M1#3 requires it goes through the *same* writer task as param frames (single-writer pattern) but on the discrete-event sub-queue (M1#4 mitigation).
- **Event dispatch** (Phase 7) — `<wave>` triggers a motion. Same pattern as variant.
- **Cursor-driven head-angle frames** (Phase 10) — sidecar generates ParamFrames from cursor position. Same writer ingest as plugin/compositor output.

If any of these new entry points goes around the writer task ("I'll just call `pyvts.request()` directly here, it's simpler"), the milestone-1 mitigations break: deadlocks reappear (M1#3), rate cap violated (M1#4), ownership conflicts return (M1#8).

**Severity:** **Critical** — M1#3 deadlocks were the milestone-1 critical failure; reintroducing them via plugin or HUD code path is a regression.

**Prevention:**
- **Single-writer pattern enforced via type-system:** the pyvts client object is `private` to the writer task; every other module receives a `WriterQueue` handle that exposes `enqueue_param_frame(frame)` / `enqueue_discrete_event(event)`. No `pyvts` import in any module except `writer.py`.
- **CI grep-test:** `assert grep "import pyvts" src/ | wc -l == 1` (one file: the writer). Catches accidental imports in plugin code, HUD code, etc.
- **Plugin ABC explicitly forbids pyvts access:** `BodyMotionPlugin` has no reference to writer or pyvts; plugin yields ParamFrames, loader queues them. If a plugin author wants to fire a hotkey, they emit an event-shaped ParamFrame and the loader translates. (This also means plugins can't drive variants directly — variants are system-domain per §14B.3, plugins only emit `[action]` codes.)
- **Test fixture: stress test with all v2.0 entry points firing simultaneously** — plugin emitting 60 Hz, HUD locked params, variant dispatch every 2s, event every 5s, cursor at 60 Hz. Run for 5 minutes; assert no `RuntimeError`, no rate-cap violations (>60 messages/s), no orphan task leaks.

**Early-warning sign:**
- `grep -r "import pyvts" src/` returns >1 file
- New entry point in code review has direct `pyvts.request()` call
- Stress test deadlocks or VTS UI lags during multi-source writes

**Phase to address:** Set the contract in **Phase 6** (writer task is part of compositor refactor); enforce across **Phases 7, 9, 10** (every new writer entry point).

---

### Pitfall 19 [All phases, CARRY-OVER M1#7]: Hot-reload / file-watcher race on `_avatar_overrides.yaml` re-edit from review screen

**What goes wrong:**
Milestone-1 PITFALLS #7 (chokidar half-write race, `awaitWriteFinish` requirement) carries over directly. Milestone-2 *adds* a new write path: the avatar-import review screen (Phase 8) writes to `_avatar_overrides.yaml`. This write happens while the watcher is active, *and* the file is being read by the orchestrator (catalog source-of-truth at runtime).

If the review screen writes via Electron's main-process file-write (atomic-rename) and the watcher is configured per M1#7 mitigation, this just works. **If** the review screen writes via a Python sidecar HTTP/WS endpoint that does naive truncate-then-write, M1#7's race condition kicks in even with `awaitWriteFinish`.

**Severity:** **Important** — exact same severity as M1#7, just at a new write site.

**Prevention:**
- **Phase 8 review-screen writes go through Electron main process**, not sidecar. Electron's `fs.writeFile` to a `.tmp` then `fs.rename` is atomic on every supported OS.
- **If sidecar must write (e.g., a future "auto-detect orphans during runtime"):** use `pathlib.Path.replace()` after writing to a sibling `.tmp` file. This is atomic on POSIX and Windows for same-filesystem renames.
- **Re-test M1#7 mitigation** during Phase 8 with the new write path. Adversarial: open avatar review screen, save, *and* hot-edit `_avatar_overrides.yaml` in another editor at the same time. Compositor must not see torn state.

**Early-warning sign:**
- After saving review screen, compositor logs `JSONDecodeError` / `YAMLError`
- Catalog reverts to previous state randomly after a save
- M1#7's existing test passes but the new Phase 8 write path doesn't have its own test

**Phase to address:** **Phase 8** (Avatar Import + Catalog Auto-Extraction). Decision lives in IPC architecture for the review-screen save action.

---

### Pitfall 20 [All phases, NEW v2.0]: Manifest schema drift — `plugin.yaml` `api_version` mismatch loads anyway

**What goes wrong:**
§14B.4 + R-19: "plugin manifest declares `api_version`, system refuses to load incompatible plugins." Reflex implementation: `if manifest.api_version != CURRENT_API_VERSION: raise IncompatibleError`. Edge cases that break this:

- **Missing field:** old plugin from an early dev iteration has no `api_version` field. Strict reading raises `KeyError`; loose reading defaults to `0` and treats as compatible. Both wrong — should refuse to load with "manifest is missing api_version, please update."
- **String vs semver:** `api_version: "1.0"` vs `api_version: "1.0.0"` vs `api_version: 1.0` (YAML parses last as float). Pydantic schema for manifest must lock to a string semver pattern.
- **Forward compat assumption:** plugin declares `api_version: "1.5"`, system is on `"1.0"`. Strict equality refuses to load — but if the only change is additive (new ABC method with default impl), the plugin is compatible. Versioning policy needed: do we use semver semantics (major.minor.patch with major-bump = breaking) or bump-on-any-change?
- **Backward compat assumption:** plugin declares `api_version: "0.9"`, system is on `"1.0"`. Refuse if 1.0 introduced breaking changes; allow if not. Same versioning-policy question.

**Severity:** **Important** for plugin ecosystem hygiene (matters from second plugin onward); **minor** for milestone-2 (only one plugin: the default).

**Prevention:**
- **Phase 6 plan-phase decides versioning policy** explicitly: recommended is *strict semver, major-bump = breaking, system accepts plugins with same major and ≤ system's minor*. Documents the breakage rules in `BodyMotionPlugin` ABC docstring.
- **`PluginManifest` Pydantic model has `api_version: str` with regex validation** matching `^\d+\.\d+(\.\d+)?$`. Loader rejects manifest that doesn't parse.
- **Loader version check is explicit and logged at INFO:** "Plugin {name} v{plugin_version} (API {api_version}) loaded against system API {system_api}." Surface clearly so future debug knows what's loaded.
- **Migration path for breaking changes:** when API bumps major in milestone-3+, ship a doc + old-API-shim wrapper allowing v1 plugins to load with deprecation warning. Out of milestone-2 scope but flag the design for milestone-3.
- **Test fixtures:** plugin with missing `api_version` (refuse), wrong type (refuse), incompatible major (refuse), compatible minor (load with INFO log).

**Early-warning sign:**
- Plugin loads but fails at runtime due to ABC method missing — version check let through what should have been refused
- Manifest validation surfaces YAML-cosmetic issues (float vs string) instead of semantic

**Phase to address:** **Phase 6** (Plugin Runtime + Default Plugin). Manifest schema is part of the contract.

---

## Moderate Pitfalls

### Pitfall 21 [Phase 7, NEW v2.0]: System-prompt assembly bloat — plugin's action codes + variants + events all inline

**What goes wrong:**
§14B.4: "plugin's action codes + descriptions appended to base prompt under a fixed delimiter so the LLM knows the vocabulary." Phase 7 extends: variants and events also need to appear in the system prompt (LLM emits them, they need to be in vocabulary). After import flow runs, a typical avatar might have:

- 8 action codes (default plugin's emotionMap)
- 5-15 variants (rig-dependent)
- 5-30 events (rig-dependent — some Cubism rigs have many short motions)

Each entry has a description. Total system-prompt overhead: ~500-2000 tokens *per turn*. On LM Studio with a 4k-context model this eats meaningful context budget. KV-cache prefix-stability rule (memory MEMORY.md: "system prompt bytes-identical at boot") means this assembled prompt must be stable across the session — which means *all* catalog entries are inlined regardless of relevance to the current turn.

**Severity:** **Moderate** — context-budget pressure compounds with memory-layer system prompts in milestone-3+.

**Prevention:**
- **Concise descriptions:** action/variant/event entries get max 50 chars description each in `plugin.yaml` / `_avatar_overrides.yaml`. Loader truncates with WARN if longer.
- **Format budget:** total system-prompt overhead ≤ 1000 tokens for an average rig. If catalog produces more, surface a warning at avatar load: "Avatar 'Teto' has 38 catalog entries; system prompt overhead is large. Consider trimming via Settings → Avatar."
- **Honor KV-cache prefix-stability rule:** assembled prompt is byte-identical across the session. Trim/sort/order is computed at avatar-load and frozen.
- **Don't dynamically swap descriptions per turn** (e.g., "show only relevant variants based on context") — breaks KV cache. Static assembly only.
- **Test:** assemble system prompt for a rig with 30 catalog entries; verify byte-identical assembly across two boots with same catalog; verify token count under budget.

**Phase to address:** **Phase 6** (default plugin's prompt assembly) + **Phase 7** (variant/event addition to assembly).

---

### Pitfall 22 [Phase 8, NEW v2.0]: OLVT `model_dict.json` integer-indexed expression import

**What goes wrong:**
OLVT's `model_dict.json` allows `{"0": "joy"}` (integer-keyed) entries. Our system uses string-named only. Naive importer reads the integer keys and produces nonsense catalog entries; strict importer rejects with no recovery path.

**Severity:** **Moderate** — narrow user base (OLVT migrators) but blocks them entirely if not handled.

**Prevention:**
- **Importer detects integer keys** and resolves them via the rig's `.model3.json` `Expressions` list: `{"0": "joy"}` becomes catalog entry named `joy` (the int 0 was an index into the expressions array, OLVT used position).
- **If `.model3.json` has no Expressions list** or fewer entries than the integer keys reference, surface error in review screen: "OLVT model_dict.json references expression index 5 but rig has only 3 expressions. Please re-import with the correct rig file."
- **Test fixture:** OLVT `model_dict.json` with mixed int + string keys; rig with named expressions; verify catalog has the resolved-name entries plus the originally string-keyed ones.

**Phase to address:** **Phase 8** (Avatar Import). One of the four file shapes.

---

### Pitfall 23 [Phase 9, NEW v2.0]: HUD param introspection on first open — `requestParameterValueListRequest` for 50 params

**What goes wrong:**
First HUD open needs current values for ~50 params to populate sliders. Naive: `await pyvts.request(VTS_param_value_get(param_id))` per param = 50 sequential round-trips = ~500ms+ on Windows localhost (10ms RTT typical).

VTS API has a single `requestParameterValueListRequest` that returns all parameters in one call. Using the per-param API is the wrong reflex.

**Severity:** **Moderate** — UX delay, not crash. Easy to get right.

**Prevention:**
- **Use bulk request:** one `requestParameterValueListRequest` per HUD-open. Returns all params in single round-trip.
- **Cache result for session:** subsequent HUD reopens reuse the values from the latest 15 Hz tap (HUD's compositor-output stream is the source of truth for the current frame; bulk request is only needed for the *first* open before stream starts).
- **Test:** measure HUD time-to-first-paint; assert <200ms on dev machine.

**Phase to address:** **Phase 9** (Slider HUD).

---

### Pitfall 24 [Phase 9, NEW v2.0]: Slider granularity — 0-1 floats, smooth-drag UX needs ~256 discrete steps

**What goes wrong:**
HUD sends slider values as 0-1 floats. UX needs smooth-feeling drag, which on a 300px-wide slider is ~300 mouse-movement-pixels. Sending a float with 6+ decimal precision per pixel is fine, but rounding to 2 decimals (0.01 step) means only 100 discrete positions — visible step quantization on drag.

**Severity:** **Minor** — cosmetic. But often gets implemented wrong.

**Prevention:**
- **Slider sends raw float** (0-1 with full Python float precision). No rounding at WS boundary.
- **Renderer interpolates display** between sent values for visual smoothness, but the wire format is the unrounded value.
- **VTS itself accepts float — no quantization on the VTS side.**

**Phase to address:** **Phase 9** (Slider HUD).

---

### Pitfall 25 [Phase 9, NEW v2.0]: HUD multi-window behavior undefined — float / dock / modal?

**What goes wrong:**
§14B.5 doesn't specify HUD window behavior. Three reasonable choices, each with implications:

- **Floating window:** always-on-top, separate Electron BrowserWindow. Most flexible for users who want sliders + chat side-by-side. Cost: extra window management code.
- **Docked panel:** part of the main chat window, slides in from the side. Less flexible; matches simple-app aesthetic.
- **Modal overlay:** blocks chat while open. Worst — defeats the "discover params during conversation" use case.

If left undecided, the implementation defaults to "whatever's easiest" which is usually floating-window-without-state-management.

**Severity:** **Minor** — UX decision. But shipping the wrong default is annoying to fix later.

**Prevention:**
- **Plan-phase decides:** recommended is **floating, always-on-top, remembers position via electron-store**. Matches the "discovery tool" framing — user opens HUD when they want to explore, leaves it open during conversation, closes when done.
- **Multi-monitor: open on the same monitor as main window** (electron API `screen.getDisplayMatching(mainWindow.getBounds())`).
- **Position persistence is electron-store** (per stack), not `_avatar_overrides.yaml` — HUD position is per-user-machine, not per-avatar.

**Phase to address:** **Phase 9** (Slider HUD) plan-phase.

---

## Minor Pitfalls

### Pitfall 26 [Phase 10, NEW v2.0]: Renderer cursor tracker dead-code subscribes to removed WS event

**What goes wrong:**
Phase 10 deletes the renderer-side cursor tracker but leaves stale WS subscriptions in unrelated components ("we use cursor position for the chat-bubble emoji popup" or whatever). Removed event never fires; subscriber sits idle or throws on undefined data.

**Severity:** **Minor** — but a typical refactor-leftover bug.

**Prevention:**
- **Search-and-destroy:** `grep -r "cursor" src/renderer/` after deletion; review every hit. Either reroute to new cursor source or remove.
- **WS event names: `cursor_position` (renderer-source, milestone-1) → `cursor_capture` (sidecar-source, milestone-2).** New name forces explicit migration; subscribers to old event name fail loudly.

**Phase to address:** **Phase 10** (Cursor Rewrite).

---

### Pitfall 27 [Phase 6-10, NEW v2.0]: File path conventions on Windows — pyyaml vs pathlib

**What goes wrong:**
Windows-pinned skeleton uses backslashes in some places (Electron user-data dir is `C:\Users\X\AppData\Roaming\AgenticLLMVTuber`). pyyaml on Windows handles paths correctly when *content* is a path string, but plugin loader using `os.path.join` produces backslash-separated strings that look ugly in YAML and may break round-tripping if YAML serializer escapes backslashes (it does for `\n` etc.).

**Severity:** **Minor** — papercut.

**Prevention:**
- **`pathlib.Path` for all path manipulation in Python**; convert to forward-slash string when serializing to YAML (`path.as_posix()`).
- **Electron-side: same pattern** — use `path.posix.join` when persisting to JSON/YAML.

**Phase to address:** Any phase that adds new path-handling code; explicit in **Phase 8** (avatar import file paths).

---

### Pitfall 28 [Phase 6, NEW v2.0]: LLM emits codes that match no catalog — silent drop vs warn vs prompt-correct

**What goes wrong:**
LLM hallucinates `[melancholy]` when the action catalog has only 8 emotionMap entries. Naive parser silently drops. User sees nothing happen, doesn't know if it's intent-not-understood or rendering-broken.

**Severity:** **Minor** — UX/diagnosability.

**Prevention:**
- **Parser logs INFO with rate-limit:** "LLM emitted unknown action `[melancholy]`; closest match: `[sadness]` (Levenshtein 4)." Once per unique unknown code per session — not on every utterance.
- **System-prompt recap** in Phase 6 plan: ensure the catalog is *clearly* listed in the prompt, not buried under other instructions. Reduces hallucination rate.
- **No prompt-correct in v2.0** (would require an extra LLM call to "fix" the code) — too much complexity for a minor benefit.

**Phase to address:** **Phase 6** (Plugin Runtime, action-code dispatch).

---

## Phase-Specific Warnings (Roadmapper Reference)

| Phase | Critical Pitfalls | Important | Recommended Test-Plan Anchor |
|---|---|---|---|
| **6 — Plugin Runtime + Default Plugin** | #1 (loader crash safety), #2 (asyncgen leak), #3 (rate mismatch), #4 (safety clamp), #18 (single-writer carry-over), #20 (manifest schema) | #16 (codegen drift), #17 (Unicode), #21 (system-prompt size), #28 (unknown code) | Plugin lifecycle test (load/unload/crash), 100-turn memory test, malicious-plugin clamp test, rate-pathological plugin test |
| **7 — Three-Category Code Parsing** | #5 (token-boundary tri-syntax), #6 (`<think>` precedence), #7 (variant persistence), #8 (event timeout) | — | Adversarial token-split fixture for all 3 categories, DeepSeek-R1 fixture, variant collision sequence test |
| **8 — Avatar Import + Catalog Auto-Extraction** | #9 (file-format edge cases), #10 (review-screen click-past) | #19 (M1#7 carry-over), #22 (OLVT int-keys) | 6-rig test fixture suite, placeholder-density Save-disabled test, OLVT migration round-trip test |
| **9 — Slider HUD + Per-Param Lock** | #11 (IPC backpressure), #12 (lock desync), #13 (lipsync override UX) | #18 (M1#3 carry-over via new entry point), #23 (bulk introspection), #24 (granularity), #25 (window behavior) | HUD-open-during-streaming latency budget, rapid-drag-release test, override-badge UX test |
| **10 — Cursor Rewrite + §14 Verification** | #14 (DPI / multi-monitor), #15 (SC re-run regression) | #18 (M1#3 carry-over via cursor frames), #26 (renderer dead-code) | Multi-monitor 4-corner test, side-by-side SC comparison harness, grep-test for renderer cursor remnants |

---

## "Looks Done But Isn't" Checklist (v2.0 additions)

End-of-milestone-2 verification — augments milestone-1's same section.

- [ ] **Plugin crash recovery:** kill plugin's `on_token_stream` mid-utterance via a deliberate exception; observe null-plugin fallback engages within 1s; observe 1-second re-injection rule still respected (M1#9)
- [ ] **Plugin reload "scope creep" check:** `grep -r "importlib.reload" src/` returns 0 hits in plugin code paths
- [ ] **Memory bound:** 100-turn conversation against null plugin keeps sidecar RSS within +5 MB of initial
- [ ] **Three-category combined emit:** LLM prompt fixture with `[joy] {hold-mic} <wave>` produces all three dispatches; test with adversarial token boundary (each delimiter split mid-stream)
- [ ] **`<think>` precedence:** DeepSeek-R1 fixture emits `<think>I will wave</think><wave>Hi`; reasoning consumed, event fires, "Hi" reaches TTS, "I will wave" never does
- [ ] **Variant policy:** `{a}` then `{b}` toggles a off before turning b on (no overlap)
- [ ] **Event duration:** loop motion as event doesn't stall queue; non-loop motion auto-completes within `Meta.Duration + 1s`
- [ ] **Avatar import edge cases:** all 6 rig-shape fixtures import to expected catalog (or fail-with-clear-error for the broken one)
- [ ] **Review-screen friction:** all-`exp_NN` rig disables Save button; renaming to >50% non-placeholder enables Save
- [ ] **HUD perf:** open HUD during peak streaming response; chat token p95 latency stays within 50ms of HUD-closed baseline
- [ ] **Lock-state desync:** rapid-drag-release sequence preserves order; final state matches "lock released, plugin in control"
- [ ] **Lipsync override badge:** lock MouthOpenY during TTS; badge appears with tooltip
- [ ] **DPI awareness on Windows:** `/diag/dpi` endpoint returns level 2 (PROCESS_PER_MONITOR_DPI_AWARE)
- [ ] **Multi-monitor cursor:** all four corners of virtual screen rect produce expected head-angle outputs
- [ ] **Renderer cursor dead-code:** `find src/renderer -name "*cursor*"` returns 0 hits matching milestone-1 tracker
- [ ] **§14 SC re-run:** all 6 SCs pass within tolerance vs milestone-1-known-good baseline; specifically SC #2 (`[joy]` fade smoothness) and SC #4 (body sway) match within visual-comparison threshold
- [ ] **Codegen sync:** pre-commit hook fails if Pydantic-source changes without regenerated TS
- [ ] **Unicode round-trip:** rig named `重音テト` with variant `{怒}` saves, loads, dispatches without mojibake

---

## Sources

**Verified — HIGH confidence:**
- `PROJECT_DESIGN.md` §14B.1-14B.9 — milestone-2 architecture spec (HIGH on the spec; MEDIUM on whether spec is implementable as-stated for some details flagged as "deferred to plan-phase" in §14B.9)
- `PROJECT_DESIGN.md` §15 R-19 — plugin runtime trust + API stability risk
- `PROJECT_DESIGN.md` §5.3.1 — VTS rig two-layer architecture (referenced for cursor projection sign-convention discussion)
- `.planning/research/PITFALLS.md` (milestone-1) — direct carry-over reference for #18 (writer pattern), #19 (file-watcher race)
- `.planning/PROJECT.md` — current milestone context and SC #1 deferral rationale
- [Win32 GetCursorPos / DPI Awareness — Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getcursorpos) — DPI virtualization warning
- [Win32 DPI_AWARENESS_CONTEXT — Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/hidpi/dpi-awareness-context)
- [pyautogui issue #663 — DPI detection breaks on import](https://github.com/asweigart/pyautogui/issues/663)
- [Python Security docs — sandboxing inside CPython](https://python-security.readthedocs.io/security.html) — explicit recommendation against in-process sandboxing
- [Python issue #41229 — async generator memory leak](https://bugs.python.org/issue41229)
- [Python issue #15635 — generator memory leak](https://bugs.python.org/issue15635)
- [Python issue #17468 — generator memory leak](https://bugs.python.org/issue17468)
- [VTube Studio motion3.json structure — DenchiSoft wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/Loading-your-own-Models) — Meta.Duration / Meta.Loop / Meta.Fps fields
- [VTube Studio Plugins API wiki](https://github.com/DenchiSoft/VTubeStudio/wiki/Plugins) — InjectParameterDataRequest contract (carry-over reference for #18)

**Verified — MEDIUM confidence:**
- [Hex Shift — WebSocket backpressure in FastAPI](https://hexshift.medium.com/managing-websocket-backpressure-in-fastapis-893c049017d4) — backpressure patterns (latest-wins, queue-bounded), supports Pitfall 11 mitigation
- [Hex Shift — Advanced WebSocket architectures in FastAPI](https://hexshift.medium.com/how-to-incorporate-advanced-websocket-architectures-in-fastapi-for-high-performance-real-time-b48ac992f401) — multiplexing vs separate channels
- [Pierce Freeman — Misadventures in Python hot reloading](https://pierce.dev/notes/misadventures-in-python-hot-reloading) — sys.modules cache and stale-reference issues, supports Pitfall 2's no-hot-swap rule
- [Live2D motion3.json structure walkthrough — vesper @ Medium](https://medium.com/@vesper_illust/understanding-live2d-model-data-files-for-vtube-studio-0ada080a35b2) — Meta fields, expression vs motion file distinction
- [openedx codejail — secure Python sandboxing](https://github.com/openedx/codejail) — context for "sandbox is a separate process, not in-Python" pattern (informs R-19 acceptance)

**Inferred from design doc + architectural analysis (LOW confidence — flagged):**
- Specific token-boundary BPE behavior for `{}` vs `[]` vs `<>` — generalizes from milestone-1 M1#5 evidence; specific tokenizers may behave differently
- HUD perf threshold (50ms p95 latency budget) — sane default; rig-specific tuning may be needed
- Variant collision policy recommendation (radio-button) — argument-based, not measured
- §14 SC re-run tolerance bands (latency ±100ms, param ±0.05) — sane defaults; may need tuning when baseline replays land
- Plugin API versioning policy (semver, major-bump = breaking) — convention; may need different policy if plugin ecosystem evolves
- Specific catalog-entry token budget (1000 tokens) — informed estimate; depends on chosen LLM context window

---

*v2.0 pitfalls research for: AgenticLLMVTuber milestone-2 (Plugin + Animation Architecture Refactor), phases 6-10 per §14B*
*Researched: 2026-05-08*
