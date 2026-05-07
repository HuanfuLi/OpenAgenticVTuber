---
status: partial
phase: 02-conversation-pipeline
source: [02-VERIFICATION.md]
started: 2026-05-06T23:35:00Z
updated: 2026-05-07T00:08:00Z
---

## Current Test

Test 4 (re-verify with real Teto names installed)

## Tests

### 1. SC #1 — three-sentence story streams as ONE growing bubble
expected: With LM Studio running and a configured provider, the user types "tell me a 3-sentence story" and three sentences appear sequentially in the chat panel, accumulating into ONE growing assistant bubble (not three separate bubbles). Banner stays clear; input re-enables on chain-end.
result: passed (operator confirmed live, 2026-05-07)

### 2. SC #2 — `[joy]` strips bracket from chat AND fires `[INTENT]` log line
expected: Type "hello [joy] world" (or any prompt likely to elicit `[joy]`); chat shows "hello world" (no brackets); Logs drawer (toggled on in Settings) shows green-prefixed `[INTENT] kind=expression name=joy strength=1.0 avatar=teto` line.
result: passed (operator confirmed live, 2026-05-07; verified against placeholder vocabulary; will re-verify with real Teto names in test 4)

### 3. SC #4 — no `<think>...</think>` ever leaks into chat
expected: With LM Studio running a compliant reasoning model (latest DeepSeek-R1 distill that honors `enable_thinking:false`, or Qwen3-Reasoning), no `<think>...</think>` content appears in the main chat stream or in extracted ActionIntents during a multi-sentence reply.
result: passed (operator confirmed live, 2026-05-07)

### 4. SC #2 with the actual Teto rig — operator action on avatar.yaml + re-verify [INTENT] log against real names
expected: avatar.yaml contains the Teto rig's real expression names (sourced from VTS Settings → Expressions panel) and a live conversation triggers an `[INTENT]` log line whose name matches one of the rig's actual expressions (e.g., `[INTENT] kind=expression name=Blush ...`).
result: operator action complete in commit ffff011 (Blush, chibi, Cry, Dark Eye, Dark Face, Dizzy, Exp eye, Love, Star Eye, Sweat, 【SV】Baguette, 【SV】Mic, 【Utau】Mic, SV Utau ALT — Remove Water Mark excluded). Awaiting live re-verification.

## Summary

total: 4
passed: 3
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
