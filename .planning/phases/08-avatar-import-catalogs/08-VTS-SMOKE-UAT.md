---
phase: 08-avatar-import-catalogs
evidence: vts-introspection-smoke
status: blocked-auth
date: "2026-05-08"
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

## BLOCKED-AUTH Evidence

VTube Studio was available, but authentication failed because the existing token was invalid or revoked. The smoke now fails fast before HotkeyList, which confirms the 08-05 auth-handling fix. A successful VTS introspection rerun still requires the token reset below.

- status: blocked-auth
- date/time attempted: 2026-05-08
- attempted command: `cd sidecar && uv run python scripts/vts_introspect_smoke.py`
- exit code `2`
- output:

```text
warning: The `tool.uv.dev-dependencies` field (used in `pyproject.toml`) is deprecated and will be removed in a future release; use `dependency-groups.dev` instead
None
{'apiName': 'VTubeStudioPublicAPI', 'apiVersion': '1.0', 'timestamp': 1778239631418, 'messageType': 'AuthenticationResponse', 'requestID': 'SomeID', 'data': {'authenticated': False, 'reason': 'Authentication request failed because token is invalid or has been revoked by the user.'}}
[SMOKE] FAIL: VTube Studio authentication failed. Close the app/smoke, delete the token file C:\Users\16079\Code\AgenticLLMVTuber\sidecar\.vts_token.txt, open VTube Studio settings > Plugins, remove/revoke the stale AgenticLLMVTuber plugin entry if present, rerun the smoke/app, and approve the VTS plugin permission prompt.
```

- reason: stale/revoked VTube Studio plugin token for `AgenticLLMVTuber`; reset and re-approval are required before a PASS run can exercise HotkeyList.

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
