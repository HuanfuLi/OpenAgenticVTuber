import pytest


@pytest.mark.xfail(reason="Wave 0 stub -- implemented in Task 2", strict=False)
def test_teto_idle(teto_dir) -> None:
    from sidecar.avatar.motion3_meta import read_motion3_meta

    duration, is_loop = read_motion3_meta(teto_dir / "Motions" / "IDLE.motion3.json")
    assert duration == pytest.approx(2.833)
    assert is_loop is True


@pytest.mark.xfail(reason="Wave 0 stub -- implemented in Task 2", strict=False)
def test_teto_sleep(teto_dir) -> None:
    from sidecar.avatar.motion3_meta import read_motion3_meta

    duration, is_loop = read_motion3_meta(teto_dir / "Motions" / "Sleep.motion3.json")
    assert duration > 0
    assert isinstance(is_loop, bool)


@pytest.mark.xfail(reason="Wave 0 stub -- implemented in Task 2", strict=False)
def test_missing_file(teto_dir) -> None:
    from sidecar.avatar.motion3_meta import read_motion3_meta

    with pytest.raises(FileNotFoundError):
        read_motion3_meta(teto_dir / "Motions" / "missing.motion3.json")


@pytest.mark.xfail(reason="Wave 0 stub -- implemented in Task 2", strict=False)
def test_oversized_duration(tmp_path) -> None:
    from sidecar.avatar.motion3_meta import read_motion3_meta

    path = tmp_path / "long.motion3.json"
    path.write_text('{"Meta":{"Duration":61,"Loop":false}}', encoding="utf-8")
    with pytest.raises(ValueError):
        read_motion3_meta(path)
