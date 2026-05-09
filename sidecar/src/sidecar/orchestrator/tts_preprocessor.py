"""Ported verbatim from Open-LLM-VTuber utils/tts_preprocessor.py (MIT) -- see PROVENANCE.md.

Adaptations vs OLVT:
  - Provenance header (this docstring).
  - Inlined `TTSPreprocessorConfig` dataclass (OLVT pulls it from
    `..config_manager` which is OLVT-internal). Defaults per CONTEXT.md
    "Claude's Discretion": ignore_brackets=True (SC #3 requirement),
    ignore_parentheses=False, ignore_asterisks=True, ignore_angle_brackets=True.
  - Removed TranslateInterface dep and translator branch (no translation
    in skeleton; revisit when voice/multilingual milestone lands).
"""
import re
import unicodedata
from dataclasses import dataclass

from loguru import logger


@dataclass
class TTSPreprocessorConfig:
    """Skeleton-side config for tts_filter (replaces OLVT config_manager.TTSPreprocessorConfig)."""

    remove_special_char: bool = True
    ignore_brackets: bool = True       # SC #3 -- strip [tag] from TTS
    ignore_parentheses: bool = False
    ignore_asterisks: bool = True
    ignore_angle_brackets: bool = True
    ignore_curly_brackets: bool = True


def tts_filter(
    text: str,
    remove_special_char: bool,
    ignore_brackets: bool,
    ignore_parentheses: bool,
    ignore_asterisks: bool,
    ignore_angle_brackets: bool,
    ignore_curly_brackets: bool = True,
) -> str:
    """
    Filter or do anything to the text before TTS generates the audio.
    Changes here do not affect subtitles or LLM's memory. The generated audio is
    the only affected thing.

    Args:
        text (str): The text to filter.
        remove_special_char (bool): Whether to remove special characters.
        ignore_brackets (bool): Whether to ignore text within brackets.
        ignore_parentheses (bool): Whether to ignore text within parentheses.
        ignore_asterisks (bool): Whether to ignore text within asterisks.
        ignore_angle_brackets (bool): Whether to ignore text within angle brackets.
        ignore_curly_brackets (bool): Whether to ignore text within curly brackets.

    Returns:
        str: The filtered text.
    """
    if ignore_asterisks:
        try:
            text = filter_asterisks(text)
        except Exception as e:
            logger.warning(f"Error ignoring asterisks: {e}")
            logger.warning(f"Text: {text}")
            logger.warning("Skipping...")

    if ignore_brackets:
        try:
            text = filter_brackets(text)
        except Exception as e:
            logger.warning(f"Error ignoring brackets: {e}")
            logger.warning(f"Text: {text}")
            logger.warning("Skipping...")
    if ignore_curly_brackets:
        try:
            text = filter_curly_brackets(text)
        except Exception as e:
            logger.warning(f"Error ignoring curly brackets: {e}")
            logger.warning(f"Text: {text}")
            logger.warning("Skipping...")
    if ignore_parentheses:
        try:
            text = filter_parentheses(text)
        except Exception as e:
            logger.warning(f"Error ignoring parentheses: {e}")
            logger.warning(f"Text: {text}")
            logger.warning("Skipping...")
    if ignore_angle_brackets:
        try:
            text = filter_angle_brackets(text)
        except Exception as e:
            logger.warning(f"Error ignoring angle brackets: {e}")
            logger.warning(f"Text: {text}")
            logger.warning("Skipping...")
    if remove_special_char:
        try:
            text = remove_special_characters(text)
        except Exception as e:
            logger.warning(f"Error removing special characters: {e}")
            logger.warning(f"Text: {text}")
            logger.warning("Skipping...")

    logger.debug(f"Filtered text: {text}")
    return text


def remove_special_characters(text: str) -> str:
    """
    Filter text to remove all non-letter, non-number, and non-punctuation characters.

    Args:
        text (str): The text to filter.

    Returns:
        str: The filtered text.
    """
    normalized_text = unicodedata.normalize("NFKC", text)

    def is_valid_char(char: str) -> bool:
        category = unicodedata.category(char)
        return (
            category.startswith("L")
            or category.startswith("N")
            or category.startswith("P")
            or char.isspace()
        )

    filtered_text = "".join(char for char in normalized_text if is_valid_char(char))
    return filtered_text


def _filter_nested(text: str, left: str, right: str) -> str:
    """
    Generic function to handle nested symbols.

    Args:
        text (str): The text to filter.
        left (str): The left symbol (e.g. '[' or '(').
        right (str): The right symbol (e.g. ']' or ')').

    Returns:
        str: The filtered text.
    """
    if not isinstance(text, str):
        raise TypeError("Input must be a string")
    if not text:
        return text

    result = []
    depth = 0
    for char in text:
        if char == left:
            depth += 1
        elif char == right:
            if depth > 0:
                depth -= 1
        else:
            if depth == 0:
                result.append(char)
    filtered_text = "".join(result)
    filtered_text = re.sub(r"\s+", " ", filtered_text).strip()
    return filtered_text


def filter_brackets(text: str) -> str:
    """Filter text to remove all text within brackets, handling nested cases."""
    return _filter_nested(text, "[", "]")


def filter_parentheses(text: str) -> str:
    """Filter text to remove all text within parentheses, handling nested cases."""
    return _filter_nested(text, "(", ")")


def filter_angle_brackets(text: str) -> str:
    """Filter text to remove all text within angle brackets, handling nested cases."""
    return _filter_nested(text, "<", ">")


def filter_curly_brackets(text: str) -> str:
    """Filter text to remove all text within curly brackets, handling nested cases."""
    return _filter_nested(text, "{", "}")


def filter_asterisks(text: str) -> str:
    """
    Removes text enclosed within asterisks of any length (*, **, ***, etc.) from a string.

    Args:
        text: The input string.

    Returns:
        The string with asterisk-enclosed text removed.
    """
    # Handle asterisks of any length (*, **, ***, etc.)
    filtered_text = re.sub(r"\*{1,}((?!\*).)*?\*{1,}", "", text)

    # Clean up any extra spaces
    filtered_text = re.sub(r"\s+", " ", filtered_text).strip()

    return filtered_text
