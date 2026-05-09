"""Async completion tracker for one-shot VTS event hotkeys."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from contracts import EventFire

FALLBACK_MS = 10000

logger = logging.getLogger(__name__)


class EventCompletionTracker:
    def __init__(self) -> None:
        self._tasks_by_hotkey: dict[str, list[asyncio.Task]] = {}

    def track(self, event: EventFire) -> None:
        task = asyncio.create_task(self._complete_after_delay(event))
        self._tasks_by_hotkey.setdefault(event.hotkey_id, []).append(task)
        task.add_done_callback(
            lambda completed, hotkey_id=event.hotkey_id: self._remove_task(
                hotkey_id,
                completed,
            )
        )

    def in_flight_set(self) -> set[str]:
        return {
            hotkey_id
            for hotkey_id, tasks in self._tasks_by_hotkey.items()
            if any(not task.done() for task in tasks)
        }

    async def close(self) -> None:
        tasks = [
            task
            for tasks_for_hotkey in self._tasks_by_hotkey.values()
            for task in tasks_for_hotkey
        ]
        if not tasks:
            return

        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self._tasks_by_hotkey.clear()

    async def _complete_after_delay(self, event: EventFire) -> None:
        await asyncio.sleep(_event_delay_seconds(event))
        logger.info(
            "[EVENT-COMPLETE] hotkey_id=%s name=%s",
            event.hotkey_id,
            event.name,
        )

    def _remove_task(self, hotkey_id: str, completed: asyncio.Task) -> None:
        tasks = self._tasks_by_hotkey.get(hotkey_id)
        if tasks is None:
            return
        try:
            tasks.remove(completed)
        except ValueError:
            return
        if not tasks:
            self._tasks_by_hotkey.pop(hotkey_id, None)


def _event_delay_seconds(event: EventFire) -> float:
    duration_ms: Any = getattr(event, "duration_ms", None)
    if isinstance(duration_ms, (int, float)) and duration_ms > 0:
        return duration_ms / 1000.0
    return FALLBACK_MS / 1000.0
