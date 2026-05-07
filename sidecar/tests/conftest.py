"""Pytest hooks and shared fixtures.

1) Make the vendored pyvts at sidecar/vendor/pyvts importable for tests
   that import pyvts directly (without first importing sidecar).

2) Provide the `_FakeGateway` and `_WSRecorder` helper classes plus
   `fake_gateway` / `ws_recorder` factory fixtures shared across test
   modules (Blocker 3 -- sibling test modules MUST NOT cross-import test
   fixtures; conftest.py is the pytest-canonical home).
"""

import sys
from pathlib import Path
from typing import AsyncIterator

import pytest

_TESTS_DIR = Path(__file__).resolve().parent
_VENDOR_DIR = (_TESTS_DIR.parent / "vendor").resolve()
if _VENDOR_DIR.is_dir() and str(_VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(_VENDOR_DIR))


# Imported after the vendor shim so any subsequent imports of sidecar.* work
# uniformly.
from sidecar.llm.gateway import ProviderConfig  # noqa: E402


class _FakeGateway:
    """Mimics LLMGateway.stream() with controllable behavior.

    `chunks` is the list of string deltas to yield. `raise_first` /
    `raise_second` raise the given exception on the first/second `stream()`
    invocation respectively (used for retry-path tests).
    """

    def __init__(
        self,
        chunks=None,
        raise_first=None,
        raise_second=None,
        provider="lm_studio",
        model="test-model",
    ):
        self._chunks = chunks or []
        self._call = 0
        self._raise_first = raise_first
        self._raise_second = raise_second
        self.calls_received_messages: list[list[dict]] = []
        self.calls_received_system_prompt: list[str] = []
        self._provider = ProviderConfig(
            provider=provider, endpoint="http://x", model=model
        )

    async def stream(self, messages, system_prompt) -> AsyncIterator[str]:
        self._call += 1
        self.calls_received_messages.append(list(messages))
        self.calls_received_system_prompt.append(system_prompt)
        if self._call == 1 and self._raise_first:
            raise self._raise_first
        if self._call == 2 and self._raise_second:
            raise self._raise_second
        for c in self._chunks:
            yield c


class _WSRecorder:
    """Records all send_json calls into `writes` for assertion."""

    def __init__(self):
        self.writes: list[dict] = []

    async def send_json(self, d: dict) -> None:
        self.writes.append(d)


@pytest.fixture
def fake_gateway():
    """Factory fixture -- call `fake_gateway(chunks=[...], raise_first=..., ...)`
    to get a configured _FakeGateway instance. Returned objects mirror
    LLMGateway's `stream(messages, system_prompt)` and `_provider`
    attributes so they slot into Orchestrator without real network calls."""
    return _FakeGateway


@pytest.fixture
def ws_recorder():
    """Factory fixture -- call `ws_recorder()` to get a fresh _WSRecorder."""
    return _WSRecorder
