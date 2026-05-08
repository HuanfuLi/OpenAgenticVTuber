---
phase: 04-action-compositor-vts-bridge-body-sway-investigation
verified: 2026-05-08T05:55:08Z
status: gaps_found
score: 5/6 must-haves code-supported; 1/6 blocked by code/data gap
re_verification:
  previous_status: gaps_found
  previous_score: 2/6
  gaps_closed:
    - "Sidecar Win32 cursor polling detects the VTS window bounds and compositor uses those samples for avatar eye/head tracking"
    - "Phase 5 can re-run body-sway evidence capture using the committed plotter against real [SPEECH-DRIVER] logs"
  gaps_remaining:
    - "An LLM reply containing [joy] makes Teto's joy expression smoothly blend in over ~300ms via weight fade and decay after the sentence ends, not a hotkey pop"
  regressions: []
gaps:
  - truth: "An LLM reply containing [joy] makes Teto's joy expression smoothly blend in over ~300ms via weight fade and decay after the sentence ends, not a hotkey pop"
    status: failed
    reason: "The IntentDriver now emits weighted set_params correctly, but the real Teto capabilities do not declare a joy expression. The orchestrator builds expression_names from avatars/teto/avatar.yaml, so [joy] is silently dropped before it reaches IntentDriver."
    artifacts:
      - path: "avatars/teto/avatar.yaml"
        issue: "Expression list contains Blush/chibi/Cry/Dark Eye/Dark Face/Dizzy/Exp eye/Love/Star Eye/Sweat/etc., but no joy entry or alias."
      - path: "sidecar/src/sidecar/orchestrator/transformers.py"
        issue: "actions_extractor only emits expression ActionIntent when bracket name is in capabilities.expressions; unknown tags are silently dropped."
      - path: "sidecar/src/sidecar/compositor/intent_driver.py"
        issue: "Smooth blend implementation is present, but it only runs for ActionIntents that reach the queue."
    missing:
      - "Add a real joy capability mapping/alias for Teto, e.g. map [joy] to an existing expression file such as Love.exp3.json or Star Eye.exp3.json, or change the extractor/plugin vocabulary so [joy] resolves before compositor dispatch."
      - "Add an integration test using the committed avatars/teto/avatar.yaml proving [joy] produces an expression ActionIntent and non-empty weighted set_params."
human_verification:
  - test: "Live VTS idle and speech motion"
    expected: "With VTS+Teto loaded, idle head/eye/blink motion is visible; mouth tracks TTS; speech-driven head/body motion continues through the utterance with no flat moments."
    why_human: "Visual VTS rendering, audio sync, and webcam-additive behavior require a running rig/operator."
  - test: "Live body-sway A/B re-run"
    expected: "Use the dev-panel body-sway radio to compare head_only and proxy_param, capture runtime logs/plots/clips, and replace deferred ratings."
    why_human: "The committed evidence package intentionally contains deferred stubs because live VTS was unavailable."
  - test: "Live discrete event demo"
    expected: "Sending fire-discrete-event:Star Eye [7] toggles the Star Eye VTS hotkey on the loaded Teto rig."
    why_human: "The dispatcher can be verified statically, but visible hotkey effect requires VTS."
---

# Phase 4: Action Compositor + VTS Bridge + Body-Sway Investigation Verification Report

**Phase Goal:** The §14 deliverable. Teto running in VTube Studio idles with visible micro-motion, speaks with synced lipsync, blends `[joy]` smoothly over ~300ms, sways head/body through utterances, tracks cursor per locked D-09/D-11 sidecar Win32 VTS-window contract, and demonstrates one discrete-event prop hotkey. Body-sway investigation is the deliverable.
**Verified:** 2026-05-08T05:55:08Z
**Status:** gaps_found
**Re-verification:** Yes - after gap-closure execution

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With VTS+Teto running, the avatar produces visible idle micro-motion continuously when idle. | ? HUMAN | `IdleDriver.tick()` emits continuous head/eye/blink values; `Compositor.run()` injects frames at 60 Hz. Live visual confirmation remains required. |
| 2 | During TTS, mouth tracks RMS and speech driver produces continuous body or head motion with no flat moments. | ? HUMAN | `SpeechMouthDriver` remains wired for lipsync, `SpeechDriver` consumes RMS envelopes and emits body strategy output. Live sync/motion quality remains operator verification. |
| 3 | `[joy]` blends smoothly over ~300ms via weight fade and decays after sentence end, not hotkey pop. | X FAILED | The hotkey-pop implementation was removed, but committed Teto capabilities do not include `joy`; `has_joy False` in the real tag vocabulary, so `[joy]` is dropped before `IntentDriver`. |
| 4 | Moving cursor over the detected VTS window makes eyes/head track and exiting eases back to center. | ? HUMAN | Code gap closed: `CursorDriver` uses sidecar Win32 samples and tests prove `ParamAngle*`/`ParamEyeBall*` output plus ease-back. Live VTS visibility still needs observation. |
| 5 | Pressing the test hotkey toggles one VTS prop/visibility event. | ? HUMAN | `DiscreteDispatcher.fire_by_name()` resolves `Star Eye [7]` from `teto_overrides.yaml` and calls `requestTriggerHotKey`; live rig toggle needs operator verification. |
| 6 | With active webcam feed, ambient/speech stay additive and intent uses set+weight only. | VERIFIED CODE | `Compositor` separates additive params from `set_params`; `IntentDriver` returns weighted set tuples. Webcam interaction still benefits from live spot-check. |

**Score:** 5/6 must-haves are code-supported; 1/6 has a blocking code/data gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `sidecar/src/sidecar/avatar/overrides.py` | TetoOverrides schema/loader | VERIFIED | Loads override YAML; missing file falls back to safe `head_only`. |
| `avatars/teto/teto_overrides.yaml` | Hotkey inventory and body-sway default | VERIFIED | `body_sway_strategy: head_only`; 15 hotkeys; 2 meta entries; `Star Eye [7]` demo target. |
| `sidecar/scripts/teto_smoke_pass.py` | Live smoke-pass CLI | VERIFIED/HUMAN | CLI exists; live operator run remains deferred by the committed notes. |
| `sidecar/src/sidecar/vts/pyvts_writer.py` | Single recv-loop writer for compositor/discrete path | VERIFIED | `_recv_loop()` is the only recv loop in this writer; compositor uses `inject_params()`. |
| `sidecar/src/sidecar/compositor/compositor.py` | 60 Hz merge loop | VERIFIED | Merges idle/speech/intent/cursor into `ParamFrame` add/set buckets. |
| `sidecar/src/sidecar/compositor/intent_driver.py` | Smooth expression overlay | PARTIAL | Emits weighted set params with 300ms in/600ms out, but real `[joy]` never reaches it without a Teto `joy` capability mapping. |
| `sidecar/src/sidecar/compositor/cursor_driver.py` | Cursor tracking | VERIFIED/HUMAN | Sidecar Win32 contract documented; tests cover tracking, dead-zone, and cubic ease-back. |
| `sidecar/src/sidecar/vts/window_detect.py` | VTS HWND and rect detection | VERIFIED/HUMAN | Tests cover cached HWND reuse and `force_reprobe=True`; real window behavior remains live check. |
| `sidecar/scripts/plot_speech_evidence.py` | Runtime log plotter | VERIFIED | Parses both runtime and legacy `[SPEECH-DRIVER]` formats, including `body_params`. |
| `.planning/skeleton-verification-evidence/04/` | Body-sway evidence package | PARTIAL/HUMAN | README, ratings, audit, stubs, and placeholder plots exist; live logs/clips must replace deferred artifacts. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `ws/server.py` | `PyvtsSafeWriter` | lifespan creates writer + handshake task | WIRED | Compositor and discrete dispatcher share the Phase 4 writer path. |
| `Compositor` | VTS parameter injection | `writer.inject_params(ParamFrame)` | WIRED | Add params use multi-parameter add; set params use value+weight. |
| `TTSTaskManager` | `SpeechDriver` | `compositor_speech_queue` | WIRED | Speech envelopes feed body strategy output. |
| `TTSTaskManager` | `SpeechMouthDriver` | dedicated `mouth_speech_queue` | WIRED | Existing Phase 3 lipsync path remains the live mouth driver; compositor speech is `emit_mouth=False` in server wiring. |
| `Orchestrator` | `IntentDriver` | `compositor_intent_queue` | PARTIAL | Queue is wired, but real `[joy]` is not extracted from committed Teto capabilities. |
| `AvatarCapabilities` | LLM/system tag vocabulary | `tag_vocabulary()` | NOT WIRED FOR JOY | Runtime check printed `has_joy False`; prompt examples mention `[joy]`, but actual vocabulary omits it. |
| `CursorDriver` | Win32 VTS window samples | `get_cursor_and_rect()` | WIRED | Gap closed by 04-06 tests/docs. |
| `SpeechDriver` | `plot_speech_evidence.py` | `[SPEECH-DRIVER] sentence_id=... body_params=[...]` | WIRED | Gap closed by 04-07 parser/tests. |
| WS control | discrete hotkey | `fire-discrete-event:Star Eye [7]` | WIRED/HUMAN | Code path present; live visible effect still requires VTS. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `IdleDriver` | add params | time/noise/blink scheduler | Yes | FLOWING |
| `SpeechDriver` | RMS/body params | `SpeechEnvelopePayload` queue | Yes | FLOWING; live visual effect unverified |
| `SpeechMouthDriver` | mouth parameter | same speech payload on mouth queue | Yes | FLOWING; live sync unverified |
| `actions_extractor` | expression `ActionIntent` for `[joy]` | `AvatarCapabilities.expressions` | No | DISCONNECTED for `[joy]`; real Teto capability list has no `joy` |
| `IntentDriver` | weighted set params | expression ActionIntent + exp3 file | Yes when intent exists | HOLLOW for required `[joy]` because upstream extractor drops it |
| `CursorDriver` | cursor-derived param deltas | Win32 cursor + VTS rect | Yes on Windows | FLOWING |
| `plot_speech_evidence.py` | RMS/body series | runtime SpeechDriver logs | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Gap-closure targeted tests | `cd sidecar; uv run pytest tests/compositor/test_intent_driver.py tests/compositor/test_cursor_driver.py tests/vts/test_window_detect.py tests/scripts/test_plot_speech_evidence.py -q` | `19 passed` | PASS |
| Orchestrator-supplied Phase 4 suite | `cd sidecar; uv run pytest tests/avatar/test_overrides.py tests/vts/ tests/compositor/ tests/test_phase4_bootstrap.py tests/scripts/test_plot_speech_evidence.py -q` | `59 passed` | PASS |
| Orchestrator-supplied regression suite | `cd sidecar; uv run pytest tests/test_sidecar_boot.py ... tests/test_speech_mouth_driver.py -q` | `46 passed, 1 skipped` | PASS |
| Teto override inventory | `load_overrides('../avatars/teto')` | `strategy head_only`; `hotkeys 15 meta 2` | PASS |
| Runtime evidence parser | `parse_log(head_only/log_capture.txt)` | returned one timestamp/RMS/body sample from deferred stub | PASS |
| Real Teto `[joy]` vocabulary | `load_capabilities('../avatars/teto').tag_vocabulary()` | `has_joy False` | FAIL |
| Pre-commit hook | `git hook run pre-commit` | no hook named `pre-commit` exists | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| AVT-01 | 04-02 | 60 Hz compositor sidecar-direct to VTS | SATISFIED | `Compositor` and `PyvtsSafeWriter.inject_params()` are wired in sidecar lifespan. |
| AVT-02 | 04-02 | Idle baseline continuous writes | SATISFIED/HUMAN | `IdleDriver` emits continuous params; live micro-motion still visual. |
| AVT-03 | 04-02, 04-05 | Speech additive; intent set+weight fade | SATISFIED CODE | Intent hotkey path removed; compositor uses set bucket for intent values. |
| AVT-04 | 04-01 | pyvts single-writer task | SATISFIED FOR PHASE 4 PATH | Compositor/discrete path uses `PyvtsSafeWriter`; Phase 3 mouth writer remains a separate legacy lipsync path. |
| AVT-05 | 04-01 | Renderer-aware ParamID resolver | SATISFIED | VTS branch maps standard IDs to VTS input names; non-VTS raises. |
| AVT-06 | 04-00, 04-02, 04-04, 04-07 | Body-sway investigation | HUMAN_NEEDED | Strategies/evidence package/tooling exist; live A/B still deferred. |
| AVT-07 | 04-00 | `teto_overrides.yaml` schema stub | SATISFIED | Override YAML exists with strategy, probes, hotkeys, notes. |
| AVT-08 | 04-02, 04-05 | `[joy]` smooth expression blend | BLOCKED | Smooth driver exists, but real Teto capability vocabulary omits `joy`; `[joy]` is not extracted. |
| AVT-09 | 04-01, 04-03 | One DiscreteEvent maps to VTS hotkey | SATISFIED/HUMAN | `Star Eye [7]` resolves to a VTS hotkey; live visual toggle unverified. |
| AVT-10 | 04-03, 04-06 | Sidecar Win32 cursor polling drives tracking | SATISFIED/HUMAN | D-09/D-11 contract is tested/documented; live visible tracking unverified. |

All requested Phase 4 IDs AVT-01 through AVT-10 are accounted for. No additional Phase 4 requirement IDs were found in `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `avatars/teto/avatar.yaml` | 10-32 | Missing `joy` expression/alias | Blocker | Required `[joy]` path is dropped by extractor and cannot blend. |
| `.planning/skeleton-verification-evidence/04/*/log_capture.txt` | 1 | `# DEFERRED` | Warning | Live body-sway evidence still must be captured before §14 sign-off. |
| `.planning/skeleton-verification-evidence/04/*/rating.md` | varies | deferred live ratings | Warning | Acceptable as investigation handoff, but not final live proof. |
| `sidecar/src/sidecar/ws/server.py` | 213 | `emit_mouth=False` | Info | Lipsync is still handled by the Phase 3 `SpeechMouthDriver`; compositor speech driver is body-only in current server wiring. |

### Human Verification Required

### 1. Live VTS Idle And Speech Motion

**Test:** Start the app with VTS+Teto loaded; send a multi-sentence TTS prompt.
**Expected:** Idle Perlin/blink motion is visible when silent; mouth tracks speech; head/body motion continues through the full utterance.
**Why human:** Static code cannot confirm rendered avatar motion, audio sync, or visual smoothness.

### 2. Body-Sway A/B Re-Run

**Test:** Use the dev-panel body-sway radio to compare `head_only` and `proxy_param`, capture `[SPEECH-DRIVER]` logs, regenerate plots, record 5-10s clips, and update ratings.
**Expected:** Either a non-fallback strategy is accepted with evidence or explicitly rejected after live observation; `head_only` remains documented fallback if none succeeds.
**Why human:** 04-04 used the documented deferred path because live VTS/operator verification was unavailable.

### 3. Discrete Event Demo

**Test:** Send `{"type":"control","text":"fire-discrete-event:Star Eye [7]"}` through the WS control path while VTS+Teto is running.
**Expected:** Teto toggles the Star Eye hotkey.
**Why human:** Code verifies dispatch; the visible rig effect requires a running VTS model.

### Gaps Summary

The prior gap-closure execution fixed the implementation-level hotkey-pop behavior in `IntentDriver`, locked the cursor implementation to the accepted D-09/D-11 sidecar Win32 contract, and aligned body-sway evidence tooling with real runtime speech-driver logs.

One code/data gap still blocks the phase goal: the real Teto capability vocabulary does not include `joy`, while AVT-08 and the phase goal require `[joy]` to produce the smooth expression blend. Until `[joy]` resolves to a real expression/alias in the committed avatar data and an integration test proves the actual pipeline, the phase remains `gaps_found`.

---

_Verified: 2026-05-08T05:55:08Z_
_Verifier: Claude (gsd-verifier)_
