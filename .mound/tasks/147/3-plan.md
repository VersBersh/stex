# Plan

## Goal

Create a token merger utility that groups Soniox sub-word token chunks into word-level tokens based on leading-space boundaries, and integrate it into `TokenCommitPlugin` so one `TimestampedTextNode` is created per word instead of per chunk.

## Steps

### 1. Create `src/renderer/overlay/editor/tokenMerger.ts`

Define types and pure functions:

```ts
export interface MergedToken {
  text: string;
  startMs: number;
  endMs: number;
  originalText: string;
}

export interface MergeResult {
  words: MergedToken[];
  newPending: SonioxToken[];
}
```

**`mergeTokens(pending: SonioxToken[], incoming: SonioxToken[]): MergeResult`**
- Concatenate `pending` + `incoming` into a combined array, filter empty-text tokens
- Group tokens by word boundary: a token with leading space starts a new group; tokens without leading space continue the previous group; the first token always starts a new group
- All groups except the last are complete words → convert to `MergedToken[]`
- The last group is always returned as `newPending` (it may be continued by the next batch)
- `MergedToken.text` = concatenation of all chunk texts in the group
- `MergedToken.startMs` = first chunk's `start_ms`
- `MergedToken.endMs` = last chunk's `end_ms`
- `MergedToken.originalText` = same as `text`

**`flushPending(pending: SonioxToken[]): MergedToken | null`**
- If pending is empty (after filtering empty text), return null
- Convert the pending tokens into a single `MergedToken`
- Used on session pause/stop to commit the buffered partial word

### 2. Create `src/renderer/overlay/editor/tokenMerger.test.ts`

Unit tests covering:
- Single word in one batch → stays as pending (not emitted until next boundary or flush)
- Multi-word batch → all but last emitted, last stays pending
- Sub-word split within a batch (e.g. `["Hell", "o,", " world"]`)
- Cross-batch continuation: batch 1 trailing partial, batch 2 starts with continuation
- First token without leading space treated as word start
- Flush of pending tokens
- Empty incoming tokens / all empty text tokens
- Punctuation-only continuation tokens (no leading space)

### 3. Modify `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

**Add state**: `useRef<SonioxToken[]>([])` for pending token buffer.

**Extract `commitWords(words: MergedToken[])`**: refactor the existing commit logic (blockManager update, editor append, selection handling, scroll, history reset, logging) into a reusable function. This avoids duplication between the normal path and the flush path.

**Modify `onTokensFinal` handler**:
- Call `mergeTokens(pendingRef.current, tokens)` instead of iterating tokens directly
- Update `pendingRef.current = result.newPending`
- Call `commitWords(result.words)` — skips if empty
- Create `TimestampedTextNode` per `MergedToken` (word-level) instead of per `SonioxToken` (chunk-level)

**Add `mergedToSonioxTokens` helper**: converts `MergedToken[]` to `SonioxToken[]`-shaped objects for `blockManager.commitFinalTokens()` compatibility (it only reads `.text`).

**Flush on session pause/stop**: new `useEffect` subscribing to `window.api.onSessionPaused` and `window.api.onSessionStop`. On either event, call `flushPending(pendingRef.current)`, reset pending to `[]`, and `commitWords([flushed])` if non-null.

**Discard on clear**: new `useEffect` with `registerClearHook` that resets `pendingRef.current = []`. On clear, the user is wiping everything so pending tokens are discarded, not committed. This avoids ordering issues with the existing clear hook that calls `blockManager.clear()`.

### 4. Interface compatibility

`blockManager.commitFinalTokens(tokens: SonioxToken[])` only reads `.text` from each token. The `mergedToSonioxTokens` adapter constructs minimal objects matching the `SonioxToken` shape from `MergedToken[]`. No changes to the block manager interface are needed.

## Risks / Open Questions

- **Pending token timing**: With merging, `blockManager.getDocumentText()` temporarily lags behind what Soniox has sent (the pending partial word isn't committed yet). This is acceptable — the block manager is updated in lockstep with the editor, and the pending word is committed on the next batch or flush.
- **Clear hook ordering**: Clear hooks in OverlayContext run in Set insertion order. The "discard pending" hook must not depend on ordering relative to the "clear blockManager" hook, since both are independent. By simply discarding pending (not committing), no ordering dependency exists.
- **Integration test coverage**: The plan reviewer flagged that the flush path in TokenCommitPlugin is untested at the integration level. This is consistent with existing patterns — no existing integration tests for TokenCommitPlugin exist. The pure merge function tests provide thorough coverage of the merge logic. Full integration testing would require Lexical editor setup and IPC mocking which is beyond scope.
