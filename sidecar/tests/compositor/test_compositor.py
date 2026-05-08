from __future__ import annotations

import pytest

from sidecar.compositor import Compositor

from .conftest import StubDriver, StubIntentDriver


@pytest.mark.asyncio
async def test_merge_modes_separates_add_and_set(recording_writer) -> None:
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.2}),
        speech_driver=StubDriver({"MouthOpen": 0.7, "FacePositionZ": -0.2}),
        intent_driver=StubIntentDriver({"ParamJoy": (0.9, 0.5)}),
    )

    await compositor._tick(0.0)

    frame = recording_writer.frames[-1]
    assert frame.add_params["FaceAngleX"] == pytest.approx(0.2)
    assert frame.add_params["FacePositionZ"] == pytest.approx(-0.2)
    assert frame.set_params["MouthOpen"] == pytest.approx((0.7, 1.0))
    assert frame.set_params["ParamJoy"] == pytest.approx((0.9, 0.5))
    assert "ParamJoy" not in frame.add_params
    assert "MouthOpen" not in frame.add_params


@pytest.mark.asyncio
async def test_idle_runs_continuously_when_no_other_driver(recording_writer) -> None:
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.15}),
        speech_driver=StubDriver(),
        intent_driver=StubIntentDriver(),
    )

    await compositor._tick(0.0)
    await compositor._tick(1.0 / 60.0)

    assert recording_writer.frames
    assert all("FaceAngleX" in frame.add_params for frame in recording_writer.frames)
