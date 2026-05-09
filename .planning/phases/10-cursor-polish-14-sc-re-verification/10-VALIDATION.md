---
phase: 10
slug: cursor-polish-14-sc-re-verification
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by gsd-planner.

---

## Test Infrastructure

(filled by planner — pytest for cursor regression + harness replay; markdown deliverable for ceremony record)

---

## Sampling Rate

- **After every task commit:** Run the task's `<verify><automated>` command.
- **After every plan wave:** Run all tests created in completed plans of that wave.
- **Before `/gsd:verify-work`:** Full sidecar suite + harness replay + ARCH-06 grep gate.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

(to be filled by gsd-planner)

---

## Wave 0 Requirements

(planner fills — likely "existing infrastructure covers all phase requirements" since pytest + plumbing_harness.py both exist)

---

## Manual-Only Verifications

(planner fills — at minimum: §14 ceremony script execution by operator covering SC #2 [smirk] + SC #4 body sway + SC #5 cursor visual confirmation)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are checkpoint-typed (cursor regression test + harness replay run automatically; ceremony is checkpoint:human-verify)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all required test infrastructure
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
