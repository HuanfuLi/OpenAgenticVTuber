def test_mao_pro(mao_pro_dir) -> None:
    from sidecar.avatar.extractors.cubism_named import extract_cubism_named

    variants, events, warnings = extract_cubism_named(mao_pro_dir)
    assert len(variants) == 8
    assert [variant.code for variant in variants] == [f"exp_{i:02d}" for i in range(1, 9)]
    assert all(v.is_placeholder for v in variants)
    assert events == []
    assert isinstance(warnings, list)
