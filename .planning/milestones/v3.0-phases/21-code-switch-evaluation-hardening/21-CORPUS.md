---
phase: 21
status: locked
corpus_version: 2026-05-13-final-transcript-v1
audio_root: .planning/eval-audio/phase-21/
---

# Phase 21 Final Transcript Corpus

This corpus evaluates final submitted STT transcripts only. It is not a preview,
chunk, partial, or live-caption corpus, and it must not reintroduce preview STT
behavior removed before Phase 21.

## Local Recording Rules

- Record local audio under `.planning/eval-audio/phase-21/`.
- Do not commit raw audio. The directory is ignored by `.gitignore`.
- Checked-in artifacts may reference only a local filename token and optional
  SHA-256 hash. Do not include absolute paths.
- Use natural speech, one utterance per file, without private names, accounts,
  secrets, addresses, or project/avatar/provider names.
- Score only the final transcript that would be submitted to Chat.

## Case Schema

Each case has:

- `case_id`: Stable id.
- `expected_text`: Text the speaker intended.
- `language_mix`: `zh`, `en`, or `mixed`.
- `semantic_intent`: Short generic intent used by manual review.
- `key_tokens`: Tokens that must be retained for this case to pass.
- `no_translation`: Language boundary that must not be collapsed or translated.
- `audio_file`: Optional local filename under `.planning/eval-audio/phase-21/`.
- `audio_sha256`: Optional SHA-256 for the local recording.

## Locked Cases

| case_id | expected_text | language_mix | semantic_intent | key_tokens | no_translation | audio_file | audio_sha256 |
|---|---|---|---|---|---|---|---|
| cs-001 | 今天晚一点提醒我喝水 | zh | reminder to drink water later | 今天,提醒,喝水 | keep Chinese | cs-001.wav | |
| cs-002 | 帮我把音量调低一点 | zh | lower volume request | 音量,调低 | keep Chinese | cs-002.wav | |
| cs-003 | 这个回答太长了请简短一点 | zh | ask for shorter answer | 回答,简短 | keep Chinese | cs-003.wav | |
| cs-004 | 等一下我想换个话题 | zh | change topic soon | 等一下,换个话题 | keep Chinese | cs-004.wav | |
| cs-005 | Please summarize the last message | en | summarize prior message | summarize,last,message | keep English | cs-005.wav | |
| cs-006 | Set a quiet timer for ten minutes | en | set ten minute timer | quiet,timer,ten,minutes | keep English | cs-006.wav | |
| cs-007 | I want a shorter answer next time | en | request shorter next answer | shorter,answer,next,time | keep English | cs-007.wav | |
| cs-008 | Can you repeat that in a calmer tone | en | repeat calmly | repeat,calmer,tone | keep English | cs-008.wav | |
| cs-009 | 帮我 check the schedule for tomorrow | mixed | check tomorrow schedule | 帮我,check,schedule,tomorrow | keep Chinese and English | cs-009.wav | |
| cs-010 | 我想 save this idea for later | mixed | save idea for later | 我想,save,idea,later | keep Chinese and English | cs-010.wav | |
| cs-011 | 请把 brightness 调到 fifty percent | mixed | set brightness to half | brightness,fifty,percent | keep Chinese and English | cs-011.wav | |
| cs-012 | 等一下 open the settings page | mixed | open settings later | 等一下,open,settings,page | keep Chinese and English | cs-012.wav | |
| cs-013 | 这个 response sounds too formal | mixed | response too formal | response,sounds,formal | keep Chinese and English | cs-013.wav | |
| cs-014 | Please 用中文 explain the main point | mixed | explain main point in Chinese | Please,中文,explain,main,point | keep Chinese and English | cs-014.wav | |
| cs-015 | 把 next step 说慢一点 | mixed | say next step slower | next,step,慢一点 | keep Chinese and English | cs-015.wav | |
| cs-016 | I need 三个 options, not two | mixed | request three options | need,三个,options,two | keep Chinese and English | cs-016.wav | |
| cs-017 | 今天的 plan include lunch at noon | mixed | plan includes lunch | 今天,plan,lunch,noon | keep Chinese and English | cs-017.wav | |
| cs-018 | Can you 把重点 mark as urgent | mixed | mark key point urgent | Can,重点,mark,urgent | keep Chinese and English | cs-018.wav | |
| cs-019 | 明天 morning remind me to stretch | mixed | morning stretch reminder | 明天,morning,remind,stretch | keep Chinese and English | cs-019.wav | |
| cs-020 | Switch to English after this sentence | en | language switch request | Switch,English,sentence | keep English | cs-020.wav | |
| cs-021 | 请继续用中文回答不要翻译成英文 | zh | continue Chinese no English translation | 继续,中文,不要翻译,英文 | keep Chinese | cs-021.wav | |
| cs-022 | Use simple words but keep the keyword latency | en | simple wording with keyword | simple,words,keyword,latency | keep English | cs-022.wav | |
| cs-023 | 这个 latency 有点 high | mixed | latency is high | latency,high | keep Chinese and English | cs-023.wav | |
| cs-024 | 请把 final answer 改短一点 | mixed | shorten final answer | final,answer,改短 | keep Chinese and English | cs-024.wav | |

