# Investigation Findings

## Cause: Unresolved merge conflict in main worktree

A merge operation in the main worktree attempted to combine the `stex-1` branch with main. Both branches independently added `spec/proposal-context-refresh.md`:

- **main**: commit `06f186e` ("context refresh proposal")
- **stex-1**: commit `b831677` ("proposal: context refresh on user edit")

Both branch from `b5c68ae`. The merge produced a conflict (both sides added the same file), and the conflict was left unresolved. The dirty working tree was then rescued to `rescued/dirty-main-20260324T010519`.

## Affected file

- `spec/proposal-context-refresh.md` — contained merge conflict markers (`<<<<<<< HEAD`, `>>>>>>> stex-1`)

## Source

This was likely caused by an **external operation** (manual merge or rebase attempt) in the main worktree, not by a mound worker writing to the wrong worktree. The conflict markers reference the `stex-1` branch, which is the user's manual work branch.

## Recovery

**No recovery needed.** The clean version of `spec/proposal-context-refresh.md` already exists on main (commit `06f186e`). The rescued version contains only broken merge conflict markers and is redundant.

## Additional notes

- The rescue branch diff also shows soniox changes (`finalize_on_end: true` removed), but these are simply because the rescue branch is based on an older commit (`205b68b`) that predates the fix (`1ad5fd1`). These are not intentional changes.
- Task 136 is a sibling remediation task for a nearly identical dirty worktree rescue (same affected file, 27 seconds later). Both captured the same underlying issue.
