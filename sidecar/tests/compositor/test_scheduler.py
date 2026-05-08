from __future__ import annotations

import asyncio

import pytest

from sidecar.compositor import Compositor

from .conftest import StubDriver, StubIntentDriver


@pytest.mark.asyncio
async def test_60hz_tick_count(recording_writer) -> None:
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.1}),
        speech_driver=StubDriver(),
        intent_driver=StubIntentDriver(),
    )
    task = asyncio.create_task(compositor.run())

    await asyncio.sleep(1.0)
    await compositor.stop()
    await task

    assert 58 <= len(recording_writer.frames) <= 62


@pytest.mark.asyncio
async def test_strategy_swap_gates_at_tick_boundary(recording_writer) -> None:
    swap_log: list[str] = []

    class TrackingSpeechDriver(StubDriver):
        def swap_strategy(self, name: str) -> None:
            swap_log.append(name)

    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.1}),
        speech_driver=TrackingSpeechDriver(),
        intent_driver=StubIntentDriver(),
    )

    await compositor._tick(0.0)
    compositor.request_strategy_swap("proxy_param")
    assert swap_log == []

    await compositor._tick(1.0 / 60.0)
    assert swap_log == ["proxy_param"]
