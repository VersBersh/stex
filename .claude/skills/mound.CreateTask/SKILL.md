---
name: mound.CreateTask
description: Create and publish a new Mound task from an interactive session
---

# mound.CreateTask

Create a Mound task record, write its description file, and publish it.

**Do not invoke this skill unprompted.** Only use it when the user explicitly asks to create a Mound task.

**Requires Bash.** All shell commands below assume a Bash-compatible shell (including Git Bash on Windows).

## Parameters

The user provides (or the conversation establishes) two or three pieces of information:

1. **Summary** — a short, one-line description of the task (used as `--summary`).
2. **Description body** — a markdown document for the task description file. Structure is flexible depending on the task, but should always include acceptance criteria. Common sections:

   ```
   # <Title>

   ## Summary
   <what and why>

   ## Acceptance criteria
   <concrete conditions for done — always include this section>

   ## References
   <links to spec files, source files, or related tasks>
   ```

   Other sections (e.g. `## Approach`, `## Files`, `## Testing`) are optional — include them when they add clarity.

3. **Dependencies** (optional) — task IDs that this task depends on. Use `--depends-on <id>` for each dependency. The flag is repeatable.

If the user has not provided both summary and description, ask before proceeding.

## Step 1 — Create the task

Write the description body to a temporary file using the **Write** tool, then pass it to `mound create-task` via stdin:

```bash
mound create-task --summary "<summary>" --description-stdin --json [--depends-on <id>]... < /path/to/temp-description-file
```

Alternatively, use a heredoc:

```bash
mound create-task --summary "<summary>" --description-stdin --json [--depends-on 42 --depends-on 43] <<'DESCRIPTION_EOF'
<description body here>
DESCRIPTION_EOF
```

`--depends-on` is optional and repeatable. Include it once for each dependency task ID.

The command handles everything internally: environment detection, task record creation, description file writing, git commit, and publishing (via merge queue or direct merge depending on the session state).

## Step 2 — Report the result

Parse the JSON output from `mound create-task`. The output has this structure:

```json
{
  "id": 123,
  "description_path": ".mound/tasks/123/description.md",
  "status": "published"
}
```

Report to the user:

- **Task ID** — from `id`
- **Description path** — from `description_path` (repo-relative)
- **Status** — `"published"` means the task is on main and immediately available for claiming by workers. `"queued"` means the task was submitted to the merge queue and will become available after the merge completes.

## Error handling

- If `mound create-task` exits non-zero, report the error message to the user.
- Do not attempt fallback logic — the command handles all environment detection and error recovery internally.
- A task record may have been created in the database even if the command fails mid-way. This is harmless — unpublished tasks remain in `open` status and do not affect workers.
