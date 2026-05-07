"""DiscreteDispatcher -- AVT-09 rare-trigger path through PyvtsSafeWriter."""

from __future__ import annotations

import asyncio

from loguru import logger

from contracts import DiscreteEvent
from sidecar.avatar.overrides import TetoOverrides

from .pyvts_writer import PyvtsSafeWriter


class DiscreteDispatcher:
    def __init__(self, writer: PyvtsSafeWriter) -> None:
        self._writer = writer

    async def fire(
        self, hotkey_id: str, name: str = "", force: bool = False
    ) -> dict:
        del force
        request = self._writer.vts_request.requestTriggerHotKey(hotkey_id)
        logger.info(
            f"[DISCRETE-DISPATCHER] firing hotkey_id={hotkey_id!r} name={name!r}"
        )
        response = await self._writer.request(request)
        loop = asyncio.get_running_loop()
        DiscreteEvent(hotkey_id=hotkey_id, name=name, triggered_at=loop.time())
        return response

    async def fire_by_name(
        self, name: str, overrides: TetoOverrides, force: bool = False
    ) -> dict:
        match = next((hotkey for hotkey in overrides.discovered_hotkeys if hotkey.name == name), None)
        if match is None:
            raise ValueError(
                f"Hotkey {name!r} not found in teto_overrides.discovered_hotkeys"
            )
        if match.is_meta and not force:
            raise ValueError(
                f"Hotkey {name!r} is_meta=True; pass force=True to override"
            )
        return await self.fire(match.hotkey_id, name=match.name, force=force)
