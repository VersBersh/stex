# SPEC: Add missing SessionState values to models.md

## Summary
`spec/models.md` does not include `disconnected` or `reconnecting` in the `SessionState` status union, but `src/shared/types.ts` defines them. These values were added by the reconnection feature but the spec was not updated to match.

## Acceptance criteria
- `spec/models.md` `SessionState` union includes `disconnected` and `reconnecting` values
- The descriptions for these values accurately reflect their semantics as implemented in `src/shared/types.ts`
- No other missing `SessionState` values exist between spec and implementation

## References
- `spec/models.md` — the spec file to update
- `src/shared/types.ts` — the authoritative type definitions
- Discovered in task 91
