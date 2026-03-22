# Merge Conflict Resolution

## Original task
- Task ID: 85
- Summary: EDITOR: Integration tests for multi-paragraph editing with Lexical

## Conflict details
- Conflicting commit: c61566916608496fff8bb7d056726a2038d78357
- Remediation base SHA: c87a7a3cd6595e0c5ef77582bda625404cf3ffaf
- Conflict summary: Cherry-pick of c61566916608496fff8bb7d056726a2038d78357 onto main conflicts at c87a7a3cd6595e0c5ef77582bda625404cf3ffaf

## Instructions
Create a branch from `c87a7a3cd6595e0c5ef77582bda625404cf3ffaf`, cherry-pick `c61566916608496fff8bb7d056726a2038d78357`, resolve conflicts, and submit the resulting commit through the merge queue.

**Note:** The conflicting commit may depend on intermediate commits not yet on main. If cherry-picking fails because prerequisite changes are missing, examine the commit's parent chain (`git log --oneline c61566916608496fff8bb7d056726a2038d78357`) to identify and cherry-pick prerequisite commits first.

**Artifacts:** Write all task artifacts (struggles, notes) to this task's own directory, not the original task's directory.
