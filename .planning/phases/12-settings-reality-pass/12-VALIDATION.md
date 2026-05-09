---
phase: 12
slug: settings-reality-pass
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
updated: 2026-05-09T07:30:16-04:00
source_state: reconstructed-from-summary
---

# Phase 12 - Validation Strategy

> Retroactive Nyquist validation contract for Phase 12 Settings Reality Pass.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 with React Testing Library; pytest 8 via sidecar uv environment |
| **Config file** | `apps/renderer/vite.config.ts`; `sidecar/pyproject.toml` |
| **Quick run command** | `npm --workspace apps/renderer run test -- Settings.test.tsx` |
| **Full suite command** | `npm --workspace apps/renderer run test -- Settings.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx` |
| **Sidecar support command** | `uv run python -m pytest tests/admin/test_status_endpoint.py tests/avatar/test_admin_avatar.py -q` from `sidecar/` |
| **Estimated runtime** | ~12 seconds combined focused checks |

---

## Sampling Rate

- **After every task commit:** Run `npm --workspace apps/renderer run test -- Settings.test.tsx` for Settings-facing changes; run `npm --workspace apps/renderer run typecheck` for preload/API type changes.
- **After every plan wave:** Run `npm --workspace apps/renderer run test -- Settings.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx`.
- **Before `$gsd-verify-work`:** Focused renderer suite, renderer typecheck, and sidecar status/avatar endpoint tests must be green.
- **Max feedback latency:** ~12 seconds for focused automated checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | SET-01 | - | Renderer reads current avatar through typed bridge and never reads Electron store internals directly. | typecheck/unit | `npm --workspace apps/renderer run typecheck`; `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-01 | 01 | 1 | SET-03 | - | Renderer invokes high-level VTS reset/restart APIs; token file path stays main-process only. | unit/integration | `npm --workspace apps/renderer run test -- Settings.test.tsx`; `uv run python -m pytest tests/admin/test_status_endpoint.py tests/avatar/test_admin_avatar.py -q` | yes | green |
| 12-01-01 | 01 | 1 | SET-06 | - | Log level accepts only `error/warn/info/debug` and persists through Electron main. | typecheck/unit | `npm --workspace apps/renderer run typecheck`; `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-02 | 01 | 1 | SET-01 | - | Avatars section shows active avatar identity and routes to existing Avatar Import review/import flows. | unit | `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-02 | 01 | 1 | SET-02 | - | Current catalog metadata shows counts when available; unavailable metadata degrades without hardcoding Teto. | unit | `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-02 | 01 | 1 | SET-03 | - | VTube Studio section mirrors live status and keeps troubleshooting actions behind disclosure. | unit | `npm --workspace apps/renderer run test -- Settings.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx` | yes | green |
| 12-01-02 | 01 | 1 | SET-04 | - | Conversation Settings states single in-memory thread/reset-on-relaunch and exposes no saved-history controls. | unit | `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-02 | 01 | 1 | SET-05 | - | Memory Settings is visible, disabled, and explicitly deferred to v4.0 agentic system plus memory. | unit | `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-02 | 01 | 1 | SET-06 | - | Diagnostics log-level select is enabled and saves through the bridge; no milestone-2 copy remains. | unit | `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-02 | 01 | 1 | SET-07 | - | Settings copy names v3.0 for STT/TTS and v4.0 for agentic/memory scope. | unit/copy regression | `npm --workspace apps/renderer run test -- Settings.test.tsx` | yes | green |
| 12-01-03 | 01 | 1 | SET-01..SET-07 | - | Regression suite covers all Phase 12 Settings reality requirements and status-popover compatibility. | unit/typecheck/endpoint | `npm --workspace apps/renderer run test -- Settings.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx`; `npm --workspace apps/renderer run typecheck`; sidecar pytest command | yes | green |

*Status: pending / green / red / flaky*

---

## Requirement Coverage

| Requirement | Coverage | Primary Test Evidence |
|-------------|----------|-----------------------|
| SET-01 | COVERED | `renders one combined Avatars section with current catalog counts and actions`; `routes Edit current to Avatar Import with the current avatar plan loaded`; `routes Import/replace to Avatar Import without carrying the current plan` |
| SET-02 | COVERED | `shows degraded avatar state without assuming Teto when metadata is unavailable` |
| SET-03 | COVERED | `renders compact VTube Studio status and troubleshooting actions`; `maps VTS status from the runtime API into renderer status state`; `refreshes through real status APIs instead of simulating success` |
| SET-04 | COVERED | `renders Conversation as truth-only and Memory as disabled v4.0 scope` |
| SET-05 | COVERED | `renders Conversation as truth-only and Memory as disabled v4.0 scope` |
| SET-06 | COVERED | `persists diagnostics log level and removes targeted stale milestone-2 copy` |
| SET-07 | COVERED | `renders Phase 3 TTS as active, not a milestone placeholder`; `persists diagnostics log level and removes targeted stale milestone-2 copy`; Memory v4.0 assertion |

---

## Wave 0 Requirements

Existing infrastructure covers all Phase 12 requirements.

---

## Manual-Only Verifications

All Phase 12 behaviors have automated verification.

---

## Validation Audit 2026-05-09

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

### Gap Closed

- **SET-01 Avatar action routing:** Existing tests showed both buttons but did not prove routing behavior. Added tests that verify `Edit current` switches to `avatar-import` with the active `AvatarImportPlan`, and `Import/replace` switches to `avatar-import` without stale current-plan state.

### Commands Run

- `npm --workspace apps/renderer run test -- Settings.test.tsx` - passed, 15 tests.
- `npm --workspace apps/renderer run test -- Settings.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx` - passed, 20 tests.
- `npm --workspace apps/renderer run typecheck` - passed.
- `uv run python -m pytest tests/admin/test_status_endpoint.py tests/avatar/test_admin_avatar.py -q` from `sidecar/` - passed, 12 tests, 1 existing FastAPI collection warning.

---

## Validation Sign-Off

- [x] All tasks have automated verification.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency under 15 seconds for focused checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-05-09
