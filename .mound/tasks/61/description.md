# EDITOR: Ghost text clearing on final token arrival

## Summary
When `TokenCommitPlugin` commits final tokens, the ghost text plugin should remove the corresponding non-final (ghost) text that preceded those finals. This coordination ensures that ghost text is properly cleaned up as final tokens replace the speculative non-final text.

Currently the ghost text plugin (T12) renders non-final tokens, and TokenCommitPlugin (T13) commits final tokens, but the handoff — removing ghost text when its corresponding final tokens arrive — may not be wired up.

## Acceptance criteria
- When final tokens are committed by `TokenCommitPlugin`, any ghost text nodes corresponding to those tokens are removed from the Lexical editor
- No ghost text remains visible after its final tokens have been committed
- The transition from ghost text to committed text is visually seamless (no flicker or duplicate text)
- Tests cover the ghost-text-to-final-token handoff

## References
- Discovered during task T13 (Token Commit & EditorBlock Management)
- Related to T12/T55 (Ghost Text Plugin)
- `spec/models.md` — token lifecycle (non-final → final)
