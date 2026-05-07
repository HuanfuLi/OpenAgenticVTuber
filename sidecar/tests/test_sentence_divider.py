"""SentenceDivider buffer-then-extract tests (RESEARCH Pitfall 4 / 8).

These tests prove SC #3 at the divider layer: split-bracket token deltas
do not corrupt sentence boundaries, and the bracket characters survive
to actions_extractor whole.
"""
from typing import AsyncIterator

import pytest

from sidecar.orchestrator.sentence_divider import SentenceDivider, SentenceWithTags


async def _fake_stream(deltas):
    for d in deltas:
        yield d


@pytest.mark.asyncio
async def test_split_bracket_token_deltas():
    """SC #3 fixture: '[joy]' arrives as ['[','jo','y]', ...]; whole sentences emerge."""
    deltas = ["[", "jo", "y]", " hello", " world.", " A", " second", " sentence."]
    divider = SentenceDivider(
        faster_first_response=False, segment_method="pysbd", valid_tags=[]
    )
    sentences = []
    async for item in divider.process_stream(_fake_stream(deltas)):
        if isinstance(item, SentenceWithTags):
            sentences.append(item)
    # Allow at least 2 sentences emerged; both sentences in joined form must
    # contain the literal bracketed tag and the expected words.
    assert len(sentences) >= 2, f"got {len(sentences)} sentences: {sentences}"
    joined = " ".join(s.text for s in sentences)
    assert "[joy]" in joined  # bracket text intact through the divider
    assert "hello world" in joined
    assert "second sentence" in joined


@pytest.mark.asyncio
async def test_split_hyphenated_action_tag():
    deltas = ["[hold", "-", "mic", "]", " ready."]
    divider = SentenceDivider(
        faster_first_response=False, segment_method="pysbd", valid_tags=[]
    )
    sentences = []
    async for item in divider.process_stream(_fake_stream(deltas)):
        if isinstance(item, SentenceWithTags):
            sentences.append(item)
    assert len(sentences) >= 1
    joined = " ".join(s.text for s in sentences)
    assert "[hold-mic]" in joined


@pytest.mark.asyncio
async def test_xml_substring_no_tag_state_drift():
    """Pitfall 8: with valid_tags=[], <html> / <body> must not enter tag-state."""
    deltas = ["Look at <html><body></body></html> for example. ", "Done."]
    divider = SentenceDivider(
        faster_first_response=False, segment_method="pysbd", valid_tags=[]
    )
    sentences = []
    async for item in divider.process_stream(_fake_stream(deltas)):
        if isinstance(item, SentenceWithTags):
            sentences.append(item)
    assert len(sentences) >= 2
