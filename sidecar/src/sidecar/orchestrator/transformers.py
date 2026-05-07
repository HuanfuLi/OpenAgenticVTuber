"""Ported from Open-LLM-VTuber agent/transformers.py (MIT) -- see PROVENANCE.md.

Adaptations vs OLVT:
  - sentence_divider, display_processor, tts_filter ported VERBATIM (only
    imports adjusted).
  - actions_extractor adapted (CONTEXT.md D-13 + RESEARCH Example 4):
      * Signature: actions_extractor(capabilities: AvatarCapabilities) instead
        of actions_extractor(live2d_model: Live2dModel).
      * Yields tuple[SentenceWithTags, list[ActionIntent]] instead of
        tuple[SentenceWithTags, Actions].
      * Uses _extract_intents() bracket-walker (RESEARCH Example 4) keyed on
        capabilities.expressions[].name (kind=expression) and
        capabilities.hotkeys[].name (kind=action). Expression-first per D-13;
        unknown tags silently dropped.
  - SentenceOutput.actions is now list[ActionIntent] (Discrepancy 5).
"""
from typing import AsyncIterator, Tuple, Callable, List, Union, Dict, Any
from functools import wraps

from loguru import logger

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities

from .output_types import DisplayText, SentenceOutput
from .sentence_divider import SentenceDivider, SentenceWithTags, TagState
from .tts_preprocessor import tts_filter as filter_text
from .tts_preprocessor import TTSPreprocessorConfig, filter_brackets


def sentence_divider(
    faster_first_response: bool = True,
    segment_method: str = "pysbd",
    valid_tags: List[str] = None,
):
    """
    Decorator that transforms token stream into sentences with tags.

    Args:
        faster_first_response: bool - Whether to enable faster first response
        segment_method: str - Method for sentence segmentation
        valid_tags: List[str] - List of valid tags to process
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
                valid_tags=valid_tags or [],
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


def actions_extractor(capabilities: AvatarCapabilities):
    """
    Decorator that extracts ActionIntents from sentences (skeleton adaptation
    of OLVT's actions_extractor; see file docstring).

    Searches expressions[].name first (kind="expression") -> falls through to
    hotkeys[].name (kind="action"). Unknown tags silently dropped (D-13).
    """
    expression_names = {e.name.lower() for e in capabilities.expressions}
    hotkey_names = {h.name.lower() for h in capabilities.hotkeys}

    def decorator(
        func: Callable[
            ..., AsyncIterator[Union[SentenceWithTags, Dict[str, Any]]]
        ],
    ) -> Callable[
        ..., AsyncIterator[Union[Tuple[SentenceWithTags, List[ActionIntent]], Dict[str, Any]]]
    ]:
        @wraps(func)
        async def wrapper(
            *args, **kwargs
        ) -> AsyncIterator[
            Union[Tuple[SentenceWithTags, List[ActionIntent]], Dict[str, Any]]
        ]:
            stream = func(*args, **kwargs)
            async for item in stream:
                if isinstance(item, SentenceWithTags):
                    sentence = item
                    intents: List[ActionIntent] = []
                    # Only extract intents for non-tag text (mirror OLVT)
                    if not any(
                        t.state in [TagState.START, TagState.END]
                        for t in sentence.tags
                    ):
                        intents = _extract_intents(
                            sentence.text, expression_names, hotkey_names
                        )
                    yield sentence, intents
                elif isinstance(item, dict):
                    yield item
                else:
                    logger.warning(
                        f"actions_extractor received unexpected type: {type(item)}"
                    )

        return wrapper

    return decorator


def _extract_intents(
    text: str, expression_names: set, hotkey_names: set
) -> List[ActionIntent]:
    """Single-pass left-to-right bracket scan. Case-insensitive name match.

    Mirrors OLVT live2d_model.extract_emotion + extract_action shape but emits
    structured ActionIntents instead of string lists. Per D-13:
      - expression match first (kind="expression")
      - hotkey match second (kind="action")
      - unknown tags silently dropped
    """
    intents: List[ActionIntent] = []
    lower = text.lower()
    i = 0
    while i < len(lower):
        if lower[i] != "[":
            i += 1
            continue
        end = lower.find("]", i)
        if end == -1:
            break  # unmatched [ -- silently drop
        name = lower[i + 1 : end]
        if name in expression_names:
            intents.append(
                ActionIntent(kind="expression", name=name, avatar_id="teto")
            )
        elif name in hotkey_names:
            intents.append(
                ActionIntent(kind="action", name=name, avatar_id="teto")
            )
        # else: silently drop (D-13)
        i = end + 1
    return intents


def display_processor():
    """
    Decorator that processes text for display, passing through dicts.

    Adapted from OLVT for the new tuple shape
    (SentenceWithTags, List[ActionIntent]) -> (SentenceWithTags, DisplayText, List[ActionIntent]).
    """

    def decorator(
        func: Callable[
            ..., AsyncIterator[Union[Tuple[SentenceWithTags, List[ActionIntent]], Dict[str, Any]]]
        ],
    ) -> Callable[
        ...,
        AsyncIterator[
            Union[Tuple[SentenceWithTags, DisplayText, List[ActionIntent]], Dict[str, Any]]
        ],
    ]:
        @wraps(func)
        async def wrapper(
            *args, **kwargs
        ) -> AsyncIterator[
            Union[Tuple[SentenceWithTags, DisplayText, List[ActionIntent]], Dict[str, Any]]
        ]:
            stream = func(*args, **kwargs)

            async for item in stream:
                if (
                    isinstance(item, tuple)
                    and len(item) == 2
                    and isinstance(item[0], SentenceWithTags)
                ):
                    sentence, intents = item
                    text = sentence.text
                    # Handle think tag states (D-10 disables <think> at API
                    # level so this is dead code; OLVT-port-faithfulness keeps it).
                    handled_think = False
                    for tag in sentence.tags:
                        if tag.name == "think":
                            handled_think = True
                            if tag.state == TagState.START:
                                text = "("
                            elif tag.state == TagState.END:
                                text = ")"
                    if not handled_think:
                        # Skeleton-side adaptation (SC #3 spec):
                        # strip [tag] brackets from chat display so the
                        # bracket characters never reach the chat panel.
                        # actions_extractor has already extracted the
                        # ActionIntents from these brackets; the brackets
                        # are now redundant for display. This is a divergence
                        # from OLVT (which leaves bracket-stripping to the
                        # frontend renderer); recorded as Rule-2 deviation
                        # so the plan's SC#3 headline assertion holds.
                        text = filter_brackets(text)

                    display = DisplayText(text=text)
                    yield sentence, display, intents
                elif isinstance(item, dict):
                    yield item
                else:
                    logger.warning(
                        f"display_processor received unexpected type: {type(item)}"
                    )

        return wrapper

    return decorator


def tts_filter(
    tts_preprocessor_config: TTSPreprocessorConfig = None,
):
    """
    Decorator that filters text for TTS, passing through dicts.
    Skips TTS for think tag content.

    Adapted to construct SentenceOutput with list[ActionIntent].
    """

    def decorator(
        func: Callable[
            ...,
            AsyncIterator[
                Union[Tuple[SentenceWithTags, DisplayText, List[ActionIntent]], Dict[str, Any]]
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
                    sentence, display, intents = item
                    if any(tag.name == "think" for tag in sentence.tags):
                        tts = ""
                    else:
                        tts = filter_text(
                            text=display.text,
                            remove_special_char=config.remove_special_char,
                            ignore_brackets=config.ignore_brackets,
                            ignore_parentheses=config.ignore_parentheses,
                            ignore_asterisks=config.ignore_asterisks,
                            ignore_angle_brackets=config.ignore_angle_brackets,
                        )

                    logger.debug(f"[{display.name}] display: {display.text}")
                    logger.debug(f"[{display.name}] tts: {tts}")

                    yield SentenceOutput(
                        display_text=display,
                        tts_text=tts,
                        actions=intents,
                    )
                elif isinstance(item, dict):
                    yield item
                else:
                    logger.warning(f"tts_filter received unexpected type: {type(item)}")

        return wrapper

    return decorator
