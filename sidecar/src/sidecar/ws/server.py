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
from contracts import ReferenceAudioAsset, VoicePreset

from sidecar.avatar.overrides import load_avatar_overrides
from sidecar.audio.config import load_audio_config_from_env
from sidecar.avatar.rig_capabilities import build_rig_capabilities, resolve_source_rig_path
from sidecar.compositor import Compositor
from sidecar.compositor.cursor_driver import CursorDriver
from sidecar.compositor.hud_tap import HudTap
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
from sidecar.tts import TTSGateway, TTSTaskManager, build_tts_gateway
from sidecar.vts.handshake import connect_and_authenticate
from sidecar.vts.discrete_dispatcher import DiscreteDispatcher
from sidecar.vts.event_completion_tracker import EventCompletionTracker
from sidecar.vts.pyvts_writer import PyvtsSafeWriter
from sidecar.vts.variant_state_manager import VariantStateManager
from sidecar.admin import avatar as admin_avatar
from sidecar.admin import rig_capabilities as admin_rig_capabilities
from sidecar.admin import plugin as admin_plugin
from sidecar.admin import status as admin_status
from sidecar.admin import audio as admin_audio

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


def _cursor_tracking_enabled() -> bool:
    return os.environ.get("AGENTICLLMVTUBER_CURSOR_TRACKING_ENABLED", "1") != "0"


def _active_preset_key(avatar_id: str, session_id: str = "global") -> str:
    avatar = avatar_id.strip() if avatar_id.strip() else "global"
    session = session_id.strip() if session_id.strip() else "global"
    return f"avatar:{avatar}|session:{session}"


def _load_active_voice_preset_and_reference(active_avatar_id: str) -> tuple[VoicePreset | None, Path | None]:
    raw = os.environ.get("AGENTICLLMVTUBER_VOICE_PRESET_CONFIG_JSON")
    user_data = os.environ.get("AGENTICLLMVTUBER_USER_DATA")
    if not raw or not user_data:
        return None, None
    try:
        data = json.loads(raw)
        presets = [VoicePreset.model_validate(item) for item in data.get("voicePresets", [])]
        assets = [ReferenceAudioAsset.model_validate(item) for item in data.get("referenceAudioAssets", [])]
        active_map = data.get("activePresetByAvatarSession", {})
        if not isinstance(active_map, dict):
            active_map = {}
    except Exception as exc:
        loguru_logger.warning("[TTS-INIT] invalid voice preset handoff: {}", exc)
        return None, None

    active_session = os.environ.get("AGENTICLLMVTUBER_ACTIVE_SESSION") or "global"
    candidate_ids = [
        active_map.get(_active_preset_key(active_avatar_id, active_session)),
        active_map.get(_active_preset_key(active_avatar_id, "global")),
        active_map.get(_active_preset_key("global", "global")),
    ]
    candidate_ids.extend(value for value in active_map.values() if isinstance(value, str))
    preset_id = next((value for value in candidate_ids if value), None)
    preset = next((item for item in presets if item.preset_id == preset_id), None)
    if preset is None or not preset.gpt_sovits.reference_audio_id:
        return preset, None
    asset = next((item for item in assets if item.asset_id == preset.gpt_sovits.reference_audio_id), None)
    if asset is None:
        return preset, None
    reference_path = (Path(user_data) / asset.managed_path_token).resolve()
    reference_root = (Path(user_data) / "reference-audio").resolve()
    try:
        reference_path.relative_to(reference_root)
    except ValueError:
        loguru_logger.warning("[TTS-INIT] reference audio token escaped managed storage")
        return preset, None
    return preset, reference_path


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
    app.state.plugin_runtime_status = {
        "selectedPlugin": _active_plugin_id(),
        "loadedPlugin": None,
        "lifecycleState": "unknown/loading",
        "summary": "Plugin runtime is starting.",
        "developerDetails": None,
        "fallbackActive": False,
        "chatAvailable": True,
    }
    app.state.lock_state = {}
    app.state.hud_tap = HudTap()
    app.state.audio_config = load_audio_config_from_env()
    app.state.audio_provider_health = None

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
            plugin_failure_state = None
            plugin_failure_summary = None
            plugin_failure_details = None
            active_plugin_id = _active_plugin_id()
            try:
                manifests = discover_manifests(
                    _repo_root() / "plugins",
                    _user_plugins_dir(),
                    strict=False,
                )
                manifest_path = manifests.get(active_plugin_id)
                if manifest_path is not None:
                    plugin_manifest = load_manifest(manifest_path)
                    plugin_manifest_watcher = start_manifest_change_watcher(
                        manifest_path,
                        plugin_manifest,
                    )
                else:
                    plugin_failure_state = "invalid manifest"
                    plugin_failure_summary = (
                        f"Selected plugin '{active_plugin_id}' has no valid manifest; using fallback/null motion."
                    )
                    plugin_failure_details = (
                        "The plugin was not found in the valid manifest catalog. "
                        "Check plugin.yaml syntax, required fields, api_version, and duplicate names."
                    )
                    loguru_logger.warning("[PLUGIN] active plugin not found: {}", active_plugin_id)
            except Exception as exc:
                plugin_failure_state = "load failed"
                plugin_failure_summary = "Plugin discovery failed; using fallback/null motion."
                plugin_failure_details = repr(exc)
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
                except Exception as exc:
                    plugin_failure_state = "load failed"
                    plugin_failure_summary = (
                        f"Selected plugin '{active_plugin_id}' could not be imported; using fallback/null motion."
                    )
                    plugin_failure_details = repr(exc)
                    loguru_logger.exception("[PLUGIN] instance load failed; using NullPlugin")

            persona = _persona_path(avatars, avatar_dir).read_text(encoding="utf-8")
            voice_model = overrides.voice.model if overrides.voice else "en_US-amy-medium"
            active_voice_preset, reference_audio_path = _load_active_voice_preset_and_reference(active_avatar_id)
            tts_gateway = build_tts_gateway(
                audio_config=app.state.audio_config,
                repo_root=Path(__file__).resolve().parents[4],
                avatar_voice_model=voice_model,
                active_voice_preset=active_voice_preset,
                reference_audio_path=reference_audio_path,
            )
            tts_gateway.boot()
            app.state.audio_provider_health = tts_gateway.provider.health()

            gateway = LLMGateway(provider_cfg)
            await _warmup_ping(gateway)

            compositor_speech_queue: asyncio.Queue = asyncio.Queue()
            compositor_sentence_complete_queue: asyncio.Queue = asyncio.Queue()
            pending_inputs: asyncio.Queue[str] = asyncio.Queue()
            plugin_supervisor = await PluginSupervisor.load_or_null(
                plugin,
                capabilities,
                overrides,
                selected_plugin_name=active_plugin_id,
                loaded_plugin_name=plugin_manifest.name if plugin_manifest is not None else None,
                failure_state=plugin_failure_state or "load failed",
                failure_summary=plugin_failure_summary,
                failure_details=plugin_failure_details,
            )
            app.state.plugin_runtime_status = plugin_supervisor.runtime_status()
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
                provider=tts_gateway.provider,
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
            cursor_drv = CursorDriver() if _cursor_tracking_enabled() else None
            if cursor_drv is None:
                loguru_logger.info("[CURSOR] tracking disabled by stored Settings toggle.")
            compositor = Compositor(
                writer=writer,
                idle_driver=idle_drv,
                speech_driver=speech_drv,
                plugin_driver=plugin_adapter,
                capabilities=capabilities,
                cursor_driver=cursor_drv,
                lock_state=app.state.lock_state,
                hud_tap=app.state.hud_tap,
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
        except Exception as exc:
            loguru_logger.exception("Orchestrator construction failed.")
            app.state.orchestrator = None
            app.state.tts_gateway = None
            app.state.turn_loop_task = None
            app.state.startup_error_message = (
                "TTS failed to initialize. Check the Piper model and audio output, then restart."
            )
            from contracts import AudioProviderHealth

            app.state.audio_provider_health = AudioProviderHealth(
                provider_id="piper",
                kind="tts",
                state="misconfigured",
                summary=app.state.startup_error_message,
                detail=repr(exc),
                retryable=True,
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


@app.websocket("/hud/ws")
async def hud_websocket_endpoint(ws: WebSocket) -> None:
    from .hud_handlers import hud_push_loop, route_hud_c2s

    await ws.accept()
    hud_tap: HudTap = app.state.hud_tap
    queue = hud_tap.subscribe()
    push_task = asyncio.create_task(hud_push_loop(ws, queue))
    try:
        while True:
            raw = await ws.receive_json()
            await route_hud_c2s(ws, raw, app.state)
    except WebSocketDisconnect:
        log.info("HUD WS client disconnected.")
    except Exception:  # noqa: BLE001 -- log everything, never let WS handler crash the app
        log.exception("HUD WS handler error; closing connection.")
        try:
            await ws.close(code=1011)
        except Exception:
            pass
    finally:
        push_task.cancel()
        try:
            await push_task
        except (asyncio.CancelledError, Exception):
            pass
        hud_tap.unsubscribe(queue)


# /admin router for LLM setup test (Task 3 / PLUMB-04).
from ..llm.setup_test import router as admin_router  # noqa: E402

app.include_router(admin_router)
app.include_router(admin_avatar.router)
app.include_router(admin_rig_capabilities.router)
app.include_router(admin_plugin.router)
app.include_router(admin_status.router)
app.include_router(admin_audio.router)
