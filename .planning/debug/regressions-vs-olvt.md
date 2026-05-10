---
status: diagnosed
trigger: "Debug two reported regressions in C:\Users\16079\Code\AgenticLLMVTuber by comparing with C:\Users\16079\Code\OpenLLM_Vtuber. Symptoms: (1) GPT-SoVITS lipsync duration is now correct but lip motion is too fast/overactive; (2) conversation pipeline/LLM+TTS chunks are much slower than OLVT, with several seconds waiting before the next sentence. Diagnose likely root causes and return specific files/functions and minimal fix recommendations. Do not edit files. Desired thoroughness: medium. Include OLVT implementation references and current implementation references."
created: 2026-05-10T00:00:00-04:00
updated: 2026-05-10T00:00:00-04:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Current sidecar-side playback/lipsync diverges from OLVT by (1) driving MouthOpen directly from an uncalibrated per-sentence-normalized RMS envelope, and (2) blocking ordered audio payload delivery on local sounddevice playback completion.
test: Compare AgenticLLMVTuber TTSTaskManager/SpeechDriver/audio payload helpers with OLVT stream_audio, conversations TTSTaskManager, and conversation_utils.
expecting: Current code sends each payload then awaits stream.write for the whole sentence, whereas OLVT only queues/sends websocket payloads; current MouthOpen gain/smoothing is local and not inherited from OLVT.
next_action: Return diagnose-only root-cause report with references and minimal fix recommendations; do not edit source files.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Match OpenLLM_Vtuber behavior: GPT-SoVITS lipsync mouth motion is natural, and LLM+TTS sentence chunks stream with low inter-sentence latency.
actual: In AgenticLLMVTuber, GPT-SoVITS lipsync duration is correct but lip motion is too fast/overactive; conversation pipeline/LLM+TTS chunks are much slower than OLVT, with several seconds waiting before the next sentence.
errors: none reported
reproduction: Use GPT-SoVITS voice path and compare live conversation chunk cadence/lipsync against C:\Users\16079\Code\OpenLLM_Vtuber.
started: Regression after port/reimplementation from OLVT; exact commit unknown.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-10T00:00:00-04:00
  checked: knowledge base
  found: No .planning/debug/knowledge-base.md exists; no known-pattern match available.
  implication: Compare implementations directly and use common async/timing + data-shape bug patterns.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: current lipsync envelope and speech driver
  found: sidecar/tts/audio_payload_helpers.py normalizes every 20 ms RMS chunk to the maximum RMS of that sentence; sidecar/compositor/speech_driver.py maps that normalized RMS to MouthOpen with noise_floor=0.05, gain=0.9, max_open=0.7, attack_alpha=0.55, release_alpha=0.45 at a 60 Hz compositor tick.
  implication: Duration can be correct while movement is too busy/large because the mouth driver has no GPT-SoVITS-specific damping/compression and treats any sentence-local peak as full-scale.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: OLVT lipsync reference
  found: OpenLLM_Vtuber utils/stream_audio.py only prepares normalized RMS volumes and slice_length in the audio payload; it does not contain the AgenticLLMVTuber sidecar MouthOpen gain/smoothing policy.
  implication: The overactive mouth behavior is likely introduced in the new sidecar compositor mapping, not GPT-SoVITS synthesis duration itself.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: current TTS chunk delivery
  found: sidecar/tts/tts_manager.py _process_payload_queue sends websocket JSON, then awaits sounddevice stream.write(pcm_int16) before advancing _next_sequence_to_send to later payloads.
  implication: Each next sentence is withheld behind the previous sentence's local playback duration; this explains multi-second waits between chunks.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: OLVT conversation/TTS delivery reference
  found: OpenLLM_Vtuber conversations/tts_manager.py creates parallel TTS tasks and its _process_payload_queue only websocket_send(json.dumps(next_payload)); playback completion is handled later by frontend-playback-complete in conversation_utils.finalize_conversation_turn.
  implication: OLVT does not block next payload delivery on backend audio playback, so chunk cadence is faster.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: (1) GPT-SoVITS overactive lipsync is likely caused by AgenticLLMVTuber's new sidecar MouthOpen driver applying high-gain/fast attack-release to per-sentence-normalized 20 ms RMS values without OLVT/frontend calibration; duration alignment fix did not calibrate motion amplitude/smoothing. (2) Slow next-sentence chunks are caused by TTSTaskManager._process_payload_queue blocking ordered websocket delivery on local sounddevice stream.write for the full previous sentence, unlike OLVT which sends audio payloads as soon as synthesized and lets frontend playback completion gate only end-of-turn.
fix: diagnose-only; recommend adding lipsync damping/calibration in SpeechDriver or envelope preparation, and decoupling websocket payload delivery from sidecar PCM playback by moving stream.write to a separate playback worker/queue or making frontend playback authoritative as in OLVT.
verification: diagnose-only; no files edited
files_changed: []
