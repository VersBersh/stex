# T50: Struggles

- **Category**: missing-context
  **What happened**: The plan did not anticipate that three other window test files (behavior, positioning, visibility) also import `window.ts` and would fail without a `./theme` mock. This caused a test failure on first verify.
  **What would have helped**: The plan step for tests could have been informed by a dependency scan — listing all test files that import `window.ts` to identify which ones need updated mocks.
