**Verdict**

`Needs Fixes`

**Progress**

- Done — Step 1: Extended `EditorBlockManager` with `getDocumentLength()`, offset lookup, and `applyEdit()`.
- Partially done — Step 2: Added block-manager tests, but the cross-block deletion test explicitly tolerates an invalid empty-block state instead of asserting normalized block structure.
- Partially done — Step 3: Added cursor preservation logic to `TokenCommitPlugin`, but the end-of-document detection does not fully satisfy the plan/spec for selections.
- Partially done — Step 4: Added `InlineEditPlugin` and diff routing, but its offset model is only correct for a single paragraph and the editor still allows multi-paragraph input.
- Done — Step 5: Registered `InlineEditPlugin` in the editor.
- Partially done — Step 6: Added `findTextDiff` tests, but no integration coverage for paragraph/newline behavior or selection-preservation edge cases.
- Done — Step 7: Applied the planned spec updates.

**Issues**

1. Major — The inline-edit offset model breaks as soon as the editor has more than one paragraph. [InlineEditPlugin.tsx#L18](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/src/renderer/overlay/editor/InlineEditPlugin.tsx#L18), [editorBlockManager.ts#L46](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/src/renderer/overlay/editor/editorBlockManager.ts#L46), [Editor.tsx#L39](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/src/renderer/overlay/editor/Editor.tsx#L39). `InlineEditPlugin` diffs against `$getRoot().getTextContent()`, which includes `\n` between paragraphs, while `EditorBlockManager` concatenates block text without separators. Nothing in `Editor.tsx` disables Enter or otherwise enforces a single paragraph, so a normal newline will desync offsets and cause edits to be applied to the wrong block(s). Fix by either enforcing single-paragraph editing in Lexical, or by teaching the block manager to model paragraph breaks exactly the same way as Lexical and adding tests for newline edits.

2. Major — Selection preservation is incomplete and can fail for non-collapsed or backward selections. [TokenCommitPlugin.tsx#L47](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/src/renderer/overlay/editor/TokenCommitPlugin.tsx#L47), [TokenCommitPlugin.tsx#L83](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/src/renderer/overlay/editor/TokenCommitPlugin.tsx#L83). The plan explicitly scoped “at end” to a collapsed caret, but the implementation treats any range selection whose `anchor` happens to be on the last text node at its end as `cursorAtEnd`. A backward selection ending at the tail therefore skips restore and can be disturbed by incoming tokens. It also misses valid end-of-document carets represented on the paragraph element rather than the last text node. Fix by requiring `prevSelection.isCollapsed()` for the tracking path, restoring all non-collapsed selections, and broadening tail detection to handle both text-node-end and paragraph-end caret positions.

3. Minor — `applyEdit()` leaves zero-length blocks behind, and the test suite currently blesses that malformed state. [editorBlockManager.ts#L81](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/src/renderer/overlay/editor/editorBlockManager.ts#L81), [editorBlockManager.test.ts#L258](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/src/renderer/overlay/editor/editorBlockManager.test.ts#L258), [spec/models.md#L51](C:/code/draftable/stex/.mound/worktrees/worker-11-e629c669/spec/models.md#L51). Deleting an entire block empties its text but never removes that first affected block, so invisible zero-length blocks can accumulate between real blocks. That violates the “concise, well-formed domain model” the spec describes, and the current test even says the block can be “empty or removed,” so it would not catch the bug. Fix by pruning empty affected blocks after edits and tightening the tests to assert the exact remaining block list.