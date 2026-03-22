# Implementation Notes — T13: Token Commit & EditorBlock Management

## Files Created

- `src/renderer/overlay/editor/editorBlockManager.ts` — Pure logic module for managing `EditorBlock[]`. Factory function with instance-scoped ID counter. Returns `ReadonlyArray<Readonly<EditorBlock>>` from `getBlocks()` for encapsulation.
- `src/renderer/overlay/editor/TokenCommitPlugin.tsx` — Lexical plugin that listens for `tokens:final` IPC events, appends text to editor (bypassing undo via `'historic'` tag + `discrete: true`), clears stale undo/redo stacks, updates block manager. Also registers a clear hook to keep blocks in sync.
- `src/renderer/overlay/editor/editorBlockManager.test.ts` — 14 unit tests for the block manager.

## Files Modified

- `src/renderer/overlay/editor/Editor.tsx` — Added `createEmptyHistoryState`, `TokenCommitPlugin`, `createEditorBlockManager`. Created shared `historyState` and `blockManager` via `useMemo`. Passed `externalHistoryState` to `HistoryPlugin`. Added `TokenCommitPlugin`.
- `src/renderer/overlay/OverlayContext.tsx` — Added `registerClearHook` to `OverlayContextValue` interface and provider. Clear hooks are invoked whenever `clearEditor()` runs, allowing plugins to synchronize their state with editor clears.

## Deviations from Plan

- **Added `registerClearHook` to OverlayContext**: Not in the original plan. Added to address code review feedback about block manager divergence when the editor is cleared. This is a minimal, generic hook pattern that keeps OverlayContext unaware of the block manager specifically.
- **Clear undo/redo stacks on token commit**: Added `historyState.undoStack.length = 0` and `historyState.redoStack.length = 0` before setting `historyState.current`. Addresses review feedback that stale undo/redo entries could restore pre-transcription states.
- **Instance-scoped ID counter**: Moved `nextBlockId` inside the factory function. Removed `_resetIdCounter` from the API. Each manager instance now has its own independent counter.
- **Readonly return type**: `getBlocks()` returns `ReadonlyArray<Readonly<EditorBlock>>` for encapsulation.

## New Tasks / Follow-Up Work

1. **Session lifecycle block manager reset**: When `onShow: "fresh"`, the block manager should be cleared on session start. Requires listening to `session:start` IPC in the renderer. Belongs to the session lifecycle renderer task.

2. **User-edit block tracking**: The block manager only tracks soniox blocks. Marking blocks as `modified` on user edit, and creating `source: "user"` blocks on typing, belongs to inline-typing and inline-editing feature tasks.

3. **Ghost text clearing on final token arrival**: The ghost text plugin (future task) needs to clear ghost text when final tokens arrive.
