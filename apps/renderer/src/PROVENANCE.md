# Renderer-side OLVT port provenance

Tracks OLVT files ported into the renderer with upstream commit SHA + adaptations.
Mirrors the sidecar-side `sidecar/src/sidecar/orchestrator/PROVENANCE.md`.

## Upstream

- **Repo:** `Open-LLM-VTuber/Open-LLM-VTuber` (sibling at `C:/Users/16079/Code/OpenLLM_Vtuber/`)
- **License:** MIT
- **Verified date:** 2026-05-07
- **Upstream commit SHA:** `12d42d7c329a3f9ad3e39b5ca5e2c603bae277a7`

## Files

| Skeleton path | OLVT path | LOC | Adaptations |
|---|---|---|---|
| `apps/renderer/src/screens/Chat/useStreamingMessages.ts` | `frontend-src/web/src/renderer/src/context/chat-history-context.tsx` (lines 79-111, `appendAIMessage`) | ~200 | Module-level singleton state instead of React Context (matches Phase 1's `apps/renderer/src/ws/store.ts` pattern, avoids prop-drilling between the WS dispatcher and React components). Added `isThinking` flag for UI-SPEC IP-6 wholesale-replacement on first audio. Added `banner` and `inputDisabled` fields not present in OLVT (skeleton-side UI-SPEC additions for STREAM_ERROR / CONTEXT_OVERFLOW banners and IP-3 input lifecycle). Core merge logic verbatim: identical `forceNewMessage` boolean reset on new-bubble branch and last-AI-message slice-and-update on merge branch. |

## Pattern attributions (no file ports, only behavior)

| Skeleton surface | OLVT origin | Notes |
|---|---|---|
| Logs drawer `[INTENT]` prefix coloring rule | `OpenLLM_Vtuber/frontend-src/web/src/renderer/src/services/websocket-handler.tsx` (log envelope handling) | OLVT renders log lines plain; the green prefix is a skeleton-side UI-SPEC IP-4 extension. No code copied; behavior diverges. |
| Sticky-scroll with 40px slack on streaming chat | OLVT chat scroll behavior | Skeleton-side UI-SPEC IP-2 implementation; OLVT's scroll handling lives in chat-history-context's effects but uses different thresholds. |

## Note for future ports

Each file ported under this PROVENANCE.md MUST carry an in-file header comment:

```
/**
 * Ported from Open-LLM-VTuber (MIT) -- see apps/renderer/src/PROVENANCE.md.
 * Upstream: <relative path within OpenLLM_Vtuber>
 */
```

When the upstream commit SHA changes, update the table's `LOC` and `Adaptations`
columns rather than rewriting history -- this file is the audit trail.
