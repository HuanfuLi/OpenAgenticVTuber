---
status: complete
phase: 21-code-switch-evaluation-hardening
source:
  - 21-04-PLAN.md
  - 21-05-PLAN.md
  - 21-SCORECARD.md
  - 21-VERIFICATION.md
updated: 2026-05-14
---

# Phase 21 Live UAT

Evidence unit: final submitted Chat transcript only. Do not score preview chunks,
partial captions, transient finalizing UI, or removed live-preview behavior.

## Current Status

Phase 21 is closed.

Current source of truth:

- Selected physical microphone isolation passed for PTT and VAD after 21-05.
- Recommended-provider FunASR passed mixed Chinese/English and mixed key-token final-transcript retests.
- Faster-whisper remains supported as a local fallback, but live UAT records it as limited for Chinese/English code-switching.
- Cloud STT live rows remain optional and skipped unless explicit consent and credentials are configured.

## Preconditions

- Voice input enabled with a local STT provider.
- Local model downloaded and readiness active.
- Record reusable corpus audio under `.planning/eval-audio/phase-21/` only if repeatable runner evidence is needed; raw audio remains ignored.
- Cloud STT live rows are optional and must remain skipped unless explicit consent and credentials are configured.

## Final UAT Matrix

| # | Path | Spoken category | Expected final Chat text | Actual final Chat text | Provider | Current Result | Notes |
|---|---|---|---|---|---|---|---|
| 1 | PTT | Chinese-only | 今天晚一点提醒我喝水 | matched intent | faster-whisper | Pass | CODE-01 |
| 2 | PTT | English-only with background video/headphones | Please summarize the last message | matched phrase; original run also captured background system audio | faster-whisper | Resolved by 21-05 | Historical input-source issue; selected physical microphone retest passed in rows 9-10. |
| 3 | PTT | Mixed Chinese/English | 请把 brightness 调到 fifty percent | passed pipeline; user noted very poor model quality | faster-whisper | Pass with limitation | Provider quality limitation recorded in scorecard. |
| 4 | PTT | Mixed key-token case | I need 三个 options, not two | recognized as "I need 3 options, not 2" | faster-whisper | Accepted limitation | Semantics captured, but Chinese key-token boundary was not preserved. Faster-whisper remains limited for code-switching. |
| 5 | PTT | No-translation guard | 请继续用中文回答不要翻译成英文 | remained Chinese and preserved no-translation intent | faster-whisper | Pass | CODE-03 |
| 6 | Chat recovery | STT typo recovery | Stop current turn, edit the sent user message, regenerate from that message | recovery worked via stop plus edit/regenerate | faster-whisper | Pass | Recovery remains stop + edit/regenerate. |
| 7 | Settings | Provider badges | FunASR/faster-whisper/cloud rows show concise badges only | concise badges only; no detailed scorecard/ranking/default-cloud copy | n/a | Pass | CODE-04 |
| 8 | VAD if enabled | Mixed final transcript | 帮我 check the schedule for tomorrow | recognized as "Onward check the schedule for tomorrow" | faster-whisper | Accepted limitation | Faster-whisper code-switch quality issue, not a VAD dispatch bug. FunASR retest passed in rows 11-12. |
| 9 | PTT retest | Selected physical microphone with background video/headphones | Only spoken mic input is submitted; video/system audio is not transcribed | passed; only selected mic speech submitted | selected physical mic | Pass | Retest after 21-05 microphone source isolation. |
| 10 | VAD retest | Selected physical microphone with background video/headphones | VAD does not submit video/system audio as user text | passed; no video/system audio submitted | selected physical mic | Pass | Retest after 21-05 microphone source isolation. |
| 11 | FunASR retest | Mixed Chinese/English | 请把 brightness 调到 fifty percent | preserved mixed Chinese/English phrase and key tokens | FunASR | Pass | Recommended-provider code-switch retest. |
| 12 | FunASR retest | Mixed key-token case | I need 三个 options, not two | preserved English phrase and Chinese key token | FunASR | Pass | Recommended-provider key-token retest. |

## Summary

total_rows: 12
passed: 9
resolved_historical_issues: 1
accepted_provider_limitations: 2
active_gaps: 0
pending: 0
skipped: 0
blocked: 0

## Active Gaps

None.

## Historical Gap Records

These records preserve the original UAT failures for traceability. They are not
active blockers.

### Input Source Isolation

truth: Voice input STT should transcribe only the intended microphone capture,
not unrelated background system audio.

status: resolved

Original observation: while using faster-whisper, a PTT row matched the intended
English phrase but also captured background video/system audio played through
headphones.

Root cause: `VoiceCapture` and `VadController` used generic `getUserMedia`
constraints with no persisted selected input device, so Chromium could use the
OS default input even when it was a loopback or virtual mixed source.

Resolution: 21-05 added selected microphone metadata, selected-device constraints
for PTT and VAD, no silent fallback when the selected device is unavailable, and
loopback/system-audio warnings. Live PTT and VAD retests passed in rows 9-10.

### faster-whisper Mixed Key-Token Limitation

truth: Mixed Chinese/English STT should preserve important mixed-language key
tokens when the language boundary matters.

status: accepted_provider_limitation

Original observation: faster-whisper recognized `I need 三个 options, not two` as
`I need 3 options, not 2`. Semantics were captured, but the Chinese key token was
normalized away.

Resolution: this is recorded in `21-SCORECARD.md` and provider copy. FunASR
recommended-provider retest passed the same key-token case in row 12.

### faster-whisper VAD Mixed-Language Limitation

truth: VAD final transcript should preserve mixed Chinese/English intent and not
turn Chinese words into unrelated English words.

status: accepted_provider_limitation

Original observation: faster-whisper recognized `帮我 check the schedule for
tomorrow` as `Onward check the schedule for tomorrow`.

Root cause: the VAD path uses the same final STT provider and final submission
pipeline as PTT; the issue was faster-whisper recognition quality, not VAD
dispatch behavior.

Resolution: faster-whisper remains labeled limited for code-switching. FunASR
recommended-provider retests passed the mixed-language and key-token cases in
rows 11-12.

## Closure Evidence

- `21-VERIFICATION.md` marks CODE-01 through CODE-04 complete.
- `21-VALIDATION.md` is Nyquist-compliant and maps every requirement to automated coverage.
- `21-SCORECARD.md` records faster-whisper limitations and FunASR recommended-provider pass evidence.
- `Settings.test.tsx` covers concise provider badges and microphone source warnings.
- `ChatVoiceInput.test.tsx` covers final-only mixed-language dispatch through the existing `text-input` path.
