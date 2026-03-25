# Struggles — Task 146

- **Category**: `missing-context`
  **What happened**: Task 145 (`TimestampedTextNode`) is listed as a dependency and is currently `implementing`, but has no plan or implementation artifacts beyond its description. This made it harder to confirm the exact type string (`'timestamped-text'`), the field names (`__startMs`, `__endMs`, `__originalText`), and whether any getter methods would be available. The plan had to use `as any` casts and string-based type checks as a workaround.
  **What would have helped**: If the task dependency graph ensured that a dependent task's plan artifacts (at minimum) were available before the downstream task was created, the plan could reference concrete API surfaces rather than making assumptions.

- **Category**: `orientation`
  **What happened**: The `node_modules` directory lives in the parent repo, not in the worktree. Finding the Lexical type definitions required searching the parent's `node_modules` path, which was not immediately obvious.
  **What would have helped**: A note in the worktree setup about where `node_modules` is resolved from, or symlinks in the worktree.
