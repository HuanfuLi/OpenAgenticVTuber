"""Sidecar entry point — bind ephemeral socket, print READY line, run uvicorn.

Verbatim from RESEARCH.md "Pattern: Python sidecar lifecycle on Windows" with
explicit comments on the critical correctness points (Pitfalls 11, 12, port:0-race).
"""

import asyncio
import os
import socket

import uvicorn

from .lifecycle.watchdog import parent_watchdog
from .ws.server import app


def main() -> None:
    """Entry point — bind ephemeral socket, print READY, run uvicorn."""
    parent_pid = os.getppid()

    # CRITICAL: bind our own socket so we can read the chosen port BEFORE serving.
    # uvicorn does not expose its bound socket cleanly otherwise (FastAPI #14783).
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]

    # CRITICAL: print READY BEFORE uvicorn enters accept loop. flush=True is
    # required — Python line-buffers stdout in pipe mode, and Electron's
    # READY-line parser will hang otherwise. Pitfall 11 / port:0-race in RESEARCH.md.
    print(f"[READY] ws://127.0.0.1:{port}/ws", flush=True)

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
    )
    server = uvicorn.Server(config)

    async def runner() -> None:
        watchdog_task = asyncio.create_task(parent_watchdog(parent_pid))
        try:
            # Pass our pre-bound socket; uvicorn won't try to re-bind. The OS
            # is already in LISTEN state on this socket, so any connect() from
            # the renderer succeeds even before uvicorn drains the SYN queue.
            await server.serve(sockets=[sock])
        finally:
            watchdog_task.cancel()

    asyncio.run(runner())


if __name__ == "__main__":
    main()
