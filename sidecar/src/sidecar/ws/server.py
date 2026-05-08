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
from sidecar.avatar.overrides import load_overrides
from sidecar.compositor import Compositor
from sidecar.compositor.cursor_driver import CursorDriver
from sidecar.compositor.idle_driver import IdleDriver
from sidecar.compositor.intent_driver import IntentDriver
from sidecar.compositor.speech_driver import SpeechDriver
from sidecar.llm.gateway import LLMGateway, ProviderConfig
from sidecar.orchestrator.orchestrator import Orchestrator
from sidecar.tts import TTSGateway, TTSTaskManager
from sidecar.vts import LoggingParameterWriter, PyVTSParameterWriter, SpeechMouthDriver
from sidecar.vts.handshake import connect_and_authenticate
from sidecar.vts.discrete_dispatcher import DiscreteDispatcher
from sidecar.vts.pyvts_writer import PyvtsSafeWriter
from sidecar.admin import avatar as admin_avatar

from .handlers import handle_control, handle_shutdown, handle_text_input  # noqa: F401 -- side-effect: registers @on(...)
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


def _playback_now(stream) -> float:
    return float(stream.time) + float(stream.latency)


async def _build_mouth_writer(capabilities):
    param_ids = {p.id for p in capabilities.parameters}
    if "ParamMouthOpenY" not in param_ids:
        loguru_logger.warning("[VTS-MOUTH] degraded missing ParamMouthOpenY")
        return LoggingParameterWriter()

    writer = PyVTSParameterWriter()
    try:
        await writer.connect_and_authenticate()
        return writer
    except Exception:
        loguru_logger.exception("[VTS-MOUTH] degraded")
        await writer.close()
        return LoggingParameterWriter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build Orchestrator at startup; tear down (no-op for now) at shutdown."""
    mouth_task: asyncio.Task | None = None
    turn_loop_task: asyncio.Task | None = None
    compositor_task: asyncio.Task | None = None
    handshake_task: asyncio.Task | None = None
    writer: PyvtsSafeWriter | None = None
    tts_gateway: TTSGateway | None = None
    mouth_writer = None
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
        app.state.mouth_driver_task = None
        app.state.turn_loop_task = None
        app.state.mouth_writer = None
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

            overrides = load_overrides(teto_dir)
            compositor_speech_queue: asyncio.Queue = asyncio.Queue()
            mouth_speech_queue: asyncio.Queue = asyncio.Queue()
            compositor_intent_queue: asyncio.Queue = asyncio.Queue()
            compositor_sentence_complete_queue: asyncio.Queue = asyncio.Queue()
            pending_inputs: asyncio.Queue[str] = asyncio.Queue()
            tts_manager = TTSTaskManager(
                stream=tts_gateway.stream,
                voice=tts_gateway.voice,
                compositor_speech_queue=compositor_speech_queue,
                extra_speech_queues=[mouth_speech_queue],
                compositor_sentence_complete_queue=compositor_sentence_complete_queue,
            )
            app.state.orchestrator = Orchestrator(
                gateway=gateway,
                capabilities=capabilities,
                persona_text=persona,
                tts_manager=tts_manager,
                compositor_speech_queue=compositor_speech_queue,
                compositor_intent_queue=compositor_intent_queue,
                compositor_sentence_complete_queue=compositor_sentence_complete_queue,
                pending_inputs=pending_inputs,
            )
            app.state.tts_gateway = tts_gateway
            mouth_writer = await _build_mouth_writer(capabilities)
            mouth_driver = SpeechMouthDriver(
                writer=mouth_writer,
                now=lambda: _playback_now(tts_gateway.stream),
            )
            mouth_task = asyncio.create_task(
                mouth_driver.consume_forever(mouth_speech_queue)
            )
            turn_loop_task = asyncio.create_task(app.state.orchestrator._turn_loop())

            writer = PyvtsSafeWriter()
            handshake_task = asyncio.create_task(connect_and_authenticate(writer))
            breath_writeable = any(
                p.name == "Auto Breath" and p.visible for p in overrides.param_probes
            )
            idle_drv = IdleDriver(seed=42, breath_writeable=breath_writeable)
            speech_drv = SpeechDriver(
                compositor_speech_queue,
                overrides,
                teto_dir,
                emit_mouth=False,
            )
            cursor_drv = CursorDriver()
            discrete_dispatcher = DiscreteDispatcher(writer)
            intent_drv = IntentDriver(
                intent_queue=compositor_intent_queue,
                sentence_complete_queue=compositor_sentence_complete_queue,
                writer=writer,
                capabilities=capabilities,
                avatar_dir=teto_dir,
            )
            compositor = Compositor(
                writer=writer,
                idle_driver=idle_drv,
                speech_driver=speech_drv,
                intent_driver=intent_drv,
                cursor_driver=cursor_drv,
            )
            compositor_task = asyncio.create_task(compositor.run())
            app.state.compositor = compositor
            app.state.writer = writer
            app.state.handshake_task = handshake_task
            app.state.compositor_task = compositor_task
            app.state.teto_overrides = overrides
            app.state.discrete_dispatcher = discrete_dispatcher
            app.state.mouth_driver_task = mouth_task
            app.state.turn_loop_task = turn_loop_task
            app.state.mouth_writer = mouth_writer
            loguru_logger.info("[READY] orchestrator + TTS initialized.")
        except Exception:
            loguru_logger.exception("Orchestrator construction failed.")
            app.state.orchestrator = None
            app.state.tts_gateway = None
            app.state.mouth_driver_task = None
            app.state.turn_loop_task = None
            app.state.mouth_writer = None
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
    if mouth_task is not None:
        mouth_task.cancel()
        try:
            await mouth_task
        except asyncio.CancelledError:
            pass
    if compositor_task is not None:
        await app.state.compositor.stop()
        compositor_task.cancel()
        try:
            await compositor_task
        except asyncio.CancelledError:
            pass
    if handshake_task is not None:
        handshake_task.cancel()
        try:
            await handshake_task
        except asyncio.CancelledError:
            pass
    if writer is not None:
        await writer.close()
    if mouth_writer is not None:
        await mouth_writer.close()
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
app.include_router(admin_avatar.router)
