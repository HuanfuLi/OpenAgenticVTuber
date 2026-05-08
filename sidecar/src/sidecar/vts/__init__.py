"""VTS connection and parameter injection seams."""

from .handshake import connect_and_authenticate
from .pyvts_writer import PyvtsSafeWriter

__all__ = [
    "connect_and_authenticate",
    "PyvtsSafeWriter",
]
