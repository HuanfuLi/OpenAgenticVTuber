"""FastAPI app -- Phase 1 surface: GET /health + WS /ws + POST /admin/llm-test.
Phase 2 extension: lifespan startup builds Orchestrator + warmup ping (Pitfall 5).
"""

import json
import logging
import os
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger as loguru_logger

from sidecar.avatar.capabilities import load_capabilities
from sidecar.llm.gateway import LLMGateway, ProviderConfig
from sidecar.orchestrator.orchestrator import Orchestrator
from sidecar.tts import TTSGateway, TTSTaskManager

from .handlers import handle_shutdown, handle_text_input  # noqa: F401 -- side-effect: registers @on(...)
from .protocol import route

log = logging.getLogger(__name__)


def _load_provider_config_from_env() -> ProviderConfig | None:
    """Skeleton path -- read config from AGENTICLLMVTUBER_LLM_CONFIG_JSON env var.

    Phase 1 stores the config in safeStorage at %APPDATA%/AgenticLLMVTuber/
    llm-config.enc. The sidecar process can't read DPAPI-encrypted blobs
    directly. Skeleton workaround: electron-main writes the same config
    unencrypted to AGENTICLLMVTUBER_LLM_CONFIG_JSON in the sidecar's
    environment when spawning. The encrypted blob remains the source of
    truth; this env var is a per-sidecar-launch decryption result.

    TODO Phase 5 / electron-main side: add the env-var write to the spawn
    path. For Phase 2 testing, set the env var manually.
    """
    raw = os.environ.get("AGENTICLLMVTUBER_LLM_CONFIG_JSON")
    if not raw:
        return None
    try:
        d = json.loads(raw)
        return ProviderConfig(
            provider=d["provider"],
            endpoint=d["endpoint"],
            api_key=d.get("apiKey", ""),
            model=d.get("model", ""),
        )
    except (KeyError, json.JSONDecodeError) as e:
        loguru_logger.error(f"Bad AGENTICLLMVTUBER_LLM_CONFIG_JSON: {e}")
        return None


def _avatars_root() -> Path:
    """Locate the `avatars/` directory at repo root.

    Path layout: this file is sidecar/src/sidecar/ws/server.py.
    parents[0]=ws, parents[1]=sidecar(pkg), parents[2]=src,
    parents[3]=sidecar(project), parents[4]=repo root.
    """
    return Path(__file__).resolve().parents[4] / "avatars"


async def _warmup_ping(gateway: LLMGateway) -> None:
    """Pitfall 5 mitigation -- fire a 1-token completion so LM Studio
    loads the model before the user's first chat turn.

    Best-effort: logs and swallows exceptions so a transient warmup failure
    doesn't block sidecar startup. The first user turn will retry naturally.
    """
    loguru_logger.info("[INFO] LLM warmup...")
    try:
        count_seen = 0
        async for _ in gateway.stream(
            messages=[{"role": "user", "content": "hi"}],
            system_prompt="",
        ):
            count_seen += 1
            if count_seen >= 1:
                break  # we just need to flush the first token
        loguru_logger.info("[INFO] LLM warmup complete.")
    except Exception:
        loguru_logger.exception(
            "LLM warmup failed (continuing -- first turn will retry)."
        )


async def _drain_speech_queue_until_phase4(queue: asyncio.Queue) -> None:
    while True:
        envelope = await queue.get()
        try:
            loguru_logger.debug(
                f"[SPEECH-ENV] sentence_id={envelope.sentence_id} "
                f"started_at={envelope.started_at:.3f} "
                f"volumes_n={len(envelope.volumes)}"
            )
        finally:
            queue.task_done()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build Orchestrator at startup; tear down (no-op for now) at shutdown."""
    drain_task: asyncio.Task | None = None
    turn_loop_task: asyncio.Task | None = None
    tts_gateway: TTSGateway | None = None
    app.state.startup_error_message = None

    provider_cfg = _load_provider_config_from_env()
    avatars = _avatars_root()
    teto_dir = avatars / "teto"
    if provider_cfg is None or not teto_dir.exists():
        loguru_logger.warning(
            f"Sidecar started without LLM config (env var present="
            f"{provider_cfg is not None}) or avatar dir missing "
            f"(teto/={teto_dir.exists()}). Orchestrator inactive. "
            f"text-input will reply with config error."
        )
        app.state.orchestrator = None
        app.state.tts_gateway = None
        app.state.drain_task = None
        app.state.turn_loop_task = None
        app.state.startup_error_message = (
            "Sidecar started without LLM configuration. "
            "Restart from the LLM Setup screen."
        )
    else:
        try:
            capabilities = load_capabilities(teto_dir)
            persona = (teto_dir / "personality.md").read_text(encoding="utf-8")
            voice_model = capabilities.voice.model if capabilities.voice else "en_US-amy-medium"
            model_path = (
                Path(__file__).resolve().parents[4]
                / "sidecar"
                / "models"
                / "piper"
                / f"{voice_model}.onnx"
            )
            tts_gateway = TTSGateway(model_path)
            tts_gateway.boot()

            gateway = LLMGateway(provider_cfg)
            await _warmup_ping(gateway)

            compositor_speech_queue: asyncio.Queue = asyncio.Queue()
            pending_inputs: asyncio.Queue[str] = asyncio.Queue()
            tts_manager = TTSTaskManager(
                stream=tts_gateway.stream,
                voice=tts_gateway.voice,
                compositor_speech_queue=compositor_speech_queue,
            )
            app.state.orchestrator = Orchestrator(
                gateway=gateway,
                capabilities=capabilities,
                persona_text=persona,
                tts_manager=tts_manager,
                compositor_speech_queue=compositor_speech_queue,
                pending_inputs=pending_inputs,
            )
            app.state.tts_gateway = tts_gateway
            drain_task = asyncio.create_task(
                _drain_speech_queue_until_phase4(compositor_speech_queue)
            )
            turn_loop_task = asyncio.create_task(app.state.orchestrator._turn_loop())
            app.state.drain_task = drain_task
            app.state.turn_loop_task = turn_loop_task
            loguru_logger.info("[READY] orchestrator + TTS initialized.")
        except Exception:
            loguru_logger.exception("Orchestrator construction failed.")
            app.state.orchestrator = None
            app.state.tts_gateway = None
            app.state.drain_task = None
            app.state.turn_loop_task = None
            app.state.startup_error_message = (
                "TTS failed to initialize. Check the Piper model and audio output, then restart."
            )
    loguru_logger.info("[READY] sidecar startup complete.")
    yield
    if turn_loop_task is not None:
        turn_loop_task.cancel()
        try:
            await turn_loop_task
        except asyncio.CancelledError:
            pass
    if drain_task is not None:
        drain_task.cancel()
        try:
            await drain_task
        except asyncio.CancelledError:
            pass
    if tts_gateway is not None:
        tts_gateway.shutdown()


app = FastAPI(
    title="AgenticLLMVTuber Sidecar",
    version="0.1.0-skeleton",
    lifespan=lifespan,
)

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
