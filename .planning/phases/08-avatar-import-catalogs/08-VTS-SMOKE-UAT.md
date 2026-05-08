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

## FAIL Evidence

Use this when VTube Studio is available but the introspection shape does not match.

Record:

- status: fail
- attempted command: `cd sidecar && uv run python scripts/vts_introspect_smoke.py`
- exit code `2`
- full mismatch output:
- pyvts vendor patch needed:
