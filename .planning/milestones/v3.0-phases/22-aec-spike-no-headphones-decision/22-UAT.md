# Phase 22 UAT: No-Headphones / AEC Decision

## Status

Live UAT complete.

Current shipped policy: **Unsafe by default until each user verifies their setup; Limited for the tested setup after UAT.**

## Scope

This UAT decides whether the shipped app can truthfully claim no-headphones use as Ready, Limited, or Unsafe. Browser AEC diagnostics are supporting metadata only; they do not prove readiness by themselves.

## Evidence Rules

- Do not commit raw microphone audio, TTS audio, or transcript-like private samples as normal evidence.
- Record metadata, pass/fail results, and user-observed behavior.
- Cloud STT rows are skipped unless explicit cloud consent and credentials are already available.

## Environment Metadata

| Field | Value |
|---|---|
| Date | 2026-05-14 |
| OS | Windows, user machine |
| App build/run mode | Live local app UAT |
| Selected microphone label | Pending |
| Confirmed physical mic, not loopback/system audio | Pending |
| Headphones | No-headphones test requires headphones off |
| Speaker/output volume | Pending |
| Room noise | Pending |
| STT provider | FunASR, faster-whisper, OpenAI cloud |
| STT readiness | Passed tested provider paths |
| VAD sensitivity | Pending |
| VAD silence timeout | Pending |
| No-headphones status before test | Unsafe |
| Latest AEC diagnostic source | Pending |
| Requested echo cancellation | Pending |
| Applied echo cancellation | Pending |
| Applied noise suppression | Pending |

## Test Matrix

| ID | Test | Expected | Observed | Result | Diagnostic Reference | Notes |
|---|---|---|---|---|---|---|
| UAT-01 | Select a physical microphone, not loopback/system audio | Settings does not warn about loopback/system audio | Physical microphone selected; no loopback/system-audio warning reported. | Pass | AEC snapshot | User reported pass. |
| UAT-02 | Capture AEC diagnostics through PTT | Metadata snapshot appears; no raw audio retained | After fix, Settings showed: "Last capture AEC: Push to talk; echo on; noise suppression on." | Pass | `aecDiagnostics.source=ptt` | Initial visibility issue fixed and retested. |
| UAT-03 | Capture AEC diagnostics through VAD | Metadata snapshot appears; no raw audio retained | After fixes, VAD could be selected through Input mode and AEC diagnostics appeared for Voice activity. | Pass | `aecDiagnostics.source=vad` | Initial duplicate-control and locked-select issues fixed and retested. |
| UAT-04 | PTT while Teto is idle and speakers are on | User speech submits once as user text | User speech submitted once as user text with speakers on and Teto idle. | Pass | Chat transcript | User reported pass. |
| UAT-05 | VAD while Teto is idle and speakers are on | VAD detects user speech only after explicit opt-in/status/override | VAD detected user speech while Teto was idle and submitted once. | Pass | VAD meter/state | User reported pass. |
| UAT-06 | Teto speaks with no user speech | Assistant speech is not submitted as user text | After fixes, Teto speech did not submit as user text; VAD disappeared/stopped during Teto speech as intentional safety behavior. | Pass | Chat transcript / VAD meter / audio route | Initial VAD monitoring and output-routing issues fixed and retested. |
| UAT-07 | Teto speaks while VAD is enabled | VAD suspends/hides monitoring and does not submit assistant speech | VAD remained suspended during Teto speech; no assistant speech was submitted as user text. | Pass | VAD state / chat transcript | Updated expectation to match intentional active-TTS safety behavior. |
| UAT-08 | PTT during active TTS | PTT follows queue/safety rules; no assistant self-submit | PTT during active TTS followed safety rules without assistant self-submit or duplicate prior messages. | Pass | Chat order | |
| UAT-09 | Stop during thinking/streaming/TTS | Stop cancels active output and unlocks edit | Stop canceled active output and returned the UI to an editable/ready state. | Pass | Chat/Stop UI | |
| UAT-10 | Edit/regenerate after normal voice turn | Edited user text truncates later messages and regenerates | Edited normal voice turn truncated later messages and regenerated from the edited text in the same chat position. | Pass | Chat order | |
| UAT-11 | Edit/regenerate after stopped voice turn | Stopped message stays anchored and regenerates from edited text | Edited stopped voice turn stayed anchored and regenerated correctly from the edited text. | Pass | Chat order | |
| UAT-12 | FunASR local path | No assistant self-speech submit; SenseVoice metadata tokens stripped; metadata-only no-speech output ignored | FunASR retest passed after metadata cleanup; normal speech submitted clean text and metadata-only output did not trigger a user message. | Pass | Provider label / chat transcript | Added provider cleanup and renderer final-result guard. |
| UAT-13 | faster-whisper local path | No assistant self-speech submit; note quality/latency | faster-whisper local path passed; user speech recognized and assistant speech was not submitted as user text. | Pass | Provider label | |
| UAT-14 | Cloud STT path | Run only with consent and credentials; otherwise skip | OpenAI cloud STT retest passed after cloud defaults, file-upload, and diagnostic fixes. | Pass | Provider label / Settings diagnostic | OpenAI defaults to `gpt-4o-transcribe`; Groq defaults to `whisper-large-v3-turbo`. |
| UAT-15 | Settings no-headphones status/override | Unsafe blocks VAD; Ready/Limited or override allows deliberate VAD opt-in | Settings no-headphones controls behaved correctly: Unsafe blocked VAD, Ready/Limited or unsafe override allowed deliberate VAD opt-in, and PTT remained available. | Pass | Settings | |

## Verdict Rules

- **Ready**: repeated no-headphones tests pass across idle, active TTS, VAD, PTT, and selected STT provider without assistant self-submit.
- **Limited**: mostly usable but requires caveats such as lower volume, PTT preference, specific provider, or occasional false positives.
- **Unsafe**: no-headphones behavior is unreliable, confusing, or likely to submit assistant/background audio as user speech.

## Current Verdict

**Limited for the tested setup.**

Reason: live no-headphones UAT passed across PTT, VAD, active TTS, Stop/edit recovery, FunASR, faster-whisper, OpenAI cloud STT, and Settings no-headphones policy. The app should still default to Unsafe for unverified hardware because browser AEC and speaker/mic behavior are device-dependent.

## Limitations

- Browser AEC support and applied settings vary by device/browser runtime.
- System-audio/loopback inputs are explicitly unsafe for this feature.
- VAD paused during Teto speech is expected safety behavior, not a defect.
- Faster-whisper code-switch quality remains limited from Phase 21 evidence.
