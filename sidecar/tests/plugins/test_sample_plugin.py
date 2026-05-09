from __future__ import annotations

from pathlib import Path

import pytest

from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities
from plugins.sample_motion import SampleMotionPlugin
from sidecar.plugins.loader import load_manifest


def test_sample_motion_manifest_is_valid() -> None:
    manifest = load_manifest(Path(__file__).resolve().parents[3] / "plugins" / "sample_motion" / "plugin.yaml")

    assert manifest.name == "sample_motion"
    assert manifest.entrypoint == "__init__.py:SampleMotionPlugin"
    assert {action.code for action in manifest.action_codes} == {"nod", "lean"}


@pytest.mark.asyncio
async def test_sample_motion_initializes_and_generates_finite_frame() -> None:
    plugin = SampleMotionPlugin(clock=lambda: 0.2)
    plugin.on_load(
        RigCapabilities(writable_param_ids=["FaceAngleX", "FacePositionZ"]),
        AvatarOverrides(),
    )

    frames = [frame async for frame in plugin.on_token_stream("Sure [nod]")]

    assert len(frames) == 1
    assert set(frames[0].add_params) == {"FaceAngleX"}
    assert all(isinstance(value, float) for value in frames[0].add_params.values())


def test_sample_motion_skips_unsupported_params() -> None:
    plugin = SampleMotionPlugin(clock=lambda: 0.2)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleX"]), AvatarOverrides())
    plugin.on_action_code(type("Action", (), {"name": "lean"})())

    frame = plugin.render_frame(now=0.3)

    assert frame.add_params == {}
