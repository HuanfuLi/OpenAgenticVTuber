from __future__ import annotations

import argparse
import asyncio
import json
import math
import statistics
from pathlib import Path

from contracts import SpeechEnvelopePayload
from sidecar.avatar.overrides import AvatarOverrides
from sidecar.compositor.idle_driver import IdleDriver
from sidecar.compositor.speech_driver import SpeechDriver


LIPSYNC_THRESHOLD = 0.7
IDLE_VARIANCE_CEILING = 0.5


def _pearson(xs: list[float], ys: list[float]) -> float:
    if len(xs) != len(ys) or len(xs) < 2:
        return 0.0
    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(ys)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    x_den = math.sqrt(sum((x - x_mean) ** 2 for x in xs))
    y_den = math.sqrt(sum((y - y_mean) ** 2 for y in ys))
    if x_den == 0.0 or y_den == 0.0:
        return 0.0
    return numerator / (x_den * y_den)


async def run_lipsync() -> dict[str, object]:
    sample_count = 90
    slice_length = 20
    volumes = [
        (math.sin(index / sample_count * math.tau * 3.0) + 1.0) * 0.45
        for index in range(sample_count)
    ]
    queue: asyncio.Queue[SpeechEnvelopePayload] = asyncio.Queue()
    await queue.put(
        SpeechEnvelopePayload(
            sentence_id=1,
            volumes=volumes,
            slice_length=slice_length,
            started_at=0.0,
        )
    )
    driver = SpeechDriver(queue, AvatarOverrides(), Path.cwd(), emit_mouth=True)
    mouth: list[float] = []
    sampled_rms: list[float] = []
    for index in range(sample_count):
        now = index * slice_length / 1000.0
        sampled_rms.append(volumes[index])
        mouth.append(driver.tick(now).get("MouthOpen", 0.0))
    pearson_r = _pearson(sampled_rms, mouth)
    return {
        "mode": "lipsync",
        "sample_count": sample_count,
        "pearson_r": pearson_r,
        "threshold": LIPSYNC_THRESHOLD,
        "passed": pearson_r >= LIPSYNC_THRESHOLD,
    }


def run_idle() -> dict[str, object]:
    duration_seconds = 30.0
    sample_hz = 30.0
    sample_count = int(duration_seconds * sample_hz)
    driver = IdleDriver(seed=42)
    series: dict[str, list[float]] = {}
    for index in range(sample_count):
        now = index / sample_hz
        for key, value in driver.tick(now).items():
            series.setdefault(key, []).append(float(value))
    variance_sum = sum(statistics.pvariance(values) for values in series.values()) / 100.0
    return {
        "mode": "idle",
        "duration_seconds": duration_seconds,
        "variance_sum": variance_sum,
        "variance_ceiling": IDLE_VARIANCE_CEILING,
        "passed": 0.0 < variance_sum < IDLE_VARIANCE_CEILING,
    }


async def _run(mode: str) -> dict[str, object]:
    if mode == "lipsync":
        return await run_lipsync()
    if mode == "idle":
        return run_idle()
    raise ValueError(f"unsupported mode: {mode}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("lipsync", "idle"), required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    result = asyncio.run(_run(args.mode))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
