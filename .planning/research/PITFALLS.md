# Pitfalls Research

**Domain:** Local-first desktop Live2D companion app — Electron+React shell, Python (FastAPI/uvicorn) sidecar, VTube Studio + pyvts renderer, LiteLLM gateway (LM Studio default), piper TTS, OLVT-style sentence-buffered conversation pipeline with `[emotion]`/`[action]` tags driving a 60 Hz action compositor. Walking-skeleton scope per `PROJECT_DESIGN.md` §14.

**Researched:** 2026-05-06
**Confidence:** HIGH on §15 risks already in the design doc and on findings verified against VTube Studio/pyvts/LiteLLM/chokidar issue trackers; MEDIUM on inferred OLVT-port traps where the lessons-learned write-up in §5.3.1 is the only source; LOW where flagged inline.

**Scope discipline:** every pitfall below is mapped to a walking-skeleton sub-phase. Pitfalls that only matter for *future* milestones (agent runtime R-2/R-3/R-7/R-8, scheduler R-9, memory R-12/R-14, multi-thread, multi-avatar, mobile/Pixi) are deliberately omitted. Goal: prevent the skeleton from quietly shipping broken, not catalogue all of v1.

---

## Critical Pitfalls

These can sink the skeleton or force a rewrite of the compositor / sidecar / pipeline.

### Pitfall 1: Treating §5.3.1's IN-twin trick as a solved recipe instead of an unsolved research question

**What goes wrong:**
The skeleton plan inherits OLVT Phase 4's "additive `ParamAngleXIN` / `ParamAngleZIN` injection drives body sway via the rig's physics chain" pattern (§5.3.1, third failure mode). PROJECT.md R-OPEN-1 already calls this out: *the trick did not actually produce visible body sway on the Teto rig.* If the skeleton's speech driver is wired identically to OLVT Phase 4, you will burn days re-confirming a known failure and arrive at the same shrug. Worse, success criterion #4 ("body/head sway continuously through the utterance, no flat moments") quietly silently downgrades to "head only" without the team noticing the slip.

**Why it happens:**
The §5.3.1 write-up reads as a *taxonomy of three failure modes plus recovery* — the third item, "Physics-chain shortcuts," sounds like a fix. It's actually a description of how the IN-twin pattern *can* work in principle. On Teto specifically it didn't, and the rig's deformer/physics graph was never re-inspected to confirm which body params are non-orphan downstream of head IN.

**How to avoid:**
- **Mandatory smoke pass before writing the speech driver.** Inject each of the common-set body params (ParamBodyAngleX, ParamBodyAngleY, ParamBodyAngleZ, plus their `*IN` twins, plus any rig-specific body proxies) at strength 1.0 for 2 seconds and visually log which moved. Persist results into `teto_overrides.yaml`.
- **If smoke pass finds zero moving body params:** explicitly take the "head-only + breathing/micro-shoulder" fallback documented in PROJECT.md, and ship the written rationale (the skeleton's success criteria #4 explicitly allows this with documented fallback).
- **Do not copy-paste OLVT Phase 4's `additive_inject_to_AngleXIN` code without re-running the smoke pass on whatever rig the skeleton uses.** Even if Teto behaves the same way as in OLVT, the head-IN-additive amount that worked in OLVT may produce no visible motion on a faster blink schedule or different idle baseline.
- **Author the speech driver behind a feature-flag default-on-head-only** so a 30-min `vtube.json` physics-chain experiment doesn't gate the skeleton ship.

**Warning signs:**
- Compositor logs say "speech driver firing" but the avatar's torso is motionless during TTS playback
- Smoke pass output shows ParamBodyAngleX moves visually but nothing references it in the speech driver code (orphan rediscovered)
- The team starts saying "well at least the head moves" and removing body lines from acceptance tests

**Phase to address:**
Skeleton Phase: **Speech-driver bring-up** (after compositor scaffold, before TTS integration). This is the explicit "investigate+report" success criterion in PROJECT.md and must not be deferred.

**Severity:** Skeleton-blocker for success criterion #4 unless the head-only fallback is taken deliberately.

---

### Pitfall 2: Writing to `ParamAngleX` (input layer) on a VTS rig and assuming silence == "param not supported"

**What goes wrong:**
The skeleton's renderer-aware ParamID resolver decides per-rig whether to write to the input layer (`ParamAngleX`) or the IN twin (`ParamAngleXIN`). For VTS+pyvts the design says "VTS path writes input-layer names and lets VTS internal routing handle smoothing" — but the very §5.3.1 lesson the resolver is built around says the input layer is *generally not bound to deformers in VTS rigs.* When the renderer is VTS and you write `ParamAngleX` via `InjectParameterDataRequest`, VTS *does* route through `<model>.vtube.json` to the IN twin — that's why it works. But the moment a developer toggles the renderer to a pixi prototype or live2d-py spike to test something, the same param writes are silent no-ops, and the team concludes "the compositor is broken" instead of "VTS-only routing was implicit."

**Why it happens:**
The two-layer architecture (§5.3.1) is invisible inside VTS. Engineers without Phase 4 background read the resolver's "VTS branch writes input-layer names" line as a portable convention rather than a VTS-specific shortcut. The 30-LOC stub for the non-VTS branch errors helpfully — but only if it actually errors. If a developer hacks past the stub for a quick test, they'll see a silent dead avatar, not a thrown exception.

**How to avoid:**
- **Resolver stub for non-VTS branches must `raise NotImplementedError("Routing emulation required — see §5.3.1; do not stub-write input layer params on non-VTS renderers")` not just log a warning.** Loud failure beats silent dead model.
- **In-code comment block referencing §5.3.1 directly above the VTS branch.** The "ParamAngleX just works" line must be tagged "ONLY because VTS does routing internally."
- **Smoke-pass tooling stub** (the `teto_overrides.yaml` ships per PROJECT.md) is the right vehicle even pre-tooling: ship a unit test that asserts every common-set param resolves to a non-empty target on the active rig.
- Document that the per-avatar override's "physics-chain proxy" field is what carries the body-sway-via-head-IN choice — not a hardcoded constant in the speech driver.

**Warning signs:**
- Avatar renders fine in VTS but a future Pixi/live2d-py spike shows a frozen model — the renderer is "fine," routing is missing
- A developer adds a non-VTS renderer in a feature branch without anyone editing the resolver — should have been impossible if the stub raised loudly

**Phase to address:**
Skeleton Phase: **Renderer binding + ParamID resolver scaffold** (immediately after WebSocket protocol). One unit test + one comment block prevents this entirely.

**Severity:** Skeleton-protective. Doesn't block skeleton ship, but the 30-LOC stub PROJECT.md commits to is only valuable if it errors loudly.

---

### Pitfall 3: pyvts is sync-blocking under `asyncio.gather` — the parallel synth pipeline will deadlock or `RuntimeError`

**What goes wrong:**
The OLVT-port pipeline does parallel TTS synthesis and ordered playback (§5.6). The action compositor runs at 60 Hz parallel to TTS. Both want to talk to pyvts. pyvts open issue [#51](https://github.com/Genteki/pyvts/issues/51) (Sep 2024, unfixed at v0.3.3) confirms: pyvts's request/response design awaits `websocket.send()` then `websocket.recv()` sequentially per call. If two coroutines call pyvts concurrently via `asyncio.gather`, the second blocks the first, and you eventually hit `RuntimeError: cannot call recv while another coroutine is already waiting for the next message`. Symptom in the skeleton: random frames dropped from the 60 Hz stream; intermittent "no parameter motion for 2-3s" gaps; or hard deadlock when a discrete event (hotkey for prop) fires during continuous param injection.

**Why it happens:**
pyvts's synchronous internal locking is invisible until you hit it. Issue #51 is open, the maintainer hasn't released a fix, the proposed patch in the issue (background `recv` loop + per-request `asyncio.Event` keyed by request ID) is not in v0.3.3.

**How to avoid:**
- **Single-writer pattern: own the pyvts connection inside one `asyncio.Task` ("VTSWriter") that holds the only reference to the pyvts client.** All compositor frames and discrete events go through an `asyncio.Queue` to that task. No other code touches pyvts.
- **Coalesce duplicate frame writes.** The 60 Hz compositor produces a frame every ~16ms. If the writer task drains slower than that (TTS audio analysis backpressure, OS scheduling jitter), drop intermediate frames and write only the latest. Avoids unbounded queue growth.
- **Vendor or fork pyvts** if the throughput-bug bites. The fix proposed in issue #51 (decouple send from recv, keyed Events) is ~50 lines. Pin to a forked tag in `requirements.txt` rather than wait for upstream.
- **Throttle `InjectParameterDataRequest` to 60 Hz at the writer**, not at the compositor. The compositor produces frames; the writer enforces the rate ceiling. This is also where R-1's documented "throttle to 60 Hz" mitigation lives.

**Warning signs:**
- `RuntimeError: cannot call recv while another coroutine is already waiting` in dev logs
- Avatar visibly stutters every few seconds even when CPU is idle
- Adding a hotkey-fire test breaks an otherwise-stable speech-driver test

**Phase to address:**
Skeleton Phase: **WebSocket protocol setup + pyvts wrapper** (very first, before compositor — the wrapper is the single integration point everything else builds on).

**Severity:** Skeleton-blocker. Will be hit the moment compositor + TTS run together.

---

### Pitfall 4: VTS API parameter-injection rate-limiting is poorly documented; "60 Hz works" is approximate, not guaranteed

**What goes wrong:**
The VTS API wiki documents the *minimum* injection cadence (re-send at least once per second or the parameter goes "lost"). The *maximum* practical cadence is undocumented except for an explicit warning that parameter-list polling at 60+ FPS "may cause performance issues" — and the same wiki note does not extend that warning to `InjectParameterDataRequest` itself. In practice the 60 Hz `ParamFrame` plan (R-1, §5.2) is empirically reasonable but not contractually safe. Symptoms when the limit is exceeded: VTS dropping frames silently, parameter visibly lagging behind the compositor's intent, intermittent VTS UI hangs, or pyvts websocket disconnects (issue #49 is exactly that — websocket closing under load).

**Why it happens:**
VTS's WebSocket handler is single-threaded inside Unity's main loop. Sending more than ~60 messages per second across all message types (param injection + the things the rest of the app does) competes with the renderer for time on that thread. The exact threshold is rig-dependent and machine-dependent.

**How to avoid:**
- **Batch every parameter into one `InjectParameterDataRequest` per frame.** R-1 mitigation already says this; *make it a typed contract* — the writer task takes a `dict[str, float]` (the §6 `ParamFrame.params`) and produces exactly one VTS request. No code path may send a per-param request.
- **Hard-cap the writer at 60 Hz.** A monotonic clock sleep ensures the writer never sends faster than 60 messages/s even if upstream produces more.
- **Discrete events (hotkeys, prop spawn) go on a *separate* queue from the param-stream queue,** but both serialize through the same writer task. This prevents a hotkey burst from doubling the message rate during a frame.
- **Reconnect logic with exponential backoff in the writer.** If the websocket drops mid-stream (R-10 / pyvts #49 territory), the writer must reconnect and re-auth without restarting the sidecar.

**Warning signs:**
- VTS UI becomes laggy when the avatar is being driven (rotate/zoom in VTS becomes choppy)
- pyvts logs show "Connection closed" mid-session even with the user not touching anything
- Avatar params appear to "snap to a new value" instead of smoothly approaching it (frames being dropped at the VTS end)

**Phase to address:**
Skeleton Phase: **Renderer binding** (writer task design). The frame-batching contract is set here once, irreversibly.

**Severity:** Skeleton-blocker if violated; harmless if respected.

---

### Pitfall 5: Tag-parser tokenization breaks across LLM streaming boundaries

**What goes wrong:**
The action_extractor decorator parses `[joy]`, `[shy]`, `[hold-mic]`, `[wave]` etc. from the LLM token stream. LLM providers (LM Studio in particular for local models) emit tokens with no respect for word/punctuation boundaries — `[joy]` may arrive as `[`, `jo`, `y]`, or `[joy`, `]`, or `[`, `joy]`. If the parser scans token-by-token, it will:
- Emit nothing for `[joy]` because the closing bracket arrives in the next token
- Emit `[joy` or `joy]` as plain text into the chat panel
- Treat partial tags as text and forward `[jo` to TTS where it gets pronounced as "open-bracket joe"

Same risk on `[hold-mic]` (the hyphen lands on a tokenization boundary in many BPE vocabularies).

**Why it happens:**
OLVT's pipeline buffers at the *sentence* level (pysbd) — tags inside a sentence are extractable once the sentence is whole. But the tag-extractor must run *before* sentence boundary detection on streaming text, or the chat panel won't show the tag-stripped text in real time. There's an inherent layering tension and OLVT solves it by buffering text until the next sentence-terminator before extracting.

**How to avoid:**
- **Buffer-then-extract, not extract-while-streaming.** Maintain a rolling text buffer in the orchestrator; do not run the tag extractor on individual deltas. Run it whenever pysbd reports a complete sentence boundary (or a sentinel like a bracket-paired pattern is closed). This is OLVT's pattern — port it as-is, don't optimize.
- **Stripping the bracket-pair regex must be greedy across the *entire buffered sentence*, not the latest delta.** A simple `re.sub(r'\[[a-z\-]+\]', '', sentence)` after sentence completion is correct.
- **Test fixtures with adversarial token boundaries.** Concretely: a `LLMStreamFake` that splits `[joy]` into `[`, `jo`, `y]` (3 deltas) and `[hold-mic]` into `[hold`, `-`, `mic]` (3 deltas). If TTS audio for those test cases includes any bracket character, the test fails.
- **Treat unmatched `[` until the next whitespace as "text in progress, hold from TTS but show as text-with-cursor in chat."** Avoids the open-bracket-pronounced bug.

**Warning signs:**
- TTS pronounces "joy" or "open bracket joy close bracket" or "joy bracket" inside a sentence
- Chat panel briefly shows `[jo` then the rest of the tag, instead of seamlessly stripping
- Action compositor receives a tag every 5th sentence instead of every sentence

**Phase to address:**
Skeleton Phase: **Conversation orchestrator port** (sentence_divider + actions_extractor). The OLVT version handles this; the skeleton's port must not "improve" it by streaming-extract.

**Severity:** Skeleton-blocker for success criterion #2 (the `[joy]` → fade-in test). If tags break, the headline demo fails.

---

### Pitfall 6: Reasoning-model `<think>` blocks confuse the sentence pipeline and leak into TTS

**What goes wrong:**
LM Studio defaults are increasingly reasoning models (DeepSeek R1 distills, Qwen3-Reasoning variants). These emit `<think>...</think>` blocks at the *start* of every response. If the sentence pipeline treats this as ordinary streaming text, three failure modes appear:
- pysbd hits a period inside the `<think>` block and emits a "sentence" of internal reasoning to TTS — the avatar reads internal thought aloud
- The action_extractor picks up an `[option]`-shaped substring inside the reasoning and fires a wrong-context expression intent
- The chat panel shows the model's chain-of-thought as primary message text instead of in a collapsible reasoning section (§5.1 promises a per-message expand chevron specifically to keep this *out* of the main flow)

§5.1 captures the contract — "reasoning blocks captured into a separate stream tagged for the chat UI's per-message expand chevron — never sent to TTS" — but the skeleton port has to actually implement the split. Easy to miss because LM Studio's *default* model often isn't a reasoning model, so dev-time testing may not surface the bug until the user picks DeepSeek-R1.

**Why it happens:**
LiteLLM's OpenAI-compatible bridge for LM Studio exposes the raw streamed deltas including `<think>` tags as part of the content stream — there is no LiteLLM-level field that separates `reasoning_content` from `content` for LM Studio (LM Studio's OpenAI-compat endpoint emits `<think>` in the `content` field, unlike DeepSeek's official API which uses a separate `reasoning_content` field). LiteLLM passes through whatever LM Studio emits.

**How to avoid:**
- **Strip `<think>...</think>` blocks at the orchestrator's input boundary, before sentence_divider sees the stream.** A streaming state machine: when in-think mode, accumulate into the reasoning side-channel; when the closing `</think>` arrives, switch back to normal content.
- **Test fixture with a DeepSeek-R1 distill** even though LM Studio's first-time-user default is something else. If the skeleton can't render a reasoning model cleanly, "LM Studio default" silently means "non-reasoning models only," which is a UX surprise.
- **The reasoning side-channel is just a string buffer in the WebSocket-out message** — UI implementation can be deferred to a later milestone, but the parser split must be in place from day one or the bug surfaces invisibly when a user changes models.
- **Do not assume the OpenAI `reasoning_content` field will save you.** Verify per-provider — Anthropic's extended thinking uses content blocks of type `thinking`; LM Studio's local-model wrapping is `<think>` in content; DeepSeek's hosted API uses a separate field. LiteLLM normalizes some of this but not all.

**Warning signs:**
- Avatar reads "let me think about this. The user said hello, so I should..." aloud
- Action compositor fires expressions that don't match the spoken sentence
- Chat panel's primary message contains reasoning before the actual answer

**Phase to address:**
Skeleton Phase: **Conversation orchestrator port** (specifically, the LLM gateway → orchestrator boundary). Ship the `<think>`-strip even if the chat-UI side panel is deferred.

**Severity:** Latent skeleton-blocker. Doesn't break the LM-Studio-default Llama-3-8B path; breaks immediately when a user picks a reasoning model.

---

### Pitfall 7: Hot-reload reading half-written `personality.md` / `intentMap.json` produces broken parser state

**What goes wrong:**
Skeleton ships hot-reload of `teto_overrides.yaml` (per PROJECT.md) — the per-avatar override stub. Editors save in two phases on Windows (atomic-rename via `.tmp` *or* truncate-then-write depending on editor). chokidar fires `add`/`change` *as the file appears*, which for truncate-then-write editors can be when the file is empty or partially written. Result: hot-reload reads `intentMap.json` with `{` and a few keys, parser raises `JSONDecodeError`, the previously-loaded config is preserved (per §5.4) — but only if the parser's exception is caught precisely. If the parser is in an `async` task and the exception escapes, the watcher's task crashes silently and *no further reloads work this session*.

Same issue applies to YAML for `teto_overrides.yaml` and `voice.yaml`.

**Why it happens:**
This is chokidar's documented race condition (issues #189, #1112). The `awaitWriteFinish` option exists specifically for this and is *not on by default*. On Windows, additionally, the `change` event sometimes fires before the OS fully releases the write handle, so even a fully-written file can be unreadable for ~50ms after the event.

**How to avoid:**
- **Enable `awaitWriteFinish` with `stabilityThreshold: 200, pollInterval: 50`** in the chokidar config (Electron-side). This is non-default and easy to forget.
- **Wrap every parse in a try/except that returns the previous config silently and surfaces a single toast** — never re-raises into the watcher task. Test by hand: open the file, type a `}` somewhere wrong, save, observe the avatar keeps running.
- **Validate parsed config against a Pydantic/Zod schema** before swapping the live config. A successful JSON parse with a missing key is just as harmful as a JSONDecodeError; the schema check makes "valid but wrong" loud.
- **Wait one frame after the parse succeeds before swapping the live reference** so the compositor doesn't see a half-built object during the assignment. (Atomic in Python because of GIL, but YAML/JSON-as-objects is not necessarily atomic at the dict level depending on how you build it.)
- **For the Python-side watchdog watcher** (mirroring chokidar on the sidecar), use the equivalent debounce — `watchdog`'s `PatternMatchingEventHandler` has no native debounce; wrap it.

**Warning signs:**
- After saving the override file once, subsequent saves are ignored (silent watcher-task crash)
- Toast appears intermittently with "Config parse error" even though the file looks fine
- Editor on Windows: save in VS Code works; save in Notepad triggers the bug (different write strategies)

**Phase to address:**
Skeleton Phase: **Hot-reload watcher setup** (concurrent with override-file scaffold). PROJECT.md commits to shipping the `teto_overrides.yaml` stub — the watcher that reads it must handle the half-write race from day one or hot-reload is broken in dev.

**Severity:** Skeleton-protective. Doesn't block the demo; but the moment a developer edits a config during a live session and watches the avatar fail to update, the skeleton looks unstable.

---

## Pyvts at 60 Hz: Specific Failure Modes

The skeleton's whole motion story rides on `pyvts.InjectParameterDataRequest` at 60 Hz. Three concrete pyvts/VTS-API failure modes beyond #3 and #4 above:

### Pitfall 8: Parameter ownership conflict — VTS face-tracker still owns `ParamAngleX` when the plugin tries to "set"

**What goes wrong:**
`InjectParameterDataRequest` defaults to `mode: "set"`, which takes exclusive ownership of the parameter ID. If VTS's built-in face tracker (or another plugin, or VTS lipsync if the user enabled it) already owns `ParamAngleX`, the injection request *errors* — and pyvts's default behavior is to log the error and continue. The compositor thinks it's driving the param; nothing moves. This is the OLVT Phase 4 trap of "writes seemed to go through but model is dead" with a different root cause than orphan-param.

**Why it happens:**
The VTS API's "only one plugin can `set` a parameter" rule (DenchiSoft wiki) is plugin-vs-plugin; but VTS's *internal* face tracker also takes effective ownership unless its weight is zero or the parameter isn't bound to tracker input. In practice, Teto's `ParamAngleX` is fed by the face tracker by default — even with no webcam, VTS may still hold the param at zero. The plugin's `set` then conflicts.

**How to avoid:**
- **Use `mode: "add"` for the speech driver and idle baseline overlays** — these are additive contributions, not absolute setters. Multiple plugins can use `add` simultaneously without conflict. This also matches the compositor's mental model (drivers are blended, not exclusive).
- **Use `mode: "set"` only for the intent-overlay layer when an `[joy]` blend is active** and the design genuinely wants tracker-override behavior — and document this in the renderer binding code.
- **Use the `weight` field (0..1) for fade-in/fade-out of intent overlays** (per the VTS API). Driving `weight` from 0 → 1 over 300ms is exactly the success-criterion-#2 smooth fade and avoids any "set vs face-tracker race" because at weight 0 the tracker still controls the param.
- **Verify on first connect that the face tracker is in a known state** (typically: no webcam connected during dev means tracker idle; once a user has a webcam, plugin and tracker compete). Document the "VTS-must-have-webcam-disabled-OR-tracking-stopped" assumption explicitly in the dev README.

**Warning signs:**
- Compositor logs show successful frame writes but avatar is motionless
- Disconnecting the webcam in VTS suddenly makes the avatar respond
- Demo on the engineer's machine works; demo on a teammate's machine with active webcam doesn't

**Phase to address:**
Skeleton Phase: **Renderer binding + speech driver**. Decide `set` vs `add` per layer; bake into the writer's per-frame request builder.

**Severity:** Skeleton-blocker on machines where any face tracker holds parameters by default. Easy to fix once known; very disorienting until known.

---

### Pitfall 9: 1-second re-injection rule — drivers that go quiet drop their parameters back to defaults

**What goes wrong:**
VTS API rule: "re-send data for a parameter you want to control with your plugin at least once every second." If the speech driver is silent (no TTS audio playing) and stops emitting frames for `ParamAngleXIN`, after ~1 second VTS marks the parameter "lost" and reverts to its previous control source (face tracker or default). Symptom: the moment TTS stops, the avatar's body sway *snaps* to default rather than smoothly easing back, because the parameter ownership was lost mid-transition rather than smoothly weight-faded out.

**Why it happens:**
The compositor's mental model is "if no driver contributes to a param, just don't write it." VTS's mental model is "if a plugin stops writing, ownership is released." These conflict when a driver fades out gradually.

**How to avoid:**
- **The compositor must *always* produce a frame for every param it has touched in this session,** even if the value is the rest-state. The writer keeps writing the rest-state value at low frequency (every 500ms) to retain ownership.
- **Alternative: the compositor emits a tombstone** (`{"ParamAngleXIN": None}` semantically) which the writer translates to "release ownership cleanly via `weight: 0` + one final `set`." Whichever pattern is chosen, *do not just stop writing.*
- **Define the rest state explicitly** for every param the compositor can touch (typically 0.0 for most rotations, but varies for body params on rigs with non-symmetric rest). Persist into `teto_overrides.yaml`.

**Warning signs:**
- Body sway snaps back to neutral the moment the avatar finishes a sentence (instead of easing)
- Idle baseline params suddenly jerk after a long pause in the conversation
- Adding `time.sleep(2)` in a debug script makes the avatar visibly twitch

**Phase to address:**
Skeleton Phase: **Compositor → writer contract** (specifically the writer's "what does an empty driver-set frame look like" decision).

**Severity:** Skeleton-blocker for criterion #4's "no flat moments" — the snap is a visible flat moment. Trivially preventable once known.

---

### Pitfall 10: VTS auth-token storage and the "Remember" checkbox

**What goes wrong:**
R-10 in §15 covers the user-facing version. Pitfall version: pyvts stores the auth token to disk by default, but if the storage path is somewhere outside the app's data dir (pyvts default is CWD-relative `./pyvts_token.txt`), every launch from a different CWD re-prompts. In an Electron+Python sidecar, the sidecar's CWD may vary by how Electron starts it (dev mode vs packaged), so the token lives in different places on dev runs vs prod runs — meaning the user is re-prompted on every dev/prod boundary.

**Why it happens:**
pyvts's `vts_api_info["token_path"]` is configurable but the default lives wherever Python was invoked. Electron-spawned Python from `node:child_process.spawn` has `cwd` set to whatever Electron passes (often the app dir, which differs in dev vs packaged builds).

**How to avoid:**
- **Explicitly set `pyvts.vts.VTS(token_path=...)` to a known per-user data dir** (`%APPDATA%/AgenticLLMVTuber/vts_token.json` on Windows, equivalent XDG path on Linux/Mac). Do this in the sidecar's startup, not config.
- **Never rely on relative paths inside the sidecar** — always resolve via Electron-passed `process.env.USER_DATA_DIR` or Python's `platformdirs`.
- **On first connect failure, prompt user to check "Remember" in VTS** (R-10 mitigation already calls this out — make sure the prompt fires *only* on first-run, not on every dev restart, by checking whether the token file exists).

**Warning signs:**
- "Allow plugin?" popup in VTS appears every time the sidecar restarts
- Token file appears in the project root or Python sidecar dir during dev (should be in user data dir)

**Phase to address:**
Skeleton Phase: **Python sidecar bootstrap**. Token-path config is a one-line decision; getting it wrong means a permanent UX papercut for the dev team.

**Severity:** Nice-to-avoid. Doesn't block skeleton ship but every dev run starts with a popup if missed.

---

## Electron + Python Sidecar Lifecycle Pitfalls

The skeleton specifically uses eager-start + watchdog (PROJECT.md). Three concrete traps:

### Pitfall 11: Python sidecar orphaned after Electron crashes — port 8000 (or whatever the sidecar binds) stays held

**What goes wrong:**
Standard Electron + Python pattern: spawn Python via `child_process.spawn`, kill on Electron exit. On Electron normal close this works (SIGTERM on POSIX, hard-kill equivalent on Windows). On Electron *crash* — segfault in the renderer, force-quit from Task Manager, hard reboot — the Python sidecar keeps running. Next Electron launch tries to bind the sidecar's port and fails with `EADDRINUSE` / `WinError 10048`. Since the skeleton's spawn-and-watchdog logic is naive, the user sees "sidecar failed to start" with no recovery path other than hunting the orphan process in Task Manager.

**Why it happens:**
Windows has no SIGCHLD-cleanup-on-parent-death equivalent. Linux/Mac have `prctl(PR_SET_PDEATHSIG)` and process-group tricks but not portable. Electron's `child_process` defaults don't enable any cross-platform "die when parent dies" mechanism.

**How to avoid:**
- **Detached process group + tree-kill on Electron exit (graceful path).** Spawn with `detached: true` (POSIX) or job objects (Windows via `node-windows-kill-tree` / explicit PowerShell `Stop-Process -Force`).
- **Sidecar self-terminates if its parent dies.** Python sidecar inspects its parent PID at startup via `psutil.Process().parent().pid` and polls every 5s; if the parent is gone, exit. This is the only crash-safe pattern on Windows.
- **Pre-flight port check on Electron startup.** If the configured port is already bound by *something*, attempt a friendly handshake first ("are you our orphan sidecar from last time?" — use a known auth header). If it's our sidecar, reuse it. If it's a stranger, surface a clear error to the user with the port number.
- **Use `port: 0` and read back the actual port** if the user-facing UX permits. Sidecar prints port-actually-bound to stdout; Electron parses and connects. Avoids hardcoded-port collisions entirely. The skeleton's WebSocket-protocol-shape-matches-OLVT requirement (PROJECT.md) does *not* mandate a specific port — only the protocol shape. So `port: 0` is on the table.
- **Bind to `127.0.0.1` not `0.0.0.0`.** Localhost-only per §10. Reduces firewall prompts on Windows.

**Warning signs:**
- After a force-quit, the next launch fails with "port in use" (or sidecar is silently not running)
- Task Manager shows multiple `python.exe` instances after several dev iterations
- `netstat -ano | findstr :8000` (or whatever port) shows a held port owned by a no-longer-Electron process

**Phase to address:**
Skeleton Phase: **Sidecar lifecycle and watchdog**. This is where the spawn/kill contract is fixed.

**Severity:** Skeleton-blocker for any user who has ever crashed Electron. Will hit dev within 24h.

---

### Pitfall 12: Hot-reload-during-development double-spawning the sidecar

**What goes wrong:**
Vite/electron-vite hot-reloads the renderer. Electron main *can* hot-reload via electron-forge or nodemon — and if it does, every reload spawns a new Python sidecar without killing the previous one. After 5 reloads in 10 minutes you have 5 Python processes, only the latest connected to the latest renderer, rest holding pipes/sockets.

**Why it happens:**
Hot-reload shortcut paths are designed to restart the renderer fast; they don't always cleanly tear down `child_process` handles. If the dev wires the spawn into the main process at module-init time, every main-process reload re-spawns.

**How to avoid:**
- **Spawn the sidecar inside `app.whenReady()` only**, never at top-level module-init. Hot-reload of the main process should re-trigger `whenReady`; pair with explicit kill-old-on-spawn-new.
- **Singleton pattern with PID file in user data dir.** On spawn attempt, check the PID file; if a process at that PID exists and responds to a health-check ping, reuse; else clean up and spawn fresh.
- **In dev, default to spawning Python from venv directly** (not via PyInstaller, which is deferred per PROJECT.md anyway). Restart cycle is faster and the orphan-process problem is the same regardless of packaging.

**Warning signs:**
- After 30 minutes of dev, `ps`/Task Manager shows 4-7 `python.exe` instances
- Memory usage of the dev environment grows monotonically
- Saves take longer to take effect (because the renderer reconnects to a stale sidecar)

**Phase to address:**
Skeleton Phase: **Sidecar lifecycle and watchdog** (same as #11).

**Severity:** Nice-to-avoid for the team's dev experience; not user-facing.

---

### Pitfall 13: Sidecar crash leaves the UI alive but mute — no error surfaced

**What goes wrong:**
Sidecar segfaults (e.g., piper ONNX runtime crash, pyvts websocket exception escapes the writer task). Electron renderer is unaffected; UI is fully responsive; chat input still accepts text; LLM streaming may even partially work because LiteLLM lives client-side... wait, no, LiteLLM is server-side per §5.5. Without the sidecar, the user types "hello" and sees nothing. No error toast, no avatar reaction, just dead silence. The watchdog *should* restart the sidecar but if the watchdog is naive ("if process exited, respawn") it loops forever on a deterministic crash.

**Why it happens:**
The skeleton doesn't have crash-recovery from §5.12 yet (deferred). The watchdog is the only safety net.

**How to avoid:**
- **Watchdog with crash-loop detection.** If the sidecar dies more than 3 times within 30 seconds, stop respawning and surface a UI banner: "Backend unavailable. Logs at <path>." Don't just keep spinning.
- **Heartbeat ping on the WebSocket every 5 seconds.** Renderer detects stale heartbeat and shows a "reconnecting" indicator. If reconnect fails for 30s, escalate to a banner.
- **Capture sidecar stdout/stderr to a rolling log file** (in user data dir). When the banner appears, link to "Open logs" — gives the user (and dev) something to do.
- **Specifically guard the pyvts writer task** with a top-level except that logs and continues, *not* one that propagates and kills the asyncio loop. The orchestrator shouldn't die because VTS disconnected — it should fall back to "audio-only, no avatar motion" mode.

**Warning signs:**
- User types in chat and nothing happens (no error)
- Dev sees `python.exe` flickering up and down in Task Manager
- WebSocket logs show repeated reconnect-disconnect cycles

**Phase to address:**
Skeleton Phase: **Sidecar lifecycle and watchdog**. Crash-loop detection is the new policy; rest is wiring.

**Severity:** Skeleton-protective; without this, the first deterministic backend bug bricks the app for the user with no recovery message.

---

## Moderate Pitfalls

### Pitfall 14: piper cold start adds ~900ms to first-sentence latency unless warmed at app launch

**What goes wrong:**
First call to piper-onnx synthesis takes ~900ms longer than steady-state because ONNX Runtime does graph optimization and memory layout on first inference. R-18 acknowledges 200-500ms per piper call as steady-state; the *first* call after sidecar boot is significantly slower. Symptom: user types "hello" within 3s of launch, avatar appears mute for ~1.5s, then speaks. Looks broken.

**How to avoid:**
- **Synthesize a single-token throwaway at sidecar startup** (`voice.synthesize("a")`). Discard audio. Caches the ONNX session.
- Do this *after* the WebSocket "ready" message goes out, so the user can still type while warmup completes — but before the first real synthesis request is dispatched.
- Same trick for faster-whisper if/when ASR ships (out of skeleton scope per PROJECT.md, but the pattern generalizes).

**Warning signs:** First reply takes noticeably longer than subsequent replies of similar length.

**Phase to address:** Skeleton Phase: **TTS pipeline build**. Trivial to add; trivial to forget.

**Severity:** Skeleton-protective for first-impression UX.

---

### Pitfall 15: LiteLLM + LM Studio first-call timeout when model isn't pre-loaded

**What goes wrong:**
LM Studio's OpenAI-compatible server lazy-loads models on first request. If the user installed LM Studio, picked a model, started the server, but never did a "warm" request, the first LiteLLM call takes 30-60s to load the model into VRAM. LiteLLM's default per-request timeout (and httpx's default) is short enough that this can fail outright, not just feel slow. Documented by [LM Studio bug-tracker #944](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/944): 300s timeout in some configurations.

**How to avoid:**
- **Send a 1-token warmup `chat.completions.create` to LM Studio at sidecar startup,** with a generous timeout (120s). UI shows "Connecting to LLM..." until this returns.
- **In the LLM setup screen** (mandatory per PROJECT.md), the "Test connection" button should make a real completion call (not just a `/v1/models` list — that returns instantly even when no model is loaded). Surface clear error if the model isn't actually loadable.
- **Configure LiteLLM with explicit `timeout=120`** for LM Studio specifically. Most providers don't need this, LM Studio does.
- **Guard against HTTP/2 pinning issues** ([LM Studio bug-tracker #24](https://github.com/sunilnatraj/llm-extension/issues/24)): force HTTP/1.1 on the httpx client used for LM Studio if a 60s timeout is hit. Probably unnecessary at default LiteLLM but easy to forget.

**Warning signs:** "Test connection" passes, first real chat times out. Or: the user reports "it worked in dev but not on my machine."

**Phase to address:** Skeleton Phase: **LLM gateway + setup screen**.

**Severity:** Skeleton-blocker for criterion #1 ("user types hello → avatar speaks reply"). Will hit any user who launches LM Studio first time or restarts it.

---

### Pitfall 16: piper sentence-buffered playback — `sounddevice` underruns when first chunk is queued before the device is ready

**What goes wrong:**
Sentence-buffered TTS: piper synthesizes sentence 1, queues chunk to sounddevice OutputStream, simultaneously starts synthesizing sentence 2. If the first chunk lands at sounddevice before the stream's first callback has fired, you get a buffer underrun — audible click/pop at the very start of the first reply. Documented in `python-sounddevice` issues (e.g., #347 crackling, #98 latency setup).

**How to avoid:**
- **Start the sounddevice OutputStream at sidecar boot** (during piper warmup), not at first-utterance time. Pre-warmed stream means no startup transient.
- **Use `latency='high'` for the OutputStream** — slightly higher latency (~50ms more) is invisible in conversation but eliminates underruns.
- **Sample-rate mismatch is silent and ugly** — always pin the OutputStream sample rate to the piper voice's sample rate (`voice.config.sample_rate`, typically 22050). Default device sample rate is 44100/48000; mismatch causes pitch shift and crackle.
- **Use the user-picked output device from settings** — but in the skeleton, the device picker is out of scope, so default to the system default and fail loudly if it's None.

**Warning signs:** First reply starts with a pop or click; subsequent replies are clean.

**Phase to address:** Skeleton Phase: **TTS pipeline + audio output**.

**Severity:** Nice-to-avoid; cosmetic but very noticeable.

---

### Pitfall 17: Sentence-buffered TTS ordering bug when synthesis times vary per sentence

**What goes wrong:**
Parallel synth + ordered playback (§5.6, OLVT pattern). If sentence 1 is long (slow synth) and sentence 2 is short (fast synth), sentence 2 finishes synthesizing first. The naive "play whichever finishes first" pattern plays them out of order. The fix is an indexed queue with sequential drain — but if the drain logic uses a simple `queue.get()` instead of "wait until index N is ready, then play, then increment to N+1," the bug surfaces when one sentence has unusual length (long word, complex phonetics).

**How to avoid:**
- **Indexed slot queue, not FIFO.** Each synth task writes to `slots[i]`; the playback loop polls for `slots[next_to_play]`, plays it, increments. Out-of-order completion is fine; out-of-order *playback* is impossible.
- **Test fixture: 3 sentences with deliberately varied synth time** (one with rare characters, one short, one with whisper voice if applicable). If they play in original order, pass.
- **Bound the slot array** so a stuck synth task doesn't block forever — timeout at e.g. 10s, mark slot as failed, skip with a TTS error toast.

**Warning signs:** Avatar speaks sentences in wrong order under heavy load. Or: a long sentence synthesizing causes the *next* one to play first, not just delayed.

**Phase to address:** Skeleton Phase: **TTS pipeline build** (the OLVT pattern port specifically — getting the queue right is the whole exercise).

**Severity:** Skeleton-blocker if encountered; visibly broken.

---

## Technical Debt Patterns

Acceptable shortcuts vs. ones that come back to bite.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode VTS connection params (port 8001, model name) in skeleton | Skips settings UI for skeleton scope | Settings UI becomes painful retrofit if the connection layer assumes hardcoded values | Acceptable IF the connection function takes them as arguments and only the *call site* hardcodes them. Never hardcode inside the pyvts wrapper. |
| Skip `awaitWriteFinish` in chokidar config | "It works on my machine" with VS Code | Bug surfaces on user's machine with a different editor; takes hours to reproduce | Never acceptable. One-line fix. |
| Use `mode: "set"` everywhere in pyvts injection | Simpler driver code | Conflicts with face tracker, requires user to disable webcam to demo | Never. Compositor is by design additive; use `mode: "add"` with `weight`. |
| Run sidecar with hardcoded port | Easier to reason about during dev | Orphan-port collisions on every Electron crash | Acceptable only with the orphan-detection handshake (Pitfall 11); otherwise switch to `port: 0`. |
| Skip the `<think>` block stripper (LM Studio default isn't reasoning-model) | Save 30 min porting | Latent bug that triggers when user changes models; impossible to debug from logs alone | Never. The orchestrator's input is the canonical place to handle this. |
| Defer the smoke-pass tooling (just hand-test on Teto) | Skeleton is one-rig only | Per-avatar override file's "discovered orphans" list is empty/wrong, and the import-pipeline milestone has nothing to inherit | Acceptable for skeleton — PROJECT.md explicitly defers smoke-pass tooling. But ship the override-file *schema* so import-milestone has a target. |
| Skip parameter rest-state continuous-write (just stop writing when driver is silent) | Half the code in the writer | VTS reverts to face-tracker mid-fade; visible snap | Never. Continuous low-rate rest-state writes preserve ownership. |
| Use pyvts unmodified despite issue #51 | No vendor/fork burden | Compositor + TTS deadlock under concurrent use | Acceptable IF the single-writer pattern is enforced (only one async task ever calls pyvts); otherwise must vendor/fork. |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **VTube Studio API** | Default `mode: "set"` for all injections | `mode: "add"` for ambient/speech drivers; `mode: "set"` only for intent overlays with `weight` fade |
| **VTube Studio API** | One `InjectParameterDataRequest` per parameter | One request per *frame* with all params batched (R-1 mitigation, enforced contractually in writer) |
| **VTube Studio API** | Stop writing a param when no driver contributes | Continuous low-rate rest-state write retains ownership |
| **pyvts** | Concurrent calls from compositor + TTS-features-tap + UI-event handler | Single-writer task owning the pyvts client; everything else queues |
| **LM Studio** | Use `/v1/models` as a connection-test (returns OK even if no model loaded) | Use a real 1-token completion as the test |
| **LM Studio** | Default LiteLLM timeout (~30s) on first call | Bump to 120s for LM Studio specifically; warmup at sidecar boot |
| **LiteLLM** | Assume `reasoning_content` field exists for all providers | Per-provider reasoning extraction: Anthropic uses `thinking` content blocks; LM Studio emits `<think>` in `content`; DeepSeek uses `reasoning_content`. Strip at orchestrator input. |
| **LiteLLM streaming** | Treat first-chunk as guaranteed-success after `200 OK` | Critical errors (context window, rate limit) surface in *first chunk* of stream, not as HTTP error. Inspect first chunk's `error` field. |
| **piper** | Synthesize on first request without warmup | Synthesize "a" at sidecar boot to pre-load ONNX |
| **piper** | Mismatched sample rate between piper and sounddevice OutputStream | Pin OutputStream sample_rate to `voice.config.sample_rate` |
| **chokidar** | Default options (no `awaitWriteFinish`) | `awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }` |
| **child_process.spawn** (Electron) | No detached-on-parent-death policy | Sidecar self-polls parent PID; Electron kills tree on graceful exit |
| **FastAPI uvicorn** | Bind to 127.0.0.1 (correct) but assume IPv6 mapping works | Bind to 127.0.0.1 explicitly; if the renderer connects via "localhost" hostname, it may resolve to ::1 first. Use 127.0.0.1 in URLs end-to-end. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-param `InjectParameterDataRequest` instead of batched | Avatar laggy; VTS UI sluggish | Frame-batched writer | At >10 driven params (skeleton has ~10) |
| Compositor frame-build allocating dicts in hot loop | CPU pegged at 60Hz on idle | Pre-allocated `ParamFrame` reused; mutate in place | Felt at second hour of dev; full skeleton |
| pysbd called on every streaming token | Token latency stalls | Buffer tokens; call pysbd only on punctuation candidates | Felt at long replies (>200 tokens) |
| Audio RMS computed in main thread alongside compositor | Compositor frame jitter | RMS in dedicated task; compositor reads latest value | Felt at first speech-driver test |
| Logging at DEBUG level inside the 60Hz writer | Disk I/O blocks WS sends; param drops | DEBUG logging guarded by env var; INFO and above only in steady-state | Felt during dev with verbose logging |
| Action compositor sleep-driven instead of monotonic-clock-driven | Drift accumulates; "60 Hz" actually 55 Hz on busy systems | `asyncio` scheduled with `loop.call_later` aimed at next 16.67ms boundary, not `await sleep(0.016)` | Felt under CPU load (e.g., model loading in LM Studio) |

---

## Security Mistakes

Localhost-only architecture per §10 sidesteps most of OWASP. Domain-specific issues:

| Mistake | Risk | Prevention |
|---------|------|------------|
| WebSocket between Electron and sidecar has no auth | Any local app or browser tab can connect to the sidecar and drive the avatar / read chat history | Generate a random token at sidecar startup; pass to renderer via Electron IPC; require token on every WS connect. Bind to 127.0.0.1 only. |
| pyvts auth token stored in a path readable by other users | Cross-user privilege if multi-user system | Per-user data dir (`%APPDATA%`/`~/.local/share`), permissions 600 |
| LM Studio API key (when configured for cloud-OpenAI-compatible) logged on connection failure | Key leaks to log file → bug report → public | Redact `Authorization` headers from all log output; integration tests assert no secret-shaped strings in logs |
| Renderer reads arbitrary file paths via Electron IPC for "load avatar config" | Out of skeleton scope but worth noting now | When the import-pipeline milestone lands, IPC must validate paths against the avatar dir allowlist |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Connection failure to VTS shown as "Error" with no remediation | User assumes app is broken | Specific message: "Open VTube Studio, enable API in Settings, and restart this app" + link |
| First-sentence latency >1s with no indicator | User retypes their message | Buffering indicator after sentence appears in chat (R-18 mitigation, do not skip in skeleton) |
| Avatar dead-silent when LLM streams `<think>` | User assumes app is frozen | Show "thinking..." placeholder during reasoning blocks (skeleton: minimum is the reasoning side-channel even without UI surfacing) |
| `[joy]` tag fires expression after sentence has finished playing | Visible disconnect between voice and face | Action timestamps tied to sentence playback start, not sentence-finished-synth |
| Avatar tracks cursor when cursor is over chat input (not over canvas) | Distracting eye dart | Cursor-tracking only when cursor is inside canvas bounds; smooth re-center on exit |

---

## "Looks Done But Isn't" Checklist

End-of-skeleton verification — things that pass smoke-test but fail the success criteria.

- [ ] **`[joy]` tag handling:** verify with adversarial token boundaries (`[`, `jo`, `y]`) — not just whole-token tests
- [ ] **Body sway:** verify with a sentence >5s long that the body actually moves throughout, not just at the start; verify it eases out smoothly, doesn't snap
- [ ] **Cursor tracking:** verify with cursor *outside* the canvas — eye should not wildly dart; should ease back to center
- [ ] **Idle baseline:** leave the app open for 60s with no input; blink schedule and head drift should remain visible (not freeze; not become identical loop)
- [ ] **Hot-reload:** edit `teto_overrides.yaml` with a deliberate syntax error; save; observe avatar keeps running and toast appears; fix; save; observe new config takes effect
- [ ] **Sidecar crash recovery:** kill the Python process from Task Manager mid-conversation; observe banner appears; observe sidecar restarts; observe chat is not corrupted
- [ ] **Reasoning model:** switch LM Studio to a DeepSeek-R1 distill; observe `<think>...</think>` does not reach TTS; observe expressions only fire on the post-think content
- [ ] **First reply latency:** force-quit and relaunch; type "hello" within 5s; first reply should arrive within 3s including TTS first-sentence playback (warmup actually fired)
- [ ] **VTS auth re-prompt:** quit normally; relaunch; observe no "Allow plugin?" popup (token-path is correct)
- [ ] **Port collision:** force-quit Electron via Task Manager (not graceful close); immediately relaunch; observe sidecar starts cleanly (orphan-handling worked)
- [ ] **WebSocket protocol shape parity with OLVT:** diff the message shapes for `{audio_bytes, display_text, actions}` etc. against OLVT's reference; differences must be intentional and documented (success criterion #6)
- [ ] **Compositor isn't holding stale state:** disconnect VTS via VTS UI mid-conversation; wait 10s; reconnect — avatar resumes without weirdness
- [ ] **piper sample-rate match:** record output and verify pitch matches reference TTS samples (no chipmunk effect)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| pyvts deadlock under concurrent use (#3) | LOW (1 day if caught early; HIGH if late, requires writer-task refactor) | Refactor to single-writer pattern; everything else queues |
| Body sway is silently head-only on Teto rig (#1) | LOW if treated as research; HIGH if surface-promised | Take the documented head-only fallback; ship rationale; defer to next milestone |
| Tag parser breaks on token boundary (#5) | LOW | Re-implement OLVT's buffer-then-extract pattern; add adversarial test |
| `<think>` blocks leak into TTS (#6) | LOW | Add streaming `<think>`-strip state machine at orchestrator input |
| Half-written file crashes hot-reload (#7) | LOW | Enable `awaitWriteFinish`; wrap parser in try/except; never re-raise into watcher task |
| Orphan Python process holds port (#11) | LOW | Add port-handshake on startup; switch to `port: 0` if needed |
| Watchdog crash-loops (#13) | MEDIUM | Add 3-crashes-in-30s circuit breaker; surface log-link banner |
| Smoke pass reveals all body params orphan on a new rig | MEDIUM | Use the head-only + breathing/micro-shoulder fallback path; document in `<rig>_overrides.yaml` |
| Sentence playback ordering bug (#17) | LOW | Switch from FIFO queue to indexed-slot queue |

---

## Pitfall-to-Phase Mapping

Skeleton sub-phases (suggested ordering for the roadmap):

| # | Pitfall | Skeleton Sub-Phase | Verification |
|---|---------|--------------------|--------------|
| 1 | IN-twin assumption (body sway) | Speech-driver bring-up | Smoke-pass output recorded in `teto_overrides.yaml`; manual eyeball test on >5s sentence |
| 2 | Resolver silent on non-VTS | Renderer binding + ParamID resolver | Unit test: every common-set param resolves to non-empty target on active rig; non-VTS branch raises |
| 3 | pyvts sync-blocking | WebSocket protocol + pyvts wrapper | Concurrency test: compositor + simulated discrete event together for 60s, no `RuntimeError` |
| 4 | VTS rate-limit batching | Renderer binding (writer) | Wireshark/log: exactly one `InjectParameterDataRequest` per frame; rate ≤60/s |
| 5 | Tag-parser tokenization | Conversation orchestrator port | Adversarial fixture: split tags across deltas; no bracket char ever reaches TTS |
| 6 | `<think>` blocks | Conversation orchestrator + LLM gateway boundary | DeepSeek-R1 fixture: reasoning text never appears in TTS or main chat panel |
| 7 | Half-written file race | Hot-reload watcher setup | Manual: save broken YAML; app survives; fix; reload works |
| 8 | Param ownership conflict | Renderer binding + speech driver | Test on machine with active webcam; avatar still moves |
| 9 | 1-second re-injection rule | Compositor → writer contract | Pause TTS for 3s; observe smooth ease, not snap |
| 10 | VTS token path | Sidecar bootstrap | Restart sidecar 5x; auth popup appears 0 times after first |
| 11 | Orphan Python process | Sidecar lifecycle and watchdog | Force-quit Electron; relaunch immediately; sidecar starts clean |
| 12 | Hot-reload double-spawn | Sidecar lifecycle and watchdog | After 30 dev-iterations, only 1 `python.exe` |
| 13 | Sidecar crash banner | Sidecar lifecycle and watchdog | Kill Python from Task Manager; banner appears within 30s |
| 14 | piper cold start | TTS pipeline build | First reply ≤ avg-reply-latency + 200ms |
| 15 | LM Studio first-call timeout | LLM gateway + setup screen | Test connection requires real completion (not /v1/models) |
| 16 | sounddevice underrun | TTS pipeline + audio output | First reply audio: no click/pop in waveform |
| 17 | Sentence playback ordering | TTS pipeline build | 3-sentence varied-length fixture: plays in original order |

---

## Sources

**Verified — HIGH confidence:**
- [VTube Studio Plugins API wiki — DenchiSoft](https://github.com/DenchiSoft/VTubeStudio/wiki/Plugins) — InjectParameterDataRequest contract, weight/mode semantics, 1-second re-injection rule, "60+ FPS may cause performance issues" note
- [pyvts issue #51 — sending requests is actually blocking](https://github.com/Genteki/pyvts/issues/51) — confirms sync-blocking behavior under `asyncio.gather`
- [pyvts issue #49 — Websocket is close](https://github.com/Genteki/pyvts/issues/49) — connection stability issues
- [chokidar issue #189 — race condition in batch addition/deletion](https://github.com/paulmillr/chokidar/issues/189)
- [chokidar issue #1112 — race condition when watching dirs](https://github.com/paulmillr/chokidar/issues/1112)
- [chokidar `awaitWriteFinish` option docs](https://github.com/paulmillr/chokidar)
- [LM Studio bug-tracker #944 — 300 second timeout](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/944)
- [LM Studio bug-tracker #618 — incorrect API endpoint handling](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/618)
- [LiteLLM streaming + critical errors discussion](https://github.com/BerriAI/litellm/discussions/15910) — critical errors surface in first chunk of stream
- [LiteLLM LM Studio provider docs](https://docs.litellm.ai/docs/providers/lm_studio)
- [Anthropic extended thinking + streaming](https://docs.claude.com/en/docs/build-with-claude/extended-thinking) — `thinking` content blocks, signature_delta sequence
- [DeepSeek R1 thinking-mode docs (LM Studio blog)](https://lmstudio.ai/blog/deepseek-r1) — `<think>...</think>` token convention
- [Electron utility-process docs](https://www.electronjs.org/docs/latest/api/utility-process)
- [Electron issue #1815 — zombie processes on Windows](https://github.com/electron/electron/issues/1815)
- [Electron issue #16317 — orphaned process on Windows from child_process.fork](https://github.com/electron/electron/issues/16317)
- [python-sounddevice issue #347 — crackling with int32 arrays](https://github.com/spatialaudio/python-sounddevice/issues/347)
- [python-sounddevice issue #98 — latency configuration](https://github.com/spatialaudio/python-sounddevice/issues/98)
- [Piper TTS GitHub](https://github.com/rhasspy/piper) — confirms ~900ms first-inference penalty in ROS 2 / low-latency writeup
- [Live2D Cubism lipsync RMS docs](https://docs.live2d.com/en/cubism-sdk-manual/lipsync/)
- `PROJECT_DESIGN.md` §5.3.1 — primary source on VTS rig two-layer architecture (HIGH confidence on the failure modes catalogued; MEDIUM on whether the IN-twin recovery actually works on rigs other than Teto)
- `PROJECT_DESIGN.md` §15 R-1, R-10, R-18 — pre-existing risk register
- `PROJECT.md` R-OPEN-1, R-OPEN-2 — body-sway and mobile-portability open risks

**Verified — MEDIUM confidence:**
- [Open-LLM-VTuber repository / docs](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) — TTS sentence-buffered concurrency, emotionMap pattern
- [Open-LLM-VTuber TTS pipeline docs](http://docs.llmvtuber.com/en/docs/development-guide/backend/tts/)
- [Electron-with-Python sidecar packaging — w3tutorials](https://www.w3tutorials.net/blog/run-python-script-in-electron-app/) — ASAR + Python script unpacking; path resolution issues

**Inferred from design doc + general web ecosystem (LOW confidence — flagged):**
- The skeleton-specific phase ordering and the exact sub-phases (no canonical OLVT-port-skeleton phase taxonomy exists; this is opinionated for the roadmap)
- The "head-only fallback with breathing/micro-shoulder" alternative for body sway — sourced directly from PROJECT.md's R-OPEN-1 mitigation list, *not* independently validated as visually adequate
- Specific timing thresholds (`stabilityThreshold: 200`, `pollInterval: 50`, etc.) — sane defaults from chokidar examples; rig/editor-specific tuning may be needed

---

*Pitfalls research for: local-first desktop Live2D companion (walking-skeleton scope)*
*Researched: 2026-05-06*
