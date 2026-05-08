import pytest


@pytest.mark.xfail(reason="Implemented in 08-02", strict=False)
def test_import_detect_wave0_stub(teto_dir) -> None:
    from sidecar.avatar.import_detect import detect_type

    assert detect_type(teto_dir)
