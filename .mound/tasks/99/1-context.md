# Context

## Relevant Files

- `src/main/soniox.ts` — WebSocket client for Soniox speech-to-text API. Receives raw JSON responses, parses tokens, and dispatches them to callbacks (`onFinalTokens`, `onNonFinalTokens`, `onFinished`). The `handleMessage` method filters tokens by `is_final` and deduplicates using `lastFinalProcMs`.
- `src/main/soniox.test.ts` — Unit tests for `SonioxClient`. Tests token parsing, finalization, disconnect, and stale socket protection.
- `src/main/soniox-lifecycle.ts` — Manages Soniox connection lifecycle (connect, reconnect, finalize). Forwards tokens from `SonioxClient` callbacks to `SonioxLifecycleCallbacks`.
- `src/main/soniox-lifecycle.test.ts` — Unit tests for soniox-lifecycle module.
- `src/main/session.ts` — Session manager. Creates lifecycle callbacks that forward tokens to the renderer via IPC (`TOKENS_FINAL`, `TOKENS_NONFINAL`).
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Renderer-side plugin that listens for final tokens via IPC and appends their text to the Lexical editor. Joins `token.text` values and creates text nodes.
- `src/renderer/overlay/editor/ghost-text-utils.ts` — Handles non-final token display as CSS ghost text. Joins `token.text` values.
- `src/renderer/overlay/editor/editorBlockManager.ts` — Manages committed text blocks. `commitFinalTokens` joins token text and appends to blocks.
- `src/shared/types.ts` — Shared type definitions including `SonioxToken` (with `text`, `is_final`, etc).

## Architecture

The transcription pipeline flows:

1. **Soniox WebSocket API** sends JSON responses containing `tokens[]` array
2. **`SonioxClient.handleMessage()`** parses the response, separates tokens into final/non-final by `is_final` flag, and calls appropriate callbacks
3. **`soniox-lifecycle`** forwards these callbacks to the session manager
4. **`session.ts`** sends tokens to the renderer via Electron IPC (`TOKENS_FINAL`, `TOKENS_NONFINAL`)
5. **Renderer** — `TokenCommitPlugin` commits final tokens to the Lexical editor; `ghost-text-utils` displays non-final tokens as ghost text

The bug: Soniox sends `<end>` as a token text when endpoint detection fires (`enable_endpoint_detection: true` in the config). This is a protocol marker, not transcribed speech. Currently, nothing in the pipeline filters it out, so it flows all the way to the editor and gets displayed to the user.

The correct fix location is `SonioxClient.handleMessage()` in `src/main/soniox.ts` — this is the service boundary where protocol-level concerns should be stripped before tokens reach the application layer.
