import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def test_codegen_idempotent() -> None:
    subprocess.run(
        ["bash", "packages/contracts/codegen.sh"],
        cwd=ROOT,
        check=True,
    )
    before = {
        path.relative_to(ROOT): path.read_bytes()
        for base in [
            ROOT / "packages/contracts/ts",
            ROOT / "packages/contracts/generated/json-schema",
        ]
        for path in sorted(base.glob("*"))
        if path.is_file()
    }

    subprocess.run(
        ["bash", "packages/contracts/codegen.sh"],
        cwd=ROOT,
        check=True,
    )
    after = {
        path.relative_to(ROOT): path.read_bytes()
        for base in [
            ROOT / "packages/contracts/ts",
            ROOT / "packages/contracts/generated/json-schema",
        ]
        for path in sorted(base.glob("*"))
        if path.is_file()
    }

    assert after == before
