# Struggles

## 1. Test isolation: dangling async operations corrupting module state

- **Category**: `missing-context`
- **What happened**: The `resumeSession with context refresh` tests in `session.test.ts` leave dangling `resumeSession()` async operations with real 1000ms timeouts (`RESUME_ANALYSIS_TIMEOUT_MS`). When these timeouts fire during subsequent tests, they execute the resume flow against the current module state, corrupting `status`, `resumeInProgress`, and other module-level variables. This caused multiple replay flow tests to fail non-deterministically (passing in isolation, failing when run with the full suite). Took significant debugging to identify the root cause since the corruption was indirect (a timeout in one test firing during another test's `await` point).
- **What would have helped**: A note in the task description or context file about the existing test isolation issue with `resumeSession` tests. Alternatively, the existing test suite could have been written with cleanup patterns (e.g., always responding to pending `getResumeAnalysis()` calls). A shared `afterEach` in the `resumeSession with context refresh` describe that responds to any pending analysis would have prevented this class of issue.

## 2. Inter-test state through shared module-level variables

- **Category**: `orientation`
- **What happened**: `session.ts` uses many module-level variables (`status`, `resumeInProgress`, `activeTransition`, `currentFinalizationResolver`) that are shared across all tests via the same module instance. Understanding which variables are reset by `initSessionManager()` vs `resetLifecycle()` vs `createLifecycleCallbacks()` callbacks required reading multiple files carefully.
- **What would have helped**: A clearer mental model of which module-level variables are "session-scoped" vs "lifecycle-scoped" vs "connection-scoped". The existing code comments help but don't fully capture the reset semantics.
