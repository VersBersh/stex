# Discovered Tasks — T13

1. **OVERLAY: Session lifecycle block manager reset**
   - Description: When `onShow: "fresh"`, clear the block manager and editor on `session:start`. When `onShow: "append"`, preserve both.
   - Why: The block manager persists across show/hide cycles (overlay is hidden, not destroyed). Without lifecycle wiring, blocks from a previous session would carry over even in "fresh" mode.

2. **EDITOR: User-edit block tracking (modified flag + user blocks)**
   - Description: Register a Lexical update listener to detect user edits within soniox blocks (set `modified: true`) and user typing of new text (create `source: "user"` blocks). Requires understanding Lexical node mutations and mapping character offsets to blocks.
   - Why: The `EditorBlockManager` currently only handles soniox token commits. Full block boundary tracking per `spec/models.md` ownership rules #1, #2, and #4 requires observing user mutations.

3. **EDITOR: Ghost text clearing on final token arrival**
   - Description: When `TokenCommitPlugin` commits final tokens, the ghost text plugin should remove the corresponding non-final text that preceded those finals.
   - Why: The task description mentions ghost text coordination, but this belongs to the ghost text plugin task since ghost text display is not yet implemented.
