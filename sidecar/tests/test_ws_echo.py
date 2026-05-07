"""Phase 1 PLUMB-03: WS envelope round-trip works.

Phase 2 supersedes the echo body with Orchestrator.turn -- these tests are
preserved as `@pytest.mark.skip` to keep the historical envelope-shape
intent visible. See `test_handle_text_input_drives_orchestrator_turn_when_configured`
in `test_orchestrator_turn.py` (Task 3) for the replacement coverage.
"""

import asyncio
import json
import os
import re
import subprocess
import sys
import time

import pytest
import websockets

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


@pytest.mark.skip(
    reason="Phase 2 replaces echo with Orchestrator.turn -- see "
    "test_handle_text_input_drives_orchestrator_turn_when_configured "
    "in test_orchestrator_turn.py."
)
@pytest.mark.asyncio
async def test_text_input_echoes():
    proc, port = await _spawn_and_wait_ready()
    try:
        async with websockets.connect(f"ws://127.0.0.1:{port}/ws") as ws:
            await ws.send(json.dumps({"type": "text-input", "text": "hello"}))
            reply = json.loads(await asyncio.wait_for(ws.recv(), timeout=5.0))
            assert reply == {"type": "display-text", "text": "echo: hello"}
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.mark.asyncio
async def test_unknown_type_silently_dropped():
    """Phase 2: still asserts unknown-type dispatcher is silent. Sends a
    text-input with no LLM config so the reply is the config-error envelope
    (Phase 2 replacement for the echo path)."""
    proc, port = await _spawn_and_wait_ready()
    try:
        async with websockets.connect(f"ws://127.0.0.1:{port}/ws") as ws:
            await ws.send(json.dumps({"type": "this-doesnt-exist"}))
            # Send a valid one after -- if the unknown one closed the conn, this fails
            await ws.send(json.dumps({"type": "text-input", "text": "still alive"}))
            reply = json.loads(await asyncio.wait_for(ws.recv(), timeout=5.0))
            # Without env var, app.state.orchestrator is None and we get an
            # error envelope (Phase 2 replacement for the echo).
            assert reply["type"] == "error"
            assert "Sidecar started without LLM configuration" in reply["message"]
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.mark.asyncio
async def test_envelope_with_extra_fields_passes_through():
    """OLVT envelope is `flat fields with required type`, NOT a wrapped {type,payload}.
    Extra fields (e.g., future history_uid) must not break dispatch.

    Phase 2: text-input with no LLM config still receives the config-error
    envelope (replaces Phase 1's display-text echo).
    """
    proc, port = await _spawn_and_wait_ready()
    try:
        async with websockets.connect(f"ws://127.0.0.1:{port}/ws") as ws:
            await ws.send(json.dumps({
                "type": "text-input",
                "text": "hi",
                "history_uid": "future-field",  # Phase 2+ field; Phase 1 dispatcher must ignore
            }))
            reply = json.loads(await asyncio.wait_for(ws.recv(), timeout=5.0))
            assert reply["type"] == "error"
            assert "Sidecar started without LLM configuration" in reply["message"]
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()
