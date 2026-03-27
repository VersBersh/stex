# Context

## Relevant Files

| File | Role |
|------|------|
| `src/renderer/overlay/editor/tokenMerger.ts` | Pure function that groups sub-word Soniox tokens into word-level merged tokens. Always keeps the last word group in `newPending`. Provides `flushPending()` to emit the buffered word. |
| `src/renderer/overlay/editor/tokenMerger.test.ts` | Unit tests for `mergeTokens` and `flushPending` (14 cases). |
| `src/renderer/overlay/editor/TokenCommitPlugin.tsx` | React plugin that orchestrates the token pipeline: listens for `onTokensFinal`, calls `mergeTokens`, maintains `pendingRef`, commits complete words to the editor. Flushes pending on session pause/stop/replay. |
| `src/main/soniox.ts` | WebSocket client for Soniox speech recognition. Receives token batches and dispatches `onFinalTokens` / `onNonFinalTokens` events. |
| `src/main/soniox-lifecycle.ts` | Manages Soniox connection lifecycle, audio capture, reconnection, and replay. Bridges Soniox events to session callbacks. |
| `src/main/session.ts` | Session state machine. Sends IPC events (`SESSION_PAUSED`, `SESSION_STOP`) that trigger flushes in the renderer. |
| `src/shared/ipc.ts` | IPC channel constants including `TOKENS_FINAL`, `SESSION_PAUSED`, `SESSION_STOP`. |
| `spec/features/realtime-transcription.md` | Feature spec describing the token flow, endpoint detection, and session lifecycle. |

## Architecture

The speech transcription pipeline flows:

1. **Audio capture** → Soniox WebSocket → token responses
2. **Main process** (`soniox.ts`) separates tokens into final/non-final, sends via IPC to renderer
3. **Renderer** (`TokenCommitPlugin.tsx`) receives final tokens, calls `mergeTokens()` to group sub-word tokens into word-level tokens
4. `mergeTokens()` always keeps the **last word group** in `newPending` because the next token batch might continue that word (e.g., "Hell" + "o,")
5. Complete words are committed to the Lexical editor as `TimestampedTextNode`s
6. Pending tokens are flushed only on explicit session events: **pause**, **stop**, or **replay ghost convert**

**Key constraint**: Soniox can split words across token batches, so the merger must buffer the last group. But when the user stops speaking (and the session remains active/recording), Soniox sends the final tokens and then goes quiet — no session pause/stop event fires, so the last word stays buffered indefinitely.

**Soniox endpoint detection**: Soniox has `enable_endpoint_detection: true` with `max_endpoint_delay_ms` (default 1000ms). When the user pauses, Soniox finalizes the utterance and sends all remaining final tokens. After that, no more tokens arrive until the user speaks again. The `<end>` marker is filtered out and triggers clearing ghost text, but nothing triggers flushing the token merger's pending buffer.
