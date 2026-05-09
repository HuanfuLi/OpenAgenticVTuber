import asyncio

import pytest

from contracts import EventFire
from sidecar.vts import event_completion_tracker as tracker_module
from sidecar.vts.event_completion_tracker import EventCompletionTracker


@pytest.fixture
def sleep_spy(monkeypatch):
    delays: list[float] = []
    release = asyncio.Event()
    original_sleep = asyncio.sleep

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)
        await release.wait()

    monkeypatch.setattr(tracker_module.asyncio, "sleep", fake_sleep)
    return delays, release, original_sleep


@pytest.mark.asyncio
async def test_tracking_valid_duration_logs_after_exact_final_delay(
    sleep_spy, caplog
):
    delays, release, original_sleep = sleep_spy
    tracker = EventCompletionTracker()

    tracker.track(EventFire(name="wave", hotkey_id="hk-wave", duration_ms=2833))
    await original_sleep(0)

    assert delays == [2.833]
    assert tracker.in_flight_set() == {"hk-wave"}

    release.set()
    await tracker.close()
    assert "hotkey_id=hk-wave name=wave" in caplog.text


@pytest.mark.asyncio
async def test_tracking_duration_over_ten_seconds_is_not_clamped(sleep_spy):
    delays, release, original_sleep = sleep_spy
    tracker = EventCompletionTracker()

    tracker.track(EventFire(name="long", hotkey_id="hk-long", duration_ms=11000))
    await original_sleep(0)

    assert delays == [11.0]

    release.set()
    await tracker.close()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "event",
    [
        EventFire.model_construct(kind="event", name="missing", hotkey_id="hk-missing"),
        EventFire(name="zero", hotkey_id="hk-zero", duration_ms=0),
        EventFire(name="negative", hotkey_id="hk-negative", duration_ms=-1),
    ],
)
async def test_missing_zero_and_negative_durations_use_exact_fallback(
    event, sleep_spy
):
    delays, release, original_sleep = sleep_spy
    tracker = EventCompletionTracker()

    tracker.track(event)
    await original_sleep(0)

    assert delays == [10.0]

    release.set()
    await tracker.close()


@pytest.mark.asyncio
async def test_tracking_same_hotkey_twice_keeps_both_tasks_active(sleep_spy):
    delays, release, original_sleep = sleep_spy
    tracker = EventCompletionTracker()

    tracker.track(EventFire(name="wave", hotkey_id="hk-wave", duration_ms=100))
    tracker.track(EventFire(name="wave", hotkey_id="hk-wave", duration_ms=200))
    await original_sleep(0)

    assert delays == [0.1, 0.2]
    assert tracker.in_flight_set() == {"hk-wave"}
    assert len(tracker._tasks_by_hotkey["hk-wave"]) == 2

    release.set()
    await tracker.close()
