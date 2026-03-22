# Context

## Relevant Files

- `src/renderer/overlay/editor/editorBlockManager.ts` — Block manager: maintains ordered list of EditorBlocks, computes offsets, applies edits. Core of the offset model.
- `src/renderer/overlay/editor/editorBlockManager.test.ts` — Tests for block manager (vitest).
- `src/renderer/overlay/editor/InlineEditPlugin.tsx` — Lexical plugin: computes text diff between editor states via `findTextDiff`, calls `blockManager.applyEdit`. Also contains the Enter key intercept.
- `src/renderer/overlay/editor/InlineEditPlugin.test.ts` — Tests for `findTextDiff` (vitest).
- `src/renderer/overlay/editor/UserTypingPlugin.tsx` — Lexical plugin: detects tail typing by comparing `$getRoot().getTextContent()` with `blockManager.getBaseText()`, calls `replaceLastUserBlock`.
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Lexical plugin: receives final Soniox tokens, commits to block manager, appends text to last Lexical paragraph.
- `src/renderer/overlay/editor/Editor.tsx` — Composes all plugins, creates the block manager instance.
- `src/shared/types.ts` — Defines `EditorBlock`, `SonioxToken`, etc.
- `spec/models.md` — Spec for data models including `EditorBlock` ownership rules and mapping to Lexical.
- `spec/features/inline-editing.md` — Spec for inline editing/correction behavior.
- `spec/features/inline-typing.md` — Spec for inline typing during dictation.

## Architecture

The editor subsystem uses Lexical as the rich text editor and maintains a parallel `EditorBlock[]` data structure for ownership tracking (soniox vs user, modified flag).

**Offset model**: The block manager computes character offsets by summing `block.text.length` across blocks (`getBlockOffsets()`). `getDocumentText()` concatenates block text with `.join('')` — no separators. `getDocumentLength()` sums text lengths.

**Text sync**: Lexical's `$getRoot().getTextContent()` is the source of truth for what the user sees. Two plugins bridge Lexical state to block manager state:
- `InlineEditPlugin` computes a minimal text diff between previous and current editor text content, then calls `applyEdit(offset, removedLength, insertedText)` to update the block manager.
- `UserTypingPlugin` detects tail typing by checking if Lexical's full text starts with `getBaseText()`, then calls `replaceLastUserBlock(tailText)`.

**The problem**: Lexical inserts `\n` between `ParagraphNode` children when computing `getTextContent()`. The block manager has no awareness of these separators. Currently the Enter key is intercepted (returning `true` to suppress paragraph splits) to prevent offset drift. This task removes that workaround by making the block manager naturally handle `\n` characters in block text.

**Key constraint**: Both `InlineEditPlugin` and `UserTypingPlugin` fire on every non-historic editor update. They must produce consistent block state. Currently they do because `applyEdit` and `replaceLastUserBlock` converge to the same result for tail typing, and `replaceLastUserBlock` is a no-op for mid-document edits.
