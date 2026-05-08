---
phase: 06-plugin-runtime-default-plugin
status: pending
created: 2026-05-08
---

# Phase 06 UAT

Manual operator checks for `$gsd-verify-work 6`. All tests are pending until the
live VTube Studio verification ceremony.

## Tests

### 1. Active plugin swap

status: pending

expected:
- Start the app with `AGENTICLLMVTUBER_ACTIVE_PLUGIN=default`.
- Confirm sidecar logs `[PLUGIN] loaded name=default version=1.0.0`.
- Switch to a test plugin or invalid plugin, restart, and confirm null fallback
  or visibly different motion.

### 2. [joy] default plugin action

status: pending

expected:
- Force a reply containing `[joy]`.
- Confirm there is no `[VTS-REQUEST-ERROR]` flood and no expression activation log.
- Confirm visible head, eye, and face motion ramp-in and decay.

### 3. Speech motion

status: pending

expected:
- Send a 30s utterance.
- Confirm mouth movement still tracks speech and head/body motion is non-flat.
