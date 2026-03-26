# Plan

## Goal

Implement a pure analysis function `$analyzeReplayEligibility` that inspects the live Lexical editor state and returns a `ReplayAnalysisResult` indicating whether re-transcription is eligible, with the correct `replayStartMs` and `replayGhostStartMs`.

## Steps

### 1. Define the `ReplayAnalysisResult` type

**File:** `src/renderer/overlay/editor/analyzeReplayEligibility.ts` (new)

Define the interface:

```ts
export interface ReplayAnalysisResult {
  eligible: boolean;
  replayStartMs: number | null;
  replayGhostStartMs: number | null;
  blockedReason: 'none' | 'paragraph-boundary' | 'dirty-tail' | 'too-far-from-end';
}
```

### 2. Implement `$analyzeReplayEligibility`

**File:** `src/renderer/overlay/editor/analyzeReplayEligibility.ts`

Export a function `$analyzeReplayEligibility()` (prefixed with `$` per Lexical convention — must be called inside `editorState.read()`).

Algorithm:

1. **Collect all leaf nodes with paragraph context:** Walk `$getRoot().getChildren()` (paragraphs). For each paragraph, walk `.getChildren()` to get leaf nodes. Build a flat list of `{ node, paragraphIndex }` tuples. Track paragraph boundaries for distance calculation.

2. **Classify each leaf node:** For each leaf:
   - If `$isTimestampedTextNode(node)` and `node.getTextContent() === node.getOriginalText()` → **clean**
   - If `$isTimestampedTextNode(node)` and `node.getTextContent() !== node.getOriginalText()` → **dirty** (timestamped)
   - If plain TextNode (not TimestampedTextNode) → **dirty** (plain)

3. **Find the latest dirty node:** Scan the flat list from the end backwards. Find the last dirty node. If no dirty node exists → return `{ eligible: false, replayStartMs: null, replayGhostStartMs: null, blockedReason: 'none' }`.

4. **Check for clean tail:** After the latest dirty node, there must be at least one clean TimestampedTextNode. If there are no nodes after the dirty node (dirty node is last) → return `{ eligible: false, ..., blockedReason: 'dirty-tail' }`. Note: by definition, all nodes after the latest dirty node are clean — there can be no dirty nodes after the latest one. But we need at least one clean node to form a replay tail.

5. **Proximity gate:** Compute character distance from the dirty node to the document end. Sum `getTextContent().length` for all nodes after the dirty node, plus `LEXICAL_PARAGRAPH_SEPARATOR.length` for each paragraph boundary crossed between the dirty node and the end. If distance > 100 → return `{ eligible: false, ..., blockedReason: 'too-far-from-end' }`.

6. **Paragraph-boundary guard:** Check that the dirty node and all nodes in the clean tail are in the same paragraph (same `paragraphIndex`). If not → return `{ eligible: false, ..., blockedReason: 'paragraph-boundary' }`.

7. **Determine `replayStartMs` and `replayGhostStartMs`:**
   - Let `firstCleanAfterDirty` = the first clean TimestampedTextNode after the dirty node.
   - If the dirty node is a `TimestampedTextNode` and `node.getTextContent().endsWith(node.getOriginalText())`:
     - `replayStartMs = dirtyNode.getStartMs()` — replay includes the dirty node's audio span
     - `replayGhostStartMs = dirtyNode.getStartMs()` — the dirty node's originalText suffix is folded into the ghost region alongside the clean tail
   - Otherwise:
     - `replayStartMs = firstCleanAfterDirty.getStartMs()`
     - `replayGhostStartMs = firstCleanAfterDirty.getStartMs()`

8. **Return eligible result:**
   ```ts
   { eligible: true, replayStartMs, replayGhostStartMs, blockedReason: 'none' }
   ```

### 3. Export the proximity threshold constant

**File:** `src/renderer/overlay/editor/analyzeReplayEligibility.ts`

```ts
export const PROXIMITY_THRESHOLD_CHARS = 100;
```

### 4. Write unit tests

**File:** `src/renderer/overlay/editor/analyzeReplayEligibility.test.ts` (new)

Test setup pattern follows `TimestampedTextNode.test.ts` and `cursor-track.test.ts`:
- `// @vitest-environment jsdom`
- `createTestEditor()` with `TimestampedTextNode` registered
- Helper to build editor state with mixed clean/dirty timestamped nodes and plain text nodes

Test cases:
1. **No dirty nodes (all clean)** → `eligible: false`, `blockedReason: 'none'`
2. **Single dirty TimestampedTextNode near end, followed by clean tail** → `eligible: true`, correct `replayStartMs` and `replayGhostStartMs`
3. **Dirty node >100 chars from end** → `eligible: false`, `blockedReason: 'too-far-from-end'`
4. **Dirty node at very end (no clean tail)** → `eligible: false`, `blockedReason: 'dirty-tail'`
5. **Dirty node and clean tail in different paragraphs** → `eligible: false`, `blockedReason: 'paragraph-boundary'`
6. **Suffix-match case** → dirty TimestampedTextNode where `currentText.endsWith(originalText)` → `replayStartMs` and `replayGhostStartMs` are the dirty node's own `startMs`
7. **Non-suffix-match case** → dirty TimestampedTextNode where current text does NOT end with original → `replayStartMs` and `replayGhostStartMs` are first clean node's `startMs`
8. **Plain TextNode (user-typed) as dirty node** → correctly identified as dirty, uses first clean node's `startMs`
9. **Proximity gate accounts for paragraph separators** → dirty node within 100 leaf chars but >100 chars including `\n\n` → `blockedReason: 'too-far-from-end'`
10. **Empty editor** → `eligible: false`, `blockedReason: 'none'`

## Risks / Open Questions

- **Proximity measurement includes paragraph separators:** The spec says "within ~100 characters of the document end" without specifying whether paragraph separators count. We include them because `$getDocumentText()` includes `\n\n` between paragraphs — this is the canonical document text representation. The `~` prefix in the spec suggests approximate intent.
- **Empty clean tail after dirty node:** The spec describes replay range as `[replayStartMs, endMs of last clean node]`. If there are no clean nodes after the dirty node, there's nothing to replay. We return `blockedReason: 'dirty-tail'` for this case.
- **`replayGhostStartMs` in suffix-match case:** Per the spec's section on "Prefix/suffix matching for node replacement" (proposal-context-refresh.md lines 206-216), the dirty node's `originalText` suffix is folded into the replay ghost region. So `replayGhostStartMs` equals `replayStartMs` (the dirty node's `startMs`) in the suffix-match case, not the first clean node's `startMs`.
- **Spec inconsistency with inline-editing.md:** The reviewer noted that `spec/features/inline-editing.md` describes resume as continuing on the existing WebSocket, while `spec/proposal-context-refresh.md` requires closing and reopening. This task implements the proposal spec; updating inline-editing.md is out of scope.
- **Lexical node ordering:** `paragraph.getChildren()` returns children in document order, which is correct for left-to-right traversal.
