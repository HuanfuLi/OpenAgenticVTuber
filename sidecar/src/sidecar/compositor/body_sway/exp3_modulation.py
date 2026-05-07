"""exp3_modulation body-sway strategy.

Pitfall 18: do NOT use ExpressionActivationRequest for continuous modulation.
This strategy loads .exp3.json Parameters[] and writes parameter IDs through
InjectParameterDataRequest via the compositor frame path.
"""

from __future__ import annotations

import json
from pathlib import Path


class Exp3ModulationStrategy:
    name = "exp3_modulation"

    def __init__(self, exp3_path: Path | None = None) -> None:
        self._params: list[tuple[str, float]] = []
        if exp3_path is not None and exp3_path.exists():
            raw = json.loads(exp3_path.read_text(encoding="utf-8"))
            for entry in raw.get("Parameters", []):
                param_id = entry.get("Id")
                value = float(entry.get("Value", 0.0))
                if param_id:
                    self._params.append((param_id, value))

    def tick(self, rms: float, now: float) -> dict[str, float]:
        return {param_id: value * rms for param_id, value in self._params}
