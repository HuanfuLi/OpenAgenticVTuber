"""PyvtsSafeWriter -- single-writer asyncio task wrapping vendored pyvts.

AVT-04 mitigation. pyvts 0.3.3 races at vts.py:117-118 (`websocket.send` then
an immediate receive); under concurrent callers the recv side can raise because
multiple coroutines await the same websocket. This wrapper centralizes recv()
inside one background task and dispatches replies by requestID.
"""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from pathlib import Path
from typing import Any

import pyvts
from loguru import logger

from contracts import ParamFrame

COMPOSITOR_PLUGIN_NAME = "AgenticLLMVTuber Phase4 Safe Writer"


class VTubeStudioAPIError(RuntimeError):
    def __init__(self, response: dict[str, Any]) -> None:
        self.response = response
        data = response.get("data", {})
        self.error_id = data.get("errorID")
        self.message = str(data.get("message", ""))
        super().__init__(f"VTube Studio API error {self.error_id}: {self.message}")


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
                    "plugin_name": COMPOSITOR_PLUGIN_NAME,
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
        self._disabled_params: set[str] = set()
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
                raise VTubeStudioAPIError(response)
            return response
        except Exception:
            self._pending.pop(request_id, None)
            raise

    async def inject_params(self, frame: ParamFrame) -> None:
        add_params = {
            param_id: value
            for param_id, value in frame.add_params.items()
            if param_id not in self._disabled_params
        }
        if add_params:
            await self._inject_add_params(add_params)

        for param_id, (value, weight) in frame.set_params.items():
            if param_id in self._disabled_params:
                continue
            set_msg = self.vts_request.requestSetParameterValue(
                parameter=param_id,
                value=value,
                weight=weight,
                mode="set",
            )
            try:
                await self.request(set_msg)
            except VTubeStudioAPIError as exc:
                if exc.error_id == 453 and "not found" in exc.message:
                    self._disabled_params.add(param_id)
                    logger.warning(
                        "[VTS-PARAM-DISABLED] param={} errorID={} message={!r}",
                        param_id,
                        exc.error_id,
                        exc.message,
                    )
                    continue
                raise

    async def _inject_add_params(self, add_params: dict[str, float]) -> None:
        remaining = dict(add_params)
        while remaining:
            add_msg = self.vts_request.requestSetMultiParameterValue(
                parameters=list(remaining.keys()),
                values=list(remaining.values()),
                mode="add",
            )
            try:
                await self.request(add_msg)
                return
            except VTubeStudioAPIError as exc:
                disabled = self._disable_missing_param_from_error(exc, remaining.keys())
                if disabled is None:
                    raise
                remaining.pop(disabled, None)

    def _disable_missing_param_from_error(
        self, exc: VTubeStudioAPIError, candidates: Any
    ) -> str | None:
        candidates = list(candidates)
        if exc.error_id != 453 or "not found" not in exc.message:
            return None
        missing = _missing_param_from_message(exc.message, candidates)
        if missing is None and len(candidates) == 1:
            missing = candidates[0]
        if missing is None:
            return None
        self._disabled_params.add(missing)
        logger.warning(
            "[VTS-PARAM-DISABLED] param={} errorID={} message={!r}",
            missing,
            exc.error_id,
            exc.message,
        )
        return missing

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


def _missing_param_from_message(message: str, candidates: list[str]) -> str | None:
    match = re.search(r"Parameter (?P<param>.+?) not found", message)
    if match:
        missing = match.group("param")
        if missing in candidates:
            return missing
    for candidate in candidates:
        if candidate in message:
            return candidate
    return None
