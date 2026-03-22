# Implementation Notes

## Files created or modified

| File | Summary |
|------|---------|
| `src/renderer/overlay/editor/editorBlockManager.ts` | Added `getSnapshot()` and `restoreSnapshot()` methods; added `createBlockHistory(blockManager)` factory returning a controller with `captureBeforeEdit`, `handleUndo`, `handleRedo`, `clear` |
| `src/renderer/overlay/editor/UndoRedoBlockSyncPlugin.tsx` | **New file** — Lexical plugin that delegates to `BlockHistory` controller for undo/redo synchronization |
| `src/renderer/overlay/editor/Editor.tsx` | Created `blockHistory` via `useMemo`, wired `UndoRedoBlockSyncPlugin` between `TokenCommitPlugin` and `InlineEditPlugin`, passed `blockHistory` to both |
| `src/renderer/overlay/editor/TokenCommitPlugin.tsx` | Added `blockHistory: BlockHistory` prop; call `blockHistory.clear()` in clear hooks and `onTokensFinal` handler |
| `src/renderer/overlay/editor/editorBlockManager.test.ts` | Added `getSnapshot / restoreSnapshot` and `undo/redo integration (snapshot-based)` test suites (8 new tests) |
| `src/renderer/overlay/editor/UndoRedoBlockSyncPlugin.test.ts` | **New file** — Tests for the `BlockHistory` controller: captureBeforeEdit, handleUndo, handleRedo, clear, multi-cycle (9 tests) |
| `spec/models.md` | Extended "Undo/Redo Scope" section with "Block Manager Synchronization" subsection |
| `spec/features/inline-editing.md` | Added "Undo/Redo of Edits" subsection |
| `spec/features/inline-typing.md` | Added "Undo/Redo of Typed Text" subsection |

## Deviations from plan

- **BlockHistory refactored to controller** (post-review): The plan designed `BlockHistory` as a simple data structure (two raw arrays). During code review, Issue 2 flagged scattered stack manipulation across plugins (SRP violation). Refactored to a controller with `captureBeforeEdit()`, `handleUndo()`, `handleRedo()`, and `clear()` methods. This centralizes the undo/redo protocol in one place, and the tests now exercise the actual controller methods rather than manually simulating stack operations.

- **Plugin no longer takes `blockManager` prop**: With the controller owning the block manager reference, `UndoRedoBlockSyncPlugin` only needs `historyState` and `blockHistory` props.

- **Step 7 (integration test file)**: Tests exercise `BlockHistory` controller methods directly rather than extracting helper functions from the plugin.

- **Step 8 (verify PUSH-vs-MERGE)**: Verified directly against `node_modules/@lexical/history/LexicalHistory.dev.mjs`. Added code comment in plugin.

## Review fixes applied

- **Issue 2 (SRP/encapsulation)**: Encapsulated `BlockHistory` into a controller with focused operations. Raw stack manipulation replaced with method calls in both `UndoRedoBlockSyncPlugin` and `TokenCommitPlugin`.
- **Issue 3 (test design)**: Tests now exercise the actual `BlockHistory` controller methods (`captureBeforeEdit`, `handleUndo`, `handleRedo`, `clear`).
- **Issue 1 (JSX ordering)**: Accepted as documented trade-off — inherent to Lexical plugin architecture, documented with JSX comment in Editor.tsx and docstring in plugin.
- **Issue 4 (file size)**: Accepted — test files commonly exceed 300 lines; tests are logically grouped.

## New tasks or follow-up work

None discovered during implementation.
