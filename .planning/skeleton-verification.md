# §14 Walking Skeleton Verification — v2.0 Refactored Architecture

**Verified:** 2026-05-09
**Milestone:** v2.0 Plugin + Animation Control
**Architecture:** Refactored — plugin runtime (Phase 6) + dispatch (Phase 7) + import (Phase 8) + HUD (Phase 9) + cursor namespace fix (Phase 10)
**Verifier:** Huanfu (operator)
**Active rig:** Teto (Cubism 4, 重音テト)
**Active plugin:** plugins/default (action vocabulary: anger, disgust, fear, neutral, sadness, smirk, surprise)
**Origin:** This deliverable closes the M1 SC-01 ceremony deferred from Phase 5 on 2026-05-08; lands here per the Phase 10 mandate (REQUIREMENTS.md VFY-03 / VFY-04).

---

## §14 Success Criteria Verdicts (M1 re-run ceremony)

Phase 10 re-runs all six §14 success criteria from `PROJECT_DESIGN.md §14` against the v2.0 refactored architecture. SC #2 (`[smirk]` smooth blend, replacing M1's removed `[joy]` per 06-08) and SC #4 (body sway through full utterance) are operator-judged via the ceremony scripts below per Phase 6 discuss-phase decision (head_only ship state acknowledged as mediocre; auto-diff against M1 visual baseline would punish improved future implementations). SC #1 (lipsync) and SC #3 (idle) are verified by automated harness replay against the Phase 6 06-02 baselines (preserved as immutable historical reference). SC #5 (cursor) verdict comes from Phase 10 Plan 10-01 outcome plus operator visual confirmation. SC #6 (OLVT WS shape) records PASS with bookkeeping rationale.

| # | Criterion | Verdict | Observation | Evidence |
|---|-----------|---------|-------------|----------|
| 1 | Lipsync RMS-vs-MouthOpen tracking (TTS-04 / AVT-03 carry-through) | PASS | pearson_r=0.9747730195034283 (1.39× over 0.7 threshold) from Phase 10 replay | `.planning/baselines/v2.0/lipsync-phase10-replay.json` |
| 2 | `[smirk]` smooth blend (operator-judged; replaces M1 `[joy]` per 06-08) | PASS | Operator confirmed the smirk face is visible after Plan 10-03 fixed supervised action-code dispatch. | This file, §"SC #2 Ceremony Log" |
| 3 | Idle micro-motion non-zero variance (AVT-02 carry-through) | PASS | variance_sum=0.06643749130899018 (0 < x < 0.5; 7.5× under ceiling) from Phase 10 replay | `.planning/baselines/v2.0/idle-phase10-replay.json` |
| 4 | Body sway through full utterance (operator-judged) | PASS | Operator reported SC #4 pass; speech/body-sway behavior accepted for v2.0 close. | This file, §"SC #4 Ceremony Log" |
| 5 | Cursor tracking (operator-judged post-Plan 10-04 fix) | PASS | Head and eyes track the cursor correctly; outside-window tracking remains accepted. App-owned idle blinking was removed so VTS owns normal blinking. | `.planning/phases/10-cursor-polish-14-sc-re-verification/10-01-SUMMARY.md`, `.planning/phases/10-cursor-polish-14-sc-re-verification/10-04-SUMMARY.md`, this file §"SC #5 Ceremony Log" |
| 6 | OLVT WS protocol shape (bookkeeping) | PASS | M1 Phase 1+2 (PLUMB-03) verified the OLVT-shape envelope; v2.0 Phase 7 `Dispatch` and Phase 9 `HudMessageS2C/C2S` are new `type` values inside the existing envelope, not envelope-structure changes. | `.planning/phases/01-plumbing-process-lifecycle/01-02-SUMMARY.md`, `.planning/phases/02-conversation-pipeline/`, `.planning/phases/07-three-category-code-parsing-dispatch/`, `.planning/phases/09-slider-hud-per-param-lock/` |

### SC #1 Ceremony Log (automated)

Phase 10 harness replay (Task 2 in Plan 10-02) — re-runs `sidecar/scripts/plumbing_harness.py --mode lipsync` against the synthetic envelope used in Phase 6 06-02. Threshold: `pearson_r >= 0.7`. M1 baseline at 06-02 produced `pearson_r=0.9747730195034283` (1.39× over threshold). Tolerance bands ±100ms / ±0.05 per D-E1 are wider than the Phase 6 margin (0.27); replay-time PASS is overdetermined.

**Replay command:**
```bash
cd sidecar
uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync-phase10-replay.json
```

**Replay verdict:** PASS — `passed: true`; `pearson_r=0.9747730195034283`; `sample_count=90`; `threshold=0.7`.

### SC #2 Ceremony Log (operator-judged — `[smirk]` smooth blend)

**Precondition checks** (operator confirms before recording verdict):
- [ ] Separate HUD window closed; if it was opened for setup smoke, any locks have been cleared first (per "Lock means lock" carryover)
- [ ] LM Studio running (or active provider passes /admin/llm-test)
- [ ] VTube Studio running with Teto rig loaded
- [ ] Sidecar [READY] line visible in logs drawer
- [ ] App is on the chat panel (not Settings, not Avatar Import)

**Steps:**
1. Open the app to the chat panel.
2. Paste the prompt verbatim:
   > Reply with exactly one sentence about a cat sneaking into a bakery, and emit `[smirk]` somewhere in your reply.
3. Send. Observe the avatar's face during the reply.
4. Open the logs drawer; confirm a `[DISPATCH]` line for `ActionCode(code='smirk')` appears within the reply window. (Per Pitfall 4: if absent, the LLM did not honor the prompt — retry with a more directive prompt or switch model. Without `[DISPATCH]`, this ceremony cannot judge the compositor + plugin path.)

**Visual checklist (per D-B3):**
- [ ] (1) Expression entry is gradual (faded in), not a hotkey-style pop.
- [ ] (2) Full fade-in process is visible from `[smirk]` token trigger to end of sentence.
- [ ] (3) After sentence completion, expression decays gradually back, not abruptly cut.

**Verdict (per D-B5):**
- 3/3 → PASS
- 1-2/3 → PARTIAL
- 0/3 → FAIL

**Recorded verdict:** PASS
**Recorded observation:** Operator initially reported no visible smirk, then corrected the report after observing that Teto's smirk face is visible. Plan 10-03 still found and fixed the production path that could prevent action dispatch from reaching the wrapped default plugin: `PluginAdapter` calls `on_action_code`, production wraps `DefaultPlugin` in `PluginSupervisor`, and `PluginSupervisor` previously inherited the base no-op `on_action_code`. Commit `b39511d` delegates action codes through the supervisor; focused tests now cover direct plugin, adapter, and supervised-plugin smirk dispatch.
**Evidence link:** Operator live UAT correction on 2026-05-09 plus commits `134ed76`, `3733271`, `8d9135f`, and `b39511d`.

### SC #3 Ceremony Log (automated)

Phase 10 harness replay — re-runs `sidecar/scripts/plumbing_harness.py --mode idle` against IdleDriver(seed=42) for 30 seconds at 30 Hz. Ceiling: `0 < variance_sum < 0.5`. M1 baseline at 06-02 produced `variance_sum=0.06643749130899018` (7.5× under ceiling).

**Replay command:**
```bash
cd sidecar
uv run python scripts/plumbing_harness.py --mode idle --out ../.planning/baselines/v2.0/idle-phase10-replay.json
```

**Replay verdict:** PASS — `passed: true`; `variance_sum=0.06643749130899018`; `duration_seconds=30.0`; `variance_ceiling=0.5`.

### SC #4 Ceremony Log (operator-judged — body sway through ~30-45s utterance)

**Precondition checks** (same as SC #2; HUD-closed precondition is critical here too):
- [ ] Separate HUD window closed; if it was opened for setup smoke, any locks have been cleared first
- [ ] LM Studio running
- [ ] VTube Studio running with Teto rig loaded
- [ ] Sidecar [READY] line visible in logs drawer
- [ ] App is on the chat panel

**Steps:**
1. Open the app to the chat panel.
2. Paste the prompt verbatim:
   > Tell me a 60-word funny story about a cat who somehow ends up in space. Take your time and include vivid details.
3. Send. Observe the avatar's body/head sway through the entire reply (~30-45 seconds of TTS audio expected).
4. After the reply finishes, open the logs drawer and confirm `[SPEECH-DRIVER]` and `[BODY-SWAY]` log lines were emitted during the utterance window — confirms the body-sway path was active.

**Visual checklist (per D-B4):**
- [ ] (1) Visible body motion (not flat/static through the utterance).
- [ ] (2) Through ~30 seconds, motion does not freeze on one side or get stuck centered.
- [ ] (3) Sway feels coherent with TTS rhythm — not jarringly out of sync.

**Verdict (per D-B5):** Same rubric as SC #2.

**Recorded verdict:** PASS
**Recorded observation:** Operator reported SC #4 pass for the long utterance body-sway ceremony.
**Evidence link:** Operator live UAT report on 2026-05-09.

### SC #5 Ceremony Log (operator-judged post-Plan 10-01 fix)

**Plan 10-01 outcome:** Cursor namespace fix landed. Root cause: `cursor_driver.py` returned Cubism input names (`ParamAngleX/Y`, `ParamEyeBallX/Y`) instead of VTS tracking-input names (`FaceAngleX/Y`, `EyeLeftX`, `EyeRightY`). Translation via `resolve_param_id(name, "vts")` now applied at driver edge. Drop-in-VTS-window gate removed. Synthetic-canvas fallback (primary monitor) added when no VTS rect detected. Regression test `test_cursor_driver_namespace.py` in CI prevents future regressions. ARCH-06 single-writer rule preserved (1 file imports pyvts). See `.planning/phases/10-cursor-polish-14-sc-re-verification/10-01-SUMMARY.md`.

**Precondition checks:**
- [ ] Plan 10-01 SUMMARY committed; cursor namespace regression test passes in CI
- [ ] VTube Studio running with Teto rig loaded; sidecar authenticated
- [ ] Sidecar [READY] line visible in logs drawer

**Steps:**
1. With cursor over the VTube Studio window, move the cursor in a slow circle around the avatar's face. Observe head + eyes tracking.
2. Move cursor outside the VTS window (still on primary monitor — e.g., over the chat panel or another app). Observe head + eyes continuing to track (synthetic-canvas fallback per VFY-02).
3. Stop moving the cursor at a point off-axis from face center. Observe head/eyes remain at the deflected pose (steady-state — no jitter).
4. (Optional) Close VTube Studio entirely. Observe sidecar logs do not error; cursor continues to be polled (synthetic-canvas mode is harmless when no rig is rendered).

**Visual checklist:**
- [ ] (1) Cursor over VTS window: head + eye tracking visible.
- [ ] (2) Cursor outside VTS window (on primary monitor): head + eye tracking still visible (synthetic-canvas fallback).
- [ ] (3) Steady-state hold: no head twitches when cursor is stationary.

**Verdict:**
- 3/3 → PASS
- 1-2/3 → PARTIAL
- 0/3 → FAIL (and the diagnosis paragraph from Plan 10-01 SUMMARY is the FAIL evidence per D-A6)

**Recorded verdict:** PASS
**Recorded observation:** After Plan 10-04, operator confirmed cursor eye tracking works with no problem. Fixes applied: cursor emits the full VTS eye-input surface (`EyeLeftX`, `EyeRightX`, `EyeLeftY`, `EyeRightY`), Teto's inverted horizontal eye mapping is handled by inverting cursor eye X, and normal idle blinking is left to VTS instead of app-owned `EyeOpenLeft` / `EyeOpenRight` pulses. Whole-screen/outside-window tracking remains accepted.
**Evidence link:** Operator live UAT pass on 2026-05-09 plus `.planning/phases/10-cursor-polish-14-sc-re-verification/10-04-SUMMARY.md`.

**Gap resolved:** SC5-EYE-TRACKING — cursor-driven head and eye tracking are visibly present. `BLINK-EYE-VISIBILITY` was resolved by deleting app-owned idle blinking; future deliberate eye gestures such as wink remain allowed as bounded plugin/action/variant output.

### SC #6 Ceremony Log (bookkeeping — no re-test)

**Verdict:** PASS — verified M1 Phase 1+2 (PLUMB-03), v2.0 surfaces extend the envelope without changing OLVT shape.

**Observation:** Phase 1 PLUMB-03 closed the OLVT-shape WS envelope (TextInput / DisplayText / Shutdown discriminated union, Pydantic source-of-truth, hand-written TS mirror at the time, codegen-generated since Phase 5). Phase 7 added `Dispatch` (ActionCode | VariantToggle | EventFire) and Phase 9 added `HudMessageS2C` / `HudMessageC2S` — both are new `type` values inside the existing envelope, not changes to envelope structure. The `/hud/ws` endpoint introduced in Phase 9 is a separate WS surface that complements `/ws`; both honor the OLVT discriminated-union shape.

**Evidence:** `.planning/phases/01-plumbing-process-lifecycle/01-02-SUMMARY.md` (PLUMB-03 closure), `.planning/phases/07-three-category-code-parsing-dispatch/` (Dispatch addition), `.planning/phases/09-slider-hud-per-param-lock/` (HudMessage addition).

No automated re-test. SC #6 is recorded-only.

---

## Automated Baseline Replay (VFY-05)

Phase 10 re-runs the plumbing harness built in Phase 6 06-02 against the same synthetic inputs. M1 baseline files at `.planning/baselines/v2.0/{lipsync,idle}.json` remain immutable (preserved as historical reference per Pitfall 5); replay outputs are written to `*-phase10-replay.json` filenames.

Harness re-run on 2026-05-09 (Task 2 automated replay):

| Mode | Phase 6 baseline (06-02, 2026-05-08) | Phase 10 replay | Tolerance | Pass? |
|------|--------------------------------------|-----------------|-----------|-------|
| lipsync | `pearson_r=0.9747730195034283` | `pearson_r=0.9747730195034283` (2026-05-09) | `>= 0.7` | yes |
| idle | `variance_sum=0.06643749130899018` | `variance_sum=0.06643749130899018` (2026-05-09) | `0 < x < 0.5` | yes |

Tolerance bands per D-E1: ±100ms latency / ±0.05 param values for SC #1 + SC #3 only. Both Phase 6 baselines exceed thresholds with substantial margin (lipsync 1.39× over; idle 7.5× under), so replay-time PASS is overdetermined — the harness's `passed: true` JSON field is the gate.

Replay commands (locked):

```bash
cd sidecar
uv run python scripts/plumbing_harness.py --mode lipsync --out ../.planning/baselines/v2.0/lipsync-phase10-replay.json
uv run python scripts/plumbing_harness.py --mode idle --out ../.planning/baselines/v2.0/idle-phase10-replay.json
```

Replay JSON files committed at:
- `.planning/baselines/v2.0/lipsync-phase10-replay.json`
- `.planning/baselines/v2.0/idle-phase10-replay.json`

What the harness does NOT cover (per RESEARCH.md `### What the harness does NOT cover`):
- SC #2 (`[smirk]` smooth blend) — operator-judged per D-B1 / D-B3.
- SC #4 (body sway through utterance) — operator-judged per D-B2 / D-B4.
- SC #5 (cursor) — verdict from Plan 10-01 outcome + operator visual confirmation.
- SC #6 (WS protocol shape) — bookkeeping rationale, not a runtime check.

---

## v2.0 Surfaces Verified in Their Own Phases (cross-reference, per D-C2)

Cross-reference table — does NOT duplicate verdicts. Verdicts live in each phase's own VERIFICATION.md per D-C3; Phase 9's live HUD UAT approval is recorded in `09-02-SUMMARY.md` and summarized by `09-VERIFICATION.md`.

| Surface | Phase | Verification artifact | Operator UAT artifact |
|---------|-------|----------------------|----------------------|
| Plugin runtime + default plugin (`[smirk]` action-code dispatch path; ARCH-01..12; PLG-01..10) | 6 | `.planning/phases/06-plugin-runtime-default-plugin/06-VERIFICATION.md` | `.planning/phases/06-plugin-runtime-default-plugin/06-HUMAN-UAT.md`, `.planning/phases/06-plugin-runtime-default-plugin/06-UAT.md` |
| Three-category dispatch (`{variant}` radio-button + `<event>` motion auto-completion; PARSE-01..08) | 7 | `.planning/phases/07-three-category-code-parsing-dispatch/07-VERIFICATION.md` | `.planning/phases/07-three-category-code-parsing-dispatch/07-HUMAN-UAT.md` |
| Avatar import + catalogs (`AvatarOverrides` schema; review screen; IMP-01..10) | 8 | `.planning/phases/08-avatar-import-catalogs/08-VERIFICATION.md` | `.planning/phases/08-avatar-import-catalogs/08-HUMAN-UAT.md` |
| HUD slider + per-param lock (`/hud/ws`, `set-lock`, focused `hud_visible_param_ids`, system-primitive exclusion; HUD-01..08) | 9 | `.planning/phases/09-slider-hud-per-param-lock/09-VERIFICATION.md` | `.planning/phases/09-slider-hud-per-param-lock/09-02-SUMMARY.md` |

---

## Milestone v2.0 Close Decision (per D-D2)

### Ship verdict

**Criteria:**
- **PASS** if all six §14 SCs are PASS, OR PARTIAL with documented future-direction rationale.
- **PARTIAL** if any SC is PARTIAL with no rationale, OR exactly one SC is FAIL with documented rationale.
- **FAIL** if more than one SC is FAIL, OR any SC is FAIL with no rationale.

**Recorded verdict:** PASS

**Decision basis:** All six §14 checks pass after Phase 10 gap closure. SC #2 smirk rendering is visible after Plan 10-03; SC #5 cursor tracking now has visible head and eye tracking after Plan 10-04; app-owned idle blinking was removed so VTS owns normal blinking.

### Open issues for next milestone

- **DPI awareness** — cursor projection on high-DPI displays uses raw pixel coordinates; on 200% scaling the synthetic-canvas projection skews toward one corner (VFY-02 deferred this).
- **Multi-monitor cursor robustness** — current synthetic-canvas fallback projects against primary monitor only; users on multi-monitor setups will see cursor tracking only when cursor is on primary screen.
- **Native Cubism rendering integration** — VTube Studio + pyvts is the v1 rendering path; native Cubism (alongside pixi-live2d-display-advanced) is a v1.5 / v2 candidate per CLAUDE.md "What NOT to Use" + PROJECT_DESIGN.md §11.
- **Body-sway physics-chain investigation** — head_only ship state acknowledged as mediocre per Phase 6 discuss-phase decision; AVT-06 R-OPEN-1 remains open. Future milestone may investigate `<model>.vtube.json` physics-chain proxy or `.exp3.json` body-pose modulation by RMS.
- **Multi-avatar identity persistence** — v1-horizon HEADLINE value, NOT v2.0. Per-avatar episodic Chroma stores + shared user-facts bucket + RRF-hybrid retrieval + write-on-promotion are the next milestone's deliverable (REQUIREMENTS MEM-01..MEM-07).

### v1-horizon progress note

The v2.0 milestone delivers the architectural foundation needed for v1-horizon multi-avatar identity persistence:

- **Plugin-driven motion (Phase 6)** — different avatars can have different motion plugins or share defaults; `BodyMotionPlugin` ABC + `RigCapabilities` rig-introspection contract makes plugins rig-agnostic.
- **Formalized three-category code system (Phase 7)** — avatars own `{variant}` and `<event>` codes via their `_avatar_overrides.yaml`; plugins own `[action]` codes via their `plugin.yaml`. Cross-category uniqueness enforced at boot.
- **Avatar-import flow with curated catalogs (Phase 8)** — `_avatar_overrides.yaml` per avatar is the persistence anchor for variant + event + emotion-binding catalogs. Re-openable from Settings.
- **HUD/lock primitives (Phase 9)** — focused 18-row Teto `hud_visible_param_ids` discovery + tuning surface for new rigs; non-blocking `/hud/ws` telemetry; session-only locks with system-primitive exclusion enforced at the merge layer.
- **Cursor namespace fix (Phase 10)** — first-time-working cursor tracking unblocks the §14 SC #5 verdict.

The v2.0 milestone does NOT yet ship multi-avatar episodic memory or the shared user-facts bucket. Single-avatar walking skeleton works end-to-end with the refactored architecture; per-avatar Chroma stores + RRF-hybrid retrieval + write-on-promotion are the next milestone's headline value (REQUIREMENTS MEM-01..MEM-07).

---

*Phase: 10-cursor-polish-14-sc-re-verification*
*Origin: M1 SC-01 deferred from Phase 5 on 2026-05-08; closes here per VFY-04.*
