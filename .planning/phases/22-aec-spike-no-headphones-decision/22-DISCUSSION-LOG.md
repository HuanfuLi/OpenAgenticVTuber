# Phase 22: AEC Spike + No-Headphones Decision - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-10T02:03:27.0123488-04:00
**Phase:** 22-AEC Spike + No-Headphones Decision
**Areas discussed:** Pass/Fail Evidence Threshold, TTS Self-Speech Guard, User-Facing Status Surface, VAD Defaults After AEC Results, Test Artifact Expectations

---

## Pass/Fail Evidence Threshold

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Evidence required for supported status | Strict repeatable | Supported only after repeated tests pass across TTS-active, VAD, and STT paths with no self-submit. | yes |
| Evidence required for supported status | Single-device okay | Supported if it works reliably on the user's current setup, with device-specific caveats. | |
| Evidence required for supported status | Always experimental | Never call no-headphones fully supported in v3.0, even if tests pass. | |

**User's choice:** Strict repeatable.
**Notes:** Ready status needs repeated empirical evidence, not a loose single-path pass.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Classification when tests are not clean | Experimental on minor issues | Mostly works with edge cases, label no-headphones experimental and keep conservative VAD defaults. | yes |
| Classification when tests are not clean | Fallback-only on any issue | Any self-submit, repeated false trigger, or unreliable suppression means use headphones/PTT fallback. | |
| Classification when tests are not clean | Tiered by mode | PTT no-headphones can be supported/experimental separately from VAD no-headphones. | |

**User's choice:** Experimental on minor issues.
**Notes:** Minor problems should become Limited rather than immediately Unsafe.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| What forces fallback-only | Any self-submit | If assistant speech is ever auto-submitted as user input during active TTS, no-headphones becomes fallback-only. | |
| What forces fallback-only | Repeated self-submit only | A single self-submit can be treated as experimental if not reproducible. | |
| What forces fallback-only | User judgment | Keep the app experimental unless the user manually decides it is unusable. | yes |

**User's choice:** User judgment.
**Notes:** Fallback-only is an explicit UAT verdict, not a single automatic rule.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| How to record judgment | Explicit UAT verdict | Record supported/experimental/fallback-only with notes explaining why. | yes |
| How to record judgment | Automatic status only | Derive status entirely from test outcomes. | |
| How to record judgment | No persisted verdict | Keep evidence in planning docs only; ship conservative copy. | |

**User's choice:** Explicit UAT verdict.
**Notes:** CONTEXT maps these labels to Ready, Limited, and Unsafe for Settings copy.

---

## TTS Self-Speech Guard

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| VAD during avatar speech | Block auto-submit while speaking | VAD may monitor state, but must not auto-submit during active TTS. | |
| VAD during avatar speech | Pause microphone capture | Stop or pause capture entirely during TTS, then resume after speech ends. | |
| VAD during avatar speech | Allow capture, discard matching transcripts | Let STT run but discard transcripts that appear to be assistant speech. | yes |

**User's choice:** Allow capture, discard matching transcripts.
**Notes:** The guard should be content-aware instead of simply muting capture.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Discard aggressiveness | Conservative discard | Discard during active TTS when transcript meaning overlaps assistant output, even if this may drop some real user speech. | yes |
| Discard aggressiveness | Exact-match only | Discard only when transcript text closely matches recent assistant text. | |
| Discard aggressiveness | Never semantic-match | Do not compare transcript content; only use timing/audio gates. | |

**User's choice:** Conservative discard.
**Notes:** Preventing self-submit is more important than preserving every overlap utterance.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| User talks over TTS | Ignored with visible hint | Speech during active TTS is not submitted; show hint to use PTT after TTS or stop playback. | |
| User talks over TTS | Queued after TTS | Keep it and submit after TTS if it does not look like assistant speech. | |
| User talks over TTS | Submitted immediately | Submit if it passes the self-speech discard check, even during TTS. | yes |

**User's choice:** Submitted immediately.
**Notes:** This permits overlap speech without adding barge-in cancellation.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Provider scope | All STT providers | Apply before final transcript enters Chat, regardless of provider. | yes |
| Provider scope | VAD only | Apply only to VAD auto-submit; PTT bypasses the guard. | |
| Provider scope | Cloud stricter | Apply stricter discard to cloud STT because latency complicates attribution. | |

**User's choice:** All STT providers.
**Notes:** The guard is provider-independent and sits before final Chat submission.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| User visibility for discarded transcripts | Transient status only | Show a short ignored-assistant-speech style status, but do not keep the transcript. | |
| User visibility for discarded transcripts | Developer logs only | Suppress in UI and record redacted diagnostics only. | yes |
| User visibility for discarded transcripts | Preview then discard | Let the user see it in preview, then remove it when discarded. | |

**User's choice:** Developer logs only.
**Notes:** Avoid showing assistant-like discarded text to the user.

---

## User-Facing Status Surface

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Status location | Settings and Chat | Canonical status in Settings and compact status/warning near Chat voice controls. | |
| Status location | Settings only | Keep detailed status in Settings; Chat only disables unsafe controls. | yes |
| Status location | Chat only | Put status where voice is used, with Settings containing only configuration. | |

**User's choice:** Settings only.
**Notes:** Chat should avoid unsafe claims and only gate controls when needed.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Status labels | Supported / Experimental / Use headphones | Simple user-facing labels aligned with the roadmap. | |
| Status labels | Ready / Limited / Unsafe | More direct wording. | yes |
| Status labels | Pass / Warn / Fail | Test-result style labels rather than product-support language. | |

**User's choice:** Ready / Limited / Unsafe.
**Notes:** Use direct product-state language in Settings.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Recommendation for Limited/Unsafe | PTT + headphones | Recommend headphones and PTT as the reliable baseline. | yes |
| Recommendation for Limited/Unsafe | PTT only | Recommend push-to-talk, mention headphones only when Unsafe. | |
| Recommendation for Limited/Unsafe | Headphones only | Focus guidance on audio setup rather than input mode. | |

**User's choice:** PTT + headphones.
**Notes:** Limited and Unsafe both point back to the reliable baseline.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Unsafe override | Allow explicit override | Let user override with warning copy, but keep defaults conservative. | yes |
| Unsafe override | Block VAD no-headphones | Disable VAD unless headphones/PTT fallback is used. | |
| Unsafe override | No override UI | Keep status/defaults conservative without special override. | |

**User's choice:** Allow explicit override.
**Notes:** The user can knowingly choose risk, but defaults remain safe.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Status detail level | Concise status + link/details | Direct status and short recommendation, with details/diagnostics separately. | yes |
| Status detail level | Full test notes inline | Show device, test cases, and verdict notes directly in Settings. | |
| Status detail level | Status only | Show only the label with no explanation. | |

**User's choice:** Concise status + link/details.
**Notes:** Full UAT notes are not inline Settings copy.

---

## VAD Defaults After AEC Results

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| VAD after Ready | Still opt-in | VAD remains explicit opt-in; Ready removes scary warning copy. | yes |
| VAD after Ready | Recommend VAD | VAD remains off, but Settings recommends trying it without headphones. | |
| VAD after Ready | Auto-enable VAD | Turn on VAD by default once AEC is Ready. | |

**User's choice:** Still opt-in.
**Notes:** Ready never turns the product into always-listening by default.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Sensitivity and timeout defaults | No default loosen | Keep conservative defaults regardless of AEC status. | |
| Sensitivity and timeout defaults | Loosen on Ready | Use less conservative defaults when AEC is Ready. | |
| Sensitivity and timeout defaults | User profile based | Keep defaults conservative, but remember user tuning after successful use. | yes |

**User's choice:** User profile based.
**Notes:** Initial defaults stay conservative, but successful tuning can persist.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Limited behavior | VAD off by default + warning | VAD stays off, Settings warns headphones/PTT are safer. | yes |
| Limited behavior | VAD off, no extra warning | Status label is enough. | |
| Limited behavior | VAD allowed normally | Treat Limited as acceptable if the user opted in. | |

**User's choice:** VAD off by default + warning.
**Notes:** Limited still needs caution.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Unsafe behavior | Require explicit override | VAD remains off and needs explicit override in no-headphones mode. | yes |
| Unsafe behavior | Disable VAD entirely | VAD cannot be enabled until status improves. | |
| Unsafe behavior | Allow but warn | VAD can be enabled normally while Settings shows Unsafe. | |

**User's choice:** Require explicit override.
**Notes:** Unsafe remains overrideable, but not casually enabled.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| PTT behavior | PTT always available | PTT remains available whenever STT is ready; AEC only affects no-headphones/VAD guidance. | yes |
| PTT behavior | PTT warned too | Show no-headphones warnings for PTT when status is Limited/Unsafe. | |
| PTT behavior | PTT gated by status | Disable PTT no-headphones when status is Unsafe. | |

**User's choice:** PTT always available.
**Notes:** AEC status must not block baseline PTT if STT is ready.

---

## Test Artifact Expectations

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Saved evidence | Structured UAT doc | Save test matrix, environment/device notes, results, verdict, and limitations. | yes |
| Saved evidence | App-generated diagnostics | Save a machine-readable diagnostics/report artifact from the app. | |
| Saved evidence | Minimal notes | Keep a short manual note and rely on implementation tests. | |

**User's choice:** Structured UAT doc.
**Notes:** The decision needs a human-readable evidence record.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Raw audio retention | Never retain raw audio | Record only metadata/results/verdicts unless user explicitly exports something outside normal flow. | yes |
| Raw audio retention | Allow local retained samples | Keep local audio samples under an ignored folder for debugging. | |
| Raw audio retention | Retain only failed cases | Save audio only when a test fails, still local-only. | |

**User's choice:** Never retain raw audio.
**Notes:** Phase 22 normal evidence excludes raw microphone and TTS recordings.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Environment details | Practical setup notes | OS, mic/speaker/headphone state, output volume, room noise, STT provider, VAD settings, and AEC constraints. | yes |
| Environment details | Very detailed hardware profile | Include exact device model IDs, driver versions, sample rates, and full audio graph. | |
| Environment details | Minimal environment | Only record OS and whether headphones were used. | |

**User's choice:** Practical setup notes.
**Notes:** Enough detail to interpret the result without overbuilding hardware inventory.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Test flow surface | Manual UAT first | Manual steps and app diagnostics; no dedicated in-app wizard needed. | yes |
| Test flow surface | Settings test flow | Add a Settings action that walks through an AEC/no-headphones test. | |
| Test flow surface | Developer-only script | Keep it outside the app as a test script/tool. | |

**User's choice:** Manual UAT first.
**Notes:** A dedicated wizard is not needed for this phase.

| Question | Option | Description | Selected |
|----------|--------|-------------|----------|
| Verdict to app status | Configured default from UAT | Ship status/copy based on the Phase 22 UAT verdict, not runtime auto-decision. | yes |
| Verdict to app status | Automatic runtime decision | App continuously decides Ready/Limited/Unsafe from live behavior. | |
| Verdict to app status | Manual user setting | User chooses no-headphones status in Settings. | |

**User's choice:** Configured default from UAT.
**Notes:** Phase 22 produces a recorded verdict that determines the shipped status.

---

## the agent's Discretion

- Exact diagnostics schema and redaction fields.
- Exact Settings layout and copy details consistent with `Ready`, `Limited`, and `Unsafe`.
- Exact UAT matrix format, provided it captures the required environment, results, verdict, and limitations.
- Exact implementation of assistant-output overlap checks, provided it is conservative during active TTS.

## Deferred Ideas

None - discussion stayed within phase scope.
