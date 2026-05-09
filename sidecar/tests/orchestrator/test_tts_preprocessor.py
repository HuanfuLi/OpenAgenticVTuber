from sidecar.orchestrator.tts_preprocessor import (
    TTSPreprocessorConfig,
    filter_angle_brackets,
    filter_brackets,
    filter_curly_brackets,
    tts_filter,
)


def test_filter_curly_brackets():
    assert filter_curly_brackets("Hello {hold-mic}.") == "Hello ."
    assert filter_curly_brackets("A {outer {inner}} B") == "A B"


def test_tts_filter_strips_square_curly_and_angle_codes():
    config = TTSPreprocessorConfig()
    text = tts_filter(
        "Hello [joy] {hold-mic} <wave>.",
        remove_special_char=config.remove_special_char,
        ignore_brackets=config.ignore_brackets,
        ignore_parentheses=config.ignore_parentheses,
        ignore_asterisks=config.ignore_asterisks,
        ignore_angle_brackets=config.ignore_angle_brackets,
        ignore_curly_brackets=config.ignore_curly_brackets,
    )

    assert "[" not in text
    assert "]" not in text
    assert "{" not in text
    assert "}" not in text
    assert "<" not in text
    assert ">" not in text
    assert text == "Hello ."


def test_existing_bracket_filters_remain_available():
    assert filter_brackets("A [joy] B") == "A B"
    assert filter_angle_brackets("A <wave> B") == "A B"
