from __future__ import annotations

import json

import pytest

from scripts import plumbing_harness


@pytest.mark.asyncio
async def test_lipsync_schema_and_threshold() -> None:
    result = await plumbing_harness.run_lipsync()

    assert result["mode"] == "lipsync"
    assert result["sample_count"] > 0
    assert result["threshold"] == 0.7
    assert result["pearson_r"] >= result["threshold"]
    assert result["passed"] is True


def test_idle_schema_and_threshold() -> None:
    result = plumbing_harness.run_idle()

    assert result["mode"] == "idle"
    assert result["duration_seconds"] == 30.0
    assert 0.0 < result["variance_sum"] < result["variance_ceiling"]
    assert result["variance_ceiling"] == 0.5
    assert result["passed"] is True


def test_main_writes_json(tmp_path, monkeypatch) -> None:
    out = tmp_path / "idle.json"
    monkeypatch.setattr(
        "sys.argv",
        ["plumbing_harness.py", "--mode", "idle", "--out", str(out)],
    )

    plumbing_harness.main()

    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["mode"] == "idle"
    assert data["passed"] is True
