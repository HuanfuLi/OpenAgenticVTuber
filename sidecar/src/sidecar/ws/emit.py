"""Typed WS emission helpers -- centralizes envelope construction so call
sites at Orchestrator.turn don't pass raw dicts. Pydantic model_dump()
yields the JSON-ready dict, send_json serializes.
"""
from fastapi import WebSocket

from contracts import (
    AudioPayloadMessage,
    ControlMessage,
    ErrorMessage,
    ForceNewMessageMessage,
    FullTextMessage,
    LogMessage,
)


async def emit_audio_payload(ws: WebSocket, msg: AudioPayloadMessage) -> None:
    await ws.send_json(msg.model_dump())


async def emit_full_text(ws: WebSocket, text: str) -> None:
    await ws.send_json(FullTextMessage(text=text).model_dump())


async def emit_chain_start(ws: WebSocket) -> None:
    await ws.send_json(ControlMessage(text="conversation-chain-start").model_dump())


async def emit_chain_end(ws: WebSocket) -> None:
    await ws.send_json(ControlMessage(text="conversation-chain-end").model_dump())


async def emit_force_new_message(ws: WebSocket) -> None:
    await ws.send_json(ForceNewMessageMessage().model_dump())


async def emit_error(ws: WebSocket, message: str) -> None:
    await ws.send_json(ErrorMessage(message=message).model_dump())


async def emit_log(ws: WebSocket, level: str, message: str) -> None:
    await ws.send_json(LogMessage(level=level, message=message).model_dump())
