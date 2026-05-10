---
status: diagnosed
trigger: "Diagnose Phase 17 UAT Test 6 failure: after activating GPT-SoVITS, visible chat text duplicates every sentence inline, e.g. `Hello!Hello!You've said hello...You've said hello...`."
created: 2026-05-09T00:00:00-04:00
updated: 2026-05-09T00:20:00-04:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Renderer WS dispatcher subscriptions are registered at module top-level without idempotent HMR disposal, so a dev-session module re-evaluation leaves two dispatch callbacks appending each audio sentence.
test: Compare renderer subscription lifecycle against sidecar emission lifecycle and test coverage.
expecting: Renderer will have ignored unsubscribe handles for top-level subscribe calls; sidecar will show one audio payload send per sentence path.
next_action: Return concise root-cause report; no code edits per user request.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Activating GPT-SoVITS should preserve normal chat streaming, showing each assistant sentence once.
actual: Visible chat text duplicates every sentence inline after activating GPT-SoVITS, e.g. Hello!Hello!You've said hello...You've said hello...
errors: No stack trace reported; UI content duplication only.
reproduction: Phase 17 UAT Test 6: activate GPT-SoVITS and send a chat prompt; observe assistant visible chat text.
started: During Phase 17 UAT after GPT-SoVITS provider activation.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Sidecar emits both display-text and audio payload for the same sentence.
  evidence: Orchestrator emits full-text only for Thinking at orchestrator.py:160-162, and sentence text is emitted only via AudioPayloadMessage in _emit_sentence at orchestrator.py:239-269; display-text fallback is not used by this chat path.
  timestamp: 2026-05-09T00:20:00-04:00
- hypothesis: GPT-SoVITS provider duplicates LLM visible text.
  evidence: TTSTaskManager passes display_text from orchestrator into payload construction; provider.synthesize only receives TTSSynthesisRequest(text=tts_text, sentence_id=sentence_id) and returns audio/PCM used by prepare_payload_from_pcm at tts_manager.py:223-234, so GPT-SoVITS cannot change display_text.text.
  timestamp: 2026-05-09T00:20:00-04:00
- hypothesis: TTSTaskManager intentionally sends each payload twice.
  evidence: _process_payload_queue sends ws.send_json(payload.model_dump()) once in the audio branch at tts_manager.py:280 and once in the non-audio branch at tts_manager.py:300, but each payload takes exactly one branch.
  timestamp: 2026-05-09T00:20:00-04:00


## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-09T00:20:00-04:00
  checked: Phase 17 UAT failure record
  found: 17-UAT.md lines 60-64 report each assistant sentence appears exactly twice inline after active GPT-SoVITS chat turn.
  implication: Symptom matches duplicate processing of the same sentence envelope, not text generation with repeated tokens.
- timestamp: 2026-05-09T00:20:00-04:00
  checked: Renderer WS dispatcher subscription lifecycle
  found: store.ts line 51 calls subscribe(...) at module top-level and ignores the returned unsubscribe; lines 127-129 do the same for subscribeSidecarReconnect(...). No import.meta.hot dispose/idempotency guard is present in store.ts.
  implication: Vite HMR/module re-evaluation can accumulate duplicate dispatcher callbacks against the singleton client listener set.
- timestamp: 2026-05-09T00:20:00-04:00
  checked: Renderer append path
  found: store.ts lines 75-87 appends msg.display_text.text for every audio envelope; useStreamingMessages.ts lines 190-203 replace Thinking on first append and concatenate on the next append.
  implication: Two callbacks processing one audio envelope produce exactly text+text for the first sentence and append duplicate copies for later sentences.
- timestamp: 2026-05-09T00:20:00-04:00
  checked: WS client listener storage
  found: client.ts lines 23 and 38 store message listeners in a Set; subscribe adds callback and returns deletion at lines 181-185. The client module intentionally initializes on module load at lines 203-205.
  implication: The client has unsubscribe support, but store.ts does not use it for top-level registrations, so old callback identities remain live after store re-executes.
- timestamp: 2026-05-09T00:20:00-04:00
  checked: Existing regression tests
  found: ChatStreaming.test.tsx mock subscribe stores only one listener slot at lines 5-15, and current tests assert a single dispatch appends once (lines 116-127) but do not simulate duplicate store imports/HMR or multiple listeners.
  implication: Automated tests would miss the dev-session duplicate listener accumulation reported by UAT.


## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: apps/renderer/src/ws/store.ts registers WS dispatcher callbacks at module top-level and ignores the unsubscribe handles, with no HMR dispose/idempotent guard. In a Vite dev UAT session, module re-evaluation leaves stale dispatcher callbacks subscribed to the singleton WS client; each incoming audio envelope is processed twice, so appendAssistantSentence appends/replaces the same sentence twice inline.
fix: Diagnose-only; no files edited. Required fix is to make renderer WS dispatcher registration idempotent/HMR-safe and add a regression test that simulates module re-evaluation or duplicate subscriptions.
verification: Static trace only per user request; sidecar duplicate-emission alternatives ruled out by code inspection.
files_changed: []
