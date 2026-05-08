import pytest

from sidecar.avatar.normalize import is_placeholder_code, is_reserved_name, slug_from_hotkey_name


@pytest.mark.parametrize(
    ("source_name", "expected"),
    [
        ("【SV】Microphone[1]", "sv-microphone"),
        ("【SV＆Utau】Baguette[2]", "sv-utau-baguette"),
        ("Dark Face [3]", "dark-face"),
        ("Dark Eye [4]", "dark-eye"),
        ("Blush [5]", "blush"),
        ("Heart Eye [6]", "heart-eye"),
        ("Star Eye [7]", "star-eye"),
        ("Squint Eye [8]", "squint-eye"),
        ("SV/UTAU Alt [9]", "sv-utau-alt"),
        ("【Utau】Headphone [0]", "utau-headphone"),
        ("【Chibi】[Q]", "chibi"),
        ("Cry [W]", "cry"),
        ("Dizzy Eye [E]", "dizzy-eye"),
        ("Remove All Toggles", "remove-all-toggles"),
        ("Remove Water Mark", "remove-water-mark"),
    ],
)
def test_15_teto_names(source_name: str, expected: str) -> None:
    assert slug_from_hotkey_name(source_name) == expected


def test_placeholder() -> None:
    assert is_placeholder_code("exp_01") is True
    assert is_placeholder_code("EXP_3") is True
    assert is_placeholder_code("sv-microphone") is False
    assert is_placeholder_code("hold-mic") is False


def test_reserved() -> None:
    assert is_reserved_name("think") is True
    assert is_reserved_name("function_calls") is True
    assert is_reserved_name("joy") is False
