import pytest


@pytest.mark.xfail(reason="Wave 0 stub -- implemented in Task 3", strict=False)
def test_shizuku(shizuku_dir) -> None:
    from sidecar.avatar.extractors.cubism_bare import extract_cubism_bare

    variants, events, warnings = extract_cubism_bare(shizuku_dir)
    assert variants == []
    assert len(events) == 3
    assert all(event.code != "idle" for event in events)
    assert isinstance(warnings, list)
