# Phase 21: Code-Switch Evaluation + Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-10T01:01:12.1531993-04:00
**Phase:** 21-Code-Switch Evaluation + Hardening
**Areas discussed:** Eval Corpus Shape, Scoring Rules, Default Recommendation Policy, Provider Copy Surface, Hardening Behavior

---

## Eval Corpus Shape

| Question | Options | Selected |
|----------|---------|----------|
| What should the locked code-switch corpus optimize for? | Realistic companion utterances; Benchmark-style coverage; Hybrid corpus | Realistic companion utterances |
| Include real target names/app-specific terms, or keep generic? | Include target terms; Generic only; Mixed | Generic only |
| How large should the first locked corpus be? | Small and repeatable; Medium coverage; Tiny smoke set | Small and repeatable, around 20-30 utterances |
| How should audio samples be produced? | User-recorded reference set; Text-only corpus first; Synthetic/generated audio | User-recorded reference set |

**Notes:** Corpus should be realistic for companion speech but generic enough to avoid project/provider/product-specific bias.

---

## Scoring Rules

| Question | Options | Selected |
|----------|---------|----------|
| What should count most when evaluating a transcript? | Meaning plus key tokens; Near-exact transcript; Meaning only | Meaning plus key tokens |
| Should punctuation, capitalization, and spacing affect score? | Ignore formatting unless meaning changes; Light penalty; Strict formatting | Ignore formatting unless meaning changes |
| How should Chinese text normalization be handled? | Accept equivalent Chinese variants; Require expected script exactly; Track separately | Accept equivalent Chinese variants |
| How should no-translation be enforced? | Hard fail on translation; Weighted penalty; Provider note only | Hard fail on translation |

**Notes:** Semantic correctness is primary, but key-token loss and translation break the product claim.

---

## Default Recommendation Policy

| Question | Options | Selected |
|----------|---------|----------|
| May Phase 21 change the default STT recommendation if evidence disagrees with FunASR/SenseVoice preference? | Evidence can change default; FunASR stays default unless broken; No automatic recommendation change | Evidence can change default |
| How should cloud providers compete with local providers? | Local-first tie-breaker; Best score wins; Cloud never default | Cloud never default |
| What should trigger changing local default away from FunASR/SenseVoice? | Clear local winner only; Any higher local score; Manual decision after scorecard | Clear local winner only |
| If no local provider performs well enough for code-switching, what should the app say? | Truthful degraded recommendation; No recommended provider; Recommend cloud for quality | Truthful degraded recommendation |

**Notes:** Local-first remains a product boundary. Scorecard evidence can change which local provider is recommended, but cloud providers remain opt-in alternatives only.

---

## Provider Copy Surface

| Question | Options | Selected |
|----------|---------|----------|
| Where should evidence-backed code-switch quality copy appear? | Settings labels plus diagnostics; Settings labels only; Diagnostics only | Settings labels plus diagnostics |
| How detailed should Settings provider labels be? | Short capability badges; One-sentence summaries; Both badges and sentence | Short capability badges |
| Should the scorecard be user-facing in the app? | User-facing diagnostics; Developer artifact only; Exportable report only | Developer artifact only |
| Should user-facing copy mention cloud providers' quality if they score better? | Mention as opt-in alternative; Do not compare cloud in UI; Only mention after cloud configured | Do not compare cloud in UI |

**Notes:** Final interpretation: Settings should show concise badges only. The detailed scorecard is developer/planning evidence, not an in-app scorecard, and cloud quality should not be promoted in UI.

---

## Hardening Behavior

| Question | Options | Selected |
|----------|---------|----------|
| If an enabled provider passes readiness but fails code-switch eval, what should the app do? | Warn and label limitation; Block code-switch claim only; Block provider enablement | Warn and label limitation |
| Runtime translated-transcript detection or eval-only enforcement? | Eval harness only; Runtime warning too; Runtime block | Eval harness only |
| How aggressive should provider fixes be if scorecard reveals gaps? | Targeted config/output hardening; Evidence only; Broad provider rewrite allowed | Targeted config/output hardening |
| Should Phase 21 require live manual UAT after corpus passes? | Yes, short live UAT; No, corpus evidence is enough; Manual only if scorecard changes default | Yes, short live UAT |

**Notes:** Phase 21 can make targeted provider setting/output fixes when evidence supports them, but should not redesign the STT provider system.

---

## the agent's Discretion

- Exact corpus file format.
- Exact scorecard schema and score weights.
- Report layout and test harness structure.
- Badge implementation details consistent with Settings patterns.

## Deferred Ideas

None.
