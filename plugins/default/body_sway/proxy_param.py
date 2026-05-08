"""Proxy-parameter body-sway strategy."""

from __future__ import annotations


class ProxyParamStrategy:
    name = "proxy_param"

    def __init__(self, param_name: str = "Lean Forward") -> None:
        self._param_name = param_name

    def tick(self, rms: float, now: float) -> dict[str, float]:
        return {self._param_name: rms}
