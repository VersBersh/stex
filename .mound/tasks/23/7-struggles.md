# T23 Struggles

- **Category:** description-quality
- **What happened:** The task described an integration that was already fully implemented by the time this task was created. T20 added `resolveSonioxApiKey` and T3 (which ran after T20) already integrated it into `getSettings()` with complete test coverage. The task was essentially a no-op.
- **What would have helped:** When creating discovered tasks from a completed task's output, check whether the integration was already done by the target task (T3 in this case). A dependency check during task creation could flag "already implemented" scenarios and mark the task as pre-completed or skip it.
