# 02-CONTEXT.md amendment -- OLVT-canonical envelope adoption

**Date:** 2026-05-06 (Phase 2 Plan 01 execution)
**Authority:** 02-01 planner-time decision; per RESEARCH.md §Discrepancies 1-4
recommendation; per project memory `feedback_olvt_port_preference`.

## Amendments

### D-02 (revised)

CONTEXT.md D-02 says the WS envelope is `{type:"audio-payload", audio_b64:...,
display_text:..., actions:..., sentence_id:...}`. Per RESEARCH.md verification
of `OpenLLM_Vtuber/src/open_llm_vtuber/utils/stream_audio.py:50-60`, the
OLVT-canonical envelope is:

```
{
  "type": "audio",                     # NOT "audio-payload"
  "audio": <base64-string|None>,       # NOT "audio_b64"
  "volumes": [<float>, ...],           # additional OLVT field
  "slice_length": <int, default 20>,   # additional OLVT field
  "display_text": {"text", "name", "avatar"},
  "actions": <list[ActionIntent]>,     # diverged from OLVT Actions per D-12
  "forwarded": <bool, default False>,  # additional OLVT field
  "sentence_id": <int>                 # Phase-2 skeleton-side extension (Discrepancy 4)
}
```

D-02 is hereby updated to reflect OLVT-canonical names. Phase 3 fills `audio`
with the base64 wav and `volumes` with the RMS envelope. `forwarded` stays
False in the single-user skeleton; preserved for protocol-shape parity with
OLVT (PROJECT_DESIGN §14 success criterion #6).

### D-12 (clarified)

OLVT's `Actions` dataclass is `{expressions, pictures, sounds}` (each `list[str]`).
Per CONTEXT D-12 the skeleton instead carries `list[ActionIntent]` matching
PROJECT_DESIGN §6 lines 723-737 (`kind`, `name`, `strength`, `duration_ms`,
`avatar_id`). This divergence is intentional for Phase 4 compositor blend
semantics; recorded in PROVENANCE.md.

### Implications for downstream plans

- 02-02 orchestrator emits AudioPayloadMessage with `type="audio"`, `audio=None`.
- 02-03 renderer dispatches on `msg.type === 'audio'` (NOT 'audio-payload').
- ROADMAP Phase 2 SC #4 wording update: handled in 02-03 Task 3.

## Non-amendments

D-01, D-03..D-09, D-11, D-13..D-23 are unchanged. Only the envelope-name
field-name surface is amended; the behavioral contracts hold.
