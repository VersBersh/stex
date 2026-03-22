# EDITOR: Integration tests for multi-paragraph editing with Lexical

## Summary
Add full integration tests that run Lexical editor + InlineEditPlugin + UserTypingPlugin together in JSDOM, verifying that paragraph splits, joins, and token commits maintain offset consistency across paragraph boundaries. The tests should cover both listener execution orders.

Unit tests (from task 71) cover block manager logic in isolation but cannot verify the full pipeline (Lexical -> diff -> block manager) with real paragraph splits. The design review flagged the lack of integration coverage as a gap.

## Acceptance criteria
- Integration test suite runs Lexical + InlineEditPlugin + UserTypingPlugin together in JSDOM
- Tests verify paragraph split operations maintain correct offsets across paragraph boundaries
- Tests verify paragraph join operations maintain correct offsets
- Tests verify token commits are consistent after paragraph boundary changes
- Both listener execution orders are exercised
- Tests pass in CI

## References
- Discovered during task 71 (EDITOR: Multi-paragraph support for block manager)
- .mound/tasks/71/6-discovered-tasks.md (item 1)
