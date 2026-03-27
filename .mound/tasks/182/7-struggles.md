# Struggles

- **Category:** description-quality
  - **What happened:** The task was created with an empty source files list and an empty `discovered-files.txt`, meaning there was nothing to triage. The entire task was a no-op.
  - **What would have helped:** The system that creates discovery-triage batch tasks should check whether there are any discovered-tasks files to process before creating the triage task. A precondition check would avoid wasting a worker slot on an empty batch.
