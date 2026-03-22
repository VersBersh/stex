# EDITOR: Multi-paragraph support for block manager

## Summary

The block manager concatenates block text without separators, while Lexical's `$getRoot().getTextContent()` inserts `\n` between paragraphs. Currently this offset drift is prevented by intercepting the Enter key (disallowing multi-paragraph editing). If multi-paragraph editing is needed in the future, the block manager must model paragraph separators.

Discovered during T14 (Inline Editing) code review, which flagged the offset drift risk between `InlineEditPlugin`'s text diff (which sees `\n`) and the block manager (which doesn't). The Enter key intercept was added as a workaround.

## Acceptance criteria

- Block manager models paragraph separators (e.g. `\n`) between blocks or within blocks when appropriate
- `InlineEditPlugin` text diff and block manager offsets remain consistent across paragraph boundaries
- Enter key intercept can be removed (or made optional) without causing offset drift
- Existing tests updated to cover multi-paragraph scenarios
- No regression in single-paragraph editing behavior

## References

- `InlineEditPlugin` — computes text diffs that see `\n` between paragraphs
- Block manager — concatenates block text without separators
- Enter key intercept logic in the editor
- Discovered during T14 (Inline Editing) implementation
