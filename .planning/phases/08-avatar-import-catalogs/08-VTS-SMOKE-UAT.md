---
phase: 08-avatar-import-catalogs
evidence: vts-introspection-smoke
status: pending
date: ""
operator: ""
---

# VTS Introspection Smoke UAT

## Command

Run:

```powershell
cd sidecar
uv run python scripts/vts_introspect_smoke.py
```

Equivalent one-line command: `cd sidecar && uv run python scripts/vts_introspect_smoke.py`

## PASS Evidence

Record:

- status: pass
- attempted command: `cd sidecar && uv run python scripts/vts_introspect_smoke.py`
- exit code `0`
- output containing `[SMOKE] PASS: pyvts 0.3.3 + VTS API "1.0" introspection shape verified`

## BLOCKED Evidence

Use this only when VTube Studio with Teto is unavailable.

Record:

- status: blocked
- date/time attempted:
- attempted command: `cd sidecar && uv run python scripts/vts_introspect_smoke.py`
- exit code `3`
- output containing `Is VTube Studio running?`
- reason:

## Authentication Reset

If the smoke exits `2` with `VTube Studio authentication failed`, reset the stale token before recording final evidence:

- close the app/smoke
- delete the token file `sidecar/.vts_token.txt`
- open VTube Studio settings > Plugins
- remove/revoke the stale AgenticLLMVTuber plugin entry if present
- rerun `cd sidecar && uv run python scripts/vts_introspect_smoke.py`
- approve the VTS plugin permission prompt

## FAIL Evidence

Use this when VTube Studio is available but the introspection shape does not match.

Record:

- status: fail
- attempted command: `cd sidecar && uv run python scripts/vts_introspect_smoke.py`
- exit code `2`
- full mismatch output:
- pyvts vendor patch needed:
