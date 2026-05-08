def test_teto(teto_dir) -> None:
    from sidecar.avatar.extractors.vts import extract_vts

    variants, events, warnings = extract_vts(teto_dir)
    codes = [variant.code for variant in variants]
    assert len(variants) == 14
    assert codes == [
        "sv-microphone",
        "sv-utau-baguette",
        "dark-face",
        "dark-eye",
        "blush",
        "heart-eye",
        "star-eye",
        "squint-eye",
        "sv-utau-alt",
        "utau-headphone",
        "chibi",
        "cry",
        "dizzy-eye",
        "remove-water-mark",
    ]
    assert all(len(variant.hotkey_id) == 32 for variant in variants)
    assert events == []
    assert isinstance(warnings, list)
