"""Drive VTube Studio mouth-open parameter from SpeechEnvelopePayload."""

from __future__ import annotations

import asyncio
from collections.abc import Callable

from contracts import SpeechEnvelopePayload

from .parameter_writer import ParameterWriter


class SpeechMouthDriver:
    def __init__(
        self,
        writer: ParameterWriter,
        now: Callable[[], float],
        tick_seconds: float = 1 / 60,
        mouth_param_id: str = "ParamMouthOpenY",
    ) -> None:
        self._writer = writer
        self._now = now
        self._tick_seconds = tick_seconds
        self._mouth_param_id = mouth_param_id

    async def consume_forever(
        self, queue: asyncio.Queue[SpeechEnvelopePayload]
    ) -> None:
        while True:
            envelope = await queue.get()
            try:
                await self.drive_envelope(envelope)
            finally:
                queue.task_done()

    async def drive_envelope(self, envelope: SpeechEnvelopePayload) -> None:
        if not envelope.volumes:
            await self._write_mouth(0.0)
            return

        slice_length = max(1, envelope.slice_length)
        while True:
            elapsed_ms = max(0.0, (self._now() - envelope.started_at) * 1000.0)
            position = elapsed_ms / slice_length
            index = int(position)
            if index >= len(envelope.volumes):
                break

            value = envelope.volumes[index]
            if index + 1 < len(envelope.volumes):
                frac = position - index
                next_value = envelope.volumes[index + 1]
                value = value * (1 - frac) + next_value * frac

            await self._write_mouth(value)
            await asyncio.sleep(self._tick_seconds)

        await self._write_mouth(0.0)

    async def _write_mouth(self, value: float) -> None:
        clamped = min(1.0, max(0.0, float(value)))
        await self._writer.write_parameter(
            self._mouth_param_id,
            clamped,
            weight=1.0,
            mode="set",
            face_found=False,
        )
