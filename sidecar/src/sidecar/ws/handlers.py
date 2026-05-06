"""Phase 1 echo handler. Phase 2 will add real LLM-orchestrated handlers."""

import logging

from fastapi import WebSocket

from contracts.ws_message import DisplayTextMessage

from .protocol import on

log = logging.getLogger(__name__)


@on("text-input")
async def handle_text_input(ws: WebSocket, msg: dict) -> None:
    text = msg.get("text", "")
    reply = DisplayTextMessage(text=f"echo: {text}")
    # Pydantic v2: model_dump() -> dict. send_json() handles serialization.
    await ws.send_json(reply.model_dump())


@on("shutdown")
async def handle_shutdown(ws: WebSocket, msg: dict) -> None:
    # The actual graceful shutdown sequence runs in main.py via server.should_exit.
    # This handler is the renderer-initiated path; main.py's before-quit IPC handler
    # is the Electron-initiated path. Both converge on uvicorn drain.
    log.info("Received shutdown WS message; sidecar will exit shortly.")
    # Phase 1: no-op ack. Phase 4 will add pyvts close before allowing drain.
