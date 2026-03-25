# Struggles — Task 146

- **Category**: `tooling`
  **What happened**: Running `codex exec` for code reviews as background Bash tasks corrupted the git worktree. The codex process switched the main repo to the `main` branch, which caused all uncommitted changes in the working directory to be lost. The worktree's `.git` link file was also removed.
  **What would have helped**: Either (a) the codex review should run in a read-only mode that cannot modify git state, (b) the review should be run in a separate isolated worktree, or (c) changes should be committed before running external tools that might modify git state.

- **Category**: `orientation`
  **What happened**: The working directory path (`C:\code\draftable\stex\.mound\worktrees\worker-2-7d087987`) appeared to be a git worktree but was actually just a directory inside the main repo. Source files lived in the main repo root, not in this directory, and git commands operated against the main repo. This was not obvious from the task setup.
  **What would have helped**: Clear documentation that the source files are in the main repo root, not in the worktree-named directory.
