"""Connect and authenticate a VTS safe writer in a background-friendly way."""

from __future__ import annotations

from loguru import logger

from .pyvts_writer import PyvtsSafeWriter


async def connect_and_authenticate(writer: PyvtsSafeWriter) -> bool:
    logger.info("[VTS-HANDSHAKE] connect-start")
    await writer.connect()
    logger.info("[VTS-HANDSHAKE] auth-pending")

    client = writer._client
    token = await client.read_token() if hasattr(client, "read_token") else client.authentic_token
    if not token:
        token_response = await writer.request(client.vts_request.authentication_token())
        token = token_response.get("data", {}).get("authenticationToken")
        if not token:
            logger.warning("[VTS-HANDSHAKE] auth-token-failure response={}", token_response)
            raise RuntimeError("VTube Studio authentication token request failed")
        client.authentic_token = token
        if hasattr(client, "write_token"):
            await client.write_token()

    auth_response = await writer.request(client.vts_request.authentication(token))
    authenticated = bool(auth_response.get("data", {}).get("authenticated"))
    if authenticated:
        logger.info("[VTS-HANDSHAKE] auth-success")
        return True

    logger.warning("[VTS-HANDSHAKE] auth-token-rejected response={}", auth_response)
    token_response = await writer.request(client.vts_request.authentication_token())
    token = token_response.get("data", {}).get("authenticationToken")
    if not token:
        logger.warning("[VTS-HANDSHAKE] auth-token-refresh-failure response={}", token_response)
        raise RuntimeError("VTube Studio authentication token refresh failed")
    client.authentic_token = token
    if hasattr(client, "write_token"):
        await client.write_token()
    auth_response = await writer.request(client.vts_request.authentication(token))
    authenticated = bool(auth_response.get("data", {}).get("authenticated"))
    if authenticated:
        logger.info("[VTS-HANDSHAKE] auth-success-after-refresh")
        return True

    logger.warning("[VTS-HANDSHAKE] auth-failure response={}", auth_response)
    raise RuntimeError("VTube Studio authentication failed")
