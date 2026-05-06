"""OLVT-shape WS dispatcher.

Mirrors Open-LLM-VTuber's _route_message: dispatch on the `type` field of an
untyped dict (Pydantic validation happens inside individual handlers when needed).
Unknown types are silently dropped -- matches OLVT behavior.
"""

from typing import Any, Awaitable, Callable

from fastapi import WebSocket

Handler = Callable[[WebSocket, dict[str, Any]], Awaitable[None]]
_handlers: dict[str, Handler] = {}


def on(msg_type: str) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        _handlers[msg_type] = fn
        return fn

    return deco


async def route(websocket: WebSocket, raw: dict[str, Any]) -> None:
    msg_type = raw.get("type")
    if not msg_type:
        return
    handler = _handlers.get(msg_type)
    if handler is None:
        return
    await handler(websocket, raw)


def registered_types() -> list[str]:
    """Test/diagnostic helper -- list registered message types."""
    return list(_handlers.keys())
