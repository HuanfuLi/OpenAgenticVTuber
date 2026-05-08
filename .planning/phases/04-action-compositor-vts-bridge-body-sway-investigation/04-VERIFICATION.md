---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
verified: 2026-05-08T04:56:11Z
status: gaps_found
score: 2/6 must-haves verified
gaps:
  - truth: "An LLM reply containing [joy] makes Teto's joy expression smoothly blend in over ~300ms via weight fade and decay after the sentence ends, not a hotkey pop"
    status: failed
    reason: "IntentDriver stores active intents but returns no set-param output; it triggers VTS hotkeys on intent start/end, which is explicitly the hotkey-pop path AVT-08 forbids."
    artifacts:
      - path: "sidecar/src/sidecar/compositor/intent_driver.py"
        issue: "tick() returns {}, never emits weighted expression params; _fire_hotkey uses requestTriggerHotKey."
      - path: "sidecar/tests/compositor/test_intent_driver.py"
        issue: "Tests assert hotkey triggering rather than smooth 300ms parameter-weight ramp behavior."
    missing:
      - "Implement expression intent as weighted ParamFrame set_params with 300ms ramp-in and sentence-end decay."
      - "Add tests proving [joy] produces non-empty weighted set_params over time and does not call HotkeyTriggerRequest."
  - truth: "Cursor-in-canvas renderer overlay emits ActionIntent(kind='reaction') events to the sidecar and compositor uses those events for avatar eye/head tracking"
    status: failed
    reason: "AVT-10 requires a React overlay -> ActionIntent reaction path, but the implementation is sidecar-side Win32 polling of the VTube Studio window with no renderer overlay or reaction event."
    artifacts:
      - path: "sidecar/src/sidecar/compositor/cursor_driver.py"
        issue: "Polls get_cursor_and_rect() directly and returns param deltas; no ActionIntent input path."
      - path: "sidecar/src/sidecar/ws/handlers.py"
        issue: "No cursor/reaction WS control or ActionIntent handler exists."
      - path: "apps/renderer/src/dev/DevPanel.tsx"
        issue: "Only body-sway controls were added; no avatar canvas overlay cursor emitter was found."
    missing:
      - "Add renderer overlay cursor events or update requirements/roadmap if the sidecar Win32 rewrite intentionally supersedes AVT-10."
      - "Wire cursor events into sidecar as ActionIntent(kind='reaction') or equivalent documented contract."
  - truth: "Phase 5 can re-run body-sway evidence capture using the committed plotter against real [SPEECH-DRIVER] logs"
    status: failed
    reason: "The plotter expects '[SPEECH-DRIVER strategy=... body_params=[...]]', but SpeechDriver logs '[SPEECH-DRIVER] sentence_id=... strategy=...' and omits body_params, so live logs will not parse."
    artifacts:
      - path: "sidecar/src/sidecar/compositor/speech_driver.py"
        issue: "Log format does not match plot_speech_evidence.py and does not include body strategy output values."
      - path: "sidecar/scripts/plot_speech_evidence.py"
        issue: "Regex matches only the deferred stub format, not actual runtime logs."
    missing:
      - "Align SpeechDriver log format with the evidence parser or make the parser accept the actual runtime format."
      - "Log body_params emitted by the active strategy for evidence plots."
human_verification:
  - test: "Live VTS idle and speech motion"
    expected: "With VTS+Teto loaded, idle Perlin/blink motion is visible, mouth tracks TTS RMS, and speech-driven head/body motion has no flat moments."
    why_human: "Visual avatar motion and VTS/plugin interaction cannot be confirmed from static code; 04-04 explicitly used the deferred path."
  - test: "Live body-sway A/B re-run"
    expected: "Use the dev-panel body-sway radio to compare head_only and proxy_param on the same TTS prompt, capture logs, plots, and 5-10s clips, then update ratings."
    why_human: "The committed evidence is deferred stubs and placeholder plots because live VTS/operator verification was unavailable."
  - test: "Live discrete event demo"
    expected: "Sending control text fire-discrete-event:Star Eye [7] toggles the Star Eye VTS hotkey on the running Teto rig."
    why_human: "The dispatcher and hotkey inventory are present, but VTS hotkey visibility requires a running rig."
---

# Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation Verification Report

**Phase Goal:** Action compositor + VTS bridge + body-sway investigation for avatar control, including VTS infrastructure, compositor/body-sway strategies, cursor tracking, discrete demo path, and body-sway evidence/deferred re-run path.
**Verified:** 2026-05-08T04:56:11Z
**Status:** gaps_found
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With VTS+Teto running, the avatar produces visible idle micro-motion continuously when idle. | ? HUMAN | `IdleDriver.tick()` emits head/eye/blink values continuously; `Compositor.run()` ticks at 60Hz and injects frames. Visual confirmation deferred. |
| 2 | During TTS, mouth tracks RMS and speech driver produces continuous body or head motion with no flat moments. | ? HUMAN | Phase 3 mouth driver remains wired; `SpeechDriver` consumes `SpeechEnvelopePayload` and `head_only` emits head/position values. Live VTS evidence was deferred. |
| 3 | `[joy]` blends smoothly over ~300ms via weight fade and decays after sentence end, not hotkey pop. | X FAILED | `IntentDriver.tick()` returns `{}` and `_fire_hotkey()` calls `requestTriggerHotKey`; tests assert hotkey calls. |
| 4 | Moving cursor over avatar canvas makes eyes/head track and exiting eases back to center. | X FAILED | Sidecar Win32 polling implementation can produce tracking values, but AVT-10's renderer overlay -> `ActionIntent(kind="reaction")` path is absent. |
| 5 | Pressing the test hotkey toggles one VTS prop/visibility event. | ? HUMAN | `DiscreteDispatcher.fire_by_name()` resolves `Star Eye [7]` from `teto_overrides.yaml` and calls VTS hotkey trigger; live rig confirmation still needed. |
| 6 | With active webcam feed, ambient/speech stay additive and intent uses set+weight only. | X FAILED | Ambient/speech add path exists, but intent is a hotkey trigger rather than set+weight ParamFrame output. |

**Score:** 2/6 truths verified or code-supported without blockers. Remaining items are failed or require live VTS verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `sidecar/src/sidecar/avatar/overrides.py` | TetoOverrides schema/loader | VERIFIED | Loads missing/default files, validates YAML, enforces meta hotkey exclusion. |
| `avatars/teto/teto_overrides.yaml` | Hotkey inventory and body-sway default | VERIFIED | Contains `body_sway_strategy: head_only`, 15 hotkeys, 2 meta entries, and deferred investigation note. |
| `sidecar/scripts/teto_smoke_pass.py` | Live VTS smoke-pass CLI | VERIFIED | Probes Lean Forward/Auto Breath, discovers hotkeys, writes overrides. Live run remains operator work. |
| `packages/contracts/py/contracts/param_frame.py` and `packages/contracts/ts/param-frame.ts` | ParamFrame contracts | VERIFIED | Python and TS mirrors exist for add/set params. |
| `packages/contracts/py/contracts/discrete_event.py` and `packages/contracts/ts/discrete-event.ts` | DiscreteEvent contracts | VERIFIED | Python and TS mirrors exist. |
| `sidecar/src/sidecar/vts/pyvts_writer.py` | Single recv-loop VTS writer | VERIFIED | One websocket recv loop dispatches by requestID; `inject_params()` sends add and set requests. |
| `sidecar/src/sidecar/compositor/compositor.py` | 60Hz merge loop | VERIFIED | Merges idle, speech, intent, cursor and injects ParamFrame. |
| `sidecar/src/sidecar/compositor/intent_driver.py` | Smooth expression overlay | X STUB/WRONG BEHAVIOR | Defines ramp constants but emits no weighted params and uses VTS hotkeys. |
| `sidecar/src/sidecar/compositor/cursor_driver.py` | Cursor tracking | PARTIAL | Implements Win32 VTS-window polling and ease-back; not the AVT-10 renderer overlay/reaction path. |
| `.planning/skeleton-verification-evidence/04/` | Body-sway evidence/deferred path | PARTIAL | README, ratings, audit, stubs, and placeholder plots exist; live evidence absent by design. |
| `sidecar/scripts/plot_speech_evidence.py` | Re-run plotter | X BROKEN LINK | Imports, but regex does not match actual `SpeechDriver` log format. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ws/server.py` | `PyvtsSafeWriter` | lifespan creates writer + background handshake | WIRED | `Compositor` receives the writer and calls `inject_params()`. |
| `Compositor` | VTS parameter injection | `writer.inject_params(ParamFrame)` | WIRED | Add params use multi-parameter add; set params use single set request with weight. |
| `TTSTaskManager` | `SpeechDriver` | `compositor_speech_queue.put(SpeechEnvelopePayload)` | WIRED | Speech envelopes are queued before audio write. |
| Orchestrator extracted actions | `IntentDriver` | `compositor_intent_queue.put(intent)` | WIRED BUT WRONG BEHAVIOR | Queue is wired, but driver turns expressions into hotkey triggers. |
| DevPanel | body-sway strategy swap | `control` message `set-body-sway-strategy:<name>` | WIRED | Handler requests compositor strategy swap. |
| DevPanel/UI | discrete event demo | `fire-discrete-event:<name>` | PARTIAL | Sidecar handler exists, but no visible UI control was added; manual WS message can trigger it. |
| Renderer overlay | cursor reaction intent | none found | NOT WIRED | No React overlay or cursor ActionIntent path found. |
| Evidence plotter | runtime speech logs | regex matching | NOT WIRED | Actual log format differs from parser expectation. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `Compositor` | `ParamFrame.add_params/set_params` | Driver ticks plus queued speech/intents | Yes | FLOWING for idle/speech/cursor; intent contributes no data. |
| `SpeechDriver` | `_current` / RMS / strategy output | `TTSTaskManager` speech envelope queue | Yes | FLOWING; live visual effect still unverified. |
| `IntentDriver` | `_active` expressions | Orchestrator `ActionIntent` queue | Partial | HOLLOW for smooth blend: state exists, but rendered output is `{}` and only hotkeys are fired. |
| `CursorDriver` | cursor-derived param deltas | Win32 `GetCursorPos` + VTS window rect | Yes on Windows | FLOWING for sidecar polling path; disconnected from AVT-10 renderer event path. |
| `plot_speech_evidence.py` | RMS/body series | `log_capture.txt` | No for real logs | HOLLOW: parser matches deferred stub format, not runtime `SpeechDriver` logs. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 4 targeted tests | `cd sidecar; uv run pytest tests/avatar/test_overrides.py tests/vts/ tests/compositor/ tests/test_phase4_bootstrap.py -q` | `52 passed` | PASS |
| Regression gate supplied by user | `cd sidecar; uv run pytest tests/test_sidecar_boot.py ... tests/test_speech_mouth_driver.py -q` | `46 passed, 1 skipped` | PASS |
| Overrides load with expected inventory | `cd sidecar; uv run python -c "...load_overrides(...)"` | `head_only 15 2` | PASS |
| Evidence plotter import | `cd sidecar; uv run python -c "import scripts.plot_speech_evidence as p; ..."` | Import passed | PASS, but parser/log format mismatch remains |
| Live VTS avatar behavior | Not run | Requires VTS+Teto/operator | SKIP/HUMAN |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AVT-01 | 04-02 | 60Hz compositor sidecar-direct to VTS | SATISFIED | `Compositor.run()` + `PyvtsSafeWriter.inject_params()` in sidecar lifespan. |
| AVT-02 | 04-02 | Idle baseline continuous writes | SATISFIED | `IdleDriver.tick()` emits continuous add params; compositor ticks at 60Hz. |
| AVT-03 | 04-02 | Speech additive; intent set+weight fade | BLOCKED | Speech/add path exists, but intent uses hotkeys and no weighted set output. |
| AVT-04 | 04-01 | pyvts single-writer task | SATISFIED | `_recv_loop()` is the only recv loop and request futures are keyed by requestID. |
| AVT-05 | 04-01 | Renderer-aware ParamID resolver | SATISFIED | VTS maps standard Live2D IDs to input-layer names; non-VTS raises `NotImplementedError`. |
| AVT-06 | 04-00, 04-02, 04-04 | Body-sway investigation | HUMAN_NEEDED | Strategies and deferred evidence package exist; live VTS A/B was not run. |
| AVT-07 | 04-00 | `teto_overrides.yaml` schema stub | SATISFIED | Override file exists with schema fields, hotkeys, and notes. |
| AVT-08 | 04-02 | `[joy]` smooth expression blend, not hotkey pop | BLOCKED | Actual implementation uses `requestTriggerHotKey`; no smooth param output. |
| AVT-09 | 04-01, 04-03 | One DiscreteEvent maps to VTS hotkey | SATISFIED/HUMAN | Dispatcher and `Star Eye [7]` inventory exist; live rig toggle needs operator. |
| AVT-10 | 04-03 | Cursor-in-canvas overlay emits reaction intents | BLOCKED | Implemented as sidecar Win32 polling; no renderer overlay or reaction event path. |

No additional Phase 4 requirement IDs were found in `REQUIREMENTS.md` beyond AVT-01 through AVT-10.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `sidecar/src/sidecar/compositor/intent_driver.py` | 54 | `return {}` from tick | Blocker | Smooth expression output is hollow; active intents never become weighted params. |
| `sidecar/src/sidecar/compositor/intent_driver.py` | 103 | `requestTriggerHotKey` | Blocker | Violates AVT-08 "not a hotkey pop". |
| `.planning/skeleton-verification-evidence/04/*/log_capture.txt` | 1 | `# DEFERRED` | Warning | Live body-sway evidence is intentionally absent and must be re-run. |
| `sidecar/scripts/plot_speech_evidence.py` | 23 | parser expects stub log shape | Blocker for evidence path | Phase 5 re-run logs from current code will not parse. |
| `sidecar/src/sidecar/ws/server.py` | 37 | `TODO Phase 5` | Info | Pre-existing LLM config handoff TODO, not a Phase 4 blocker. |

### Human Verification Required

### 1. Live VTS Idle And Speech Motion

**Test:** Start renderer + sidecar with VTS+Teto loaded; send a multi-sentence TTS prompt.
**Expected:** Idle head/eye/blink motion continues when silent; mouth tracks speech; head/body motion continues through the utterance with no flat moments.
**Why human:** Visual VTS motion and speech synchronization require a running rig and operator observation.

### 2. Body-Sway A/B Re-Run

**Test:** Use the dev-panel body-sway radio to compare `head_only` and `proxy_param`, capture `[SPEECH-DRIVER]` logs, regenerate plots, record 5-10s clips, and update ratings.
**Expected:** Either a non-fallback strategy is accepted with evidence or explicitly rejected after live observation; `head_only` remains the documented fallback if none succeeds.
**Why human:** 04-04 used the documented deferred path because live VTS/operator verification was unavailable.

### 3. Discrete Event Demo

**Test:** Send `{"type":"control","text":"fire-discrete-event:Star Eye [7]"}` through the WS control path while VTS+Teto is running.
**Expected:** Teto toggles the Star Eye hotkey.
**Why human:** Code can verify request dispatch, not the visible rig effect.

## Gaps Summary

Phase 4 delivered a substantive compositor/VTS foundation, override schema, strategy registry, discrete dispatcher, and deferred body-sway evidence package. It does not yet achieve the full phase goal because the `[joy]` expression path is a hotkey trigger rather than a smooth weighted blend, the AVT-10 cursor overlay/reaction event contract is absent, and the body-sway evidence re-run tooling is not aligned with actual speech-driver logs.

The deferred live VTS body-sway path is documented and should be treated as human verification before any final §14 sign-off.

---

_Verified: 2026-05-08T04:56:11Z_
_Verifier: Claude (gsd-verifier)_
