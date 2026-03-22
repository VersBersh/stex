# Struggles — Task 73

## 1. Draft publish workflow broken by untracked files
- **Category:** tooling
- **What happened:** `mound create-task --draft` leaves untracked description files in the main worktree. When `mound publish-tasks` tries to merge, it fails because untracked files block the merge. Removing the files causes publish to fail with "description file not found on disk" — a catch-22.
- **What would have helped:** `mound create-task --draft` should either (a) not leave untracked files in the main worktree, or (b) `mound publish-tasks` should handle the conflict by removing untracked files before merging since it knows the incoming commit contains them.

## 2. Orphaned draft tasks from failed workflow
- **Category:** tooling
- **What happened:** Failed draft publish attempts left orphaned task records (IDs 74-77) in taskdb with status "open" but no description files and `published: false`. These cannot be cleaned up or reused.
- **What would have helped:** A `taskdb delete` or `mound delete-task` command for cleaning up failed drafts, or the draft workflow should be transactional (rollback DB entry if publish fails).
