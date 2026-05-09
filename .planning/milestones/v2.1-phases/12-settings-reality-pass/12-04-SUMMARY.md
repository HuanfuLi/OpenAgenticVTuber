---
phase: 12-settings-reality-pass
plan: 04
status: complete
completed_at: 2026-05-09T08:22:55-04:00
gap_closure: true
requirements:
  - SET-01
  - SET-02
---

# 12-04 Summary: Avatar Warning Copy Clarification

## Outcome

Closed the remaining Phase 12 wording gap. The known-ID degraded avatar message now explains that the avatar ID is known, but the saved editable catalog has not loaded yet.

The copy no longer uses the phrase `Catalog metadata is unavailable`.

## Changes

- Updated `COPY.SETTINGS.AVATARS_DEGRADED` in `apps/renderer/src/lib/copy.ts`.
- Updated `COPY.SETTINGS.AVATARS_DEGRADED_UNKNOWN` to use the same plain-language "saved editable catalog" terminology.
- Added a Settings regression that asserts the old confusing phrase is not rendered.

## Verification

Passed:

```powershell
npm --workspace apps/renderer run test -- Settings.test.tsx AppStoreStatus.test.tsx StatusIcon.test.tsx
npm --workspace apps/renderer run typecheck
```

## Commit Status

The code and docs are ready, but commits are currently blocked by unrelated unmerged files in `.planning/ROADMAP.md` and `.planning/STATE.md`.
