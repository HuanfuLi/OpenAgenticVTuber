"""HUD WebSocket message routing -- set-lock / clear-lock handlers and push loop."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket
from loguru import logger
from pydantic import TypeAdapter, ValidationError

from contracts import (
    HudClearLockMessage,
    HudLockConfirmedMessage,
    HudLockRejectedMessage,
    HudMessageC2S,
    HudParamFrameMessage,
    HudSetLockMessage,
)
from sidecar.compositor.lock_filter import SYSTEM_PRIMITIVE_OVERRIDES


_C2S = TypeAdapter(HudMessageC2S)


async def route_hud_c2s(ws: WebSocket, raw: dict[str, Any], app_state: Any) -> None:
    """Route a C2S HUD message and emit confirm/reject when appropriate."""
    try:
        msg = _C2S.validate_python(raw)
    except ValidationError as exc:
        logger.error("[HUD-WS] invalid C2S message: {} -- payload={}", exc, raw)
        param_id = raw.get("param_id", "<unknown>") if isinstance(raw, dict) else "<unknown>"
        errors = exc.errors()
        reason = errors[0]["msg"] if errors else "invalid"
        await ws.send_json(
            HudLockRejectedMessage(
                param_id=str(param_id),
                reason=f"validation: {reason}",
            ).model_dump(mode="json")
        )
        return

    lock_state: dict[str, float] = app_state.lock_state
    if isinstance(msg, HudSetLockMessage):
        if msg.param_id in SYSTEM_PRIMITIVE_OVERRIDES:
            logger.error(
                "[HUD-WS] set-lock rejected for system primitive {} -- HUD-06 should have prevented this",
                msg.param_id,
            )
            await ws.send_json(
                HudLockRejectedMessage(
                    param_id=msg.param_id,
                    reason="param is owned by a system primitive (lipsync) and cannot be locked",
                ).model_dump(mode="json")
            )
            return
        lock_state[msg.param_id] = msg.value
        logger.info("[HUD-LOCK] set-lock {} -> {}", msg.param_id, msg.value)
        await ws.send_json(
            HudLockConfirmedMessage(param_id=msg.param_id, value=msg.value).model_dump(mode="json")
        )
    elif isinstance(msg, HudClearLockMessage):
        lock_state.pop(msg.param_id, None)
        logger.info("[HUD-LOCK] clear-lock {}", msg.param_id)


async def hud_push_loop(ws: WebSocket, queue: asyncio.Queue) -> None:
    """Drain the HudTap subscriber queue and push HudParamFrameMessage to the client."""
    while True:
        frame, lock_snapshot = await queue.get()
        params: dict[str, float] = {}
        for key, value in frame.add_params.items():
            if key in SYSTEM_PRIMITIVE_OVERRIDES:
                continue
            params[key] = float(value)
        for key, (value, _weight) in frame.set_params.items():
            if key in SYSTEM_PRIMITIVE_OVERRIDES:
                continue
            params[key] = float(value)

        msg = HudParamFrameMessage(
            tick_n=frame.tick_n,
            params=params,
            locked_ids=sorted(lock_snapshot.keys()),
        )
        try:
            await ws.send_json(msg.model_dump(mode="json"))
        except Exception:  # noqa: BLE001 -- log + exit; outer caller handles cleanup
            logger.exception("[HUD-WS] push send failed; exiting push loop")
            return
