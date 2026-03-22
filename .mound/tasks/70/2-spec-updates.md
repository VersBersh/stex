# Spec Updates: Undo/Redo Integration with Block Manager Modified Flag

## Spec changes required

### 1. `spec/models.md` — EditorBlock Undo/Redo Scope section

**What needs to change:** The existing "Undo/Redo Scope" section (lines 61–63) currently says:

> Only user edits (typing, deleting, pasting) are part of the Lexical undo history. Programmatic appends of transcribed text are **not** undoable — `Ctrl+Z` never removes transcription output.

This needs to be extended to document how the full block manager state participates in undo/redo.

**Proposed new content for the section:**

```markdown
### Undo/Redo Scope

Only user edits (typing, deleting, pasting) are part of the Lexical undo history. Programmatic appends of transcribed text are **not** undoable — `Ctrl+Z` never removes transcription output.

#### Block Manager Synchronization

The block manager's full state (block text, structure, and `modified` flags) must be kept in sync with Lexical's undo/redo operations:

- Before each user edit is applied to the block manager, a snapshot of the entire `EditorBlock[]` array is captured and stored in a parallel undo stack.
- When the user undoes an edit (`Ctrl+Z`), the block manager restores the full block state from the corresponding snapshot.
- When the user redoes an edit (`Ctrl+Y`), the block manager restores the post-edit block state.
- Parallel stacks are cleared when transcription tokens are committed (since the Lexical undo/redo stacks are also cleared at that point).

This ensures that undoing an edit reverts both the block text and the `modified` flag to their pre-edit values, keeping the block manager aligned with the editor state and preventing unnecessary block fragmentation.
```

**Why:** The current spec doesn't address the interaction between block manager state and Lexical undo/redo. Without synchronization, the block manager's text and flags diverge from the editor on undo, leading to incorrect block merging and fragmentation.

### 2. `spec/features/inline-editing.md` — Add note about undo/redo behavior

**What needs to change:** Add a new subsection after "### Editing Committed Text".

**Proposed addition:**

```markdown
### Undo/Redo of Edits

- Undoing an edit to committed text reverts the block manager to its pre-edit state: block text, `modified` flags, and block structure are all restored
- If a block was `modified: false` before the user edit, undoing restores it to `modified: false`
- If blocks were split, merged, or removed by a cross-block edit, undo restores the original block structure
- Redoing re-applies the edit and restores the post-edit block state
```

**Why:** The inline-editing spec describes how edits mark blocks as `modified: true` but does not describe what happens when those edits are undone. The full block state (not just the flag) must be addressed since block text and structure also change during edits.

### 3. `spec/features/inline-typing.md` — Add undo/redo note for tail-typed user blocks

**What needs to change:** Add a brief undo/redo note after the "Block Boundary Rules" section.

**Proposed addition:**

```markdown
### Undo/Redo of Typed Text

- When the user types at the document tail (creating or extending a user block) and then undoes, the block manager restores the pre-typing block state — including removing or reverting the trailing user block
- Redo restores the user block as it was after typing
- This is handled by the same block-state snapshot mechanism described in [models — Block Manager Synchronization](../models.md#block-manager-synchronization)
```

**Why:** The inline-typing spec describes how user-typed text creates user blocks at the tail, but doesn't describe what happens when that typing is undone. Since `UserTypingPlugin` skips `'historic'`-tagged updates (undo/redo), the block manager must be explicitly restored via snapshots.

## New spec content

No new spec files are needed. The changes above extend existing spec sections.
