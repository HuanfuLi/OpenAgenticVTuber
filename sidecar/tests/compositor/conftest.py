from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

import pytest

from contracts import ParamFrame


class RecordingWriter:
    def __init__(self) -> None:
        self.frames: list[ParamFrame] = []

    async def inject_params(self, frame: ParamFrame) -> None:
        self.frames.append(frame)


@dataclass
class StubDriver:
    output: Mapping[str, float] = field(default_factory=dict)

    def tick(self, now: float) -> dict[str, float]:
        return dict(self.output)


@dataclass
class StubIntentDriver:
    output: Mapping[str, tuple[float, float]] = field(default_factory=dict)

    def tick(self, now: float) -> dict[str, tuple[float, float]]:
        return dict(self.output)


@pytest.fixture
def recording_writer() -> RecordingWriter:
    return RecordingWriter()


@pytest.fixture
def stub_drivers() -> dict[str, object]:
    return {
        "idle": StubDriver({"ParamAngleX": 0.25}),
        "speech": StubDriver({"ParamMouthOpenY": 0.5}),
        "intent": StubIntentDriver({"ParamJoy": (0.8, 1.0)}),
    }
