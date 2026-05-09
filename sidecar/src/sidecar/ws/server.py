"""FastAPI app -- Phase 1 surface: GET /health + WS /ws + POST /admin/llm-test.
Phase 2 extension: lifespan startup builds Orchestrator + warmup ping (Pitfall 5).
"""

import json
import logging
import os
import asyncio
import importlib.util
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger as loguru_logger

from sidecar.avatar.overrides import load_avatar_overrides
from sidecar.avatar.rig_capabilities import build_rig_capabilities, resolve_source_rig_path
from sidecar.compositor import Compositor
from sidecar.compositor.cursor_driver import CursorDriver
from sidecar.compositor.idle_driver import IdleDriver
from sidecar.compositor.plugin_adapter import PluginAdapter
from sidecar.compositor.speech_driver import SpeechDriver
from sidecar.llm.gateway import LLMGateway, ProviderConfig
from sidecar.orchestrator.orchestrator import Orchestrator
from sidecar.parser.reserved import (
    CategoryCollisionError,
    ReservedNameError,
    validate_reserved_names,
)
from sidecar.plugins.api import BodyMotionPlugin
from sidecar.plugins.loader import (
    build_dispatch_codes_section,
    discover_manifests,
    load_manifest,
    resolve_entrypoint,
    start_manifest_change_watcher,
)
from sidecar.plugins.supervisor import NullPlugin, PluginSupervisor
from sidecar.tts import TTSGateway, TTSTaskManager
from sidecar.vts.handshake import connect_and_authenticate
from sidecar.vts.discrete_dispatcher import DiscreteDispatcher
from sidecar.vts.event_completion_tracker import EventCompletionTracker
from sidecar.vts.pyvts_writer import PyvtsSafeWriter
from sidecar.vts.variant_state_manager import VariantStateManager
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


def _active_avatar_id() -> str:
    return os.environ.get("AGENTICLLMVTUBER_ACTIVE_AVATAR") or "teto"


def _persona_path(avatars_root: Path, avatar_dir: Path) -> Path:
    persona_path = avatar_dir / "personality.md"
    if persona_path.exists():
        return persona_path
    return avatars_root / "teto" / "personality.md"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def _user_plugins_dir() -> Path | None:
    user_data = os.environ.get("AGENTICLLMVTUBER_USER_DATA")
    if not user_data:
        return None
    return Path(user_data) / "plugins"


def _active_plugin_id() -> str:
    return os.environ.get("AGENTICLLMVTUBER_ACTIVE_PLUGIN") or "default"


def _load_plugin_instance(manifest_path: Path, entrypoint: str) -> BodyMotionPlugin:
    module_path, class_name = resolve_entrypoint(manifest_path, entrypoint)
    spec = importlib.util.spec_from_file_location(
        f"agenticllmvtuber_plugin_{manifest_path.parent.name}",
        module_path,
    )
    if spec is None or spec.loader is None:
        raise ValueError(f"cannot load plugin module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    plugin_cls = getattr(module, class_name)
    plugin = plugin_cls()
    if not isinstance(plugin, BodyMotionPlugin):
        raise TypeError(f"plugin entrypoint is not a BodyMotionPlugin: {entrypoint}")
    return plugin


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build Orchestrator at startup; tear down (no-op for now) at shutdown."""
    turn_loop_task: asyncio.Task | None = None
    compositor_task: asyncio.Task | None = None
    handshake_task: asyncio.Task | None = None
    writer: PyvtsSafeWriter | None = None
    tts_gateway: TTSGateway | None = None
    plugin_manifest_watcher = None
    event_completion_tracker: EventCompletionTracker | None = None
    app.state.startup_error_message = None

    provider_cfg = _load_provider_config_from_env()
    avatars = _avatars_root()
    active_avatar_id = _active_avatar_id()
    avatar_dir = avatars / active_avatar_id
    if provider_cfg is None or not avatar_dir.exists():
        loguru_logger.warning(
            f"Sidecar started without LLM config (env var present="
            f"{provider_cfg is not None}) or avatar dir missing "
            f"({active_avatar_id}/={avatar_dir.exists()}). Orchestrator inactive. "
            f"text-input will reply with config error."
        )
        app.state.orchestrator = None
        app.state.tts_gateway = None
        app.state.turn_loop_task = None
        app.state.startup_error_message = (
            "Sidecar started without LLM configuration. "
            "Restart from the LLM Setup screen."
        )
    else:
        try:
            overrides = load_avatar_overrides(avatar_dir)
            rig_dir = (
                resolve_source_rig_path(overrides, repo_root=Path(__file__).resolve().parents[4])
                if overrides.source_rig_path
                else avatar_dir
            )
            capabilities = build_rig_capabilities(overrides=overrides, rig_dir=rig_dir)
            loguru_logger.info(
                "[BOOT] avatar_id={} rig={} writable_param_ids={}, hotkeys={}, expressions={}",
                active_avatar_id,
                rig_dir,
                len(capabilities.writable_param_ids),
                len(capabilities.hotkeys),
                len(capabilities.expressions),
            )
            plugin_manifest = None
            plugin = NullPlugin()
            try:
                manifests = discover_manifests(_repo_root() / "plugins", _user_plugins_dir())
                manifest_path = manifests.get(_active_plugin_id())
                if manifest_path is not None:
                    plugin_manifest = load_manifest(manifest_path)
                    plugin_manifest_watcher = start_manifest_change_watcher(
                        manifest_path,
                        plugin_manifest,
                    )
                else:
                    loguru_logger.warning("[PLUGIN] active plugin not found: {}", _active_plugin_id())
            except Exception:
                loguru_logger.exception("[PLUGIN] discovery/load failed; using NullPlugin")

            plugin_action_codes = {
                getattr(action, "code", action)
                for action in (plugin_manifest.action_codes if plugin_manifest is not None else [])
            }
            validate_reserved_names(
                plugin_action_codes=plugin_action_codes,
                variants=overrides.variants,
                events=overrides.events,
            )

            if plugin_manifest is not None:
                try:
                    plugin = _load_plugin_instance(manifest_path, plugin_manifest.entrypoint)
                except Exception:
                    loguru_logger.exception("[PLUGIN] instance load failed; using NullPlugin")

            persona = _persona_path(avatars, avatar_dir).read_text(encoding="utf-8")
            voice_model = overrides.voice.model if overrides.voice else "en_US-amy-medium"
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
            compositor_sentence_complete_queue: asyncio.Queue = asyncio.Queue()
            pending_inputs: asyncio.Queue[str] = asyncio.Queue()
            plugin_supervisor = await PluginSupervisor.load_or_null(plugin, capabilities, overrides)
            plugin_adapter = PluginAdapter(plugin_supervisor)
            dispatch_codes_section = build_dispatch_codes_section(plugin_manifest, overrides)
            loguru_logger.info(
                "[DISPATCH-CATALOG] active_avatar={} actions={} variants={} events={}",
                active_avatar_id,
                len(plugin_action_codes),
                len(overrides.variants),
                len(overrides.events),
            )
            if not overrides.events:
                loguru_logger.info(
                    "[DISPATCH-CATALOG-BLOCKED] live event UAT requires an active avatar catalog with at least one event."
                )
            tts_manager = TTSTaskManager(
                stream=tts_gateway.stream,
                voice=tts_gateway.voice,
                compositor_speech_queue=compositor_speech_queue,
                compositor_sentence_complete_queue=compositor_sentence_complete_queue,
            )
            writer = PyvtsSafeWriter()
            discrete_dispatcher = DiscreteDispatcher(writer)
            reset_hotkey = next(
                (
                    hotkey
                    for hotkey in capabilities.hotkeys
                    if hotkey.type == "RemoveAllExpressions"
                    or hotkey.name == "RemoveAllExpressions"
                ),
                None,
            )
            variant_state_manager = VariantStateManager(
                discrete_dispatcher,
                reset_hotkey_id=reset_hotkey.hotkey_id if reset_hotkey else None,
            )
            event_completion_tracker = EventCompletionTracker()
            app.state.orchestrator = Orchestrator(
                gateway=gateway,
                persona_text=persona,
                action_codes_section=dispatch_codes_section,
                tts_manager=tts_manager,
                compositor_speech_queue=compositor_speech_queue,
                compositor_sentence_complete_queue=compositor_sentence_complete_queue,
                pending_inputs=pending_inputs,
                plugin_adapter=plugin_adapter,
                variant_state_manager=variant_state_manager,
                discrete_dispatcher=discrete_dispatcher,
                event_completion_tracker=event_completion_tracker,
                plugin_action_codes=plugin_action_codes,
                avatar_overrides=overrides,
            )
            app.state.tts_gateway = tts_gateway
            turn_loop_task = asyncio.create_task(app.state.orchestrator._turn_loop())

            handshake_task = asyncio.create_task(connect_and_authenticate(writer))
            try:
                await handshake_task
                try:
                    await variant_state_manager.reset_to_baseline()
                except Exception:
                    loguru_logger.exception(
                        "[VTS-BASELINE] reset_to_baseline failed; continuing with no active variant state."
                    )
            except Exception:
                loguru_logger.exception(
                    "[VTS-HANDSHAKE] unavailable; continuing without baseline reset."
                )
            breath_writeable = any(
                p.name == "Auto Breath" and p.visible for p in overrides.param_probes
            )
            idle_drv = IdleDriver(seed=42, breath_writeable=breath_writeable)
            speech_drv = SpeechDriver(
                compositor_speech_queue,
                overrides,
                avatar_dir,
            )
            cursor_drv = CursorDriver()
            compositor = Compositor(
                writer=writer,
                idle_driver=idle_drv,
                speech_driver=speech_drv,
                plugin_driver=plugin_adapter,
                capabilities=capabilities,
                cursor_driver=cursor_drv,
            )
            compositor_task = asyncio.create_task(compositor.run())
            app.state.compositor = compositor
            app.state.writer = writer
            app.state.handshake_task = handshake_task
            app.state.compositor_task = compositor_task
            app.state.teto_overrides = overrides
            app.state.discrete_dispatcher = discrete_dispatcher
            app.state.variant_state_manager = variant_state_manager
            app.state.event_completion_tracker = event_completion_tracker
            app.state.plugin_manifest = plugin_manifest
            app.state.plugin_manifest_watcher = plugin_manifest_watcher
            app.state.plugin_adapter = plugin_adapter
            app.state.action_code_queue = getattr(plugin_adapter, "action_code_queue", None)
            app.state.plugin_supervisor = plugin_supervisor
            app.state.turn_loop_task = turn_loop_task
            loguru_logger.info("[READY] orchestrator + TTS initialized.")
        except (ReservedNameError, CategoryCollisionError):
            loguru_logger.exception("Boot validation failed.")
            raise
        except Exception:
            loguru_logger.exception("Orchestrator construction failed.")
            app.state.orchestrator = None
            app.state.tts_gateway = None
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
        except Exception:
            pass
    if event_completion_tracker is not None:
        await event_completion_tracker.close()
    if writer is not None:
        await writer.close()
    plugin_supervisor = getattr(app.state, "plugin_supervisor", None)
    if plugin_supervisor is not None:
        await plugin_supervisor.close()
    if plugin_manifest_watcher is not None:
        plugin_manifest_watcher.stop()
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
