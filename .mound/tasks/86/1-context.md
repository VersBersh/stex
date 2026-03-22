# Context

## Relevant Files

| File | Role |
|------|------|
| `src/renderer/overlay/editor/InlineEditPlugin.tsx` | Plugin that detects text diffs between editor states and calls `blockManager.applyEdit()`. Calls `$getRoot().getTextContent()` on lines 18-19. |
| `src/renderer/overlay/editor/UserTypingPlugin.tsx` | Plugin that detects user-typed tail text and calls `blockManager.replaceLastUserBlock()`. Calls `$getRoot().getTextContent()` on line 18. |
| `src/renderer/overlay/editor/UndoRedoBlockSyncPlugin.tsx` | Plugin that syncs block manager state with Lexical undo/redo. Also calls `$getRoot().getTextContent()` on lines 40-41 with same pattern. |
| `src/renderer/overlay/editor/editorBlockManager.ts` | Block manager that tracks document text as blocks (soniox/user). Uses plain string concatenation — no paragraph separator awareness. |
| `src/renderer/overlay/editor/InlineEditPlugin.test.ts` | Tests for `findTextDiff` — includes multi-paragraph `\n\n` separator tests. |
| `src/renderer/overlay/editor/editorBlockManager.test.ts` | Tests for block manager — includes multi-paragraph `\n\n` separator tests. |
| `src/renderer/overlay/editor/ghost-text-utils.ts` | Existing utility file in the editor directory — shows the convention for shared helpers. |
| `src/renderer/overlay/OverlayContext.tsx` | Uses `$getRoot().getTextContent()` for isEmpty/copy/send — different concern, not part of block-sync contract. |

## Architecture

The editor subsystem uses Lexical as a rich text editor with multiple plugins that observe editor state changes:

1. **InlineEditPlugin** registers an update listener. On each non-historic update, it reads the current and previous text via `$getRoot().getTextContent()`, computes a minimal diff, and applies it to the block manager.

2. **UserTypingPlugin** registers an update listener. It reads the full text via `$getRoot().getTextContent()`, compares it against the block manager's base text, and updates the trailing user block.

3. **UndoRedoBlockSyncPlugin** registers an update listener. It reads current/previous text via `$getRoot().getTextContent()` to detect text changes and capture block snapshots for undo/redo.

All three plugins independently call `$getRoot().getTextContent()` which returns the full document text. Lexical joins ParagraphNode children with `\n\n` as the separator. This `\n\n` separator is an implicit contract — the plugins and tests depend on it, but nothing in the code makes it explicit. If Lexical changes this behavior, all three plugins would silently break.

The block manager itself (`editorBlockManager.ts`) is separator-agnostic — it stores raw text strings including any `\n\n` sequences. The separator dependency lives in the plugins that read from Lexical and feed text into the block manager.
