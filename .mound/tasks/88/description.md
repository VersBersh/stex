# SESSION: Extract renderer communication helpers from session.ts

## Summary
Extract `sendToRenderer`, `sendStatus`, and `sendError` into a dedicated renderer communication module. These functions are used across session.ts and are passed as callbacks to soniox-lifecycle. A dedicated module would make the communication boundary between main process and renderer explicit.

Discovered during task 78 implementation when the lifecycle callbacks bridge between soniox-lifecycle events and renderer messaging.

## Acceptance criteria
- `sendToRenderer`, `sendStatus`, `sendError` are extracted to a dedicated renderer communication module
- session.ts and soniox-lifecycle import from the new module
- No behavioral changes — renderer communication works identically
- Existing tests continue to pass

## References
- Discovered during task 78 (SESSION: Extract IPC wiring and Soniox lifecycle from session.ts)
- .mound/tasks/78/6-discovered-tasks.md (item 2)
- Related: task 68 (SESSION: Decompose session.ts into focused modules)
