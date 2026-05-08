"""Plot RMS vs body-sway output from [SPEECH-DRIVER] log captures.

Usage:
    cd sidecar
    uv run python -m scripts.plot_speech_evidence \
        --input ../.planning/skeleton-verification-evidence/04/head_only/log_capture.txt \
        --output ../.planning/skeleton-verification-evidence/04/head_only/rms_vs_output.png \
        --primary-param ParamAngleX
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


LOG_PATTERN = re.compile(
    r"\[SPEECH-DRIVER strategy=(?P<strat>\w+) "
    r"rms=(?P<rms>[\d.]+) mouth=(?P<mouth>[\d.]+) "
    r"body_params=\[(?P<body_params>[^\]]*)\]"
)
PARAM_PATTERN = re.compile(r"(?P<key>[^=,\s]+)=(?P<value>-?[\d.]+)")


def parse_body_params(raw: str) -> dict[str, float]:
    """Parse body_params entries formatted as key=value pairs."""
    parsed: dict[str, float] = {}
    for match in PARAM_PATTERN.finditer(raw):
        parsed[match.group("key")] = float(match.group("value"))
    return parsed


def parse_log(path: Path) -> tuple[list[float], list[float], list[dict[str, float]]]:
    """Return synthetic timestamps, RMS values, and parsed body-param maps."""
    rms_series: list[float] = []
    body_series: list[dict[str, float]] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            match = LOG_PATTERN.search(line)
            if match is None:
                continue
            rms_series.append(float(match.group("rms")))
            body_series.append(parse_body_params(match.group("body_params")))
    timestamps = [index / 60.0 for index in range(len(rms_series))]
    return timestamps, rms_series, body_series


def render_plot(
    input_path: Path,
    output_path: Path,
    primary_param: str,
) -> None:
    t, rms, body = parse_log(input_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 6), sharex=True)
    if rms:
        primary_series = [params.get(primary_param, 0.0) for params in body]
        ax1.plot(t, rms, "b-", label="RMS smooth")
        ax2.plot(t, primary_series, "r-", label=primary_param)
    else:
        ax1.text(0.5, 0.5, "DEFERRED: no live log samples", ha="center", va="center")
        ax2.text(0.5, 0.5, f"DEFERRED: no {primary_param} samples", ha="center", va="center")
        ax1.set_xlim(0, 1)
        ax2.set_xlim(0, 1)
        ax1.set_ylim(0, 1)
        ax2.set_ylim(0, 1)

    ax1.set_ylabel("RMS")
    ax1.legend(loc="upper right")
    ax2.set_ylabel(primary_param)
    ax2.set_xlabel("Time (s)")
    ax2.legend(loc="upper right")
    plt.tight_layout()
    plt.savefig(output_path, dpi=80)
    plt.close(fig)
    print(f"Wrote {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--primary-param", default="ParamAngleX")
    args = parser.parse_args()
    render_plot(args.input, args.output, args.primary_param)


if __name__ == "__main__":
    main()
