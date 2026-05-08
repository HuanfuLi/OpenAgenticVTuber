from __future__ import annotations

from pathlib import Path


def test_only_safe_writer_imports_pyvts() -> None:
    src_root = Path(__file__).resolve().parents[2] / "src"
    matches = [
        path.relative_to(src_root).as_posix()
        for path in src_root.rglob("*.py")
        if "import pyvts" in path.read_text(encoding="utf-8")
    ]

    assert matches == ["sidecar/vts/pyvts_writer.py"]
