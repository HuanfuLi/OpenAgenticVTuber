from __future__ import annotations

from contracts import STTProviderConfig
from sidecar.stt.eval.corpus import CorpusCase
from sidecar.stt.eval.runner import ProviderEvalTarget, run_scorecard
from sidecar.stt.provider import STTProviderError, STTRequest, STTResult


class FakeProvider:
    def __init__(self, transcripts: dict[str, str]) -> None:
        self.transcripts = transcripts
        self.requests: list[STTRequest] = []

    def transcribe(self, request: STTRequest) -> STTResult:
        self.requests.append(request)
        text = self.transcripts[request.audio_bytes.decode("ascii")]
        return STTResult(
            text=text,
            language=None,
            latency_ms=12,
            provider_id=request.provider_id,
            model_id=request.model_id,
            redacted_diagnostics={"provider": request.provider_id},
        )


class ErrorProvider:
    def transcribe(self, request: STTRequest) -> STTResult:
        raise STTProviderError(
            provider_id=request.provider_id,
            state="external_service_failure",
            summary="provider failed",
            retryable=True,
            redacted_diagnostics={"error_type": "RuntimeError"},
        )


def cases() -> list[CorpusCase]:
    return [
        CorpusCase(
            case_id="c1",
            expected_text="请把 brightness 调到 fifty percent",
            language_mix="mixed",
            semantic_intent="brightness",
            key_tokens=("brightness", "fifty", "percent"),
            no_translation="keep Chinese and English",
        ),
        CorpusCase(
            case_id="c2",
            expected_text="Please summarize the last message",
            language_mix="en",
            semantic_intent="summary",
            key_tokens=("summarize", "message"),
            no_translation="keep English",
        ),
    ]


def test_runner_scores_successful_local_provider_with_final_request_semantics() -> None:
    provider = FakeProvider({"c1": "请把 brightness 调到 fifty percent", "c2": "Please summarize the last message"})
    target = ProviderEvalTarget(
        provider_id="funasr",
        config=STTProviderConfig(active_provider="funasr", language_mode="auto"),
        provider=provider,
        audio_by_case_id={"c1": b"c1", "c2": b"c2"},
        model_id="iic/SenseVoiceSmall",
    )

    run = run_scorecard(cases(), [target])

    assert [row.status for row in run.rows] == ["passed", "passed"]
    assert run.recommendation["funasr"] == "unchanged"
    assert [request.language_mode for request in provider.requests] == ["auto", "auto"]
    assert all(hasattr(request, "audio_bytes") for request in provider.requests)
    assert not any(hasattr(request, "preview_chunk") for request in provider.requests)


def test_runner_records_provider_error_and_missing_audio_rows() -> None:
    run = run_scorecard(
        cases(),
        [
            ProviderEvalTarget(
                provider_id="faster_whisper",
                config=STTProviderConfig(active_provider="faster_whisper"),
                provider=ErrorProvider(),
                audio_by_case_id={"c1": b"c1"},
                model_id="small",
            )
        ],
    )

    statuses = {row.case_id: row.status for row in run.rows}
    assert statuses == {"c1": "error", "c2": "missing_audio"}
    assert run.rows[0].redacted_diagnostics["summary"] == "provider failed"


def test_runner_blocks_cloud_without_consent_or_key_and_excludes_from_default_recommendation() -> None:
    missing_consent = STTProviderConfig(active_provider="openai")
    missing_key = STTProviderConfig(active_provider="groq")
    missing_key.cloud["groq"].consent_granted = True

    run = run_scorecard(
        cases(),
        [
            ProviderEvalTarget(provider_id="openai", config=missing_consent),
            ProviderEvalTarget(provider_id="groq", config=missing_key),
        ],
    )

    assert {row.status for row in run.rows} == {"blocked"}
    assert {row.provider_id: run.recommendation[row.provider_id] for row in run.rows} == {
        "openai": "excluded-cloud",
        "groq": "excluded-cloud",
    }
    assert {row.redacted_diagnostics["reason"] for row in run.rows} == {"missing_cloud_consent", "missing_cloud_key"}

