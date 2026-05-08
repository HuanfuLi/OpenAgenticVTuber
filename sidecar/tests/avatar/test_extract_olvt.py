import pytest


@pytest.mark.xfail(reason="Wave 0 stub -- implemented in Task 3", strict=False)
def test_teto(olvt_model_dict_path) -> None:
    from sidecar.avatar.extractors.olvt import extract_olvt

    variants, events, warnings = extract_olvt(olvt_model_dict_path)
    assert len(variants) == 6
    assert events == []
    assert isinstance(warnings, list)
