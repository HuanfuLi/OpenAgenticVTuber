# head_only Rating

**Status:** Deferred log/video evidence; live VTS was unavailable during 04-04 execution.

**Visible?** Not operator-confirmed in this run. The strategy is expected to move head parameters during TTS and may layer breathing if the rig accepts the configured parameter writes, but Phase 5 SC-01 must verify this on the running Teto model.

**Coupled to speech?** Not operator-confirmed in this run. The speech driver should couple RMS to head motion, and the deferred log stub in `log_capture.txt` shows the required capture format for the re-run.

**Acceptable for v1?** Provisionally yes as the safe fallback because the project explicitly allows head-only motion with documented rationale when non-fallback body-sway strategies are not viable. This rating must be replaced with live observation before Phase 5 SC-01 sign-off.

**Video:** Missing. `clip.mp4` must be captured during the Phase 5 live re-run.

**Plot:** `rms_vs_output.png` is a placeholder generated from the deferred log and must be regenerated from live `[SPEECH-DRIVER]` samples.
