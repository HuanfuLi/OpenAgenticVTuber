"""HudTap fanout + 15Hz decimation tests."""

from __future__ import annotations

import pytest

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities
from sidecar.compositor import Compositor, HudTap

from .conftest import StubDriver, StubPluginDriver


def _caps() -> RigCapabilities:
    return RigCapabilities(
        writable_param_ids=["FaceAngleX", "MouthOpen", "ParamAngleX", "ParamJoy"],
    )


@pytest.mark.asyncio
async def test_hud_tap_fanout_one_subscriber() -> None:
    tap = HudTap()
    q = tap.subscribe()
    frame = ParamFrame(add_params={"FaceAngleX": 0.1}, tick_n=4)
    tap.publish(frame, {"ParamAngleX": 0.5})
    received = q.get_nowait()
    assert received[0].add_params["FaceAngleX"] == pytest.approx(0.1)
    assert received[1] == {"ParamAngleX": 0.5}


@pytest.mark.asyncio
async def test_hud_tap_drop_tail_on_full_queue() -> None:
    tap = HudTap()
    q = tap.subscribe()
    for i in range(9):
        tap.publish(ParamFrame(tick_n=i), {})
    assert q.qsize() == 8
    first = q.get_nowait()
    assert first[0].tick_n >= 1


@pytest.mark.asyncio
async def test_hud_tap_unsubscribe_removes_subscriber() -> None:
    tap = HudTap()
    q = tap.subscribe()
    tap.unsubscribe(q)
    tap.publish(ParamFrame(tick_n=1), {})
    assert q.qsize() == 0


@pytest.mark.asyncio
async def test_compositor_publishes_at_15hz_decimation(recording_writer) -> None:
    """Compositor publishes to HudTap when tick_count % 4 == 0."""
    tap = HudTap()
    q = tap.subscribe()
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.1}),
        speech_driver=StubDriver(),
        plugin_driver=StubPluginDriver(),
        capabilities=_caps(),
        hud_tap=tap,
    )

    compositor._tick_count = 0
    await compositor._tick(0.0)
    assert q.qsize() == 1

    compositor._tick_count = 1
    await compositor._tick(1 / 60.0)
    compositor._tick_count = 2
    await compositor._tick(2 / 60.0)
    compositor._tick_count = 3
    await compositor._tick(3 / 60.0)
    assert q.qsize() == 1

    compositor._tick_count = 4
    await compositor._tick(4 / 60.0)
    assert q.qsize() == 2


@pytest.mark.asyncio
async def test_compositor_no_hud_tap_no_publish(recording_writer) -> None:
    """When hud_tap=None, compositor never publishes."""
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver(),
        speech_driver=StubDriver(),
        plugin_driver=StubPluginDriver(),
        capabilities=_caps(),
    )
    compositor._tick_count = 0
    await compositor._tick(0.0)
    assert len(recording_writer.frames) == 1
