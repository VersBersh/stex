# SESSION: Continue decomposition — extract IPC wiring and Soniox lifecycle from session.ts

## Summary
After task 68 extracted reconnect policy and error classification, `session.ts` is still ~389 lines with multiple concerns: IPC registration, Soniox lifecycle management, session state transitions, clipboard behavior, and overlay/window control. The design reviewer flagged it as still violating Single Responsibility.

This task continues the decomposition by extracting at least the IPC wiring and Soniox lifecycle concerns into their own focused modules, reducing `session.ts` to a thin orchestration layer.

## Acceptance criteria
- IPC handler registration is extracted from `session.ts` into a dedicated module
- Soniox client lifecycle (connect/disconnect/stream) is extracted from `session.ts` into a dedicated module
- `session.ts` delegates to the extracted modules and contains only orchestration/state-transition logic
- All existing tests pass without modification (or are updated to match new module boundaries)
- `session.ts` line count is significantly reduced from ~389 lines

## References
- Source: `.mound/tasks/68/6-discovered-tasks.md` item 1
- Parent task: task 68 (SESSION: Decompose session.ts into focused modules)
- File: `src/main/session.ts`
