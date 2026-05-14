from __future__ import annotations

from collections import defaultdict
from statistics import median

from .runner import ProviderCaseRow, ScorecardRun


def render_scorecard_markdown(run: ScorecardRun) -> str:
    lines = [
        "---",
        "phase: 21",
        "status: generated",
        f"corpus_version: {run.corpus_version}",
        "---",
        "",
        "# Phase 21 STT Code-Switch Scorecard",
        "",
        "All scored transcripts are final submitted transcript evidence. Preview chunks, partial captions, and removed live-preview behavior are out of scope.",
        "",
        "## Provider Summary",
        "",
        "| Provider | Status | Hard-gate pass rate | Key-token retention | No-translation failures | Median latency | Recommendation input |",
        "|---|---|---|---|---|---|---|",
    ]
    for provider_id, rows in _rows_by_provider(run.rows).items():
        lines.append(_summary_row(provider_id, rows, run.recommendation.get(provider_id, "unchanged")))
    lines.extend([
        "",
        "## Per-Case Evidence",
        "",
        "| Provider | Case | Status | Final transcript | Hard gates | CER | WER-like | Latency ms | Diagnostics |",
        "|---|---|---|---|---|---|---|---|---|",
    ])
    for row in sorted(run.rows, key=lambda item: (item.provider_id, item.case_id)):
        lines.append(_case_row(row))
    return "\n".join(lines) + "\n"


def _rows_by_provider(rows: tuple[ProviderCaseRow, ...]) -> dict[str, list[ProviderCaseRow]]:
    grouped: dict[str, list[ProviderCaseRow]] = defaultdict(list)
    for row in rows:
        grouped[row.provider_id].append(row)
    return dict(sorted(grouped.items()))


def _summary_row(provider_id: str, rows: list[ProviderCaseRow], recommendation: str) -> str:
    scored = [row for row in rows if row.score is not None]
    if not scored:
        statuses = sorted({row.status for row in rows})
        return f"| {provider_id} | {', '.join(statuses)} | n/a | n/a | n/a | n/a | {recommendation} |"
    pass_rate = sum(1 for row in scored if row.passed) / len(scored)
    key_total = sum(len(row.score.missing_key_tokens) + len(_retained_tokens(row)) for row in scored if row.score is not None)
    key_missing = sum(len(row.score.missing_key_tokens) for row in scored if row.score is not None)
    key_retention = "n/a" if key_total == 0 else f"{(key_total - key_missing) / key_total:.0%}"
    no_translation_failures = sum(
        1 for row in scored if row.score is not None and "translation_or_language_collapse" in row.score.hard_failures
    )
    latencies = [row.latency_ms for row in scored if row.latency_ms is not None]
    latency = f"{median(latencies):.0f} ms" if latencies else "n/a"
    return (
        f"| {provider_id} | scored | {pass_rate:.0%} | {key_retention} | "
        f"{no_translation_failures} | {latency} | {recommendation} |"
    )


def _case_row(row: ProviderCaseRow) -> str:
    score = row.score
    gates = "pass" if score and score.passed else ", ".join(score.hard_failures) if score else "n/a"
    cer = f"{score.cer:.2f}" if score else "n/a"
    wer = f"{score.wer_like:.2f}" if score and score.wer_like is not None else "n/a"
    latency = f"{row.latency_ms:.0f}" if row.latency_ms is not None else "n/a"
    transcript = _escape(row.transcript or "")
    diagnostics = _escape("; ".join(f"{key}={value}" for key, value in sorted(row.redacted_diagnostics.items())))
    return f"| {row.provider_id} | {row.case_id} | {row.status} | {transcript} | {gates} | {cer} | {wer} | {latency} | {diagnostics} |"


def _retained_tokens(row: ProviderCaseRow) -> tuple[str, ...]:
    if row.score is None:
        return ()
    return tuple(token for token in row.score.normalized_expected.split() if token and token in row.score.normalized_transcript)


def _escape(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ").strip()

