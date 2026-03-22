# SESSION: Use WebSocket close code in classifyDisconnect instead of reason text only

## Summary
The `classifyDisconnect(code, reason)` function accepts a `code` parameter but only uses the `reason` string for classification. This creates fragile semantic coupling to provider-specific reason strings that may change without notice.

The function should classify based on the WebSocket close code (which has standardized semantics per RFC 6455) as the primary signal, falling back to reason text only when the code is ambiguous.

## Acceptance criteria
- `classifyDisconnect` uses the `code` parameter as the primary classification signal
- Standard WebSocket close codes (1000, 1001, 1006, 1008, 1011, etc.) are mapped to appropriate disconnect categories
- Reason text is used as a secondary/fallback signal when the close code alone is insufficient
- Existing tests are updated to verify code-based classification
- No regression in disconnect handling behavior for known scenarios

## References
- Source: `.mound/tasks/68/6-discovered-tasks.md` item 2
- Parent task: task 68 (SESSION: Decompose session.ts into focused modules)
- File containing `classifyDisconnect`: extracted in task 68 (likely `src/main/error-classification.ts` or similar)
