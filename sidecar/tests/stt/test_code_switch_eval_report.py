from __future__ import annotations

from contracts import STTProviderConfig
from sidecar.stt.eval.corpus import CorpusCase
from sidecar.stt.eval.report import render_scorecard_markdown
from sidecar.stt.eval.runner import ProviderEvalTarget, run_scorecard
from sidecar.stt.provider import STTRequest, STTResult


class FakeProvider:
    def transcribe(self, request: STTRequest) -> STTResult:
        return STTResult(
            text="请把 brightness 调到 fifty percent",
            language=None,
            latency_ms=18,
            provider_id=request.provider_id,
            model_id=request.model_id,
            redacted_diagnostics={"api_key": "[redacted]", "provider": request.provider_id},
        )


def test_report_renders_deterministic_markdown_without_raw_audio_or_secrets() -> None:
    case = CorpusCase(
        case_id="c1",
        expected_text="请把 brightness 调到 fifty percent",
        language_mix="mixed",
        semantic_intent="brightness",
        key_tokens=("brightness", "fifty", "percent"),
        no_translation="keep Chinese and English",
    )
    run = run_scorecard(
        [case],
        [
            ProviderEvalTarget(
                provider_id="funasr",
                config=STTProviderConfig(active_provider="funasr"),
                provider=FakeProvider(),
                audio_by_case_id={"c1": b"fake wav bytes"},
                model_id="iic/SenseVoiceSmall",
            )
        ],
    )

    markdown = render_scorecard_markdown(run)

    assert "| funasr | scored | 100% |" in markdown
    assert "| funasr | c1 | passed | 请把 brightness 调到 fifty percent | pass |" in markdown
    assert "final submitted transcript evidence" in markdown
    assert "fake wav bytes" not in markdown
    assert "secret" not in markdown.lower()

