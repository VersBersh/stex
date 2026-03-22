# Context: Undo/Redo Integration with Block Manager Modified Flag

## Relevant Files

| File | Role |
|------|------|
| `src/renderer/overlay/editor/editorBlockManager.ts` | Core block manager — maintains ordered list of `EditorBlock`s, provides `applyEdit()` which sets `modified: true` on soniox blocks |
| `src/renderer/overlay/editor/editorBlockManager.test.ts` | Unit tests for block manager — covers `applyEdit`, `commitFinalTokens`, `replaceLastUserBlock`, cross-block edits |
| `src/renderer/overlay/editor/InlineEditPlugin.tsx` | Lexical update listener that diffs text changes and calls `blockManager.applyEdit()` for user-initiated mid-document edits |
| `src/renderer/overlay/editor/TokenCommitPlugin.tsx` | Handles incoming Soniox tokens — appends to editor with `'historic'` tag (bypassing undo), commits to block manager, and clears undo/redo stacks after each commit |
| `src/renderer/overlay/editor/UserTypingPlugin.tsx` | Handles tail-typing — calls `blockManager.replaceLastUserBlock()` for text typed at document end |
| `src/renderer/overlay/editor/Editor.tsx` | Top-level component — creates `historyState` and `blockManager`, wires up `HistoryPlugin`, `TokenCommitPlugin`, `InlineEditPlugin`, `UserTypingPlugin` |
| `src/shared/types.ts` | Defines `EditorBlock` interface with `id`, `text`, `source`, `modified` fields |
| `spec/models.md` | Spec for data models including `EditorBlock` ownership rules and undo/redo scope |
| `spec/features/inline-editing.md` | Spec for inline editing — describes how user edits mark blocks as `modified: true` |
| `spec/features/inline-typing.md` | Spec for inline typing — block boundary rules for user-typed text at document tail |

## Architecture

### Block Manager

The `EditorBlockManager` is a separate data structure (not part of Lexical's state) that tracks an ordered list of `EditorBlock`s representing the document. Each block has:
- `source: "soniox" | "user"` — who produced the text
- `modified: boolean` — whether a user has edited a soniox block (prevents future token overwrites)

The block manager has three mutation paths:
1. **`commitFinalTokens()`** — called by `TokenCommitPlugin` when Soniox tokens arrive; extends or creates soniox blocks
2. **`replaceLastUserBlock()`** — called by `UserTypingPlugin` for tail-typing
3. **`applyEdit()`** — called by `InlineEditPlugin` for mid-document user edits; sets `modified: true` on affected soniox blocks

### Lexical Undo/Redo

Lexical's `HistoryPlugin` uses an external `HistoryState` object with `undoStack`, `redoStack`, and `current`. The history state is created in `Editor.tsx` and shared with `TokenCommitPlugin`.

Key behaviors:
- Token commits use `{ tag: 'historic' }` which bypasses the undo stack
- After each token commit, `TokenCommitPlugin` clears both stacks and resets `current` to the post-commit state
- Only user edits (typing, deleting, pasting) are recorded in the undo stack
- `Ctrl+Z` / `Ctrl+Y` restore previous/next Lexical `EditorState` snapshots

### The Problem

When a user edits a soniox block (via `InlineEditPlugin` → `applyEdit()`), the block is marked `modified: true`. If the user then presses `Ctrl+Z`, Lexical reverts the editor text to the previous state, but the block manager's `modified` flag remains `true` because:
1. The block manager is a separate data structure that doesn't participate in Lexical's state snapshots
2. The `InlineEditPlugin` fires on the undo-restored state and computes a reverse diff, calling `applyEdit()` again — but `applyEdit()` only ever sets `modified: true`, never back to `false`

This is safe (conservative) but causes unnecessary block fragmentation: blocks stay marked as user-owned even after undo, preventing them from being merged with new soniox tokens.

### Key Constraint

The block manager cannot simply be made part of the Lexical state (e.g., as a custom node) because blocks don't map 1:1 to Lexical nodes — they are tracked by character offset ranges within the plain text document.
