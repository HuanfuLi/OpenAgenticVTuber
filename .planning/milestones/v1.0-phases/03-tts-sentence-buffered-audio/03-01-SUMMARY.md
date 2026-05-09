---
phase: 03-tts-sentence-buffered-audio
plan: 01
subsystem: sidecar-tts
tags: [piper-tts, sounddevice, git-lfs, contracts, rms-envelope, audio-payload]

# Dependency graph
requires:
  - phase: 02-conversation-pipeline
    provides: AudioPayloadMessage / DisplayTextField / ActionIntent contracts and canonical audio envelope shape
provides:
  - SpeechEnvelopePayload Python contract and TypeScript mirror for sentence_id-correlated RMS lipsync data
  - get_volume_by_chunks numpy RMS helper and synthesize_and_prepare_payload single-pass Piper helper
  - TTSGateway boot lifecycle for PiperVoice.load, synth-and-discard ORT warmup, and long-lived sounddevice OutputStream
  - Git LFS tracking and bundled en_US-amy-medium Piper ONNX voice model/config
affects: [03-02-ttstaskmanager, 04-compositor-lipsync, 05-verification]

# Tech tracking
tech-stack:
  added: [piper-tts 1.4.2, sounddevice 0.5.5, Git LFS voice model asset]
  patterns:
    - sidecar-owned playback lifecycle before READY and during shutdown
    - one synthesis pass returns WS audio payload, raw PCM bytes, sample rate, and RMS volumes
    - Git LFS guarded model loading with loud failure on missing model or pointer-file checkout

key-files:
  created:
    - packages/contracts/py/contracts/speech_envelope.py
    - packages/contracts/ts/speech-envelope.ts
    - sidecar/src/sidecar/tts/__init__.py
    - sidecar/src/sidecar/tts/audio_payload_helpers.py
    - sidecar/src/sidecar/tts/tts_gateway.py
    - sidecar/src/sidecar/tts/PROVENANCE.md
    - sidecar/tests/test_audio_payload_helpers.py
    - sidecar/tests/test_tts_gateway.py
    - sidecar/models/piper/en_US-amy-medium.onnx
    - sidecar/models/piper/en_US-amy-medium.onnx.json
    - .planning/phases/03-tts-sentence-buffered-audio/03-01-SUMMARY.md
  modified:
    - packages/contracts/py/contracts/__init__.py
    - sidecar/pyproject.toml
    - sidecar/uv.lock
    - .gitattributes

key-decisions:
  - "Pattern A trust-default-device playback worked on this machine; no WASAPI -9997 fallback was needed in 03-01."
  - "The voice model is committed through Git LFS and TTSGateway guards against pointer files at boot."
  - "Real-voice pytest paths resolve from the test file's sidecar root so tests run correctly from sidecar cwd."

patterns-established:
  - "TTSGateway Pattern A: PiperVoice.load + synth-and-discard warmup + long-lived sounddevice.OutputStream."
  - "RMS helper contract: 20ms normalized chunks, empty/silent fast paths, and SpeechEnvelopePayload sentence_id correlation."
  - "Piper model hygiene: .onnx files tracked by LFS plus runtime pointer-file detection."

requirements-completed: [TTS-01, TTS-03, TTS-04]

# Metrics
duration: 30min
completed: 2026-05-07
---

# Phase 03 Plan 01: TTS Gateway, RMS Envelope Contracts, and Piper Voice Bundle Summary

**Piper-backed sidecar TTS leaf stack with warmed TTSGateway, single-pass audio/RMS payload generation, SpeechEnvelopePayload contracts, and a Git LFS bundled en_US-amy-medium voice model.**

## Performance

- **Duration:** ~30 min including interrupted executor recovery
- **Started:** 2026-05-07T04:34:06Z
- **Completed:** 2026-05-07T04:58:00Z
- **Tasks:** 3
- **Files created:** 11
- **Files modified:** 4

## Accomplishments

- Added `SpeechEnvelopePayload` to Python contracts and a TypeScript mirror for Phase 4 lipsync consumers.
- Added `get_volume_by_chunks` and `synthesize_and_prepare_payload`, producing the audio envelope, raw PCM, sample rate, and normalized 20ms volume chunks from one Piper synthesis pass.
- Added `TTSGateway` with model loading, LFS pointer detection, ORT synth-and-discard warmup, long-lived `sounddevice.OutputStream`, and idempotent shutdown.
- Added `piper-tts==1.4.2` and `sounddevice==0.5.5` to the sidecar dependency set.
- Added `.gitattributes` LFS tracking for `sidecar/models/piper/*.onnx`.
- Bundled `sidecar/models/piper/en_US-amy-medium.onnx` and `.onnx.json`; `git lfs ls-files` reports `b3a6e47b57 * sidecar/models/piper/en_US-amy-medium.onnx`.

## Task Commits

Each task was committed atomically with `--no-verify` per wave protocol:

1. **Task 1 tests:** `663cfba` - `test(03-01): add failing tests for TTS audio helpers`
2. **Task 1 implementation:** `536c444` - `feat(03-01): add speech envelope and audio payload helpers`
3. **Task 2 gateway/deps:** `00a196d` - `feat(03-01): add TTS gateway and pinned deps`
4. **Task 3 LFS tracking:** `ace1df2` - `chore(03-01): enable Git LFS for piper voice models`
5. **Task 3 voice bundle:** `e61d5ae` - `feat(03-01): bundle en_US-amy-medium piper voice via Git LFS`
6. **Verification fix:** `7528dbb` - `test(03-01): run real-voice tests from sidecar cwd`

## Files Created/Modified

- `packages/contracts/py/contracts/speech_envelope.py` - Pydantic `SpeechEnvelopePayload` schema.
- `packages/contracts/ts/speech-envelope.ts` - TS mirror for the RMS envelope payload.
- `sidecar/src/sidecar/tts/audio_payload_helpers.py` - RMS chunking and single-pass synth payload helper.
- `sidecar/src/sidecar/tts/tts_gateway.py` - Piper/sounddevice gateway and warmup lifecycle.
- `sidecar/src/sidecar/tts/PROVENANCE.md` - OLVT source attribution and skeleton deviations.
- `sidecar/pyproject.toml` / `sidecar/uv.lock` - piper-tts and sounddevice dependency pins.
- `sidecar/tests/test_audio_payload_helpers.py` / `sidecar/tests/test_tts_gateway.py` - helper, gateway, and real-voice tests.
- `.gitattributes` - LFS filter for Piper `.onnx` models.
- `sidecar/models/piper/en_US-amy-medium.onnx` / `.onnx.json` - bundled Piper voice model and config.

## Decisions Made

- Pattern A trust-default-device playback worked on this machine: `TTSGateway.boot()` opened a stream at `sample_rate=22050` with `stream.latency=0.183s`. No Pitfall 4 fallback B/C was applied.
- Tests now resolve the voice model via `Path(__file__).resolve().parents[1] / "models" / ...` so they run from `sidecar` cwd, matching the project pytest root.
- LFS pointer detection remains runtime-enforced even though the committed working tree has the real ONNX file; clean clones that fail to pull LFS fail loud.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Real-voice tests skipped from sidecar cwd**

- **Found during:** Final 03-01 verification.
- **Issue:** Tests used `Path("sidecar/models/...")`, which is repo-root-relative. The plan runs pytest from `sidecar`, so the real-voice tests skipped even though the model existed.
- **Fix:** Resolve model paths relative to each test file's sidecar root.
- **Files modified:** `sidecar/tests/test_audio_payload_helpers.py`, `sidecar/tests/test_tts_gateway.py`
- **Verification:** `uv run pytest tests/test_audio_payload_helpers.py tests/test_tts_gateway.py -x -v` -> `13 passed`.
- **Committed in:** `7528dbb`

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** Tightened verification so bundled-model tests actually execute.

## Issues Encountered

- The initial executor did not return a completion signal and was shut down after visible progress stalled. Its valid commits were preserved; the remaining model/summary work was completed inline.
- Sandboxed Git could not create `.git/index.lock`; the model and test-fix commits were performed with approved escalation.
- Sandboxed `uv run` could not access the user uv cache; verification commands were rerun with approved escalation.

## Verification

- `git check-attr filter sidecar/models/piper/en_US-amy-medium.onnx` -> `filter: lfs`.
- `git lfs ls-files` -> `b3a6e47b57 * sidecar/models/piper/en_US-amy-medium.onnx`.
- ONNX file length: `63201294` bytes; first byte: `8`; not an LFS pointer file.
- `uv pip show piper-tts` -> version `1.4.2`.
- `uv pip show sounddevice` -> version `0.5.5`.
- Import check passed: contracts, `TTSGateway`, `get_volume_by_chunks`, and `synthesize_and_prepare_payload` import cleanly.
- Gateway smoke passed: `sample_rate=22050, stream.latency=0.183s, OK`.
- Warmup timestamps from smoke: load start `2026-05-07 00:57:26.465`; voice loaded `00:57:28.088`; ORT warmup complete `00:57:28.114`; OutputStream open `00:57:28.128`.
- Targeted tests passed: `uv run pytest tests/test_audio_payload_helpers.py tests/test_tts_gateway.py -x -v` -> `13 passed in 3.95s`.

## Next Phase Readiness

03-02 can wire `TTSGateway`, `synthesize_and_prepare_payload`, and `SpeechEnvelopePayload` into `TTSTaskManager` without inventing the leaf TTS primitives. The voice model is present locally and tracked by LFS; the gateway has already proven Pattern A playback on this machine.

## Self-Check: PASSED

Created files verified via commits and targeted tests. Commit grep for `03-01` returns all six task/fix commits. No `## Self-Check: FAILED` marker is present.

---
*Phase: 03-tts-sentence-buffered-audio*
*Completed: 2026-05-07*
