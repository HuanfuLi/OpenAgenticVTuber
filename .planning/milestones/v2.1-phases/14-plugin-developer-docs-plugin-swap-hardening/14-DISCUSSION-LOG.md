# Phase 14: Plugin Developer Docs + Plugin Swap Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-09T09:07:40.5767650-04:00
**Phase:** 14-plugin-developer-docs-plugin-swap-hardening
**Areas discussed:** Docs structure, AI motion-plugin playbook, stable plugin contract, examples, plugin swap behavior, plugin health visibility, testing and UAT

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| All areas | Covers docs, contract boundary, restart behavior, and invalid-plugin status before writing context. | yes |
| Docs first | Focus on human/AI developer docs and examples; defer swap/status details. | |
| Swap/status first | Focus on plugin selection, restart behavior, invalid manifests, and fallback visibility. | |

**User's choice:** All areas.
**Notes:** User wanted both developer documentation and plugin swap system gap fixes included before audit.

---

## Docs Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Separate focused docs | Landing page, human author guide, AI-agent brief/playbook, system integration guide, and default plugin example. | yes |
| One long plugin guide | Everything in a single document. | |
| Hybrid | Main guide plus short reference appendices. | |

**User's choice:** Separate focused docs.
**Notes:** Human guide depth selected as build-a-plugin tutorial plus reference.

---

## Human Author Guide Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Build-a-plugin tutorial plus reference | Minimal working plugin first, then manifest fields, hooks, `ParamFrame`, testing, troubleshooting. | yes |
| Reference-first | API and manifest schema precisely, with small examples. | |
| Concept-first | Architecture and mental model first, then default plugin source. | |

**User's choice:** Build-a-plugin tutorial plus reference.
**Notes:** User added that a coding-agent skill/playbook should help agents adapt algorithms to the system.

---

## AI Motion-Plugin Playbook

| Option | Description | Selected |
|--------|-------------|----------|
| Actual project-local Codex skill | Create a `.codex/skills/.../SKILL.md` wrapper for Codex. | initial |
| AI-agent brief only | Write docs only, no executable skill. | |
| Tool-neutral core plus thin adapters | Canonical Markdown playbook usable by Codex, Claude, and Gemini; optional Codex wrapper points to it. | yes |

**User's choice:** Tool-neutral core plus thin adapters.
**Notes:** User clarified the aid should not be Codex-only. It should be generally usable by Claude and Gemini as well.

---

## Stable Plugin Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stable API | Only manifest, `BodyMotionPlugin`, `ParamFrame`, `RigCapabilities`, `AvatarOverrides`, and test commands are stable. | partial |
| Broad source-level contract | Allow selected loader/compositor/default-plugin helpers as author APIs. | |
| Minimal core plus small helper kit | Stable core API plus new author-facing helpers for parsing, ramps, frame safety, writable filtering, and tests. | yes |

**User's choice:** Minimal core API plus small plugin-author helper kit.
**Notes:** User asked whether helpers exist. Answer: internal helpers exist, but not a clean author helper layer. User agreed to add a small stable helper kit.

---

## Helper Stability

| Option | Description | Selected |
|--------|-------------|----------|
| Stable within plugin API v1 | Once documented, helper signatures remain compatible until plugin API v2. | yes |
| Experimental helpers | Convenience utilities may change. | |
| Mixed | Parser/frame helpers stable; test/adaptation helpers experimental. | |

**User's choice:** Stable within plugin API v1.
**Notes:** The helper kit is part of the supported v1 plugin author contract once documented.

---

## Example Plugin

| Option | Description | Selected |
|--------|-------------|----------|
| Add minimal sample plugin | Tiny runnable plugin with one or two action codes, separate from the default plugin. | yes |
| Default plugin only | Use `plugins/default` as the only worked example. | |
| Docs-only snippets | Include snippets but no checked-in runnable sample. | |

**User's choice:** Add minimal sample plugin.
**Notes:** The sample should be contract-focused and less complex than the real default plugin.

---

## Plugin Swap Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-restart sidecar after selection | Selection applies immediately through existing restart path; Settings shows progress/result. | yes |
| Save selection plus restart-required | Safer, but requires user action. | |
| Ask each time | Confirmation before restart. | |

**User's choice:** Auto-restart sidecar after selection.
**Notes:** Plugin setting is boot-time, so selection must restart to actually apply.

---

## Load Failure Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep selected plugin, run NullPlugin, show error | Preserves developer intent and makes failure visible. | yes |
| Revert to previous working plugin | Smoother but hides failure. | |
| Fall back to default plugin | Simple but obscures selected-plugin failure. | |

**User's choice:** Keep selected plugin, run `NullPlugin`, show error.
**Notes:** Failure should remain visible until the user fixes or changes the plugin.

---

## Invalid Plugin Listing

| Option | Description | Selected |
|--------|-------------|----------|
| Show invalid entries with error state | Developers can see found-but-malformed plugins and manifest errors. | yes |
| Hide invalid entries | Cleaner but confusing. | |
| Block whole plugin list on any invalid manifest | Loud but one bad plugin breaks all selection. | |

**User's choice:** Show invalid entries with error state.
**Notes:** Invalid plugins are developer feedback, not something to hide.

---

## Invalid Plugin Selectability

| Option | Description | Selected |
|--------|-------------|----------|
| Not selectable | Visible diagnosis but cannot be chosen until fixed. | initial |
| Selectable but warned | Developer can test failure handling and iterate. | yes |
| Selectable only in dev mode | Flexible but mode-dependent. | |

**User's choice:** Selectable but warned.
**Notes:** User first chose not selectable, then changed the decision to selectable but warned. The later decision wins.

---

## Plugin Health Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Settings plugin section plus Status popover | Detailed Settings state plus compact live status. | yes |
| Settings only | Simpler but easy to miss. | |
| Logs only plus Settings error | Minimal, mostly developer-oriented. | |

**User's choice:** Settings plugin section plus Status popover.
**Notes:** Normal chat should show compact degraded state without forcing the user into Settings.

---

## Health State Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Lifecycle states | `active`, `restart pending`, `load failed`, `fallback/null`, `circuit open`, `invalid manifest`, `unknown/loading`. | yes |
| Simple states | `ok`, `warning`, `error`. | |
| Developer detail states | Lifecycle states plus queue/backpressure and last-frame metrics. | |

**User's choice:** Lifecycle states.
**Notes:** Detailed queue/backpressure telemetry is not required for Phase 14.

---

## Failure Detail Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Actionable summary plus expandable details | Short message by default, developer details on expansion. | yes |
| Full error inline | Fast for developers but noisy. | |
| Short message only | Clean but insufficient for plugin authors. | |

**User's choice:** Actionable summary plus expandable details.
**Notes:** Details may include manifest error, load exception, or log excerpt.

---

## Chat Behavior on Plugin Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Do not block chat | Conversation continues; only plugin-driven body motion degrades. | yes |
| Warn before sending | Chat allowed but user is prompted. | |
| Block chat until fixed | Strict but over-scopes plugin failure. | |

**User's choice:** Do not block chat.
**Notes:** Plugin failure should not stop LLM/TTS/VTS conversation.

---

## Manual UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Docs plus live swap path | Follow docs to run sample plugin, switch to it, observe auto-restart, select broken plugin, observe fallback. | yes |
| Docs only | Human reviews docs; tests cover swap. | |
| Live swap only | Docs verified by review, UAT focuses on behavior. | |

**User's choice:** Docs plus live swap path.
**Notes:** UAT should prove docs and system behavior together.

---

## Automated Sample Plugin Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Use sample plugin in tests | Sample stays runnable because tests exercise it. | yes |
| Synthetic temp plugins only | Avoids depending on sample as artifact. | |
| Both | Sample smoke plus synthetic invalid-plugin tests. | |

**User's choice:** Use sample plugin in tests.
**Notes:** Synthetic invalid-plugin tests may still be useful, but sample plugin coverage is required.

---

## the agent's Discretion

- Exact focused docs filenames and navigation copy.
- Exact helper-kit module path, provided it is author-facing and stable within plugin API v1.
- Exact sample plugin action names and visual output.
- Exact compact Status popover wording.

## Deferred Ideas

- Plugin marketplace, plugin signing, sandboxing, and packaging.
- Auto-installing plugin dependencies.
- Per-plugin venv or subprocess isolation.
- Hot-swapping plugin runtime or prompt vocabulary without sidecar restart.
- General plugin generation workflows outside motion-plugin algorithm adaptation.
