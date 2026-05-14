"""Final-transcript STT evaluation helpers for Phase 21."""

from .corpus import AudioManifestEntry, CorpusCase, load_phase21_corpus, validate_corpus_cases
from .scoring import ScoreResult, score_transcript

__all__ = [
    "AudioManifestEntry",
    "CorpusCase",
    "ScoreResult",
    "load_phase21_corpus",
    "score_transcript",
    "validate_corpus_cases",
]

