---
status: partial
phase: 02-conversation-pipeline
source: [02-VERIFICATION.md]
started: 2026-05-06T23:35:00Z
updated: 2026-05-06T23:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC #1 — three-sentence story streams as ONE growing bubble
expected: With LM Studio running and a configured provider, the user types "tell me a 3-sentence story" and three sentences appear sequentially in the chat panel, accumulating into ONE growing assistant bubble (not three separate bubbles). Banner stays clear; input re-enables on chain-end.
result: [pending]

### 2. SC #2 — `[joy]` strips bracket from chat AND fires `[INTENT]` log line
expected: Type "hello [joy] world" (or any prompt likely to elicit `[joy]`); chat shows "hello world" (no brackets); Logs drawer (toggled on in Settings) shows green-prefixed `[INTENT] kind=expression name=joy strength=1.0 avatar=teto` line.
result: [pending]

### 3. SC #4 — no `<think>...</think>` ever leaks into chat
expected: With LM Studio running a compliant reasoning model (latest DeepSeek-R1 distill that honors `enable_thinking:false`, or Qwen3-Reasoning), no `<think>...</think>` content appears in the main chat stream or in extracted ActionIntents during a multi-sentence reply.
result: [pending]

### 4. SC #2 with the actual Teto rig — operator action required on avatar.yaml
expected: Before SC #2 can be reliably verified end-to-end, the operator must launch VTS with the Teto rig loaded, open Settings → Expressions / Hotkeys, and replace the placeholder names in `avatars/teto/avatar.yaml` with the real rig's expression/hotkey names so the LLM emits names that match what the rig actually has.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
