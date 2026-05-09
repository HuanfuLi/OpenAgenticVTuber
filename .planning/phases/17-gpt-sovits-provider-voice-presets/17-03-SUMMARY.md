---
phase: 17-gpt-sovits-provider-voice-presets
plan: 17-03
subsystem: tts-provider
tags: [gpt-sovits, sidecar, fastapi, tts, health-check, test-synthesis]
requires:
  - phase: 17-01
    provides: GPT-SoVITS provider/test-synthesis contracts and failed-audio payload metadata
  - phase: 17-02
    provides: managed reference-audio validation and preset/reference storage contracts
provides:
  - GPT-SoVITS synthesize-only HTTP provider adapter using derived POST /tts
  - Sidecar admin candidate health and test-synthesis endpoints
  - Failed-audio metadata on GPT-SoVITS chat synthesis failures without Piper mid-turn fallback
affects: [phase-17-ipc-bridge, phase-17-settings-ui, phase-17-chat-failure-ui]
tech-stack:
  added: []
  patterns: [base-url-derived-provider, candidate-activation-gate, failed-audio-payload]
key-files:
  created: [sidecar/src/sidecar/tts/gpt_sovits_provider.py, sidecar/tests/tts/test_gpt_sovits_provider.py, sidecar/tests/admin/test_audio_test_tts_endpoint.py]
  modified: [sidecar/src/sidecar/admin/audio.py, sidecar/src/sidecar/tts/tts_gateway.py, sidecar/src/sidecar/tts/tts_manager.py, sidecar/src/sidecar/tts/__init__.py, sidecar/tests/test_tts_gateway.py, sidecar/tests/test_tts_manager.py]
key-decisions:
  - "GPT-SoVITS provider work stays synthesize-only; TTSTaskManager remains the sole owner of playback, ordering, renderer payloads, and RMS/lipsync."
  - "Candidate health and test synthesis operate without mutating active audio config; activation remains gated on later Electron/UI flow."
  - "GPT-SoVITS chat failures emit failed-audio metadata on the ordered audio payload rather than invoking Piper for the same turn."
patterns-established:
  - "Derive GPT-SoVITS /tts from a single base_url and validate http(s) URLs before synthesis."
  - "Admin test synthesis returns preview WAV metadata/base64 and activation_allowed instead of enqueuing chat turns."
requirements-completed: [TTS-01, TTS-02, TTS-04, TTS-06, PRESET-02, PRESET-03]
duration: 5 min
completed: 2026-05-09
---

# Phase 17 Plan 17-03: GPT-SoVITS Sidecar Provider, Health/Test Synthesis, and Failure Wiring Summary

**GPT-SoVITS sidecar synthesis adapter with candidate health/test endpoints and ordered failed-audio chat payloads.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-09T23:45:13Z
- **Completed:** 2026-05-09T23:50:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added `GptSoVitsProvider`, a synthesize-only HTTP adapter that validates one http(s) base URL, derives `POST /tts`, sends non-streaming WAV requests, decodes returned WAV bytes, and maps provider failures to typed `TTSProviderError` states.
- Added `/admin/audio/gpt-sovits/health` and `/admin/audio/test-synthesis` endpoints for candidate config checks and preview WAV synthesis without chat enqueue/history writes or active config mutation.
- Extended gateway activation gates and manager failure handling so active GPT-SoVITS requires health/test success plus preset/reference inputs, and chat synthesis failures emit `failed_audio.provider_id="gpt_sovits"` without Piper fallback in the same turn.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: GPT-SoVITS provider behavior tests** - `02bb3a0` (test)
2. **Task 1 GREEN: GPT-SoVITS HTTP provider adapter** - `5e656fd` (feat)
3. **Task 2 RED: admin/gateway/manager behavior tests** - `84af219` (test)
4. **Task 2 GREEN: admin endpoints and failed-audio wiring** - `2bd3e0d` (feat)

**Plan metadata:** pending in final docs commit.

## Files Created/Modified

- `sidecar/src/sidecar/tts/gpt_sovits_provider.py` - GPT-SoVITS HTTP `/tts` adapter with WAV decode and typed failure mapping.
- `sidecar/src/sidecar/tts/__init__.py` - Exports the GPT-SoVITS provider.
- `sidecar/src/sidecar/tts/tts_gateway.py` - Constructs GPT-SoVITS provider only when activation gates, active preset, and reference audio are present.
- `sidecar/src/sidecar/tts/tts_manager.py` - Adds failed-audio metadata to provider failure payloads while preserving sentence order and no-stream-write behavior.
- `sidecar/src/sidecar/admin/audio.py` - Adds candidate GPT-SoVITS health and test-synthesis endpoints.
- `sidecar/tests/tts/test_gpt_sovits_provider.py` - Covers base URL derivation, WAV decode, payload fields, and typed failure mapping.
- `sidecar/tests/admin/test_audio_test_tts_endpoint.py` - Covers health/test endpoint no-activation semantics and preview WAV output.
- `sidecar/tests/test_tts_gateway.py` - Covers GPT-SoVITS activation gate construction requirements.
- `sidecar/tests/test_tts_manager.py` - Covers GPT-SoVITS failed-audio payload metadata and no Piper fallback.

## Decisions Made

- Used `httpx.Client` inside the synchronous provider because the existing `TTSProvider` protocol is synchronous and `TTSTaskManager` already runs provider synthesis off the event loop with `asyncio.to_thread()`.
- Kept test synthesis as an admin preview response rather than a playback operation; later Electron/UI plans can decide how to play the returned WAV.
- Set the GPT-SoVITS provider boot sample-rate placeholder to 24 kHz so gateway stream construction has a safe initial value; actual synthesis results still report their decoded sample rate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected an over-specific RED test expectation for reference-path failures**
- **Found during:** Task 1 (Add GPT-SoVITS HTTP provider adapter)
- **Issue:** The initial HTTP 400 JSON test used a reference-audio error but expected the generic synthesis summary, conflicting with the plan's resolved reference-path failure summary requirement.
- **Fix:** Changed that case to a generic bad-language JSON error and left missing/unreadable reference paths covered by the dedicated reference-path assertion.
- **Files modified:** `sidecar/tests/tts/test_gpt_sovits_provider.py`
- **Verification:** `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py -q` passed.
- **Committed in:** `5e656fd`

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Test correction aligned RED coverage with the documented behavior; no scope expansion.

## Issues Encountered

- The system PowerShell environment has no `grep`/`rg`; acceptance for `streaming_mode.*False` was verified with a PowerShell regex count instead.
- The bare `python` command was not used for sidecar tests because project context indicates system Python is 3.13/no pytest; all sidecar tests ran through `uv run --project sidecar` using the sidecar Python 3.12 environment.

## User Setup Required

None - no external service configuration required for mocked sidecar provider/admin tests. Live GPT-SoVITS UAT still requires a user-run GPT-SoVITS server in a later verification phase.

## Known Stubs

None. Empty values in changed files are typed defaults, error payload fields, or test fixtures; no UI-rendered placeholder data was introduced.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: external-http-provider | `sidecar/src/sidecar/tts/gpt_sovits_provider.py` | Sidecar sends text/reference path/tuning to a user-configured GPT-SoVITS HTTP service; mitigated by http(s) URL validation, derived `/tts`, explicit timeouts, and typed redacted failures. |
| threat_flag: sidecar-admin-endpoint | `sidecar/src/sidecar/admin/audio.py` | New admin health/test endpoints accept candidate provider config and reference paths; mitigated by candidate-only no-mutation semantics and typed failure responses. |

## Auth Gates

None.

## Verification

- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py -q` — passed (4 tests).
- `uv run --project sidecar python -m pytest sidecar/tests/tts/test_gpt_sovits_provider.py sidecar/tests/admin/test_audio_test_tts_endpoint.py sidecar/tests/admin/test_audio_status_endpoint.py sidecar/tests/test_tts_gateway.py sidecar/tests/test_tts_manager.py -q` — passed (27 tests).
- PowerShell regex check for `streaming_mode.*False` in `sidecar/src/sidecar/tts/gpt_sovits_provider.py` — passed (`streaming_mode_false_count=1`).

## Next Phase Readiness

- Ready for `17-04`: Electron IPC/preload bridge can call candidate health/test endpoints and play/forward returned preview WAV metadata.
- Ready for later Settings/chat UI: failed-audio metadata now reaches renderer audio payloads without changing active provider mid-turn.

## Self-Check: PASSED

- Found `sidecar/src/sidecar/tts/gpt_sovits_provider.py`.
- Found `sidecar/tests/tts/test_gpt_sovits_provider.py`.
- Found `sidecar/tests/admin/test_audio_test_tts_endpoint.py`.
- Found task commits `02bb3a0`, `5e656fd`, `84af219`, and `2bd3e0d` in git log.
- Verification commands passed as listed above.

---
*Phase: 17-gpt-sovits-provider-voice-presets*
*Completed: 2026-05-09*
