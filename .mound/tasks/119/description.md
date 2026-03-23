# Merge Conflict Resolution

## Original task
- Task ID: 115
- Summary: Voice input: cursor should track end of ghost text by default

## Conflict details
- Conflicting commit: 2125b5fb41af36cf48afd4f25ccb148e6bfd8dd6
- Remediation base SHA: ea880021a3c1a285f0ba8f1c32a193ae77c14d41
- Conflict summary: Cherry-pick of 2125b5fb41af36cf48afd4f25ccb148e6bfd8dd6 onto main conflicts at ea880021a3c1a285f0ba8f1c32a193ae77c14d41

## Instructions
Create a branch from `ea880021a3c1a285f0ba8f1c32a193ae77c14d41`, cherry-pick `2125b5fb41af36cf48afd4f25ccb148e6bfd8dd6`, resolve conflicts, and submit the resulting commit through the merge queue.

**Note:** The conflicting commit may depend on intermediate commits not yet on main. If cherry-picking fails because prerequisite changes are missing, examine the commit's parent chain (`git log --oneline 2125b5fb41af36cf48afd4f25ccb148e6bfd8dd6`) to identify and cherry-pick prerequisite commits first.

**Artifacts:** Write all task artifacts (struggles, notes) to this task's own directory, not the original task's directory.
