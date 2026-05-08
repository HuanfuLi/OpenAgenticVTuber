from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from contracts.action_binding import DefaultPluginActionBinding
from contracts.avatar_overrides import AvatarOverrides
from contracts.rig_capabilities import RigCapabilities


REPO_ROOT = Path(__file__).resolve().parents[3]


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def _load_plugin_class():
    return _load_plugin_module().DefaultPlugin


def _load_plugin_module():
    plugin_path = REPO_ROOT / "plugins" / "default" / "__init__.py"
    spec = importlib.util.spec_from_file_location("test_default_plugin_entrypoint", plugin_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def _collect(plugin, sentence: str):
    return [frame async for frame in plugin.on_token_stream(sentence)]


@pytest.mark.asyncio
async def test_emits_param_frame_for_each_supported_non_neutral_emotion() -> None:
    plugin_class = _load_plugin_class()
    for action_code in ("anger", "disgust", "fear", "sadness", "smirk", "surprise"):
        plugin = plugin_class(clock=lambda: 0.3)
        plugin.on_load(
            RigCapabilities(writable_param_ids=["FaceAngleZ", "FaceAngleY", "FacePositionZ", "EyeOpenLeft", "EyeOpenRight"]),
            AvatarOverrides(),
        )

        frames = await _collect(plugin, f"[{action_code}]")

        assert len(frames) == 1
        assert frames[0].add_params


@pytest.mark.asyncio
async def test_neutral_action_emits_empty_reset_frame() -> None:
    plugin = _load_plugin_class()(clock=lambda: 0.0)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleZ"]), AvatarOverrides())

    frames = await _collect(plugin, "[neutral]")

    assert frames == []
    assert plugin.active_action is None


@pytest.mark.asyncio
async def test_smirk_ramps_in_and_out_over_expected_windows() -> None:
    clock = FakeClock()
    plugin = _load_plugin_class()(clock=clock)
    plugin.on_load(RigCapabilities(writable_param_ids=["FaceAngleZ"]), AvatarOverrides())

    frame_0 = (await _collect(plugin, "[smirk]"))[0]
    clock.now = 0.15
    frame_150 = (await _collect(plugin, "continue"))[0]
    clock.now = 0.3
    frame_300 = (await _collect(plugin, "continue"))[0]
    clock.now = 0.9
    frame_900 = (await _collect(plugin, "continue"))[0]

    assert frame_0.add_params["FaceAngleZ"] == pytest.approx(0.0)
    assert frame_150.add_params["FaceAngleZ"] == pytest.approx(0.035)
    assert frame_300.add_params["FaceAngleZ"] == pytest.approx(0.07)
    assert frame_900.add_params["FaceAngleZ"] == pytest.approx(0.0)
    assert plugin.active_action is None


@pytest.mark.asyncio
async def test_avatar_override_binding_selects_composition_source_without_exp3_output() -> None:
    clock = FakeClock()
    plugin = _load_plugin_class()(clock=clock)
    plugin.on_load(
        RigCapabilities(writable_param_ids=["FaceAngleZ"]),
        AvatarOverrides(
            default_plugin_action_bindings=[
                DefaultPluginActionBinding(action_code="smirk", expression_index=0, expression_name="Smirk", source="manual")
            ]
        ),
    )

    assert await _collect(plugin, "[smirk]")
    clock.now = 0.3
    frames = await _collect(plugin, "continue")

    assert frames[0].add_params == {"FaceAngleZ": pytest.approx(0.07)}
    assert plugin.composition_sources["smirk"] == "manual:Smirk"


def test_body_sway_registry_exposes_only_head_only() -> None:
    from plugins.default.body_sway.registry import available_strategy_names, build_strategy

    assert available_strategy_names() == ("head_only",)
    assert build_strategy("head_only").name == "head_only"
    with pytest.raises(ValueError, match="Only head_only"):
        build_strategy("proxy_param")
    with pytest.raises(ValueError, match="Only head_only"):
        build_strategy("exp3_modulation")


def test_on_load_warns_and_uses_head_only_for_unsupported_body_sway(monkeypatch: pytest.MonkeyPatch) -> None:
    module = _load_plugin_module()
    warnings: list[tuple[str, str]] = []
    monkeypatch.setattr(
        module.logger,
        "warning",
        lambda message, strategy: warnings.append((message, strategy)),
    )
    plugin = module.DefaultPlugin()

    plugin.on_load(RigCapabilities(), AvatarOverrides(body_sway_strategy="proxy_param"))

    assert plugin.body_sway_strategy.name == "head_only"
    assert warnings == [
        (
            "[DEFAULT-PLUGIN] unsupported body_sway_strategy=%s; using head_only",
            "proxy_param",
        )
    ]
