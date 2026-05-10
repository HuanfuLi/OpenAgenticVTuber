---
status: investigating
trigger: "Diagnose two Phase 17 GPT-SoVITS regressions and compare with OpenLLM_Vtuber reference implementation under C:\\Users\\16079\\Code\\OpenLLM_Vtuber. Issues: lipsync stops earlier than actual TTS sentence only with GPT-SoVITS; GPT-SoVITS does not sound like user's pretrained model; determine if parameter/control endpoint is missing. Do not edit files."
created: 2026-05-10T00:00:00-04:00
updated: 2026-05-10T00:00:00-04:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: GPT-SoVITS lipsync ends early because playback stream sample rate is fixed at boot before actual GPT-SoVITS WAV sample rate is known; pretrained voice mismatch is caused by missing GPT/SoVITS weight path config and control endpoint calls
test: compare provider boot/synthesis, gateway stream creation, RMS envelope timing, and GPT-SoVITS API/reference weight controls
expecting: current code opens OutputStream at a default/boot-time rate and never reopens/resamples per returned sample_rate; contracts/payload omit weight paths while api_v2 exposes /set_gpt_weights and /set_sovits_weights
next_action: return concise root-cause report with file/line evidence and recommended minimal fix/tests

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: GPT-SoVITS lipsync should last for the audible synthesized sentence; GPT-SoVITS should use the user's pretrained voice model when configured.
actual: Lipsync stops before the GPT-SoVITS sentence finishes; GPT-SoVITS does not sound like the user's pretrained model. Piper lipsync is fine.
errors: none reported
reproduction: Use Phase 17 GPT-SoVITS TTS path; compare lipsync timing and model voice quality against Piper and user's pretrained GPT-SoVITS model.
started: Phase 17 regression

## Eliminated
<!-- APPEND only - prevents re-investigating -->


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-10T00:00:00-04:00
  checked: common bug patterns
  found: symptoms map to Data Shape/API Contract and Environment/Config patterns: returned audio sample rate may differ from provider config; model weights may be omitted from API/config contract.
  implication: prioritize comparing audio metadata flow and GPT-SoVITS config/control endpoints.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: current GPT-SoVITS provider and gateway
  found: GptSoVitsProvider.boot() sets sample_rate to 24000 before synthesis; TTSGateway.boot() opens one long-lived OutputStream using provider.sample_rate; synthesize() later updates provider.sample_rate from returned WAV but gateway stream is not reopened.
  implication: GPT-SoVITS audio with a returned sample rate different from 24000 is written to a stream created for the wrong rate.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: current RMS and speech-driver timing
  found: prepare_payload_from_pcm calculates volumes from returned sample_rate; SpeechDriver indexes volumes by wall-clock elapsed_ms; TTSTaskManager writes the same PCM bytes to the boot-time OutputStream without resampling.
  implication: envelope duration follows true WAV rate while playback duration follows stream rate, causing early lipsync if actual sample_rate > stream sample_rate.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: current contracts/provider payload
  found: GptSoVitsProviderConfig and GptSoVitsPresetConfig contain base URL/reference/prompt/sampling controls but no gpt_weights_path or sovits_weights_path; provider only POSTs /tts payload.
  implication: app cannot select the user's trained GPT/SoVITS weights; it depends on whatever external server loaded.
- timestamp: 2026-05-10T00:00:00-04:00
  checked: GPT-SoVITS reference API/config/log
  found: api_v2 documents and implements /set_gpt_weights and /set_sovits_weights; tts_infer.yaml custom section and api_v2.out.log show the user's intended v2Pro Teto weights are GPT_weights_v2Pro/teto_v1-e15.ckpt and SoVITS_weights_v2Pro/teto_v1_e8_s160.pth.
  implication: the missing control endpoints/parameters are exactly the mechanism needed to load the user's pretrained model.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: (1) sample-rate contract mismatch between GPT-SoVITS returned WAV and fixed boot-time OutputStream; (2) missing GPT-SoVITS weight path config/control calls for /set_gpt_weights and /set_sovits_weights.
fix: diagnose-only; recommend either resample/reopen stream per returned sample_rate and add weight path config plus endpoint calls before activation/test synthesis.
verification: diagnose-only; no files edited
files_changed: []
