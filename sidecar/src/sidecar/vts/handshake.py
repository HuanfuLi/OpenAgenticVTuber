"""Connect and authenticate a VTS safe writer in a background-friendly way."""

from __future__ import annotations

from loguru import logger

from .pyvts_writer import PyvtsSafeWriter


async def connect_and_authenticate(writer: PyvtsSafeWriter) -> bool:
    logger.info("[VTS-HANDSHAKE] connect-start")
    await writer.connect()
    logger.info("[VTS-HANDSHAKE] auth-pending")
    await writer._client.request_authenticate_token()
    authenticated = await writer._client.request_authenticate()
    if authenticated is True:
        logger.info("[VTS-HANDSHAKE] auth-success")
        return True
    logger.warning("[VTS-HANDSHAKE] auth-failure")
    raise RuntimeError("VTube Studio authentication failed")
