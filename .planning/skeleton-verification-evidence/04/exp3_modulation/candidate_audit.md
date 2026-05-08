# exp3_modulation Candidate Audit (RESEARCH Open-Q2)

Date: 2026-05-08
Auditor: Codex executor

## Method

I parsed every `.exp3.json` file under `Live2D/重音テト/Expressions/` and inspected each `Parameters[]` entry.

Body-region matches were limited to IDs beginning with:

- `ParamBodyAngle`
- `ParamBHand`
- `ParamFacePosition`
- `ParamLean`
- `ParamBreath`

IDs beginning with `ParamAngle` were treated as head parameters and excluded from body-pose candidacy.

The plan expected 14 expression files, but the checked-in Teto directory currently contains 15. This audit follows the actual rig inventory.

## Per-File Audit

| File | Parameters[] Body-Region IDs | Viable Candidate? |
|------|------------------------------|-------------------|
| Blush.exp3.json | none | no - face/blush expression only |
| Cry.exp3.json | none | no - eye/tear expression only |
| Dark Eye.exp3.json | none | no - eye expression only |
| Dark Face.exp3.json | none | no - face expression only |
| Dizzy.exp3.json | none | no - eye expression only |
| Exp eye.exp3.json | none | no - eye expression only |
| Love.exp3.json | none | no - eye/face expression only |
| Remove Water Mark.exp3.json | none | no - watermark toggle only |
| SV Utau ALT.exp3.json | none | no - mode/hand toggle IDs do not match accepted body-region patterns |
| Star Eye.exp3.json | none | no - eye/face expression only |
| Sweat.exp3.json | none | no - tear/sweat expression only |
| chibi.exp3.json | none | no - chibi toggle only |
| 【SV】Baguette.exp3.json | ParamBHandIN | no - hand/prop state for baguette, not a body-sway pose |
| 【SV】Mic.exp3.json | ParamBHandIN | no - hand/prop state for microphone, not a body-sway pose |
| 【Utau】Mic.exp3.json | none | no - microphone toggle only |

## Verdict

No viable `exp3_modulation` candidate exists in the checked-in Teto expression set.

The only matched body-region ID is `ParamBHandIN`, appearing in `【SV】Baguette.exp3.json` and `【SV】Mic.exp3.json`. Those files appear to toggle hand/prop presentation rather than a neutral body lean, torso angle, breath, or face-position proxy that could be modulated continuously by speech RMS.

No existing expression provides `ParamBodyAngle*`, `ParamFacePosition*`, `ParamLean*`, or `ParamBreath` values suitable for body-sway modulation.

Authoring a new body-pose `.exp3.json` in Cubism Editor would unblock this strategy, but that is outside the skeleton timebox. The walking skeleton should therefore keep `exp3_body_pose: null` and ship `head_only` unless the Phase 5 live `proxy_param` run proves `Lean Forward` visibly moves with speech.

## RESEARCH Open-Q2 Closure

Open-Q2 asked whether Teto has any `.exp3.json` suitable for body-sway modulation. The answer is no for the current 15-file expression inventory.
