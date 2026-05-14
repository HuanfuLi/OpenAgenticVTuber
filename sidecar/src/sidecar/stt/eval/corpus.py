from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


LanguageMix = Literal["zh", "en", "mixed"]
RAW_AUDIO_ROOT = Path(".planning/eval-audio/phase-21")


@dataclass(frozen=True)
class CorpusCase:
    case_id: str
    expected_text: str
    language_mix: LanguageMix
    semantic_intent: str
    key_tokens: tuple[str, ...]
    no_translation: str
    audio_file: str | None = None
    audio_sha256: str | None = None

    @property
    def has_local_audio(self) -> bool:
        return bool(self.audio_file)


@dataclass(frozen=True)
class AudioManifestEntry:
    case_id: str
    filename: str
    sha256: str | None = None
    duration_ms: int | None = None
    sample_rate_hz: int | None = None
    metadata: dict[str, str] = field(default_factory=dict)

    def relative_path(self) -> Path:
        path = Path(self.filename)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError(f"Audio filename must be a local token: {self.filename}")
        return RAW_AUDIO_ROOT / path


def load_phase21_corpus(path: Path | None = None) -> list[CorpusCase]:
    corpus_path = path or _default_corpus_path()
    return validate_corpus_cases(_parse_markdown_table(corpus_path.read_text(encoding="utf-8")))


def validate_corpus_cases(cases: list[CorpusCase]) -> list[CorpusCase]:
    if not cases:
        raise ValueError("Corpus must contain at least one case.")
    ids = [case.case_id for case in cases]
    duplicate_ids = sorted({case_id for case_id in ids if ids.count(case_id) > 1})
    if duplicate_ids:
        raise ValueError(f"Duplicate corpus case ids: {', '.join(duplicate_ids)}")
    for case in cases:
        if not case.case_id.strip():
            raise ValueError("Corpus case id must be non-empty.")
        if not case.expected_text.strip():
            raise ValueError(f"{case.case_id}: expected_text must be non-empty.")
        if case.language_mix == "mixed" and not case.key_tokens:
            raise ValueError(f"{case.case_id}: mixed cases require key tokens.")
        if case.audio_file:
            AudioManifestEntry(case_id=case.case_id, filename=case.audio_file, sha256=case.audio_sha256).relative_path()
    mixes = {case.language_mix for case in cases}
    for required in ("zh", "en", "mixed"):
        if required not in mixes:
            raise ValueError(f"Corpus must include at least one {required} case.")
    return cases


def is_phase21_raw_audio_path(path: str | Path) -> bool:
    candidate = Path(path)
    parts = candidate.parts
    return ".planning" in parts and "eval-audio" in parts and "phase-21" in parts


def _default_corpus_path() -> Path:
    return Path(__file__).resolve().parents[5] / ".planning/phases/21-code-switch-evaluation-hardening/21-CORPUS.md"


def _parse_markdown_table(text: str) -> list[CorpusCase]:
    rows: list[list[str]] = []
    in_table = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("|"):
            if in_table:
                break
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if cells and cells[0] == "case_id":
            in_table = True
            continue
        if in_table and cells and set(cells[0]) == {"-"}:
            continue
        if in_table and len(cells) >= 8:
            rows.append(cells[:8])
    cases = []
    for case_id, expected_text, language_mix, semantic_intent, key_tokens, no_translation, audio_file, audio_sha256 in rows:
        if language_mix not in {"zh", "en", "mixed"}:
            raise ValueError(f"{case_id}: invalid language_mix {language_mix}")
        cases.append(
            CorpusCase(
                case_id=case_id,
                expected_text=expected_text,
                language_mix=language_mix,  # type: ignore[arg-type]
                semantic_intent=semantic_intent,
                key_tokens=tuple(token.strip() for token in key_tokens.split(",") if token.strip()),
                no_translation=no_translation,
                audio_file=audio_file or None,
                audio_sha256=audio_sha256 or None,
            )
        )
    return cases

