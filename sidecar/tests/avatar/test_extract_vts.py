import pytest


@pytest.mark.xfail(reason="Wave 0 stub -- implemented in Task 3", strict=False)
def test_teto(teto_dir) -> None:
    from sidecar.avatar.extractors.vts import extract_vts

    variants, events, warnings = extract_vts(teto_dir)
    assert len(variants) == 14
    assert events == []
    assert isinstance(warnings, list)
