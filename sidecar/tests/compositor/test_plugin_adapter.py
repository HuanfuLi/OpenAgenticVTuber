from __future__ import annotations

import asyncio

from contracts import ParamFrame
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from plugins.default import DefaultPlugin
from sidecar.compositor.plugin_adapter import PluginAdapter
from sidecar.plugins.supervisor import PluginSupervisor


class _Plugin:
    async def on_token_stream(self, sentence: str):
        yield ParamFrame(add_params={"FaceAngleX": 0.4})


class _FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_latest_frame_wins() -> None:
    adapter = PluginAdapter(_Plugin())

    adapter.submit_frame(ParamFrame(add_params={"FaceAngleX": 0.1}), now=1.0)
    adapter.submit_frame(ParamFrame(add_params={"FaceAngleX": 0.8}), now=1.01)

    assert adapter.tick(1.02).add_params == {"FaceAngleX": 0.8}


def test_holds_last_frame_until_stale() -> None:
    adapter = PluginAdapter(_Plugin())
    adapter.submit_frame(ParamFrame(set_params={"ParamJoy": (0.5, 0.75)}), now=1.0)

    assert adapter.tick(1.5).set_params == {"ParamJoy": (0.5, 0.75)}
    assert adapter.tick(2.01) == ParamFrame()


def test_empty_before_first_frame() -> None:
    adapter = PluginAdapter(_Plugin())

    assert adapter.tick(0.0) == ParamFrame()


def test_enqueue_sentence_feeds_plugin_input() -> None:
    async def run() -> None:
        adapter = PluginAdapter(_Plugin())
        adapter.enqueue_sentence("hello")
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        assert adapter.tick(asyncio.get_running_loop().time()).add_params == {"FaceAngleX": 0.4}

    asyncio.run(run())


def test_enqueue_smirk_renders_nonzero_timed_frames() -> None:
    async def run() -> None:
        clock = _FakeClock()
        plugin = DefaultPlugin(clock=clock)
        plugin.on_load(
            RigCapabilities(
                writable_param_ids=[
                    "FaceAngleZ",
                    "FaceAngleY",
                    "EyeOpenLeft",
                    "EyeOpenRight",
                ]
            ),
            AvatarOverrides(),
        )
        adapter = PluginAdapter(plugin)

        adapter.enqueue_sentence("[smirk]")
        await asyncio.sleep(0)
        await asyncio.sleep(0)

        clock.now = 0.15
        frame_150 = adapter.tick(0.15)
        clock.now = 0.30
        frame_300 = adapter.tick(0.30)
        clock.now = 0.95
        frame_950 = adapter.tick(0.95)

        assert any(
            value != 0.0
            for key, value in frame_150.add_params.items()
            if key.startswith("FaceAngle") or key.startswith("EyeOpen")
        )
        assert frame_300.add_params["FaceAngleZ"] >= frame_150.add_params["FaceAngleZ"]
        assert (
            frame_950.add_params == {}
            or all(value == 0.0 for value in frame_950.add_params.values())
        )
        assert plugin.active_action is None

    asyncio.run(run())


def test_supervised_default_plugin_render_frame_drives_smirk_ramp() -> None:
    async def run() -> None:
        clock = _FakeClock()
        plugin = DefaultPlugin(clock=clock)
        supervisor = await PluginSupervisor.load_or_null(
            plugin,
            RigCapabilities(
                writable_param_ids=[
                    "FaceAngleZ",
                    "FaceAngleY",
                    "EyeOpenLeft",
                    "EyeOpenRight",
                ]
            ),
            AvatarOverrides(),
            load_timeout_seconds=0.1,
        )
        adapter = PluginAdapter(supervisor)

        adapter.enqueue_sentence("[smirk]")
        await asyncio.sleep(0)
        await asyncio.sleep(0)

        clock.now = 0.15
        frame_150 = adapter.tick(0.15)
        clock.now = 0.30
        frame_300 = adapter.tick(0.30)
        clock.now = 0.95
        frame_950 = adapter.tick(0.95)

        assert any(
            value > 0.0
            for key, value in frame_150.add_params.items()
            if key.startswith("FaceAngle") or key.startswith("EyeOpen")
        )
        assert any(
            value > 0.0
            for key, value in frame_300.add_params.items()
            if key.startswith("FaceAngle") or key.startswith("EyeOpen")
        )
        assert (
            frame_950.add_params == {}
            or all(value == 0.0 for value in frame_950.add_params.values())
        )

    asyncio.run(run())
