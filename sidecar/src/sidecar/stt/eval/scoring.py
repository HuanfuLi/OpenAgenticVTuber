from __future__ import annotations

from dataclasses import dataclass, field
import re
import unicodedata

from .corpus import CorpusCase


_CJK_RE = re.compile(r"[\u3400-\u9fff]")
_LATIN_RE = re.compile(r"[A-Za-z]")
_TRADITIONAL_TO_SIMPLIFIED = str.maketrans({
    "臺": "台",
    "體": "体",
    "聲": "声",
    "語": "语",
    "請": "请",
    "繼": "继",
    "續": "续",
    "點": "点",
    "關": "关",
    "鍵": "键",
})


@dataclass(frozen=True)
class ScoreResult:
    case_id: str
    passed: bool
    hard_failures: tuple[str, ...] = field(default_factory=tuple)
    missing_key_tokens: tuple[str, ...] = field(default_factory=tuple)
    cer: float = 0.0
    wer_like: float | None = None
    normalized_expected: str = ""
    normalized_transcript: str = ""


def score_transcript(case: CorpusCase, transcript: str, *, semantic_pass: bool | None = None) -> ScoreResult:
    normalized_expected = normalize_text(case.expected_text)
    normalized_transcript = normalize_text(transcript)
    failures: list[str] = []
    if not normalized_transcript:
        failures.append("empty_transcript")
    if semantic_pass is False:
        failures.append("semantic_mismatch")
    missing_tokens = tuple(
        token for token in case.key_tokens
        if normalize_text(token) and normalize_text(token) not in normalized_transcript
    )
    if missing_tokens:
        failures.append("missing_key_tokens")
    if _translation_or_language_collapse(case.expected_text, transcript):
        failures.append("translation_or_language_collapse")
    cer = _char_error_rate(normalized_expected, normalized_transcript)
    wer_like = _word_error_rate(normalized_expected, normalized_transcript)
    return ScoreResult(
        case_id=case.case_id,
        passed=not failures,
        hard_failures=tuple(failures),
        missing_key_tokens=missing_tokens,
        cer=cer,
        wer_like=wer_like,
        normalized_expected=normalized_expected,
        normalized_transcript=normalized_transcript,
    )


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).translate(_TRADITIONAL_TO_SIMPLIFIED).lower()
    chars: list[str] = []
    previous_space = False
    for char in normalized:
        category = unicodedata.category(char)
        if category.startswith(("P", "S")):
            if not previous_space:
                chars.append(" ")
                previous_space = True
            continue
        if char.isspace():
            if not previous_space:
                chars.append(" ")
                previous_space = True
            continue
        chars.append(char)
        previous_space = False
    return "".join(chars).strip()


def _translation_or_language_collapse(expected: str, transcript: str) -> bool:
    expected_has_cjk = bool(_CJK_RE.search(expected))
    expected_has_latin = bool(_LATIN_RE.search(expected))
    transcript_has_cjk = bool(_CJK_RE.search(transcript))
    transcript_has_latin = bool(_LATIN_RE.search(transcript))
    if expected_has_cjk and not transcript_has_cjk:
        return True
    if expected_has_latin and not transcript_has_latin:
        return True
    return False


def _char_error_rate(expected: str, transcript: str) -> float:
    expected_chars = [char for char in expected if not char.isspace()]
    transcript_chars = [char for char in transcript if not char.isspace()]
    if not expected_chars:
        return 0.0 if not transcript_chars else 1.0
    return _levenshtein(expected_chars, transcript_chars) / len(expected_chars)


def _word_error_rate(expected: str, transcript: str) -> float | None:
    expected_words = expected.split()
    transcript_words = transcript.split()
    if len(expected_words) < 2:
        return None
    return _levenshtein(expected_words, transcript_words) / len(expected_words)


def _levenshtein(a: list[str], b: list[str]) -> int:
    if not a:
        return len(b)
    if not b:
        return len(a)
    previous = list(range(len(b) + 1))
    for i, item_a in enumerate(a, start=1):
        current = [i]
        for j, item_b in enumerate(b, start=1):
            current.append(min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + (0 if item_a == item_b else 1),
            ))
        previous = current
    return previous[-1]

