"""Phase 1: end-to-end boot test — spawn sidecar, parse READY line, hit /health."""

import asyncio
import os
import re
import subprocess
import sys
import time

import httpx
import pytest

READY_RE = re.compile(r"^\[READY\] ws://127\.0\.0\.1:(\d+)/ws$")


@pytest.mark.asyncio
async def test_sidecar_boots_and_emits_ready_line():
    """Spawn the sidecar as a subprocess and confirm it emits the READY line
    within 10 seconds, then responds to GET /health on the bound port.
    """
    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    proc = subprocess.Popen(
        [sys.executable, "-m", "sidecar"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
    )
    try:
        port = None
        deadline = time.monotonic() + 15.0
        while time.monotonic() < deadline:
            line = proc.stdout.readline() if proc.stdout else ""
            if not line:
                if proc.poll() is not None:
                    stderr = proc.stderr.read() if proc.stderr else ""
                    pytest.fail(f"Sidecar exited before READY: stderr={stderr!r}")
                await asyncio.sleep(0.05)
                continue
            m = READY_RE.match(line.strip())
            if m:
                port = int(m.group(1))
                break

        assert port is not None, "Sidecar did not emit [READY] within 15s"

        # Confirm /health responds. Give uvicorn a brief moment to enter accept loop.
        await asyncio.sleep(0.1)
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://127.0.0.1:{port}/health")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok"}
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()
