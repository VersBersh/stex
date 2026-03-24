# Investigation Findings

## Rescue branch: `rescued/dirty-main-20260324T010546`

### What was rescued

A single file: `spec/proposal-context-refresh.md`, staged (`AA`) in the main worktree. The rescued version contains **merge conflict markers** (`<<<<<<< HEAD`, `||||||| b5c68ae`, `=======`, `>>>>>>> stex-1`), indicating an interrupted merge between `HEAD` and the `stex-1` branch.

### Cause

**Interrupted merge/rebase operation** in the main worktree. A merge involving `stex-1` conflicted on `spec/proposal-context-refresh.md`. The conflicted file was staged but never resolved. This happened at least twice — there are two rescue commits for the same file (`f7fbf8f` and `cd98c1b`).

This is NOT a rogue worker writing to the wrong worktree. The conflict markers and `stex-1` branch reference point to a manual or automated merge operation that was interrupted or abandoned in the main worktree.

### Recovery

**No recovery needed.** The clean version of `spec/proposal-context-refresh.md` already exists on `main` (originally added in commits `b831677` and `06f186e`). The rescued version is just a broken merge artifact with conflict markers — it contains no new content.

### Other files in the diff

The diff between `HEAD` and the rescue branch also shows task artifacts (`.mound/tasks/125/*`, `.mound/tasks/126/7-struggles.md`, `.mound/tasks/135/description.md`, `.mound/tasks/136/description.md`) and the `finalize_on_end` fix in soniox files. These are **not dirty files** — they are commits that were merged to main *after* the rescue branch diverged. The rescue branch was created from `49adf5b` (before tasks 125, 126, 135, 136 were merged).
