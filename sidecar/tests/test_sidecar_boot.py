"""Phase 1: end-to-end boot test — spawn sidecar, parse READY line, hit /health."""

import asyncio
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI

READY_RE = re.compile(r"^\[READY\] ws://127\.0\.0\.1:(\d+)/ws$")


@pytest.mark.asyncio
async def test_sidecar_boots_and_emits_ready_line():
    """Spawn the sidecar as a subprocess and confirm it emits the READY line
    within 10 seconds, then responds to GET /health on the bound port.
    """
    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    proc = subprocess.Popen(
        [sys.executable, "-m", "sidecar"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        text=True,
    )
    try:
        port = None
        deadline = time.monotonic() + 15.0
        while time.monotonic() < deadline:
            line = proc.stdout.readline() if proc.stdout else ""
            if not line:
                if proc.poll() is not None:
                    stderr = proc.stderr.read() if proc.stderr else ""
                    pytest.fail(f"Sidecar exited before READY: stderr={stderr!r}")
                await asyncio.sleep(0.05)
                continue
            m = READY_RE.match(line.strip())
            if m:
                port = int(m.group(1))
                break

        assert port is not None, "Sidecar did not emit [READY] within 15s"

        # Confirm /health responds. Give uvicorn a brief moment to enter accept loop.
        await asyncio.sleep(0.1)
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://127.0.0.1:{port}/health")
            assert resp.status_code == 200
            assert resp.json() == {"status": "ok"}
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()


def _provider_cfg():
    return SimpleNamespace(provider="custom", endpoint="http://localhost:1234/v1", api_key="", model="test")


def _avatar_overrides(*, variants=None, events=None):
    from contracts import AvatarOverrides

    return AvatarOverrides(
        variants=variants or [],
        events=events or [],
    )


def _rig_capabilities(*, hotkeys=None):
    from contracts import RigCapabilities

    return RigCapabilities(hotkeys=hotkeys or [])


async def _never():
    await asyncio.Event().wait()


def _patch_clean_boot(monkeypatch, tmp_path, *, overrides, capabilities, plugin_manifest):
    from sidecar.ws import server

    avatar_dir = tmp_path / "avatars" / "teto"
    avatar_dir.mkdir(parents=True)
    (avatar_dir / "personality.md").write_text("persona", encoding="utf-8")
    manifest_path = tmp_path / "plugins" / "default" / "plugin.yaml"
    manifest_path.parent.mkdir(parents=True)
    manifest_path.write_text("name: default\n", encoding="utf-8")

    calls: list[str] = []

    class FakeTTSGateway:
        def __init__(self, model_path):
            self.model_path = model_path
            self.voice = "voice"
            self.stream = object()
            self.provider = SimpleNamespace(
                health=lambda: SimpleNamespace(model_dump=lambda: {
                    "provider_id": "piper",
                    "kind": "tts",
                    "state": "ok",
                    "summary": "Piper provider ready.",
                    "detail": "voice=en_US-amy-medium",
                    "retryable": False,
                    "latency_ms": None,
                    "redacted_diagnostics": None,
                })
            )

        def boot(self):
            calls.append("tts.boot")

        def shutdown(self):
            calls.append("tts.shutdown")

    class FakeGateway:
        def __init__(self, provider_cfg):
            self.provider_cfg = provider_cfg

    class FakePluginSupervisor:
        @classmethod
        async def load_or_null(cls, plugin, caps, loaded_overrides, **_kwargs):
            calls.append("plugin_supervisor.load")
            assert caps is capabilities
            assert loaded_overrides is overrides
            return cls()

        async def close(self):
            calls.append("plugin_supervisor.close")

        def runtime_status(self):
            return {
                "selectedPlugin": "default",
                "loadedPlugin": "default",
                "lifecycleState": "active",
                "summary": "Plugin active.",
                "developerDetails": None,
                "fallbackActive": False,
                "chatAvailable": True,
            }

    class FakePluginAdapter:
        def __init__(self, supervisor):
            calls.append("plugin_adapter")
            self.supervisor = supervisor

    class FakeWriter:
        async def close(self):
            calls.append("writer.close")

    class FakeDispatcher:
        def __init__(self, writer):
            calls.append("dispatcher")
            self.writer = writer

    class FakeVariantStateManager:
        def __init__(self, dispatcher, reset_hotkey_id=None):
            calls.append(f"variant_manager:{reset_hotkey_id}")
            self.dispatcher = dispatcher
            self.reset_hotkey_id = reset_hotkey_id

        async def reset_to_baseline(self):
            calls.append("variant.reset")

    class FakeEventCompletionTracker:
        def __init__(self):
            calls.append("event_tracker")

        async def close(self):
            calls.append("event_tracker.close")

    class FakeOrchestrator:
        def __init__(self, **kwargs):
            calls.append("orchestrator")
            self.kwargs = kwargs

        async def _turn_loop(self):
            await _never()

    class FakeCompositor:
        def __init__(self, **kwargs):
            calls.append("compositor.init")
            self.kwargs = kwargs

        async def run(self):
            calls.append("compositor.run")
            await _never()

        async def stop(self):
            calls.append("compositor.stop")

    monkeypatch.setattr(server, "_load_provider_config_from_env", _provider_cfg)
    monkeypatch.setattr(server, "_avatars_root", lambda: tmp_path / "avatars")
    monkeypatch.setattr(server, "_repo_root", lambda: tmp_path)
    monkeypatch.setattr(server, "load_avatar_overrides", lambda _avatar_dir: overrides)
    monkeypatch.setattr(server, "build_rig_capabilities", lambda **_kwargs: capabilities)
    monkeypatch.setattr(server, "resolve_source_rig_path", lambda *_args, **_kwargs: avatar_dir)
    monkeypatch.setattr(server, "discover_manifests", lambda *_args, **_kwargs: {"default": manifest_path})
    monkeypatch.setattr(server, "load_manifest", lambda _path: plugin_manifest)
    monkeypatch.setattr(server, "start_manifest_change_watcher", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(server, "_load_plugin_instance", lambda *_args, **_kwargs: object())
    monkeypatch.setattr(server, "TTSGateway", FakeTTSGateway)
    monkeypatch.setattr(server, "build_tts_gateway", lambda **kwargs: FakeTTSGateway(kwargs["repo_root"] / "sidecar" / "models" / "piper" / f'{kwargs["avatar_voice_model"]}.onnx'))
    monkeypatch.setattr(server, "LLMGateway", FakeGateway)
    monkeypatch.setattr(server, "_warmup_ping", lambda _gateway: asyncio.sleep(0))
    monkeypatch.setattr(server, "PluginSupervisor", FakePluginSupervisor)
    monkeypatch.setattr(server, "PluginAdapter", FakePluginAdapter)
    monkeypatch.setattr(server, "PyvtsSafeWriter", FakeWriter)
    monkeypatch.setattr(server, "DiscreteDispatcher", FakeDispatcher)
    monkeypatch.setattr(server, "VariantStateManager", FakeVariantStateManager, raising=False)
    monkeypatch.setattr(server, "EventCompletionTracker", FakeEventCompletionTracker, raising=False)
    monkeypatch.setattr(server, "Orchestrator", FakeOrchestrator)
    monkeypatch.setattr(server, "Compositor", FakeCompositor)

    async def fake_handshake(_writer):
        calls.append("handshake")
        return True

    monkeypatch.setattr(server, "connect_and_authenticate", fake_handshake)

    return server, calls


def _uat_path():
    root = Path(__file__).resolve().parents[2]
    active = root / ".planning" / "phases" / "07-three-category-code-parsing-dispatch" / "07-HUMAN-UAT.md"
    if active.exists():
        return active
    return (
        root
        / ".planning"
        / "milestones"
        / "v2.0-phases"
        / "07-three-category-code-parsing-dispatch"
        / "07-HUMAN-UAT.md"
    )


@pytest.mark.asyncio
async def test_collision_raises_before_vts_connect(monkeypatch, tmp_path):
    from contracts import VariantEntry
    from sidecar.parser.reserved import CategoryCollisionError
    from sidecar.plugins.manifest import PluginActionCode, PluginManifest

    plugin_manifest = PluginManifest(
        name="default",
        version="1.0.0",
        entrypoint="plugin.py:Plugin",
        api_version="1.0",
        action_codes=[PluginActionCode(code="joy", description="joy action")],
    )
    overrides = _avatar_overrides(
        variants=[VariantEntry(code="joy", hotkey_id="hk-v", source_name="Joy")]
    )
    server, calls = _patch_clean_boot(
        monkeypatch,
        tmp_path,
        overrides=overrides,
        capabilities=_rig_capabilities(),
        plugin_manifest=plugin_manifest,
    )

    with pytest.raises(CategoryCollisionError):
        async with server.lifespan(FastAPI()):
            pass

    assert "handshake" not in calls


@pytest.mark.asyncio
async def test_reserved_event_raises_before_vts_connect(monkeypatch, tmp_path):
    from contracts import EventEntry
    from sidecar.parser.reserved import ReservedNameError
    from sidecar.plugins.manifest import PluginManifest

    plugin_manifest = PluginManifest(
        name="default",
        version="1.0.0",
        entrypoint="plugin.py:Plugin",
        api_version="1.0",
        action_codes=[],
    )
    overrides = _avatar_overrides(
        events=[
            EventEntry(
                code="think",
                hotkey_id="hk-e",
                motion_file="think.motion3.json",
                duration_seconds=1.0,
            )
        ]
    )
    server, calls = _patch_clean_boot(
        monkeypatch,
        tmp_path,
        overrides=overrides,
        capabilities=_rig_capabilities(),
        plugin_manifest=plugin_manifest,
    )

    with pytest.raises(ReservedNameError):
        async with server.lifespan(FastAPI()):
            pass

    assert "handshake" not in calls


@pytest.mark.asyncio
async def test_clean_boot_constructs_managers_resets_and_closes_tracker_before_writer(monkeypatch, tmp_path):
    from contracts import Hotkey
    from sidecar.plugins.manifest import PluginActionCode, PluginManifest

    plugin_manifest = PluginManifest(
        name="default",
        version="1.0.0",
        entrypoint="plugin.py:Plugin",
        api_version="1.0",
        action_codes=[PluginActionCode(code="neutral", description="neutral action")],
    )
    server, calls = _patch_clean_boot(
        monkeypatch,
        tmp_path,
        overrides=_avatar_overrides(),
        capabilities=_rig_capabilities(
            hotkeys=[
                Hotkey(
                    name="RemoveAllExpressions",
                    type="RemoveAllExpressions",
                    hotkey_id="hk-reset",
                )
            ]
        ),
        plugin_manifest=plugin_manifest,
    )

    app = FastAPI()
    async with server.lifespan(app):
        await asyncio.sleep(0)
        assert app.state.variant_state_manager.reset_hotkey_id == "hk-reset"
        assert app.state.event_completion_tracker is not None
        assert calls.index("handshake") < calls.index("variant.reset") < calls.index("compositor.run")

    assert calls.index("event_tracker.close") < calls.index("writer.close")


@pytest.mark.asyncio
async def test_clean_boot_passes_plugin_manifest_and_overrides_to_dispatch_prompt_builder(
    monkeypatch,
    tmp_path,
):
    from contracts import EventEntry, VariantEntry
    from sidecar.plugins.manifest import PluginActionCode, PluginManifest

    plugin_manifest = PluginManifest(
        name="default",
        version="1.0.0",
        entrypoint="plugin.py:Plugin",
        api_version="1.0",
        action_codes=[PluginActionCode(code="smirk", description="sly smile")],
    )
    overrides = _avatar_overrides(
        variants=[VariantEntry(code="heart-eye", hotkey_id="hk-v", source_name="Heart Eye")],
        events=[
            EventEntry(
                code="wave",
                hotkey_id="hk-e",
                motion_file="wave.motion3.json",
                duration_seconds=1.5,
            )
        ],
    )
    server, calls = _patch_clean_boot(
        monkeypatch,
        tmp_path,
        overrides=overrides,
        capabilities=_rig_capabilities(),
        plugin_manifest=plugin_manifest,
    )
    builder_calls = []

    def fake_build_dispatch_codes_section(manifest, loaded_overrides):
        builder_calls.append((manifest, loaded_overrides))
        return "COMBINED DISPATCH SECTION"

    monkeypatch.setattr(
        server,
        "build_dispatch_codes_section",
        fake_build_dispatch_codes_section,
    )

    app = FastAPI()
    async with server.lifespan(app):
        await asyncio.sleep(0)

    assert builder_calls == [(plugin_manifest, overrides)]
    assert app.state.orchestrator.kwargs["action_codes_section"] == "COMBINED DISPATCH SECTION"
    assert calls.index("plugin_supervisor.load") < calls.index("orchestrator")


@pytest.mark.asyncio
async def test_clean_boot_logs_empty_event_catalog_as_uat_blocked(
    monkeypatch,
    tmp_path,
):
    from contracts import VariantEntry
    from loguru import logger
    from sidecar.plugins.manifest import PluginActionCode, PluginManifest

    plugin_manifest = PluginManifest(
        name="default",
        version="1.0.0",
        entrypoint="plugin.py:Plugin",
        api_version="1.0",
        action_codes=[PluginActionCode(code="smirk", description="sly smile")],
    )
    overrides = _avatar_overrides(
        variants=[VariantEntry(code="heart-eye", hotkey_id="hk-v", source_name="Heart Eye")],
        events=[],
    )
    server, _calls = _patch_clean_boot(
        monkeypatch,
        tmp_path,
        overrides=overrides,
        capabilities=_rig_capabilities(),
        plugin_manifest=plugin_manifest,
    )
    monkeypatch.setattr(
        server,
        "build_dispatch_codes_section",
        lambda *_args, **_kwargs: "COMBINED DISPATCH SECTION",
    )
    messages: list[str] = []
    sink_id = logger.add(lambda msg: messages.append(msg.record["message"]), level="INFO")
    try:
        app = FastAPI()
        async with server.lifespan(app):
            await asyncio.sleep(0)
    finally:
        logger.remove(sink_id)

    assert any(
        "[DISPATCH-CATALOG] active_avatar=teto actions=1 variants=1 events=0" in message
        for message in messages
    )
    assert any(
        "[DISPATCH-CATALOG-BLOCKED] live event UAT requires an active avatar catalog with at least one event."
        in message
        for message in messages
    )


def test_phase_7_human_uat_marks_empty_event_catalog_as_blocked() -> None:
    text = Path(_uat_path()).read_text(encoding="utf-8")

    assert "AGENTICLLMVTUBER_ACTIVE_AVATAR=重音テト" in text
    assert "events: []" in text
    assert "blocked" in text.lower()
    assert "not a parser/routing failure" in text
