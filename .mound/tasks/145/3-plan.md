# Plan

## Goal

Create a `TimestampedTextNode` custom Lexical node that carries audio timestamp metadata from Soniox tokens, and update `TokenCommitPlugin` to emit one node per token instead of joining them into a single `TextNode`.

## Steps

### 1. Update spec: `spec/models.md` — Mapping to Lexical section

Update the "Mapping to Lexical" section (lines 57-61) to reflect that committed transcription text now uses `TimestampedTextNode`, a `TextNode` subclass carrying per-token audio timing metadata (`startMs`, `endMs`, `originalText`). Note that:
- `TimestampedTextNode` renders identically to `TextNode`
- The block manager remains offset-based and independent of Lexical node structure
- Timestamp metadata may become stale after user edits (expected — edited nodes detected by `getTextContent() !== getOriginalText()`)

### 2. Create `TimestampedTextNode` class

**File**: `src/renderer/overlay/editor/TimestampedTextNode.ts` (new)

Create a custom Lexical `TextNode` subclass with:
- Properties: `__startMs: number`, `__endMs: number`, `__originalText: string`
- Constructor: `(text, startMs, endMs, originalText, key?)`
- Static `getType()` returning `'timestamped-text'`
- Static `clone(node)` copying all fields
- Getters: `getStartMs()`, `getEndMs()`, `getOriginalText()` — each calls `this.getLatest()` per Lexical convention
- `createDOM()` and `updateDOM()` delegating to `super`
- `exportJSON()` including timestamp fields and `type: 'timestamped-text'`
- Static `importJSON()` restoring all fields
- Factory function `$createTimestampedTextNode(text, startMs, endMs, originalText)`
- Type guard `$isTimestampedTextNode(node)`

### 3. Register `TimestampedTextNode` in editor config

**File**: `src/renderer/overlay/editor/Editor.tsx`

- Import `TimestampedTextNode` from `./TimestampedTextNode`
- Add `nodes: [TimestampedTextNode]` to `initialConfig`

### 4. Update `TokenCommitPlugin` to emit per-token nodes

**File**: `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

- Import `$createTimestampedTextNode` from `./TimestampedTextNode`
- Remove `$createTextNode` from the `lexical` import (no longer used)
- In the `onTokensFinal` callback, replace the single `$createTextNode(text)` with a loop that creates one `TimestampedTextNode` per token:
  ```ts
  for (const token of tokens) {
    lastChild.append(
      $createTimestampedTextNode(token.text, token.start_ms, token.end_ms, token.text)
    );
  }
  ```
- Apply the same pattern in the `else` branch (new paragraph case)
- Keep the early return for empty joined text

### 5. No changes to existing tests

The existing tests in `cursorTracking.test.ts` and `multiParagraphIntegration.test.ts` use `$createTextNode` in manual simulation helpers — they test cursor tracking and block manager logic, not node types. Since `TimestampedTextNode` extends `TextNode` and the cursor/selection logic is type-agnostic, these tests remain valid. They don't need `TimestampedTextNode` registered because they use plain `TextNode` directly.

New tests for `TimestampedTextNode` itself are added in Step 7 (test phase).

## Risks / Open Questions

- **Text splitting**: When Lexical splits a `TimestampedTextNode` (e.g., user clicks mid-word and types), `splitText()` from `TextNode` creates plain `TextNode` instances, not `TimestampedTextNode` instances. This is acceptable — user-edited text naturally loses its direct timestamp association. The `originalText` field on the parent node still preserves what was originally transcribed.
- **Timestamp staleness after edits**: When a user edits a `TimestampedTextNode`, the `__startMs`/`__endMs`/`__originalText` fields remain unchanged while the visible text changes. This is by design — comparing `getTextContent()` to `getOriginalText()` reveals whether the node has been user-modified. The context-refresh feature will use this to determine replay points.
- **Multiple nodes per commit**: The change from one `TextNode` per commit to N `TimestampedTextNode` nodes per commit means more DOM elements. Soniox typically sends 1-10 tokens per final batch, so this is negligible.
- **Serialization**: `exportJSON`/`importJSON` are implemented for Lexical interface correctness but the editor doesn't currently persist state to JSON.
