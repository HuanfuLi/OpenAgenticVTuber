import asyncio
from typing import Any

import pytest
from contracts import SpeechEnvelopePayload

from sidecar.vts.parameter_writer import PyVTSParameterWriter
from sidecar.vts.speech_mouth_driver import SpeechMouthDriver


class _FakeWriter:
    def __init__(self) -> None:
        self.writes: list[dict[str, Any]] = []

    async def write_parameter(
        self,
        param_id: str,
        value: float,
        *,
        weight: float = 1.0,
        mode: str = "set",
        face_found: bool = False,
    ) -> None:
        self.writes.append(
            {
                "param_id": param_id,
                "value": value,
                "weight": weight,
                "mode": mode,
                "face_found": face_found,
            }
        )


class _FakeClock:
    def __init__(self, values: list[float]) -> None:
        self._values = iter(values)
        self.last = values[-1] if values else 0.0

    def __call__(self) -> float:
        try:
            self.last = next(self._values)
        except StopIteration:
            pass
        return self.last


@pytest.mark.asyncio
async def test_drive_envelope_writes_mouthopen_and_closes():
    writer = _FakeWriter()
    clock = _FakeClock([0.0, 0.02, 0.04, 0.06])
    driver = SpeechMouthDriver(writer=writer, now=clock, tick_seconds=0.0)

    await driver.drive_envelope(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=[0.0, 0.5, 1.0],
            slice_length=20,
            started_at=0.0,
        )
    )

    assert len(writer.writes) >= 4
    assert all(write["param_id"] == "MouthOpen" for write in writer.writes)
    assert writer.writes[-1]["value"] == 0.0
    assert [write["value"] for write in writer.writes[:-1]][:3] == [0.0, 0.5, 1.0]


@pytest.mark.asyncio
async def test_drive_envelope_empty_volumes_only_closes():
    writer = _FakeWriter()
    driver = SpeechMouthDriver(writer=writer, now=_FakeClock([0.0]), tick_seconds=0.0)

    await driver.drive_envelope(
        SpeechEnvelopePayload(
            sentence_id=2,
            volumes=[],
            slice_length=20,
            started_at=0.0,
        )
    )

    assert writer.writes == [
        {
            "param_id": "MouthOpen",
            "value": 0.0,
            "weight": 1.0,
            "mode": "set",
            "face_found": False,
        }
    ]


@pytest.mark.asyncio
async def test_drive_envelope_interpolates_half_step():
    writer = _FakeWriter()
    driver = SpeechMouthDriver(
        writer=writer,
        now=_FakeClock([0.03, 0.06]),
        tick_seconds=0.0,
    )

    await driver.drive_envelope(
        SpeechEnvelopePayload(
            sentence_id=3,
            volumes=[0.0, 0.4, 0.8],
            slice_length=20,
            started_at=0.0,
        )
    )

    assert writer.writes[0]["param_id"] == "MouthOpen"
    assert writer.writes[0]["value"] == pytest.approx(0.6)
    assert writer.writes[-1]["value"] == 0.0


def test_pyvts_writer_builds_inject_parameter_request():
    writer = PyVTSParameterWriter()

    request = writer._writer.vts_request.requestSetParameterValue(
        parameter="MouthOpen",
        value=0.75,
        weight=1.0,
        mode="set",
        face_found=False,
    )

    assert request["messageType"] == "InjectParameterDataRequest"
    assert request["data"]["parameterValues"][0]["id"] == "MouthOpen"


@pytest.mark.asyncio
async def test_consume_forever_processes_queue_item():
    writer = _FakeWriter()
    driver = SpeechMouthDriver(
        writer=writer,
        now=_FakeClock([0.0, 0.02, 0.04]),
        tick_seconds=0.0,
    )
    queue: asyncio.Queue[SpeechEnvelopePayload] = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=4,
            volumes=[0.2, 0.3],
            slice_length=20,
            started_at=0.0,
        )
    )

    task = asyncio.create_task(driver.consume_forever(queue))
    await asyncio.wait_for(queue.join(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    assert writer.writes[-1]["param_id"] == "MouthOpen"
    assert writer.writes[-1]["value"] == 0.0
