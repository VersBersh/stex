- **Category:** missing-context
  **What happened:** The task 139 commit added mocks/assertions for `registerMicTestIpc` in `first-run.test.ts`, but the implementation (task 133's `mic-test.ts` module and the `registerMicTestIpc` call in `index.ts`) was not present at the base SHA. Task 139 assumed task 133 was already merged, creating a dependency gap.
  **What would have helped:** The merge queue should detect and enforce ordering when a fix commit depends on another task's implementation commit that hasn't been merged yet.
