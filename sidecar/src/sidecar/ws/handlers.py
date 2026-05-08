"""WS handlers for sidecar message routing."""

import logging

from fastapi import WebSocket

from contracts import ErrorMessage

from .protocol import on

log = logging.getLogger(__name__)


@on("text-input")
async def handle_text_input(ws: WebSocket, msg: dict) -> None:
    """Phase 3: enqueue text input for the pending-turn loop.

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
                    getattr(ws.app.state, "startup_error_message", None)
                    or "Sidecar started without LLM configuration. Restart from the LLM Setup screen."
                ),
            ).model_dump()
        )
        return
    orchestrator.set_active_ws(ws)
    await orchestrator.pending_inputs.put(text)


@on("shutdown")
async def handle_shutdown(ws: WebSocket, msg: dict) -> None:
    # The actual graceful shutdown sequence runs in main.py via server.should_exit.
    # This handler is the renderer-initiated path; main.py's before-quit IPC handler
    # is the Electron-initiated path. Both converge on uvicorn drain.
    log.info("Received shutdown WS message; sidecar will exit shortly.")
    # Phase 1: no-op ack. Phase 4 will add pyvts close before allowing drain.


@on("control")
async def handle_control(ws: WebSocket, msg: dict) -> None:
    """Phase 4 control-channel dispatcher."""

    text = msg.get("text", "")
    if text.startswith("set-body-sway-strategy:"):
        name = text[len("set-body-sway-strategy:") :]
        from plugins.default.body_sway import STRATEGY_NAMES, available_strategy_names

        if name not in STRATEGY_NAMES:
            log.warning("[WS-CONTROL] unknown body-sway strategy: %r", name)
            return
        overrides = getattr(ws.app.state, "teto_overrides", None)
        if overrides is not None and name not in available_strategy_names(overrides):
            log.warning("[WS-CONTROL] unavailable body-sway strategy refused: %r", name)
            return
        compositor = getattr(ws.app.state, "compositor", None)
        if compositor is not None:
            compositor.request_strategy_swap(name)
            log.info("[WS-CONTROL] requested body-sway strategy swap: %r", name)
        else:
            log.warning("[WS-CONTROL] compositor not in app.state")
        return
    if text.startswith("fire-discrete-event:"):
        hotkey_name = text[len("fire-discrete-event:") :]
        dispatcher = getattr(ws.app.state, "discrete_dispatcher", None)
        overrides = getattr(ws.app.state, "teto_overrides", None)
        if dispatcher is None or overrides is None:
            log.warning("[WS-CONTROL] discrete_dispatcher or teto_overrides not in app.state")
            return
        try:
            await dispatcher.fire_by_name(hotkey_name, overrides)
            log.info("[WS-CONTROL] discrete event fired: %r", hotkey_name)
        except ValueError as exc:
            log.warning("[WS-CONTROL] fire-discrete-event refused: %s", exc)
