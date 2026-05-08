import asyncio
import json

import pytest

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities, Expression
from sidecar.compositor.easing import ease_out_cubic
from sidecar.compositor.intent_driver import IntentDriver, RAMP_IN_MS, RAMP_OUT_MS


class _ForbiddenWriter:
    class _Request:
        def requestTriggerHotKey(self, hotkey_id):
            raise AssertionError("HotkeyTriggerRequest forbidden for expression intents")

    vts_request = _Request()


def _write_joy_expression(tmp_path):
    expression_dir = tmp_path / "Expressions"
    expression_dir.mkdir()
    (expression_dir / "joy.exp3.json").write_text(
        json.dumps(
            {
                "Type": "Live2D Expression",
                "Parameters": [{"Id": "ParamJoy", "Value": 1.0, "Blend": "Add"}],
            }
        ),
        encoding="utf-8",
    )


def _driver(tmp_path, intent_queue, done_queue):
    _write_joy_expression(tmp_path)
    return IntentDriver(
        intent_queue,
        done_queue,
        writer=_ForbiddenWriter(),
        capabilities=AvatarCapabilities(
            expressions=[Expression(name="joy", file="joy.exp3.json")]
        ),
        avatar_dir=tmp_path,
    )


def _param_joy(frame):
    value, weight = frame["ParamJoy"]
    assert value == pytest.approx(1.0)
    return weight


def test_expression_intent_ramps_weighted_set_params_from_exp3(tmp_path):
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    intent_queue.put_nowait(
        ActionIntent(kind="expression", name="joy", strength=0.8, avatar_id="teto")
    )
    driver = _driver(tmp_path, intent_queue, done_queue)

    assert driver.tick(0.0) == {"ParamJoy": (pytest.approx(1.0), pytest.approx(0.0))}

    mid_weight = _param_joy(driver.tick((RAMP_IN_MS / 2.0) / 1000.0))
    expected_mid = 0.8 * ease_out_cubic(0.5)
    assert 0.0 < mid_weight < 0.8
    assert mid_weight == pytest.approx(expected_mid)

    full_weight = _param_joy(driver.tick(RAMP_IN_MS / 1000.0))
    assert full_weight == pytest.approx(0.8)


def test_sentence_complete_decays_expression_and_expires_by_ramp_out(tmp_path):
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    intent_queue.put_nowait(
        ActionIntent(kind="expression", name="joy", strength=0.8, avatar_id="teto")
    )
    driver = _driver(tmp_path, intent_queue, done_queue)

    driver.tick(RAMP_IN_MS / 1000.0)
    done_queue.put_nowait(1)
    end = 1.0

    decayed_weight = _param_joy(driver.tick(end + ((RAMP_OUT_MS / 2.0) / 1000.0)))
    expected_decayed = 0.8 * (1.0 - ease_out_cubic(0.5))
    assert 0.0 < decayed_weight < 0.8
    assert decayed_weight == pytest.approx(expected_decayed)

    assert driver.tick(end + (RAMP_OUT_MS / 1000.0)) == {}


def test_expression_intents_never_request_hotkeys(tmp_path):
    intent_queue: asyncio.Queue = asyncio.Queue()
    done_queue: asyncio.Queue = asyncio.Queue()
    intent_queue.put_nowait(
        ActionIntent(kind="expression", name="joy", strength=0.8, avatar_id="teto")
    )
    driver = _driver(tmp_path, intent_queue, done_queue)

    assert "ParamJoy" in driver.tick(0.0)
    done_queue.put_nowait(1)
    driver.tick(RAMP_IN_MS / 1000.0)
