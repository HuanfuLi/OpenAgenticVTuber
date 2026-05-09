"""15 Hz HUD frame fanout -- drop-tail queue per subscriber."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from contracts import ParamFrame


_QUEUE_MAXSIZE = 8


class HudTap:
    """Fanout publish-subscribe for HUD param-frame snapshots.

    Compositor publishes at 15 Hz (decimated from 60 Hz); WS handlers subscribe
    on /hud/ws connect and unsubscribe on disconnect. Slow subscriber drops
    oldest so the compositor never blocks on HUD I/O.
    """

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def publish(self, frame: "ParamFrame", lock_state_snapshot: dict[str, float]) -> None:
        """Non-blocking publish; drop oldest on QueueFull."""
        for q in self._subscribers:
            try:
                q.put_nowait((frame, lock_state_snapshot))
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                    q.put_nowait((frame, lock_state_snapshot))
                except asyncio.QueueEmpty:
                    pass
