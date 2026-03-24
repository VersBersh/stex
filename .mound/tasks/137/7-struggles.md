# Struggles

## 1. Empty source files list
- **Category:** description-quality
- **What happened:** The triage task was created with an empty "Source Files" section and an empty `discovered-files.txt`. There were no discovered-tasks files to triage, making this an empty batch. Two completed tasks (128, 138) had `discoveries_triaged: false` but neither had `6-discovered-tasks.md` files — they simply had no discoveries to report.
- **What would have helped:** The orchestrator should skip creating a discovery-triage task when there are no discovered-tasks files to process, or the task description should explicitly state "no files to triage" so the agent can short-circuit immediately.
