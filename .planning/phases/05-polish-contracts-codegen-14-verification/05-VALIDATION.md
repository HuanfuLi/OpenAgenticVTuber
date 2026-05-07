---
phase: 5
slug: polish-contracts-codegen-14-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (Python contracts + verification scripts) + node (TS compile-check via `tsc --noEmit`) |
| **Config file** | `pyproject.toml` (pytest config), `apps/renderer/tsconfig.json` (TS check) |
| **Quick run command** | `uv run pytest packages/contracts/tests/ -x` (~5s) |
| **Full suite command** | `bash scripts/verify-skeleton.sh` (~3-5min including manual SC clip review) |
| **Estimated runtime** | Auto subset: ~30s. Full incl. operator-driven visible SCs: ~10-15min. |

---

## Sampling Rate

- **After every task commit:** Run `uv run pytest packages/contracts/tests/ -x` (codegen tests) OR `bash scripts/verify-skeleton.sh --auto-only` (verification tests)
- **After every plan wave:** Run full `bash scripts/verify-skeleton.sh` including operator-driven visible SCs
- **Before `/gsd:verify-work`:** Full suite must be green; all six §14 SCs recorded in skeleton-verification.md with PASS/PARTIAL/FAIL verdicts
- **Max feedback latency:** ~30s for auto subset; visible-SC clips are reviewed once per phase

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SC-02 | integration | `bash packages/contracts/codegen.sh && git diff --exit-code packages/contracts/ts/` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | SC-02 | unit | `uv run pytest packages/contracts/tests/test_codegen_schema_mutation.py` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | SC-02 | type-check | `cd apps/renderer && npx tsc --noEmit` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | SC-01 | scripted | `bash scripts/verify-skeleton.sh --auto-only` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | SC-01 | manual | Operator reviews 4 visible-SC clips per skeleton-verification.md §A | n/a | ⬜ pending |
| 05-02-03 | 02 | 2 | SC-01 | adversarial | `uv run pytest tests/pitfalls/test_token_boundary.py tests/pitfalls/test_deepseek_reasoning.py tests/pitfalls/test_vts_auth_reprompt.py tests/pitfalls/test_port_collision.py` | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 2 | SC-01 | scripted-diff | `python scripts/olvt_protocol_diff.py > .planning/skeleton-verification-evidence/05/olvt-diff.txt` | ❌ W0 | ⬜ pending |
| 05-02-05 | 02 | 2 | SC-01 | clean-clone | `bash scripts/verify-skeleton.sh --fresh-clone` (operator runs in fresh checkout) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/contracts/tests/test_codegen_schema_mutation.py` — verify the schema-mutation rule produces parity with current TS (asserts `type` field is in `required` after mutation)
- [ ] `packages/contracts/tests/test_codegen_drift.py` — verify `codegen.sh` is idempotent (run twice, no diff)
- [ ] `tests/pitfalls/test_token_boundary.py` — adversarial split-bracket test (Pitfall 5)
- [ ] `tests/pitfalls/test_deepseek_reasoning.py` — `<think>` tag stripping (Pitfall 6)
- [ ] `tests/pitfalls/test_vts_auth_reprompt.py` — VTS auth-token-rotation behavior (Pitfall 10)
- [ ] `tests/pitfalls/test_port_collision.py` — port:0 robustness when 12393 is bound
- [ ] `tests/conftest.py` — shared fixtures (mock LLM stream, mock VTS WS endpoint)
- [ ] `scripts/verify-skeleton.sh` — orchestrator (Bash; runs auto subset by default; `--fresh-clone` and `--auto-only` flags)
- [ ] `scripts/olvt_protocol_diff.py` — emits the protocol-diff artifact for skeleton-verification.md §B
- [ ] `packages/contracts/codegen.sh` — bash entry point invoking the Python wrapper + json-schema-to-typescript

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Idle micro-motion (§14 SC-1) | SC-01 | Visual; rendered by VTS | Boot fresh app, observe Teto for 30s with no input. Record 5-10s clip. Verify subtle ambient sway/breath. |
| `[joy]` 300ms smooth blend (§14 SC-2) | SC-01 | Visual; observable on Teto rig | Send "tell me a joke!" prompt, await `[joy]` action, record 5-10s clip showing smooth fade-in/fade-out. |
| Speech-driven body/head sway (§14 SC-3) | SC-01 | Visual + audible; OBS clip with audio | Trigger 10s+ utterance, record clip showing body/head movement synchronized to RMS envelope. PARTIAL acceptable for AVT-06 head-only allowance. |
| Cursor-in-canvas eye/head tracking (§14 SC-4) | SC-01 | Visual; observable on Teto | Move cursor across canvas in 4 directions, record clip showing eye and head follow. |
| Synced lipsync (§14 SC-5) | SC-01 | Audio+visual sync | 10s utterance with mouth-on-syllable correlation. Record clip; visually verify mouth opens with audio peaks. |
| README Quickstart end-to-end (§14 SC-6) | SC-01 | Real fresh-clone test | Clone repo to fresh dir, follow README "Quickstart Demo" verbatim, verify all six §14 SCs reproduce. Record session timing. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for auto subset
- [ ] `nyquist_compliant: true` set in frontmatter (after planner verifies above)

**Approval:** pending
