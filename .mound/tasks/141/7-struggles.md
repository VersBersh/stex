# Struggles

- **Category:** description-quality
- **What happened:** The triage task was created with an empty source files list and an empty `discovered-files.txt`. There were no discovered-tasks files to triage, making this a no-op.
- **What would have helped:** The orchestrator should skip creating a discovery-triage task when there are no discovered-tasks files to process. A pre-check before task creation would avoid unnecessary work.
