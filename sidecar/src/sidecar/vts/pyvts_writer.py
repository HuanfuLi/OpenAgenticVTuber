"""PyvtsSafeWriter -- single-writer asyncio task wrapping vendored pyvts.

AVT-04 mitigation. pyvts 0.3.3 races at vts.py:117-118 (`websocket.send` then
an immediate receive); under concurrent callers the recv side can raise because
multiple coroutines await the same websocket. This wrapper centralizes recv()
inside one background task and dispatches replies by requestID.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

import pyvts
from loguru import logger

from contracts import ParamFrame


class PyvtsSafeWriter:
    def __init__(
        self,
        *,
        client: Any | None = None,
        plugin_info: dict[str, Any] | None = None,
        vts_api_info: dict[str, Any] | None = None,
        token_path: Path | None = None,
    ) -> None:
        if client is not None:
            self._client = client
        else:
            if token_path is None:
                token_path = Path(__file__).resolve().parents[3] / ".vts_token.txt"
            if plugin_info is None:
                plugin_info = {
                    "plugin_name": "AgenticLLMVTuber Phase3 Mouth Driver",
                    "developer": "AgenticLLMVTuber",
                    "authentication_token_path": str(token_path),
                }
            kwargs: dict[str, Any] = {"plugin_info": plugin_info}
            if vts_api_info is not None:
                kwargs["vts_api_info"] = vts_api_info
            self._client = pyvts.vts(**kwargs)
        self._pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._recv_task: asyncio.Task[None] | None = None
        self._send_lock = asyncio.Lock()
        self.vts_request = self._client.vts_request

    async def connect(self) -> None:
        await self._client.connect()
        if self._recv_task is None or self._recv_task.done():
            self._recv_task = asyncio.create_task(self._recv_loop())

    async def _recv_loop(self) -> None:
        try:
            while True:
                raw = await self._client.websocket.recv()
                msg = json.loads(raw)
                request_id = msg.get("requestID")
                future = self._pending.pop(request_id, None)
                if future is not None and not future.done():
                    future.set_result(msg)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            for future in self._pending.values():
                if not future.done():
                    future.set_exception(exc)
            self._pending.clear()

    async def request(
        self, request_msg: dict[str, Any], timeout: float = 5.0
    ) -> dict[str, Any]:
        request_copy = dict(request_msg)
        request_id = request_copy.get("requestID")
        if not request_id or request_id == "SomeID":
            request_id = uuid.uuid4().hex
            request_copy["requestID"] = request_id
        loop = asyncio.get_running_loop()
        future: asyncio.Future[dict[str, Any]] = loop.create_future()
        self._pending[request_id] = future
        try:
            async with self._send_lock:
                await self._client.websocket.send(json.dumps(request_copy))
            response = await asyncio.wait_for(future, timeout=timeout)
            if response.get("messageType") == "APIError":
                logger.warning("[VTS-REQUEST-ERROR] response={}", response)
                raise RuntimeError(f"VTube Studio API error: {response}")
            return response
        except Exception:
            self._pending.pop(request_id, None)
            raise

    async def inject_params(self, frame: ParamFrame) -> None:
        if frame.add_params:
            add_msg = self.vts_request.requestSetMultiParameterValue(
                parameters=list(frame.add_params.keys()),
                values=list(frame.add_params.values()),
                mode="add",
            )
            await self.request(add_msg)

        for param_id, (value, weight) in frame.set_params.items():
            set_msg = self.vts_request.requestSetParameterValue(
                parameter=param_id,
                value=value,
                weight=weight,
                mode="set",
            )
            await self.request(set_msg)

    async def close(self) -> None:
        if self._recv_task is not None:
            self._recv_task.cancel()
            try:
                await self._recv_task
            except asyncio.CancelledError:
                pass
            self._recv_task = None

        websocket = getattr(self._client, "websocket", None)
        if websocket is not None:
            await self._client.close()
