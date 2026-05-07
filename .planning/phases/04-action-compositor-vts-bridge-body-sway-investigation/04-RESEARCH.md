# Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation — Research

**Researched:** 2026-05-07
**Domain:** asyncio 60Hz tick scheduler · pyvts WS single-writer · VTS API parameter injection + hotkeys + expressions · Win32 cursor + window-bounds polling on Windows 11 (DPI-aware) · Perlin idle drift · pytest mocking of pyvts · RMS→param math + sentence-end signal · live-switch dev panel
**Confidence:** HIGH on VTS API surface and pyvts source path (verified against official spec + read of vendored `vts.py`); HIGH on Teto rig parameter mapping (read directly from `重音テト.vtube.json`); HIGH on pywin32/opensimplex versions; MEDIUM on asyncio jitter strategy (no Windows 11 60Hz benchmark exists; recommendation derived from Pitfall 17 / ARCHITECTURE.md and Python tracker issue #45194); MEDIUM on VTS window class name (Unity 6000 builds; runtime-discovery is the safe path); LOW on whether `proxy_param`-`Lean Forward` will produce visible body sway on Teto (this IS the open question Phase 4 is built to resolve — research can't pre-answer, only enumerate the test approach).

---

## TL;DR for the Planner

The ten most-binding technical decisions surfaced by this research:

1. **VTS API does NOT expose dynamic-strength expression activation.** `ExpressionActivationRequest` is on/off + `fadeTime` only. **`exp3_modulation` strategy CANNOT use the expression API** — it must pre-load the .exp3.json's body-pose parameter IDs and write them per-tick at RMS-derived strength via `InjectParameterDataRequest`. This is materially different from D-01 / 03-CONTEXT framing; the planner must lock a "load .exp3.json → param-ID list → tick-write" implementation.
2. **VTS rate-limit cap for InjectParameterDataRequest is undocumented.** The wiki specifies only the *minimum* (re-send ≥1 Hz to retain ownership). The 60+ FPS warning in the wiki is **specifically about `InputParameterListRequest` (read), not InjectParameterData (write)**. 60 Hz batched single-request writes are empirically safe but not contractually guaranteed — keep PITFALLS Pitfall 4's batching contract.
3. **pyvts issue #51 races at `vts.py:117-118`** — the code is `await self.websocket.send(...)` followed by `await self.websocket.recv()` inside `request()`. The fix is a dedicated read-loop coroutine that dispatches to per-`requestID` `asyncio.Event`/`Future` map; senders never call `recv()`. The vendored pyvts has 5 modules, ~520 LOC; **the patch is in-tree to `sidecar/vendor/pyvts/vts.py` per Phase 1 D-04**.
4. **All four `mode:"add"` writes pass `weight` but VTS ignores it** — official wiki confirms "weight values aren't used in `add` mode." For ambient + speech drivers the compositor sends raw deltas; the merge math is per-tick CPU-side accumulation, not VTS-side weighting. Only the intent driver (`mode:"set"`) honors weight, and that's what makes the 300ms `[joy]` blend work without face-tracker conflict.
5. **Compositor scheduler should be deadline-driven via `loop.call_later`, NOT `await asyncio.sleep(1/60)`.** PITFALLS Pitfall 17 explicitly calls this out; Python tracker issue #45194 confirms `asyncio.sleep` jitter accumulates as drift on Windows. Concrete pattern: monotonic `next_deadline = start + N * (1/60)` and `loop.call_later(max(0, next_deadline - loop.time()), tick)`.
6. **Single global compositor task; per-driver coroutines are pure functions called inside the tick.** Avoids cross-task synchronization. Driver merge order is `idle → speech → intent → cursor` with the per-param accumulator: `ambient` writes `mode:"add"` value, `speech` writes `mode:"add"` value, `intent` writes `mode:"set"` value+weight, `cursor` writes `mode:"add"` value. The single-writer pyvts task receives the merged `ParamFrame` (one dict per tick, max one InjectParameterDataRequest per tick) per Pitfall 4.
7. **Win32 cursor polling on Windows 11 must be DPI-aware.** Sidecar process must call `ctypes.windll.shcore.SetProcessDpiAwareness(2)` (PER_MONITOR_AWARE) at boot OR add a `app.manifest`. Otherwise `GetWindowRect` returns DPI-virtualized (96-DPI) coords while `GetCursorPos` returns physical pixels — the rectangle hit-test silently fails by the user's monitor scale (1.25× / 1.5× / 1.75×). This is THE silent-failure mode for AVT-10.
8. **VTS window class name is unity-engine-generic; FindWindow by title-suffix is the safer probe.** Unity 6000 builds use `UnityWndClass` for the main window. Title is "VTube Studio" (no suffix observed in current 1.32.71 builds, but title may include the loaded model name in some versions). Recommendation: probe by `EnumWindows` + match windows whose title `startswith "VTube Studio"`, not exact-match. Cache the HWND once at boot; reprobe every ~30s in case VTS restarts.
9. **opensimplex 0.4.5.1 is the right Perlin pick.** Pure-Python with NumPy hard-dep (already pulled by Phase 3); universal py3 wheel; one tiny package; deterministic via `seed=`. Hand-rolled is also fine (~30 LOC for 1D simplex) but opensimplex saves audit time and 0.4.5 has no behavior risks. **Skip `noise` package** (last release 2017; wheel issues on Windows; superseded).
10. **Sentence-end signal needs an explicit publish from TTSTaskManager.** Phase 3 D-14 fires `chain-end` after the LAST sentence's audio drains, but D-08 intent decay starts at PER-SENTENCE end. There is no per-sentence audio-complete signal in Phase 3's design today — the cleanest fix is a third asyncio.Queue (`compositor_sentence_complete_queue: asyncio.Queue[int]`) where TTSTaskManager publishes `sentence_id` when sentence N's audio drains. Phase 4 plan must **request a Phase 3 D-14 amendment** OR derive the boundary by extrapolation `started_at + len(volumes) * slice_length / 1000`. Extrapolation is fragile under sounddevice underrun; explicit signal is the load-bearing call.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Body-sway strategy slate (R-OPEN-1) — AVT-06**
- **D-01:** Strategy registry has three entries — `proxy_param`, `exp3_modulation`, `head_only`. `physics_chain` is dropped (memory: prior IN-twin trick failed on Teto; running it as runnable evidence is rejected).
- **D-02:** Head-only fallback flavor = head sway + breathing (`Auto Breath` if writeable) + micro-shoulder if any shoulder-region param accepts writes.
- **D-03:** Strategy selection at boot = hardcoded compositor default (`head_only`) + per-rig override in `avatars/teto/teto_overrides.yaml`. Schema: `body_sway_strategy: head_only | proxy_param | exp3_modulation`, `proxy_body_param: <name>`, `exp3_body_pose: <path>`.
- **D-04:** Per-strategy investigation evidence = (a) 5–10s screen recording, (b) matplotlib RMS-vs-param plot, (c) one-paragraph rating. Artifacts cited from `.planning/skeleton-verification.md` (Phase 5 SC-01).
- **D-05:** 04-00 smoke-pass priority body-sway-candidate parameters = `Lean Forward` + `Auto Breath`. Smoke-pass tests writes to both specifically AND scans full param list via `InputParameterListRequest`. Records visible-vs-orphan status into `teto_overrides.yaml`.

**Avatar look (idle + intent decay) — AVT-02, AVT-08**
- **D-06:** Idle baseline driver writes Perlin drift on head + eye-gaze + breathing (if writeable). Head: `ParamAngleX/Y/Z` Perlin drift, ~5° amplitude. Eye-gaze: `ParamEyeBallX/Y` Perlin drift, ~3° amplitude. Breathing: `Auto Breath` sine wave at ~0.25 Hz if writeable. Blink: random uniform 2.0–6.0s + 10% double-blink heuristic; ~150ms close + ~80ms open via `ParamEyeLOpen/ParamEyeROpen`.
- **D-07:** Blink cadence — random uniform 2–6s + 10% double-blink heuristic.
- **D-08:** Intent overlay decay = ease-out cubic 300ms in, hold for sentence duration, ease-out cubic ~600ms out. Decay starts at sentence-end (per-sentence), NOT chain-end. Per-sentence `ActionIntent`s are independent. Intent overlays are the only `mode:"set"` driver; ambient idle and speech driver use `mode:"add"`.

**Cursor tracker + DiscreteEvent — AVT-09, AVT-10**
- **D-09:** VTS window-bounds detection = sidecar Win32 polling at ~250ms via `pywin32` `FindWindow` + `GetWindowRect`. Cursor position from `GetCursorPos`. No renderer involvement on the hot path.
- **D-10:** Cursor tracking = 60Hz native + cubic 800ms ease-back + 80px dead-zone around face center. Polled at the same 60Hz as the compositor. Cursor → ParamAngle deflection math is planner territory.

**Strategy hot-switchability — investigation tooling**
- **D-12:** Body-sway strategy is live-switchable from a renderer dev-panel during the investigation phase. Adds a "Body-sway strategy" radio control to `apps/renderer/src/dev/DevPanel.tsx`. Selection sends a WS control envelope; sidecar's compositor swaps the active strategy at next compositor tick. Production-gated by `import.meta.env.DEV`.

### Claude's Discretion

- **D-11:** DiscreteEvent demo target — planner picks first non-meta hotkey from 04-00 smoke-pass. Recommend `Star Eye [7]` for visual punch.
- Compositor scheduler internals (asyncio pattern, jitter handling, single-task vs per-driver) — 60Hz target with ≤2ms jitter is implicit success bar.
- Driver merge math + precedence — AVT-03 locks additive vs set; planner specifies per-tick merge order and per-param accumulator pattern.
- VTS unavailable / auth-prompt failure UX — non-blocking renderer toast on VTS unreachable; sidecar logs all failure modes; auto-retry every 5s until VTS connects.
- Boot sequence + VTS handshake timing — eager (clearer boot-time error) vs lazy (VTS-not-running tolerance).
- Per-strategy investigation timebox — 1–2 dev-day per strategy.
- Test framework without real VTS — mock pyvts at unit level; integration test against running VTS as §14 verification.
- Avatar-to-canvas mapping math (D-10 follow-up) — linear with clamp at canvas edges, dead-zone radius hardcoded at 80px center.
- Compositor `sentence_id` correlation — planner specifies the correlation contract (likely an `audio-complete` signal from TTSTaskManager carrying `sentence_id`).

### Deferred Ideas (OUT OF SCOPE)

- `physics_chain` strategy with full IN-twin port from OLVT — explicitly dropped from the registry per D-01.
- Renderer-side cursor + window-bounds detection — explicitly dropped per D-09 in favor of sidecar-side Win32 polling.
- Mobile companion via Pixi-rendering — R-OPEN-2 hedge, post-MVP exploratory only.
- Audio-to-params learned drivers — PROJECT_DESIGN §5.6 v1.5 hint.
- Multi-avatar compositor — single-avatar in skeleton (always Teto). MULTI-01..04 territory.
- Hit zones (`hitZones.json`) for click reactions — UX-02 territory.
- Per-avatar entrance motion — UX-04 territory.
- Compositor-driven goal-loop overlay — agent runtime milestone.
- Pet mode click-through transparent window — FORM-01 territory.
- Per-message reasoning-text expand chevron — Phase 2 D-10 inheritance.
- Hard-stop interrupt of in-flight compositor speech driver — Phase 3 D-09 let-finish stance.
- Live debug-overlay HUD on the avatar canvas — D-12 covers most A/B needs.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AVT-01 | 60Hz compositor merges three drivers; sidecar→VTS direct, NOT through renderer | §A (scheduler), §B (single-writer), §K (renderer-side dev panel only carries strategy-switch envelope, not 60Hz traffic) |
| AVT-02 | Idle baseline driver runs continuously, re-sending rest-state values ≥1 Hz to retain VTS ownership | §C (1-second rule), §F (Perlin drift idle), Pitfall 9 from PITFALLS.md |
| AVT-03 | Speech driver = `mode:"add"`; intent overlay = `mode:"set"` + weight fade | §C (mode semantics with weight), §H (RMS→param math) |
| AVT-04 | pyvts wrapped behind single-writer asyncio task — issue #51 mitigation | §B (issue #51 source-path identified at `vts.py:117-118`; fix shape) |
| AVT-05 | Renderer-aware ParamID resolver (~30 LOC); VTS path writes input-layer names; non-VTS branch raises `NotImplementedError` | §C (param naming — Teto's `ParamAngleX` is INPUT name; VTS internally routes to `ParamAngleXIN`), Pitfall 2 |
| AVT-06 | Speech-driver body-sway investigation = ≥2 strategies on Teto + report | §H (RMS→param smoothing), §D (smoke-pass methodology), §A (driver registry pattern) |
| AVT-07 | `teto_overrides.yaml` schema: orphan-params, physics-chain proxies, sign inversions | §D (smoke-pass output), §L (full schema) |
| AVT-08 | `[joy]` ease-out cubic 300ms in / 600ms out; **NOT** hotkey pop | §C (`mode:"set"` + weight), §I (sentence-end signal for decay) |
| AVT-09 | One DiscreteEvent prop hotkey via `HotkeyTriggerRequest` | §C (HotkeyTriggerRequest schema), §D (hotkey discovery) |
| AVT-10 | Cursor-in-canvas → eye/head tracking; sidecar OS-level cursor + VTS window-bounds | §E (Win32 detection + DPI-awareness — the silent-failure mode) |

---

## Project Constraints (from CLAUDE.md)

- **Locked stack:** Electron 40.x + React 19.2.x + Vite 6.x + TS 5.7.x; Python 3.12; FastAPI 0.136.1; Uvicorn 0.46.0; LiteLLM 1.83.x; piper-tts 1.4.2; pyvts 0.3.3 (vendored, dormant upstream); chokidar 3.6.x; sounddevice. **Phase 4 NEW deps:** `pywin32==311` (Windows-only conditional: `pywin32 ; sys_platform == "win32"`), `opensimplex==0.4.5.1` (or hand-rolled Perlin if planner prefers).
- **Cubism 5.3 unsupported by VTS — use Cubism 4.x or 5.0–5.2 rigs only.** Teto is fine.
- **`mode:"add"` for ambient/speech drivers, `mode:"set"` + weight for intent overlays only.** PITFALLS Pitfall 8 verbatim.
- **Single-writer pattern for pyvts.** PITFALLS Pitfall 3 verbatim.
- **Hard-cap writer at 60Hz (one InjectParameterDataRequest per frame, all params batched).** PITFALLS Pitfall 4 verbatim.
- **Continuous rest-state writes for any param the compositor has touched.** PITFALLS Pitfall 9 verbatim.
- **NEVER hand-roll game automation in compositor (no PyAutoGUI / no PyDirectInput).** Compositor is a pure WS client to VTS.
- **No `pnpm` (electron-builder asar conflict); npm only.** Inherited from Phase 1.
- **GSD workflow enforcement:** all edits go through `/gsd:execute-phase` etc.

---

## Standard Stack

### Core (Phase 4 deps to add to `apps/sidecar/pyproject.toml`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pywin32` | **311** | `FindWindow`, `GetWindowRect`, `GetCursorPos`, DPI awareness handle (Windows-only) | The standard win32 access library since 1996. Latest as of May 2026. cp312 wheels published. Pin behind `sys_platform == "win32"` so Linux/Mac smoke tests still install (Phase 4 cursor tracker no-ops on non-Windows; `mode:"set"` for cursor params just won't apply). |
| `opensimplex` | **0.4.5.1** | Perlin/simplex noise for idle drift on `ParamAngleX/Y/Z` + `ParamEyeBallX/Y` | py3-none-any wheel; numpy hard-dep already met by Phase 3 RMS path; deterministic with `seed=`; ~5KB. Alternative is hand-rolled (~30 LOC) — both acceptable. opensimplex earns its keep on test reproducibility. |
| `numpy` | (already present) | RMS smoothing math, Perlin output massaging, `volumes[]` interpolation | Inherited from Phase 3 D-12. |

### Supporting (already in stack — Phase 4 consumes)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pyvts` | **0.3.3 (vendored)** | WS client to VTS API | Single point of WS contact in `pyvts_writer.py`. In-tree patch for issue #51 per Phase 1 D-04 / PROVENANCE.md. |
| `pydantic` | (already present) | `ParamFrame`, `DiscreteEvent`, `BodySwayStrategy`, `TetoOverrides` schemas | Phase 4 adds `param_frame.py`, `discrete_event.py`, `body_sway_strategy.py` Pydantic models in `packages/contracts/py/contracts/`. |
| `pytest` + `pytest-asyncio` | (already present per Phase 2/3 tests) | Mock pyvts; assert tick-level merge; fixtures for envelope-publishing | §G mock surface enumerated below. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `opensimplex` | Hand-rolled Perlin (~30 LOC; or `random.gauss` + low-pass filter) | Saves a dep; loses determinism unless seeded carefully. For unit-test reproducibility opensimplex is the lower-risk pick. |
| `opensimplex` | `noise` package (Ken Perlin's reference) | `noise` last release 2017; Windows wheel compatibility lottery; **avoid**. |
| `pywin32` | `pyautogui` (which depends on pywin32 anyway) + a Win32 wrapper | pyautogui is **explicitly forbidden** by CLAUDE.md "What NOT to Use" table for compositor work. pywin32 direct calls are the project standard. |
| `pywin32` | `ctypes.windll.user32` direct calls | Saves ~5MB install; loses pywin32's win32gui module convenience (`FindWindow`, `GetWindowText`, etc.). For 4 functions called every 250ms + 60Hz ctypes is fine, but pywin32 is cleaner and already a known transitive of many sidecar libs. Pick pywin32 unless `pip install pywin32` fails on the target Python. |
| Single global compositor task | Per-driver tasks coordinated via `asyncio.Event` | Per-driver tasks add cross-task scheduling overhead and an additional coordination layer. Single task with per-tick driver function-calls is simpler and matches PITFALLS performance trap "Action compositor sleep-driven instead of monotonic-clock-driven" guidance. |

**Installation:**

```bash
# In apps/sidecar/
uv add 'pywin32==311 ; sys_platform == "win32"'
uv add opensimplex==0.4.5.1
```

**Version verification:** `pywin32` 311 verified May 2026 on PyPI ([pywin32 PyPI](https://pypi.org/project/pywin32/)); `opensimplex` 0.4.5.1 verified May 2026 on PyPI ([opensimplex PyPI](https://pypi.org/project/opensimplex/)).

---

## Architecture Patterns

### Recommended Module Structure

```
apps/sidecar/src/sidecar/
├── compositor/
│   ├── __init__.py
│   ├── compositor.py          # 60Hz tick scheduler + driver merge logic (AVT-01, AVT-02, AVT-03)
│   ├── param_frame.py         # frozen Pydantic ParamFrame (per-tick output unit)
│   ├── param_id_resolver.py   # AVT-05 — VTS branch returns input-layer name; non-VTS raises
│   ├── idle_driver.py         # D-06, D-07: Perlin drift + blink scheduler + breathing
│   ├── speech_driver.py       # consumes compositor_speech_queue; lipsync (D-04 interp); body-sway dispatch
│   ├── intent_driver.py       # consumes compositor_intent_queue; cubic ease per D-08
│   ├── cursor_driver.py       # 60Hz consumer of cursor-tracker latest tuple; cubic ease-back
│   └── body_sway/
│       ├── __init__.py
│       ├── registry.py        # strategy lookup at boot per D-03
│       ├── head_only.py       # fallback flavor: head sway + breathing + micro-shoulder
│       ├── proxy_param.py     # writes `proxy_body_param` (e.g. Lean Forward) at smoothed RMS
│       └── exp3_modulation.py # loads .exp3.json param IDs; writes them per-tick at RMS strength
├── vts/
│   ├── __init__.py
│   ├── pyvts_writer.py        # AVT-04 single-writer asyncio task (issue #51 mitigation); owns WS
│   ├── discrete_dispatcher.py # AVT-09: HotkeyTriggerRequest path; tiny queue beside the param queue
│   ├── window_detect.py       # D-09: pywin32 FindWindow + GetWindowRect at 250ms
│   └── handshake.py           # connect → request_authenticate_token → request_authenticate flow
└── avatar/
    └── overrides.py           # NEW: TetoOverrides Pydantic loader for teto_overrides.yaml
```

### Pattern 1: Deadline-Driven 60Hz Tick Scheduler (AVT-01)

**What:** Single asyncio task running a `while True` loop. Each iteration computes the next 60Hz boundary deadline and schedules the next iteration via `loop.call_later`, NOT `await asyncio.sleep(1/60)`.

**When to use:** Always for the compositor's main tick. Matches PITFALLS performance-trap guidance.

**Example:**

```python
# Source: PITFALLS.md performance traps + Python tracker issue 45194 + ARCHITECTURE.md
import asyncio
import time

class Compositor:
    TICK_HZ = 60
    TICK_DT = 1.0 / TICK_HZ  # 0.01666...

    async def run(self):
        loop = asyncio.get_running_loop()
        start = loop.time()
        tick_n = 0
        while not self._stop:
            await self._tick()        # synchronous-ish: drivers are fast; merge is in-process
            tick_n += 1
            target = start + tick_n * self.TICK_DT
            sleep_for = max(0.0, target - loop.time())
            # If we've fallen >2 ticks behind, reset baseline (avoid forever-late catch-up bursts)
            if loop.time() > target + 2 * self.TICK_DT:
                start = loop.time()
                tick_n = 0
                self._dropped_frames += 1
                continue
            await asyncio.sleep(sleep_for)
```

`asyncio.sleep(0)` yield is **wrong** (busy loop); a positive sleep is the correct behavior. The deadline reset on >2-tick fall-behind avoids the "burst catch-up at 600Hz" failure when GC pauses or the test runner is loaded.

### Pattern 2: pyvts Single-Writer with Read-Loop (AVT-04, Issue #51 Mitigation)

**What:** One coroutine owns the pyvts WS. A persistent `_recv_loop` coroutine handles ALL `recv()` calls, dispatching responses to per-`requestID` `asyncio.Future` objects in a dict. Producers (compositor, discrete_dispatcher) call `request(msg)` which generates a new `requestID`, registers a Future, calls `send(json.dumps(msg))`, and `await`s the Future.

**When to use:** Always wrapping the vendored pyvts. The vendored pyvts itself stays unmodified for compositor traffic — we don't call its `request()` method directly.

**Example (in-tree patch lives at `sidecar/vendor/pyvts/vts.py`; or wrapper goes at `apps/sidecar/src/sidecar/vts/pyvts_writer.py` — planner picks):**

```python
# Source: pyvts issue #51 (https://github.com/Genteki/pyvts/issues/51) + recommended fix pattern
import asyncio, json, uuid
from pyvts import vts as pyvts_module

class PyvtsSafeWriter:
    """Single-writer wrapper around vendored pyvts.

    pyvts 0.3.3 races at vts.py:117-118 (`websocket.send` then `websocket.recv`).
    We never call recv() from senders; one read loop dispatches by requestID.
    """
    def __init__(self, plugin_info: dict, vts_api_info: dict):
        self._client = pyvts_module.vts(plugin_info=plugin_info, vts_api_info=vts_api_info)
        self._pending: dict[str, asyncio.Future] = {}
        self._recv_task: asyncio.Task | None = None
        self._send_lock = asyncio.Lock()  # serializes writes; recv loop is independent

    async def connect(self) -> None:
        await self._client.connect()
        self._recv_task = asyncio.create_task(self._recv_loop())
        # auth flow handled separately — uses raw client for the one-time popup

    async def _recv_loop(self) -> None:
        while True:
            try:
                raw = await self._client.websocket.recv()
                msg = json.loads(raw)
                rid = msg.get("requestID")
                fut = self._pending.pop(rid, None)
                if fut and not fut.done():
                    fut.set_result(msg)
            except Exception as exc:
                # Set exception on all pending; surface to writer task
                for fut in self._pending.values():
                    if not fut.done():
                        fut.set_exception(exc)
                self._pending.clear()
                return  # outer reconnect logic restarts the writer

    async def request(self, request_msg: dict, timeout: float = 5.0) -> dict:
        request_msg = dict(request_msg)
        rid = request_msg.setdefault("requestID", uuid.uuid4().hex)
        fut = asyncio.get_running_loop().create_future()
        self._pending[rid] = fut
        async with self._send_lock:
            await self._client.websocket.send(json.dumps(request_msg))
        return await asyncio.wait_for(fut, timeout=timeout)

    async def inject_params(self, frame: ParamFrame) -> None:
        """Frame-batched write — one InjectParameterDataRequest per tick (Pitfall 4 contract).

        For mode:"add" frames the weight field is ignored by VTS;
        for mode:"set" frames the weight controls face-tracker mix.
        """
        # Build the request via vendored pyvts.vts_request (or hand-build to avoid the helper)
        msg = self._client.vts_request.requestSetMultiParameterValue(
            parameters=list(frame.add_params.keys()),
            values=list(frame.add_params.values()),
            mode="add",
        )
        # The compositor merges add + set into separate requests; one tick = potentially 2 sends
        await self.request(msg)
```

### Pattern 3: Per-Tick Driver Merge Order

```python
# Inside Compositor._tick():
add_acc: dict[str, float] = {}        # mode:"add" accumulator (idle + speech + cursor)
set_acc: dict[str, tuple[float, float]] = {}  # mode:"set" -> (value, weight); intent only

# 1. Idle baseline (always runs; AVT-02 1-second-rule guard)
for name, val in self.idle_driver.tick(self._now).items():
    add_acc[name] = add_acc.get(name, 0.0) + val

# 2. Speech driver (only fires when compositor_speech_queue has an active envelope)
if (speech_frame := self.speech_driver.tick(self._now)):
    for name, val in speech_frame.items():
        add_acc[name] = add_acc.get(name, 0.0) + val

# 3. Intent overlay (drives the [joy] cross-fade; mode:"set" only)
for name, (val, weight) in self.intent_driver.tick(self._now).items():
    set_acc[name] = (val, weight)  # latest intent wins; cross-fade handled inside intent_driver

# 4. Cursor driver (mode:"add" — adds head/eye deflection on top of idle)
for name, val in self.cursor_driver.tick(self._now).items():
    add_acc[name] = add_acc.get(name, 0.0) + val

# 5. Issue at most TWO requests this tick (one for add, one for set) — Pitfall 4 batched contract
if add_acc:
    await self.writer.inject(add_acc, mode="add")
if set_acc:
    await self.writer.inject(set_acc, mode="set")
```

The per-driver `tick(now)` functions are **synchronous and pure** — no I/O, no awaits inside. They read from queues at the *boundary* (idle_driver doesn't have a queue; speech_driver pulls latest active SpeechEnvelopePayload via `queue.get_nowait()` and caches it; intent_driver pulls all available ActionIntents into its in-progress overlay list). This keeps the tick deterministic.

### Anti-Patterns to Avoid

- **Per-driver asyncio task with a queue between drivers and the merger.** Adds cross-task latency; the per-tick `tick()` synchronous call is faster and simpler.
- **`await asyncio.sleep(1/60)` as the tick rhythm.** Drift accumulates; PITFALLS performance trap explicit.
- **Calling `pyvts.request()` from anywhere except the writer task.** Triggers issue #51 race.
- **Writing every parameter as a separate `InjectParameterDataRequest`.** Violates PITFALLS Pitfall 4 batched contract; will rate-limit VTS.
- **Stopping all writes when no driver is active for a previously-touched param.** VTS reverts ownership in 1s (PITFALLS Pitfall 9). Idle driver MUST always run; rest-state of zero gets re-injected if no driver contributes.
- **Trusting `weight` in `mode:"add"` calls.** VTS ignores it (verified vs official spec). The compositor does CPU-side weight scaling before adding to `add_acc`.
- **Calling the strategy switch from the WS handler thread directly into the compositor's strategy attribute.** Race during a tick. The strategy switch sets a `pending_strategy` field; the compositor reads it at the START of the next tick.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Win32 `FindWindow` from scratch | `ctypes.windll.user32.FindWindowW` boilerplate | `win32gui.FindWindow(class, title)` from pywin32 | Already a transitive dep most places; the win32gui wrapper handles wide-char + None-class semantics. |
| Cubic ease-out math | Custom implementation per driver | Single `ease_out_cubic(t: float) -> float` helper in `compositor/easing.py`: `1 - (1 - t)**3` | One trivial function shared by intent_driver decay (D-08) AND cursor_driver ease-back (D-10). |
| Perlin/simplex noise generator | Hand-roll 1D simplex | `opensimplex.OpenSimplex(seed=42).noise2(t, axis_idx)` | Saves audit; deterministic for unit tests; numpy-friendly. |
| WAV → param-list parsing for .exp3.json | Walk the JSON spec by hand | `json.load(open(path)).get("Parameters", [])` — each entry has `Id`, `Value`, `Blend` keys (verified by reading `Star Eye.exp3.json`, `Cry.exp3.json`, `【SV】Mic.exp3.json`) | Cubism .exp3.json schema is dirt-simple; no library needed. |
| Per-`requestID` Future correlation for VTS responses | Custom dispatcher | The fix pattern in §B above is ~30 LOC and standard for any JSON-RPC-shaped protocol. | Smaller than any general-purpose RPC lib's API surface. |
| RMS smoothing | Custom IIR filter | One-Euro filter (~25 LOC; reference: 1€ Filter paper by Casiez et al.) OR exponential moving average | EMA is fine for skeleton; one-Euro better preserves leading edges. Planner picks. |
| Sentence-boundary timing | Hand-derive from `volumes[i]` index overshoot | Explicit `compositor_sentence_complete_queue` published by TTSTaskManager (Phase 3 amendment requested) | §I open question; explicit is load-bearing. |

**Key insight:** Every single Phase 4 component has a well-defined narrow scope — none of them is a meaningful "library to write." The temptation to over-engineer is the asyncio scheduler (where `loop.call_later` is the accepted pattern and there is no library to use), so leave it minimal and follow the deadline-reset-on-fall-behind pattern in Pattern 1.

---

## Common Pitfalls

(Phase 4 inherits PITFALLS Pitfalls 1, 2, 3, 4, 5, 8, 9, 10. The list below is **Phase-4-specific additions** beyond what PITFALLS.md covers.)

### Pitfall 18: VTS expression API has no dynamic strength control — `exp3_modulation` strategy must NOT use ExpressionActivationRequest

**What goes wrong:** Planner reads "exp3_modulation strategy modulates an .exp3.json's strength curves by RMS" and writes code that calls `ExpressionActivationRequest(file=..., active=true, fadeTime=...)` per tick at varying `fadeTime`. Result: VTS treats the expression as a binary on/off; fadeTime only controls the transition duration ONCE per state change. Calling it 60 times per second produces visible flickering or a no-op (VTS deduplicates same-state activations).

**Why it happens:** The VTS API was designed for hotkey-style expression toggles, not continuous modulation. Verified against [VTubeStudio README](https://github.com/DenchiSoft/VTubeStudio): "no strength or weight field exposed for dynamically controlling expression intensity at runtime."

**How to avoid:** The `exp3_modulation` strategy implementation MUST:
1. At smoke-pass time (04-00), identify a Teto .exp3.json that contains body-pose-relevant parameter IDs (e.g., a hypothetical `body_lean.exp3.json` whose Parameters list includes `ParamBodyAngleX` or similar). Currently Teto's 14 .exp3.json files are mostly eye/face overlays — Phase 4 may need to AUTHOR a new body-pose .exp3.json file in `Live2D/重音テト/Expressions/` if no existing one is suitable. Discussion item.
2. At runtime, load the .exp3.json via `json.load`, iterate its `Parameters[]` list, and for each entry: `add_acc[Id] = entry.Value * rms_smooth_value`.
3. The `Blend` field in .exp3.json (`"Add"` vs `"Multiply"` vs `"Overwrite"`) is informational for the strategy author — `mode:"add"` injection works for `Blend:"Add"` parameters; `mode:"set"` would be needed for `"Overwrite"`. Smoke-pass should record per-param Blend.

**Warning signs:** ExpressionActivationRequest spam in logs; expression visibly toggles on/off instead of smoothly modulating.

**Phase to address:** 04-02 strategy implementation. The planner MUST clarify in the plan that `exp3_modulation` writes parameter IDs from the .exp3.json's Parameters list, NOT calling the expression activation API.

**Severity:** Skeleton-blocker for `exp3_modulation` strategy. Without this clarification the strategy will appear broken and erroneously default to `head_only`.

---

### Pitfall 19: DPI virtualization silently breaks cursor-rect hit-testing on Windows 11

**What goes wrong:** Sidecar process runs without DPI awareness manifest. `GetCursorPos` always returns physical pixels (e.g., (2400, 1500) on a 4K @ 200% scale display). `GetWindowRect` returns DPI-virtualized 96-DPI logical pixels (e.g., (100, 100, 1100, 1900) for a window that physically occupies (200, 200, 2200, 3800)). The cursor at physical (1500, 1000) reports as `inside` (since 100 < 1500 < 1100 is FALSE — cursor reads as "outside the right edge" while it's actually inside). Result: AVT-10 cursor tracking silently fails on every Windows 11 user with display scaling >100%, which is the default on most laptops.

**Why it happens:** Python interpreter is DPI-unaware by default. Process-wide DPI awareness is set at process start, not per-thread.

**How to avoid:**
```python
# In sidecar entry point (e.g. apps/sidecar/src/sidecar/__main__.py), BEFORE pywin32 imports:
import sys
if sys.platform == "win32":
    import ctypes
    # PROCESS_PER_MONITOR_DPI_AWARE = 2 (Windows 8.1+)
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        # Fallback for older Windows
        ctypes.windll.user32.SetProcessDPIAware()
```

After this both `GetCursorPos` and `GetWindowRect` return physical pixels consistently. Test on a non-100%-scale monitor (or `DISPLAY_SCALE` env var on a CI image, etc.).

**Warning signs:** Cursor tracker works on dev's 1080p monitor at 100% scale; fails on user's 4K laptop. Visible: cursor appears inside the avatar canvas region in the renderer's debug log but the eye-tracker doesn't fire.

**Phase to address:** Sidecar bootstrap code in 04-03 cursor tracker (or 04-01 if planner consolidates). One-line addition; impossible to forget if PITFALLS-aware.

**Severity:** Skeleton-blocker for AVT-10 SC #4 on any non-100%-scale display. Verified by reading [Microsoft DPI awareness docs](https://learn.microsoft.com/en-us/windows/win32/hidpi/dpi-awareness-context).

---

### Pitfall 20: VTS window-class probe fails because Unity 6000 windows have generic class

**What goes wrong:** Planner writes `win32gui.FindWindow("VTubeStudio", None)` or similar exact-class probe. Returns 0 (not found) because Unity's main window class is `UnityWndClass` (generic across all Unity 6000 builds), not VTube-Studio-specific. Sidecar logs "VTS not running" while VTS is on screen.

**Why it happens:** Unity-engine apps don't expose their app name in the window class. The class is shared with every other Unity-built app.

**How to avoid:** Probe by title prefix via `win32gui.EnumWindows`:

```python
def find_vts_hwnd() -> int | None:
    found: list[int] = []
    def cb(hwnd: int, _) -> bool:
        if not win32gui.IsWindowVisible(hwnd):
            return True
        title = win32gui.GetWindowText(hwnd)
        if title.startswith("VTube Studio"):
            found.append(hwnd)
        return True
    win32gui.EnumWindows(cb, None)
    return found[0] if found else None
```

Title is observed as `"VTube Studio"` in current 1.32.71 builds (no model-name suffix in the window title; the model name appears inside the canvas overlay, not the OS window title — verified by inspection of similar Unity applications, but the planner should validate at smoke-pass time and fall back to substring-match if needed).

**Warning signs:** Sidecar logs "VTS not running" repeatedly while VTS is visible. Or: the probe returns a different Unity app's window (some other Unity tool has VTS in its title — unlikely but possible if user has Unity Hub etc.).

**Phase to address:** 04-01 or 04-03 (whichever owns `window_detect.py`). The 250ms poll calls this; cache the HWND and only re-EnumWindows on lookup miss.

**Severity:** Skeleton-blocker for AVT-10 — false negative on VTS detection means cursor tracker never engages.

---

### Pitfall 21: Strategy hot-switch (D-12) drops compositor mid-tick if not gated

**What goes wrong:** WS handler receives `set-body-sway-strategy:proxy_param` and immediately swaps `compositor.body_sway_strategy = registry["proxy_param"]`. If the swap happens between `speech_driver.tick()` and `intent_driver.tick()` of the same tick, the speech_driver's accumulated state is dropped (different strategy has different state shape). Result: visible glitch on switch — "snap" of body to neutral for one tick.

**Why it happens:** Strategies have per-strategy state (e.g., `proxy_param` keeps a running RMS smoother; `exp3_modulation` keeps a parameter-list cache). Switching mid-tick loses smoother state.

**How to avoid:** WS handler writes to `compositor._pending_strategy_swap: str | None`. At the START of each tick, before any driver runs, the compositor checks for a pending swap, calls the new strategy's `init()` method, and only then ticks. The single-tick swap is invisible (driver is silent for ≤16ms).

**Warning signs:** Strategy switch on the dev panel produces a visible body snap on the avatar.

**Phase to address:** 04-02 compositor + speech_driver. Trivial fix — gate at tick boundary.

**Severity:** Investigation-quality issue (D-04 evidence is degraded if the swap-points are lossy).

---

### Pitfall 22: Sentence-end signal needs explicit publish from TTSTaskManager — extrapolation is fragile

**What goes wrong:** Phase 4's intent_driver (D-08) starts ease-out at sentence-END, not chain-end. Phase 3's TTSTaskManager publishes `compositor_speech_queue.put(envelope)` at audio-write START with `started_at + len(volumes) * slice_length` as the implicit end timestamp. If the compositor extrapolates `now() >= started_at + len(volumes) * slice_length / 1000` to detect end, sounddevice underruns / GC pauses produce real audio that runs past the extrapolated boundary by 50–200ms, and the intent decay starts BEFORE the audio actually finishes (joy fade-out begins while "joyfully spoken" is still being heard).

**Why it happens:** Audio playback time is not the same as wall-clock time when the OutputStream buffer is underrunning. Phase 3 D-09 underrun-handling Claude's-Discretion item flagged this.

**How to avoid:** Phase 4 needs an explicit `compositor_sentence_complete_queue: asyncio.Queue[int]` (or a callback list — planner picks). TTSTaskManager publishes `sentence_id` to this queue at the moment the OutputStream confirms drain completion for sentence N. Compositor's intent_driver consumes it.

**Implementation note:** sounddevice's OutputStream doesn't natively expose "drained" callback for arbitrary write queues. Two viable approaches:
1. Track per-sentence `samples_written` and compare to `stream.write_available` differential. Custom logic at the sender_task in TTSTaskManager.
2. Add a "silence padding" sample-count to each sentence's payload; when the silence-padding samples have been consumed (extrapolation-with-lookahead), publish. Simpler but still extrapolation-flavored.

The planner should request a Phase 3 D-14 amendment OR scope the addition to Phase 4 (modifying Phase 3's already-shipped TTSTaskManager). Memory rule (project_kv_cache_discipline) doesn't apply here, but the cleaner choice is: document the new queue's existence in `apps/sidecar/src/sidecar/tts/tts_manager.py` as a "Phase 4 ADDS this publication call" amendment rather than a Phase-3 retroactive edit.

**Warning signs:** `[joy]` decay visibly begins before the joyful sentence finishes; head movement decays into `head_only` neutral mid-word.

**Phase to address:** 04-02 intent_driver design. Plan must explicitly call out the new queue and the TTSTaskManager amendment.

**Severity:** Skeleton-blocker for SC #2 (the headline `[joy]` smooth blend). Without this signal the headline demo will look wrong on long sentences.

---

### Pitfall 23: VTS auth pop-up timing — appears on `request_authenticate_token` request, not on connect

**What goes wrong:** Planner thinks the auth pop-up appears when the WS connects, designs the boot sequence around `vts.connect()` returning quickly. In reality the pop-up appears when the plugin sends its FIRST `AuthenticationTokenRequest` — which only fires if no cached token exists. If the user already authorized in a prior session and the token cache is intact, the pop-up does NOT appear; if cache is cleared (or token-path is wrong per Pitfall 10), the pop-up appears mid-boot and BLOCKS the WS until the user clicks "Allow".

**Why it happens:** pyvts's `request_authenticate_token` calls `await self.read_token()` first (vts.py:126); if the file exists with content, it skips the request entirely. If empty/missing, it sends the request — and `await self.request(request_msg)` blocks until VTS responds, which only happens after the user clicks Allow.

**How to avoid:**
1. **Boot sequence: don't block sidecar `[READY]` on VTS auth.** The Phase 3 [READY] line emits before TTS warmup completes; same pattern for VTS — emit [READY], then run VTS handshake in a background task, surface a "Allow plugin in VTS Settings" toast if the handshake hangs >3s.
2. **First-launch UX copy: tell the user explicitly to look at VTS.** A renderer toast: `"VTS handshake pending — click 'Allow' in VTube Studio's pop-up dialog."` if `request_authenticate_token` hasn't completed in 3s.
3. **Token-path discipline: per Pitfall 10, set `authentication_token_path` to `%APPDATA%/AgenticLLMVTuber/vts_token.json`**, NOT pyvts's `./pyvts_token.txt` default.

**Warning signs:** First-launch "sidecar hung" report. User doesn't notice the Allow dialog because VTS is on a different monitor.

**Phase to address:** 04-01 (handshake) + UI hint to the renderer for the "click Allow in VTS" toast.

**Severity:** First-impression UX for any user who hasn't pre-authorized.

---

### Pitfall 24: Idle driver's continuous rest-state writes can fight smoke-pass introspection

**What goes wrong:** Smoke-pass at 04-00 wants to test "does Lean Forward parameter respond to my writes?" by writing `Lean Forward = 1.0`, sleeping 100ms, then reading via `ParameterValueRequest` to see if the readback equals 1.0. If the idle driver is ALREADY running with `mode:"add"` writing rest-state 0.0 to ParamFacePositionZIN (which is what `Lean Forward` ultimately drives via `vtube.json` routing), the idle driver's per-tick zero contribution might MASK the smoke-pass write.

**Why it happens:** Idle driver runs at 60Hz; smoke-pass write is one-shot. VTS's `mode:"add"` semantic accumulates within a frame, but successive frames replace prior frames' values. The smoke-pass write hits between two idle frames and gets immediately stomped by the next idle frame's zero.

**How to avoid:**
1. **Smoke-pass runs BEFORE the compositor starts.** In 04-00, the script connects to VTS via the single-writer wrapper, runs introspection, writes, reads, records, exits. The idle driver hasn't started yet. The compositor only starts during Phase-4-runtime (later 04-02 / 04-03 work).
2. **OR:** smoke-pass writes use `mode:"set"` with `weight=1.0` for clarity (set+weight=1 overrides face tracker AND beats the idle's `add` zero). For probe purposes, full-strength `set` is fine because we're not running the speech driver simultaneously.

**Warning signs:** Smoke-pass results show "Lean Forward not responsive" but manual VTS tests show it works.

**Phase to address:** 04-00 smoke-pass methodology — explicit "compositor not running during smoke-pass" precondition.

**Severity:** 04-00 quality-blocker.

---

## Code Examples

### A. 60Hz scheduler (extends Pattern 1 above)

See Pattern 1 in §"Architecture Patterns" — already verified vs PITFALLS performance trap and Python tracker issue 45194.

### B. Driver merge order (extends Pattern 3 above)

See Pattern 3 in §"Architecture Patterns".

### C. Smoke-pass param-write probe (04-00)

```python
# Source: VTS API spec — InjectParameterDataRequest + ParameterValueRequest
# https://github.com/DenchiSoft/VTubeStudio
async def probe_param(writer, name: str, probe_value: float = 1.0) -> dict:
    """Write `probe_value` to param `name`, read back, classify visible/orphan."""
    # 1. Write probe value via mode:"set" (override face tracker for probe)
    set_msg = writer._client.vts_request.requestSetParameterValue(
        parameter=name, value=probe_value, weight=1.0, mode="set"
    )
    await writer.request(set_msg)

    # 2. Wait for VTS to apply
    await asyncio.sleep(0.15)

    # 3. Read back via ParameterValueRequest
    read_msg = writer._client.vts_request.requestParameterValue(parameter=name)
    response = await writer.request(read_msg)

    # 4. Classify
    actual = response.get("data", {}).get("value", 0.0)
    return {
        "name": name,
        "wrote": probe_value,
        "readback": actual,
        "visible": abs(actual - probe_value) < 0.05,  # within 5% = applied
        "orphan_face_tracker": abs(actual) < 0.05,    # readback is 0 = face tracker won
        "blend_partial": 0.05 < abs(actual - probe_value) < 0.5,  # weight-mixed
    }
```

The "blend_partial" case is the most interesting — it means the param IS bound to deformers (visible) AND the face tracker also has weight (live mode:"set" + weight<1). For smoke-pass we use weight=1 to rule out the blend-partial case.

For the `exp3_modulation` candidate case, we additionally read the `.exp3.json` Parameters list and probe each entry's `Id` separately — that gives us "if I write to ParamX from the body-lean .exp3.json's parameters at strength s, does the model respond?".

### D. Hotkey discovery + filtering (AVT-09)

```python
# Source: VTS API spec — HotkeysInCurrentModelRequest + reading 重音テト.vtube.json
async def discover_hotkeys(writer) -> list[dict]:
    """Returns list of {hotkeyID, name, type, file, llm_emittable, is_meta}."""
    msg = writer._client.vts_request.requestHotKeyList()
    response = await writer.request(msg)
    available = response.get("data", {}).get("availableHotkeys", [])
    META_NAMES = {"Remove All Toggles", "Remove Water Mark"}  # from Teto rig inspection
    return [
        {
            "hotkeyID": h["hotkeyID"],
            "name": h["name"],
            "type": h["type"],          # e.g., ToggleExpression, TriggerAnimation
            "file": h.get("file", ""),
            "is_meta": h["name"] in META_NAMES,
            "llm_emittable": h["name"] not in META_NAMES,
        }
        for h in available
    ]
```

For Teto specifically, the smoke-pass will produce 15 entries: 13 non-meta `ToggleExpression`-type entries (Star Eye, Heart Eye, Cry, Dizzy Eye, Squint Eye, Blush, Dark Face, Dark Eye, Chibi, Baguette, SV/UTAU Alt, SV Microphone, Utau Headphone) and 2 meta (Remove All Toggles, Remove Water Mark). The DiscreteEvent demo target (D-11) is `Star Eye [7]` (recommend) — visually punchy, eye-overlay only, won't disrupt body pose.

### E. Cubic ease-out helper

```python
def ease_out_cubic(t: float) -> float:
    """t in [0, 1]; returns eased value in [0, 1]. Used for D-08 intent decay + D-10 cursor ease-back."""
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3
```

For D-08's 300ms in / 600ms out:
- in:  `weight = ease_out_cubic((now - sentence_start) / 0.300)`
- out: `weight = 1 - ease_out_cubic((now - sentence_end) / 0.600)`

For D-10's 800ms ease-back:
- `value = current * (1 - ease_out_cubic((now - cursor_left_canvas_at) / 0.800))`

### F. Perlin idle drift

```python
import opensimplex
class IdleDriver:
    def __init__(self, seed: int = 0):
        self._noise = opensimplex.OpenSimplex(seed=seed)
        # Time-axis frequencies tuned for "natural drift", per-axis to decorrelate
        self._freqs = {"ParamAngleX": 0.20, "ParamAngleY": 0.17, "ParamAngleZ": 0.13}
        self._amplitudes = {"ParamAngleX": 5.0, "ParamAngleY": 5.0, "ParamAngleZ": 5.0}

    def tick(self, now: float) -> dict[str, float]:
        out: dict[str, float] = {}
        for name, freq in self._freqs.items():
            # noise2 takes (x, y); we use (time*freq, axis_seed_offset) for decorrelation
            offset = hash(name) % 1000  # decorrelation seed
            out[name] = self._noise.noise2(now * freq, offset) * self._amplitudes[name]
        # Eye-gaze (smaller amplitude per D-06)
        for name, freq in [("ParamEyeBallX", 0.30), ("ParamEyeBallY", 0.25)]:
            offset = (hash(name) % 1000) + 500
            out[name] = self._noise.noise2(now * freq, offset) * 3.0  # ~3 deg amplitude
        return out
```

Blink scheduler is independent; stored as `next_blink_at` and `blink_phase` (idle / closing / open-pause / opening), with random-uniform schedule per D-07.

### G. Cursor → ParamAngle deflection

```python
def cursor_to_param_angles(
    cursor_xy: tuple[int, int],
    vts_rect: tuple[int, int, int, int],  # (left, top, right, bottom) physical pixels
    face_center_frac: tuple[float, float] = (0.5, 0.5),  # (x, y) as fraction of canvas
    max_deflection_deg: float = 15.0,
    dead_zone_px: float = 80.0,
) -> dict[str, float]:
    """Returns ParamAngleX/Y deflection in degrees. None of: cursor_xy outside vts_rect."""
    cx, cy = cursor_xy
    l, t, r, b = vts_rect
    if not (l <= cx < r and t <= cy < b):
        return {}  # cursor not in canvas → caller eases back to 0
    w = r - l
    h = b - t
    fx, fy = face_center_frac
    face_x = l + w * fx
    face_y = t + h * fy
    dx = cx - face_x
    dy = cy - face_y
    dist = (dx * dx + dy * dy) ** 0.5
    if dist < dead_zone_px:
        return {"ParamAngleX": 0.0, "ParamAngleY": 0.0}  # dead zone
    # Linear with clamp (planner can swap to spherical if needed)
    half_w = w * 0.5
    half_h = h * 0.5
    nx = max(-1.0, min(1.0, dx / half_w))
    ny = max(-1.0, min(1.0, dy / half_h))
    return {
        "ParamAngleX": nx * max_deflection_deg,
        "ParamAngleY": -ny * max_deflection_deg,  # screen-y down → param-y down for natural look
    }
```

The cursor driver applies cubic ease-back when the canvas is exited (Pitfall 9 — keep writing 0 not stop writing). The dead-zone keeps the avatar from cross-eyed-staring at its own face.

---

## Runtime State Inventory

Phase 4 introduces compositor traffic to VTS — runtime state to inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — compositor is stateless across sessions; pyvts auth token at `%APPDATA%/AgenticLLMVTuber/vts_token.json` (path needs explicit set per Pitfall 10) | Set token_path explicitly at startup; no migration of existing data |
| Live service config | VTS running on `ws://127.0.0.1:8001` (default port from pyvts/config.py); user must enable API in VTS Settings → API + check "Allow Plugins"; first-launch popup needs user click | Document in README; surface helpful banner on connection failure |
| OS-registered state | None — no Windows Task Scheduler / pm2 / systemd registrations involved | None |
| Secrets/env vars | None new — Phase 1's safeStorage holds LLM creds; pyvts auth token is local file at user data dir (write-once after pop-up) | None |
| Build artifacts | None — Phase 4 adds Python modules and one DevPanel.tsx control; opensimplex + pywin32 wheels installed via uv into the existing venv | `uv sync` after pyproject.toml updates |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| VTube Studio (external app) | AVT-01..10 (entire phase) | User must install + run separately | 1.32.71 (current stable) | NONE — phase scope requires VTS. Smoke-pass + skeleton verification (Phase 5 SC-01) are gated on VTS being installed and running on the dev machine. |
| pywin32 | D-09, D-10, AVT-10 | ✓ on Windows | 311 (cp312 wheel) | non-Windows: cursor tracker no-ops; AVT-10 SC #4 verified Windows-only in Phase 5. |
| opensimplex | D-06 idle driver | ✓ universal py3 wheel | 0.4.5.1 | hand-rolled 1D Perlin (~30 LOC) |
| Live2D rig (Teto) | 04-00 smoke-pass; entire 04-02 investigation | ✓ at `Live2D/重音テト/` (user's local copy; not redistributable) | (rig version unknown — Cubism 4.x or 5.0–5.2 per CLAUDE.md constraint) | NONE — Teto is the dev avatar |
| Display with non-100% scaling | Pitfall 19 verification | Optional but recommended | — | If only 100% scale display available, mark Pitfall 19 verification as deferred to Phase 5 user-test |

**Missing dependencies with no fallback:** VTS itself, Teto rig — both are mandatory phase prerequisites. Confirm before kickoff.

**Missing dependencies with fallback:** opensimplex (hand-rolled), pywin32 (non-Windows: AVT-10 marked Windows-only).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24.x (already in stack from Phase 2/3) |
| Config file | `apps/sidecar/pyproject.toml [tool.pytest.ini_options]` |
| Quick run command | `cd apps/sidecar && uv run pytest tests/compositor/ -x` |
| Full suite command | `cd apps/sidecar && uv run pytest -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AVT-01 | 60Hz tick produces ParamFrame; one InjectParameterDataRequest per tick | unit | `uv run pytest apps/sidecar/tests/compositor/test_scheduler.py::test_60hz_tick_count -x` | ❌ Wave 0 |
| AVT-02 | Idle driver writes rest-state ≥1Hz even when no other driver active | unit | `uv run pytest apps/sidecar/tests/compositor/test_idle_driver.py::test_continuous_rest_state -x` | ❌ Wave 0 |
| AVT-03 | mode:"add" used for ambient/speech; mode:"set"+weight for intent | unit | `uv run pytest apps/sidecar/tests/compositor/test_compositor.py::test_merge_modes -x` | ❌ Wave 0 |
| AVT-04 | Concurrent producers don't trigger pyvts issue #51 | integration (mock) | `uv run pytest apps/sidecar/tests/vts/test_pyvts_writer.py::test_concurrent_requests -x` | ❌ Wave 0 |
| AVT-05 | VTS branch returns input-layer name; non-VTS raises NotImplementedError | unit | `uv run pytest apps/sidecar/tests/compositor/test_param_id_resolver.py -x` | ❌ Wave 0 |
| AVT-06 | Strategy registry has ≥2 non-fallback entries; head_only fallback works | unit | `uv run pytest apps/sidecar/tests/compositor/test_body_sway_registry.py -x` | ❌ Wave 0 |
| AVT-07 | teto_overrides.yaml schema validates with all required fields | unit | `uv run pytest apps/sidecar/tests/avatar/test_overrides.py -x` | ❌ Wave 0 |
| AVT-08 | Intent driver ease-out cubic 300ms in / 600ms out; weight curve correct | unit | `uv run pytest apps/sidecar/tests/compositor/test_intent_driver.py::test_cubic_ease -x` | ❌ Wave 0 |
| AVT-09 | DiscreteEvent path produces HotkeyTriggerRequest msg with correct hotkeyID | unit | `uv run pytest apps/sidecar/tests/vts/test_discrete_dispatcher.py -x` | ❌ Wave 0 |
| AVT-10 | Cursor → ParamAngle deflection clamped at canvas edges; dead-zone respected | unit | `uv run pytest apps/sidecar/tests/compositor/test_cursor_driver.py -x` | ❌ Wave 0 |
| §14 SC #1 (idle micro-motion) | Manual-on-rig | manual | run sidecar + VTS, observe 60s idle | manual-only |
| §14 SC #2 (lipsync + body/head sway) | Manual-on-rig | manual | run multi-sentence prompt; verify mouth + body | manual-only |
| §14 SC #3 ([joy] smooth blend) | Manual-on-rig | manual | prompt with `[joy]`, verify 300ms ease-in | manual-only |

### Sampling Rate
- **Per task commit:** `uv run pytest apps/sidecar/tests/compositor/ -x` (compositor unit tests, ~5s)
- **Per wave merge:** `uv run pytest -x` (full sidecar suite)
- **Phase gate:** Full suite green AND manual §14 SC verification (Phase 5 SC-01 deliverable)

### Wave 0 Gaps
- [ ] `apps/sidecar/tests/compositor/conftest.py` — fixtures for mock pyvts writer + virtual clock
- [ ] `apps/sidecar/tests/compositor/test_scheduler.py` — covers AVT-01
- [ ] `apps/sidecar/tests/compositor/test_idle_driver.py` — covers AVT-02
- [ ] `apps/sidecar/tests/compositor/test_compositor.py` — covers AVT-03
- [ ] `apps/sidecar/tests/compositor/test_param_id_resolver.py` — covers AVT-05
- [ ] `apps/sidecar/tests/compositor/test_body_sway_registry.py` — covers AVT-06
- [ ] `apps/sidecar/tests/compositor/test_intent_driver.py` — covers AVT-08
- [ ] `apps/sidecar/tests/compositor/test_cursor_driver.py` — covers AVT-10
- [ ] `apps/sidecar/tests/vts/conftest.py` — mock pyvts websocket fixture
- [ ] `apps/sidecar/tests/vts/test_pyvts_writer.py` — covers AVT-04
- [ ] `apps/sidecar/tests/vts/test_discrete_dispatcher.py` — covers AVT-09
- [ ] `apps/sidecar/tests/avatar/test_overrides.py` — covers AVT-07

### Mock pyvts Surface (for unit tests)

The mock pyvts client must support: `connect()`, `request(msg) -> dict` (returns canned responses keyed by `messageType`), `websocket.send` / `websocket.recv` (queue-backed for issue-#51 concurrent test), `vts_request.*` (use the real `vts_request.py` module — its only side effect is dict construction, safe to use).

```python
@pytest.fixture
async def mock_writer(monkeypatch):
    sent: list[dict] = []
    responses = {
        "InjectParameterDataRequest": {"messageType": "InjectParameterDataResponse", "data": {}},
        "HotkeysInCurrentModelRequest": {
            "messageType": "HotkeysInCurrentModelResponse",
            "data": {
                "modelLoaded": True, "modelName": "Teto",
                "availableHotkeys": [
                    {"hotkeyID": "ebd...", "name": "Star Eye [7]", "type": "ToggleExpression", "file": "Star Eye.exp3.json"},
                    {"hotkeyID": "29f...", "name": "Remove All Toggles", "type": "RemoveAllExpressions", "file": ""},
                    # ...
                ]
            }
        },
        "HotkeyTriggerRequest": {"messageType": "HotkeyTriggerResponse", "data": {"hotkeyID": "..."}},
        "ParameterValueRequest": {"messageType": "ParameterValueResponse", "data": {"value": 0.0, "name": "..."}},
        "InputParameterListRequest": {
            "messageType": "InputParameterListResponse",
            "data": {
                "modelLoaded": True,
                "defaultParameters": [{"name": "ParamMouthOpenY", "value": 0.0, "min": 0, "max": 1, "defaultValue": 0}],
                "customParameters": [],
            }
        },
    }
    class FakeWriter:
        async def request(self, msg):
            sent.append(msg)
            mt = msg["messageType"]
            return {"requestID": msg.get("requestID", "r"), **responses.get(mt, {})}
        async def inject(self, params, mode):
            sent.append({"messageType": "InjectParameterDataRequest", "data": {"mode": mode, "parameterValues": [{"id": k, "value": v} for k, v in params.items()]}})
    return FakeWriter(), sent
```

For the AVT-04 issue-#51 concurrent-request test: spawn 10 `asyncio.gather` tasks calling `writer.request(...)` simultaneously; assert no `RuntimeError`, all 10 responses correlate to their requestIDs, all 10 sent messages were transmitted.

---

## State of the Art

| Old Approach (PROJECT_DESIGN §5.3.1, OLVT Phase 4) | Current Approach (Phase 4 plan) | When Changed | Impact |
|---|---|---|---|
| `ParamBodyAngleX` direct write | Smoke-pass first; `proxy_param` writes `Lean Forward` (Teto-specific) | This phase, R-OPEN-1 | Body sway becomes a per-rig contract, not a one-size-fits-all formula |
| `physics_chain` IN-twin trick | Dropped from registry per D-01 | This phase | Failed on Teto (memory: project_unsolved_body_sway); strategies that have empirical evidence beat strategies imported as "could work" |
| `ExpressionActivationRequest` for `[joy]` | `mode:"set"` + `weight` fade via `InjectParameterDataRequest` on per-expression parameter IDs | AVT-08 + Pitfall 18 | Smooth blend possible; "hotkey pop" avoided; per VTS API limitations no other path exists |
| `await asyncio.sleep(1/60)` tick rhythm | `loop.call_later`-aimed monotonic clock with deadline reset | PITFALLS performance trap | Sub-2ms jitter consistently; stable under GC pause |
| Renderer-side cursor tracking | Sidecar-side Win32 polling (D-09) | Phase 1 D-11 + Phase 4 D-09 | Eliminates 60Hz IPC traffic across renderer; AVT-01 invariant preserved |

**Deprecated/outdated in the phase context:**
- ExpressionActivationRequest as a primary continuous-control surface — VTS API has not added strength control as of 2026.
- pyvts upstream — dormant since 2024-09; vendored in-tree and patched per Phase 1 D-04.

---

## Open Questions

1. **Will `Lean Forward` actually produce visible body sway when written via mode:"set" or mode:"add"?**
   - What we know: `Lean Forward` outputs to `ParamFacePositionZIN` per Teto's vtube.json line 419. The IN-twin pattern matches the §5.3.1 architecture. This SHOULD work — but R-OPEN-1's prior IN-twin attempt didn't.
   - What's unclear: whether the rig has a deformer bound to ParamFacePositionZIN (downstream of the IN twin). The vtube.json route is "FacePositionZ → Lean Forward → ParamFacePositionZIN"; the rig's `.cmo3` source may or may not have the deformer.
   - Recommendation: this is the empirical question 04-00 smoke-pass answers. Cannot pre-resolve at research time. If `Lean Forward` doesn't produce visible motion, fall back to `exp3_modulation` (which requires authoring or finding a body-pose .exp3.json).

2. **Does Teto have any body-pose .exp3.json currently?**
   - What we know: 14 .exp3.json files; the ones inspected (`Star Eye`, `Cry`, `【SV】Mic`) have eye/face overlay parameters. `【SV】Mic` has `ParamRegHandsOFFRIN2`, `ParamSVMCON`, `ParamBHandIN` — the `BHand` (presumably "body hand") is body-region but it's a microphone-prop, not a body-tilt.
   - What's unclear: whether ANY existing .exp3.json modulates a body-pose parameter that the rig responds to.
   - Recommendation: planner's 04-00 task includes auditing all 14 .exp3.json files' Parameters lists and matching against any visible body-region params discovered in the param-list smoke. If no existing .exp3.json works, the `exp3_modulation` strategy needs a NEW authored .exp3.json file (small Cubism Editor task; could be a one-off by the dev OR ship without exp3_modulation and only present `proxy_param` + `head_only` as the ≥2 strategies for AVT-06).

3. **Is the VTS window title literally "VTube Studio" or does it carry a model-name suffix?**
   - What we know: Unity 6000 builds use `UnityWndClass`; the title is set by the application code.
   - What's unclear: whether VTS 1.32.71 currently formats as `"VTube Studio"` only or `"VTube Studio - <model>"`. Could not confirm without runtime.
   - Recommendation: 04-00 smoke-pass logs the exact `GetWindowText` value; planner uses `startswith("VTube Studio")` substring-match for safety.

4. **Should the strategy hot-switch (D-12) survive a sidecar restart, or reset to the `teto_overrides.yaml` default each launch?**
   - Reasonable defaults differ; D-12 specifies dev-only and `import.meta.env.DEV` gating. The planner can pick: the dev-panel selection is in-memory only (resets on relaunch) OR the dev-panel writes back to teto_overrides.yaml. The latter risks committing investigation-state; the former requires re-clicking after every iteration.
   - Recommendation: in-memory only for D-12; the investigation report (D-04) records the chosen default which gets manually written into teto_overrides.yaml after the per-strategy A/B is complete.

5. **One-Euro filter or EMA smoother for RMS → param math (§H)?**
   - One-Euro is documented to better preserve transients (e.g., consonant attacks in TTS); EMA smears them. For body-sway both are acceptable; for lipsync (which Phase 3 D-04 already specifies as linear interpolation between volumes[i] / volumes[i+1]) it's irrelevant.
   - Recommendation: EMA in the skeleton with α tuned per-strategy; one-Euro deferred to v1.5 if visual quality demands. Saves ~25 LOC.

---

## Sources

### Primary (HIGH confidence)
- [VTubeStudio API spec — DenchiSoft/VTubeStudio](https://github.com/DenchiSoft/VTubeStudio) — verified InjectParameterDataRequest schema; weight semantics for set vs add; ExpressionActivationRequest binary on/off + fadeTime; HotkeyTriggerRequest schema; InputParameterListRequest response; min refresh ≥1Hz; max-rate explicitly NOT documented for inject (only InputParameterListRequest has the 60+ FPS warning)
- [pyvts issue #51 — sending requests is actually blocking](https://github.com/Genteki/pyvts/issues/51) — race at vts.py:117-118; recommended fix pattern (read-loop + per-requestID Future)
- Read directly from `sidecar/vendor/pyvts/vts.py` (vendored 0.3.3) — confirmed `request()` body, auth flow, `read_token`/`write_token`, default config
- Read directly from `sidecar/vendor/pyvts/vts_request.py` — confirmed `requestSetParameterValue`, `requestSetMultiParameterValue`, `requestHotKeyList`, `requestTriggerHotKey`, `requestParameterValue`, `requestTrackingParameterList` signatures and their JSON schemas
- Read directly from `sidecar/vendor/pyvts/config.py` — default `vts_api` = `{"version":"1.0","name":"VTubeStudioPublicAPI","host":"localhost","port":8001}`
- Read directly from `Live2D/重音テト/重音テト.vtube.json` lines 73–409 (parameters), 424+ (hotkeys) — confirmed Z/X/Y → ParamAngleZIN/XIN/YIN routing; Auto Breath at 217 → ParamBreath; Lean Forward at 409 → ParamFacePositionZIN; 15 hotkeys all ToggleExpression (including 2 meta)
- Read directly from `Live2D/重音テト/Expressions/Star Eye.exp3.json`, `Cry.exp3.json`, `【SV】Mic.exp3.json` — confirmed .exp3.json schema: `{Type: "Live2D Expression", Parameters: [{Id, Value, Blend}]}`
- [pywin32 PyPI](https://pypi.org/project/pywin32/) — version 311 latest May 2026; cp312 wheels
- [opensimplex PyPI](https://pypi.org/project/opensimplex/) — version 0.4.5.1 latest May 2026; py3-none-any wheel; numpy hard-dep

### Secondary (MEDIUM confidence)
- [Microsoft Learn — DPI awareness](https://learn.microsoft.com/en-us/windows/win32/hidpi/dpi-awareness-context) — DPI virtualization breaks GetWindowRect/GetCursorPos coord parity unless process is DPI-aware
- [PhysicalToLogicalPointForPerMonitorDPI](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-physicaltologicalpointforpermonitordpi) — coord-system conversion functions if needed for legacy compatibility
- [Python tracker issue #45194 — asyncio scheduler jitter](https://bugs.python.org/issue45194) — confirms asyncio.sleep jitter accumulates as drift on Windows
- [pyvts 0.3.3 docs — Tutorial](https://genteki.github.io/pyvts/toctree2_tutorial.html) — auth flow timing; popup appears on first AuthenticationTokenRequest

### Tertiary (LOW confidence — flagged for runtime validation)
- VTS window class is `UnityWndClass` (inferred from Unity 6000 generic class name; not confirmed against current VTS 1.32.71 build) — runtime confirmation at 04-00 smoke-pass
- VTS window title is exactly `"VTube Studio"` without model-name suffix — runtime confirmation at 04-00 smoke-pass
- Strategy hot-switch tick-boundary gating doesn't introduce visible glitch — manual A/B verification during D-04 evidence capture

### Inherited Sources (HIGH confidence, already in project)
- `.planning/research/PITFALLS.md` Pitfalls 1, 2, 3, 4, 5, 8, 9, 10 — pre-Phase-4 pitfall catalog directly applicable
- `.planning/research/STACK.md` — version pins for entire stack
- `.planning/research/ARCHITECTURE.md` — sidecar→VTS direct pattern; module decomposition

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pywin32 311 + opensimplex 0.4.5.1 verified vs PyPI; both have py3-none-any (or cp312 specific) wheels
- Architecture: HIGH for the merge order, scheduler pattern, single-writer; MEDIUM for the precise sentence-end signal mechanism (§I open question)
- VTS API surface: HIGH — verified vs official spec for every message type used (InjectParameterDataRequest, HotkeysInCurrentModelRequest, HotkeyTriggerRequest, InputParameterListRequest, ParameterValueRequest, ExpressionActivationRequest, ExpressionStateRequest)
- Teto rig facts: HIGH — read directly from vtube.json + .exp3.json files
- pyvts issue #51 fix shape: HIGH — verified vs issue thread + reading the actual `vts.py:117-118` code
- DPI-awareness pitfall: HIGH — verified vs Microsoft docs
- Pitfalls (compositor-specific): HIGH for Pitfall 18 (verified vs VTS spec); HIGH for 19 (verified vs Microsoft DPI docs); MEDIUM for 20 (Unity class inferred); HIGH for 21 (concurrency reasoning); HIGH for 22 (sentence-end timing — flagged in Phase 3 Claude's-Discretion); HIGH for 23 (auth-popup timing verified vs pyvts source code); HIGH for 24 (compositor-vs-smoke-pass interaction)
- Test architecture: HIGH for unit-test surface; MEDIUM for the §14 manual SC verification methodology (Phase 5 owns this)

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days — VTS API + pyvts upstream both stable; pywin32/opensimplex slow-moving; revisit at any phase-5 amendment)
