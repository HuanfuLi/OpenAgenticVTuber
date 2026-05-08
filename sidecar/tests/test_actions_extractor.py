"""actions_extractor + full decorator-chain tests (CONTEXT D-13 / SC #3).

Test 8 in particular is the SC #3 headline: drive the FULL 4-decorator
chain with the split-bracket adversarial fixture and assert that no
`[`/`]` character leaks to display_text or tts_text, AND that two
ActionIntents (joy=expression, hold-mic=action) are produced.
"""
from typing import AsyncIterator
from pathlib import Path

import pytest

from contracts import ActionIntent
from sidecar.avatar.capabilities import AvatarCapabilities, Expression, Hotkey, load_capabilities
from sidecar.orchestrator.output_types import SentenceOutput
from sidecar.orchestrator.sentence_divider import SentenceWithTags
from sidecar.orchestrator.transformers import (
    actions_extractor,
    display_processor,
    sentence_divider,
    tts_filter,
)
from sidecar.orchestrator.tts_preprocessor import TTSPreprocessorConfig


def _caps(expressions=("joy", "smile"), hotkeys=("cry", "hold-mic")) -> AvatarCapabilities:
    return AvatarCapabilities(
        expressions=[Expression(name=n, file=f"{n}.exp3.json") for n in expressions],
        hotkeys=[Hotkey(name=n, type="ToggleExpression") for n in hotkeys],
    )


@pytest.mark.asyncio
async def test_extract_intents_split_bracket():
    caps = _caps()

    @actions_extractor(caps)
    async def fake() -> AsyncIterator:
        yield SentenceWithTags(text=" hello [joy] world", tags=[])

    items = [x async for x in fake()]
    assert len(items) == 1
    sentence, intents = items[0]
    assert len(intents) == 1
    assert intents[0].kind == "expression"
    assert intents[0].name == "joy"
    assert intents[0].avatar_id == "teto"


@pytest.mark.asyncio
async def test_unknown_tag_silently_dropped():
    caps = _caps()

    @actions_extractor(caps)
    async def fake() -> AsyncIterator:
        yield SentenceWithTags(text=" foo [unknown] bar", tags=[])

    items = [x async for x in fake()]
    sentence, intents = items[0]
    assert intents == []


@pytest.mark.asyncio
async def test_hotkey_classified_as_action():
    caps = _caps()

    @actions_extractor(caps)
    async def fake() -> AsyncIterator:
        yield SentenceWithTags(text=" cry [cry] now", tags=[])

    items = [x async for x in fake()]
    sentence, intents = items[0]
    assert len(intents) == 1
    assert intents[0].kind == "action"
    assert intents[0].name == "cry"


@pytest.mark.asyncio
async def test_expression_takes_priority_over_hotkey():
    # Both lists contain "smile" -- expression-first per D-13
    caps = AvatarCapabilities(
        expressions=[Expression(name="smile", file="smile.exp3.json")],
        hotkeys=[Hotkey(name="smile", type="ToggleExpression")],
    )

    @actions_extractor(caps)
    async def fake() -> AsyncIterator:
        yield SentenceWithTags(text=" [smile]", tags=[])

    items = [x async for x in fake()]
    sentence, intents = items[0]
    assert intents[0].kind == "expression"


@pytest.mark.asyncio
async def test_full_decorator_chain_strips_brackets():
    """SC #3 headline test -- drive the full pipeline with split-bracket
    deltas and assert: display_text contains hello/world but NO [/]; two
    intents emitted (joy=expression, hold-mic=action); tts_text also
    bracket-free (ignore_brackets=True default).
    """
    caps = _caps()

    @tts_filter(TTSPreprocessorConfig())
    @display_processor()
    @actions_extractor(caps)
    @sentence_divider(faster_first_response=False, segment_method="pysbd", valid_tags=[])
    async def chat_stream() -> AsyncIterator[str]:
        for delta in [
            "[",
            "jo",
            "y]",
            " hello",
            " ",
            "[hold",
            "-",
            "mic",
            "]",
            " world.",
        ]:
            yield delta

    outputs: list[SentenceOutput] = []
    async for out in chat_stream():
        if isinstance(out, SentenceOutput):
            outputs.append(out)

    # The pipeline may yield 1+ sentences depending on pysbd's interpretation;
    # collapse and assert across the whole turn.
    assert len(outputs) >= 1, f"expected >=1 sentence, got {len(outputs)}"
    joined_display = " ".join(o.display_text.text for o in outputs)
    joined_tts = " ".join(o.tts_text for o in outputs)
    all_intents = [i for o in outputs for i in o.actions]

    assert "hello" in joined_display
    assert "world" in joined_display
    # SC #3 BLOCKER: brackets stripped from BOTH display and TTS.
    # display: stripped by display_processor (skeleton-side adaptation; see
    #   transformers.py docstring).
    # tts: stripped by tts_filter (ignore_brackets=True default).
    assert "[" not in joined_display, f"[ leaked into display: {joined_display!r}"
    assert "]" not in joined_display, f"] leaked into display: {joined_display!r}"
    assert "[" not in joined_tts, f"[ leaked into TTS: {joined_tts!r}"
    assert "]" not in joined_tts, f"] leaked into TTS: {joined_tts!r}"

    names = sorted(i.name for i in all_intents)
    kinds = sorted(i.kind for i in all_intents)
    assert names == ["hold-mic", "joy"], f"got names={names}, intents={all_intents}"
    assert kinds == ["action", "expression"], f"got kinds={kinds}"


@pytest.mark.asyncio
async def test_real_teto_avatar_yaml_extracts_joy_intent():
    repo_root = Path(__file__).resolve().parents[2]
    caps = load_capabilities(repo_root / "avatars" / "teto")

    @actions_extractor(caps)
    async def fake() -> AsyncIterator:
        yield SentenceWithTags(text="[joy] Got it!", tags=[])

    items = [x async for x in fake()]
    sentence, intents = items[0]

    assert sentence.text == "[joy] Got it!"
    assert len(intents) == 1
    assert intents[0] == ActionIntent(kind="expression", name="joy", avatar_id="teto")
