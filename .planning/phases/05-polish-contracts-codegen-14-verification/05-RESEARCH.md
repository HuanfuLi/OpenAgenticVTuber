# Phase 5: Polish, Contracts Codegen, §14 Verification — Research

**Researched:** 2026-05-07
**Domain:** Pydantic v2 → JSON Schema → TypeScript codegen + walking-skeleton verification protocol
**Confidence:** HIGH on codegen mechanics (verified by running the exact tools against our exact contracts); HIGH on verification structure (CONTEXT.md locked everything); MEDIUM on visible-SC clip tooling recommendations (Windows-pinned skeleton, multiple viable choices).

## Summary

Phase 5 has two locked deliverables: (1) replace six hand-written `packages/contracts/ts/*.ts` files with codegen output from a hand-rolled Python wrapper that emits Pydantic JSON Schema → invokes `json-schema-to-typescript` (jsts) → post-processes the output for shape parity; and (2) produce `.planning/skeleton-verification.md` with three sections — six §14 SCs each PASS/PARTIAL/FAIL, five PITFALLS e2e tests, body-sway investigation report — plus a top-level README "Quickstart Demo" section and a `scripts/verify-skeleton.sh` orchestrator.

I empirically verified the codegen pipeline by running our actual `packages/contracts/py/contracts/ws_message.py` through `pydantic.TypeAdapter(WSMessage).json_schema()` then through `json-schema-to-typescript@15.0.4`. **Two material problems must be solved by the wrapper** — both with simple schema-mutation fixes that are documented in this research:

1. Pydantic emits the discriminator `type` field as NOT-required (because `Literal["audio"] = "audio"` is a default). jsts then emits `type?: Type3` (optional) — which **breaks the discriminated-union** contract the renderer relies on. **Fix:** the wrapper must add every `const`-valued property (and every Pydantic-Optional-with-default field) to its enclosing schema's `required` list before invoking jsts.
2. jsts hoists every literal/primitive into a top-level alias (`Type1 = "display-text"; Text = string; Volumes = number[]; ...`) — ugly, breaks readability, doesn't match current hand-written shape. **Fix:** post-process the jsts output to inline single-literal aliases and strip primitive-only aliases. ~30 LOC of text manipulation.

The hand-written TS that codegen replaces is in **six** files (not the four CONTEXT.md mentions in the canonical-list narrative — discovered: `param-frame.ts` and `discrete-event.ts` also exist and were authored in Phase 4). All six get regenerated. There is no top-level package.json `json-schema-to-typescript` dependency yet; the planner must decide where it lands (top-level workspaces root vs. a new `packages/contracts/ts/package.json`).

**Primary recommendation:** Single Python wrapper script (`packages/contracts/scripts/codegen.py`, ~150 LOC including post-processing) invoked by `packages/contracts/codegen.sh` (bash) which the operator runs manually. CI (or a documented manual `npm run check:contracts`) runs the wrapper + `git diff --exit-code packages/contracts/ts/` to catch drift. README's "Quickstart Demo" pulls verbatim from the actual fresh-clone test commands; `scripts/verify-skeleton.sh` is a thin bash orchestrator that calls per-test Python sub-scripts and prints a paste-ready markdown summary for §A of `skeleton-verification.md`.

## Project Constraints (from CLAUDE.md)

These are not negotiable at planning time. Treat as locked decisions of the same authority as CONTEXT.md.

- **Hand-rolled codegen is the documented preference.** CLAUDE.md "Development Tools" row for `datamodel-code-generator` notes: "TS generation is limited; **Recommendation for skeleton: hand-write the TS contracts, document the source-of-truth-is-Python rule, defer codegen until contracts churn**." Phase 5 lifts the deferral; CONTEXT.md D-01 picks hand-rolled over `pydantic2ts` over `datamodel-code-generator`.
- **npm, NOT pnpm.** CLAUDE.md "What NOT to Use": `pnpm with Electron (without .npmrc node-linker=hoisted)` — pnpm's symlinked `node_modules` breaks electron-builder asar packaging. Phase 5's new `json-schema-to-typescript` dev-dep uses npm.
- **uv, NOT pip, for the sidecar.** CLAUDE.md "Development Tools" — uv is the 2026 consensus and our project is already on uv (`sidecar/uv.lock` exists). README Quickstart prereqs say `uv sync`, NOT `pip install -r requirements.txt`.
- **Node 22 LTS, Python 3.12, Pydantic ≥2.5.** Pinned versions in `package.json` engines and `pyproject.toml` `requires-python`. README Quickstart prereqs must list these.
- **Windows-pinned skeleton.** CLAUDE.md §13.1 / PROJECT_DESIGN.md §13.1. Cross-platform fresh-clone test is OUT of scope; D-Claude-discretion in CONTEXT.md says "different folder on dev machine" is the floor. README Quickstart can assume Windows-only commands (PowerShell / Git Bash).
- **VTube Studio 1.32.71 + pyvts 0.3.3 + Cubism 4.x or 5.0–5.2 rigs only.** Cubism 5.3 NOT supported. Teto rig is within Cubism 4. README Quickstart prereqs mention VTS version and that Cubism 5.3 rigs are unsupported (the import milestone will surface this; skeleton just notes it).
- **Git LFS for Teto rig + voice .onnx.** `.gitattributes` declares `sidecar/models/piper/*.onnx filter=lfs`. The Teto rig at `Live2D/重音テト/` is also large — fresh-clone test is the gate that catches missing-LFS-hydrate (texture .png and `.moc3` would be ASCII pointer stubs, not binary).
- **No emojis in committed code/docs unless user explicitly requests.** RESEARCH.md, PLAN.md, codegen banner comments, README Quickstart should not introduce emojis (consistent with `feat:` style of prior commits). The existing README has zero emojis — match.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Codegen pipeline (SC-02)

- **D-01: Tool = hand-rolled chain** (Pydantic `model_json_schema()` → JSON Schema files → `json-schema-to-typescript`). One Python wrapper script (~80 LOC) plus one npm dev-dep (`json-schema-to-typescript`). Pydantic stays source-of-truth per CLAUDE.md/PROJECT.md stack philosophy. No third-party Python tool in the path; full control over discriminated-union shape and Optional/None handling. Rejected alternatives: `pydantic2ts` (intermittently maintained, less control); `datamodel-code-generator` (wrong direction — JSON Schema → Pydantic, not reverse); hybrid hand-rolled-plus-pydantic2ts-A/B (overkill for ~5 contracts).
- **D-02: Invocation = manual run + commit-the-output discipline.** Engineer runs `./packages/contracts/codegen.sh` after Pydantic edits and commits the regenerated TS. CI runs codegen and `git diff --exit-code` to catch "you forgot to regen" — the diff fails the build. SC-02 verification = the script executes cleanly + the committed output matches what the script produces. Rejected alternatives: bare `npm run codegen` alias (no drift guard); pre-commit hook (adds husky/lefthook dep for marginal benefit; harder to bypass when intentional); CI-only-no-commit (renderer IDE imports break without local regen).
- **D-03: Layout = replace `packages/contracts/ts/{ws-message,audio-payload,action-intent,speech-envelope}.ts` in place.** Codegen overwrites the four existing hand-written files. Each gets a banner comment "GENERATED — do not edit; run codegen.sh". `@contracts/*` import alias unchanged in `apps/renderer/vite.config.ts:14` and `apps/renderer/tsconfig.json:32`; renderer code untouched. Rejected alternatives: ROADMAP-literal `packages/contracts/generated/ts/control.ts` subdir (forces alias rewrite + delete-old-files; one extra rename step for no gain); single bundled `packages/contracts/ts/index.ts` (every renderer import would change).
  - **Research note:** D-03 lists four files, but the actual `packages/contracts/ts/` directory has SIX files: `ws-message.ts`, `audio-payload.ts`, `action-intent.ts`, `speech-envelope.ts`, `param-frame.ts`, `discrete-event.ts`. The latter two were authored in Phase 4 (post-CONTEXT.md draft of D-03 wording). All six are in scope for codegen replacement; the planner should treat D-03's "four-file" enumeration as a list-of-examples, not a list-of-everything. See "User Constraints — Resolved Ambiguities" below.
- **D-04: Type guards (`isAudioPayload`, `isControl`, `isFullText`, etc.) = codegen produces them.** The `json-schema-to-typescript` tool can't emit these directly, but the wrapper script appends `is<Variant>` predicates derived from Pydantic's discriminator field (`type`). Adds ~15 LOC to the codegen wrapper. Single source of truth; nothing hand-edited downstream of codegen. Rejected alternatives: separate hand-written `guards.ts` (preserves hand-tunability but adds an import + a maintenance surface); drop guards entirely (~10 helpers replaced with `m.type === 'audio'` at call sites; noisier and renderer code edits).

#### §14 verification record (SC-01)

- **D-05: Doc structure = single `.planning/skeleton-verification.md` with three embedded sections.**
  - **§A** — Six §14 SC verifications. Each row: SC number, SC text, verdict (PASS/PARTIAL/FAIL), evidence type (script-output / clip / log-excerpt), evidence reference (path or quoted output), operator observation (one paragraph), follow-ups if any.
  - **§B** — PITFALLS "Looks Done But Isn't" e2e checklist (the five ROADMAP-mandated tests; see D-09).
  - **§C** — Body-sway investigation report. Inline summary + links to per-strategy evidence under `.planning/skeleton-verification-evidence/04/` (produced by 04-04). Records ship-default strategy from `teto_overrides.yaml.body_sway_strategy` and rationale.
- **D-06: Per-SC evidence depth = tiered.** Scripted SCs: output captured verbatim. Visible SCs: 5–10s screen recording per SC, committed under `.planning/skeleton-verification-evidence/05/{sc-N-name}.mp4` (Git LFS). Operator narrates one paragraph per clip in §A. The four visible SCs are §14 SC#1 (idle micro-motion), SC#2 ([joy] smooth blend), SC#4 (body/head sway), SC#5 (cursor tracking).
- **D-07: Verdict states = PASS / PARTIAL / FAIL with explicit rationale.** PARTIAL is only acceptable for SCs where the requirement explicitly allows degradation — currently AVT-06 (head-only with rationale).
- **D-08: Verification runner = hybrid `scripts/verify-skeleton.sh` + operator-driven visible SCs.** Auto-runnable: SC-02 codegen drift check, split-bracket pytest fixture, DeepSeek-R1 reasoning smoke, port-collision, OLVT protocol-shape introspection. Operator-driven: §14 SC#1, #2, #4, #5.

#### PITFALLS e2e (D-09)

The five ROADMAP-mandated tests only:
1. **Adversarial `[joy]` token-boundary** (Pitfall 5) — pytest fixture.
2. **DeepSeek-R1 reasoning smoke** (Pitfall 6) — operator-driven.
3. **VTS auth-reprompt** (Pitfall 10) — operator-driven.
4. **Port-collision** (PLUMB-03 / Pitfall 11) — auto-runnable.
5. **OLVT protocol-shape parity diff** (PLUMB-03) — Python introspection script.

#### Ship-readiness gate (D-10 to D-12)

- **D-10:** Real fresh-clone test: clone repo → `npm install` + `uv sync` + `git lfs pull` → boot VTS+Teto → `npm run dev` → walk through demo. Catches LFS hydrate gaps.
- **D-11:** Strict-but-realistic. Every §14 SC must reach PASS or PARTIAL. PARTIAL acceptable ONLY for AVT-06 (head-only with rationale).
- **D-12:** README "Quickstart Demo" + `scripts/verify-skeleton.sh` are the demo-runner artifacts.

#### Phase structure (D-13)

Two plans, sequential:
- **05-01** — Codegen pipeline + TS-mirror replacement (SC-02). Implements D-01 through D-04.
- **05-02** — §14 verification + skeleton-verification.md + body-sway integration + README Quickstart + verify-skeleton.sh + fresh-clone validation. Implements D-05 through D-12.

### Claude's Discretion

The planner resolves these with documented defaults:

- **Banner comment text on regenerated TS files:** wording like `// GENERATED FROM packages/contracts/py/contracts/{name}.py — do not edit; run packages/contracts/codegen.sh to regenerate`. Exact wording planner picks.
- **JSON Schema intermediate file location:** `packages/contracts/generated/json-schema/*.json` (committed) vs `packages/contracts/.cache/json-schema/*.json` (gitignored). Planner picks; default committed.
- **Optional/None handling in TS:** `string | null` vs optional `?:`. Planner picks; CONTEXT.md recommends `string | null` to match Pydantic exactly. **(Research-validated as the correct choice — see Standard Stack and Code Examples below.)**
- **codegen.sh runtime location:** repo root (`./packages/contracts/codegen.sh`) vs nested. Planner picks; recommend repo-root invocation for easy CI scripting.
- **CI drift-check implementation:** GitHub Actions vs Husky vs documented manual step. Skeleton has no CI yet; if introduced, small `.github/workflows/contracts-drift.yml`. Planner picks; recommend documented manual step for skeleton scope.
- **verify-skeleton.sh language:** bash (POSIX, runs in Git Bash on Windows) vs Python. Planner picks; recommend bash orchestrator that calls Python sub-scripts (the diff IS Python).
- **Visible-SC clip durations:** 5s vs 10s. Planner picks; recommend 5–10s as documented.
- **Demo prompt text:** "tell me a 3-sentence story [joy]" vs other. Planner picks a prompt that exercises §14 SC#1 (idle pre-typing), SC#2 (joy blend), SC#3 (text echo), SC#4 (body/head sway during TTS), SC#5 (cursor tracking) in one continuous demo.
- **Pydantic-to-JSON-Schema discriminator handling:** Pydantic v2 emits `oneOf` with `mapping`; jsts emits a flat union (NOT a tagged union). **Research-validated:** flat union is functionally equivalent because each variant retains its `type` literal field — the renderer's existing `is<Variant>` guards work on flat unions. See Code Examples below.
- **README Quickstart prerequisites list:** what version pins to mention. Planner pulls verbatim from CLAUDE.md / PROJECT_DESIGN.md §13.
- **Body-sway investigation report integration in §C:** inline-summary depth. Planner picks; recommend one-section-per-strategy with per-strategy clip + rating cited inline.
- **Fresh-clone test environment:** different folder on dev machine vs different machine vs Windows VM. Planner picks; recommend "different folder on dev machine" as the floor.

### User Constraints — Resolved Ambiguities

The following gaps in CONTEXT.md were surfaced by this research and need explicit planner judgment, framed against the locked decisions:

1. **D-03 file count:** the directory has SIX `.ts` files (`ws-message`, `audio-payload`, `action-intent`, `speech-envelope`, `param-frame`, `discrete-event`), not four. Recommendation: the planner should generate all six. The semantic intent of D-03 is "regenerate ALL hand-written contract TS in place"; the four-file enumeration was a snapshot of the Phase-1+2 surface before Phase 4 added two more.
2. **`json-schema-to-typescript` dependency location:** the repo is an npm workspaces monorepo (`packages/*`, `apps/*` workspaces declared in root `package.json`). Three landing options:
   - **(a)** Add to root `package.json` `devDependencies` — simplest, available from anywhere via root npx.
   - **(b)** Create `packages/contracts/ts/package.json` (currently no package.json there) and put it there — most semantically correct (the dep belongs to the contracts package) but requires a new workspace member.
   - **(c)** Add to `apps/electron-main/package.json` — wrong place (codegen is not an Electron concern).
   Recommendation: **(a)** for skeleton scope. Defer (b) to a future "monorepo cleanup" milestone if and when packages/contracts/ts grows non-codegen tooling.
3. **CONTEXT.md D-09 test 5 path correction:** D-09 names `OpenLLM_Vtuber/src/open_llm_vtuber/server/websocket_handler.py:239`. The actual path on disk is `OpenLLM_Vtuber/src/open_llm_vtuber/websocket_handler.py:239` (no `/server/` segment). The protocol-diff Python script must use the correct path. Verified at `C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/websocket_handler.py:239`.

### Deferred Ideas (OUT OF SCOPE)

- CI/CD pipeline beyond a single `.github/workflows/contracts-drift.yml`.
- Automated computer-vision verification of visible §14 SCs (lipsync, joy blend, body sway).
- Cross-platform fresh-clone test (macOS, Linux). Skeleton is Windows-pinned.
- Public release-engineering (electron-builder signing, code-signing certs).
- Telemetry / analytics in the verification flow.
- `pydantic2ts` A/B comparison in CI.
- TypeScript-as-source-of-truth for some contracts.
- Schema versioning for the WS envelope.
- Code-quality bar enforcement (Ruff, ESLint, Prettier in CI).
- Live debug-overlay HUD.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SC-01** | All six §14 success criteria are formally verified against the running system and recorded in a `.planning/skeleton-verification.md` handoff document (1. text→reply with synced lipsync, 2. `[joy]` smooth blend, 3. visible idle micro-motion, 4. visible speech-driven body/head sway, 5. cursor tracking, 6. WS protocol matches OLVT shape). | RESEARCH covers: §14 SC verbatim text (verified at `PROJECT_DESIGN.md:1572-1581`), evidence-collection patterns per SC type (script vs clip), `verify-skeleton.sh` orchestrator pattern, OLVT protocol-shape introspection script approach, body-sway report integration shape, fresh-clone test mechanics. |
| **SC-02** | `packages/contracts/` initially ships hand-written TypeScript mirroring the Pydantic models in Python; final phase replaces hand-written TS with codegen (`datamodel-code-generator` or `pydantic2ts`); Pydantic models are the source of truth. | RESEARCH covers: empirically verified `pydantic.TypeAdapter(WSMessage).json_schema()` output shape; verified `json-schema-to-typescript@15.0.4` actual output and identified two material problems with concrete fixes; identified type-guard generation pattern from discriminator mapping; documented Optional/None handling discrepancy between Pydantic JSON Schema and target TS shape with mutation-rule fix. |

The two requirements map to the two plans (D-13): 05-01 satisfies SC-02; 05-02 satisfies SC-01.

</phase_requirements>

## Standard Stack

### Core (codegen pipeline)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Pydantic** | **2.12.5** (verified live in our `sidecar/.venv`) | JSON Schema source-of-truth via `TypeAdapter(X).json_schema()` or `Model.model_json_schema()` | Already locked at `pydantic>=2.5` in `packages/contracts/py/pyproject.toml`. v2 emits OpenAPI-compatible discriminator+oneOf for `Annotated[Union[...], Field(discriminator=...)]` (verified by running on our `WSMessage`). |
| **json-schema-to-typescript** | **15.0.4** (released 2025-01-14, latest stable as of 2026-05-07; `npm view json-schema-to-typescript version` confirms) | JSON Schema → TypeScript types | Most-installed (~700k weekly downloads), maintained by bcherny, MIT license. Treats `oneOf` as flat TS union (functionally equivalent for our needs). Has known limitations around literal-alias hoisting and discriminator handling — both addressable by schema mutation + post-processing. |
| **Node 22 LTS** | already pinned in root `package.json` engines | Runs jsts | jsts is pure JS; no native compilation. |
| **Python 3.12** | already pinned in `pyproject.toml` `requires-python = ">=3.12,<3.13"` | Runs the wrapper script | Same Python the sidecar runs. Wrapper imports our existing `contracts` Pydantic models from `packages/contracts/py/`. |

### Supporting (verification)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **pytest** | `>=8` (already in `sidecar/pyproject.toml`) | Adversarial `[joy]` token-boundary test (D-09 test 1) | Already in use for sidecar tests. New file `sidecar/tests/test_phase5_token_boundary.py` follows existing test patterns. |
| **pytest-asyncio** | `>=0.24` (already in `sidecar/pyproject.toml`) | Async LLM-stream simulation if the test fakes the orchestrator pipeline | Already wired. |
| **bash** (Git Bash on Windows) | system | `scripts/verify-skeleton.sh` orchestrator | POSIX-portable; runs in WSL, macOS, Linux, and Git Bash on Windows (which is part of standard Git for Windows install). PowerShell is the alternative; bash chosen because the Python sub-scripts run identically and the orchestrator is ~30 LOC of glue. |
| **Python `psutil`** | `>=7.0` (already in sidecar deps) | Port-collision test (D-09 test 4) — needs PID introspection to confirm sidecar restart | Already vendored. |
| **OBS Studio** OR **Windows Game Bar** (`Win+G`) | OBS 30.x or built-in | 5–10s clip capture for visible SCs | OBS is heavier-weight but produces consistent .mp4 H.264 (ffmpeg-encoded) output suitable for git LFS. Game Bar (built into Windows 11) uses MP4 + H.264 with sane defaults; ~1–2 MB per 5–10s clip at 1080p30. **Recommend Game Bar for the skeleton** — zero install, ships with the OS, output lands in `%USERPROFILE%/Videos/Captures/`. OBS is the fallback if Game Bar refuses to record (it sometimes won't capture VTS; see Common Pitfalls). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `json-schema-to-typescript` | `quicktype` | quicktype handles discriminators better (emits proper tagged unions) but the binary is heavier and the Node API has more surface area for our 6-contract scope. Locked decision (D-01 hand-rolled-with-jsts). |
| `json-schema-to-typescript` | `json-schema-to-ts` | Type-level (compile-time) inference rather than codegen. Wrong shape — we need actual emitted .ts files for the renderer to import. |
| `json-schema-to-typescript` | Hand-write TS-emit logic in Python | Would avoid jsts entirely — direct AST emission from Pydantic schema. ~250 LOC in Python. Locked decision rejects this (CONTEXT.md D-01 picks jsts as the npm dep). |
| Bash orchestrator (`.sh`) | PowerShell (`.ps1`) | PowerShell is Windows-native and the env header says PowerShell. **But:** the orchestrator just calls Python sub-scripts and prints markdown; bash via Git Bash is identical functionality and more portable for any future Linux/macOS user. Planner-discretion per CONTEXT.md. Recommend bash. |
| Game Bar capture | OBS Studio | OBS has more controls but Game Bar is zero-install + already on Windows 11. Recommend Game Bar; OBS as fallback. |
| ffmpeg post-process clips | None (commit raw Game Bar output) | Game Bar's default H.264 .mp4 is ~1–2 MB per 5–10s clip at 1080p30 — fine for LFS. ffmpeg re-encode at lower bitrate could shrink to ~300–500 KB but adds a tooling dependency. **Skip** — commit raw output. |

### Installation

```bash
# Top-level npm dev-dep (recommendation: lands in root package.json)
npm install --save-dev json-schema-to-typescript@15.0.4

# Python wrapper has no new deps — Pydantic 2.12.5 is already installed via packages/contracts/py
```

**Version verification (live confirmed 2026-05-07):**
- `json-schema-to-typescript` 15.0.4 published 2025-01-14 (`npm view json-schema-to-typescript time --json`).
- `pydantic` 2.12.5 in `sidecar/.venv` (`python -c "import pydantic; print(pydantic.VERSION)"` returns `2.12.5`).

## Architecture Patterns

### Recommended Project Structure

After Phase 5 lands:

```
packages/contracts/
├── py/
│   ├── contracts/
│   │   ├── __init__.py            # exports all 11 names (unchanged)
│   │   ├── ws_message.py          # source-of-truth (unchanged)
│   │   ├── audio_payload.py       # source-of-truth (unchanged)
│   │   ├── action_intent.py       # source-of-truth (unchanged)
│   │   ├── speech_envelope.py     # source-of-truth (unchanged)
│   │   ├── param_frame.py         # source-of-truth (unchanged)
│   │   └── discrete_event.py      # source-of-truth (unchanged)
│   └── pyproject.toml             # unchanged
├── ts/
│   ├── ws-message.ts              # GENERATED (overwrites hand-written)
│   ├── audio-payload.ts           # GENERATED
│   ├── action-intent.ts           # GENERATED
│   ├── speech-envelope.ts         # GENERATED
│   ├── param-frame.ts             # GENERATED
│   └── discrete-event.ts          # GENERATED
├── generated/                     # NEW (per planner-discretion default)
│   └── json-schema/
│       ├── ws-message.schema.json # committed intermediate
│       ├── audio-payload.schema.json
│       ├── action-intent.schema.json
│       ├── speech-envelope.schema.json
│       ├── param-frame.schema.json
│       └── discrete-event.schema.json
├── scripts/                       # NEW
│   └── codegen.py                 # ~150 LOC Python wrapper
└── codegen.sh                     # NEW — bash entry-point

scripts/                           # NEW (top-level)
├── verify-skeleton.sh             # auto-runnable subset orchestrator
└── verify/
    ├── token_boundary_test.py     # D-09 test 1 (split [joy] across deltas)
    ├── reasoning_smoke.py         # D-09 test 2 (DeepSeek-R1 think-tag check)
    ├── port_collision_test.py     # D-09 test 4 (sidecar restart, port:0)
    └── olvt_protocol_diff.py      # D-09 test 5 (OLVT _route_message diff)

.planning/
├── skeleton-verification.md       # NEW (milestone-end handoff doc)
└── skeleton-verification-evidence/
    ├── 04/                        # already exists (Phase 4 04-04 output)
    │   ├── head_only/
    │   ├── proxy_param/
    │   └── exp3_modulation/
    └── 05/                        # NEW
        ├── sc1-idle-micro-motion.mp4    # LFS
        ├── sc2-joy-blend.mp4            # LFS
        ├── sc4-body-head-sway.mp4       # LFS
        └── sc5-cursor-tracking.mp4      # LFS

README.md                          # extended with "## Quickstart Demo" section
.gitattributes                     # extended with `*.mp4 filter=lfs ...`
package.json                       # add json-schema-to-typescript devDep
```

### Pattern 1: Pydantic-discriminated-union → JSON Schema → TS flat union

**What:** Our `WSMessage` is `Annotated[Union[9 variants], Field(discriminator="type")]`. The pipeline must round-trip this into a TS flat union where each variant retains its `type: 'literal'` field, and the renderer's existing `is<Variant>(m: WSMessage): m is X => m.type === 'literal'` guards continue to work.

**When to use:** This is the canonical case for the entire pipeline; every other contract is simpler.

**Mechanics (verified live 2026-05-07):**

```python
# At the Python end:
from pydantic import TypeAdapter
from contracts.ws_message import WSMessage
schema = TypeAdapter(WSMessage).json_schema()
# Pydantic emits:
# {
#   "discriminator": {"propertyName": "type", "mapping": {"audio": "#/$defs/AudioPayloadMessage", ...}},
#   "oneOf": [{"$ref": "#/$defs/TextInputMessage"}, ...],
#   "$defs": {"TextInputMessage": {...}, "AudioPayloadMessage": {...}, ...}
# }
```

```typescript
// At the TS end (after wrapper post-processing):
export type WSMessage =
  | TextInputMessage
  | DisplayTextMessage
  | ShutdownMessage
  | AudioPayloadMessage
  | ControlMessage
  | FullTextMessage
  | ForceNewMessageMessage
  | ErrorMessage
  | LogMessage;

export interface AudioPayloadMessage {
  type: 'audio';        // ← required literal (NOT optional, NOT a hoisted alias)
  audio: string | null; // ← required + nullable (matches Pydantic Optional[str] default=None)
  // ...
}
```

**The two empirically-verified problems and their fixes:**

1. **`type` field comes out OPTIONAL** in jsts because Pydantic puts every field with a default into `not required`. Pydantic represents `Literal["audio"] = "audio"` as `{"const": "audio", "default": "audio"}` — and because `default` exists, `type` is NOT in the parent schema's `required` array. jsts then emits `type?: 'audio'` (optional). **Result:** the discriminated-union breaks because `type` could legally be `undefined`. **Fix:** the wrapper script must mutate the schema before invoking jsts — for every property whose schema has `const`, add it to the parent's `required` list.

2. **`Optional[X]` (anyOf with null) comes out OPTIONAL+NULLABLE** in jsts. Pydantic represents `Optional[str] = None` as `{"anyOf": [{"type": "string"}, {"type": "null"}], "default": null}`. jsts emits `audio?: string | null`. **Current hand-written TS is `audio: string | null`** (required, nullable — matches what the renderer always sees on the wire because the orchestrator always sets it explicitly). **Fix:** for every property whose schema has `anyOf` containing `{"type": "null"}`, add it to the parent's `required` list. This makes `audio: string | null` (required field, nullable value) match the existing hand-written shape.

**Code (the schema-mutation function the wrapper must apply, ~10 LOC):**

```python
def force_required(schema: dict) -> None:
    """Mutate schema in place: add discriminator/Optional fields to required.

    Pydantic emits `default: <value>` on every defaulted field, including the
    Literal["..."] discriminator (default=its-own-value) and Optional[X]=None.
    jsts then emits these as `field?:` (optional). For our wire contract, the
    discriminator field MUST be required and Optional fields ARE always sent.
    """
    if not isinstance(schema, dict):
        return
    props = schema.get("properties")
    if isinstance(props, dict):
        required = set(schema.get("required", []))
        for name, prop in props.items():
            # Discriminator literals: have a `const` key.
            if isinstance(prop, dict) and "const" in prop:
                required.add(name)
            # Optional[X] = None: have anyOf with a {"type":"null"} branch.
            if isinstance(prop, dict) and any(
                isinstance(x, dict) and x.get("type") == "null"
                for x in prop.get("anyOf", [])
            ):
                required.add(name)
        if required:
            schema["required"] = sorted(required)
    # Recurse
    for key in ("$defs", "definitions"):
        sub = schema.get(key)
        if isinstance(sub, dict):
            for v in sub.values():
                force_required(v)
```

**Where this matters for our specific contracts:**

| Contract | Field | Pydantic source | Without fix | With fix |
|----------|-------|-----------------|-------------|----------|
| `AudioPayloadMessage` | `type` | `Literal["audio"] = "audio"` | `type?: 'audio'` (BROKEN — discriminator) | `type: 'audio'` |
| `AudioPayloadMessage` | `audio` | `Optional[str] = None` | `audio?: string \| null` | `audio: string \| null` |
| `AudioPayloadMessage` | `volumes` | `List[float] = []` | `volumes?: number[]` | (no change — no null in anyOf, default=[] doesn't trigger fix) — **see Pitfall** |
| `ActionIntent` | `duration_ms` | `Optional[int] = None` | `duration_ms?: number \| null` | `duration_ms: number \| null` |

**Pitfall in this fix:** `volumes: List[float] = []` (default empty list) is also "not required" in Pydantic JSON Schema, but the current hand-written TS has `volumes: number[]` (required). The fix above does NOT cover this case (no null in anyOf, no const). **The planner needs to decide:** either (a) extend the fix to mark every defaulted-non-null field as required (matches current hand-written exactly but loses the "this field has a meaningful default" signal in TS), or (b) accept `volumes?: number[]` and audit renderer code to confirm no consumer breaks. **Recommendation: extend the fix to cover ALL `default:` fields** — the wire contract always carries `volumes` because the orchestrator always sets it explicitly; matching the existing shape is safer than introducing renderer-side optional checks.

The extended rule:

```python
# Extended: also mark as required any field with `default:` that the wire contract always sets
for name, prop in props.items():
    if isinstance(prop, dict) and "default" in prop:
        required.add(name)
```

**Verified output after both fixes** (run on our actual `WSMessage` schema): each variant's discriminator becomes `type: 'literal'` (required), every defaulted field becomes required-with-its-actual-type. This matches the current hand-written shape exactly.

### Pattern 2: jsts hoisted-alias post-processing

**What:** jsts emits ugly hoisted aliases for every literal and primitive: `export type Type1 = "display-text"; export type Text = string; ...`. The current hand-written TS uses inline literals (`type: 'display-text'`).

**When to use:** Always — every codegen run produces this clutter; it must be cleaned up.

**Mechanics:** Two-pass text post-processing on the jsts output:

1. **Inline single-literal aliases:** Find lines matching `^export type (\w+) = ("..."(\s*\|\s*"...")*);$`. Build a name→value map. Replace every standalone occurrence of those names elsewhere in the output with the inlined value. Then delete the alias declarations.
2. **Strip primitive aliases:** Delete lines matching `^export type \w+ = (string|number|boolean|null|number\[\]|string\[\]);$` AND replace their occurrences with the primitive directly.

**Reference implementation skeleton** (~30 LOC Python on the jsts output text):

```python
import re

def post_process_jsts(ts: str) -> str:
    # 1. Find all single-string-literal-only or simple-union aliases.
    alias_re = re.compile(r'^export type (\w+) = ("[^"]+"(?:\s*\|\s*"[^"]+")*);$', re.MULTILINE)
    aliases = {m.group(1): m.group(2) for m in alias_re.finditer(ts)}

    # 2. Find all primitive aliases.
    prim_re = re.compile(
        r'^export type (\w+) = (string|number|boolean|null|number\[\]|string\[\]|boolean\[\]);$',
        re.MULTILINE,
    )
    primitives = {m.group(1): m.group(2) for m in prim_re.finditer(ts)}

    # 3. Inline by replacing word-boundary occurrences.
    for name, value in {**aliases, **primitives}.items():
        ts = re.sub(rf'\b{name}\b', value, ts)

    # 4. Strip the now-self-referential / dead alias declarations.
    ts = re.sub(r'^export type [^=]+ = "[^"]+"(?:\s*\|\s*"[^"]+")*;\n?', '', ts, flags=re.MULTILINE)
    ts = re.sub(r'^export type \w+ = (?:string|number|boolean|null|\w+\[\]);\n?', '', ts, flags=re.MULTILINE)
    return ts
```

### Pattern 3: Type-guard generation from discriminator mapping (D-04)

**What:** For each variant in the discriminated union, emit `export const isX = (m: WSMessage): m is X => m.type === 'literal'`. jsts cannot do this; the wrapper appends them.

**Mechanics:** After post-processing the jsts output, append a guards section. The wrapper has the discriminator mapping in scope (it's right there in the JSON Schema's root `discriminator.mapping`). For each `(literal_value, variant_name)` pair:

```python
def emit_guards(discriminator_mapping: dict[str, str], discriminator_field: str = "type") -> str:
    """discriminator_mapping is e.g. {"audio": "#/$defs/AudioPayloadMessage", ...}.
    Returns TS source for `export const is<Variant> = ...` predicates.
    """
    lines = ["", "// Type guards (auto-generated from discriminator mapping):"]
    for literal, ref in discriminator_mapping.items():
        variant_name = ref.rsplit("/", 1)[-1]  # "AudioPayloadMessage"
        # Convert to camel-case suffix: drop "Message" if present, then prefix with "is".
        guard_suffix = variant_name.removesuffix("Message")
        lines.append(
            f"export const is{guard_suffix} = (m: WSMessage): m is {variant_name} => "
            f"m.{discriminator_field} === '{literal}';"
        )
    return "\n".join(lines)
```

This produces (matching current hand-written `ws-message.ts:32-42`):

```typescript
export const isTextInput = (m: WSMessage): m is TextInputMessage => m.type === 'text-input';
export const isDisplayText = (m: WSMessage): m is DisplayTextMessage => m.type === 'display-text';
export const isShutdown = (m: WSMessage): m is ShutdownMessage => m.type === 'shutdown';
export const isAudioPayload = (m: WSMessage): m is AudioPayloadMessage => m.type === 'audio';
export const isControl = (m: WSMessage): m is ControlMessage => m.type === 'control';
export const isFullText = (m: WSMessage): m is FullTextMessage => m.type === 'full-text';
export const isForceNewMessage = (m: WSMessage): m is ForceNewMessageMessage => m.type === 'force-new-message';
export const isError = (m: WSMessage): m is ErrorMessage => m.type === 'error';
export const isLog = (m: WSMessage): m is LogMessage => m.type === 'log';
```

**Note on imports across files:** the current `ws-message.ts` re-exports types from `./audio-payload` and `./action-intent`. The wrapper must preserve cross-file imports — easiest approach: keep one variant's full definition in its own file (e.g., `AudioPayloadMessage` in `audio-payload.ts`) and have `ws-message.ts` import-and-re-export. The wrapper handles this by emitting one TS file per Pydantic source file (mapping `ws_message.py` → `ws-message.ts`, etc.) and emitting `import type` lines at the top of `ws-message.ts` for cross-file types.

### Pattern 4: Verification doc structure (D-05)

**Single file** at `.planning/skeleton-verification.md`:

```markdown
# Walking Skeleton — §14 Verification Record

**Verified:** 2026-05-XX
**Skeleton scope:** PROJECT_DESIGN.md §14
**Bar:** Every §14 SC reaches PASS or PARTIAL. PARTIAL acceptable ONLY for AVT-06 (head-only with rationale per requirement allowance). Any FAIL or non-AVT-06 PARTIAL = milestone incomplete; gap goes into Phase 5 fix scope.
**Frozen:** This doc records the skeleton state at end-of-walking-skeleton-milestone. New verification docs at each subsequent milestone close.

## §A. §14 Success Criteria

| SC# | Text | Verdict | Evidence | Observation | Follow-ups |
|-----|------|---------|----------|-------------|------------|
| 1 | User types "hello" → avatar speaks reply with sync'd lipsync | PASS | clip: `skeleton-verification-evidence/05/sc1-idle-micro-motion.mp4` + log: `[STUB-TTS] sentence ...` | (operator paragraph) | — |
| 2 | LLM emits `[joy]` → ~300ms smooth blend, decay after sentence | PASS | clip: `.../sc2-joy-blend.mp4` | ... | — |
| 3 | Idle baseline visible micro-motion when silent | PASS | clip: `.../sc1-...` (covers both 1 and 3 contiguously) | ... | — |
| 4 | Speech driver continuous body/head sway, no flat moments | **PARTIAL** (AVT-06 head-only allowance) | clip: `.../sc4-body-head-sway.mp4` + §C body-sway report | ... | Body-sway investigation closed; head-only ships per `teto_overrides.yaml.body_sway_strategy=head_only`; rationale in §C. |
| 5 | Cursor over canvas → eye/head tracking | PASS | clip: `.../sc5-cursor-tracking.mp4` | ... | — |
| 6 | WS pipeline shape matches OLVT | PASS | script: `scripts/verify/olvt_protocol_diff.py` (output below) | (paste introspection output) | Documented divergences: `force-new-message`, `forwarded`, `sentence_id` (Discrepancy 4 in `02-CONTEXT-AMENDMENT.md`) |

## §B. PITFALLS "Looks Done But Isn't" e2e Checklist

| Test | Source | Verdict | Evidence |
|------|--------|---------|----------|
| 1. Adversarial `[joy]` token-boundary | Pitfall 5 | PASS | `pytest sidecar/tests/test_phase5_token_boundary.py -v` output verbatim |
| 2. DeepSeek-R1 reasoning suppression | Pitfall 6 | PASS | one chat turn with reasoning model, paste chat output: no `<think>` content |
| 3. VTS auth-reprompt | Pitfall 10 | PASS | operator: deleted token file, restarted sidecar, observed VTS popup, granted, reconnected |
| 4. Port-collision | PLUMB-03 / Pitfall 11 | PASS | `python scripts/verify/port_collision_test.py` output: both binds succeed on different ephemeral ports |
| 5. OLVT protocol-shape diff | PLUMB-03 | PASS | `python scripts/verify/olvt_protocol_diff.py` output: documented divergences only |

## §C. Body-Sway Investigation Report

**Ship default:** `head_only` (per `avatars/teto/teto_overrides.yaml:4`)

**Why head-only ships:** ... (one-paragraph summary referencing 04-04's per-strategy evidence)

**Strategies tried:**

### head_only (baseline, ALWAYS ships fallback)
- Evidence: `.planning/skeleton-verification-evidence/04/head_only/clip.mp4`
- Result: Visible head sway throughout TTS, no body motion. Acceptable for AVT-06 head-only allowance.
- Rating: ... (from 04-04)

### proxy_param
- Evidence: `.planning/skeleton-verification-evidence/04/proxy_param/clip.mp4`
- Result: ... (depends on smoke-pass discovery in 04-00)

### exp3_modulation
- Evidence: `.planning/skeleton-verification-evidence/04/exp3_modulation/clip.mp4`
- Result: ...

**Recommendation for next milestone:** ...
```

### Anti-Patterns to Avoid

- **Generating into a NEW directory and rewiring `@contracts/*` alias** — D-03 explicitly rejects. The codegen overwrites in place, alias unchanged.
- **Hand-editing the regenerated `.ts` files** — kills the round-trip. The banner comment must be loud and unambiguous: "GENERATED — do not edit". Codegen run + commit becomes the only mechanism.
- **Splitting the verification doc into multiple files** — D-05 explicitly rejects. One file, three sections.
- **Shipping without the fresh-clone test** — D-10 makes this the LFS-hydrate gate. Skipping it means the next user cloning the repo will hit "Teto doesn't render and TTS is silent" with no error message.
- **Treating `pydantic2ts` or `datamodel-code-generator` as worth retrying** — both rejected at D-01 with explicit reasoning. Hand-rolled chain is the locked path.
- **Using a pre-commit hook for drift-check** — D-02 explicitly rejects (adds husky/lefthook dep, harder to bypass). The pattern is: engineer runs `codegen.sh`, commits the output; CI runs the same command + `git diff --exit-code`.
- **Mutating Pydantic models to "fix" the JSON Schema output** — wrong direction. Pydantic is source-of-truth; the schema-mutation logic lives in the wrapper script, NOT in the source `.py` files.
- **Running the verification doc-gen during plan-phase** — the doc captures the state at end-of-milestone. Premature population of §A would invalidate when SCs change. The wrapper writes scaffolding; operator fills observations during execution.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pydantic → JSON Schema | Custom AST traversal of Pydantic models | `pydantic.TypeAdapter(X).json_schema()` (or `Model.model_json_schema()` on a single model) | Pydantic v2 emits canonical OpenAPI-3.1-compatible JSON Schema with `$defs` and discriminator support out of the box. Reverse-engineering this from `model_fields` would be 200+ LOC and brittle to Pydantic upgrades. |
| JSON Schema → TypeScript | Hand-write a TS emitter walking JSON Schema | `json-schema-to-typescript@15.0.4` (with documented post-processing) | jsts is ~6 years stable, handles `$ref`, `allOf`, `oneOf`, `anyOf`, primitives, and JSDoc-from-description. Limitations (literal hoisting, optional-discriminator) are addressable in ~50 LOC of pre/post-processing. Building a TS emitter from scratch is ~600+ LOC. |
| `[joy]` token-boundary test | New test framework | pytest fixture in `sidecar/tests/test_phase5_token_boundary.py` | Sidecar already uses pytest with `pytest-asyncio`. The test fakes the LLM stream by injecting `[`, `jo`, `y]` deltas into the orchestrator's existing pipeline (`actions_extractor` already handles this — Phase 2 LLM-02 closed the SC #3 BLOCKER programmatically per STATE.md). The Phase 5 test is a NEW assertion at the orchestrator's *output* boundary: assert no bracket character is in the AudioPayloadMessage `display_text.text` field. |
| OLVT protocol diff | Bash + diff -u | Python introspection script that imports both Pydantic unions side-by-side and compares variant sets | OLVT's variant set is a `dict[str, Callable]` (`_init_message_handlers` at `websocket_handler.py:76-98`); ours is `Annotated[Union[...], Field(discriminator="type")]`. Direct text diff on dissimilar source forms is noisy. Python script: read OLVT's handler dict (just import + introspect), enumerate ours via `WSMessage.__metadata__[0].discriminator.mapping`, print a markdown table of overlap + intentional divergences. |
| Port-collision test | netstat + manual | Python script that spawns the sidecar twice on `port:0` and asserts both bind cleanly | The sidecar already uses `port:0` (BYO-socket pattern locked in Phase 1, per STATE.md "BYO-socket port:0 pattern locked"). The test confirms the pattern works under repeated launches. |
| Video clip capture | Custom Electron screen-record API | Windows Game Bar (`Win+G`) | Built into Windows 11; output is .mp4 H.264 at 1080p30 with sane bitrate; lands in `%USERPROFILE%/Videos/Captures/`. Move to `.planning/skeleton-verification-evidence/05/` and commit via LFS. |
| README "Quickstart Demo" | Multi-section auto-generated | Single hand-edited "## Quickstart Demo" section with the literal commands from the fresh-clone test (D-10) | The point is "future-you on a different machine can come back and run this." Verbatim commands beat templated/auto-generated copy. |

**Key insight:** The hand-rolled chain looks like a lot of moving parts (Pydantic → JSON Schema → jsts → post-process → guards), but every link is a small, well-understood transformation. The alternatives — `pydantic2ts` (intermittently maintained), `datamodel-code-generator` (wrong direction), or hand-writing a Pydantic-to-TS emitter — each fail in worse ways. The wrapper script is the lowest-total-complexity path.

## Runtime State Inventory

> **Phase 5 is partly a "rewrite contracts" phase but the rewrite is mechanical** (regenerated TS overwrites hand-written TS in place; renderer imports unchanged). It also makes claims about runtime state via fresh-clone testing. So this section IS relevant — both for the codegen and for the verification.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — Phase 5 introduces no datastore changes. The verification doc reads `avatars/teto/teto_overrides.yaml.body_sway_strategy` (set by Phase 4 04-04) but does not write it. | Verification step in 05-02 confirms the file exists and the strategy field is populated; if not, that's a Phase 4 incompletion blocking Phase 5 ship-readiness gate. |
| **Live service config** | VTube Studio's per-plugin auth grant — granted to the sidecar with the *current* token-path (Pitfall 10's per-user-data-dir fix). If Phase 5's PITFALLS test 3 (D-09 #3) deletes the token file, the operator must re-grant in VTS UI; the grant persists in VTS's settings (not in our git tree). | Test 3 is OPERATOR-DRIVEN, not auto-runnable, because it needs the VTS UI popup. The planner must structure 05-02 so the operator knows the test transiently disrupts VTS auth state and re-grants. |
| **OS-registered state** | None new in Phase 5. Phase 1's parent-PID watchdog mechanism is what's tested by Pitfall 11 / Port-collision — but no OS registration exists. | None. |
| **Secrets/env vars** | The encrypted LLM-config blob (`AGENTICLLMVTUBER_LLM_CONFIG_JSON`) set by Electron main on the sidecar (Phase 2 STATE.md decision). Phase 5 fresh-clone test will hit the LLM setup screen unless the new clone has the same OS user (which DPAPI scopes the secret to). | README Quickstart prereqs MUST include "you'll see the LLM setup screen on first launch — this is expected on a fresh clone." Don't try to seed the encrypted config in the test environment; the setup-screen interaction is part of the SC verification. |
| **Build artifacts / installed packages** | `sidecar/.venv/` is gitignored. `apps/electron-main/node_modules/`, `apps/renderer/node_modules/` are gitignored. **`packages/contracts/py/contracts.egg-info/` is gitignored**. The fresh-clone test must `npm install` + `uv sync` to rebuild all of these. **CRITICAL:** if Phase 5 adds `json-schema-to-typescript` to root `package.json`, fresh `npm install` rehydrates it. No stale-artifact risk. | None. The fresh-clone test BY DESIGN catches "I forgot to commit a dep" issues. |

**The canonical question:** After every file in the repo is updated (codegen runs, all six TS files are regenerated, verification doc is written), what runtime systems still have the old string cached, stored, or registered? **Answer:** Nothing. The contracts have no persistent runtime state — they're shape-only. The verification doc is read-only after milestone close.

## Common Pitfalls

### Pitfall 1: Round-trip shape regression silently breaks renderer

**What goes wrong:** Codegen output differs from current hand-written shape (e.g., `audio?: string | null` vs `audio: string | null`). Renderer code compiles (TS structural typing is permissive), but at runtime the renderer's `m.audio.length` access throws because `audio` could be `undefined`. Tests pass, demo breaks.

**Why it happens:** Pydantic's "field with default → not required" rule produces JSON Schema that jsts faithfully reproduces, but the wire contract always carries the field. Optional-but-always-sent is a real impedance mismatch.

**How to avoid:**
- The schema-mutation rule (Pattern 1) MUST add ALL `default:`-bearing fields to `required` — not just discriminator-`const` and Optional-with-null.
- Round-trip diff test in 05-01: regenerate the six TS files; `git diff --stat packages/contracts/ts/`; manually inspect every changed line. Any unexpected change means the wrapper has a bug.
- Renderer typecheck in CI (`npm run typecheck:renderer`) catches the structural-typing case where `volumes?: number[]` would force renderer code to add `?? []` everywhere.

**Warning signs:**
- A regenerated `.ts` file has more `?:` (optional fields) than the hand-written original.
- Renderer code starts hitting `Cannot read properties of undefined (reading 'length')`.
- Tests pass but the demo flow throws in the browser dev tools console.

### Pitfall 2: jsts `bannerComment` option silently doesn't apply when wrapper appends content

**What goes wrong:** jsts has a `bannerComment` option that prepends a comment block. The wrapper post-processes the output (inline aliases, append guards). If the wrapper uses string concatenation, the banner ends up in the middle of the file — or duplicated.

**How to avoid:**
- Pass `bannerComment: ''` to jsts (explicitly empty), then prepend the banner comment in the wrapper after post-processing. Single source of truth for the banner.
- Banner format: `// GENERATED FROM packages/contracts/py/contracts/{name}.py — do not edit; run packages/contracts/codegen.sh to regenerate\n\n` (matches D-03 spec, planner-discretion exact wording).

### Pitfall 3: Cross-file imports broken when each schema is generated standalone

**What goes wrong:** `ws_message.py` imports `AudioPayloadMessage` from `audio_payload.py`. If the wrapper generates a JSON Schema for just `WSMessage` (root-level), Pydantic inlines `AudioPayloadMessage` into `$defs`. jsts then emits `AudioPayloadMessage` interface inside `ws-message.ts`. But we also generate `audio-payload.ts` separately — now `AudioPayloadMessage` is declared TWICE (once in each file). TypeScript compile error.

**How to avoid:**
- Generate one JSON Schema per Pydantic source file (call `Model.model_json_schema()` on the *primary* model in each file). For `ws_message.py`, the primary is `WSMessage`; cross-file types come in via `$defs`.
- After jsts emits each TS file, run a dedup pass: scan all six emitted files for duplicate `interface X` declarations. For each duplicate, keep the declaration in the file matching the source `.py` filename (e.g., `AudioPayloadMessage` lives in `audio-payload.ts`); delete from others; insert `import type { AudioPayloadMessage } from './audio-payload'` at the top of the importing file.
- Alternative: generate ONE big JSON Schema file with all contracts inlined, run jsts once, post-process by splitting into per-file outputs. More complex but avoids the dedup pass.
- **Recommendation:** Per-file generation + dedup pass. Matches existing hand-written layout where each file owns its primary type.

### Pitfall 4: jsts `additionalProperties` default produces `[k: string]: unknown` index signature

**What goes wrong:** Without `additionalProperties: false` in the JSON Schema (or in jsts options), every interface ends up with `[k: string]: unknown` — meaning renderer code can read any string key without TS error. Defeats the purpose of typed contracts.

**How to avoid:**
- Pass `additionalProperties: false` to jsts compile options. (Verified in our test run that this option works as expected.)
- Pydantic by default does NOT emit `additionalProperties: false` in the schema; the wrapper either adds it post-Pydantic-emit or relies on the jsts compile option.

### Pitfall 5: Codegen run produces non-deterministic output → drift check thrashes

**What goes wrong:** jsts internally sorts properties differently across runs (rare but documented). CI drift check fails on a clean re-run.

**How to avoid:**
- Run jsts with a stable deterministic config (`bannerComment: ''`, no random seeds — jsts is deterministic by default with stable input).
- Sort `$defs` keys alphabetically before invoking jsts (Pydantic v2.12 already does this — verified by running on our schema).
- The wrapper post-processing must also be deterministic: regex replacements in deterministic order, no Python `dict` ordering issues (use `sorted()` if iterating dicts that affect output).

**Warning signs:** Run `codegen.sh` twice without modifying any source; expect zero diff. If `git diff packages/contracts/ts/` shows any change between runs, there's a non-determinism bug.

### Pitfall 6: Game Bar refuses to record VTube Studio window

**What goes wrong:** Windows Game Bar treats VTS as a non-game; on some Windows builds, `Win+G` records but says "Game Bar can only record one game window" and refuses.

**How to avoid:**
- In VTube Studio settings, mark the window as "treat as game" if available, OR
- Fall back to OBS Studio (heavier-weight, ~150 MB install, but works on any Windows version).
- Document both paths in the verify-skeleton.sh next-steps reminder.

**Warning signs:**
- `Win+G` works for desktop but not when VTS is focused.
- Operator reports "I can't get the clip captured."

### Pitfall 7: Fresh-clone test on a Windows account that previously ran the dev tree → DPAPI hits the cached config

**What goes wrong:** D-10 says clone to a "fresh dir." If the operator's Windows account already has the encrypted LLM-config blob in `electron-store`'s default location (`%APPDATA%/AgenticLLMVTuber/Config/...`), the new clone's first launch reads the SAME blob (because `electron-store` is keyed by app name, not install path) and skips the LLM setup screen. Then the fresh-clone test "passes" but a fundamentally different machine would still fail.

**How to avoid:**
- Either: clone into a different Windows account (most defensive but high friction), OR
- Wipe `%APPDATA%/AgenticLLMVTuber/` before the fresh-clone test (operator step), OR
- Document this as a known limitation: "fresh-clone test on the same Windows user verifies dependency hydration but NOT first-launch UX" and recommend a manual LLM-setup-flow walk as part of the test.
- **Recommendation:** wipe `%APPDATA%/AgenticLLMVTuber/` as a step in the fresh-clone test. Operator backs up the dir first, runs the test, restores after.

**Warning signs:** Fresh-clone test "passes" without any LLM setup-screen interaction. That's a false positive.

### Pitfall 8: OLVT protocol-diff script imports OLVT's Pydantic models — but OLVT may not have a clean Pydantic surface

**What goes wrong:** D-09 test 5 says "compare against OLVT's `WSMessage` discriminated-union variants" — but reading OLVT's `websocket_handler.py:239` shows `_route_message` accepts `data: WSMessage` where `WSMessage` is a generic dict-like, not a Pydantic union. The variant set is the dict keys of `_init_message_handlers` (lines 76-98).

**How to avoid:**
- The diff script imports OLVT's `WebSocketHandler` class, calls `handler._init_message_handlers()` (or reads the `_message_handlers` dict directly via introspection without needing a fully-constructed handler), enumerates the keys.
- Compare against ours via `from contracts.ws_message import WSMessage; mapping = WSMessage.__metadata__[0].discriminator.mapping; ours = set(mapping.keys())`.
- Output: a markdown table of `{olvt_only, both, ours_only}` with documented divergences (e.g., `force-new-message` is OURS only — same string OLVT emits in `conversation_utils.py` but not in `_route_message` because OLVT routes outbound differently from inbound).
- The script may need to construct a minimal OLVT handler with mocks; alternative: parse the source file with `ast` module to extract the dict literal at line 78. Source-parsing is more brittle but doesn't require running OLVT.
- **Recommendation:** AST-parsing approach. ~30 LOC of `ast.parse` + walking to find the `_init_message_handlers` return statement. Avoids importing all of OLVT's deps.

**Warning signs:** Script crashes on `ImportError: open_llm_vtuber.config_manager` — OLVT has heavy import chains.

### Pitfall 9: `forwarded` and `frontend-playback-complete` are documented OLVT divergences

**What goes wrong:** D-09 test 5 may flag these as unexpected divergences. They're not — they're documented in Phase 2's `02-CONTEXT-AMENDMENT.md` and STATE.md.

**How to avoid:**
- The protocol-diff script should consume an "expected divergences" allowlist (e.g., a TOML or JSON file at `.planning/research/olvt-protocol-divergences.json`). Each entry: `{name, direction (olvt_only|ours_only), rationale, source_doc_ref}`.
- Documented divergences from existing Phase 1+2 work:
  - `forwarded` (in our `AudioPayloadMessage`) — OLVT broadcast flag; always False in skeleton (per `audio_payload.py:34`).
  - `sentence_id` (in our `AudioPayloadMessage`) — Phase-2 extension over OLVT (per `audio_payload.py:32`, "Discrepancy 4").
  - `force-new-message` — turn-seal envelope; OLVT emits in `conversation_utils.py:181` outbound but does NOT route it in `_route_message` (it's outbound-only); we match.
  - OLVT-only that we don't have: `add-client-to-group`, `remove-client-from-group`, `request-group-info`, `mic-audio-data`, `mic-audio-end`, `raw-audio-data`, `fetch-history-list`, `fetch-and-set-history`, `create-new-history`, `delete-history`, `interrupt-signal`, `ai-speak-signal`, `fetch-configs`, `switch-config`, `fetch-backgrounds`, `audio-play-start`, `request-init-config`, `heartbeat` — all are out of skeleton scope (multi-thread, multi-avatar, voice input, history, group chat per `_init_message_handlers` lines 78-98). Document these as "OLVT-only, intentionally absent in skeleton — covered by future-milestone REQUIREMENTS.md v2 entries."
- The script's success criterion is: every divergence is in the allowlist. Any UNEXPECTED divergence fails the script.

**Warning signs:** First run of the diff script flags 18+ divergences. Most are intentional; one or two might be real bugs.

## Code Examples

Verified patterns from running the actual tools against our actual contracts on 2026-05-07.

### Generating JSON Schema from a Pydantic discriminated union

```python
# Source: live execution against packages/contracts/py/contracts/ws_message.py
import sys, json
sys.path.insert(0, 'packages/contracts/py')
from contracts.ws_message import WSMessage
from pydantic import TypeAdapter

adapter = TypeAdapter(WSMessage)
schema = adapter.json_schema()
# schema['discriminator'] = {'propertyName': 'type', 'mapping': {'audio': '#/$defs/AudioPayloadMessage', ...}}
# schema['oneOf'] = [{'$ref': '#/$defs/TextInputMessage'}, ...]
# schema['$defs'] = {'TextInputMessage': {...}, 'AudioPayloadMessage': {...}, ...}
```

For single-model files (e.g., `audio_payload.py`), use `Model.model_json_schema()`:

```python
from contracts.audio_payload import AudioPayloadMessage
schema = AudioPayloadMessage.model_json_schema()
# schema['properties']['type'] = {'const': 'audio', 'default': 'audio', 'title': 'Type', 'type': 'string'}
# schema['required'] = ['display_text', 'sentence_id']  # NOTE: 'type', 'audio', 'volumes', 'actions', 'forwarded' NOT required because they have defaults
```

### Wrapper script skeleton (~80 LOC core + ~70 LOC post-processing = ~150 LOC total)

```python
# packages/contracts/scripts/codegen.py
"""Pydantic source-of-truth → JSON Schema → TypeScript codegen.

Mechanical chain:
1. Import each Pydantic model from contracts/py/contracts/.
2. Emit JSON Schema (with our shape-mutation rules applied).
3. Write JSON Schema to packages/contracts/generated/json-schema/{name}.schema.json (committed).
4. Invoke `npx json-schema-to-typescript` per schema.
5. Post-process the TS output (inline hoisted aliases, dedup cross-file types, append guards).
6. Write to packages/contracts/ts/{name}.ts (overwrites hand-written).
"""
from __future__ import annotations
import json, re, subprocess, sys
from pathlib import Path
from pydantic import TypeAdapter, BaseModel
from contracts import (
    WSMessage, AudioPayloadMessage, ActionIntent, SpeechEnvelopePayload,
    ParamFrame, DiscreteEvent,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_DIR = REPO_ROOT / "packages/contracts/generated/json-schema"
TS_DIR = REPO_ROOT / "packages/contracts/ts"
PY_SOURCE_REL = "packages/contracts/py/contracts"

# (model, ts_filename_without_ext, py_source_filename_without_ext, primary_type_for_imports)
TARGETS = [
    (WSMessage,              "ws-message",       "ws_message",      "WSMessage"),
    (AudioPayloadMessage,    "audio-payload",    "audio_payload",   "AudioPayloadMessage"),
    (ActionIntent,           "action-intent",    "action_intent",   "ActionIntent"),
    (SpeechEnvelopePayload,  "speech-envelope",  "speech_envelope", "SpeechEnvelopePayload"),
    (ParamFrame,             "param-frame",      "param_frame",     "ParamFrame"),
    (DiscreteEvent,          "discrete-event",   "discrete_event",  "DiscreteEvent"),
]


def force_required(schema: dict) -> None:
    """Mutate schema in place: discriminator-const + Optional[X] + defaulted fields → required.

    Pydantic emits `default:` on every defaulted field, including the Literal
    discriminator. jsts then emits `field?:` (optional). Our wire contract
    requires these fields; the renderer's existing TS shape requires them.
    """
    if not isinstance(schema, dict):
        return
    props = schema.get("properties")
    if isinstance(props, dict):
        required = set(schema.get("required", []))
        for name, prop in props.items():
            if not isinstance(prop, dict):
                continue
            # Discriminator literal: `const` field.
            if "const" in prop:
                required.add(name)
            # Optional[X] = None: anyOf with {"type": "null"}.
            if any(isinstance(x, dict) and x.get("type") == "null"
                   for x in prop.get("anyOf", [])):
                required.add(name)
            # Any default-bearing field: wire always sets it.
            if "default" in prop:
                required.add(name)
        if required:
            schema["required"] = sorted(required)
    for key in ("$defs", "definitions"):
        sub = schema.get(key)
        if isinstance(sub, dict):
            for v in sub.values():
                force_required(v)


def emit_schema(model_or_adapter, primary_name: str) -> dict:
    if hasattr(model_or_adapter, "model_json_schema"):
        schema = model_or_adapter.model_json_schema()
    else:
        # WSMessage is an Annotated union; use TypeAdapter
        schema = TypeAdapter(model_or_adapter).json_schema()
    schema["title"] = primary_name
    force_required(schema)
    return schema


def run_jsts(schema_path: Path) -> str:
    """Invoke npx json-schema-to-typescript on a schema file, return TS source."""
    result = subprocess.run(
        ["npx", "--yes", "json-schema-to-typescript", "--input", str(schema_path),
         "--bannerComment", "", "--additionalProperties", "false"],
        capture_output=True, text=True, check=True, cwd=REPO_ROOT,
    )
    return result.stdout


def post_process(ts: str) -> str:
    """Inline hoisted aliases + strip primitive aliases."""
    # Single-string-literal aliases
    alias_re = re.compile(r'^export type (\w+) = ("[^"]+"(?:\s*\|\s*"[^"]+")*);$', re.MULTILINE)
    aliases = {m.group(1): m.group(2) for m in alias_re.finditer(ts)}
    # Primitive aliases
    prim_re = re.compile(
        r'^export type (\w+) = (string|number|boolean|null|number\[\]|string\[\]|boolean\[\]);$',
        re.MULTILINE,
    )
    primitives = {m.group(1): m.group(2) for m in prim_re.finditer(ts)}
    # Inline
    for name, value in {**aliases, **primitives}.items():
        ts = re.sub(rf'\b{re.escape(name)}\b', value, ts)
    # Strip dead aliases
    ts = re.sub(r'^export type [^=]+ = "[^"]+"(?:\s*\|\s*"[^"]+")*;\n?', '', ts, flags=re.MULTILINE)
    ts = re.sub(r'^export type \w+ = (?:string|number|boolean|null|\w+\[\]);\n?', '', ts, flags=re.MULTILINE)
    return ts


def emit_guards(discriminator_mapping: dict[str, str]) -> str:
    lines = ["", "// Type guards (auto-generated from discriminator mapping):"]
    for literal, ref in discriminator_mapping.items():
        variant = ref.rsplit("/", 1)[-1]
        suffix = variant.removesuffix("Message")
        lines.append(
            f"export const is{suffix} = (m: WSMessage): m is {variant} => "
            f"m.type === '{literal}';"
        )
    return "\n".join(lines) + "\n"


def banner(py_source: str) -> str:
    return (
        f"// GENERATED FROM {PY_SOURCE_REL}/{py_source}.py — do not edit;\n"
        f"// run packages/contracts/codegen.sh to regenerate.\n\n"
    )


def main() -> int:
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    TS_DIR.mkdir(parents=True, exist_ok=True)
    for model, ts_name, py_name, primary in TARGETS:
        schema = emit_schema(model, primary)
        schema_path = SCHEMA_DIR / f"{ts_name}.schema.json"
        schema_path.write_text(json.dumps(schema, indent=2, sort_keys=True))
        ts = run_jsts(schema_path)
        ts = post_process(ts)
        # Cross-file dedup (not shown — see Pitfall 3): for ws-message.ts,
        # detect cross-file types and emit `import type` lines.
        # Append guards for WSMessage:
        if primary == "WSMessage":
            mapping = schema.get("discriminator", {}).get("mapping", {})
            ts += emit_guards(mapping)
        out_path = TS_DIR / f"{ts_name}.ts"
        out_path.write_text(banner(py_name) + ts.strip() + "\n")
        print(f"[codegen] wrote {out_path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

### Bash entry-point

```bash
#!/usr/bin/env bash
# packages/contracts/codegen.sh
# Pydantic → JSON Schema → TypeScript codegen entry-point.
# Run from any CWD; resolves paths relative to the script.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Use the sidecar venv's Python (has pydantic + the contracts package installed).
PYTHON="$REPO_ROOT/sidecar/.venv/Scripts/python.exe"
if [ ! -x "$PYTHON" ]; then
  PYTHON="$REPO_ROOT/sidecar/.venv/bin/python"
fi

if [ ! -x "$PYTHON" ]; then
  echo "ERROR: sidecar venv not found. Run 'cd sidecar && uv sync' first." >&2
  exit 1
fi

cd "$REPO_ROOT"
exec "$PYTHON" packages/contracts/scripts/codegen.py "$@"
```

### CI drift check (top-level npm script + manual or GitHub Action)

```json
// package.json (top-level) — additions
{
  "scripts": {
    "codegen:contracts": "bash ./packages/contracts/codegen.sh",
    "check:contracts": "bash ./packages/contracts/codegen.sh && git diff --exit-code packages/contracts/ts/ packages/contracts/generated/"
  },
  "devDependencies": {
    "json-schema-to-typescript": "15.0.4"
  }
}
```

```yaml
# .github/workflows/contracts-drift.yml — OPTIONAL, planner discretion
name: Contracts drift check
on: [push, pull_request]
jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - uses: astral-sh/setup-uv@v3
      - run: npm install
      - run: cd sidecar && uv sync
      - run: npm run check:contracts
```

### `[joy]` token-boundary pytest fixture

```python
# sidecar/tests/test_phase5_token_boundary.py
"""Phase 5 D-09 test 1: adversarial split-bracket robustness at the orchestrator output boundary.

Phase 2 already closed the SC #3 BLOCKER programmatically (per STATE.md: "split-bracket SC #3
BLOCKER closed programmatically"). This test re-asserts the contract at Phase 5's milestone-end
boundary so any regression in actions_extractor or display_processor is caught before ship.
"""
import pytest
from contracts import AudioPayloadMessage

# Reuse the fakes/fixtures from Phase 2's test_actions_extractor.py + test_orchestrator_turn.py.
# Adapt to assert the OUTPUT envelope shape, not the internal pipeline state.

@pytest.mark.asyncio
async def test_split_joy_no_bracket_in_display_text():
    """Inject [joy] split as ['[', 'jo', 'y]'] across token deltas.
    Assert: AudioPayloadMessage.display_text.text contains no '[' or ']' character.
    """
    # ... orchestrator wiring with FakeLLMStream injecting splits ...
    # Assert envelope.display_text.text matches r'^[^\[\]]*$'
    # Assert envelope.actions has one ActionIntent(kind="expression", name="joy")
    pass

@pytest.mark.asyncio
async def test_split_holdmic_no_bracket_in_display_text():
    """[hold-mic] split as ['[hold', '-', 'mic]']."""
    pass
```

### Verify-skeleton.sh orchestrator skeleton

```bash
#!/usr/bin/env bash
# scripts/verify-skeleton.sh
# Phase 5 D-08: auto-runnable subset of the §14 verification.
# Operator runs this, then drives the four visible-SC clip recordings manually.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PYTHON="$REPO_ROOT/sidecar/.venv/Scripts/python.exe"
[ -x "$PYTHON" ] || PYTHON="$REPO_ROOT/sidecar/.venv/bin/python"

echo "## §A summary (paste into skeleton-verification.md)"
echo
echo "### Auto-runnable §14 SC checks"
echo

# SC-02 codegen drift check
echo "#### SC-02: Codegen drift"
if npm run check:contracts > /tmp/codegen-drift.log 2>&1; then
  echo "PASS — codegen.sh executes cleanly + committed TS matches output."
else
  echo "FAIL — see /tmp/codegen-drift.log"
fi

# §14 SC#6: OLVT protocol-shape parity
echo
echo "#### §14 SC#6: WS protocol matches OLVT shape"
if "$PYTHON" scripts/verify/olvt_protocol_diff.py > /tmp/olvt-diff.log 2>&1; then
  echo "PASS — see /tmp/olvt-diff.log"
  cat /tmp/olvt-diff.log
else
  echo "FAIL — see /tmp/olvt-diff.log"
fi

echo
echo "### PITFALLS e2e checks"

# Pitfall 5: token-boundary
echo "#### 1. Adversarial [joy] token-boundary"
if (cd sidecar && "$PYTHON" -m pytest tests/test_phase5_token_boundary.py -v) > /tmp/token-boundary.log 2>&1; then
  echo "PASS"
else
  echo "FAIL — see /tmp/token-boundary.log"
fi

# Pitfall 11: port-collision
echo "#### 4. Port-collision"
if "$PYTHON" scripts/verify/port_collision_test.py > /tmp/port-coll.log 2>&1; then
  echo "PASS"
else
  echo "FAIL — see /tmp/port-coll.log"
fi

echo
echo "### Operator-driven (NOT run by this script)"
echo "- §14 SC#1, SC#2, SC#4, SC#5: record 5–10s clips with Win+G; commit to .planning/skeleton-verification-evidence/05/"
echo "- PITFALLS test 2 (DeepSeek-R1 reasoning smoke): switch LM Studio to compliant reasoning model; run one chat turn; paste output"
echo "- PITFALLS test 3 (VTS auth-reprompt): delete VTS token file; restart sidecar; observe popup; re-grant"
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24+ (existing in `sidecar/pyproject.toml`) |
| Config file | `sidecar/pyproject.toml` `[tool.pytest.ini_options] testpaths = ["tests"]` |
| Quick run command | `cd sidecar && python -m pytest tests/test_phase5_token_boundary.py -v` |
| Full suite command | `cd sidecar && python -m pytest -v` |

For TS-side testing (renderer): existing vitest config in `apps/renderer/vite.config.ts`. Phase 5 adds NO new renderer tests (codegen is a build-time concern).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-01 | Six §14 SCs verified, recorded in skeleton-verification.md | manual-only (operator-driven, video evidence per D-06) | — | ❌ Wave 0 — `.planning/skeleton-verification.md` itself is the test artifact |
| SC-01 | §14 SC#6 (WS protocol matches OLVT) | smoke | `python scripts/verify/olvt_protocol_diff.py` | ❌ Wave 0 — needs `scripts/verify/olvt_protocol_diff.py` |
| SC-01 | PITFALLS test 1: split-bracket | unit | `python -m pytest sidecar/tests/test_phase5_token_boundary.py -v` | ❌ Wave 0 — needs `sidecar/tests/test_phase5_token_boundary.py` |
| SC-01 | PITFALLS test 4: port-collision | smoke | `python scripts/verify/port_collision_test.py` | ❌ Wave 0 — needs the script |
| SC-01 | PITFALLS test 5: OLVT diff | smoke | (same as §14 SC#6 above) | (same) |
| SC-01 | PITFALLS test 2 (reasoning) and test 3 (VTS auth) | manual-only | — | n/a — operator-driven |
| SC-02 | Codegen.sh executes cleanly + drift check | smoke | `npm run check:contracts` (= `bash ./packages/contracts/codegen.sh && git diff --exit-code packages/contracts/ts/ packages/contracts/generated/`) | ❌ Wave 0 — needs `packages/contracts/codegen.sh`, `packages/contracts/scripts/codegen.py`, root `package.json` script |
| SC-02 | Renderer typecheck still passes after regen | smoke | `npm run typecheck:renderer` | ✅ already wired (`apps/renderer/package.json` has `typecheck`) |
| SC-02 | Round-trip shape parity (regenerated TS matches hand-written intent) | unit (eyeball-equivalence + tsc compile) | `cd apps/renderer && npx tsc --noEmit` | ✅ already wired |

### Sampling Rate

- **Per task commit:** `cd sidecar && python -m pytest tests/test_phase5_token_boundary.py -v` (when 05-02 wave touches the token-boundary test); `npm run check:contracts` (when 05-01 touches codegen).
- **Per wave merge:** `cd sidecar && python -m pytest -v` (full sidecar suite — confirms no regression in Phase 1–4 tests) + `npm run typecheck:renderer` + `npm run check:contracts`.
- **Phase gate (before `/gsd:verify-work`):** Full suite green + every §14 SC has a verdict in `.planning/skeleton-verification.md` + every PITFALLS e2e has a verdict in §B + body-sway report present in §C + README has Quickstart Demo section + fresh-clone test executed and recorded.

### Wave 0 Gaps

Phase 5 is largely greenfield in test infrastructure (verification scripts don't exist yet). Wave 0 gaps:

- [ ] `packages/contracts/scripts/codegen.py` — the wrapper script (covers SC-02). New file.
- [ ] `packages/contracts/codegen.sh` — bash entry-point (covers SC-02). New file.
- [ ] Root `package.json` — add `json-schema-to-typescript@15.0.4` devDep + `codegen:contracts` and `check:contracts` scripts (covers SC-02). Edit.
- [ ] `sidecar/tests/test_phase5_token_boundary.py` — split-bracket adversarial test (covers PITFALLS test 1). New file.
- [ ] `scripts/verify/olvt_protocol_diff.py` — OLVT protocol-shape diff script (covers PITFALLS test 5 + §14 SC#6). New file.
- [ ] `scripts/verify/port_collision_test.py` — port-collision smoke (covers PITFALLS test 4). New file.
- [ ] `scripts/verify/reasoning_smoke.py` — optional helper for PITFALLS test 2 (operator runs an LLM turn; the script could be a one-liner that prints "switch LM Studio to a reasoning model and run a chat turn; this script does nothing automatically"). New file (low-priority).
- [ ] `scripts/verify-skeleton.sh` — orchestrator (covers D-08). New file.
- [ ] `.planning/skeleton-verification.md` — the handoff doc (covers SC-01). New file.
- [ ] `.planning/skeleton-verification-evidence/05/` — directory for clips. New dir + add to `.gitattributes` for LFS:
  ```
  .planning/skeleton-verification-evidence/**/*.mp4 filter=lfs diff=lfs merge=lfs -text
  ```
- [ ] README — extend with "## Quickstart Demo" section (covers D-12). Edit.
- [ ] `packages/contracts/generated/json-schema/` — output dir for committed JSON Schema files (per Claude's-discretion default, "committed"). Auto-created by codegen.py.

**No new framework install needed** — pytest, pytest-asyncio, vitest, npm, uv all already wired.

## Sources

### Primary (HIGH confidence)

- **Live execution against our own contracts** (2026-05-07):
  - `python -c "from contracts.ws_message import WSMessage; ..."` — verified Pydantic 2.12.5's actual JSON Schema output shape (oneOf + discriminator with mapping + $defs).
  - `npm install json-schema-to-typescript@15.0.4 && node convert.cjs` — verified jsts's actual output: optional discriminator, hoisted literal aliases, `?:` + `null` for Optional.
  - `npm view json-schema-to-typescript version time` — 15.0.4 published 2025-01-14, confirmed latest.
  - `python -c "import pydantic; print(pydantic.VERSION)"` — 2.12.5.
- **CONTEXT.md** at `.planning/phases/05-polish-contracts-codegen-14-verification/05-CONTEXT.md` — D-01 through D-13 locked decisions + Claude's Discretion list.
- **REQUIREMENTS.md** at `.planning/REQUIREMENTS.md` — SC-01, SC-02 verbatim.
- **PROJECT_DESIGN.md §14** at `PROJECT_DESIGN.md:1572-1581` — six success criteria verbatim.
- **PROJECT_DESIGN.md §13** at `PROJECT_DESIGN.md:13xx` — locked stack + version pins.
- **CLAUDE.md** at `./CLAUDE.md` — codegen tool preference (hand-rolled), npm-not-pnpm, uv-not-pip, version pins.
- **PITFALLS.md** at `.planning/research/PITFALLS.md` — Pitfall 5 (token-boundary), 6 (DeepSeek-R1), 10 (VTS auth-reprompt), 11 (port-collision); "Looks Done But Isn't" checklist at lines 522-538.
- **OLVT source** at `C:/Users/16079/Code/OpenLLM_Vtuber/src/open_llm_vtuber/websocket_handler.py:76-98` (handler dict) and `:239` (`_route_message` definition) — verified path differs from CONTEXT.md D-09 wording (no `/server/` segment).
- **Existing TS contracts** at `packages/contracts/ts/{ws-message,audio-payload,action-intent,speech-envelope,param-frame,discrete-event}.ts` — hand-written shape that codegen must match.
- **Existing Pydantic contracts** at `packages/contracts/py/contracts/{ws_message,audio_payload,action_intent,speech_envelope,param_frame,discrete_event}.py` — source-of-truth.
- **Renderer wiring** at `apps/renderer/vite.config.ts:14`, `apps/renderer/tsconfig.json:32` — `@contracts/*` alias unchanged target.
- **`avatars/teto/teto_overrides.yaml`** — Phase 4 04-00 deliverable (verified populated; `body_sway_strategy: head_only`); Phase 5 verification reads it.
- **`sidecar/pyproject.toml`** — pytest, pytest-asyncio versions; uv-managed venv layout.
- **`package.json`** at root — npm workspaces (`apps/*`, `packages/*`); engines `node>=22.0.0`, `npm>=10.0.0`.

### Secondary (MEDIUM confidence — multiple sources verified)

- [Pydantic v2 Unions docs](https://docs.pydantic.dev/latest/concepts/unions/#discriminated-unions) — confirms `discriminator` + `oneOf` + `mapping` JSON Schema emission per OpenAPI spec. (URL redirected; secondary fetch failed; primary signal is our own live `model_json_schema()` output which IS authoritative.)
- [json-schema-to-typescript GitHub README](https://github.com/bcherny/json-schema-to-typescript) — list of supported keywords; confirms `oneOf` is "treated like anyOf"; confirms `additionalProperties: false` is supported via options.
- [json-schema-to-typescript issue #239](https://github.com/bcherny/json-schema-to-typescript/issues/239) — confirms OpenAPI discriminator support is open feature request (since 2019, unimplemented). Our schema-mutation workaround is the documented community pattern.
- [LFS docs (git-lfs.github.com)](https://git-lfs.github.com/) — used to confirm `.gitattributes` extension for `*.mp4` LFS-tracking pattern.

### Tertiary (LOW confidence — flagged for validation)

- Game Bar (`Win+G`) clip-capture quality and reliability for VTS — based on Microsoft's documented "treat as game" toggle but actual behavior is rig-dependent. Operator should test before relying on it; OBS Studio is the documented fallback.
- "Same Windows account fresh-clone gives DPAPI false-positive" (Pitfall 7) — inferred from `electron-store` keying behavior; not independently verified. Recommendation to wipe `%APPDATA%/AgenticLLMVTuber/` is conservative.
- Cross-file dedup pass complexity (Pitfall 3) — outlined but not empirically validated against our specific cross-file imports. The wrapper implementation may need iteration during 05-01 execution.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every version verified live against npm registry and our installed tools on 2026-05-07.
- Codegen mechanics: **HIGH** — empirically tested with our actual contracts; the two material problems (optional discriminator, hoisted aliases) and their fixes are confirmed via live tool invocation.
- Architecture patterns: **HIGH** — derived from CONTEXT.md locked decisions; no inferred shape.
- Verification pipeline: **MEDIUM** — pattern is sound, but the specific scripts (`olvt_protocol_diff.py`, `port_collision_test.py`) are documented as scaffolding only; actual implementation may surface edge cases.
- Pitfalls: **HIGH** on items 1–5 (every fix is empirically verified or directly cited from PITFALLS.md); **MEDIUM** on items 6–9 (real but rig/environment-specific).
- Code examples: **HIGH** — wrapper script skeleton was assembled by translating the verified live-test logic into Python; planner can use as a strong starting point with confidence the round-trip works.

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 estimate (jsts is on a slow release cadence — last release 2025-01-14; Pydantic 2.x is stable; our contracts are stable). Re-check the json-schema-to-typescript GitHub for any 16.x release before kicking off codegen if planning slips into June.
