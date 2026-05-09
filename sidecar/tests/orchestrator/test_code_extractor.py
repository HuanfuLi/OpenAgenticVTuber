from collections.abc import AsyncIterator

import pytest

from contracts import ActionCode, EventFire, VariantToggle
from sidecar.orchestrator.output_types import SentenceOutput
from sidecar.orchestrator.sentence_divider import SentenceWithTags
from sidecar.orchestrator.transformers import (
    code_extractor,
    display_processor,
    sentence_divider,
    tts_filter,
)
from sidecar.orchestrator.tts_preprocessor import TTSPreprocessorConfig


SPLIT_TOKEN_FIXTURES = [
    (
        "action_split_3",
        ["[", "jo", "y]", " hello."],
        [ActionCode(name="joy")],
    ),
    (
        "action_split_chars",
        ["[", "j", "o", "y", "]", " text."],
        [ActionCode(name="joy")],
    ),
    (
        "variant_split_3",
        ["{", "hold-", "mic}", " ok."],
        [VariantToggle(name="hold-mic", hotkey_id="hk-variant")],
    ),
    (
        "variant_split_inner_dash",
        ["{hold", "-", "mic", "}", " ok."],
        [VariantToggle(name="hold-mic", hotkey_id="hk-variant")],
    ),
    (
        "event_split_3",
        ["<", "wa", "ve>", " hi."],
        [EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833)],
    ),
    (
        "event_split_chars",
        ["<", "w", "a", "v", "e", ">", " hi."],
        [EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833)],
    ),
    (
        "boundary_action",
        ["I feel [", "jo", "y]."],
        [ActionCode(name="joy")],
    ),
    (
        "boundary_variant",
        ["Please {", "hold-", "mic}."],
        [VariantToggle(name="hold-mic", hotkey_id="hk-variant")],
    ),
    (
        "boundary_event",
        ["Then <", "wa", "ve>."],
        [EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833)],
    ),
    (
        "mixed_same_chunk",
        ["[joy] {hold-mic} <wave>."],
        [
            ActionCode(name="joy"),
            VariantToggle(name="hold-mic", hotkey_id="hk-variant"),
            EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833),
        ],
    ),
    (
        "mixed_split_pair",
        ["[joy] {", "hold-mic} <wave>."],
        [
            ActionCode(name="joy"),
            VariantToggle(name="hold-mic", hotkey_id="hk-variant"),
            EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833),
        ],
    ),
    ("unknown_action_dropped", ["text", " [", "not_in_catalog", "] more."], []),
    ("unknown_variant_dropped", ["text {nope} more."], []),
    ("unknown_event_dropped", ["text <think> reasoning </think> more."], []),
    ("mismatched_pair_dropped", ["[joy> text."], []),
    ("empty_brackets_dropped", ["[] {} <> text."], []),
    (
        "whitespace_inside",
        ["[ joy ] {  hold-mic  } < wave >."],
        [
            ActionCode(name="joy"),
            VariantToggle(name="hold-mic", hotkey_id="hk-variant"),
            EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833),
        ],
    ),
]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "case_name,deltas,expected",
    SPLIT_TOKEN_FIXTURES,
    ids=[case[0] for case in SPLIT_TOKEN_FIXTURES],
)
async def test_code_extractor_split_token(
    case_name,
    deltas,
    expected,
    plugin_action_codes,
    variants,
    events,
):
    @code_extractor(plugin_action_codes, variants, events)
    @sentence_divider(faster_first_response=False, segment_method="pysbd", valid_tags=[])
    async def stream() -> AsyncIterator[str]:
        for delta in deltas:
            yield delta

    all_dispatches = []
    async for item in stream():
        if isinstance(item, tuple) and len(item) == 2:
            sentence, dispatches = item
            all_dispatches.extend(dispatches)
            assert isinstance(sentence, SentenceWithTags)

    assert all_dispatches == expected, f"case={case_name}"


@pytest.mark.asyncio
async def test_code_extractor_preserves_sentence_text(
    plugin_action_codes,
    variants,
    events,
):
    @code_extractor(plugin_action_codes, variants, events)
    async def stream() -> AsyncIterator[SentenceWithTags]:
        yield SentenceWithTags(text="[joy] {hold-mic} <wave>.", tags=[])

    items = [item async for item in stream()]
    sentence, dispatches = items[0]

    assert sentence.text == "[joy] {hold-mic} <wave>."
    assert dispatches == [
        ActionCode(name="joy"),
        VariantToggle(name="hold-mic", hotkey_id="hk-variant"),
        EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833),
    ]


@pytest.mark.asyncio
async def test_unknown_event_dropped(plugin_action_codes, variants, events):
    @code_extractor(plugin_action_codes, variants, events)
    async def stream() -> AsyncIterator[SentenceWithTags]:
        yield SentenceWithTags(text="<think> private chain </think>.", tags=[])

    items = [item async for item in stream()]
    sentence, dispatches = items[0]

    assert sentence.text == "<think> private chain </think>."
    assert dispatches == []


@pytest.mark.asyncio
async def test_code_extractor_event_duration_fallback(
    plugin_action_codes,
    variants,
    fallback_events,
):
    @code_extractor(plugin_action_codes, variants, fallback_events)
    async def stream() -> AsyncIterator[SentenceWithTags]:
        yield SentenceWithTags(text="<wave>.", tags=[])

    items = [item async for item in stream()]
    _, dispatches = items[0]

    assert dispatches == [
        EventFire(name="wave", hotkey_id="hk-event", duration_ms=10000)
    ]


@pytest.mark.asyncio
async def test_full_decorator_chain_strips_all_code_syntax(
    plugin_action_codes,
    variants,
    events,
):
    @tts_filter(TTSPreprocessorConfig())
    @display_processor()
    @code_extractor(plugin_action_codes, variants, events)
    @sentence_divider(faster_first_response=False, segment_method="pysbd", valid_tags=[])
    async def chat_stream() -> AsyncIterator[str]:
        for delta in ["Hello [", "jo", "y] {hold-", "mic} <", "wave>."]:
            yield delta

    outputs: list[SentenceOutput] = []
    async for item in chat_stream():
        if isinstance(item, SentenceOutput):
            outputs.append(item)

    assert len(outputs) >= 1
    joined_display = " ".join(output.display_text.text for output in outputs)
    joined_tts = " ".join(output.tts_text for output in outputs)
    all_dispatches = [dispatch for output in outputs for dispatch in output.dispatches]

    for text in (joined_display, joined_tts):
        assert "[" not in text
        assert "]" not in text
        assert "{" not in text
        assert "}" not in text
        assert "<" not in text
        assert ">" not in text

    assert "Hello" in joined_display
    assert all_dispatches == [
        ActionCode(name="joy"),
        VariantToggle(name="hold-mic", hotkey_id="hk-variant"),
        EventFire(name="wave", hotkey_id="hk-event", duration_ms=2833),
    ]
