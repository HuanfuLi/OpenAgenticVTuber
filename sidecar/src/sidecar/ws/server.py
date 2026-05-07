"""FastAPI app -- Phase 1 surface: GET /health + WS /ws + POST /admin/llm-test."""

import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .handlers import handle_shutdown, handle_text_input  # noqa: F401 -- side-effect: registers @on(...)
from .protocol import route

log = logging.getLogger(__name__)

app = FastAPI(title="AgenticLLMVTuber Sidecar", version="0.1.0-skeleton")

# CORS for the renderer.
#  - Dev:  renderer is served by Vite at http://localhost:5173 (or 127.0.0.1:5173).
#          POST /admin/llm-test with Content-Type: application/json triggers a
#          CORS preflight; without these headers the browser blocks the fetch
#          with a generic `TypeError: Failed to fetch`.
#  - Prod: the renderer is loaded from `file://`, so Origin is the literal
#          string "null". Allowing it explicitly keeps the production path
#          identical to dev.
# Localhost-only (D-04) is preserved because the sidecar still binds to
# 127.0.0.1 -- CORS only widens *who can read the response*, not who can reach
# the socket.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|null)$",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            # Match OLVT: receive_json yields parsed dict; non-JSON messages
            # raise and disconnect via the except below.
            raw = await ws.receive_json()
            await route(ws, raw)
    except WebSocketDisconnect:
        log.info("WS client disconnected.")
    except Exception:  # noqa: BLE001 -- log everything, never let WS handler crash the app
        log.exception("WS handler error; closing connection.")
        try:
            await ws.close(code=1011)
        except Exception:
            pass


# /admin router for LLM setup test (Task 3 / PLUMB-04).
from ..llm.setup_test import router as admin_router  # noqa: E402

app.include_router(admin_router)
