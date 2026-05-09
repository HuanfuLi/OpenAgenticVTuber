# Phase 5: Polish, Contracts Codegen, §14 Verification — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 05-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 05-polish-contracts-codegen-14-verification
**Areas discussed:** Codegen ergonomics & drift discipline, Verification doc format & evidence rigor, Ship-readiness gates, PITFALLS e2e checklist scope

---

## Codegen Pipeline (SC-02)

### Q1: Codegen tool

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled chain (Pydantic `model_json_schema()` → JSON Schema → `json-schema-to-typescript`) | ~80 LOC + 1 npm dep; Pydantic source-of-truth; matches CLAUDE.md guidance | ✓ |
| `pydantic2ts` | Single dep, ~1 line invocation; intermittently maintained; less control over discriminated-union shape | |
| Both (hand-rolled primary, pydantic2ts as A/B reference in CI) | Hybrid; ~1 extra dev-day | |

**User's choice:** Hand-rolled chain (Recommended)
**Notes:** User responded "Just follow your recommendation here" after asking for a plain-English explanation of what codegen is and confirming the four codegen picks once they understood.

### Q2: codegen.sh invocation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Manual run + commit-the-output discipline | Engineer runs `./packages/contracts/codegen.sh`, commits regenerated TS; CI runs codegen + `git diff --exit-code` to catch drift | ✓ |
| npm script alias only | `npm run codegen`; no CI guard; relies on engineer discipline | |
| Pre-commit hook (husky/lefthook) | Auto-runs codegen + git-adds before each commit | |
| CI-only (regenerate, fail-on-diff, do not commit) | Cleanest in theory; complicates local IDE imports | |

**User's choice:** Manual run + commit-the-output discipline (Recommended)

### Q3: Generated TS file location

| Option | Description | Selected |
|--------|-------------|----------|
| Replace `packages/contracts/ts/*.ts` in place | Codegen overwrites the four existing hand-written files; `@contracts/*` alias unchanged | ✓ |
| ROADMAP-literal `packages/contracts/generated/ts/*.ts` | New subdir; rewrite alias; delete hand-written | |
| Single bundled `packages/contracts/ts/index.ts` | Cleaner imports; bigger churn | |

**User's choice:** Replace `packages/contracts/ts/*.ts` in place (Recommended)

### Q4: Type guards (`isAudioPayload` etc.)

| Option | Description | Selected |
|--------|-------------|----------|
| Codegen produces guards | Wrapper script appends `is<Variant>` predicates derived from Pydantic's discriminator field; ~15 LOC addition | ✓ |
| Keep guards hand-written in `packages/contracts/ts/guards.ts` | Codegen produces types only; sibling file holds predicates | |
| Drop guards entirely; use `m.type === 'audio'` at call sites | Removes ~10 helpers; noisier call sites | |

**User's choice:** Codegen produces guards (Recommended)

---

## §14 Verification Record (SC-01)

### Q5: Doc structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single `.planning/skeleton-verification.md` with three embedded sections | Self-contained handoff doc; one place to read | ✓ |
| Split: skeleton-verification.md + body-sway-investigation.md + pitfalls-checklist.md | Three sibling files; cleaner separation | |
| Single doc, body-sway report stays under 04-04 folder + linked | Avoids moving files; preserves Phase 4 in place | |

**User's choice:** Single `.planning/skeleton-verification.md` with embedded sections (Recommended)

### Q6: Per-SC evidence depth

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered: scripted output for the testable, video clip for the visible | Automated where possible; 5–10s clips per visible SC; operator-narrated paragraphs | ✓ |
| Prose-only (operator describes observations) | Cheapest; thinner audit trail | |
| Heavy: video for every SC + log excerpts + before/after screenshots per SC | Maximum rigor; ~2 dev-days extra | |

**User's choice:** Tiered: scripted output for the testable, video clip for the visible (Recommended)

### Q7: PARTIAL/FAIL handling

| Option | Description | Selected |
|--------|-------------|----------|
| Three-state: PASS / PARTIAL / FAIL with explicit rationale | Captures reality; aligns with AVT-06 explicit head-only allowance | ✓ |
| Strict binary PASS/FAIL | Forces editorial dishonesty when AVT-06 head-only ships | |
| Pass with caveat-list | Single PASS column; caveats in known-limitations section | |

**User's choice:** Three-state: PASS / PARTIAL / FAIL with explicit rationale (Recommended)

### Q8: Verification runner

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: `verify-skeleton.sh` runs automated checks, operator drives visible ones | Auto subset (split-bracket, DeepSeek-R1, port-collision, OLVT diff, codegen drift); operator records 4 visible-SC clips | ✓ |
| Operator-driven entirely | Cheapest; risks forgotten-step bugs | |
| Fully automated (best-effort, including CV lipsync diff) | ~5–10 dev-days; out of scope | |

**User's choice:** Hybrid (Recommended)

---

## Ship-Readiness Gates

### Q9: Clean-clone validation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fresh-clone test as part of verification | Clone to fresh dir, install (npm + uv + LFS hydrate), boot VTS+Teto, run full demo; commands committed verbatim | ✓ |
| Yes, but limited to codegen.sh (ROADMAP-literal SC-02 wording only) | Cheaper; lower confidence on full setup | |
| No clean-clone test | Verify on working tree only; lightest | |

**User's choice:** Yes — do a real fresh-clone test (Recommended)
**Notes:** Critical for catching LFS-hydrate gaps (Teto rig, voice .onnx). User initially asked for clarification on the questions; re-asked in plainer language with concrete framing.

### Q10: Hard-block bar

| Option | Description | Selected |
|--------|-------------|----------|
| Strict-but-realistic: any FAIL blocks ship; PARTIAL only where requirement permits (AVT-06) | Honest gate; matches "walking skeleton must walk" | ✓ |
| Loose: document FAILs as known issues; ship anyway | Permissive; risks shipping a non-walking skeleton | |
| Strictest: every SC must PASS, no PARTIAL even on AVT-06 | Conflicts with AVT-06's explicit allowance | |

**User's choice:** Strict-but-realistic (Recommended)

### Q11: Demo runner artifact

| Option | Description | Selected |
|--------|-------------|----------|
| README "Quickstart Demo" section + `scripts/verify-skeleton.sh` | Top-level README discoverable; commands verbatim from fresh-clone test | ✓ |
| Demo procedure lives only inside skeleton-verification.md | Lower discoverability; cleaner if README is shipping-audience-only | |
| Recorded demo video as primary artifact | LFS bandwidth growth; not a substitute for actually running | |

**User's choice:** README Quickstart + verify-skeleton.sh (Recommended)

---

## PITFALLS E2E Checklist

### Q12: PITFALLS e2e scope

| Option | Description | Selected |
|--------|-------------|----------|
| Just the 5 ROADMAP-mandated tests (joy token-boundary, DeepSeek-R1, VTS auth-reprompt, port-collision, OLVT protocol diff) | Cheapest; other 13 already runtime-guarded by Phases 1–4 | ✓ |
| 5 mandatory + 3 high-value extras (1s re-injection, 60Hz rate-cap, mode:add with webcam) | Catches three subtle Phase 4 regressions; ~1 extra dev-day | |
| Comprehensive: every "critical" pitfall gets an e2e | Doubles Phase 5 verification scope; overkill for skeleton | |

**User's choice:** Just the 5 ROADMAP-mandated tests (Recommended)

---

## Wrap-up

### Q13: Continue or wrap?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Decisions captured across all 4 areas | ✓ |
| Explore more gray areas | Drill into something else | |

**User's choice:** I'm ready for context (Recommended)

---

## Claude's Discretion

The user explicitly deferred (or by stated preference deferred) these to planner judgment with documented defaults captured in CONTEXT.md:

- Banner comment text on regenerated TS files
- JSON Schema intermediate file location (committed vs gitignored)
- Optional/None handling in TS (`string | null` vs `string?`)
- codegen.sh runtime location (repo root vs scripts subdir)
- CI drift-check implementation (GitHub Actions vs Husky vs documented manual step)
- verify-skeleton.sh language (bash vs Python orchestration)
- Visible-SC clip durations (5s vs 10s)
- Demo prompt text (one prompt that exercises all six SCs in one continuous demo)
- Pydantic-to-JSON-Schema discriminator round-trip handling for `WSMessage`'s 9-variant union
- README Quickstart prerequisites list (pull from CLAUDE.md verbatim)
- Body-sway investigation report integration depth in §C (one-paragraph-per-strategy vs link-only)
- Fresh-clone test environment (different folder vs different machine vs Windows VM)

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Notable items:

- CI/CD pipeline beyond a single drift-check workflow (post-skeleton public-release milestone)
- Automated CV verification of visible §14 SCs (~5–10 dev-days; out of scope)
- Cross-platform fresh-clone test (Windows-pinned skeleton; future milestone)
- Public release-engineering (electron-builder signing, auto-update wiring)
- Telemetry / analytics in verification flow
- `pydantic2ts` A/B comparison (defer unless hand-rolled chain shows shape bugs)
- TypeScript-as-source-of-truth for renderer-only types (no such contracts in skeleton)
- Schema versioning for WS envelope (single-user single-tree means kept-in-sync mechanically)
- Code-quality enforcement (Ruff/ESLint/Prettier in CI; post-skeleton)
- Live debug-overlay HUD on canvas (deferred in Phase 4; same here)
