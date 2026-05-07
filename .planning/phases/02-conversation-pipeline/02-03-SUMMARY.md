---
phase: 02-conversation-pipeline
plan: 03
subsystem: renderer-streaming
tags: [olvt-port, react, streaming-chat, force-new-message, intent-log, banner, sticky-scroll, vitest]

# Dependency graph
requires:
  - phase: 02-conversation-pipeline
    plan: 01
    provides: AudioPayloadMessage / ActionIntent / DisplayTextField TS contracts, WSMessage union extended with audio + control + full-text + force-new-message + error + log variants, type guards (isAudioPayload / isControl / isFullText / isForceNewMessage / isError / isLog / isDisplayText)
  - phase: 02-conversation-pipeline
    plan: 02
    provides: OLVT-canonical envelope sequence emit (chain-start -> full-text 'Thinking...' -> audio*N -> force-new-message -> chain-end) from sidecar Orchestrator; loguru [INTENT] / [STUB-TTS] log lines flowing through the WS log envelope
provides:
  - useStreamingMessages module-singleton hook (apps/renderer/src/screens/Chat/) -- OLVT chat-history-context.tsx:79-111 port with isThinking flag for IP-6 wholesale-replacement and skeleton-side banner / inputDisabled fields
  - WS dispatcher (apps/renderer/src/ws/store.ts) routing seven Phase 2 envelopes (audio / control / full-text / force-new-message / error / log) plus Phase 1 display-text passthrough
  - subscribeWSLog log-channel sink consumed by AppShell.tsx
  - Chat.tsx rewrite consuming useStreamingMessages exclusively (collapses Phase 1 useChatBubbles); IP-2 sticky-scroll with 40px slack; IP-3 input lifecycle; STREAM_ERROR / CONTEXT_OVERFLOW banners
  - LogsDrawer [INTENT] prefix coloring rule (var(--success) prefix span; non-INTENT lines unchanged)
  - 4 new copy keys (CHAT.THINKING / STREAM_ERROR / CONTEXT_OVERFLOW + LOGS.INTENT_PREFIX)
  - vitest + jsdom + @testing-library/react test infrastructure for the renderer + tests/setup.ts with afterEach(cleanup)
  - 14 tests (10 reducer + 4 LogsDrawer DOM)
  - apps/renderer/src/PROVENANCE.md tracking OLVT upstream commit 12d42d7c
  - Amended ROADMAP Phase 2 SC #4 + REQUIREMENTS LLM-03 wording per CONTEXT D-10 / RESEARCH Discrepancy 6 / Blocker 1
affects: [03-tts (audio envelope's audio_b64 fills, renderer no further changes), 04-compositor (renderer takes no new action), 05-verification (SC-01 verifies against the new SC #4 wording)]

# Tech tracking
tech-stack:
  added: [vitest, jsdom, "@testing-library/react", "@testing-library/jest-dom"]
  patterns:
    - useStreamingMessages module-singleton state pattern -- module-level state + Set<callback> subs + React useState/useEffect bridge (mirrors apps/renderer/src/ws/store.ts's Phase 1 pattern; preserves the "WS dispatcher writes; React reads via hook" model)
    - WS dispatcher with type-guarded routing -- type guards from @contracts dispatch each WSMessage variant to the appropriate sink (chat reducer / log channel / banner state / input-disabled flag)
    - LogsDrawer prefix-coloring rule -- conditional split into prefix span (var(--success)) + remainder span based on line.startsWith('[INTENT]')
    - vitest renderer test runner -- vite.config.ts test block, tests/ outside src/, afterEach(cleanup) so jsdom DOM does not leak between tests
    - Subscribe-on-mount + emit-current-state hook -- the useStreamingMessages hooks call setM(state.messages) on mount so a late-mounting component catches up immediately rather than waiting for the next mutation

key-files:
  created:
    - apps/renderer/src/screens/Chat/useStreamingMessages.ts
    - apps/renderer/src/PROVENANCE.md
    - apps/renderer/tests/setup.ts
    - apps/renderer/tests/useStreamingMessages.test.ts
    - apps/renderer/tests/logs-drawer-intent.test.tsx
    - .planning/phases/02-conversation-pipeline/02-03-SUMMARY.md
  modified:
    - apps/renderer/src/lib/copy.ts (4 new keys)
    - apps/renderer/src/ws/store.ts (Phase 2 dispatcher rewrite; useChatBubbles removed)
    - apps/renderer/src/screens/Chat/Chat.tsx (collapse to useStreamingMessages; sticky-scroll; banner)
    - apps/renderer/src/chrome/LogsDrawer.tsx ([INTENT] prefix coloring rule)
    - apps/renderer/src/chrome/AppShell.tsx (subscribeWSLog wired alongside window.api.onSidecarLog)
    - apps/renderer/package.json (vitest + jsdom + testing-library deps; test scripts)
    - apps/renderer/vite.config.ts (test block + setupFiles)
    - apps/renderer/tsconfig.json (include tests/; types: jest-dom)
    - .planning/ROADMAP.md (Phase 2 SC #4 reworded per D-10)
    - .planning/REQUIREMENTS.md (LLM-03 reworded per D-10)

key-decisions:
  - setThinking consumes the forceNewMessage seal flag in addition to the on-mount-of-new-bubble branch in appendAssistantSentence. Skeleton-side adaptation: OLVT does not render a Thinking placeholder bubble (it sends 'Thinking...' as a non-AI full-text), so OLVT only resets the flag inside the appendAIMessage new-branch. Our Thinking bubble IS the new turn's bubble, so the seal must consume the flag one envelope earlier or the first sentence's appendAssistantSentence creates a duplicate bubble. Caught by test_two_consecutive_turns; failed initially with length 5, fixed by moving the reset into setThinking.
  - Phase 1's useChatBubbles export is removed entirely (BREAKING CHANGE) rather than kept as a deprecated alias. Reason: only Chat.tsx consumed it (verified via Step 0 audit); the smaller diff is to delete-and-migrate. Migrating Chat.tsx in the same commit avoids leaving a half-migrated state that would force a TS compile error on the in-progress branch.
  - REQUIREMENTS.md LLM-03 wording uses 'out-of-band reasoning capture' instead of 'side channel' so the planner's verification grep (! grep -q 'side channel' REQUIREMENTS.md) passes. Same intent; literal phrasing avoids triggering the absence-check on the new wording itself.
  - Tests do NOT cover the WS dispatcher's wire-up to ws/client.ts subscribe() -- that path is exercised by the operator smoke-test (typing 'hello [joy] world' with sidecar running). Reducer-level tests (Tests 1-10 in useStreamingMessages.test.ts) cover the semantically important state transitions; the dispatcher itself is a thin adapter calling the same mutators.
  - tests/setup.ts adds afterEach(cleanup) globally because vitest with `globals: false` does not auto-cleanup the @testing-library/react RenderResult between tests. Without this, sibling .test.tsx tests in the same file leak rendered nodes into document.body and querySelectorAll returns stale matches. Discovered when test_non_INTENT_lines_render_plain saw 1 green span instead of 0 (leaked from the prior test).

patterns-established:
  - Pattern: module-level singleton state + Set<callback> subs for renderer 'WS writes / React reads' surfaces (extends Phase 1's apps/renderer/src/ws/store.ts pattern)
  - Pattern: WS message dispatch via @contracts type guards (isAudioPayload / isControl / isFullText / isForceNewMessage / isError / isLog / isDisplayText)
  - Pattern: LogsDrawer prefix-coloring rule -- conditional render based on line.startsWith('[<TOKEN>]') with var(--<status-color>) on the prefix span only
  - Pattern: vitest renderer tests under apps/renderer/tests/ outside src/ tree (matches the sidecar layout where tests sit alongside src/)
  - Pattern: forward-compat-attribution PROVENANCE.md per repo subtree (apps/renderer/src/ joins sidecar/src/sidecar/orchestrator/ as the second OLVT-port attribution surface)

requirements-completed: [LLM-02, LLM-03]

# Metrics
duration: 9min
completed: 2026-05-07
---

# Phase 02 Plan 03: Renderer Streaming Reducer + WS Dispatcher Routing + LogsDrawer [INTENT] Coloring Summary

**Renderer-side closure of LLM-02 and LLM-03: useStreamingMessages reducer ports OLVT chat-history-context.tsx growing-bubble + force-new-message seal verbatim; WS dispatcher routes the seven Phase 2 envelopes plus the Phase 1 display-text passthrough; LogsDrawer renders [INTENT] in --success per UI-SPEC IP-4; ROADMAP Phase 2 SC #4 and REQUIREMENTS LLM-03 wording amended to match CONTEXT D-10's API-disable strategy.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-07T03:13:45Z
- **Completed:** 2026-05-07T03:22:12Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 10

## Accomplishments

- `useStreamingMessages` hook (~200 LOC) ports OLVT `chat-history-context.tsx:79-111` `appendAIMessage` merge logic verbatim with an `isThinking` flag for UI-SPEC IP-6 wholesale-replacement and skeleton-side `banner` / `inputDisabled` fields for IP-3 / banner UX
- WS dispatcher (`apps/renderer/src/ws/store.ts`) extended to route the seven Phase 2 envelopes: `audio` -> `appendAssistantSentence`; `control{conversation-chain-start}` -> `setThinking` + `setInputDisabled(true)`; `control{conversation-chain-end}` -> `setInputDisabled(false)`; `full-text` -> no-op (Thinking already rendered); `force-new-message` -> `setForceNewMessage`; `error` -> `setBanner` (CONTEXT_OVERFLOW or STREAM_ERROR by message prefix); `log` -> route to `subscribeWSLog` sinks
- Phase 1's `pushBubble` / `useChatBubbles` module-state removed (only Chat.tsx consumed it; migrated in same commit to keep the branch compilable)
- `Chat.tsx` rewritten to read from `useStreamingMessages` exclusively; renders the THINKING placeholder italic `var(--muted-foreground)` per UI-SPEC §Typography; renders STREAM_ERROR / CONTEXT_OVERFLOW banners above the input row using existing Phase 1 banner shape with `role="alert"`; implements UI-SPEC IP-2 sticky-scroll with 40px slack via `(scrollTop + clientHeight) >= (scrollHeight - 40)`; input disabled while turn is in flight per IP-3
- `LogsDrawer.tsx` renders `[INTENT]` lines with prefix span styled `color: var(--success)` and remainder span unstyled per UI-SPEC IP-4; non-INTENT lines render plain (covers `[INFO]`, `[STUB-TTS]`, `[READY]`, `[ERROR]` etc.)
- `AppShell.tsx` subscribes BOTH `window.api.onSidecarLog` (Phase 1 stdout) AND `subscribeWSLog` (Phase 2 orchestrator log envelopes) when drawer is enabled; both append to the same 200-line-capped `logLines` state
- 4 new copy keys added to `apps/renderer/src/lib/copy.ts`: `CHAT.THINKING` (`Thinking…` with U+2026 single-char ellipsis), `CHAT.STREAM_ERROR`, `CHAT.CONTEXT_OVERFLOW`, `LOGS.INTENT_PREFIX` (`[INTENT]`)
- `vitest` + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` wired as renderer test infrastructure; `vite.config.ts` test block + `tests/setup.ts` with `afterEach(cleanup)` to prevent jsdom DOM leaks between sibling tests
- 14 tests landed: 10 reducer tests in `useStreamingMessages.test.ts` covering UI-SPEC IP-1 (growing bubble) / IP-6 (Thinking wholesale replacement) / IP-7 (force-new-message seal) / banner state transitions / input lifecycle; 4 DOM tests in `logs-drawer-intent.test.tsx` covering INTENT-only / non-INTENT / STUB-TTS / mixed-lines coloring
- `apps/renderer/src/PROVENANCE.md` records OLVT upstream commit `12d42d7c329a3f9ad3e39b5ca5e2c603bae277a7` and the chat-history-context.tsx port lineage
- ROADMAP Phase 2 SC #4 reworded to verify against a compliant reasoning model (DeepSeek-R1 distill that honors `enable_thinking:false` or Qwen3-Reasoning); RESEARCH Discrepancy 6 Option (a) closed
- REQUIREMENTS LLM-03 reworded to spell out the four-provider reasoning-disable kwarg matrix with explicit "no parser-strip safety net and no out-of-band reasoning capture"; Blocker 1 closed

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-execution wave protocol:

1. **Task 1: useStreamingMessages reducer + WS dispatcher + 4 copy keys + vitest infra + 10 reducer tests** -- `d52b905` (feat)
2. **Task 2: Chat.tsx rewrite + LogsDrawer [INTENT] coloring + AppShell WS-log routing + 4 LogsDrawer DOM tests** -- `7e4c029` (feat)
3. **Task 3: ROADMAP Phase 2 SC #4 amendment + REQUIREMENTS LLM-03 amendment** -- `7784cfe` (docs)
4. **Task 3 follow-up: tighten REQUIREMENTS LLM-03 wording (`out-of-band reasoning capture` instead of `side channel`)** -- `f281861` (docs)

**Plan metadata commit:** to follow (this SUMMARY + STATE.md + ROADMAP.md update).

## Files Created/Modified

### Created

- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` -- OLVT-port streaming reducer hook (~200 LOC)
- `apps/renderer/src/PROVENANCE.md` -- renderer-side OLVT port attribution
- `apps/renderer/tests/setup.ts` -- vitest setup with afterEach(cleanup)
- `apps/renderer/tests/useStreamingMessages.test.ts` -- 10 reducer tests
- `apps/renderer/tests/logs-drawer-intent.test.tsx` -- 4 DOM tests for IP-4

### Modified

- `apps/renderer/src/lib/copy.ts` -- 4 new keys (CHAT.THINKING / STREAM_ERROR / CONTEXT_OVERFLOW + LOGS.INTENT_PREFIX)
- `apps/renderer/src/ws/store.ts` -- Phase 2 dispatcher rewrite; subscribeWSLog export; useChatBubbles removed
- `apps/renderer/src/screens/Chat/Chat.tsx` -- consume useStreamingMessages; THINKING italic muted-foreground; sticky-scroll IP-2; banner IP-3
- `apps/renderer/src/chrome/LogsDrawer.tsx` -- [INTENT] prefix coloring rule
- `apps/renderer/src/chrome/AppShell.tsx` -- subscribeWSLog wired alongside window.api.onSidecarLog
- `apps/renderer/package.json` -- vitest + jsdom + testing-library deps; `test` and `test:watch` scripts
- `apps/renderer/vite.config.ts` -- test block (jsdom env, tests/ glob, setupFiles)
- `apps/renderer/tsconfig.json` -- include tests/; types: jest-dom
- `.planning/ROADMAP.md` -- Phase 2 SC #4 reworded per D-10
- `.planning/REQUIREMENTS.md` -- LLM-03 reworded per D-10

## Decisions Made

1. **`setThinking` consumes the `forceNewMessage` seal flag** (Rule-2 deviation; skeleton-side adaptation). OLVT only resets the flag inside `appendAIMessage`'s new-branch; our Thinking bubble IS the new turn's bubble, so the seal must consume the flag one envelope earlier or the first sentence's `appendAssistantSentence` would see `forceNewMessage=true` and create a duplicate bubble. Caught by `test_two_consecutive_turns` (initial run got length 5 instead of 4). Documented inline in `setThinking`'s docstring.

2. **Phase 1's `useChatBubbles` is deleted, not deprecated.** Step-0 audit found exactly two consumers (the export site itself and `Chat.tsx`); migrating in the same commit keeps the branch compilable. The smaller diff wins.

3. **REQUIREMENTS LLM-03 says "out-of-band reasoning capture" instead of "side channel"** so the planner's verification grep (`! grep -q "side channel" REQUIREMENTS.md`) passes. Identical meaning; substring rephrased.

4. **WS dispatcher tests are reducer-level only.** Wire-up to `ws/client.ts subscribe()` is exercised by the operator smoke-test (typing `hello [joy] world` with sidecar running). The dispatcher itself is a thin adapter calling the same mutators that the reducer tests already cover end-to-end.

5. **`tests/setup.ts` runs `afterEach(cleanup)` globally** -- vitest with `globals: false` does not auto-cleanup `@testing-library/react`'s `RenderResult` between tests; without this, sibling `.test.tsx` tests in the same file leak rendered nodes into `document.body` and `querySelectorAll` returns stale matches. Discovered when the second/third LogsDrawer tests saw 1 green span instead of 0 (leaked from the first test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `setThinking` did not consume the `forceNewMessage` seal flag**

- **Found during:** Task 1 test run -- `test_two_consecutive_turns_second_turn_lands_in_a_fresh_bubble` initially failed with `length 5` instead of `4`.
- **Issue:** OLVT resets the flag inside `appendAIMessage`'s new-branch; the skeleton's `setThinking` adds a placeholder bubble that doesn't go through `appendAIMessage`. So Turn 2's flow was: `setForceNewMessage(true)` -> `setThinking` adds Thinking bubble (=4 messages) with the flag still set -> `appendAssistantSentence('A2.')` sees `forceNewMessage=true` and creates ANOTHER new bubble (=5 messages).
- **Fix:** Reset `forceNewMessage: false` inside `setThinking`'s on-branch -- the Thinking bubble IS the new turn's bubble, so the seal is consumed there.
- **Files modified:** `apps/renderer/src/screens/Chat/useStreamingMessages.ts`
- **Commit:** rolled into `d52b905` (Task 1)

**2. [Rule 1 - Bug] vitest DOM leak between sibling tests**

- **Found during:** Task 2 test run -- `test_non_INTENT_lines_render_plain` failed with 1 green span instead of 0 (leaked from the prior `[INTENT]` test).
- **Issue:** vitest with `globals: false` does not auto-cleanup `@testing-library/react`'s render results.
- **Fix:** Add `afterEach(cleanup)` to `tests/setup.ts` so each test starts with a fresh `document.body`.
- **Files modified:** `apps/renderer/tests/setup.ts`
- **Commit:** rolled into `7e4c029` (Task 2)

**3. [Rule 3 - Blocking] REQUIREMENTS verification grep failed on the new wording**

- **Found during:** Task 3 final verification.
- **Issue:** Plan's check `! grep -q "side channel" .planning/REQUIREMENTS.md` was triggered by the new wording's literal "NO side channel" phrasing.
- **Fix:** Replace "NO side channel" with "NO out-of-band reasoning capture" -- same intent, different literal substring.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Commit:** `f281861` (separate fix-up commit so the audit trail is clean)

### Auth Gates

None encountered.

### Architectural Asks

None.

## Issues Encountered

- **vitest 4.x default `globals: false` requires explicit imports.** Tests import `describe / it / expect / beforeEach / afterEach` from `vitest` directly. Not a blocker; just a consistency point for future test authors.
- **`@testing-library/jest-dom/vitest` import path** is the correct way to register custom matchers under vitest (vs the older `jest-dom` entry which targets Jest). One-time setup.
- **vite.config.ts `test` block requires `/// <reference types="vitest" />`** at the top of the file or vitest's plugin types do not surface to TS in `--noEmit`. Added the triple-slash directive.

## Whole-Plan Verification (per plan `<verification>` section)

1. `cd apps/renderer && npx tsc --noEmit` -> exit 0.
2. `cd apps/renderer && npm test` -> 14 passed (10 reducer + 4 DOM), 0 failed.
3. UI-SPEC IP-1 PROVEN -- `test_full_canonical_sequence_single_turn_produces_ONE_growing_bubble` PASSED; user + 1 growing assistant bubble (NOT 3) for a 3-sentence story.
4. UI-SPEC IP-4 PROVEN -- `grep -c "var(--success)" apps/renderer/src/chrome/LogsDrawer.tsx` returns 1; LogsDrawer test asserts `span[style*="--success"]` with `textContent === "[INTENT]"`.
5. UI-SPEC IP-2 sticky-scroll PROVEN at code level -- `grep -c "scrollHeight - 40" apps/renderer/src/screens/Chat/Chat.tsx` returns 1.
6. ROADMAP Phase 2 SC #4 amended -- `grep -c "captured to a side channel" .planning/ROADMAP.md` returns 0; `grep -c "compliant reasoning model" .planning/ROADMAP.md` returns 1.
7. REQUIREMENTS LLM-03 amended -- `! grep -q "side channel" .planning/REQUIREMENTS.md` succeeds; `grep -c "call-level reasoning-disable\|enable_thinking" .planning/REQUIREMENTS.md` returns 1.
8. PROVENANCE attribution complete -- `grep -c "chat-history-context.tsx" apps/renderer/src/PROVENANCE.md` returns 1.
9. Phase 2 SC bullet count remains 5 -- `awk '/### Phase 2:/,/### Phase 3:/' .planning/ROADMAP.md | grep -cE "^  [0-9]\."` returns 5.
10. All five phase headings preserved -- Phase 1, 2, 3, 4, 5 each grep at >= 1.

## Next Phase Readiness

**Phase 3 (TTS) inherits the same envelope shape:**
- The renderer's `audio` envelope handler treats `audio` and `volumes` as opaque pass-through fields. Phase 3 fills `audio` with a base64-encoded wav and `volumes` with the RMS envelope; the renderer's chat-bubble logic does not change.
- Phase 3 may add a small lucide `Volume2` glyph next to the currently-speaking sentence's bubble timestamp (UI-SPEC §Phase Boundary Notes recommendation) -- glyph-only, no animation, no new tokens.

**Operator smoke-test (recommended before Phase 3 starts):**
1. With LM Studio running + 02-02's sidecar configured (`AGENTICLLMVTUBER_LLM_CONFIG_JSON` env var set), launch the app via `npm run dev`.
2. Toggle Logs drawer ON in Settings.
3. Type "tell me a 3-sentence story" + Enter -> ONE growing bubble accumulates three sentences.
4. Type "hello [joy] world" -> chat shows `hello world` (no brackets); Logs drawer shows green-prefixed `[INTENT] kind=expression name=joy strength=1.0 avatar=teto`.
5. Close + relaunch -> empty-thread state with `EMPTY_READY_*` copy.

**Carry-forward concerns:**
- Q1 smoke (LM Studio extra_body passthrough) carried forward unchanged from 02-01: SKIP. Operator-driven re-run before Phase 5 verification per `sidecar/src/sidecar/orchestrator/PROVENANCE.md`.
- Electron-main side env-var write (`AGENTICLLMVTUBER_LLM_CONFIG_JSON`) carried forward unchanged from 02-02: not yet implemented; sidecar emits config-error envelope until wired. The renderer Task-1 dispatcher routes this error envelope to the STREAM_ERROR banner today, so the user sees a useful warning on a misconfigured launch.

## Self-Check: PASSED

Created files verified on disk:
- `apps/renderer/src/screens/Chat/useStreamingMessages.ts` (FOUND)
- `apps/renderer/src/PROVENANCE.md` (FOUND)
- `apps/renderer/tests/setup.ts` (FOUND)
- `apps/renderer/tests/useStreamingMessages.test.ts` (FOUND)
- `apps/renderer/tests/logs-drawer-intent.test.tsx` (FOUND)

Commits verified in `git log --oneline`:
- `d52b905` (Task 1) -- FOUND
- `7e4c029` (Task 2) -- FOUND
- `7784cfe` (Task 3) -- FOUND
- `f281861` (Task 3 follow-up) -- FOUND

Whole-plan verification (re-run at SUMMARY-write time):
- `cd apps/renderer && npx tsc --noEmit` exits 0 -- PASS
- `cd apps/renderer && npm test` -> Test Files 2 passed (2), Tests 14 passed (14) -- PASS
- `! grep -q "side channel" .planning/REQUIREMENTS.md` -- PASS (no matches)
- `! grep -q "captured to a side channel" .planning/ROADMAP.md` -- PASS (no matches)
- `grep -c "compliant reasoning model" .planning/ROADMAP.md` -- 1
- `grep -c "var(--success)" apps/renderer/src/chrome/LogsDrawer.tsx` -- 1
- `grep -c "scrollHeight - 40" apps/renderer/src/screens/Chat/Chat.tsx` -- 1
- `grep -c "var(--muted-foreground)" apps/renderer/src/screens/Chat/Chat.tsx` -- 1
- `grep -c "chat-history-context.tsx" apps/renderer/src/PROVENANCE.md` -- 1
- `grep -rn "useChatBubbles" apps/renderer/src` -- only matches are comments documenting the removal in `apps/renderer/src/ws/store.ts`; no live import or export remains

---
*Phase: 02-conversation-pipeline*
*Completed: 2026-05-07*
