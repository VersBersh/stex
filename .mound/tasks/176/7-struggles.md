# Struggles

- **Category**: `description-quality`
- **What happened**: The failing test (`prevents re-entrant resume`) is unrelated to the commit's code change (type narrowing in `replayGhostConversion.ts`). The test failure appears to be flaky — it passes consistently in both isolation and full suite runs after cherry-picking the same commit. The original failure was likely due to test ordering/timing in the merge queue environment.
- **What would have helped**: Including the full test output (stdout/stderr) in the task description rather than just the JUnit XML path would have made it easier to diagnose whether this was a genuine regression or a flaky test.
