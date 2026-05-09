---
phase: 9
slug: slider-hud-per-param-lock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (sidecar) + vitest (renderer) + npm contract check |
| **Config file** | `sidecar/pyproject.toml`, `apps/renderer/package.json`, `package.json` |
| **Quick run command** | (filled by planner per task) |
| **Full suite command** | (filled by planner) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command.
- **After every plan wave:** Run all tests created in completed plans of that wave.
- **Before `/gsd:verify-work`:** Run the full suite plus `npm run check:contracts`.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

(to be filled by gsd-planner during step 8)

---

## Wave 0 Requirements

(to be filled by gsd-planner — likely "existing infrastructure covers all phase requirements" since pytest/vitest/codegen are all already installed)

---

## Manual-Only Verifications

(to be filled by gsd-planner — at minimum: live VTS visual UAT confirming HUD slider drag → lock holds against `{variant}` activation; lock release → param resumes; avatar re-import → toast)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
