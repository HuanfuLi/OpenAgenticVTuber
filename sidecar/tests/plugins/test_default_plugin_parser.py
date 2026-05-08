from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities


REPO_ROOT = Path(__file__).resolve().parents[3]


def _load_plugin_class():
    plugin_path = REPO_ROOT / "plugins" / "default" / "__init__.py"
    spec = importlib.util.spec_from_file_location("test_default_plugin_parser_entrypoint", plugin_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.DefaultPlugin


@pytest.mark.asyncio
async def test_extracts_supported_action_codes_case_insensitively() -> None:
    plugin = _load_plugin_class()(clock=lambda: 0.0)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleZ"]), AvatarOverrides())

    frames = [frame async for frame in plugin.on_token_stream("Hi [SMIRK] there [unknown].")]

    assert len(frames) == 1
    assert frames[0].add_params == {"FaceAngleZ": pytest.approx(0.0)}


@pytest.mark.asyncio
async def test_parser_buffers_split_action_tokens_across_sentence_chunks() -> None:
    plugin = _load_plugin_class()(clock=lambda: 0.0)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleZ"]), AvatarOverrides())

    assert [frame async for frame in plugin.on_token_stream("start [smi")] == []
    frames = [frame async for frame in plugin.on_token_stream("rk] done")]

    assert len(frames) == 1
    assert frames[0].add_params["FaceAngleZ"] == pytest.approx(0.0)


@pytest.mark.asyncio
async def test_ignores_joy_action_code() -> None:
    plugin = _load_plugin_class()(clock=lambda: 0.0)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleZ"]), AvatarOverrides())

    assert [frame async for frame in plugin.on_token_stream("[joy]")] == []
    assert plugin.active_action is None


@pytest.mark.asyncio
async def test_ignores_split_joy_action_code() -> None:
    plugin = _load_plugin_class()(clock=lambda: 0.0)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleZ"]), AvatarOverrides())

    assert [frame async for frame in plugin.on_token_stream("[jo")] == []
    assert [frame async for frame in plugin.on_token_stream("y]")] == []
    assert plugin.active_action is None


@pytest.mark.asyncio
async def test_ignores_unmatched_and_unsupported_brackets() -> None:
    plugin = _load_plugin_class()(clock=lambda: 0.0)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleZ"]), AvatarOverrides())

    assert [frame async for frame in plugin.on_token_stream("start [joystick] [bad")] == []
    assert [frame async for frame in plugin.on_token_stream(" still bad")] == []
