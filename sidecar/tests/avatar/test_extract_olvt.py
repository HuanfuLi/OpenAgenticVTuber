def test_teto(olvt_model_dict_path) -> None:
    from sidecar.avatar.extractors.olvt import extract_olvt

    variants, events, warnings = extract_olvt(olvt_model_dict_path)
    assert len(variants) == 6
    assert [variant.code for variant in variants] == [
        "hold-mic",
        "utau-mic",
        "bread-out",
        "chibi",
        "hearts",
        "star-eyes",
    ]
    assert events == []
    assert isinstance(warnings, list)
