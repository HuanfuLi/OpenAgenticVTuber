from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parents[1] / "src" / "sidecar"
EXPECTED_WRITER = "vts/pyvts_writer.py"


def _source_files() -> list[Path]:
    return sorted(SRC_ROOT.rglob("*.py"))


def _relative(path: Path) -> str:
    return path.relative_to(SRC_ROOT).as_posix()


def _files_containing(*needles: str) -> list[str]:
    matches = []
    for path in _source_files():
        source = path.read_text(encoding="utf-8")
        if any(needle in source for needle in needles):
            matches.append(_relative(path))
    return matches


def test_arch06_vts_parameter_write_calls_live_only_in_safe_writer():
    assert _files_containing(
        "requestSetParameterValue",
        "requestInjectParameterData",
    ) == [EXPECTED_WRITER]


def test_arch06_vts_plugin_identity_owned_only_by_safe_writer():
    assert _files_containing("plugin_name") == [EXPECTED_WRITER]


def test_arch06_split_writer_modules_do_not_exist():
    assert not (SRC_ROOT / "vts" / "parameter_writer.py").exists()
    assert not (SRC_ROOT / "vts" / "speech_mouth_driver.py").exists()
