# EDITOR: Undo/redo integration with block manager modified flag

## Summary

When a user edits a Soniox block (marking it `modified: true` via `applyEdit`), then presses Ctrl+Z, the Lexical editor state reverts but the block manager's `modified: true` flag remains set. The block manager does not participate in Lexical's undo/redo system — it is a separate data structure.

This is currently safe behavior (conservative — a block stays marked as user-modified even after undo), but it can lead to unnecessary block fragmentation over time since the system treats unmodified-but-flagged blocks as user-owned.

Discovered during T14 (Inline Editing) code review.

## Acceptance criteria

- Block manager `modified` flag is synchronized with Lexical undo/redo operations
- When a user edits a block and then undoes the edit, the block's `modified` flag reverts to `false` (if it was `false` before the edit)
- When a user redoes the edit, the flag returns to `true`
- Existing block manager tests are updated to cover undo/redo scenarios
- No regression in inline editing or token commit behavior

## References

- Block manager `applyEdit` method — sets `modified: true` as a one-way flag
- Lexical undo/redo history plugin
- Discovered during T14 (Inline Editing) implementation
