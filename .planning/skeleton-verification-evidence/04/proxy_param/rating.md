# proxy_param Rating

**Status:** Deferred log/video evidence; live VTS was unavailable during 04-04 execution.

**Visible?** Not operator-confirmed in this run. `Lean Forward` remains unproven because the 04-00 smoke-pass also recorded `smoke_pass_status: deferred`; Phase 5 SC-01 must test whether writes to this proxy produce visible body or head motion on Teto.

**Coupled to speech?** Not operator-confirmed in this run. The expected evidence is a `[SPEECH-DRIVER strategy=proxy_param ... body_params=[Lean Forward=...]]` capture plus the RMS-vs-output plot regenerated from that capture.

**Acceptable for v1?** Not acceptable as the ship default until the live A/B confirms visible motion coupled to TTS RMS. If Phase 5 proves it visible and coupled, this strategy should replace `head_only` in `avatars/teto/teto_overrides.yaml`.

**Video:** Missing. `clip.mp4` must be captured during the Phase 5 live re-run.

**Plot:** `rms_vs_output.png` is a placeholder generated from the deferred log and must be regenerated from live `[SPEECH-DRIVER]` samples.
