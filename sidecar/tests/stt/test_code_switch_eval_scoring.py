from __future__ import annotations

from pathlib import Path

import pytest

from sidecar.stt.eval.corpus import CorpusCase, is_phase21_raw_audio_path, load_phase21_corpus, validate_corpus_cases
from sidecar.stt.eval.scoring import normalize_text, score_transcript


def mixed_case() -> CorpusCase:
    return CorpusCase(
        case_id="mixed-1",
        expected_text="请把 brightness 调到 fifty percent",
        language_mix="mixed",
        semantic_intent="set brightness to half",
        key_tokens=("brightness", "fifty", "percent"),
        no_translation="keep Chinese and English",
    )


def test_phase21_corpus_has_locked_generic_cases() -> None:
    cases = load_phase21_corpus()
    assert 20 <= len(cases) <= 30
    assert {case.language_mix for case in cases} == {"zh", "en", "mixed"}
    assert all("Teto" not in case.expected_text for case in cases)
    assert all("OpenAI" not in case.expected_text for case in cases)


def test_no_translation_failure_when_mixed_language_collapses_to_english() -> None:
    result = score_transcript(mixed_case(), "Please set brightness to fifty percent")

    assert result.passed is False
    assert "translation_or_language_collapse" in result.hard_failures


def test_key_token_failure_blocks_pass() -> None:
    result = score_transcript(mixed_case(), "请把亮度调到一半")

    assert result.passed is False
    assert result.missing_key_tokens == ("brightness", "fifty", "percent")
    assert "missing_key_tokens" in result.hard_failures


def test_punctuation_case_and_traditional_variants_are_normalized() -> None:
    case = CorpusCase(
        case_id="zh-1",
        expected_text="請繼續用中文回答",
        language_mix="zh",
        semantic_intent="continue in Chinese",
        key_tokens=("继续", "中文"),
        no_translation="keep Chinese",
    )

    result = score_transcript(case, "请继续，用中文回答。")

    assert normalize_text("Hello, WORLD!") == "hello world"
    assert result.passed is True


def test_chinese_cer_is_diagnostic_not_a_hard_gate() -> None:
    case = CorpusCase(
        case_id="zh-2",
        expected_text="今天晚一点提醒我喝水",
        language_mix="zh",
        semantic_intent="water reminder",
        key_tokens=("今天", "喝水"),
        no_translation="keep Chinese",
    )

    result = score_transcript(case, "今天晚一点提醒我喝水")

    assert result.passed is True
    assert result.cer == 0
    assert result.wer_like is None


def test_semantic_marker_can_fail_otherwise_matching_text() -> None:
    result = score_transcript(mixed_case(), "请把 brightness 调到 fifty percent", semantic_pass=False)

    assert result.passed is False
    assert "semantic_mismatch" in result.hard_failures


def test_duplicate_corpus_id_rejected() -> None:
    case = mixed_case()
    with pytest.raises(ValueError, match="Duplicate corpus case ids"):
        validate_corpus_cases([case, case])


def test_raw_audio_path_policy_identifies_ignored_local_audio() -> None:
    assert is_phase21_raw_audio_path(Path(".planning/eval-audio/phase-21/sample.wav"))
    assert not is_phase21_raw_audio_path(Path(".planning/phases/21-code-switch-evaluation-hardening/21-CORPUS.md"))

