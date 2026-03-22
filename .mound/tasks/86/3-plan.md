# Plan

## Goal

Extract a shared helper that centralizes the `$getRoot().getTextContent()` call and the `\n\n` paragraph separator contract, then update InlineEditPlugin and UserTypingPlugin (and UndoRedoBlockSyncPlugin) to use it.

## Steps

### Step 1: Create `src/renderer/overlay/editor/lexicalTextContract.ts`

Create a new file with:

```ts
import { $getRoot } from 'lexical';

/**
 * Paragraph separator used by Lexical's $getRoot().getTextContent().
 * Lexical joins ParagraphNode children with this string.
 * Verified against Lexical v0.22.x.
 *
 * If a Lexical upgrade changes this, update this constant and
 * fix any code that depends on the separator format.
 */
export const LEXICAL_PARAGRAPH_SEPARATOR = '\n\n';

/**
 * Reads the full document text from the Lexical editor state.
 * Must be called inside a Lexical read/update callback (e.g., editorState.read()).
 *
 * Paragraphs are joined by LEXICAL_PARAGRAPH_SEPARATOR ('\n\n').
 */
export function $getDocumentText(): string {
  return $getRoot().getTextContent();
}
```

This file:
- Exports `LEXICAL_PARAGRAPH_SEPARATOR` — the `\n\n` constant
- Exports `$getDocumentText()` — wraps `$getRoot().getTextContent()`
- Uses the `$` prefix convention consistent with Lexical's own naming (e.g., `$getRoot`, `$getSelection`)

### Step 2: Update `InlineEditPlugin.tsx`

- Replace `import { $getRoot } from 'lexical';` with `import { $getDocumentText } from './lexicalTextContract';`
- Replace `$getRoot().getTextContent()` calls on lines 18-19 with `$getDocumentText()`

### Step 3: Update `UserTypingPlugin.tsx`

- Replace `import { $getRoot } from 'lexical';` with `import { $getDocumentText } from './lexicalTextContract';`
- Replace `$getRoot().getTextContent()` call on line 18 with `$getDocumentText()`

### Step 4: Update `UndoRedoBlockSyncPlugin.tsx`

- Add `import { $getDocumentText } from './lexicalTextContract';`
- Remove `$getRoot` from the `lexical` import (keep other imports: `UNDO_COMMAND, REDO_COMMAND, COMMAND_PRIORITY_LOW`)
- Replace `$getRoot().getTextContent()` calls on lines 40-41 with `$getDocumentText()`

### Step 5: Verify migration and run tests

1. Grep for `$getRoot().getTextContent()` in the three migrated plugins to confirm no direct calls remain.
2. Run the project's test suite for the editor directory to verify all existing tests pass.

## Risks / Open Questions

1. **OverlayContext.tsx also calls `$getRoot().getTextContent()`** — but for different purposes (isEmpty check, clipboard copy, send session text). These are outside the block-sync subsystem and don't depend on the paragraph separator contract. Leaving them as-is avoids scope creep. Could be addressed in a follow-up if desired.

2. **`$` prefix convention** — Lexical uses the `$` prefix for functions that must be called inside a read/update callback. `$getDocumentText` follows this convention, signaling to callers that it has the same constraint.

3. **Test files reference `\n\n` directly** — The `InlineEditPlugin.test.ts` and `editorBlockManager.test.ts` tests use `\n\n` literal strings in test data. This is acceptable — they are testing the contract behavior itself. Optionally, tests could import `LEXICAL_PARAGRAPH_SEPARATOR`, but this would make them less readable for no practical benefit (the tests should break if the separator changes).
