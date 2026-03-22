# Spec Updates — Task 78

No spec updates required.

This task is a pure internal refactoring of `session.ts`. The public API (`initSessionManager`, `requestToggle`, `requestQuickDismiss`) remains unchanged. No new IPC channels, types, or external contracts are introduced. The extracted modules are internal implementation details that `session.ts` delegates to.

There are no spec files in the repository (the `specs/` directory does not exist).
