# Discovered Tasks

## 1. EDITOR: Integration tests for multi-paragraph editing with Lexical

Full integration test with Lexical editor + InlineEditPlugin + UserTypingPlugin running together in JSDOM, verifying paragraph splits, joins, and token commits maintain offset consistency across paragraph boundaries. Should test both listener execution orders.

**Why discovered**: Unit tests cover block manager logic but can't verify the full pipeline (Lexical → diff → block manager) with real paragraph splits. The design review flagged the lack of integration coverage as a gap.

## 2. EDITOR: Centralize Lexical text serialization contract

Both InlineEditPlugin and UserTypingPlugin call `$getRoot().getTextContent()` independently and depend on Lexical's paragraph separator behavior (`\n\n`). Consider extracting a shared helper that codifies the contract and makes the separator dependency explicit, so a Lexical upgrade that changes the separator would be caught at one point.

**Why discovered**: The design review flagged that the paragraph-boundary contract is implicit library coupling rather than an explicit code-level abstraction. Both plugins depend on the same Lexical behavior but there's no shared constant or helper that makes this visible.
