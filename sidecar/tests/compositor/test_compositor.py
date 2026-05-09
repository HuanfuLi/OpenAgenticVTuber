from __future__ import annotations

import pytest

from sidecar.compositor import Compositor

from contracts import ParamFrame
from contracts.rig_capabilities import RigCapabilities

from .conftest import StubDriver, StubPluginDriver


def _caps() -> RigCapabilities:
    return RigCapabilities(
        writable_param_ids=[
            "FaceAngleX",
            "FacePositionZ",
            "MouthOpen",
            "ParamAngleX",
            "ParamJoy",
        ]
    )


@pytest.mark.asyncio
async def test_merge_modes_separates_add_and_set(recording_writer) -> None:
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.2}),
        speech_driver=StubDriver({"MouthOpen": 0.7, "FacePositionZ": -0.2}),
        plugin_driver=StubPluginDriver(ParamFrame(set_params={"ParamJoy": (0.9, 0.5)})),
        capabilities=_caps(),
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
        plugin_driver=StubPluginDriver(),
        capabilities=_caps(),
    )

    await compositor._tick(0.0)
    await compositor._tick(1.0 / 60.0)

    assert recording_writer.frames
    assert all("FaceAngleX" in frame.add_params for frame in recording_writer.frames)


@pytest.mark.asyncio
async def test_lock_overrides_plugin_set_param(recording_writer) -> None:
    """HUD-05 / ARCH-05: lock applied LAST overrides plugin set_params."""
    lock_state = {"FaceAngleX": 0.7}
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.0}),
        speech_driver=StubDriver(),
        plugin_driver=StubPluginDriver(
            ParamFrame(set_params={"FaceAngleX": (0.3, 1.0)})
        ),
        capabilities=_caps(),
        lock_state=lock_state,
    )
    await compositor._tick(0.0)
    frame = recording_writer.frames[-1]
    assert frame.set_params["FaceAngleX"] == pytest.approx((0.7, 1.0))
    assert "FaceAngleX" not in frame.add_params


@pytest.mark.asyncio
async def test_lock_overrides_idle_add_param(recording_writer) -> None:
    """Lock wins against additive idle writes."""
    lock_state = {"FaceAngleX": 0.5}
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.2}),
        speech_driver=StubDriver(),
        plugin_driver=StubPluginDriver(),
        capabilities=_caps(),
        lock_state=lock_state,
    )
    await compositor._tick(0.0)
    frame = recording_writer.frames[-1]
    assert frame.set_params["FaceAngleX"] == pytest.approx((0.5, 1.0))
    assert "FaceAngleX" not in frame.add_params


@pytest.mark.asyncio
async def test_lock_resolves_cubism_output_to_vts_input(recording_writer) -> None:
    lock_state = {"ParamAngleX": 0.5}
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.2}),
        speech_driver=StubDriver(),
        plugin_driver=StubPluginDriver(),
        capabilities=_caps(),
        lock_state=lock_state,
    )
    await compositor._tick(0.0)
    frame = recording_writer.frames[-1]
    assert frame.set_params["FaceAngleX"] == pytest.approx((0.5, 1.0))
    assert "FaceAngleX" not in frame.add_params


@pytest.mark.asyncio
async def test_lock_skips_system_primitive_override(recording_writer) -> None:
    """Even if MouthOpen ends up in lock_state, compositor skips it."""
    lock_state = {"MouthOpen": 0.99}
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver(),
        speech_driver=StubDriver({"MouthOpen": 0.5}),
        plugin_driver=StubPluginDriver(),
        capabilities=_caps(),
        lock_state=lock_state,
    )
    await compositor._tick(0.0)
    frame = recording_writer.frames[-1]
    assert frame.set_params["MouthOpen"] == pytest.approx((0.5, 1.0))


@pytest.mark.asyncio
async def test_lock_state_default_empty_when_omitted(recording_writer) -> None:
    """Backwards compatibility: existing call sites that omit lock_state work unchanged."""
    compositor = Compositor(
        writer=recording_writer,
        idle_driver=StubDriver({"FaceAngleX": 0.1}),
        speech_driver=StubDriver(),
        plugin_driver=StubPluginDriver(),
        capabilities=_caps(),
    )
    await compositor._tick(0.0)
    frame = recording_writer.frames[-1]
    assert frame.add_params["FaceAngleX"] == pytest.approx(0.1)
