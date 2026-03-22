# Dirty Main Worktree Rescue

## Rescue details
- Rescue branch: `rescued/dirty-main-20260322T074211`
- Timestamp: 2026-03-22T07:42:12Z

## Affected files
?? .mound/tasks/52/7-struggles.md

## Diagnostic instructions
1. Inspect the rescue branch. Use the commit hash instead of the branch name if slashes cause issues on Windows:
   - `git log rescued/dirty-main-20260322T074211 --oneline -5`
   - `git diff HEAD..rescued/dirty-main-20260322T074211`
2. Check which task the affected files belong to (look at the `.mound/tasks/<id>/` path prefix in the affected files above).
3. Check whether that task's work has already been completed via a remediation task or re-implementation.

## Resolution
Determine the source of the dirty state (rogue agent writing to main worktree instead of its own worktree, interrupted operation, external tool). If the rescued files contain work not yet merged through another path, recover them. Otherwise, note the files as redundant.

**Artifacts:** Write all task artifacts (struggles, notes) to this task's own directory, not the original task's directory.
