def test_teto(olvt_model_dict_path) -> None:
    from sidecar.avatar.extractors.olvt import extract_olvt

    variants, events, bindings, warnings = extract_olvt(olvt_model_dict_path)
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
    assert [(binding.action_code, binding.expression_index) for binding in bindings] == [
        ("neutral", 0),
        ("anger", 2),
        ("disgust", 2),
        ("fear", 1),
        ("joy", 3),
        ("smirk", 3),
        ("sadness", 1),
        ("surprise", 3),
    ]
    assert {binding.plugin_name for binding in bindings} == {"default"}
    assert {binding.expression_name for binding in bindings} == {""}
    assert {binding.source for binding in bindings} == {"olvt_emotionMap"}
    assert isinstance(warnings, list)
