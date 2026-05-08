# exp3_modulation Rating

**Status:** Deferred and not currently viable with the checked-in Teto expression set.

**Visible?** No live attempt was made because `candidate_audit.md` found no existing body-tilt or body-sway expression candidate. Two expressions contain `ParamBHandIN`, but those are hand/prop toggles for microphone or baguette states, not a reusable body-pose primitive.

**Coupled to speech?** No. Without a viable body-pose `.exp3.json`, the strategy has no safe body-pose parameter set to modulate by RMS. A future Cubism-authored body-pose expression would need a new audit entry and a live re-run.

**Acceptable for v1?** No, not with the current rig artifacts. Authoring a new body-pose `.exp3.json` in Cubism Editor could unblock this later, but that is outside the walking-skeleton timebox.

**Video:** Missing. Capture only if a viable expression is authored and selected before Phase 5 SC-01.

**Plot:** `rms_vs_output.png` is a placeholder generated from the deferred log and must be regenerated from live `[SPEECH-DRIVER]` samples if the strategy becomes viable.
