# Merge sub-word Soniox tokens into word-level TimestampedTextNodes

## Summary

Soniox streams sub-word token chunks (e.g., `"Hell"` + `"o,"` instead of `"Hello,"`). Currently each chunk becomes its own `TimestampedTextNode` in the Lexical editor. This produces fragmented nodes that don't align with word boundaries, which is problematic for the context-refresh feature where audio replay points are determined from token timestamps — we need to cut on word boundaries.

## Current behavior

Captured editor state shows sub-word splits like:
- `"Hell"` (5580–5640) + `"o,"` (5700–5760) → should be `"Hello,"` (5580–5760)
- `" y"` (7980–8040) + `"ou"` (8100–8160) → should be `" you"` (7980–8160)
- `" h"` (10860–10920) + `"ope"` (10920–10980) → should be `" hope"` (10860–10980)
- `" do"` (11280–11340) + `"ing"` (11400–11460) → should be `" doing"` (11280–11460)

## Approach

**Word boundary rule**: a token starting with a space (or the first token in the stream) begins a new word. Tokens without a leading space are continuations of the previous word.

**Cross-batch handling**: a word may be split across two `onTokensFinal` batches, so the merger must buffer the trailing partial word group and prepend it to the next batch.

**Merged token properties**:
- `text` = concatenated text of all chunks in the word
- `startMs` = first chunk's `start_ms`
- `endMs` = last chunk's `end_ms`
- `originalText` = concatenated text

**Flush**: pending partial word must be flushed (committed) on session pause, stop, and clear so the last word always appears.

## Acceptance criteria

- [ ] New `tokenMerger.ts` utility with a pure function that takes pending tokens + incoming tokens and returns `{ words: MergedToken[], newPending: SonioxToken[] }`
- [ ] Separate `flushPending()` function to convert remaining pending tokens into a final merged word
- [ ] `TokenCommitPlugin` uses the merger: one `TimestampedTextNode` per word instead of per chunk
- [ ] Cross-batch word continuations are handled correctly (buffer trailing partial, merge on next batch)
- [ ] Pending tokens are flushed on session pause/stop/clear
- [ ] `blockManager.commitFinalTokens()` receives merged tokens (check interface compatibility)
- [ ] Unit tests for the merge function covering: single-word batch, multi-word batch, cross-batch continuation, flush, empty tokens, punctuation-only tokens

## References

- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — current token commit logic
- `src/renderer/overlay/editor/TimestampedTextNode.ts` — node class
- `src/renderer/overlay/editor/debug-seed.json` — captured sub-word token data showing the problem
- `spec/proposal-context-refresh.md` — context-refresh feature that depends on word-level timestamps
