"""VTube Studio input-parameter writer seam used by the Phase 3 mouth driver."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from loguru import logger

from sidecar.vts.pyvts_writer import PyvtsSafeWriter

MOUTH_DRIVER_PLUGIN_NAME = "AgenticLLMVTuber Phase3 Mouth Driver"


class ParameterWriter(Protocol):
    async def write_parameter(
        self,
        param_id: str,
        value: float,
        *,
        weight: float = 1.0,
        mode: str = "set",
        face_found: bool = False,
    ) -> None: ...


class PyVTSParameterWriter:
    """Writes parameter values through the vendored pyvts client."""

    def __init__(self, token_path: Path | None = None) -> None:
        if token_path is None:
            token_path = Path(__file__).resolve().parents[3] / ".vts_mouth_token.txt"
        self._writer = PyvtsSafeWriter(
            plugin_info={
                "plugin_name": MOUTH_DRIVER_PLUGIN_NAME,
                "developer": "AgenticLLMVTuber",
                "authentication_token_path": str(token_path),
            }
        )

    async def connect_and_authenticate(self) -> None:
        await self._writer.connect()
        await self._writer._client.request_authenticate_token()
        authenticated = await self._writer._client.request_authenticate()
        if authenticated is not True:
            raise RuntimeError("VTube Studio authentication failed")

    async def write_parameter(
        self,
        param_id: str,
        value: float,
        *,
        weight: float = 1.0,
        mode: str = "set",
        face_found: bool = False,
    ) -> None:
        request_msg = self._writer.vts_request.requestSetParameterValue(
            parameter=param_id,
            value=value,
            weight=weight,
            mode=mode,
            face_found=face_found,
        )
        await self._writer.request(request_msg)

    async def close(self) -> None:
        await self._writer.close()


class LoggingParameterWriter:
    """Degraded writer that preserves real values without requiring VTS."""

    async def connect_and_authenticate(self) -> None:
        return None

    async def write_parameter(
        self,
        param_id: str,
        value: float,
        *,
        weight: float = 1.0,
        mode: str = "set",
        face_found: bool = False,
    ) -> None:
        logger.debug(
            f"[VTS-MOUTH] param={param_id} value={value:.3f} "
            f"weight={weight:.3f} mode={mode} face_found={face_found}"
        )

    async def close(self) -> None:
        return None
