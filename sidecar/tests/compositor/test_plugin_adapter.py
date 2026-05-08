from __future__ import annotations

import asyncio

from contracts import ParamFrame
from sidecar.compositor.plugin_adapter import PluginAdapter


class _Plugin:
    async def on_token_stream(self, sentence: str):
        yield ParamFrame(add_params={"FaceAngleX": 0.4})


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
