# Phase 5: Polish, Contracts Codegen, §14 Verification — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Close out the walking skeleton with two deliverables:

1. **Contracts codegen pipeline (SC-02).** Replace the four hand-written TypeScript mirrors at `packages/contracts/ts/{ws-message,audio-payload,action-intent,speech-envelope}.ts` with files generated from the Pydantic source-of-truth via a hand-rolled `codegen.sh` chain (`Pydantic.model_json_schema()` → JSON Schema → `json-schema-to-typescript`). Renderer's `@contracts/*` import alias keeps working unchanged; nothing in renderer code edits.

2. **§14 verification record (SC-01).** Single `.planning/skeleton-verification.md` with three embedded sections — (A) the six §14 success criteria each PASS/PARTIAL/FAIL with tiered evidence; (B) the five ROADMAP-mandated "Looks Done But Isn't" e2e tests; (C) the body-sway investigation report (links 04-04's per-strategy evidence under `.planning/skeleton-verification-evidence/04/`). Verification runs hybrid — `scripts/verify-skeleton.sh` handles automatable checks, operator drives the four visible §14 SCs (idle micro-motion, [joy] blend, body/head sway, cursor tracking) with VTS+Teto running and records 5–10s clips to `.planning/skeleton-verification-evidence/05/`.

3. **Ship-readiness gate.** Phase 5 includes a real fresh-clone test: clone the repo into a brand-new folder, install (npm + uv + LFS hydrate), boot VTS+Teto, run `npm run dev`, walk through one full demo (text → reply → speak → joy blend → cursor track). Exact commands committed into a top-level README "Quickstart Demo" section. The skeleton is declared complete only if every §14 SC reaches PASS or PARTIAL — PARTIAL is acceptable **only** where the requirement explicitly allows degradation (AVT-06's head-only fallback). Any FAIL = milestone not complete; gap is documented and gets fix scope.

Out of this phase: any work beyond the two deliverables. Specifically out — memory milestone (Chroma, FTS5, profile loader, RRF), agent runtime, scheduler, skills system, multi-thread, multi-avatar, voice input, image input, pet mode, additional TTS backends, telemetry, auto-update. The walking skeleton ends here; the next milestone begins fresh.

</domain>

<decisions>
## Implementation Decisions

### Codegen pipeline (SC-02)

- **D-01: Tool = hand-rolled chain** (Pydantic `model_json_schema()` → JSON Schema files → `json-schema-to-typescript`). One Python wrapper script (~80 LOC) plus one npm dev-dep (`json-schema-to-typescript`). Pydantic stays source-of-truth per CLAUDE.md/PROJECT.md stack philosophy. No third-party Python tool in the path; full control over discriminated-union shape and Optional/None handling. Rejected alternatives: `pydantic2ts` (intermittently maintained, less control); `datamodel-code-generator` (wrong direction — JSON Schema → Pydantic, not reverse); hybrid hand-rolled-plus-pydantic2ts-A/B (overkill for ~5 contracts).
- **D-02: Invocation = manual run + commit-the-output discipline.** Engineer runs `./packages/contracts/codegen.sh` after Pydantic edits and commits the regenerated TS. CI runs codegen and `git diff --exit-code` to catch "you forgot to regen" — the diff fails the build. SC-02 verification = the script executes cleanly + the committed output matches what the script produces. Rejected alternatives: bare `npm run codegen` alias (no drift guard); pre-commit hook (adds husky/lefthook dep for marginal benefit; harder to bypass when intentional); CI-only-no-commit (renderer IDE imports break without local regen).
- **D-03: Layout = replace `packages/contracts/ts/{ws-message,audio-payload,action-intent,speech-envelope}.ts` in place.** Codegen overwrites the four existing hand-written files. Each gets a banner comment "GENERATED — do not edit; run codegen.sh". `@contracts/*` import alias unchanged in `apps/renderer/vite.config.ts:14` and `apps/renderer/tsconfig.json:32`; renderer code untouched. Rejected alternatives: ROADMAP-literal `packages/contracts/generated/ts/control.ts` subdir (forces alias rewrite + delete-old-files; one extra rename step for no gain); single bundled `packages/contracts/ts/index.ts` (every renderer import would change).
- **D-04: Type guards (`isAudioPayload`, `isControl`, `isFullText`, etc.) = codegen produces them.** The `json-schema-to-typescript` tool can't emit these directly, but the wrapper script appends `is<Variant>` predicates derived from Pydantic's discriminator field (`type`). Adds ~15 LOC to the codegen wrapper. Single source of truth; nothing hand-edited downstream of codegen. Rejected alternatives: separate hand-written `guards.ts` (preserves hand-tunability but adds an import + a maintenance surface); drop guards entirely (~10 helpers replaced with `m.type === 'audio'` at call sites; noisier and renderer code edits).

### §14 verification record (SC-01)

- **D-05: Doc structure = single `.planning/skeleton-verification.md` with three embedded sections.**
  - **§A** — Six §14 SC verifications. Each row: SC number, SC text, verdict (PASS/PARTIAL/FAIL), evidence type (script-output / clip / log-excerpt), evidence reference (path or quoted output), operator observation (one paragraph), follow-ups if any.
  - **§B** — PITFALLS "Looks Done But Isn't" e2e checklist (the five ROADMAP-mandated tests; see D-09).
  - **§C** — Body-sway investigation report. Inline summary + links to per-strategy evidence under `.planning/skeleton-verification-evidence/04/` (produced by 04-04). Records ship-default strategy from `teto_overrides.yaml.body_sway_strategy` and rationale.

  Rejected alternatives: split files (`skeleton-verification.md` + `body-sway-investigation.md` + `pitfalls-checklist.md`) — three files for a single milestone-end handoff doc is overkill; cross-referencing is the wrong design when one read-through is the target use case. Body-sway report stays in the skeleton-verification folder (NOT under 04-04) so the verification doc is self-contained.

- **D-06: Per-SC evidence depth = tiered.**
  - **Scripted SCs** (testable end-to-end without operator vision): output captured verbatim. Specifically: `[joy]` token-boundary fixture (pytest output), DeepSeek-R1 reasoning suppression (sample reply with no `<think>` leak), port-collision (boot-then-task-manager-kill-then-rerun log), OLVT `_route_message()` protocol diff (introspection-script output), codegen drift (`git diff --exit-code` output).
  - **Visible SCs** (require human eye): 5–10s screen recording per SC, committed under `.planning/skeleton-verification-evidence/05/{sc-N-name}.mp4` (Git LFS). Operator narrates one paragraph per clip in §A. The four visible SCs are §14 SC#1 (idle micro-motion), SC#2 ([joy] smooth blend), SC#4 (body/head sway), SC#5 (cursor tracking).

  Rejected alternatives: prose-only (cheapest, weakest audit trail); heavy-everywhere (clip + logs + screenshots per SC; ~2 dev-days extra for marginal benefit when the script outputs already cover the testable SCs).

- **D-07: Verdict states = PASS / PARTIAL / FAIL with explicit rationale.** Each SC gets one of three states. PARTIAL is **only acceptable for SCs where the requirement explicitly allows degradation** — currently that's just AVT-06 (head-only with rationale). Any other PARTIAL or any FAIL means the §14 SC is unmet without permission to degrade; gap goes into Phase 5 fix scope or a follow-up phase. Each PARTIAL/FAIL row carries: what fell short, why it didn't reach PASS, what would need to change to lift it to PASS, where the gap is tracked. Rejected alternatives: strict binary PASS/FAIL (forces editorial dishonesty when AVT-06 head-only ships — that's a PARTIAL by design, not a PASS-via-fallback); pass-with-caveat-list (every SC nominally passes; weakest signal of skeleton quality).

- **D-08: Verification runner = hybrid `scripts/verify-skeleton.sh` + operator-driven visible SCs.**
  - **Auto-runnable** (collected by `verify-skeleton.sh`): SC-02 codegen drift check (run `codegen.sh`, then `git diff --exit-code` on `packages/contracts/ts/`); split-bracket pytest fixture; DeepSeek-R1 reasoning smoke (one chat turn, assert no `<think>` in chat output); port-collision (spawn sidecar twice on port:0, assert both bind clean); OLVT protocol-shape introspection (Python script comparing OLVT's `WSMessage` discriminant variants against ours; expected-diff-only failures).
  - **Operator-driven**: §14 SC#1, #2, #4, #5 (the visible ones). Operator boots VTS+Teto, runs the demo, records the four clips. The script writes a "next: operator must record clips A/B/C/D" reminder when its automated subset finishes.
  - The script outputs a JSON-or-markdown summary that the operator pastes into §A of `skeleton-verification.md`. The operator then narrates the visible-SC observations and adds the clip-evidence rows.

  Rejected alternatives: operator-driven entirely (cheapest; risks forgotten-step bugs); fully automated including computer-vision lipsync diff (~5–10 dev-days; out of skeleton scope).

### PITFALLS "Looks Done But Isn't" e2e scope (§B of skeleton-verification.md)

- **D-09: PITFALLS e2e checklist = the five ROADMAP-mandated tests only.** Specifically:
  1. **Adversarial `[joy]` token-boundary** (Pitfall 5) — pytest fixture splits `[joy]` into deltas `[`/`jo`/`y]` and `[hold-mic]` into `[hold`/`-`/`mic]`; assert no bracket character ever leaks to chat or stub-TTS output.
  2. **DeepSeek-R1 reasoning smoke** (Pitfall 6) — operator picks a compliant DeepSeek-R1 distill or Qwen3-Reasoning model; one chat turn; assert no `<think>...</think>` content in chat or extracted ActionIntents.
  3. **VTS auth-reprompt** (Pitfall 10) — operator deletes the auth token file at the configured path, restarts sidecar; assert VTS popup appears and operator-grant flow re-establishes connection.
  4. **Port-collision** (PLUMB-03 / Pitfall 11) — boot Electron, force-quit via Task Manager, immediately relaunch; assert sidecar binds new ephemeral port cleanly without hang.
  5. **OLVT protocol-shape parity diff** (PLUMB-03) — Python introspection script reads OLVT's `_route_message()` (`OpenLLM_Vtuber/src/open_llm_vtuber/websocket_handler.py:239`) message-type set; compares against our `WSMessage` discriminated-union variants; flags expected-vs-unexpected divergences in the output.

  The other ~13 PITFALLS items (single-writer wrapper for pyvts #51, awaitWriteFinish for hot-reload, mode:add for parameter ownership, 1-second re-injection rule, 60Hz rate-cap, etc.) are already runtime-guarded in code from Phases 1–4 and do NOT get explicit e2e tests in Phase 5. Adding e2e for runtime-guarded items duplicates the guards without proving anything new — the absence of bugs in the visible §14 SC clips IS the evidence those guards work. Rejected alternatives: 5+3-extras (rate-limit, re-injection, parameter-ownership smokes; ~1 extra dev-day for marginal benefit when the visible SCs would already catch regressions); comprehensive 12-pitfall coverage (doubles Phase 5 scope; overkill for a single-engineer skeleton).

### Ship-readiness gate

- **D-10: Real fresh-clone validation as part of Phase 5.** Procedure: clone the repo to a brand-new folder (different from the dev working tree), install (`npm install` + `uv sync` + `git lfs pull`), boot VTS+Teto separately, run `npm run dev`, walk through the demo flow (type "tell me a 3-sentence story [joy]", watch all six §14 SCs in one session). Exact commands recorded in §A's evidence rows for the relevant SCs and committed verbatim into the README Quickstart section. Strongest "future-you on a different machine can come back and run this" guarantee. Catches setup-time bugs (LFS not hydrated, missing dep, hardcoded path, env-var assumptions) that wouldn't surface on the dev working tree.
- **D-11: Hard-block bar = strict-but-realistic.** Every §14 SC must reach PASS or PARTIAL. PARTIAL is acceptable **only** for AVT-06 (head-only with rationale per the requirement's explicit allowance). Any FAIL on any SC, or any PARTIAL on a non-AVT-06 SC, means Phase 5 isn't complete — gap goes into Phase 5 fix scope (additional plan) OR a follow-up phase / milestone with explicit deferral rationale captured in `.planning/STATE.md` Open Risks. The verification doc records the bar at the top of §A so the gate is unambiguous.
- **D-12: Demo runner artifact = top-level `README.md` "Quickstart Demo" section + `scripts/verify-skeleton.sh`.** README at repo root grows a Quickstart Demo section with the exact clone → install → boot → demo command sequence (verbatim from D-10's fresh-clone test). The verify-skeleton.sh script is the auto-runnable subset of verification (D-08). Both committed as Phase 5 deliverables. Discoverable for anyone landing in the repo for the first time. Rejected alternatives: demo-only-in-skeleton-verification.md (lower discoverability; README is where new contributors look); committed video-as-primary-artifact (LFS bandwidth growth; not a substitute for actually running).

### Phase 5 plan structure

- **D-13: Two plans (per ROADMAP).**
  - **05-01** — Contracts codegen pipeline (SC-02). Implements D-01 through D-04: hand-rolled `codegen.sh` script, npm `json-schema-to-typescript` dep, replace four `packages/contracts/ts/*.ts` files in place with codegen output (including the `is<X>` type guards), CI drift-check pattern documented.
  - **05-02** — §14 verification + skeleton-verification.md + body-sway report integration + README Quickstart + scripts/verify-skeleton.sh + fresh-clone validation. Implements D-05 through D-12. Operator-driven steps (visible-SC clips, fresh-clone test) are explicit checkpoints in the plan.

  Plans run **sequentially** — 05-01 must complete before 05-02 because 05-02's drift-check verification step depends on `codegen.sh` existing. No intra-phase parallelism possible at this granularity.

### Claude's Discretion

The planner/researcher resolves these with documented defaults:

- **Banner comment text on regenerated TS files (D-03):** wording like "// GENERATED FROM packages/contracts/py/contracts/{name}.py — do not edit; run packages/contracts/codegen.sh to regenerate". Exact wording planner picks.
- **JSON Schema intermediate file location:** `packages/contracts/generated/json-schema/*.json` (committed) vs `packages/contracts/.cache/json-schema/*.json` (gitignored). Planner picks; default committed (auditable; allows TS regeneration without re-running Python codegen).
- **Optional/None handling in TS:** discriminated-union `audio: string | null` vs optional field `audio?: string`. Pydantic's `Optional[str]` with `default=None` should map consistently to one TS shape. Planner picks; recommend `string | null` to match Pydantic exactly.
- **codegen.sh runtime location:** repo root (`./packages/contracts/codegen.sh`) vs invokable from anywhere (`packages/contracts/scripts/codegen.sh`). Planner picks; recommend repo-root invocation for easy CI scripting.
- **CI drift-check implementation:** GitHub Actions workflow vs Husky pre-push hook vs documented manual step. Skeleton has no CI yet; if Phase 5 introduces one, it's a small `.github/workflows/contracts-drift.yml` running `codegen.sh && git diff --exit-code`. Planner picks; recommend documented-manual-step (no CI) for skeleton scope, with CI workflow as a stretch goal.
- **Verify-skeleton.sh language:** bash (POSIX) vs Python (cross-platform). Planner picks; recommend bash for the orchestration shell, calling Python sub-scripts where needed (the introspection diff IS Python).
- **Visible-SC clip durations:** 5s vs 10s vs longer. Planner picks; recommend 5–10s as documented in D-06.
- **Demo prompt text:** "tell me a 3-sentence story [joy]" vs other. Planner picks a prompt that exercises §14 SC#1 (idle pre-typing), SC#2 (joy blend), SC#3 (text echo), SC#4 (body/head sway during TTS), SC#5 (cursor tracking) in one continuous demo if possible.
- **Pydantic-to-JSON-Schema discriminator handling:** Pydantic v2 emits `oneOf` with `mapping` for discriminated unions; `json-schema-to-typescript` should emit a tagged union. Planner verifies the round-trip matches the current hand-written shape exactly (especially `WSMessage`'s 9-variant union).
- **README Quickstart prerequisites list:** what version pins to mention (Node 22.x, Python 3.12, npm not pnpm, VTS 1.32.71, Teto rig in Live2D/重音テト/, LM Studio with a model loaded, etc.). Planner picks; pull verbatim from CLAUDE.md's locked stack table and PROJECT_DESIGN.md §13.
- **Body-sway investigation report integration in §C:** inline-summary depth (one paragraph vs one section per strategy) vs link-only-to-04-04-evidence. Planner picks; recommend one-section-per-strategy with the per-strategy clip + RMS-vs-output plot + qualitative rating cited inline (matches Phase 4 D-04's per-strategy evidence pattern). The ship-default strategy from `teto_overrides.yaml.body_sway_strategy` and its rationale are explicitly highlighted at the top of §C.
- **Fresh-clone test environment:** different folder on dev machine vs different machine vs Windows VM. Planner picks; recommend "different folder on dev machine" as the floor (catches LFS-hydrate and dep-install issues); "different machine" as a stretch (catches platform-pinned bugs).

### Folded Todos

None — `gsd-tools todo match-phase 5` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level specs (decision authority)

- `PROJECT_DESIGN.md` §14 — Walking-skeleton success criteria (the six §14 SCs Phase 5 verifies).
- `PROJECT_DESIGN.md` §6 — Data contracts source-of-truth (Pydantic in Python; TS is generated, not authored). Phase 5 makes this concrete via codegen.
- `PROJECT_DESIGN.md` §13 — Stack philosophy (Pydantic source-of-truth; TS-end-to-end shell; "minimize self-built work" — hand-rolled codegen ~80 LOC is acceptable, third-party tools are fine when ergonomic).
- `.planning/PROJECT.md` — Active requirements list, Risks (R-OPEN-1 body sway, R-OPEN-2 mobile renderer), Key Decisions table. Phase 5's verification doc records the disposition of R-OPEN-1 (pass/partial/fail) at milestone close.
- `.planning/REQUIREMENTS.md` — SC-01, SC-02 (Phase 5's full requirement set). Plus all 23 prior reqs whose validation Phase 5 records.
- `.planning/ROADMAP.md` Phase 5 (lines 108–126) — phase goal, success criteria, plans (05-01 codegen, 05-02 verification), open question (codegen tool — resolved here as hand-rolled per D-01).

### Phase 1 + 2 + 3 + 4 carry-forward

- `.planning/phases/01-plumbing-process-lifecycle/01-CONTEXT.md`:
  - **D-08 + Claude's Discretion (WS envelope shape) + D-Claude's Discretion (Monorepo layout)** — `packages/contracts/{py,ts}/` hand-written-now, codegen-replaces-in-Phase-5 stance. Phase 5 closes this commitment.
  - **D-22 (Path-1 chrome shell + placeholders)** — README Quickstart should reflect the actual UI surfaces a fresh user sees after `npm run dev` (chat shell + Settings sections + Logs drawer toggle).
- `.planning/phases/02-conversation-pipeline/02-CONTEXT.md`:
  - **D-12 (ActionIntent shape)** — codegen target.
  - **D-02 + Amendment (audio-payload OLVT-canonical envelope)** — codegen target.
  - **D-10 (reasoning suppression strategy: API-level disable, no parser-strip)** — Phase 5 SC-01 #3 verifies this with a compliant reasoning model. PITFALLS Pitfall 6 e2e test corresponds.
- `.planning/phases/03-tts-sentence-buffered-audio/03-CONTEXT.md`:
  - **D-05 (SpeechEnvelopePayload schema)** — codegen target.
  - **D-04 (linear interp at 60Hz)** + **D-14 (chain-end after audio-complete)** — Phase 5 SC-01 #1 (synced lipsync) verifies this works end-to-end.
- `.planning/phases/04-action-compositor-vts-bridge-body-sway-investigation/04-CONTEXT.md`:
  - **D-01 + D-04 (body-sway strategy slate + per-strategy investigation evidence)** — Phase 5 §C of skeleton-verification.md inherits this evidence.
  - **D-08 ([joy] 300ms ease-out cubic)** — Phase 5 SC-01 #2 verifies the headline demo.
  - **D-09 + D-10 (sidecar Win32 cursor tracker)** — Phase 5 SC-01 #5 verifies cursor tracking visible.
  - **D-11 (DiscreteEvent demo target)** — Phase 5 SC-01 includes hotkey demo if §14 SC#5/#6 wording requires it (otherwise verified as part of compositor live-walk).
  - **D-12 (DEV-gated dev-panel hot-switch)** — Phase 5 README Quickstart notes the dev panel for body-sway A/B but it's not the demo flow.

### Existing code (Phase 5 edits / generates)

- `packages/contracts/py/contracts/{ws_message,audio_payload,action_intent,speech_envelope}.py` — Pydantic source-of-truth. Phase 5 reads these as input to codegen.
- `packages/contracts/ts/{ws-message,audio-payload,action-intent,speech-envelope}.ts` — currently hand-written; Phase 5 OVERWRITES with codegen output (D-03).
- `packages/contracts/py/pyproject.toml` — Pydantic dep. Phase 5 may extend with `[project.scripts]` for codegen entry-point if planner picks.
- `apps/renderer/vite.config.ts:14` — `@contracts` import alias. Phase 5 does NOT change.
- `apps/renderer/tsconfig.json:32` — `@contracts/*` alias. Phase 5 does NOT change.
- `apps/renderer/src/ws/{client,store}.ts`, `apps/renderer/src/screens/Chat/Chat.tsx` — renderer code that imports from `@contracts/*`. Phase 5 does NOT edit.

### OLVT source (PITFALLS e2e references only)

The OLVT sibling project at `C:/Users/16079/Code/OpenLLM_Vtuber/` is the reference for the OLVT protocol-shape parity diff (D-09 test 5). Specifically:

- `OpenLLM_Vtuber/src/open_llm_vtuber/websocket_handler.py:239` (`_route_message`) — message-type set to compare against. The diff script enumerates OLVT's variants and compares against our `WSMessage` discriminator union.

### Research outputs

- `.planning/research/PITFALLS.md` — 18+ items. Phase 5 e2e covers the five ROADMAP-mandated (D-09); the rest are runtime-guarded by Phases 1–4 and not re-tested. PITFALLS Pitfall 5 (token-boundary), Pitfall 6 (`<think>` blocks), Pitfall 10 (VTS auth) are the three named in D-09.
- `.planning/research/STACK.md` — pinned versions. README Quickstart pulls from this verbatim.
- `.planning/research/ARCHITECTURE.md` — 5-phase build order; Phase 5 is the wrap-up. Skeleton-verification.md confirms each phase's deliverable lands as designed.
- `.planning/research/SUMMARY.md` — synthesis of stack/features/architecture/pitfalls; planner may consult for README Quickstart prereqs.
- `.planning/research/FEATURES.md` — feature inventory; Phase 5 verifies the skeleton subset shipped.

### Convention / config

- `CLAUDE.md` (project root) — locked stack table; reaffirms hand-rolled codegen for skeleton (per the "What NOT to Use" note: `datamodel-code-generator` only generates Pydantic from JSON Schema, wrong direction; recommendation: hand-write the TS contracts, document the source-of-truth-is-Python rule, defer codegen until contracts churn). Phase 5 lifts the deferral.
- `.planning/STATE.md` — current phase position, blockers/concerns, open risks. Phase 5 records milestone close in this file.

### External (no in-repo path — paste URL in plans)

- json-schema-to-typescript npm: https://www.npmjs.com/package/json-schema-to-typescript
- Pydantic v2 `model_json_schema()`: https://docs.pydantic.dev/latest/concepts/json_schema/
- Pydantic v2 discriminated unions in JSON Schema: https://docs.pydantic.dev/latest/concepts/unions/#discriminated-unions
- Git LFS docs (for fresh-clone hydrate verification): https://git-lfs.github.com/

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`packages/contracts/py/contracts/`** (Phases 1–3) — five Pydantic modules (`ws_message.py` 9-variant union; `audio_payload.py`; `action_intent.py`; `speech_envelope.py`; `__init__.py`). Phase 5 reads as codegen input.
- **`packages/contracts/ts/`** (Phases 1–3) — four hand-written mirror files. Phase 5 OVERWRITES with codegen output (D-03).
- **`apps/renderer/{vite.config.ts,tsconfig.json}`** — `@contracts/*` alias already wired (vite.config.ts:14, tsconfig.json:32). Phase 5 does NOT change; codegen lands at the alias-resolved path.
- **`packages/contracts/py/pyproject.toml`** — Pydantic dep. Phase 5 may add `[project.scripts]` for `codegen` if planner picks; otherwise codegen.sh invokes Python directly.
- **`scripts/`** (TBD) — no top-level scripts dir exists yet. Phase 5 creates `scripts/verify-skeleton.sh` (D-08) here.
- **`README.md`** (project root) — already exists from Phase 1; Phase 5 grows a Quickstart Demo section (D-12).
- **`Live2D/重音テト/`** — Teto rig source. Phase 5 fresh-clone test relies on this being LFS-hydrated.
- **`sidecar/models/piper/en_US-amy-medium.onnx`** — voice model in Git LFS (Phase 3 D-10). Phase 5 fresh-clone test verifies LFS hydrate works.
- **`avatars/teto/{avatar.yaml,teto_overrides.yaml}`** (Phases 2 + 4) — capabilities + overrides. Phase 5 §C of verification doc references the populated `teto_overrides.yaml` per SC-01 #5.

### Established Patterns

- **Pydantic-first contract authoring** (Phases 1–3). Phase 5 turns the implicit pattern into mechanical enforcement via codegen + drift check.
- **`@contracts/*` import alias** (Phase 1). Phase 5 keeps unchanged; codegen output lands at alias-resolved path.
- **Banner-comment "GENERATED — do not edit"** (Phase 4 D-12 dev-panel files use a similar import.meta.env.DEV gate pattern; Phase 5 codegen banner is the canonical example for the project).
- **Vendor + PROVENANCE.md pattern** (Phase 1 D-04). Phase 5's codegen tool (`json-schema-to-typescript`) is an npm dep, not vendored — established pattern doesn't apply. The Python wrapper script is greenfield and lives in `packages/contracts/`.
- **Pub-sub via `asyncio.Queue`** (Phase 2 D-11, Phase 3 D-05) — irrelevant to Phase 5 (no runtime additions).

### Integration Points

- **Codegen → renderer:** mechanical; codegen overwrites `packages/contracts/ts/*.ts`; renderer's `@contracts/*` imports keep resolving. No renderer code edit required.
- **codegen.sh → CI drift check:** the script exits 0 on success; CI runs `./codegen.sh && git diff --exit-code packages/contracts/ts/`; non-zero diff fails the build with a "regenerated TS does not match committed TS — run codegen and commit" message.
- **verify-skeleton.sh → skeleton-verification.md §A and §B:** the script outputs a markdown-or-JSON summary that the operator pastes into the doc's automated rows. Operator manually adds visible-SC rows + clip references.
- **Body-sway evidence (04-04) → §C of skeleton-verification.md:** Phase 5 reads the per-strategy evidence under `.planning/skeleton-verification-evidence/04/`, summarizes each strategy in §C, links the artifacts, and highlights the ship-default per `teto_overrides.yaml.body_sway_strategy`.
- **Fresh-clone test → README Quickstart:** the exact commands that worked during the fresh-clone test (D-10) get copied verbatim into the README Quickstart section. Authoritative single source of truth for "how do I run this".

### Greenfield additions (Phase 5 creates)

- **`packages/contracts/codegen.sh`** — bash entry-point invoking the Python wrapper.
- **`packages/contracts/scripts/codegen.py`** (or similar) — the ~80 LOC wrapper that walks Pydantic models → JSON Schema files → invokes `json-schema-to-typescript` → emits TS with banner + type guards.
- **`packages/contracts/generated/json-schema/*.json`** (or `.cache/`; planner picks per Claude's Discretion) — JSON Schema intermediate files.
- **`packages/contracts/ts/{ws-message,audio-payload,action-intent,speech-envelope}.ts`** — REGENERATED from codegen, replacing the hand-written versions. Each has a banner comment.
- **`scripts/verify-skeleton.sh`** — top-level orchestration shell calling the auto-runnable verification subset.
- **Verification helper scripts under `scripts/verify/`** — small Python and pytest pieces for: split-bracket fixture, DeepSeek-R1 reasoning smoke, OLVT protocol-shape diff, port-collision smoke. Planner picks granularity.
- **`.planning/skeleton-verification.md`** — the milestone-end handoff doc.
- **`.planning/skeleton-verification-evidence/`** — folder structure:
  - `04/` — Phase 4-produced body-sway investigation evidence (per-strategy clip.mp4 + RMS-vs-output.png + rating.md). Already exists at end of Phase 4.
  - `05/` — Phase 5 visible-SC clips (5–10s each: idle micro-motion, [joy] blend, body/head sway, cursor tracking).
- **`README.md`** — extends with "Quickstart Demo" section.
- **Phase 5 deps:** `json-schema-to-typescript` (npm dev-dep, top-level package.json or `packages/contracts/ts/package.json` if planner picks). No new Python deps (Pydantic's `model_json_schema()` is built-in).
- **Optional: `.github/workflows/contracts-drift.yml`** — CI drift check (planner discretion per D-Claude's Discretion).

</code_context>

<specifics>
## Specific Ideas

- **Codegen is mechanical, not creative.** The four hand-written `packages/contracts/ts/*.ts` files were authored carefully (matching Pydantic shape; including type guards). Phase 5's codegen output must match them in shape — same field names, same Optional/None handling, same `is<Variant>` predicates. The drift-check (D-02) catches accidental shape regressions; the planner should verify the round-trip matches the *current* hand-written output BEFORE committing the regenerated files. If round-trip differs in a way that would break renderer code, that's a planner-resolution moment, not a silent merge.
- **Verification doc is a milestone-close handoff, not a perpetual artifact.** Phase 5's `.planning/skeleton-verification.md` records "this is the state of the skeleton at end-of-walking-skeleton-milestone". After memory milestone begins, this doc is read-only history — new verification docs are produced at each milestone close. The doc explicitly notes its frozen-at-milestone-close status to avoid future churn.
- **Body-sway investigation report (§C) cites Phase 4's evidence verbatim.** Phase 5 does NOT re-run the body-sway investigation. Phase 4 produced per-strategy evidence per 04-04; Phase 5's §C reads, summarizes, and links. The ship-default strategy (whatever 04-04 closed on) becomes the §C headline.
- **Fresh-clone test catches Git LFS hydrate.** This is critical — the Teto rig (`Live2D/重音テト/`) and voice model (`sidecar/models/piper/en_US-amy-medium.onnx`) are LFS-tracked from Phase 3. A fresh `git clone` without `git lfs pull` (or without LFS installed) leaves these as text-pointer stubs; the app boots but Teto doesn't render and TTS fails. The fresh-clone test ensures this is captured in the README Quickstart prerequisites.
- **The bar is honest, not strict.** D-11 allows AVT-06 PARTIAL (head-only) because the requirement explicitly permits it. Don't read D-11 as "everything must PASS or we don't ship" — read it as "every SC needs an honest verdict, and PARTIAL is reserved for cases where the requirement allows degradation". This matches PROJECT.md R-OPEN-1's "skeleton needs to either solve it on VTS or document fallback to head-only".

</specifics>

<deferred>
## Deferred Ideas

- **CI/CD pipeline (GitHub Actions, etc.).** Phase 5 stops at "documented manual drift check" or a single `.github/workflows/contracts-drift.yml` (planner discretion). Full CI/CD with build matrix, e2e tests in Linux, automated release builds — out of skeleton scope; lands when public release is on the roadmap.
- **Automated computer-vision verification of visible §14 SCs** (lipsync, joy blend, body sway). ~5–10 dev-days; out of scope. Operator-driven clip recording is the floor.
- **Cross-platform fresh-clone test** (macOS, Linux). Skeleton is Windows-pinned per CLAUDE.md / PROJECT_DESIGN.md §13.1; cross-platform validation is a future-milestone decision when the user opens up beyond their own dev box.
- **Public release-engineering** (electron-builder signing, code-signing certs, auto-update notify-only wiring). All deferred to post-skeleton public-release milestone (if ever — R-2 single-user stance).
- **Telemetry / analytics in the verification flow.** Operator-narrated observations are the audit trail; no auto-collection.
- **`pydantic2ts` A/B comparison in CI.** Rejected at D-01; could revisit if hand-rolled chain has shape bugs that pydantic2ts would catch. Defer to a follow-up only if drift-check reveals real shape issues.
- **TypeScript-as-source-of-truth for some contracts** (e.g., renderer-only types like UI state). Skeleton has no such contracts yet; if the dev panel or settings UI grows complex shapes, planner can keep TS-authored files alongside codegen-replaced ones, with a clear comment about which side owns each shape.
- **Schema versioning for the WS envelope.** No version field today; if multi-version compat ever becomes a concern (e.g., user pins old sidecar with new renderer), versioning lands then. Single-user single-tree-of-source means we just keep both sides in sync; codegen makes this mechanical.
- **Code-quality bar enforcement** (Ruff, ESLint, Prettier in CI). Already partially configured per CLAUDE.md dev-tools list; CI enforcement is post-skeleton.
- **Live debug-overlay HUD** (param values, RMS, strategy active) was deferred in Phase 4; same here. Out of scope.

### Reviewed Todos (not folded)

None — `gsd-tools todo match-phase 5` returned 0 matches.

</deferred>

---

*Phase: 05-polish-contracts-codegen-14-verification*
*Context gathered: 2026-05-07*
