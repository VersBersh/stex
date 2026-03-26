# Context

## Relevant Files

- `src/shared/types.ts` — Defines `SonioxToken` interface (text, start_ms, end_ms, confidence, is_final, speaker?)
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — React plugin that subscribes to `window.api.onTokensFinal`, currently creates one `TimestampedTextNode` per token chunk
- `src/renderer/overlay/editor/TimestampedTextNode.ts` — Lexical node class with startMs, endMs, originalText; factory `$createTimestampedTextNode(text, startMs, endMs, originalText?)`
- `src/renderer/overlay/editor/editorBlockManager.ts` — Block manager; `commitFinalTokens(tokens: SonioxToken[])` concatenates token texts and appends to blocks
- `src/renderer/overlay/editor/debug-seed.json` — Captured editor state showing sub-word fragmentation
- `src/shared/preload.d.ts` — ElectronAPI type declarations including `onSessionPaused`, `onSessionStop`, `onTokensFinal`
- `src/renderer/overlay/OverlayContext.tsx` — Provides `registerClearHook` for editor clear events
- `src/renderer/overlay/pauseController.ts` — Pause/resume state management, subscribes to session status
- `src/renderer/overlay/editor/editorBlockManager.test.ts` — Example test file showing vitest patterns and `makeToken` helper
- `spec/proposal-context-refresh.md` — Context-refresh proposal that depends on word-level timestamps

## Architecture

The transcription pipeline flows: Soniox WebSocket → main process → IPC `tokens:final` → renderer `onTokensFinal` callback → `TokenCommitPlugin`.

`TokenCommitPlugin` does two things on each `onTokensFinal` batch:
1. Calls `blockManager.commitFinalTokens(tokens)` to track text blocks
2. Appends one `TimestampedTextNode` per token to the Lexical editor

The problem: Soniox sends sub-word chunks (e.g. `"Hell"` + `"o,"`) where each becomes its own node. The context-refresh feature needs word-level boundaries for audio replay points.

The merger will sit between the raw `onTokensFinal` callback and both consumers (block manager and editor), grouping sub-word chunks into whole words based on leading-space boundaries. It must buffer the trailing partial word across batches and flush on session lifecycle events (pause, stop, clear).
