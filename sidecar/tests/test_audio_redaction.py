from __future__ import annotations

from sidecar.audio.redaction import redact_audio_diagnostics


def test_redacts_audio_diagnostics_secrets_paths_and_transcripts() -> None:
    redacted = redact_audio_diagnostics(
        {
            "api_key": "sk-secret-value",
            "detail": "authorization: bearer-token path=C:\\Users\\alice\\private\\ref.wav",
            "transcript_text": "send this speech to the model",
        }
    )

    rendered = str(redacted)
    assert "sk-secret-value" not in rendered
    assert "bearer-token" not in rendered
    assert "alice" not in rendered
    assert "private" not in rendered
    assert "send this speech" not in rendered
    assert redacted["api_key"] == "[redacted]"
    assert redacted["transcript_text"] == "[transcript redacted]"
