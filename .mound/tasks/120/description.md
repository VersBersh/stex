# Merge Conflict Resolution

## Original task
- Task ID: 117
- Summary: Investigate Soniox API support for providing prior context to improve transcription

## Conflict details
- Conflicting commit: 7b31f653523655e1b813a2d526e360688e3b9f71
- Remediation base SHA: e73f8222731b114da82f8080d467cd6948f266b0
- Conflict summary: Cherry-pick of 7b31f653523655e1b813a2d526e360688e3b9f71 onto main conflicts at e73f8222731b114da82f8080d467cd6948f266b0

## Instructions
Create a branch from `e73f8222731b114da82f8080d467cd6948f266b0`, cherry-pick `7b31f653523655e1b813a2d526e360688e3b9f71`, resolve conflicts, and submit the resulting commit through the merge queue.

**Note:** The conflicting commit may depend on intermediate commits not yet on main. If cherry-picking fails because prerequisite changes are missing, examine the commit's parent chain (`git log --oneline 7b31f653523655e1b813a2d526e360688e3b9f71`) to identify and cherry-pick prerequisite commits first.

**Artifacts:** Write all task artifacts (struggles, notes) to this task's own directory, not the original task's directory.
