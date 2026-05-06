"""Phase 1 PLUMB-04: /admin/llm-test SSE endpoint exception mapping.

Tests use httpx against a live sidecar subprocess. The full integration
(against a real LM Studio) is verified manually per CONTEXT.md "Specifics" section.
"""

import asyncio
import os
import re
import subprocess
import sys
import time

import httpx
import pytest

READY_RE = re.compile(r"^\[READY\] ws://127\.0\.0\.1:(\d+)/ws$")


async def _spawn_and_wait_ready(timeout: float = 15.0):
    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    proc = subprocess.Popen(
        [sys.executable, "-m", "sidecar"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
    )
    deadline = time.monotonic() + timeout
    port = None
    while time.monotonic() < deadline:
        line = proc.stdout.readline()
        if not line:
            if proc.poll() is not None:
                raise RuntimeError(f"sidecar exited; stderr={proc.stderr.read()!r}")
            await asyncio.sleep(0.05)
            continue
        m = READY_RE.match(line.strip())
        if m:
            port = int(m.group(1))
            break
    if port is None:
        proc.kill()
        raise TimeoutError("READY not seen")
    return proc, port


@pytest.mark.asyncio
async def test_admin_llm_test_endpoint_exists():
    """The /admin/llm-test route is registered and accepts POST."""
    proc, port = await _spawn_and_wait_ready()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Hit a non-existent endpoint URL -> expect APIConnectionError flow.
            # The endpoint won't crash; it streams an error message.
            async with client.stream(
                "POST",
                f"http://127.0.0.1:{port}/admin/llm-test",
                json={
                    "provider": "lm_studio",
                    "endpoint_url": "http://127.0.0.1:1",  # unreachable
                    "api_key": "",
                    "model_name": "",
                },
            ) as resp:
                assert resp.status_code == 200
                body = b""
                async for chunk in resp.aiter_bytes():
                    body += chunk
                text = body.decode("utf-8")
                # Either the httpx pre-flight or the LiteLLM call surfaces a
                # connection error. Both produce the "Make sure" guidance.
                assert (
                    "Make sure:" in text
                    or "doesn't seem to be running" in text
                    or "Connection refused" in text
                ), f"unexpected SSE body: {text!r}"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.mark.asyncio
async def test_admin_llm_test_request_validation():
    """Pydantic validation rejects malformed bodies."""
    proc, port = await _spawn_and_wait_ready()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"http://127.0.0.1:{port}/admin/llm-test",
                json={"endpoint_url": "http://x"},  # missing required `provider`
            )
            assert resp.status_code == 422  # FastAPI's pydantic validation error
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()
