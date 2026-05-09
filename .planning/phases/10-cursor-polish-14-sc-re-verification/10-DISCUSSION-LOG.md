# Phase 10: Cursor Fix + §14 SC Re-Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 10-cursor-polish-14-sc-re-verification
**Areas discussed:** A (Cursor stance), B (Operator ceremony script), C (v2.0 surfaces in §14 ceremony), D (skeleton-verification.md structure)

---

## Pre-Discussion Doc Inconsistency Discovered

ROADMAP §Phase 10 used inconsistent SC numbering between line 48 (canonical: SC #3 idle, SC #4 body sway) and the older line 257 (typo: "SC #2 + SC #3 operator-judged"). This was flagged at the start of the discuss-phase and resolved during sync-edits at end-of-discuss.

**Resolution:** Line 48 numbering is canonical. ROADMAP + REQUIREMENTS sync-edits during this discuss-phase aligned all references to: SC #1 lipsync / SC #2 [smirk] blend / SC #3 idle / SC #4 body sway / SC #5 cursor / SC #6 OLVT WS shape.

---

## A. Cursor Stance

### A1. Cursor gate UX impact (initial framing)

| Option | Description | Selected |
|--------|-------------|----------|
| Limited me, ship polish | Cursor outside VTS window made avatar look dead during chat; ship VFY-02 polish | |
| Acceptable, skip | Gate behavior is fine; SC #5 records PARTIAL with future-direction rationale | |
| You recommend | Claude recommends skip (VFY-01 says optional; synthetic fallback is band-aid; v2.0 priority is plugin/dispatch/HUD) | |

**User's response (after I rewrote the question in clearer Chinese):** `这个feature根本没工作过，一直fail`

This response **fundamentally reframed Area A**. Cursor tracking has never produced visible avatar response in any phase 1–9 run. The premise of all three options ("polish current behavior") was wrong. Saved as memory `project_cursor_broken_since_m1.md` and asked again.

### A1-followup. Phase 10 cursor stance

| Option | Description | Selected |
|--------|-------------|----------|
| Time-box investigation (2-3 hours) | Add 1 task; if quick fix → PASS/PARTIAL; otherwise FAIL with diagnosis | |
| Don't investigate, record FAIL | SC #5 = FAIL; defer to next milestone with native Cubism path | |
| Fix it, untimed | No time-box; v2.0 closeout requires cursor fix; aim PASS | ✓ |

**User's choice:** `优先修通、不限时`
**Notes:** This required ROADMAP VFY-01/02 amendment (sync-edited at end of discuss-phase): from "optional polish, defaults to optional" to "Phase 10 mandatory work; SC #5 aims PASS".

---

## B. SC #2 + SC #4 Operator Ceremony Script

### B1. SC #2 replacement code for `[joy]`

User asked clarifying question first: `smirk是模型自带的variant code吗？还是插件的action code？`

Claude clarified: `smirk` is a `[action]` plugin code (square brackets, plugin-author business per Phase 6 decision), defined in `plugins/default/plugin.yaml`. It is NOT a `{variant}` rig code (curly braces, from `_avatar_overrides.yaml`).

| Option | Description | Selected |
|--------|-------------|----------|
| smirk | Single-side mouth raise; clear but not over-dramatic; good for fade-in observation | ✓ |
| surprise | Wide eyes + open mouth; biggest dynamic range but tone differs from original `[joy]` "happy" | |
| neutral | Minimal change; insufficient to demonstrate smooth blend; not recommended | |

**User's choice:** `smirk`

### B2. SC #4 long-utterance audio source

User rejected the first version of this question (`你又在胡言乱语了，重新问`). Memory `feedback_chinese_discussion.md` updated with concrete bad/good examples. Re-asked in cleaner Chinese.

| Option | Description | Selected |
|--------|-------------|----------|
| LLM improvises long reply | Fixed prompt baked into ceremony script; LLM each run generates ~30s text | ✓ |
| Bypass LLM, inject preset text | Add admin endpoint to inject TTS text directly; full reproducibility | |
| Operator pastes preset, LLM echoes | Reproducible without code change; LLM may add filler words | |

**User's choice:** `让 LLM 即兴生成一段长话`
**Notes:** Reproducibility was less important than no-code-change deployment.

### B3. Visual checklists + verdict rubric

Strawman presented (three checks per SC + three-tier verdict).

**SC #2 [smirk] checks:**
1. Expression entry is gradual (faded), not pop
2. Full fade-in process visible from token trigger to sentence end
3. Expression decays gradually, not abruptly cut

**SC #4 body sway checks:**
1. Visible body motion (not flat)
2. Through ~30s, motion does not freeze on one side or get stuck centered
3. Sway feels coherent with TTS rhythm

**Verdict rubric:** all three → PASS; 1-2 or ambiguous → PARTIAL; none → FAIL.

**User's choice:** `就这样定`

---

## C. v2.0 Surfaces in §14 Ceremony

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-reference table only | skeleton-verification.md adds a table linking 06/07/08/09 VERIFICATION + HUMAN-UAT; no verdict duplication | ✓ |
| Strict M1-only, no v2.0 mention | skeleton-verification.md only covers §14; milestone-close requires hopping between docs | |
| Duplicate verdicts into skeleton-verification.md | Full self-contained file but duplication maintenance burden | |

**User's choice:** `只加一个 cross-reference 表`

---

## D. skeleton-verification.md Structure + Milestone-Close Decision

Strawman presented as a 4-section markdown structure (§14 SC Verdicts / Automated Baseline Replay / v2.0 Surfaces Cross-ref / Milestone v2.0 Close Decision).

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt strawman | Plan-phase researcher locks the 4-section structure; minor wording tuning OK | ✓ |
| Adjust structure | User would describe specific changes | |

**User's choice:** `就这样、小调不调都行`

---

## Process Notes

- User flagged Chinese-quality regression twice during this session (Area A first wording, Area D-B2 first wording). Memory `feedback_chinese_discussion.md` updated with two new bad/good examples after each flag.
- The Phase 10 Goal scope **expanded** mid-discussion: cursor went from "optional polish" (per ROADMAP draft) to "mandatory diagnose + fix" (per user reveal that cursor never worked). This change required sync-edits to ROADMAP §Phase 10 + REQUIREMENTS §VFY-01/02 at end of discuss-phase, not just CONTEXT.md.
- ROADMAP SC numbering inconsistency (line 48 vs line 257) was discovered at discuss-phase start and corrected as part of sync-edits.

## Claude's Discretion

- Exact LLM-improvised long-utterance prompt wording (strawman: "tell me a 60-word funny story about a cat in space")
- Cross-reference table entry order in v2.0 Surfaces section
- Markdown formatting of skeleton-verification.md within the 4-section structure
- Whether cursor diagnose-pass logging is permanent or removed after fix

## Deferred Ideas

- Time-boxed cursor investigation
- DPI awareness, multi-monitor cursor
- Native Cubism rendering integration
- Body-sway physics-chain investigation (head_only mediocre but acceptable for SC #4 PASS rubric)
- Multi-avatar identity persistence (v1-horizon, next milestone)
- Real-time verification dashboard / re-run automation
