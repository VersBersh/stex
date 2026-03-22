# Struggles

## 1. Missing context — dual preload confusion

**Category**: missing-context

**What happened**: The codebase has two separate preload scripts (`src/preload/index.ts` → `window.api` and `src/main/preload.ts` → `window.electronAPI`). The overlay renderer uses both APIs. It wasn't immediately clear which preload is loaded for the overlay window, making it hard to reason about whether the error action buttons would work end-to-end.

**What would have helped**: A brief note in the spec or architecture doc explaining the two preload scripts and which windows use which.

## 2. Test regression from clearError side effect

**Category**: orientation

**What happened**: Adding `clearError()` before `startSession()` in `requestToggle()` caused 2 pre-existing tests in `session-reconnect.test.ts` to fail because they checked `errorCalls[0]` (the first SESSION_ERROR call), which was now the null clear instead of the actual error. The fix was straightforward (filter out null), but it took a moment to trace.

**What would have helped**: Tests that are resilient to preceding IPC calls — e.g., checking "the last non-null error" rather than "the first error call". Or a dedicated `SESSION_CLEAR_ERROR` channel instead of overloading `SESSION_ERROR` with null.
