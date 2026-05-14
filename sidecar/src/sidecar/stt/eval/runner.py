from __future__ import annotations

from dataclasses import dataclass, field
import time
from typing import Mapping

from contracts import STTProviderConfig
from sidecar.stt.provider import STTProviderError, STTRequest, STTResult

from .corpus import CorpusCase
from .scoring import ScoreResult, score_transcript


@dataclass(frozen=True)
class ProviderEvalTarget:
    provider_id: str
    config: STTProviderConfig
    provider: object | None = None
    audio_by_case_id: Mapping[str, bytes] = field(default_factory=dict)
    model_id: str | None = None
    runtime_metadata: Mapping[str, str] = field(default_factory=dict)
    ready: bool = True
    blocked_reason: str | None = None


@dataclass(frozen=True)
class ProviderCaseRow:
    provider_id: str
    case_id: str
    status: str
    transcript: str | None = None
    language: str | None = None
    latency_ms: float | None = None
    model_id: str | None = None
    runtime_metadata: dict[str, str] = field(default_factory=dict)
    score: ScoreResult | None = None
    redacted_diagnostics: dict[str, str] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return self.status == "passed" and self.score is not None and self.score.passed


@dataclass(frozen=True)
class ScorecardRun:
    corpus_version: str
    rows: tuple[ProviderCaseRow, ...]
    recommendation: dict[str, str]


def run_scorecard(
    cases: list[CorpusCase],
    providers: list[ProviderEvalTarget],
    *,
    corpus_version: str = "2026-05-13-final-transcript-v1",
) -> ScorecardRun:
    rows: list[ProviderCaseRow] = []
    for target in providers:
        blocked = _blocked_status(target)
        if blocked is not None:
            rows.extend(_provider_blocked_rows(target, cases, blocked))
            continue
        for case in cases:
            rows.append(_run_case(target, case))
    return ScorecardRun(
        corpus_version=corpus_version,
        rows=tuple(rows),
        recommendation=local_recommendation(tuple(rows)),
    )


def local_recommendation(rows: tuple[ProviderCaseRow, ...]) -> dict[str, str]:
    providers = sorted({row.provider_id for row in rows})
    result: dict[str, str] = {}
    for provider_id in providers:
        provider_rows = [row for row in rows if row.provider_id == provider_id]
        if provider_id in {"openai", "groq"}:
            result[provider_id] = "excluded-cloud"
            continue
        scored = [row for row in provider_rows if row.score is not None]
        if not scored:
            result[provider_id] = "unchanged"
            continue
        hard_pass_rate = sum(1 for row in scored if row.passed) / len(scored)
        no_translation_failures = sum(
            1
            for row in scored
            if row.score is not None and "translation_or_language_collapse" in row.score.hard_failures
        )
        if hard_pass_rate >= 0.9 and no_translation_failures == 0:
            result[provider_id] = "switch-candidate" if provider_id != "funasr" else "unchanged"
        elif hard_pass_rate >= 0.7:
            result[provider_id] = "limited-code-switch"
        else:
            result[provider_id] = "limited-code-switch"
    if "funasr" not in result:
        result["funasr"] = "unchanged"
    return result


def _run_case(target: ProviderEvalTarget, case: CorpusCase) -> ProviderCaseRow:
    audio = target.audio_by_case_id.get(case.case_id)
    if not audio:
        return ProviderCaseRow(
            provider_id=target.provider_id,
            case_id=case.case_id,
            status="missing_audio",
            model_id=target.model_id,
            runtime_metadata=dict(target.runtime_metadata),
            redacted_diagnostics={"audio": "missing"},
        )
    if target.provider is None:
        return ProviderCaseRow(
            provider_id=target.provider_id,
            case_id=case.case_id,
            status="skipped",
            model_id=target.model_id,
            runtime_metadata=dict(target.runtime_metadata),
            redacted_diagnostics={"provider": "not_available"},
        )
    started = time.perf_counter()
    try:
        result = target.provider.transcribe(
            STTRequest(
                audio_bytes=audio,
                sample_rate_hz=16000,
                duration_ms=0,
                language_mode=target.config.language_mode if target.config.language_mode != "auto" else "auto",
                provider_id=target.provider_id,
                model_id=target.model_id,
            )
        )
    except STTProviderError as exc:
        return ProviderCaseRow(
            provider_id=target.provider_id,
            case_id=case.case_id,
            status="error",
            model_id=target.model_id,
            runtime_metadata=dict(target.runtime_metadata),
            redacted_diagnostics={**exc.redacted_diagnostics, "summary": exc.summary},
        )
    latency_ms = result.latency_ms if result.latency_ms is not None else (time.perf_counter() - started) * 1000
    score = score_transcript(case, result.text)
    return ProviderCaseRow(
        provider_id=target.provider_id,
        case_id=case.case_id,
        status="passed" if score.passed else "failed",
        transcript=result.text,
        language=result.language,
        latency_ms=latency_ms,
        model_id=result.model_id or target.model_id,
        runtime_metadata=dict(target.runtime_metadata),
        score=score,
        redacted_diagnostics=dict(result.redacted_diagnostics),
    )


def _blocked_status(target: ProviderEvalTarget) -> str | None:
    if target.blocked_reason:
        return target.blocked_reason
    if not target.ready:
        return "not_ready"
    if target.provider_id in {"openai", "groq"}:
        cloud = target.config.cloud.get(target.provider_id)
        if cloud is None or not cloud.consent_granted:
            return "missing_cloud_consent"
        if not cloud.api_key:
            return "missing_cloud_key"
    return None


def _provider_blocked_rows(target: ProviderEvalTarget, cases: list[CorpusCase], reason: str) -> list[ProviderCaseRow]:
    status = "blocked" if reason.startswith("missing_cloud") or reason == "not_ready" else "skipped"
    return [
        ProviderCaseRow(
            provider_id=target.provider_id,
            case_id=case.case_id,
            status=status,
            model_id=target.model_id,
            runtime_metadata=dict(target.runtime_metadata),
            redacted_diagnostics={"reason": reason, "provider": target.provider_id},
        )
        for case in cases
    ]

