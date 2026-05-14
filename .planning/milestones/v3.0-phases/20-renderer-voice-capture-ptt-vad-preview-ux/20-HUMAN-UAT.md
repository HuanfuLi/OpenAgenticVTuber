---
status: complete
phase: 20-renderer-voice-capture-ptt-vad-preview-ux
source: [20-VERIFICATION.md, 20-UAT.md]
started: 2026-05-11T05:50:00Z
updated: 2026-05-13T02:00:30-04:00
---

# Phase 20 Human UAT

## Current Test

[testing complete]

## Tests

### 1. Live Microphone PTT Capture

expected: Holding PTT records, shows preview outside chat history, finalizes, and submits one normal user turn.
result: pass
reported: "Failed: Start app and warning appeared \"Voice input readiness unavailable: sidecar request failed.\""
severity: blocker
fix:
  implemented_by: inline, 20-07, 20-09, 20-10
  status: fixed_verified
  retest: "covered by Test 4 startup readiness recovery and Test 9 long PTT final submission"

### 2. Live Microphone VAD Auto-Submit

expected: Opt-in VAD shows a live level meter/status, detects normal speech or shows the level below threshold, records on speech, finalizes after configured silence, and submits only final text.
result: pass
retest_of: "Fail: VAD did not recognize my speaking. Also, I have no idea who is going on with it, so it's hard to debug. No logs available, no any indicators."

### 3. Live Active-Turn Playback Queue

expected: While Teto is speaking, VAD shows paused and does not auto-capture. If push-to-talk captures speech during the active turn, the final transcript queues until the current turn/playback clears and does not interrupt audio.
result: pass
retest_of: "Back to test #3, I found regression: I asked a question via VAD and then asked second question via PTT. Queuing worked, but positioned wrong and have duplication. The actual queue of the conversation was: first question, first question, first answer, and first answer. There is nothing for second QA! And there are duplicated first question and answer! The correct sequence should be: first question, first answer, (now dequeue to message array and send it) second question, and second answer."
fix:
  implemented_by: 20-09
  status: fixed_verified
  retest: passed

### 4. Live Readiness Recovery After Startup

expected: A startup `Sidecar is not ready.` state clears after sidecar-ready/reconnect, and PTT enables once STT readiness and microphone permission are valid.
result: pass

### 5. Live STT Test Save Refreshes Chat

expected: A successful Settings STT test followed by Save refreshes Chat readiness and clears stale `Voice input is disabled in Voice settings.` text.
result: pass

### 6. Live Truthful Model Cache And VAD Copy

expected: STT model cache no longer reports instant fake download; VAD copy is clearly browser volume/silence detection with no downloadable model.
result: pass

### 7. Live Model Removal Blocks Chat Readiness

expected: Removing or deleting the selected local STT model after a passing Settings test blocks Chat PTT before recording starts.
result: pass
reported: "Clicking \"Remove model\" triggered a Save settings? This is weird. Also, the STT local model cache card disappeared so user cannot re-download after removed model. User have to navigate to other pages and return to Voice input to see the STT local model cache card again and try to download the model again"
severity: major
fix:
  implemented_by: 20-10
  status: fixed_verified
  retest: passed

### 8. Live Custom Cache Root Consistency

expected: STT model catalog, download, remove, readiness, and provider loading all refer to the same configured cache root.
result: pass

### 9. Live Multi-Chunk Preview Robustness

expected: Holding PTT long enough for multiple preview chunks does not prevent final transcript submission if preview is delayed or absent.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Holding PTT records, shows preview outside chat history, finalizes, and submits one normal user turn."
  status: fixed_verified
  reason: "User reported: Failed: Start app and warning appeared \"Voice input readiness unavailable: sidecar request failed.\""
  severity: blocker
  test: 1
  root_cause: "Electron `voiceInput:getReadiness` returns a `sidecar_unavailable` fallback summary when the sidecar admin request fetch throws. The renderer suppresses this fallback from `voice.error`, but `VoiceInputControl` still renders `voice.readiness.summary` for every non-ready state, so transient startup sidecar request failures still appear as a visible warning."
  artifacts:
    - path: "apps/electron-main/src/ipc.ts"
      issue: "`voiceInput:getReadiness` fetch-failure fallback summary is surfaced as readiness summary."
    - path: "apps/renderer/src/screens/Chat/VoiceInputControl.tsx"
      issue: "Blocked text falls back to `voice.readiness.summary` even for recoverable `sidecar_unavailable` startup states."
    - path: "apps/renderer/src/state/voice-input-store.ts"
      issue: "Store knows `sidecar_unavailable` is recoverable for `error`, but does not expose a user-safe display summary for Chat."
  missing:
    - "FIXED inline: `VoiceInputControl` now suppresses visible blocked text for recoverable `sidecar_unavailable` readiness while retaining disabled PTT until sidecar-ready/reconnect refreshes readiness."
    - "FIXED inline: Chat regression covers the exact `Voice input readiness unavailable: sidecar request failed.` startup text and verifies it is hidden while later sidecar-ready enables PTT."
    - "FIXED inline: `VoiceInputControl` now retries recoverable `sidecar_unavailable` readiness after startup even when no sidecar-ready event arrives."
    - "FIXED inline: Electron voice readiness fallbacks no longer emit the alarming `Voice input readiness unavailable: sidecar request failed.` text for recoverable sidecar-unavailable startup states."
    - "FIXED inline: recoverable `sidecar_unavailable` readiness now retries continuously instead of only once."
    - "FIXED inline: HTTP failures from `/admin/audio/voice-input/readiness` are now visible `unexpected_failure` readiness errors instead of being mislabeled as sidecar unavailable."
    - "FIXED inline: Voice settings now has an explicit `Enable voice input` switch, and saving an enabled default-visible provider persists `active_provider: funasr` instead of leaving voice disabled."
    - "FIXED inline: Settings STT test requests now use an enabled provider config so a passing test plus save can unblock Chat readiness."
    - "FIXED inline: The `Enable voice input` switch now persists immediately, hydrates from stored config, and refreshes Chat voice readiness after save."
    - "FIXED inline: App-store LLM config writes now preserve persisted audio/plugin/preset settings instead of rebuilding config with default audio."
    - "LIVE PASSED: startup readiness recovery passed in Test 4 and long PTT final transcript submission passed in Test 9."
  debug_session: "inline verify-work 2026-05-11"

- truth: "Phase 19 STT model/cache behavior and Phase 20 live voice capture readiness stay synchronized."
  status: fixed_automated
  reason: "Phase 20 plan 20-07 added cache-root-aware model operations, local model presence re-checks in voice readiness, Settings copy updates for real explicit download, and accumulated-chunk preview encoding."
  severity: blocker
  test: 7
  artifacts:
    - path: "sidecar/src/sidecar/admin/audio.py"
      issue: "Voice readiness now blocks with missing_model when active local readiness outlives model files."
    - path: "packages/contracts/py/contracts/audio_provider.py"
      issue: "STT model operation requests carry cache_root only, not full STT config or credentials."
    - path: "apps/renderer/src/audio/voice-capture.ts"
      issue: "Preview encoding now uses accumulated chunks and preview failures are non-fatal to final submission."
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "Model download/remove passes cache_root and refreshes Chat readiness."
  missing:
    - "LIVE PASSED: model catalog, download, remove, readiness, and provider loading use the same configured cache root in the packaged app."
    - "LIVE PASSED: Chat PTT blocks after removing a previously tested local model."
    - "LIVE PASSED: long PTT captures still produce final transcript when preview is delayed or absent."

- truth: "Opt-in VAD listens, records on speech, finalizes after configured silence, and submits only final text."
  status: fixed_verified
  reason: "User reported: Fail: VAD did not recognize my speaking. Also, I have no idea who is going on with it, so it's hard to debug. No logs available, no any indicators."
  severity: blocker
  test: 2
  root_cause: "The renderer VAD is a black-box RMS threshold gate: default opt-in sensitivity uses a high threshold (`low` = 0.12), Chat only exposes `VAD listening` without live mic level/threshold/speech-detected state, and no diagnostic/log path tells the user whether VAD is monitoring, seeing low audio, blocked by active playback, or failing to start capture. Settings also exposes STT `input_mode = vad` separately from the renderer-local VAD switch that Chat actually consumes, which can make VAD enablement hard to reason about."
  resolution: "20-08 added VAD level/threshold/speech-detected diagnostics, a live Chat meter/status, lower opt-in thresholds, active-turn blocked feedback, and Settings input-mode/VAD enablement synchronization. Live retest passed on 2026-05-13."
  artifacts:
    - path: "apps/renderer/src/audio/vad-controller.ts"
      issue: "Only compares RMS to fixed thresholds and exposes monitoring/error callbacks; no level, threshold, speech-detected, or ignored-reason diagnostics."
    - path: "apps/renderer/src/screens/Chat/VoiceInputControl.tsx"
      issue: "Displays only coarse labels such as `VAD listening`; no live level meter, speech/silence indicator, threshold, or VAD debug state."
    - path: "apps/renderer/src/screens/Settings/VoiceInputSection.tsx"
      issue: "VAD settings expose sensitivity values but no calibration feedback or indication that normal speech should cross the threshold."
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "STT `input_mode` can be set to `vad` independently from the renderer-local VAD enable switch used by Chat."
  missing:
    - "FIXED automated: `VadController` now emits level, threshold, sensitivity, speech-detected, monitoring, recording, and ignored-reason diagnostics."
    - "FIXED automated: Chat shows a compact live VAD meter/status while VAD is enabled and ready."
    - "FIXED automated: Chat distinguishes starting, quiet/below threshold, voice detected, recording, finalizing, and active-turn paused states."
    - "FIXED automated: VAD thresholds were recalibrated lower for normal near-field speech while retaining explicit opt-in defaults."
    - "FIXED automated: Settings synchronizes STT `input_mode = vad` with the renderer-local VAD enablement setting."
    - "FIXED automated: regression coverage covers level below threshold, speech detected, active-turn blocked, and Settings VAD enablement synchronization."
    - "LIVE PASSED: normal speech crosses the visible VAD threshold, starts recording, finalizes after silence, and submits one final transcript."
  debug_session: "inline verify-work 2026-05-13"

- truth: "While Teto is speaking, VAD shows paused and does not auto-capture. If push-to-talk captures speech during the active turn, the final transcript queues until the current turn/playback clears and does not interrupt audio."
  status: fixed_verified
  reason: "User reported: Back to test #3, I found regression: I asked a question via VAD and then asked second question via PTT. Queuing worked, but positioned wrong and have duplication. The actual queue of the conversation was: first question, first question, first answer, and first answer. There is nothing for second QA! And there are duplicated first question and answer! The correct sequence should be: first question, first answer, (now dequeue to message array and send it) second question, and second answer."
  severity: blocker
  test: 3
  root_cause: "Queued voice dispatch races with first-turn persistence on `conversation-chain-end`. `ws/store.ts` sets `inputDisabled=false` immediately after starting async `commitConversationTurnFromDispatcher`, so `Chat.tsx` promotes the queued final candidate before the first turn is committed and before streaming cleanup runs. The queued dispatch calls `appendUserMessage`, overwriting the module-level `pendingTurn` with the second question. When the first commit promise resolves, `markCompletedTurnConsumed()` consumes the current pending turn instead of the completed first-turn identity, leaving the first streaming user/assistant messages duplicated beside the persisted first turn and dropping the second queued user turn."
  resolution: "20-09 made completed-turn cleanup identity-aware and added a turn-settling guard so queued voice dispatch waits for prior turn persistence/cleanup. Live retest passed on 2026-05-13."
  artifacts:
    - path: "apps/renderer/src/ws/store.ts"
      issue: "`conversation-chain-end` clears input-disabled state before async conversation persistence and streaming cleanup have completed."
    - path: "apps/renderer/src/screens/Chat/Chat.tsx"
      issue: "Queued voice final candidates promote as soon as `inputDisabled` and `isSpeaking` are false, even if the just-finished turn is still settling into conversation history."
    - path: "apps/renderer/src/screens/Chat/useStreamingMessages.ts"
      issue: "`markCompletedTurnConsumed()` consumes whichever `pendingTurn` is current at promise resolution time rather than the completed turn captured at chain-end."
    - path: "apps/renderer/tests/ChatVoiceInput.test.tsx"
      issue: "The active-turn queue regression test does not model delayed commit/history refresh, so it misses duplicate first-turn rows and dropped queued text."
  missing:
    - "FIXED automated: completed-turn candidates carry the originating user message id."
    - "FIXED automated: completed-turn cleanup removes only the matching completed turn and leaves newer pending turns intact."
    - "FIXED automated: queued voice dispatch is blocked while the previous turn is settling after chain-end."
    - "FIXED automated: regression coverage verifies queued voice stays pending during settlement and dispatches only after cleanup."
    - "LIVE PASSED: the live sequence becomes first question, first answer, second question, second answer with no duplicated first turn and no dropped queued turn."
  debug_session: "inline verify-work 2026-05-13"

- truth: "Removing or deleting the selected local STT model after a passing Settings test blocks Chat PTT before recording starts."
  status: fixed_verified
  reason: "User reported: Clicking \"Remove model\" triggered a Save settings? This is weird. Also, the STT local model cache card disappeared so user cannot re-download after removed model. User have to navigate to other pages and return to Voice input to see the STT local model cache card again and try to download the model again"
  severity: major
  test: 7
  root_cause: "Settings model removal currently reuses `persistVoiceInput(invalidatedConfig)`, the same path as the primary Save settings button. That path sets the generic save status text and runs full voice-input save side effects, so a cache operation looks like a manual Save. The model-cache card is also rendered only when `selectedModel` exists; if the refreshed catalog is transiently empty/stale after removal, or does not contain the active provider entry until the user remounts the Voice input panel, the whole card and re-download controls disappear instead of showing a not-downloaded model entry."
  resolution: "20-10 added cache-operation persistence options for removal, kept the selected local provider model cache card visible with a not-downloaded fallback entry, and added regression coverage for no generic Save settings copy plus immediate Download availability."
  artifacts:
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "`removeSelectedModel()` calls `persistVoiceInput()` after invalidating readiness, surfacing Save settings status/copy and full save side effects."
    - path: "apps/renderer/src/screens/Settings/Settings.tsx"
      issue: "The STT local model cache card is guarded by `selectedModel && (...)`, so any missing refreshed entry hides Download/Remove controls entirely."
    - path: "apps/renderer/tests/Settings.test.tsx"
      issue: "The removal regression only asserts persisted missing-model invalidation; it does not assert that cache removal uses distinct status copy or that the model cache card remains visible with Download available after removal."
  missing:
    - "FIXED automated: model removal persists invalidated readiness without primary Save settings success copy or Save button state."
    - "FIXED automated: model removal still persists `missing_model` readiness and refreshes Chat readiness."
    - "FIXED automated: a local-provider model cache card remains visible after removal as not downloaded with Download available."
    - "FIXED automated: Settings regression covers empty refreshed catalog after removal, no generic Save settings copy, visible cache card, enabled Download, disabled Remove, and missing-model readiness persistence."
    - "LIVE PASSED: packaged app Remove model shows model-cache-specific status, keeps the card visible, and Chat PTT blocks until model setup is restored."
  debug_session: "inline verify-work 2026-05-13"
