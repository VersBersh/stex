# EDITOR: Centralize Lexical text serialization contract

## Summary
Both InlineEditPlugin and UserTypingPlugin independently call `$getRoot().getTextContent()` and depend on Lexical's paragraph separator behavior (`\n\n`). Extract a shared helper that codifies this contract and makes the separator dependency explicit, so a Lexical upgrade that changes the separator would be caught at one point rather than silently breaking both plugins.

The design review flagged that the paragraph-boundary contract is implicit library coupling rather than an explicit code-level abstraction.

## Acceptance criteria
- A shared helper/constant exists that encapsulates the `$getRoot().getTextContent()` call and the `\n\n` paragraph separator contract
- Both InlineEditPlugin and UserTypingPlugin use the shared helper instead of calling `$getRoot().getTextContent()` directly
- If Lexical changes its separator behavior, only one location needs updating
- Existing tests continue to pass

## References
- Discovered during task 71 (EDITOR: Multi-paragraph support for block manager)
- .mound/tasks/71/6-discovered-tasks.md (item 2)
