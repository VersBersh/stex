# T14: Discovered Tasks

## 1. EDITOR: Undo/redo integration with modified blocks

When a user edits a soniox block (marking it `modified: true`) then presses Ctrl+Z, the block remains marked modified in the block manager even though the text reverted. The block manager does not participate in Lexical's undo system.

**Why discovered:** The `applyEdit` method sets `modified: true` as a one-way flag. Undo reverses the Lexical editor state but the block manager is a separate data structure. This is safe behavior (conservative) but could lead to unnecessary block fragmentation over time.

## 2. EDITOR: Multi-paragraph support for block manager

The block manager concatenates block text without separators, while Lexical's `$getRoot().getTextContent()` inserts `\n` between paragraphs. Currently enforced as single-paragraph by intercepting Enter key. If multi-paragraph editing is needed, the block manager must model paragraph separators.

**Why discovered:** Code review flagged the offset drift risk between `InlineEditPlugin`'s text diff (which sees `\n`) and the block manager (which doesn't). The Enter key intercept was added as a fix, but it's a constraint that may need to be lifted.
