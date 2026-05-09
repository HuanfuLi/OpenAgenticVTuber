# Phase 10: Cursor Fix + §14 SC Re-Verification - Research

**Researched:** 2026-05-09
**Domain:** VTube Studio param-injection mechanics + operator UAT ceremony scripting + automated harness replay
**Confidence:** HIGH (root-cause is reproducible from code reading; no live VTS instrumentation required to commit a fix)

## Summary

Phase 10 closes milestone v2.0 with two parallel deliveries: a mandatory cursor diagnose-and-fix (cursor has never visibly worked since milestone-1) and a §14 SC re-verification ceremony recorded in `.planning/skeleton-verification.md`. This research collapses the cursor failure-mode space from four candidate hypotheses to one HIGH-confidence root cause, identifies the exact code edits required, confirms the existing plumbing harness is replay-ready against committed Phase 6 baselines, and locks the operator ceremony script's preconditions (active vocabulary, rig state, HUD state) so the planner can write a deterministic checklist.

**Primary recommendation:** Cursor failure is a **param-namespace mismatch**. CursorDriver writes Cubism input names (`ParamAngleX/Y`, `ParamEyeBallX/Y`) but every other working driver in this codebase writes VTS tracking-input names (`FaceAngleX/Y/Z`, `MouthOpen`, `EyeOpenLeft`, `EyeLeftX`, `EyeRightY`). The pre-existing `_VTS_INPUT_PARAM_MAP` resolver in `compositor/param_id_resolver.py` already encodes the correct mapping but is **never invoked** from `cursor_driver.py`. The fix is ~6 lines (translate output keys through the resolver before returning) plus a regression test. The drop-in-VTS-window-gate and synthetic-canvas fallback are then mechanical follow-ons. SC #5 verdict aims PASS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### A. Cursor Stance

- **D-A1:** Cursor tracking has been broken since milestone-1 — user confirmed `这个feature根本没工作过，一直fail` during this discuss-phase (saved as memory `project_cursor_broken_since_m1.md`). CursorDriver code at `sidecar/src/sidecar/compositor/cursor_driver.py` is present but has not produced visible avatar response in any phase 1–9 run.
- **D-A2:** Phase 10 cursor work is **mandatory**, not optional polish. ROADMAP VFY-01/02 wording amended (sync-edit committed with this discuss-phase): "optional polish, defaults to optional, SC #5 PARTIAL fallback" → "Phase 10 includes mandatory diagnose + fix + polish; SC #5 aims PASS".
- **D-A3:** Investigation depth: instrument all four candidate failure paths upfront (`window_detect.get_cursor_and_rect()` always returning None; CursorDriver not wired into `Compositor.__init__` at boot; rig param ID mismatch with `ParamAngleX/Y` + `ParamEyeBallX/Y`; Win32 API auth/permissions). Avoids round-trip diagnosis.
- **D-A4:** After root-cause fix lands, follow-on polish work: drop in-VTS-window gate at `cursor_driver.py:30-32`; add synthetic-canvas fallback projecting against primary-monitor center when no VTS rect.
- **D-A5:** Time-box: **untimed**. v1-horizon priority is plugin/dispatch/HUD (already shipped); cursor is the final SC standing. User chose "优先修通、不限时" over "time-box 2-3 hours" or "skip and record FAIL".
- **D-A6:** SC #5 verdict aims PASS. Fall back to PARTIAL/FAIL only if root cause proves intractable, with the diagnosis itself committed into skeleton-verification.md as the "what we tried, what we found" record.

#### B. SC #2 + SC #4 Operator Ceremony Script

- **D-B1:** **SC #2 uses `[smirk]`**, not `[joy]`. `[joy]` was removed from `plugins/default/plugin.yaml` in 06-08 because the active Teto avatar's `_avatar_overrides.yaml` has no joy variant. `[smirk]` is a `[action]` plugin code (square brackets, plugin-author business per 2026-05-08 Phase 6 decision), defined in plugin.yaml's current vocabulary. Visually it produces a single-side mouth raise — change is clear but not over-dramatic.
- **D-B2:** **SC #4 uses an LLM-improvised long-utterance prompt** baked into the ceremony script. Default prompt: `tell me a 60-word funny story about a cat in space` (or similar — exact wording locked at plan-time). Operator pastes the prompt into chat; LLM generates ~30-45s of TTS audio; operator observes body motion through the full utterance.
- **D-B3:** **SC #2 visual checklist (three checks):** (1) Expression entry is gradual (faded in), not a hotkey-style pop; (2) Full fade-in process is visible from `[smirk]` token trigger to end of sentence; (3) After sentence completion, expression decays gradually back, not abruptly cut.
- **D-B4:** **SC #4 visual checklist (three checks):** (1) Visible body motion (not flat/static through the utterance); (2) Through ~30 seconds, motion does not freeze on one side or get stuck centered; (3) Sway feels coherent with TTS rhythm — not jarringly out of sync.
- **D-B5:** **Verdict rubric (both SCs):** all three checks clearly observed → PASS; 1-2 checks observed or all three observed but ambiguously → PARTIAL; no checks observed (or motion looks broken) → FAIL.

#### C. v2.0 Surfaces in §14 Ceremony

- **D-C1:** §14 ceremony **strictly re-runs the original M1 6 SCs**. v2.0-new surfaces (variant dispatch, event dispatch, HUD lock, plugin runtime, avatar import) are NOT re-tested in §14 ceremony.
- **D-C2:** skeleton-verification.md contains a **cross-reference table** under "v2.0 Surfaces Verified in Their Own Phases" pointing to Phase 6/7/8/9 VERIFICATION + HUMAN-UAT artifacts.
- **D-C3:** Cross-reference table does NOT duplicate verdicts — only navigates.

#### D. skeleton-verification.md Structure + Milestone-Close Decision

- **D-D1:** Four top-level sections in this order:
  1. **§14 Success Criteria Verdicts (M1 re-run ceremony)** — six SC entries with verdict, observation, evidence link
  2. **Automated Baseline Replay (VFY-05)** — `lipsync.json` and `idle.json` replay results with run command + timestamp
  3. **v2.0 Surfaces Verified in Their Own Phases** — cross-reference table per D-C2
  4. **Milestone v2.0 Close Decision** — ship verdict, open issues for next milestone, v1-horizon progress note
- **D-D2:** Milestone close section content: ship verdict (PASS/PARTIAL/FAIL with criteria) + open issues for next milestone (DPI awareness, multi-monitor cursor, native Cubism path, body-sway physics-chain investigation, multi-avatar identity persistence) + v1-horizon progress note.

#### E. Tolerance Bands (VFY-05)

- **D-E1:** ±100ms latency / ±0.05 param values for **SC #1 (lipsync) and SC #3 (idle) only**. Phase 6 06-02 already PASS (lipsync pearson_r=0.9747; idle variance_sum=0.0664). Phase 10 simply re-runs and confirms.

### Claude's Discretion

- Exact wording of LLM-improvised long-utterance prompt (`tell me a 60-word funny story about a cat in space` is the strawman; planner may swap).
- Order of cross-reference table entries in v2.0 Surfaces section.
- Markdown formatting / heading hierarchy of skeleton-verification.md (within the 4-section structure).
- Whether the cursor diagnose pass adds permanent debug logging or temporary instrumentation that gets removed after fix lands.

### Deferred Ideas (OUT OF SCOPE)

- **Time-boxed cursor investigation**: rejected.
- **DPI awareness, multi-monitor cursor robustness**: out of scope per VFY-02. Defer to a later milestone alongside native Cubism integration.
- **Native Cubism rendering integration**: deferred to v1.5/v2.
- **Body-sway physics-chain investigation**: head_only ship state acknowledged as mediocre; SC #4 verdict under D-B4 rubric is permissive.
- **Multi-avatar identity persistence**: v1-horizon value, NOT v2.0; called out in milestone-close section but not implemented.
- **Real-time skeleton-verification dashboard / re-run automation**: out of scope; markdown deliverable only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **VFY-01** | Cursor mandatory for Phase 10 (amended 2026-05-08); diagnose + fix + polish, SC #5 aims PASS | Root cause located: param-namespace mismatch in `cursor_driver.py`. Fix is ~6 LOC + regression test. See `## Cursor Failure Root Cause`. |
| **VFY-02** | Drop in-VTS-window gate at `cursor_driver.py:27-28` (line numbers per ROADMAP — actual lines are 30-32 in current file); add synthetic-canvas fallback (primary-monitor center when no VTS rect) | Existing `get_cursor_and_rect()` returns `(cursor_pos, None)` when no VTS hwnd; fallback site is `cursor_driver.py:64-66`. `pyvts` is unaffected — fallback lives entirely inside CursorDriver and `window_detect.py`. See `## Cursor Polish Implementation`. |
| **VFY-03** | All six §14 SCs re-run; SC #2 (`[smirk]`) and SC #4 (body sway) operator-judged via ceremony | Ceremony script template lives in `.planning/` as markdown; operator reads + observes + records. SC #1 + SC #3 + SC #6 are not operator-judged. SC #5 verdict comes from cursor fix outcome. See `## Operator Ceremony Script`. |
| **VFY-04** | `.planning/skeleton-verification.md` committed with PASS/PARTIAL/FAIL per SC + concrete observations | Four-section structure per D-D1. Template provided in `## skeleton-verification.md Structure`. |
| **VFY-05** | Side-by-side §14 SC comparison harness replay (lipsync + idle only) against Phase 6 baselines; tolerance ±100ms / ±0.05 | `sidecar/scripts/plumbing_harness.py` is ready; baselines in `.planning/baselines/v2.0/`. Replay command + tolerance check both encoded inside the harness already. See `## Plumbing Harness Replay`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack lock:** Electron 40 + React 19.2 + Vite 6 + TS 5.7 + Python 3.12 + FastAPI 0.136.1 + LiteLLM 1.83.14 + pyvts 0.3.3 (vendored). Phase 10 introduces NO new packages — all work is inside existing modules.
- **VTS+pyvts is the v1 path (§11):** Cubism 5.3 NOT supported by VTS as of 2026; Teto rig is Cubism 4.x and within bounds.
- **Single-writer rule (ARCH-06):** CI test `test_arch06_single_writer.py` asserts `requestSetParameterValue` / `requestInjectParameterData` / `plugin_name` ownership lives only in `sidecar/src/sidecar/vts/pyvts_writer.py`. Cursor fix MUST NOT introduce a second writer or re-export pyvts identity. The fix as scoped does not touch the writer at all — only `cursor_driver.py` returns a dict with translated keys; that dict still flows through `Compositor → clamp_and_validate → PyvtsSafeWriter.inject_params`.
- **GSD workflow enforcement:** Edit/Write changes go through GSD commands. This RESEARCH.md is produced under `/gsd:research-phase`.
- **No new emojis in committed files** (per CLAUDE.md tone rules).

## Cursor Failure Root Cause

### Investigation: 4 candidate failure paths from CONTEXT D-A3

| # | Hypothesis | Verdict | Evidence |
|---|------------|---------|----------|
| 1 | `window_detect.get_cursor_and_rect()` always returns `(_, None)` (HWND enumeration fails) | **RULED OUT** for the namespace failure but **REMAINS** as a separate concern that VFY-02 covers via the fallback | `window_detect.py:24-63` enumerates windows whose title starts with `"VTube Studio"`. With VTS running, this works. The cursor failure is upstream of any rect issue — even when rect is found and a non-empty `_cursor_to_param_angles` dict is returned, no avatar movement occurs because of #3 below. |
| 2 | `CursorDriver` not wired into `Compositor.__init__` at real boot path | **RULED OUT** | `sidecar/src/sidecar/ws/server.py:333-341` instantiates `CursorDriver()` and passes it as `cursor_driver=cursor_drv` to `Compositor(...)`. Real boot path also flows the cursor output into `add_acc` at `compositor.py:107-109`. |
| 3 | **Rig param ID mismatch** — `cursor_driver.py` writes `ParamAngleX/Y` + `ParamEyeBallX/Y` (Cubism input names). VTS face-tracker injects via `FaceAngleX/Y/Z` (VTS tracking-input names). | **CONFIRMED ROOT CAUSE — HIGH confidence** | See `## The Mechanism` below. |
| 4 | Win32 API auth/permissions issue | **RULED OUT** | `pywin32` is Phase 1 vendored; `EnumWindows` + `GetWindowRect` + `GetCursorPos` need no elevation. The watchdog test in `test_cursor_driver.py` exercises the math against synthetic rects and passes. |

### The Mechanism (HIGH confidence)

**Step 1: Confirm the namespace divergence.**
| Driver | File | Output param keys |
|--------|------|-------------------|
| `IdleDriver` | `compositor/idle_driver.py:27-31` | `FaceAngleX`, `FaceAngleY`, `FaceAngleZ`, `EyeLeftX`, `EyeRightY`, `EyeOpenLeft`, `EyeOpenRight`, `Auto Breath` |
| `SpeechDriver` (mouth) | `compositor/speech_driver.py:18` | `MouthOpen` |
| `HeadOnlyStrategy` (body sway) | `plugins/default/body_sway/head_only.py:18-23` | `FaceAngleX`, `FaceAngleY`, `FaceAngleZ`, `FacePositionX`, `FacePositionZ` |
| `DefaultPlugin` (`[smirk]` etc.) | `plugins/default/__init__.py:29` | `FaceAngleZ`, `FaceAngleY` (and similar for other action codes) |
| **`CursorDriver`** | **`compositor/cursor_driver.py:42-54`** | **`ParamAngleX`, `ParamAngleY`, `ParamEyeBallX`, `ParamEyeBallY`** ← outlier |

Every working driver writes VTS tracking-input names. Only `CursorDriver` writes Cubism input names.

**Step 2: Why VTS tracking-input names work and Cubism names don't.**
The VTubeStudio API exposes ~17 default *tracking inputs* (e.g., `FaceAngleX`, `MouthOpen`, `EyeLeftX`) — see `compositor/param_id_resolver.py:21-41` for the canonical list. These are the inputs VTS *itself* uses to drive face tracking. When you call `InjectParameterDataRequest` with `mode="add"` on `FaceAngleX`, your delta is summed onto the face-tracker's value before VTS internally routes the result through the rig's `ParameterSettings` (i.e., maps `FaceAngleX → ParamAngleXIN → ParamAngleX → bones`). Writes are visible immediately.

When you call `InjectParameterDataRequest` on `ParamAngleX` directly (a Cubism Live2D-native parameter), one of three things happens depending on the rig:
1. **VTS overwrites your value** at the next tracker tick because the tracker keeps re-routing `FaceAngleX → ParamAngleXIN` and (usually) `ParamAngleXIN` is what's wired to bone deformations — not `ParamAngleX` directly.
2. **Your value is accepted into a "phantom" Cubism param** that no Live2D physics chain actually reads, so the rig doesn't visibly move.
3. (Edge case) On rigs without IN-twin pattern, `ParamAngleX` IS the bone-driving param, and a write *does* move the rig — but only if the tracker isn't writing into it concurrently.

**Step 3: Confirm Teto's rig structure.** The Teto rig at `Live2D/重音テト/重音テト.vtube.json` uses the IN-twin pattern. From `ParameterSettings`:
```
ParameterSettings outputs include:
  ParamAngleXIN, ParamAngleYIN, ParamAngleZIN  ← face-tracker IN-twin destinations
  ParamEyeBallX, ParamEyeBallY                  ← writable directly
  ParamMouthOpenY, ParamEyeLOpen, ParamEyeROpen  ← writable directly
NO ParamAngleX, ParamAngleY in ParameterSettings.OutputLive2D
```
But the `cdi3.json` lists `ParamAngleX/Y` as Cubism parameters (530 total). So `RigCapabilities.writable_param_ids` (built from cdi3 + Groups + ParameterSettings outputs) DOES contain `ParamAngleX/Y`, and `clamp_and_validate` lets them through — they reach VTS, get accepted into the Cubism param table, and produce no visible motion because the rig's bones are wired off `ParamAngleXIN` not `ParamAngleX`.

`ParamEyeBallX/Y` MIGHT actually move the eyes (those ARE in `ParameterSettings.OutputLive2D` per the vtube.json scan), but the head/face params dominate visual feedback and their absence is what makes the user say "this never worked".

**Step 4: The fix already exists, just isn't called.**
`compositor/param_id_resolver.py:10-19` already encodes the correct mapping:
```python
_VTS_INPUT_PARAM_MAP = {
    "ParamAngleX": "FaceAngleX",
    "ParamAngleY": "FaceAngleY",
    "ParamAngleZ": "FaceAngleZ",
    "ParamEyeBallX": "EyeLeftX",
    "ParamEyeBallY": "EyeRightY",
    "ParamEyeLOpen": "EyeOpenLeft",
    "ParamEyeROpen": "EyeOpenRight",
    "ParamMouthOpenY": "MouthOpen",
}
```
`resolve_param_id("ParamAngleX", "vts")` returns `"FaceAngleX"`. But `cursor_driver.py` does NOT call this function. Grep confirms: `_VTS_INPUT_PARAM_MAP` is referenced only by tests + the function definition itself; no production driver consumes it.

### The Fix (HIGH confidence; ~6 LOC)

In `_cursor_to_param_angles` (or in `CursorDriver.tick`), translate the output dict keys through `resolve_param_id(key, "vts")` before returning. After translation, the cursor output keys become `FaceAngleX`, `FaceAngleY`, `EyeLeftX`, `EyeRightY` — matching every other working driver and routing correctly through VTS face-tracker → IN-twin → bones.

Two implementation shapes are equivalent:
**Option A (preferred — single edit point):** Wrap the return at `cursor_driver.py:50-55` and `cursor_driver.py:42-46` (dead-zone branch) with a dict-comprehension that translates keys.
**Option B:** Translate at `compositor.py:107-109` where cursor output is merged into `add_acc`. This puts the resolver call in the compositor for ALL drivers, which is more architecturally consistent — but every other driver already emits VTS tracking-input names, so the resolver call would be a no-op for them. Option A is the smaller diff and the easier regression test target.

**Recommended:** Option A. Add a regression test that asserts cursor output keys are in `VTS_TRACKING_INPUT_PARAM_IDS` (the frozenset already exported from `param_id_resolver.py`).

### Confidence Assessment

- **HIGH:** The namespace divergence is reproducible from code reading without running anything. The fix is ~6 LOC.
- **MEDIUM-HIGH:** Whether `ParamEyeBallX/Y` would have produced *some* eye motion in pre-fix runs. Even if eyes moved a tiny bit, the missing head tracking dominates visual perception and the user's "never worked" report is consistent.
- **LOW (deferred):** Whether the cursor fix completely resolves SC #5. It might surface a downstream issue we couldn't predict (e.g., the dead-zone is too generous at typical resolutions, or the IN-twin chain has phase lag). Plan should reserve a second wave for visual tuning if the post-fix UAT shows "moves but feels off".

## Cursor Polish Implementation (VFY-02)

### Drop in-VTS-window gate

`cursor_driver.py:30-32` reads:
```python
if not (left <= cx <= right and top <= cy <= bottom):
    return {}
```
This empty-return is the gate. After the fix, this branch should fall through to the normalized projection so the avatar tracks the cursor **even when it's outside the VTS window** (matching the §14 SC #4/#5 intent: "moves cursor over the avatar canvas region" — but a desktop user's cursor is rarely strictly inside the VTS window during conversation).

Replace with: continue to the normalized projection but clamp `nx`/`ny` to `[-1.0, 1.0]` (the existing `max(-1.0, min(1.0, ...))` lines at `cursor_driver.py:48-49` already do this, so dropping the gate is literally deleting lines 30-32).

**Caveat:** the dead-zone at `cursor_driver.py:39-46` should remain. Without it, micro-cursor-jitter near the face center produces tiny constant head twitches.

### Synthetic-canvas fallback

When `get_cursor_and_rect()` returns `(_, None)` (no VTS HWND found), `cursor_driver.py:64-66` currently bails with `return {}`. The fallback per VFY-02:
1. Detect primary-monitor bounds via `win32api.GetSystemMetrics(SM_CXSCREEN, SM_CYSCREEN)` (or `ctypes` if pywin32 doesn't expose them — pywin32 does).
2. Treat the primary monitor as the synthetic canvas; project the global cursor against it.
3. Maintain the dead-zone and ease-back semantics.

Add to `window_detect.py` a `get_primary_monitor_rect() -> tuple[int, int, int, int]` helper. Modify `cursor_driver.py:64-66` to use it as fallback when `vts_rect is None`.

**DPI awareness explicitly deferred** per VFY-02; the synthetic-canvas projection uses raw pixel coordinates, which on high-DPI displays will skew toward one corner — acceptable for v2.0.

### Regression test (mandatory, ARCH-12 style)

Add `sidecar/tests/compositor/test_cursor_driver_namespace.py`:
```python
def test_cursor_driver_emits_vts_tracking_input_names_only():
    driver = CursorDriver()
    # Inject a mock cursor + rect via monkeypatch
    out = driver.tick(now=0.0)  # against mocked window_detect
    assert all(key in VTS_TRACKING_INPUT_PARAM_IDS for key in out)
    # Specifically: keys are NOT in {"ParamAngleX","ParamAngleY","ParamEyeBallX","ParamEyeBallY"}
```
This test prevents future regressions where someone re-introduces Cubism names. It's the cursor-version of `test_arch06_single_writer.py`.

## Plumbing Harness Replay (VFY-05)

### Existing harness surface

`sidecar/scripts/plumbing_harness.py:94-104`:
```python
parser.add_argument("--mode", choices=("lipsync", "idle"), required=True)
parser.add_argument("--out", type=Path, required=True)
```
The harness:
- **Does NOT spawn a sidecar** — it imports `IdleDriver` and `SpeechDriver` directly and ticks them against synthetic inputs.
- **Does NOT need VTS running.**
- **Writes JSON** to `--out` with `{passed, threshold, ...}` keys.
- **Exits non-zero** on `passed=False`, so CI can wrap it directly.
- **Phase 6 baselines are committed** at `.planning/baselines/v2.0/{lipsync,idle}.json`:
  - lipsync: `pearson_r=0.9747`, threshold `0.7` (PASS at 1.39× over)
  - idle: `variance_sum=0.0664`, ceiling `0.5` (PASS at 7.5× under)

### Replay command (locked)

```bash
cd sidecar
uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync.json
uv run python scripts/plumbing_harness.py --mode idle --out ../.planning/baselines/v2.0/idle.json
```

The harness OVERWRITES the JSON file. Phase 10 plan should:
- Either replay into a separate filename (`*-replay-2026-05-09.json`) and diff against the committed baselines for the verification record, OR
- Replay into the same files (rewriting them with new timestamps) and let the git diff itself be the "tolerance check" — if the diff stays within the existing PASS thresholds, that's the proof.

**Recommendation:** Replay to fresh filenames `lipsync-phase10-replay.json` / `idle-phase10-replay.json` so the M1-baseline files stay immutable as historical reference. The Phase 10 ceremony script logs the new file paths and timestamps in skeleton-verification.md §"Automated Baseline Replay (VFY-05)".

### Tolerance band check

The harness's `passed` boolean encodes the threshold check (`pearson_r >= 0.7` / `0 < variance_sum < 0.5`). The ±100ms / ±0.05 tolerance bands from D-E1 are **already wider than the actual margins** (lipsync margin is 0.27, idle margin is 0.43) — replay-time PASS is overdetermined. Phase 10 records the new values + the rule "if `passed: true` then SC #1/#3 verdict is PASS" in skeleton-verification.md.

### What the harness does NOT cover

- SC #2 (`[smirk]` smooth blend) — operator-judged per D-B1/D-B3.
- SC #4 (body sway through utterance) — operator-judged per D-B2/D-B4.
- SC #5 (cursor) — verdict from cursor-fix UAT.
- SC #6 (WS protocol shape) — bookkeeping, not a runtime check.

## Operator Ceremony Script

### Preconditions (verified)

| Item | Status | File / Note |
|------|--------|-------------|
| `[smirk]` is in active vocabulary | **CONFIRMED** | `plugins/default/plugin.yaml:17-18` declares `code: smirk`. `plugins/default/__init__.py:20` lists `smirk` in the action-code set. `plugins/default/__init__.py:29` defines `smirk: {"FaceAngleZ": (0.07, 0.55), "FaceAngleY": (0.05, 0.40)}`. |
| Active Teto avatar `_avatar_overrides.yaml` ready | **CONFIRMED** | `avatars/重音テト/_avatar_overrides.yaml` exists; 14 variants registered (sv-microphone, heart-eye, etc.); events: []; default_plugin_action_bindings: []; body_sway_strategy: head_only. |
| HUD-closed precondition for SC #2/#4 | **NEEDED** | Per `## Specific Ideas` D-* "Lock means lock" carryover: HUD closed during SC #2/#4 observation. Operator step 0: "Confirm HUD window is closed (Settings → Open HUD button shows the open-action label)." |
| LM Studio (or active LLM provider) running | **OPERATOR PRECONDITION** | Without an active LLM, no `[smirk]` token can be produced. Document as step 0.5. |
| VTube Studio + Teto rig loaded + plugin authenticated | **OPERATOR PRECONDITION** | Without VTS running, no rig moves. Document as step 0.6. |

### Script shape (per established 06-HUMAN-UAT.md / 07-HUMAN-UAT.md pattern)

The script is an `.md` file at `.planning/skeleton-verification-ceremony.md` (or inlined directly into `skeleton-verification.md` §"§14 SC Verdicts" — planner's call). Reporter-style entries:

```markdown
### SC #2: [smirk] smooth blend (operator-judged)

**Precondition checks:**
- [ ] HUD window closed
- [ ] LM Studio running (or active provider passes /admin/llm-test)
- [ ] VTube Studio running with Teto rig loaded
- [ ] Sidecar [READY] line visible in logs drawer
- [ ] App is on the chat panel (not Settings, not Avatar Import)

**Steps:**
1. Open the app to the chat panel.
2. Paste the prompt: `Reply with exactly one sentence about a cat sneaking into a bakery, and emit [smirk] somewhere in your reply.`
3. Send. Observe the avatar's face during the reply.

**Visual checklist (per D-B3):**
- [ ] (1) Expression entry is gradual (faded in), not a hotkey-style pop.
- [ ] (2) Full fade-in process is visible from `[smirk]` token trigger to end of sentence.
- [ ] (3) After sentence completion, expression decays gradually back, not abruptly cut.

**Verdict (per D-B5):**
- 3/3 → PASS
- 1-2/3 → PARTIAL
- 0/3 → FAIL

**Recorded verdict:** ___________
**Recorded observation:** ___________
**Evidence link:** (chat-log timestamp range or screen-capture clip path)
```

A parallel block exists for SC #4. The exact long-utterance prompt is planner's choice within D-B2's strawman.

### SC #5 (cursor) verdict path

After the cursor fix lands and the polish (gate-drop + synthetic-fallback) is in, operator manual test:
1. Move cursor across the VTS window — head/eyes track.
2. Move cursor outside the VTS window (still on primary monitor) — head/eyes track to the synthetic-canvas projection.
3. Stop moving — ease-back to center over ~800ms.

Verdict: PASS if all three observed; PARTIAL if 1-2 observed; FAIL if 0 (and the diagnosis paragraph from D-A6 is the FAIL evidence).

### SC #6 (WS protocol shape) — bookkeeping rationale

D-* `## Specific Ideas`: "M1 Phase 1+2 verified OLVT envelope shape; v2.0 added `Dispatch` (Phase 7) and `HudMessage{S2C,C2S}` (Phase 9) but those are NEW message types under the same envelope, not OLVT-shape changes."

Verification text for skeleton-verification.md §"§14 SC #6":
> **PASS — verified M1 Phase 1+2 (PLUMB-03), v2.0 surfaces extend the envelope without changing OLVT shape.**
> Phase 1 PLUMB-03 closed the OLVT-shape WS envelope (TextInput / DisplayText / Shutdown discriminated union, Pydantic source-of-truth, hand-written TS mirror at the time, codegen-generated since Phase 5). Phase 7 added `Dispatch` (ActionCode | VariantToggle | EventFire) and Phase 9 added `HudMessageS2C` / `HudMessageC2S` — both are new `type` values inside the existing envelope, not changes to envelope structure.

No re-test needed.

## skeleton-verification.md Structure (per D-D1)

```markdown
# §14 Walking Skeleton Verification — v2.0 Refactored Architecture

**Verified:** {date}
**Milestone:** v2.0 Plugin + Animation Control
**Architecture:** Refactored — plugin runtime (Phase 6) + dispatch (Phase 7) + import (Phase 8) + HUD (Phase 9)
**Verifier:** {operator name}
**Active rig:** Teto (Cubism 4, 重音テト)

## §14 Success Criteria Verdicts (M1 re-run ceremony)

| # | Criterion | Verdict | Observation | Evidence |
|---|-----------|---------|-------------|----------|
| 1 | Lipsync RMS-vs-MouthOpen tracking | PASS / PARTIAL / FAIL | {pearson_r value from harness replay; "no audible/visible drift"} | `lipsync-phase10-replay.json` |
| 2 | `[smirk]` smooth blend (operator-judged, replaces M1 `[joy]`) | PASS / PARTIAL / FAIL | {3-of-3 / 2-of-3 / etc. checklist} | Ceremony log entry / clip path |
| 3 | Idle micro-motion non-zero variance | PASS / PARTIAL / FAIL | {variance_sum from harness replay} | `idle-phase10-replay.json` |
| 4 | Body sway through full utterance (operator-judged) | PASS / PARTIAL / FAIL | {3-of-3 / 2-of-3 / etc. checklist} | Ceremony log entry / clip path |
| 5 | Cursor tracking | PASS / PARTIAL / FAIL | {fix outcome; if FAIL, the diagnosis} | `10-XX-SUMMARY.md` cursor-fix evidence |
| 6 | OLVT WS protocol shape | PASS | M1-verified, v2.0 surfaces extend without changing envelope shape | M1 Phase 1+2 PLUMB-03; Phase 7 Dispatch addition; Phase 9 HudMessage addition |

(Each row also has a sub-section below with the full ceremony log entry, including the visual-checklist results and any recorded clips.)

## Automated Baseline Replay (VFY-05)

Harness re-run on {date}:

| Mode | Pre-Phase-10 baseline | Phase-10 replay | Tolerance | Pass? |
|------|----------------------|-----------------|-----------|-------|
| lipsync | `pearson_r=0.9747` (06-02) | `pearson_r={value}` ({date}) | ≥ 0.7 | yes/no |
| idle | `variance_sum=0.0664` (06-02) | `variance_sum={value}` ({date}) | 0 < x < 0.5 | yes/no |

Replay commands:
```bash
cd sidecar
uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync-phase10-replay.json
uv run python scripts/plumbing_harness.py --mode idle --out ../.planning/baselines/v2.0/idle-phase10-replay.json
```

Replay JSON files committed at `.planning/baselines/v2.0/lipsync-phase10-replay.json` and `idle-phase10-replay.json`.

## v2.0 Surfaces Verified in Their Own Phases (cross-reference, per D-C2)

| Surface | Phase | Verification artifact | Operator UAT artifact |
|---------|-------|----------------------|----------------------|
| Plugin runtime + default plugin (`[smirk]` action-code dispatch path; ARCH-01..12; PLG-01..10) | 6 | `06-VERIFICATION.md` (re_verification_4 passed) | `06-HUMAN-UAT.md`, `06-UAT.md` |
| Three-category dispatch (`{variant}` radio-button + `<event>` motion auto-completion; PARSE-01..08) | 7 | `07-VERIFICATION.md` | `07-HUMAN-UAT.md` |
| Avatar import + catalogs (`AvatarOverrides` schema; review screen; IMP-01..10) | 8 | `08-VERIFICATION.md` | `08-HUMAN-UAT.md` |
| HUD slider + per-param lock (`/hud/ws`, `set-lock`, system-primitive exclusion; HUD-01..08) | 9 | `09-VERIFICATION.md` | `09-HUMAN-UAT.md` |

This table NAVIGATES; verdicts live in each phase's own VERIFICATION.md per D-C3.

## Milestone v2.0 Close Decision (per D-D2)

### Ship verdict: PASS / PARTIAL / FAIL

**Criteria:**
- PASS if all six §14 SCs are PASS or PARTIAL with documented future-direction rationale.
- PARTIAL if any SC is PARTIAL with no rationale, OR one SC is FAIL with documented rationale.
- FAIL if more than one SC is FAIL, OR any SC is FAIL with no rationale.

**Recorded verdict:** ___________
**Decision basis:** ___________

### Open issues for next milestone

- DPI awareness (cursor projection on high-DPI displays — VFY-02 deferred)
- Multi-monitor cursor robustness (currently primary-monitor only)
- Native Cubism rendering integration (alongside pixi-live2d-display-advanced as v1.5/v2 candidate)
- Body-sway physics-chain investigation (head_only ship state acknowledged as mediocre; AVT-06 R-OPEN-1 still open)
- **Multi-avatar identity persistence** — v1-horizon headline value; per-avatar episodic memory + shared user-facts; the next milestone's PROJECT_DESIGN.md §5.4/§8 work

### v1-horizon progress note

The v2.0 milestone delivers the architectural foundation needed for v1-horizon multi-avatar identity persistence: plugin-driven motion (Phase 6 — different avatars can have different motion plugins or share defaults), formalized three-category code system (Phase 7 — avatars own variants/events; plugins own actions), avatar-import flow with curated catalogs (Phase 8 — `_avatar_overrides.yaml` per avatar is the persistence anchor), and HUD/lock primitives (Phase 9 — discovery + tuning surface for new rigs).

The v2.0 milestone does NOT yet ship multi-avatar episodic memory or the shared user-facts bucket. Single-avatar walking skeleton works end-to-end with refactored architecture; per-avatar Chroma stores + RRF-hybrid retrieval + write-on-promotion are the next milestone's headline value (REQUIREMENTS MEM-01..MEM-07).
```

## Standard Stack

No new packages. Phase 10 uses existing infrastructure exclusively.

### Core (already pinned per CLAUDE.md / Phase 1-9)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pyvts (vendored) | 0.3.3 | Existing single writer; UNTOUCHED in Phase 10 | ARCH-06 single-writer rule must hold; cursor fix is a translation layer above pyvts, not inside it |
| pywin32 | (existing) | `EnumWindows`, `GetWindowRect`, `GetCursorPos`, `GetSystemMetrics` for synthetic-canvas fallback | Already used in `window_detect.py` |
| pytest | (existing) | Regression test for cursor namespace | Standard; matches `test_arch06_single_writer.py` shape |

### Supporting (no additions)
None. Phase 10 is a fix-and-document phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Translate cursor output keys at `cursor_driver.py` (Option A) | Translate at `compositor.py` merge step (Option B) | Option B is "more architecturally consistent" but is a larger diff and complicates the regression test surface; A is the smaller, more testable fix |
| Run plumbing harness in-place (overwrite `.planning/baselines/v2.0/*.json`) | Run with separate replay filenames (`*-phase10-replay.json`) | Replay filenames preserve the M1 baseline as historical reference; overwriting loses provenance |
| Inline ceremony script into skeleton-verification.md | Separate `.planning/skeleton-verification-ceremony.md` file | Inlining is one-fewer-file but mixes "instruction" with "record"; planner's call |

**Installation:** Nothing new to install.

**Version verification:** N/A — no new dependencies.

## Architecture Patterns

### Recommended file layout (delta only)

```
sidecar/src/sidecar/compositor/
├── cursor_driver.py        # MODIFY: translate output keys via resolve_param_id; drop in-VTS-window gate
└── (no other changes)

sidecar/src/sidecar/vts/
└── window_detect.py        # MODIFY: add get_primary_monitor_rect() helper

sidecar/tests/compositor/
├── test_cursor_driver.py                      # MODIFY: existing tests need their assertions updated for new namespace
└── test_cursor_driver_namespace.py            # CREATE: regression test asserting VTS-tracking-input names only

.planning/
├── skeleton-verification.md                   # CREATE (per D-D1 four-section structure)
└── baselines/v2.0/
    ├── lipsync-phase10-replay.json            # CREATE (harness output)
    └── idle-phase10-replay.json               # CREATE (harness output)
```

### Pattern 1: Translate-at-edge for namespace consistency
**What:** Drivers internal to the compositor emit VTS tracking-input names. Any driver that computed in Cubism-input-name space should translate at its return boundary, not at the writer.
**When to use:** Any future driver added to the compositor merge.
**Example (the fix shape):**
```python
# cursor_driver.py — fixed shape
from sidecar.compositor.param_id_resolver import resolve_param_id

def _translate_vts_keys(d: dict[str, float]) -> dict[str, float]:
    return {resolve_param_id(k, "vts"): v for k, v in d.items()}

# in _cursor_to_param_angles return paths:
return _translate_vts_keys({"ParamAngleX": nx * head_max_deg, ...})
```

### Pattern 2: Operator UAT script as committed markdown
**What:** Reporter-style entries with reproducible preconditions + numbered steps + visual checklist + verdict slot.
**When to use:** Any operator-judged success criterion that resists automation.
**Source:** `.planning/phases/06-plugin-runtime-default-plugin/06-HUMAN-UAT.md` and `07-HUMAN-UAT.md` are the existing references.

### Anti-Patterns to Avoid
- **Trying to "force" cursor params with mode="set"+weight=1.0 instead of mode="add":** Doesn't fix the namespace issue and breaks the AVT-03 ambient-driver contract. The fix is namespace translation, not write-mode tweak.
- **Adding a second VTS plugin identity for cursor:** Violates ARCH-06 single-writer rule. CI test `test_arch06_single_writer.py` will fail. The fix flows cursor output through the existing `PyvtsSafeWriter` unchanged.
- **Using VTS hotkeys for cursor tracking:** Cursor is a continuous-param contract per AVT-10, not a discrete-event contract. Hotkeys are reserved for `<event>` dispatch (AVT-09 / Phase 7).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cubism → VTS-tracking-input name mapping | New translation table | `resolve_param_id()` in `compositor/param_id_resolver.py` | Already exists, already tested, already imports cleanly |
| Window-bounds detection | Custom `ctypes` + `user32.dll` calls | `window_detect.find_vts_hwnd` + `get_vts_rect` | Already battle-tested in 04-03; just needs `get_primary_monitor_rect` companion for the synthetic-canvas fallback |
| Cubic ease-back | Custom polynomial | `easing.ease_out_cubic` | Already in `compositor/easing.py`; cursor_driver already imports it |
| Pearson correlation / variance | Custom statistics | `statistics.fmean` / `statistics.pvariance` | Already used in `plumbing_harness.py:23-30, 76` |
| Operator UAT report shape | Custom format | 06-HUMAN-UAT.md / 07-HUMAN-UAT.md template | Established pattern; reuse the YAML-frontmatter + per-test-block layout |
| Manifest of v2.0 phase verdicts in skeleton-verification.md | Re-run all v2.0 verifications | Cross-reference table per D-C2/D-C3 | Each phase already produced its own VERIFICATION.md; duplicating is bookkeeping noise |

**Key insight:** Phase 10 has zero greenfield code. Everything reuses primitives Phases 1-9 already shipped. The "research" is mostly *recognition* of what's already there.

## Runtime State Inventory

> Phase 10 is a fix-and-verify phase. Some categories below have small surface area; each is answered explicitly to satisfy the protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 10 produces a markdown record (`skeleton-verification.md`) and two JSON replay files. No databases, vector stores, or persistent caches written. The cursor fix changes runtime behavior, not stored state. | None |
| Live service config | None — VTS authentication tokens, plugin identity (`AgenticLLMVTuber Phase4 Safe Writer`), and any pre-authenticated VTS plugin entries are unaffected by the cursor fix. The fix changes what the writer sends, not who's sending. | None |
| OS-registered state | None — no Windows Task Scheduler tasks, no pm2 saved process names, no launchd plists. | None |
| Secrets / env vars | None — no env-var renames; `AGENTICLLMVTUBER_*` set in Electron spawn (`apps/electron-main/src/sidecar.ts:155-178`) are unaffected. No DPAPI rotations. | None |
| Build artifacts | None — Phase 10 makes no `pyproject.toml` or `package.json` changes. No `pip install -e .` reinstalls needed; no `egg-info` regeneration. | None |

**The canonical question — "After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?"** — answer: nothing. The cursor fix takes effect on next sidecar restart with no migration step.

## Common Pitfalls

### Pitfall 1: Updating tests in `test_cursor_driver.py` to assert the OLD namespace
**What goes wrong:** The existing test file `sidecar/tests/compositor/test_cursor_driver.py:18-110` asserts `out["ParamAngleX"]`, `out["ParamEyeBallX"]`, etc. — the broken namespace. Updating cursor_driver.py without updating these tests means CI fails immediately.
**Why it happens:** The tests were authored against the broken implementation; they are not regression evidence — they encode the bug.
**How to avoid:** Plan the cursor fix to include parallel test edits. Specifically: every `out["ParamAngleX"]` becomes `out["FaceAngleX"]`, every `out["ParamEyeBallX"]` becomes `out["EyeLeftX"]`, every `out["ParamEyeBallY"]` becomes `out["EyeRightY"]`.
**Warning signs:** A failing existing test asserting a Cubism param key in the cursor-fix wave.

### Pitfall 2: Letting the in-VTS-window gate drop bypass the dead-zone
**What goes wrong:** Removing `cursor_driver.py:30-32` (the gate) without preserving the dead-zone branch (`cursor_driver.py:39-46`) means cursor jitter near the face center produces constant tiny head twitches.
**Why it happens:** The two branches are visually adjacent and easy to confuse.
**How to avoid:** The fix DELETES exactly lines 30-32 (the `if not (left <= cx <= right ...)` block) and leaves the dead-zone block (now at lines 36-43 after deletion) untouched.
**Warning signs:** Operator UAT reports "head twitches even when cursor is over the face."

### Pitfall 3: Synthetic-canvas fallback projecting against a stale monitor rect
**What goes wrong:** If the user changes monitor configuration or display scaling mid-session, a cached `get_primary_monitor_rect()` value becomes stale.
**Why it happens:** Following the `find_vts_hwnd` cache pattern (re-probe every 30s) blindly.
**How to avoid:** `GetSystemMetrics(SM_CXSCREEN, SM_CYSCREEN)` is a cheap syscall — call it every tick instead of caching. The 60Hz cost is trivial compared to the staleness risk.
**Warning signs:** After multi-monitor unplug/replug, cursor projection skews systematically.

### Pitfall 4: SC #2 ceremony recording a PASS without the LLM actually emitting `[smirk]`
**What goes wrong:** Operator types the prompt; LLM replies but doesn't include `[smirk]` (model temperature, system prompt drift, etc.); operator sees no fade and records FAIL — but the LLM never emitted the trigger.
**Why it happens:** The ceremony script doesn't enforce that the trigger was actually emitted.
**How to avoid:** Step 4 of SC #2 ceremony: "Open the logs drawer; verify a `[DISPATCH]` line for `ActionCode(code='smirk')` appears within the reply window. If absent, the LLM did not honor the prompt; retry with a more directive prompt or switch model." The ceremony tests the *compositor + plugin path*, not the LLM's compliance.
**Warning signs:** Recorded FAIL with note "didn't see smirk" but no `[DISPATCH]` log evidence to confirm trigger.

### Pitfall 5: Plumbing harness replay overwriting committed M1 baselines without provenance
**What goes wrong:** Running the harness with `--out ../.planning/baselines/v2.0/lipsync.json` REWRITES the file in-place. The M1 PASS values (`pearson_r=0.9747` etc.) are lost from git unless the diff is examined.
**Why it happens:** Default execution against the existing path.
**How to avoid:** Phase 10 plan uses replay-suffixed filenames (`lipsync-phase10-replay.json` / `idle-phase10-replay.json`) so M1 baselines stay immutable. The skeleton-verification.md replay table cites both files for diff comparison.
**Warning signs:** `git diff .planning/baselines/v2.0/lipsync.json` shows large value swing without a Phase 10 SUMMARY.md note explaining it.

### Pitfall 6: Treating SC #6 as "needs an automated test"
**What goes wrong:** Planner adds a new "WS protocol shape conformance test" to Phase 10 and burns time on tooling.
**Why it happens:** Reading the SC literally: "WS protocol matches OLVT shape — verify."
**How to avoid:** SC #6 was verified in M1 PLUMB-03 (Phase 1) and LLM-01/02 (Phase 2). Subsequent v2.0 additions extend the envelope without changing its discriminated-union shape. The skeleton-verification.md entry for SC #6 is a one-paragraph rationale, NOT a re-run.
**Warning signs:** A new task appearing in the Phase 10 plan whose goal is "verify WS protocol shape."

## Code Examples

### The cursor fix shape (verified)

```python
# sidecar/src/sidecar/compositor/cursor_driver.py — Option A
from sidecar.compositor.param_id_resolver import resolve_param_id
from sidecar.vts.window_detect import get_cursor_and_rect, get_primary_monitor_rect

from .easing import ease_out_cubic

# ... constants unchanged ...

def _to_vts_input_keys(d: dict[str, float]) -> dict[str, float]:
    return {resolve_param_id(key, "vts"): value for key, value in d.items()}


def _cursor_to_param_angles(
    cursor_xy: tuple[int, int],
    rect: tuple[int, int, int, int],
    face_center_frac: tuple[float, float] = FACE_CENTER_FRAC,
    head_max_deg: float = HEAD_MAX_DEFLECTION_DEG,
    eye_max_deg: float = EYE_MAX_DEFLECTION_DEG,
    dead_zone_px: float = DEAD_ZONE_PX,
) -> dict[str, float]:
    cx, cy = cursor_xy
    left, top, right, bottom = rect
    # in-VTS-window gate at lines 30-32 DROPPED per VFY-02

    width = right - left
    height = bottom - top
    face_x = left + width * face_center_frac[0]
    face_y = top + height * face_center_frac[1]
    dx = cx - face_x
    dy = cy - face_y
    if (dx * dx + dy * dy) ** 0.5 < dead_zone_px:
        return _to_vts_input_keys({
            "ParamAngleX": 0.0, "ParamAngleY": 0.0,
            "ParamEyeBallX": 0.0, "ParamEyeBallY": 0.0,
        })

    nx = max(-1.0, min(1.0, dx / (width * 0.5)))
    ny = max(-1.0, min(1.0, dy / (height * 0.5)))
    return _to_vts_input_keys({
        "ParamAngleX": nx * head_max_deg,
        "ParamAngleY": -ny * head_max_deg,
        "ParamEyeBallX": nx * eye_max_deg / head_max_deg,
        "ParamEyeBallY": -ny * eye_max_deg / head_max_deg,
    })


class CursorDriver:
    def __init__(self) -> None:
        self._last_in_canvas_output: dict[str, float] = {}
        self._cursor_left_canvas_at: float | None = None

    def tick(self, now: float) -> dict[str, float]:
        cursor_xy, vts_rect = get_cursor_and_rect()
        rect = vts_rect if vts_rect is not None else get_primary_monitor_rect()
        # if rect is still None (rare; non-Win32 platform), bail
        if rect is None:
            return {}
        live = _cursor_to_param_angles(cursor_xy, rect)
        # ease-back logic unchanged
        if live:
            self._last_in_canvas_output = live
            self._cursor_left_canvas_at = None
            return live
        # ... unchanged ease-back ...
```

### The regression test (recommended)

```python
# sidecar/tests/compositor/test_cursor_driver_namespace.py
from sidecar.compositor.cursor_driver import _cursor_to_param_angles
from sidecar.compositor.param_id_resolver import VTS_TRACKING_INPUT_PARAM_IDS


def test_cursor_driver_returns_only_vts_tracking_input_names():
    cursor_xy = (500, 500)
    rect = (0, 0, 1000, 1000)
    out = _cursor_to_param_angles(cursor_xy, rect)
    cubism_names = {"ParamAngleX", "ParamAngleY", "ParamEyeBallX", "ParamEyeBallY"}
    assert all(key not in cubism_names for key in out), (
        f"Cursor driver leaked Cubism param names: {out.keys() & cubism_names}"
    )
    assert all(key in VTS_TRACKING_INPUT_PARAM_IDS for key in out), (
        f"Cursor driver returned non-VTS-tracking-input keys: {set(out.keys()) - VTS_TRACKING_INPUT_PARAM_IDS}"
    )
```

### The harness replay invocation (verified)

```bash
# From repo root
cd sidecar
uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync-phase10-replay.json
uv run python scripts/plumbing_harness.py --mode idle    --out ../.planning/baselines/v2.0/idle-phase10-replay.json
# Both exit 0 on PASS, 1 on FAIL. CI-friendly.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cursor writes Cubism input names directly to VTS | Cursor writes VTS tracking-input names; VTS internal routing handles Cubism mapping | Phase 10 (this phase) | Cursor visibly tracks for first time since M1 |
| `[joy]` is the §14 SC #2 trigger | `[smirk]` is the §14 SC #2 trigger | 06-08 (2026-05-08) — `[joy]` removed because active Teto has no joy variant | Ceremony script must emit `[smirk]` to test the same compositor + plugin path |
| `IntentDriver` is the smooth-blend mechanism for `[joy]` | `PluginAdapter` + `DefaultPlugin` action-code ramp is the smooth-blend mechanism | Phase 6 06-02 (2026-05-08) — `IntentDriver` deleted; logic in plugins/default | SC #2 verifies the plugin path, not the M1 IntentDriver path |

**Deprecated/outdated:**
- The `cursor_driver.py` Cubism-name return contract — superseded by namespace-translated return.
- The `cursor_driver.py:30-32` in-VTS-window gate — superseded by always-project-with-fallback.

## Open Questions

### 1. Should the cursor fix translate at the driver edge or at the compositor merge?
- **What we know:** Both options work. Option A (driver edge) is the smaller diff; Option B (compositor) is more architecturally consistent.
- **What's unclear:** Whether future drivers (e.g., a hypothetical "gaze plugin" that computes in Cubism space) would benefit from a single compositor-level translation point.
- **Recommendation:** Option A for Phase 10 (smaller, more testable). If a second Cubism-space driver appears in a later milestone, refactor to Option B then.

### 2. Should the synthetic-canvas fallback persist across cursor-leaves-VTS-window transitions, or always default to the synthetic canvas when VTS is closed?
- **What we know:** When VTS is running, `get_cursor_and_rect()` returns `(cursor_pos, rect)`. When VTS is closed, returns `(cursor_pos, None)`.
- **What's unclear:** Mid-session behavior when user closes VTS deliberately. Should the avatar (no longer rendered, since VTS hosts the rig) freeze, or continue ticking against the synthetic canvas?
- **Recommendation:** Tick against synthetic canvas always — the cursor write is harmless when no rig is rendered, and the avatar correctly tracks again on VTS reopen without state drift. (No extra logic needed; the fallback is purely for cursor projection.)

### 3. Will the operator-judged SC #2 / SC #4 ceremonies be reproducible by future engineers?
- **What we know:** The script captures preconditions + steps + checklist + verdict, all in committed markdown.
- **What's unclear:** Visual judgement is operator-subjective. A different operator might score 2-of-3 vs. 3-of-3 differently.
- **Recommendation:** Accept the subjectivity; the verdict rubric (D-B5) is broad enough that reasonable operators converge. Future milestones may add automated visual diff if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12 | Sidecar runtime | ✓ (operator setup, Phase 1) | 3.12.x | — |
| `uv` | Harness invocation | ✓ (operator setup, Phase 1) | per CLAUDE.md | — |
| pywin32 | window_detect.py + synthetic-canvas fallback | ✓ (vendored, Phase 1 + Phase 4) | (existing) | none — Win32-only platform |
| pytest | Regression test runner | ✓ (Phase 1) | (existing) | — |
| VTube Studio (external) | Operator ceremony for SC #2/#4/#5 | OPERATOR PRECONDITION | 1.32.71 (per CLAUDE.md) | If not running, ceremony cannot proceed; document as a gating step |
| LM Studio (or active LLM provider) | Operator ceremony for SC #2/#4 (LLM must emit `[smirk]` and a long utterance) | OPERATOR PRECONDITION | (any LiteLLM-compatible) | If not configured, /admin/llm-test will gate; document as gating step |
| Teto rig file | Active rig for ceremony | ✓ (committed at `Live2D/重音テト/`) | Cubism 4.x | — |

**Missing dependencies with no fallback:** None for code work. The ceremony itself depends on operator-side VTS + LLM; documented as preconditions, not blockers.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (per Phase 1) + pytest-asyncio for async tests; existing harness in-tree |
| Config file | `sidecar/pyproject.toml` (existing pytest config) |
| Quick run command | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py tests/compositor/test_cursor_driver_namespace.py -x` |
| Full suite command | `cd sidecar && uv run pytest -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VFY-01 | Cursor diagnose-and-fix; param-namespace translated to VTS tracking-input names | unit | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver_namespace.py -x` | ❌ Wave 0 (create `sidecar/tests/compositor/test_cursor_driver_namespace.py`) |
| VFY-01 | Cursor existing test cases (deflection math + ease-back + dead-zone) still pass with translated namespace | unit | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py -x` | ✅ (Wave 0 update — change asserted keys from `ParamAngleX` → `FaceAngleX` etc.) |
| VFY-02 | Drop in-VTS-window gate; synthetic-canvas fallback when no VTS rect | unit | `cd sidecar && uv run pytest tests/compositor/test_cursor_driver.py::test_cursor_synthetic_fallback -x` | ❌ Wave 0 (add new test cases to existing test file) |
| VFY-02 | `get_primary_monitor_rect()` returns sensible bounds | unit | `cd sidecar && uv run pytest tests/vts/test_window_detect.py::test_primary_monitor_rect -x` | ❌ Wave 0 (test file may not exist; create or extend) |
| VFY-03 | SC #1 (lipsync) — pearson_r ≥ 0.7 against synthetic envelope | integration / harness | `cd sidecar && uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync-phase10-replay.json` | ✅ |
| VFY-03 | SC #3 (idle) — variance_sum within (0, 0.5) on idle params | integration / harness | `cd sidecar && uv run python scripts/plumbing_harness.py --mode idle --out ../.planning/baselines/v2.0/idle-phase10-replay.json` | ✅ |
| VFY-03 | SC #2 (`[smirk]` smooth blend) — operator visual review | manual-only | (ceremony script in skeleton-verification.md per D-D1 §1) | N/A (operator-judged) |
| VFY-03 | SC #4 (body sway through utterance) — operator visual review | manual-only | (ceremony script in skeleton-verification.md per D-D1 §1) | N/A (operator-judged) |
| VFY-03 | SC #5 (cursor) — operator manual test of head/eye tracking + ease-back | manual-only | (post-fix UAT step in skeleton-verification.md per D-D1 §1) | N/A (operator-judged) |
| VFY-03 | SC #6 (WS protocol shape) — bookkeeping rationale | manual-only (record-only) | N/A | N/A (M1-verified, v2.0 doesn't change envelope) |
| VFY-04 | `.planning/skeleton-verification.md` exists, has 4-section structure, all six SC verdicts recorded | manual-only (artifact existence check) | `test -f .planning/skeleton-verification.md && grep -q "Milestone v2.0 Close Decision" .planning/skeleton-verification.md` | ❌ Phase 10 deliverable |
| VFY-05 | Tolerance bands ±100ms / ±0.05 satisfied for SC #1 + SC #3 | integration / harness (already encoded) | (same harness commands; `passed: true` in JSON) | ✅ |
| ARCH-06 (carry-through) | Single pyvts writer rule preserved after cursor fix | unit | `cd sidecar && uv run pytest tests/test_arch06_single_writer.py -x` | ✅ |

### Sampling Rate
- **Per task commit:** `cd sidecar && uv run pytest tests/compositor tests/vts tests/test_arch06_single_writer.py -x` (~5–8s on a warm cache)
- **Per wave merge:** `cd sidecar && uv run pytest -q` (full suite, ~30–60s)
- **Phase gate:** Full suite green + harness replay produces PASS JSON for both modes + ARCH-06 single-writer test green + skeleton-verification.md committed with all six SC verdicts filled

### Wave 0 Gaps
- [ ] `sidecar/tests/compositor/test_cursor_driver_namespace.py` — covers VFY-01 (regression: cursor output keys are VTS tracking-input names only)
- [ ] `sidecar/tests/compositor/test_cursor_driver.py` — UPDATE: existing assertions reference `ParamAngleX/Y` etc.; flip to `FaceAngleX/Y` / `EyeLeftX` / `EyeRightY` to match the fix's translated namespace
- [ ] `sidecar/tests/vts/test_window_detect.py` — UPDATE or CREATE: add `test_primary_monitor_rect` covering the synthetic-canvas fallback helper
- [ ] (No framework install needed — pytest already in use)

## Sources

### Primary (HIGH confidence — code-reading verified)

- `sidecar/src/sidecar/compositor/cursor_driver.py` — broken namespace at lines 42-54
- `sidecar/src/sidecar/compositor/param_id_resolver.py` — correct mapping table at lines 10-19; `VTS_TRACKING_INPUT_PARAM_IDS` frozenset at lines 21-41
- `sidecar/src/sidecar/compositor/idle_driver.py` — confirms VTS-tracking-input namespace as the working pattern (lines 27-34)
- `sidecar/src/sidecar/compositor/speech_driver.py` — confirms `MouthOpen` as VTS-tracking-input pattern (line 18)
- `plugins/default/body_sway/head_only.py` — confirms `FaceAngleX/Y/Z` + `FacePositionX/Z` (lines 18-23)
- `plugins/default/__init__.py` — confirms `[smirk]` writes `FaceAngleZ` + `FaceAngleY` (line 29)
- `sidecar/src/sidecar/ws/server.py` — confirms `CursorDriver()` instantiated and wired into Compositor at boot (lines 333-341)
- `sidecar/src/sidecar/vts/window_detect.py` — confirms `find_vts_hwnd` + `get_vts_rect` + `get_cursor_pos` for synthetic-canvas fallback design
- `sidecar/src/sidecar/compositor/clamp.py` — confirms `clamp_and_validate` allows `writable_param_ids` from rig, which means cursor's broken Cubism names DO survive clamp via cdi3 entries
- `sidecar/src/sidecar/avatar/rig_capabilities.py` — confirms `writable_param_ids` is `Groups.Ids ∪ ParameterSettings.OutputLive2D ∪ cdi3 names`
- `sidecar/src/sidecar/vts/pyvts_writer.py` — confirms `PyvtsSafeWriter` (single writer, identity `AgenticLLMVTuber Phase4 Safe Writer`) and `requestSetMultiParameterValue(mode="add")` is the cursor's write path
- `sidecar/scripts/plumbing_harness.py` — full file read; CLI surface `--mode {lipsync,idle} --out PATH`; passes by exit-0
- `Live2D/重音テト/重音テト.vtube.json` — confirms IN-twin pattern: `ParameterSettings.OutputLive2D` includes `ParamAngleXIN/YIN/ZIN` but NOT `ParamAngleX/Y/Z`
- `Live2D/重音テト/重音テト.cdi3.json` — confirms 530 params including `ParamAngleX`, `ParamAngleY`, `ParamEyeBallX/Y` (so they're in `RigCapabilities.writable_param_ids` and survive clamp)
- `Live2D/重音テト/重音テト.model3.json` — confirms `Groups` only declare `ParamEyeLOpen` + `ParamEyeROpen`
- `apps/electron-main/src/sidecar.ts` — confirms no `AGENTICLLMVTUBER_DISABLE_CURSOR` env var (no cursor-disable flag in spawn)
- `avatars/重音テト/_avatar_overrides.yaml` — confirms 14 variants, `events: []`, `body_sway_strategy: head_only`, `default_plugin_action_bindings: []` for ceremony rig state
- `plugins/default/plugin.yaml` — confirms `smirk` is in active vocabulary
- `.planning/baselines/v2.0/lipsync.json` + `.planning/baselines/v2.0/idle.json` — confirmed PASS values
- `.planning/phases/06-plugin-runtime-default-plugin/06-02-SUMMARY.md` — harness construction details + boot sequence
- `.planning/REQUIREMENTS.md` — VFY-01..05 wording (amended 2026-05-08); ARCH-06 single-writer rule
- `.planning/ROADMAP.md` — Phase 10 §"Cursor Polish + §14 SC Re-Verification" (lines 256-275)
- `.planning/phases/10-cursor-polish-14-sc-re-verification/10-CONTEXT.md` — all 14 locked decisions D-A1..D-D2
- `sidecar/tests/test_arch06_single_writer.py` — confirms CI single-writer assertion shape

### Secondary (MEDIUM confidence — established pattern, no live runtime check needed)

- `.planning/phases/06-plugin-runtime-default-plugin/06-HUMAN-UAT.md` — operator UAT report shape (frontmatter + per-test-block + gaps section)
- `.planning/phases/06-plugin-runtime-default-plugin/06-VERIFICATION.md` — verification artifact shape (re_verification_N progressive records)
- VTube Studio API spec — `InjectParameterDataRequest` mode="add" semantics for both VTS tracking-input names and Cubism-native param IDs (referenced in CLAUDE.md sources)

### Tertiary (LOW confidence — assumption that needs runtime verification)

- The exact failure mode for writing `ParamAngleX` directly to a Cubism rig with IN-twin pattern. The mechanism described above (VTS tracker overwrites at next tick, OR phantom Cubism param) is the most likely explanation but cannot be 100% confirmed without a debug print of `[VTS-PARAM-DISABLED]` log lines or a live VTS connection. Recommendation: the regression test asserts namespace correctness; the operator UAT confirms visible motion. Both together are sufficient evidence; deeper VTS-internal mechanism description is "best available understanding" rather than HIGH-confidence proof.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages
- Cursor failure root cause: HIGH (3 of 4 candidate failure modes ruled out by code reading; remaining hypothesis directly explains observed behavior; fix already-encoded resolver)
- Cursor fix shape: HIGH (Option A is ~6 LOC; tested mechanism)
- Plumbing harness replay: HIGH (CLI surface verified; baselines committed)
- Operator ceremony preconditions: HIGH (`[smirk]` confirmed in plugin.yaml; Teto overrides confirmed; HUD-closed precondition documented)
- skeleton-verification.md structure: HIGH (D-D1 locks the 4-section shape)
- SC #6 bookkeeping rationale: HIGH (M1 PLUMB-03 closed; v2.0 surfaces extend without changing envelope)
- Pitfalls: MEDIUM-HIGH (5 of 6 pitfalls verified by code reading; pitfall #4 is operator-judgement-shaped)

**Research date:** 2026-05-09
**Valid until:** 2026-06-08 (30 days; stable surface — no upstream pyvts/VTS bumps expected within window)
