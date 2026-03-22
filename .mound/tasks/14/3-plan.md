# T14: Implementation Plan — Inline Editing

## Goal

Enable cursor preservation and edit protection so users can edit committed text mid-document while transcription streams, without incoming tokens displacing the cursor or overwriting user edits.

## Steps

### Step 1: Extend EditorBlockManager with offset tracking, edit detection, and modification marking

**File:** `src/renderer/overlay/editor/editorBlockManager.ts`

**Changes:**

Add offset-based block lookup, mid-document edit detection, and tail-vs-mid distinction. The block manager currently tracks blocks as an array with text but has no way to map a character offset to a specific block or handle user edits.

Add the following internal helper and public methods:

```typescript
// Internal: compute cumulative offsets from block text lengths
function getBlockOffsets(): Array<{ block: EditorBlock; index: number; start: number; end: number }> {
  let offset = 0;
  return blocks.map((b, i) => {
    const start = offset;
    offset += b.text.length;
    return { block: b, index: i, start, end: offset };
  });
}

// New public method: get total committed text length
getDocumentLength(): number {
  return blocks.reduce((sum, b) => sum + b.text.length, 0);
}

// New public method: apply a user edit at a given document offset
// Distinguishes tail insertion from mid-document edits.
// Returns 'tail' | 'mid' to indicate which path was taken.
applyEdit(changeOffset: number, removedLength: number, insertedText: string): 'tail' | 'mid' {
  const docLen = this.getDocumentLength();

  // TAIL INSERTION: edit offset is at or beyond the document end, and nothing was removed
  // This is the inline-typing path — creates/extends user blocks
  if (changeOffset >= docLen && removedLength === 0) {
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock && lastBlock.source === 'user') {
      lastBlock.text += insertedText;
    } else {
      blocks.push({
        id: generateBlockId(),
        text: insertedText,
        source: 'user',
        modified: false,
      });
    }
    return 'tail';
  }

  // MID-DOCUMENT EDIT: edit is within existing text
  const offsets = getBlockOffsets();

  // Find the first block that contains changeOffset
  for (const entry of offsets) {
    if (changeOffset < entry.end || (changeOffset === entry.end && entry.index === offsets.length - 1)) {
      const localOffset = changeOffset - entry.start;
      const block = entry.block;

      // Calculate how much of this block is affected
      const removedInBlock = Math.min(removedLength, block.text.length - localOffset);

      // Apply the text change to this block
      block.text = block.text.slice(0, localOffset) + insertedText + block.text.slice(localOffset + removedInBlock);

      // Mark soniox blocks as modified
      if (block.source === 'soniox' && !block.modified) {
        block.modified = true;
      }

      // Handle cross-block removal: if removedLength exceeds this block
      let remainingRemoval = removedLength - removedInBlock;
      let nextIndex = entry.index + 1;
      while (remainingRemoval > 0 && nextIndex < blocks.length) {
        const nextBlock = blocks[nextIndex];
        if (remainingRemoval >= nextBlock.text.length) {
          // Fully consumed block — remove it
          remainingRemoval -= nextBlock.text.length;
          blocks.splice(nextIndex, 1);
        } else {
          // Partially consumed block — trim its start
          nextBlock.text = nextBlock.text.slice(remainingRemoval);
          if (nextBlock.source === 'soniox' && !nextBlock.modified) {
            nextBlock.modified = true;
          }
          remainingRemoval = 0;
        }
      }

      return 'mid';
    }
  }

  // Offset beyond all blocks — treat as tail insertion
  return this.applyEdit(docLen, removedLength, insertedText);
}
```

**Key design decisions:**
- `applyEdit` distinguishes tail insertion (creating/extending user blocks per inline-typing spec) from mid-document edits (marking soniox blocks modified)
- Cross-block edits apply replacement text to the first affected block and remove/trim subsequent affected blocks
- The `commitFinalTokens` method already handles the case where the last block is modified (it creates a new block instead of extending), so no changes needed there

**Dependencies:** None.

### Step 2: Add tests for new EditorBlockManager methods

**File:** `src/renderer/overlay/editor/editorBlockManager.test.ts`

**Changes:**

Add test cases for the new methods (all pure unit tests, no DOM required):

**`getDocumentLength`:**
- Returns 0 for empty manager
- Returns correct total for multiple blocks

**`applyEdit` — tail insertion path:**
- Edit at document end creates new `user` block after soniox block
- Edit at document end extends existing `user` block
- Returns `'tail'`

**`applyEdit` — mid-document edit path:**
- Edit within a soniox block marks it `modified: true`, preserves `source: "soniox"`
- Edit within an already-modified block keeps it modified
- Edit within a `user` block updates text without changing source
- Returns `'mid'`

**`applyEdit` — cross-block edits:**
- Select+replace spanning two blocks: first block modified and receives replacement text, second block trimmed/removed
- Deletion spanning a full block: block removed from array

**`commitFinalTokens` after modification:**
- When last block is `modified: true`, `commitFinalTokens` creates a new soniox block (existing behavior, but now testable with modified blocks)

**Dependencies:** Step 1.

### Step 3: Add cursor preservation to TokenCommitPlugin

**File:** `src/renderer/overlay/editor/TokenCommitPlugin.tsx`

**Changes:**

The current `editor.update()` appends text without preserving the cursor. Each token batch creates a new `TextNode` appended to the last paragraph, and Lexical moves the cursor to the end of the new node. We need to save and restore the selection when the cursor is not at the document tail.

**Detecting "cursor at end":** Since each token batch appends a new `TextNode` to the paragraph, the last text node in the last paragraph represents the end of committed text. The cursor is "at end" if:
- The selection is a RangeSelection (collapsed)
- The anchor node is the last `TextNode` in the last `ParagraphNode`
- The anchor offset equals that TextNode's text length

```typescript
import { $getSelection, $isRangeSelection, $setSelection, $isTextNode } from 'lexical';

// Inside the onTokensFinal handler, within editor.update():

// 1. Capture current selection and determine if cursor is at end
const prevSelection = $getSelection();
const isRange = $isRangeSelection(prevSelection);

let cursorAtEnd = true; // default: track end
if (isRange) {
  const root = $getRoot();
  const lastParagraph = root.getLastChild();
  if ($isParagraphNode(lastParagraph)) {
    const lastTextNode = lastParagraph.getLastChild();
    if ($isTextNode(lastTextNode)) {
      const anchorNode = prevSelection.anchor.getNode();
      cursorAtEnd = anchorNode.getKey() === lastTextNode.getKey()
        && prevSelection.anchor.offset === lastTextNode.getTextContentSize();
    } else {
      // No text nodes yet — cursor at end by default
      cursorAtEnd = true;
    }
  }
}

// 2. Clone selection state before mutation (node keys and offsets)
const savedAnchorKey = isRange ? prevSelection.anchor.key : null;
const savedAnchorOffset = isRange ? prevSelection.anchor.offset : 0;
const savedAnchorType = isRange ? prevSelection.anchor.type : 'text';
const savedFocusKey = isRange ? prevSelection.focus.key : null;
const savedFocusOffset = isRange ? prevSelection.focus.offset : 0;
const savedFocusType = isRange ? prevSelection.focus.type : 'text';

// 3. Append text (existing logic)
const lastChild = root.getLastChild();
if ($isParagraphNode(lastChild)) {
  lastChild.append($createTextNode(text));
} else {
  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode(text));
  root.append(paragraph);
}

// 4. Restore selection if cursor was mid-document
if (!cursorAtEnd && isRange && savedAnchorKey && savedFocusKey) {
  const selection = prevSelection.clone();
  selection.anchor.set(savedAnchorKey, savedAnchorOffset, savedAnchorType);
  selection.focus.set(savedFocusKey, savedFocusOffset, savedFocusType);
  $setSelection(selection);
}
```

**Why this works:** We only append new TextNodes at the document tail. Existing TextNodes earlier in the document are untouched — their keys remain valid and their text content unchanged. So restoring anchor/focus by key+offset to a mid-document TextNode is safe.

**Note on `$isTextNode`:** Need to add this import from `'lexical'`. The existing imports already include `$getRoot`, `$createTextNode`, `$createParagraphNode`, `$isParagraphNode`.

**Dependencies:** Step 1 (optional — the cursor detection doesn't need `getDocumentLength()` since it directly checks the last TextNode).

### Step 4: Create InlineEditPlugin for detecting user edits and syncing block manager

**File:** `src/renderer/overlay/editor/InlineEditPlugin.tsx` (new file)

**Changes:**

Create a Lexical plugin that listens for user-initiated text changes and routes them through `blockManager.applyEdit()`.

```typescript
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot } from 'lexical';
import type { EditorBlockManager } from './editorBlockManager';

interface InlineEditPluginProps {
  blockManager: EditorBlockManager;
}

export function InlineEditPlugin({ blockManager }: InlineEditPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, prevEditorState, tags }) => {
      // Skip programmatic updates (token commits use 'historic' tag)
      if (tags.has('historic')) return;

      const currentText = editorState.read(() => $getRoot().getTextContent());
      const prevText = prevEditorState.read(() => $getRoot().getTextContent());

      if (currentText === prevText) return;

      const diff = findTextDiff(prevText, currentText);
      if (diff) {
        blockManager.applyEdit(diff.offset, diff.removedLength, diff.insertedText);
      }
    });
  }, [editor, blockManager]);

  return null;
}

// Exported for testing independently (pure function, no DOM needed)
export function findTextDiff(
  prev: string,
  current: string,
): { offset: number; removedLength: number; insertedText: string } | null {
  let start = 0;
  const minLen = Math.min(prev.length, current.length);
  while (start < minLen && prev[start] === current[start]) {
    start++;
  }

  let prevEnd = prev.length;
  let currEnd = current.length;
  while (prevEnd > start && currEnd > start && prev[prevEnd - 1] === current[currEnd - 1]) {
    prevEnd--;
    currEnd--;
  }

  const removedLength = prevEnd - start;
  const insertedText = current.slice(start, currEnd);

  if (removedLength === 0 && insertedText.length === 0) return null;

  return { offset: start, removedLength, insertedText };
}
```

**Key design decisions:**
- Uses `registerUpdateListener` to catch all editor state changes
- Skips `'historic'`-tagged updates (programmatic token appends) — these are already handled by the block manager's `commitFinalTokens`
- Computes a minimal text diff between previous and current editor state
- Routes the diff through `blockManager.applyEdit()` which handles tail-vs-mid distinction
- `findTextDiff` is exported as a pure function for easy unit testing without DOM

**Note on `$getRoot().getTextContent()`:** Lexical inserts `\n` between paragraphs in `getTextContent()`. Currently the app uses a single paragraph, so the block manager's `getDocumentText()` matches. If multi-paragraph support is added later, the block manager would need to account for newlines. This assumption is documented in Risks.

**Dependencies:** Step 1 (block manager `applyEdit` method).

### Step 5: Register InlineEditPlugin in Editor component

**File:** `src/renderer/overlay/editor/Editor.tsx`

**Changes:**

Import and add `InlineEditPlugin` to the Lexical composer, passing the existing `blockManager`:

```tsx
import { InlineEditPlugin } from './InlineEditPlugin';

// In the JSX, add after TokenCommitPlugin:
<InlineEditPlugin blockManager={blockManager} />
```

**Dependencies:** Step 4.

### Step 6: Add tests for findTextDiff and InlineEditPlugin integration

**File:** `src/renderer/overlay/editor/InlineEditPlugin.test.ts` (new file)

**Changes:**

Pure unit tests for `findTextDiff` (no DOM/React required):

- Insertion at end: `("Hello", "Hello world")` → `{ offset: 5, removedLength: 0, insertedText: " world" }`
- Insertion mid-text: `("Hllo", "Hello")` → `{ offset: 1, removedLength: 0, insertedText: "e" }`
- Deletion: `("Hello world", "Hello")` → `{ offset: 5, removedLength: 6, insertedText: "" }`
- Replacement: `("Hello world", "Hello earth")` → `{ offset: 6, removedLength: 5, insertedText: "earth" }`
- No change: `("Hello", "Hello")` → `null`
- Empty to non-empty: `("", "Hello")` → `{ offset: 0, removedLength: 0, insertedText: "Hello" }`

**Dependencies:** Step 4.

### Step 7: Apply spec updates

**Files:** `spec/features/inline-editing.md`, `spec/models.md`

**Changes:** Apply the spec additions described in `2-spec-updates.md`:

1. Add "Cursor Tracking Behavior" subsection to `spec/features/inline-editing.md` under "### Cursor Position"
2. Add "Detecting mid-document edits" rule (#5) to `spec/models.md` under "### Ownership Rules" — distinguishing tail insertion from mid-document edits
3. Add "Selection Preservation" requirement to `spec/features/inline-editing.md` under "### Editing During Active Transcription" — framed as a requirement, not a framework guarantee
4. Fix inconsistency between rules 3 and 4 in `spec/models.md` — align with actual merge behavior

**Dependencies:** None (spec changes are documentation-only).

## Risks / Open Questions

### 1. Lexical selection restoration within editor.update()

**Risk:** Lexical may not respect `$setSelection()` called at the end of an `editor.update()` callback if it applies its own selection normalization afterward.

**Mitigation:** Test empirically. If selection set within the update callback doesn't stick, use a second `editor.update({ discrete: true })` call immediately after the first to restore selection. The second call would read the saved key/offset values from a closure and apply them.

### 2. $getRoot().getTextContent() includes paragraph newlines

**Risk:** Lexical's `$getRoot().getTextContent()` joins paragraphs with `\n`, but the block manager's `getDocumentText()` concatenates block texts without separators. If the document has multiple paragraphs, offsets will diverge.

**Mitigation:** Currently the app only uses one paragraph (all tokens append to the last paragraph). This is documented as an assumption. If multi-paragraph support is needed, the block manager must account for `\n` separators. Add a comment in `InlineEditPlugin` noting this single-paragraph assumption.

### 3. Block offset drift between block manager and editor state

**Risk:** If the block manager's accumulated text diverges from the Lexical editor's actual text (missed updates, race conditions), block offsets will be wrong and edits attributed to the wrong block.

**Mitigation:** Add a development-mode assertion in `InlineEditPlugin` that compares `blockManager.getDocumentText()` with the previous editor state text before computing the diff. Log a warning if they diverge. This catches drift early without impacting production performance.

### 4. Undo/redo interaction with modified blocks

**Risk:** If the user edits a block (marking it modified) then undoes via Ctrl+Z, the block remains marked `modified: true` in the block manager even though the text reverted. The block manager doesn't participate in Lexical's undo system.

**Mitigation:** This is acceptable for T14. The `modified` flag is conservative — keeping a block marked modified when it may have been reverted only prevents overwrites, which is safe behavior. Integrating block manager state with undo is a separate task. Additionally, undo stacks are cleared after each token commit, so the window for this scenario is narrow.

### 5. Cross-block edit edge cases

**Risk:** The `applyEdit` cross-block handling (removing fully consumed blocks, trimming partially consumed ones) is a simplified approach. Complex scenarios like pasting a large block of text over a selection spanning 5+ blocks could produce unexpected block structures.

**Mitigation:** The core use case is single-character or single-word edits within one block. Cross-block edits are rare in practice (select+replace of a phrase spanning a block boundary). The implementation handles the common cases; exotic edge cases would still mark blocks as modified (safe) but might leave suboptimal block structure. This is acceptable for T14.
