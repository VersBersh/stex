# Struggles

- **Category:** description-quality
  **What happened:** The task was created with an empty source files list and an empty discovered-files.txt, so there was nothing to triage. The task was a no-op.
  **What would have helped:** The triage task creation pipeline should validate that at least one discovered-tasks file exists before creating a triage task. This would avoid unnecessary worker allocation for empty batches.
