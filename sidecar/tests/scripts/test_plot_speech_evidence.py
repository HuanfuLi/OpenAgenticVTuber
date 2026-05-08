from pathlib import Path

from scripts.plot_speech_evidence import parse_body_params, parse_log


def test_parse_log_accepts_real_runtime_speech_driver_format(tmp_path: Path) -> None:
    log_path = tmp_path / "speech.log"
    line = "[SPEECH-DRIVER] sentence_id=1 strategy=head_only rms=0.500 mouth=0.315 body_params=[FaceAngleX=0.050,FaceAngleY=-0.010]\n"
    log_path.write_text(line, encoding="utf-8")

    timestamps, rms, body = parse_log(log_path)

    assert timestamps == [0.0]
    assert rms == [0.5]
    assert body[0]["FaceAngleX"] == 0.05
    assert body[0]["FaceAngleY"] == -0.01


def test_parse_log_accepts_legacy_stub_format(tmp_path: Path) -> None:
    log_path = tmp_path / "speech.log"
    log_path.write_text(
        "[SPEECH-DRIVER strategy=head_only rms=0.500 mouth=0.315 "
        "body_params=[FaceAngleX=0.050]]\n",
        encoding="utf-8",
    )

    timestamps, rms, body = parse_log(log_path)

    assert timestamps == [0.0]
    assert rms == [0.5]
    assert body[0]["FaceAngleX"] == 0.05


def test_parse_body_params_handles_empty_body_params() -> None:
    assert parse_body_params("") == {}
