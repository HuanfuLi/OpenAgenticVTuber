"""Phase 2 WS handlers -- text-input drives Orchestrator.turn (echo body removed)."""

import logging

from fastapi import WebSocket

from contracts import ErrorMessage

from .protocol import on

log = logging.getLogger(__name__)


@on("text-input")
async def handle_text_input(ws: WebSocket, msg: dict) -> None:
    """Phase 2: drive orchestrator.turn instead of echoing.

    On `app.state.orchestrator is None` (sidecar started without LLM config),
    reply with a clear ErrorMessage envelope instead of crashing -- the
    renderer's banner copy can guide the user back to the LLM Setup screen.
    """
    text = msg.get("text", "").strip()
    if not text:
        return
    orchestrator = getattr(ws.app.state, "orchestrator", None)
    if orchestrator is None:
        await ws.send_json(
            ErrorMessage(
                message=(
                    "Sidecar started without LLM configuration. "
                    "Restart from the LLM Setup screen."
                )
            ).model_dump()
        )
        return
    await orchestrator.turn(text, ws)


@on("shutdown")
async def handle_shutdown(ws: WebSocket, msg: dict) -> None:
    # The actual graceful shutdown sequence runs in main.py via server.should_exit.
    # This handler is the renderer-initiated path; main.py's before-quit IPC handler
    # is the Electron-initiated path. Both converge on uvicorn drain.
    log.info("Received shutdown WS message; sidecar will exit shortly.")
    # Phase 1: no-op ack. Phase 4 will add pyvts close before allowing drain.
