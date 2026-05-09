---
phase: 06-plugin-runtime-default-plugin
status: complete
created: 2026-05-08
completed: 2026-05-09
completion_evidence: 06-VERIFICATION.md re_verification_3 (status: passed) + 06-08 closure
---

# Phase 06 UAT

Manual operator checks for `$gsd-verify-work 6`. **All tests passed via the live
VTube Studio verification ceremony recorded in `06-VERIFICATION.md`
re_verification_3 (2026-05-08T18:35).** This file is preserved for traceability;
see `06-HUMAN-UAT.md` for per-test reporter quotes and resolution evidence.

## Tests

### 1. Active plugin swap

status: pass

expected:
- Start the app with `AGENTICLLMVTUBER_ACTIVE_PLUGIN=default`.
- Confirm sidecar logs `[PLUGIN] loaded name=default version=1.0.0`.
- Switch to a test plugin or invalid plugin, restart, and confirm null fallback
  or visibly different motion.

resolution:
- Settings now exposes a Body motion plugin radio group backed by persisted
  `StoredConfig.plugin.activePluginName`; Electron sidecar spawn passes
  `AGENTICLLMVTUBER_ACTIVE_PLUGIN` and `AGENTICLLMVTUBER_USER_DATA` and restarts
  sidecar on selection save.
- Operator confirmed plugin selection round-trip in re_verification_3.

### 2. Default plugin action ramp (formerly `[joy]`)

status: pass

note: 06-08 removed `[joy]` from the active Teto vocabulary because the
imported `_avatar_overrides.yaml` does not declare a `joy` variant/expression.
Pick any code currently in `plugins/default/plugin.yaml` (`anger / disgust /
fear / neutral / sadness / smirk / surprise`) for retest.

expected:
- Force a reply containing one of the in-manifest action codes (e.g. `[smirk]`).
- Confirm there is no `[VTS-REQUEST-ERROR]` flood and no expression activation log.
- Confirm visible head, eye, and face motion ramp-in and decay.

resolution:
- 06-08 confirmed the default plugin emits ramp params for in-manifest codes
  and ignores out-of-vocabulary codes (including direct or split-token `[joy]`)
  silently with no nonzero ParamFrame.
- Phase 7 owns model-owned variant dispatch (`{heart-eye}`, etc.); not in scope
  for Phase 6 UAT.

### 3. Speech motion

status: pass

expected:
- Send a 30s utterance.
- Confirm mouth movement still tracks speech and head/body motion is non-flat.

resolution:
- 06-07 consolidated lipsync into the single PyvtsSafeWriter; follow-on
  commits 946abd7 (head_only lateral sway) + 4e2ff12 (preserve VTS tracking
  input ranges) restored multi-axis body sway.
- Operator UAT in re_verification_3 confirmed lipsync + body sway live.
