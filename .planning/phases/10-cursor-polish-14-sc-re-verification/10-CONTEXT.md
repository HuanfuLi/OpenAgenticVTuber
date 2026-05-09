# Phase 10: Cursor Fix + §14 SC Re-Verification - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Two parallel deliveries closing milestone v2.0:

1. **Mandatory cursor diagnose + fix + polish** — user confirmed during this discuss-phase that cursor tracking has never produced visible avatar response since milestone-1. Phase 10 includes an untimed root-cause investigation, the underlying fix, drop of the in-VTS-window gate at `cursor_driver.py:30-32`, and synthetic-canvas fallback (primary-monitor center when no VTS rect detected). VFY-01/02 ROADMAP wording amended from "optional polish" to "Phase 10 mandatory work".

2. **§14 SC re-verification ceremony** — the deferred milestone-1 SC-01 deliverable lands here against the refactored architecture. All six §14 SCs receive PASS / PARTIAL / FAIL verdicts in `.planning/skeleton-verification.md`. SC #2 (`[smirk]`, replacing the removed `[joy]`) and SC #4 (body sway) are operator-judged via a Phase 10 visual-review ceremony script. SC #1 (lipsync) and SC #3 (idle) replay against the existing Phase 6 06-02 baseline harness. SC #5 (cursor) verdict comes from the cursor-fix outcome above. SC #6 (OLVT WS shape) records PASS with "M1-verified, v2.0 unchanged" rationale.

**NOT in scope (kept out by scope guardrail):**
- Re-verification of v2.0-new surfaces (variant / event dispatch, HUD slider lock, plugin runtime, avatar import) — each phase's own VERIFICATION + UAT/summary documents stand. skeleton-verification.md cross-references them but does not duplicate verdicts.
- Multi-avatar identity persistence — that is v1-horizon value for the next milestone.
- DPI awareness, multi-monitor robustness for cursor — explicitly deferred per VFY-02; v2.0 doesn't bet on this.
- Native Cubism rendering integration — deferred to a later milestone alongside global cursor improvements.

</domain>

<decisions>
## Implementation Decisions

### A. Cursor Stance

- **D-A1:** Cursor tracking has been broken since milestone-1 — user confirmed `这个feature根本没工作过，一直fail` during this discuss-phase (saved as memory `project_cursor_broken_since_m1.md`). CursorDriver code at `sidecar/src/sidecar/compositor/cursor_driver.py` is present but has not produced visible avatar response in any phase 1–9 run.
- **D-A2:** Phase 10 cursor work is **mandatory**, not optional polish. ROADMAP VFY-01/02 wording amended (sync-edit committed with this discuss-phase): "optional polish, defaults to optional, SC #5 PARTIAL fallback" → "Phase 10 includes mandatory diagnose + fix + polish; SC #5 aims PASS".
- **D-A3:** Investigation depth: instrument all four candidate failure paths upfront (`window_detect.get_cursor_and_rect()` always returning None; CursorDriver not wired into `Compositor.__init__` at boot; rig param ID mismatch with `ParamAngleX/Y` + `ParamEyeBallX/Y`; Win32 API auth/permissions). Avoids round-trip diagnosis.
- **D-A4:** After root-cause fix lands, follow-on polish work: drop in-VTS-window gate at `cursor_driver.py:30-32`; add synthetic-canvas fallback projecting against primary-monitor center when no VTS rect.
- **D-A5:** Time-box: **untimed**. v1-horizon priority is plugin/dispatch/HUD (already shipped); cursor is the final SC standing. User chose "优先修通、不限时" over "time-box 2-3 hours" or "skip and record FAIL".
- **D-A6:** SC #5 verdict aims PASS. Fall back to PARTIAL/FAIL only if root cause proves intractable, with the diagnosis itself committed into skeleton-verification.md as the "what we tried, what we found" record.

### B. SC #2 + SC #4 Operator Ceremony Script

- **D-B1:** **SC #2 uses `[smirk]`**, not `[joy]`. `[joy]` was removed from `plugins/default/plugin.yaml` in 06-08 because the active Teto avatar's `_avatar_overrides.yaml` has no joy variant. `[smirk]` is a `[action]` plugin code (square brackets, plugin-author business per 2026-05-08 Phase 6 decision), defined in plugin.yaml's current vocabulary. Visually it produces a single-side mouth raise — change is clear but not over-dramatic.
- **D-B2:** **SC #4 uses an LLM-improvised long-utterance prompt** baked into the ceremony script. Default prompt: `tell me a 60-word funny story about a cat in space` (or similar — exact wording locked at plan-time). Operator pastes the prompt into chat; LLM generates ~30-45s of TTS audio; operator observes body motion through the full utterance.
- **D-B3:** **SC #2 visual checklist (three checks):**
  1. Expression entry is gradual (faded in), not a hotkey-style pop
  2. Full fade-in process is visible from `[smirk]` token trigger to end of sentence
  3. After sentence completion, expression decays gradually back, not abruptly cut
- **D-B4:** **SC #4 visual checklist (three checks):**
  1. Visible body motion (not flat/static through the utterance)
  2. Through ~30 seconds, motion does not freeze on one side or get stuck centered
  3. Sway feels coherent with TTS rhythm — not jarringly out of sync
- **D-B5:** **Verdict rubric (both SCs):** all three checks clearly observed → PASS; 1-2 checks observed or all three observed but ambiguously → PARTIAL; no checks observed (or motion looks broken) → FAIL.

### C. v2.0 Surfaces in §14 Ceremony

- **D-C1:** §14 ceremony **strictly re-runs the original M1 6 SCs**. v2.0-new surfaces (variant dispatch, event dispatch, HUD lock, plugin runtime, avatar import) are NOT re-tested in §14 ceremony.
- **D-C2:** skeleton-verification.md contains a **cross-reference table** under "v2.0 Surfaces Verified in Their Own Phases" that points to:
  - Phase 6 plugin runtime + default plugin → `06-VERIFICATION.md`, `06-HUMAN-UAT.md`, `06-UAT.md`
  - Phase 7 three-category dispatch → `07-VERIFICATION.md`, `07-HUMAN-UAT.md`
  - Phase 8 avatar import + catalogs → `08-VERIFICATION.md`, `08-HUMAN-UAT.md`
  - Phase 9 HUD + per-param lock → `09-VERIFICATION.md`, `09-02-SUMMARY.md` (live UAT approval and the 529-row → 18-row HUD-visible fix are recorded there)
- **D-C3:** Cross-reference table does NOT duplicate verdicts — only navigates. Each phase's own UAT artifacts remain authoritative for that phase's surface.

### D. skeleton-verification.md Structure + Milestone-Close Decision

- **D-D1:** skeleton-verification.md has four top-level sections in this order:
  1. **§14 Success Criteria Verdicts (M1 re-run ceremony)** — six SC entries with verdict, observation, evidence link
  2. **Automated Baseline Replay (VFY-05)** — `lipsync.json` and `idle.json` replay results with run command + timestamp
  3. **v2.0 Surfaces Verified in Their Own Phases** — cross-reference table per D-C2
  4. **Milestone v2.0 Close Decision** — ship verdict, open issues for next milestone, v1-horizon progress note
- **D-D2:** Milestone close section content:
  - **Ship verdict** (PASS / PARTIAL / FAIL with criteria — e.g., "PASS if all six §14 SCs are PASS or PARTIAL with rationale; FAIL if any SC is FAIL with no documented future-direction")
  - **Open issues for next milestone** — e.g., DPI awareness, multi-monitor cursor, native Cubism path, body-sway physics-chain investigation, multi-avatar identity persistence (v1-horizon headline)
  - **v1-horizon progress note** — narrative paragraph: single-avatar walking skeleton works; per-avatar episodic memory + shared user-facts is the next milestone's headline value (multi-avatar identity persistence)

### Tolerance Bands (VFY-05)

- **D-E1:** ±100ms latency / ±0.05 param values for **SC #1 (lipsync) and SC #3 (idle) only**. Both already PASS in Phase 6 06-02 (lipsync pearson_r=0.97 ≥ 0.7; idle variance_sum=0.066 ≤ 0.5 ceiling). Phase 10 simply re-runs and confirms; tightening defaults not needed unless a baseline regression is observed.

### Folded Todos

None — todo match-phase returned 0 matches.

### Claude's Discretion

- Exact wording of LLM-improvised long-utterance prompt (`tell me a 60-word funny story about a cat in space` is the strawman; plan-phase researcher may swap if a better prompt is identified)
- Order of cross-reference table entries in v2.0 Surfaces section
- Markdown formatting / heading hierarchy of skeleton-verification.md (within the 4-section structure D-D1 locks)
- Whether the cursor diagnose pass adds permanent debug logging or temporary instrumentation that gets removed after fix lands

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Invariants (REQUIREMENTS.md)
- `.planning/REQUIREMENTS.md` §VFY-01 — Cursor mandatory for Phase 10 (amended 2026-05-08 by this discuss-phase)
- `.planning/REQUIREMENTS.md` §VFY-02 — Cursor scope: diagnose + fix + drop gate + synthetic fallback (amended 2026-05-08)
- `.planning/REQUIREMENTS.md` §VFY-03 — §14 SC re-run; SC #2 [smirk] + SC #4 body sway operator-judged; canonical SC numbering aligned 2026-05-08
- `.planning/REQUIREMENTS.md` §VFY-04 — skeleton-verification.md commit
- `.planning/REQUIREMENTS.md` §VFY-05 — Side-by-side baseline harness scope (lipsync SC#1 + idle SC#3)
- `.planning/REQUIREMENTS.md` §AVT-08 — original `[joy]` definition (now superseded for ceremony purposes by `[smirk]` per D-B1)
- `.planning/REQUIREMENTS.md` §AVT-10 — Win32 cursor polling contract (the broken behavior Phase 10 fixes)
- `.planning/REQUIREMENTS.md` §ARCH-06 — single pyvts writer rule (must hold post-cursor-fix)

### Roadmap
- `.planning/ROADMAP.md` §"Phase 10: Cursor Fix + §14 SC Re-Verification" — Goal + 6 SCs + 2 plans (rewritten 2026-05-08 by this discuss-phase)
- `.planning/ROADMAP.md` §"AVT-08" / line 48 — canonical §14 SC #1-6 list

### Prior Phase Artifacts (existing baselines + tooling)
- `sidecar/scripts/plumbing_harness.py` — built in Phase 6 06-02; lipsync + idle harness; replayed in 10-02
- `.planning/baselines/v2.0/lipsync.json` — `pearson_r=0.97`, threshold `0.7`, captured Phase 6 06-02
- `.planning/baselines/v2.0/idle.json` — `variance_sum=0.066`, ceiling `0.5`, captured Phase 6 06-02
- `.planning/phases/06-plugin-runtime-default-plugin/06-02-SUMMARY.md` — harness construction details
- `.planning/phases/06-plugin-runtime-default-plugin/06-CONTEXT.md` — Phase 6 discuss-phase decision that SC #2 / SC #4 are operator-judged (no JSON baseline)

### Phase UAT Artifacts (cross-reference targets per D-C2)
- `.planning/phases/06-plugin-runtime-default-plugin/06-VERIFICATION.md`, `06-HUMAN-UAT.md`, `06-UAT.md`
- `.planning/phases/07-three-category-code-parsing-dispatch/07-VERIFICATION.md`, `07-HUMAN-UAT.md` (Phase 7 in execution as of 2026-05-08)
- `.planning/phases/08-avatar-import-catalogs/08-VERIFICATION.md`, `08-HUMAN-UAT.md`
- `.planning/phases/09-slider-hud-per-param-lock/09-VERIFICATION.md`, `09-02-SUMMARY.md` (Phase 9 completed 2026-05-09; live UAT approved after `hud_visible_param_ids` and non-blocking `/hud/ws` fixes)

### Code Anchors
- `sidecar/src/sidecar/compositor/cursor_driver.py:30-32` — in-VTS-window gate to be dropped after fix
- `sidecar/src/sidecar/vts/window_detect.py` — `get_cursor_and_rect()` candidate root-cause site
- `sidecar/src/sidecar/compositor/compositor.py` — Compositor `__init__` with optional `cursor_driver` arg; check whether boot path passes it
- `plugins/default/plugin.yaml` — current `[action]` vocabulary (`anger / disgust / fear / neutral / sadness / smirk / surprise`)
- `avatars/重音テト/_avatar_overrides.yaml` — Teto avatar runtime catalog (used as ceremony rig)
- `.planning/skeleton-verification.md` — Phase 10 deliverable file (does not yet exist; created in 10-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Plumbing harness** (`sidecar/scripts/plumbing_harness.py`): already built; supports `--mode lipsync` and `--mode idle`; emits JSON to a configurable `--out` path. Phase 10 just re-runs.
- **Phase 6 baselines** (`.planning/baselines/v2.0/{lipsync,idle}.json`): captured PASS values; comparison logic is "current pearson_r ≥ threshold" / "current variance_sum ≤ ceiling" — already encoded in harness.
- **CursorDriver class** (`sidecar/src/sidecar/compositor/cursor_driver.py`): full ease-back logic + dead-zone + canvas mapping all present; the integration is what's broken, not the compute. Investigation should focus on inputs (window_detect, boot wiring, param IDs) before suspecting the math.
- **Phase 6 ARCH-06 CI test** (`sidecar/tests/test_arch06_single_writer.py`): asserts single pyvts writer; cursor fix must keep this green (don't introduce a second writer).

### Established Patterns
- **Operator UAT script as markdown deliverable**: Phase 6 + Phase 7 shipped HUMAN-UAT.md files with reporter-style entries; Phase 9 recorded live UAT in `09-02-SUMMARY.md` and `09-VERIFICATION.md`. The ceremony script for Phase 10 follows the same numbered steps + checklist + verdict shape.
- **Skeleton-verification deliverable as markdown**: M1 SC-01 deferred this to Phase 10; the file does not yet exist. Format per D-D1 above.
- **Cross-reference rather than duplication**: 06-HUMAN-UAT.md links 06-VERIFICATION.md re_verification_3; this discuss-phase reuses that pattern for v2.0 surface coverage.

### Integration Points
- `sidecar/src/sidecar/main.py` (or wherever Compositor boot wiring lives) — confirm CursorDriver is passed to `Compositor.__init__` in real run path, not just tests
- `apps/electron-main/src/sidecar.ts` — confirm sidecar boot env / config doesn't disable cursor (e.g., a flag like `AGENTICLLMVTUBER_DISABLE_CURSOR`)
- Phase 7's PyvtsSafeWriter.requestSetParameterValue / requestInjectParameterData callsites — cursor fix may need to verify which inject mode is being used (some VTS modes ignore Cubism param writes entirely)

</code_context>

<specifics>
## Specific Ideas

- **"Lock means lock" principle from Phase 9 carries into ceremony**: SC #2 ceremony observes `[smirk]` smooth blend WITHOUT user lock — the goal is to verify the underlying compositor + plugin path produces smooth output. If a lock is engaged on relevant params (eye/mouth), it would mask the SC #2 mechanism. Operator instructions: if the HUD is open, clear any locks and close the separate HUD window before SC #2 / SC #4 observation.
- **Phase 9 carry-forward smoke is preflight, not a new §14 verdict**: Before the ceremony, a quick HUD smoke may be recorded as setup evidence: `/admin/rig-capabilities` exposes the focused `hud_visible_param_ids` surface (18 rows on live Teto), `/hud/ws` emits `param-frame`, and `FaceAngleX` can be locked/cleared. This confirms the approved Phase 9 state without duplicating HUD verdicts in skeleton-verification.md.
- **Cursor diagnosis needs to be honest**: if root cause turns out to be something fundamental (e.g., VTS doesn't accept ParamAngleX writes from non-Cubism-rig clients on the user's setup), Phase 10 records a FAIL verdict with the diagnosis, not a forced PASS. Per D-A6.
- **§14 SC #6 (WS protocol shape) is bookkeeping**: M1 Phase 1+2 verified OLVT envelope shape; v2.0 added `Dispatch` (Phase 7) and `HudMessageS2C/C2S` (Phase 9) but those are NEW message types under the same envelope, not OLVT-shape changes. SC #6 records PASS with "verified M1, v2.0 surfaces extend without changing OLVT envelope shape" rationale — no re-test needed.

</specifics>

<deferred>
## Deferred Ideas

- **Time-boxed cursor investigation**: rejected; user chose "优先修通、不限时". If diagnosis takes longer than a wave allots, that's acceptable.
- **DPI awareness, multi-monitor cursor robustness**: out of scope per VFY-02 amendment. Defer to a later milestone alongside native Cubism integration.
- **Native Cubism rendering integration**: deferred. v2.0 shipped on VTube Studio; native Cubism is a v1.5 / v2 candidate alongside pixi-live2d-display-advanced (per CLAUDE.md "What NOT to Use" and §11 PROJECT_DESIGN.md).
- **Body-sway physics-chain investigation**: head_only ship state per Phase 6 was acknowledged as mediocre. SC #4 verdict under this discuss-phase's PASS/PARTIAL/FAIL rubric is permissive (head_only WILL pass D-B4 visual checks); but the architectural improvement is deferred to next milestone.
- **Multi-avatar identity persistence**: v1-horizon value, NOT v2.0. Phase 10 milestone-close section calls this out as the next milestone's headline value but does not implement.
- **Real-time skeleton-verification dashboard / re-run automation**: out of scope. Phase 10 produces a markdown deliverable; future milestone may wire a dev-panel button or sidecar CLI for re-running.

</deferred>

---

*Phase: 10-cursor-polish-14-sc-re-verification*
*Context gathered: 2026-05-08*
