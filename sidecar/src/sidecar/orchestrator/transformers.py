"""Ported from Open-LLM-VTuber agent/transformers.py (MIT) -- see PROVENANCE.md.

Adaptations vs OLVT:
  - sentence_divider, display_processor, tts_filter ported with local imports.
  - code_extractor replaces the milestone-1 single-category action extractor.
    It emits ordered Dispatch records for [action], {variant}, and <event>
    codes while leaving sentence.text unchanged for plugin-visible context.
"""
from collections.abc import AsyncIterator, Callable, Mapping, Sequence
from functools import wraps
from typing import Any, Dict, List, Tuple, Union

from loguru import logger

from contracts import (
    ActionCode,
    Dispatch,
    EventEntry,
    EventFire,
    VariantEntry,
    VariantToggle,
)

from .output_types import DisplayText, SentenceOutput
from .sentence_divider import SentenceDivider, SentenceWithTags
from .tts_preprocessor import TTSPreprocessorConfig, tts_filter as filter_text
from .tts_preprocessor import (
    filter_angle_brackets,
    filter_brackets,
    filter_curly_brackets,
)


_NO_PARSE_TAGS = ["__agenticllmvtuber_no_parse_tags__"]


def sentence_divider(
    faster_first_response: bool = True,
    segment_method: str = "pysbd",
    valid_tags: List[str] | None = None,
):
    """
    Decorator that transforms token stream into sentences with tags.

    Args:
        faster_first_response: Whether to enable faster first response.
        segment_method: Method for sentence segmentation.
        valid_tags: Tags to process. Empty/None means no parse-time tag handling.
    """

    def decorator(
        func: Callable[
            ..., AsyncIterator[Union[str, Dict[str, Any]]]
        ],
    ) -> Callable[
        ..., AsyncIterator[Union[SentenceWithTags, Dict[str, Any]]]
    ]:
        @wraps(func)
        async def wrapper(
            *args, **kwargs
        ) -> AsyncIterator[Union[SentenceWithTags, Dict[str, Any]]]:
            divider = SentenceDivider(
                faster_first_response=faster_first_response,
                segment_method=segment_method,
                valid_tags=valid_tags or _NO_PARSE_TAGS,
            )
            stream_from_func = func(*args, **kwargs)

            async for item in divider.process_stream(stream_from_func):
                if isinstance(item, SentenceWithTags):
                    logger.debug(f"sentence_divider yielding sentence: {item}")
                elif isinstance(item, dict):
                    logger.debug(f"sentence_divider yielding dict: {item}")
                yield item

        return wrapper

    return decorator


def _variant_lookup(
    variants: Sequence[VariantEntry] | Mapping[str, VariantEntry],
) -> dict[str, VariantEntry]:
    entries = variants.values() if isinstance(variants, Mapping) else variants
    return {entry.code.strip().lower(): entry for entry in entries if entry.code.strip()}


def _event_lookup(
    events: Sequence[EventEntry] | Mapping[str, EventEntry],
) -> dict[str, EventEntry]:
    entries = events.values() if isinstance(events, Mapping) else events
    return {entry.code.strip().lower(): entry for entry in entries if entry.code.strip()}


def _event_duration_ms(entry: EventEntry) -> int:
    if entry.duration_is_fallback:
        return 10000
    return max(0, int(entry.duration_seconds * 1000)) + 1000


def code_extractor(
    plugin_action_codes: set[str] | Sequence[str] | None = None,
    variants: Sequence[VariantEntry] | Mapping[str, VariantEntry] | None = None,
    events: Sequence[EventEntry] | Mapping[str, EventEntry] | None = None,
):
    """Decorator factory that extracts ordered Dispatch records from sentences."""

    action_codes = {
        code.strip().lower()
        for code in (plugin_action_codes or set())
        if code and code.strip()
    }
    variants_by_code = _variant_lookup(variants or [])
    events_by_code = _event_lookup(events or [])

    def decorator(
        func: Callable[
            ..., AsyncIterator[Union[SentenceWithTags, Dict[str, Any]]]
        ],
    ) -> Callable[
        ..., AsyncIterator[Union[Tuple[SentenceWithTags, List[Dispatch]], Dict[str, Any]]]
    ]:
        @wraps(func)
        async def wrapper(
            *args, **kwargs
        ) -> AsyncIterator[Union[Tuple[SentenceWithTags, List[Dispatch]], Dict[str, Any]]]:
            stream = func(*args, **kwargs)
            async for item in stream:
                if isinstance(item, SentenceWithTags):
                    dispatches = _extract_dispatches(
                        item.text,
                        action_codes,
                        variants_by_code,
                        events_by_code,
                    )
                    for dispatch in dispatches:
                        logger.debug(
                            f"[DISPATCH] kind={dispatch.kind} name={dispatch.name}"
                        )
                    yield item, dispatches
                elif isinstance(item, dict):
                    yield item
                else:
                    logger.warning(f"code_extractor received unexpected type: {type(item)}")

        return wrapper

    return decorator


def _extract_dispatches(
    text: str,
    plugin_action_codes: set[str],
    variants_by_code: Mapping[str, VariantEntry],
    events_by_code: Mapping[str, EventEntry],
) -> List[Dispatch]:
    dispatches: List[Dispatch] = []
    lower = text.lower()
    opener_map = {
        "[": ("]", "action"),
        "{": ("}", "variant"),
        "<": (">", "event"),
    }

    i = 0
    while i < len(lower):
        opener = lower[i]
        closer_and_kind = opener_map.get(opener)
        if closer_and_kind is None:
            i += 1
            continue

        closer, kind = closer_and_kind
        end = lower.find(closer, i + 1)
        if end == -1:
            break

        name = lower[i + 1 : end].strip()
        if name:
            if kind == "action" and name in plugin_action_codes:
                dispatches.append(ActionCode(name=name))
            elif kind == "variant":
                entry = variants_by_code.get(name)
                if entry is not None:
                    dispatches.append(
                        VariantToggle(name=name, hotkey_id=entry.hotkey_id)
                    )
            elif kind == "event":
                entry = events_by_code.get(name)
                if entry is not None:
                    dispatches.append(
                        EventFire(
                            name=name,
                            hotkey_id=entry.hotkey_id,
                            duration_ms=_event_duration_ms(entry),
                        )
                    )

        i = end + 1

    return dispatches


def _strip_code_syntax(text: str) -> str:
    text = filter_brackets(text)
    text = filter_curly_brackets(text)
    return filter_angle_brackets(text)


def display_processor():
    """
    Decorator that processes text for display, passing through dicts.

    Shape: (SentenceWithTags, list[Dispatch]) ->
    (SentenceWithTags, DisplayText, list[Dispatch]).
    """

    def decorator(
        func: Callable[
            ..., AsyncIterator[Union[Tuple[SentenceWithTags, List[Dispatch]], Dict[str, Any]]]
        ],
    ) -> Callable[
        ...,
        AsyncIterator[
            Union[Tuple[SentenceWithTags, DisplayText, List[Dispatch]], Dict[str, Any]]
        ],
    ]:
        @wraps(func)
        async def wrapper(
            *args, **kwargs
        ) -> AsyncIterator[
            Union[Tuple[SentenceWithTags, DisplayText, List[Dispatch]], Dict[str, Any]]
        ]:
            stream = func(*args, **kwargs)

            async for item in stream:
                if (
                    isinstance(item, tuple)
                    and len(item) == 2
                    and isinstance(item[0], SentenceWithTags)
                ):
                    sentence, dispatches = item
                    display = DisplayText(text=_strip_code_syntax(sentence.text))
                    yield sentence, display, dispatches
                elif isinstance(item, dict):
                    yield item
                else:
                    logger.warning(
                        f"display_processor received unexpected type: {type(item)}"
                    )

        return wrapper

    return decorator


def tts_filter(
    tts_preprocessor_config: TTSPreprocessorConfig | None = None,
):
    """Decorator that filters text for TTS, passing through dicts."""

    def decorator(
        func: Callable[
            ...,
            AsyncIterator[
                Union[Tuple[SentenceWithTags, DisplayText, List[Dispatch]], Dict[str, Any]]
            ],
        ],
    ) -> Callable[
        ..., AsyncIterator[Union[SentenceOutput, Dict[str, Any]]]
    ]:
        @wraps(func)
        async def wrapper(
            *args, **kwargs
        ) -> AsyncIterator[Union[SentenceOutput, Dict[str, Any]]]:
            stream = func(*args, **kwargs)
            config = tts_preprocessor_config or TTSPreprocessorConfig()

            async for item in stream:
                if (
                    isinstance(item, tuple)
                    and len(item) == 3
                    and isinstance(item[1], DisplayText)
                ):
                    sentence, display, dispatches = item
                    tts = filter_text(
                        text=display.text,
                        remove_special_char=config.remove_special_char,
                        ignore_brackets=config.ignore_brackets,
                        ignore_parentheses=config.ignore_parentheses,
                        ignore_asterisks=config.ignore_asterisks,
                        ignore_angle_brackets=config.ignore_angle_brackets,
                        ignore_curly_brackets=config.ignore_curly_brackets,
                    )

                    logger.debug(f"[{display.name}] display: {display.text}")
                    logger.debug(f"[{display.name}] tts: {tts}")

                    yield SentenceOutput(
                        display_text=display,
                        tts_text=tts,
                        plugin_text=sentence.text,
                        dispatches=dispatches,
                    )
                elif isinstance(item, dict):
                    yield item
                else:
                    logger.warning(f"tts_filter received unexpected type: {type(item)}")

        return wrapper

    return decorator
