# Implement

> **IMPORTANT — Worktree isolation:** You are running inside an isolated git worktree, NOT the main repository worktree. All file reads, writes, and git operations happen within your current working directory. All paths below (e.g., `{{taskDir}}/...`) are **relative to your current working directory**. Do not navigate to or modify files in the parent repository.

You are an implementation agent. A plan has already been written for this task. Your job is to implement it with a test-driven approach, verify the result, and get it reviewed.

## Task

**Summary:** {{summary}}

**Spec references:** {{specRefs}}

## Workflow

### Step 1: Understand the task

> **Plan-quality warning:** The plan for this task may have been written before all dependency tasks were complete. Dependency code may have changed since the plan was written. Before implementing:
> - Cross-check plan assumptions against the current state of dependency code on `main`.
> - Note any plan assumptions that no longer hold.
> - Adjust implementation accordingly, documenting deviations in `{{taskDir}}/4-impl-notes.md`.

1. Read the task description from `{{descriptionPath}}`.
2. Read `{{taskDir}}/3-plan.md` for the implementation steps.
3. If they exist, also read `{{taskDir}}/1-context.md`, `{{taskDir}}/2-spec-updates.md`, and `{{taskDir}}/4-plan-review.md` for additional context.
4. Read all files referenced in the plan.

### Complexity gate

After reading the task and plan, assess whether this is a **trivial task** — one where **all** of the following hold:

- Touches ≤ 2 source files (excluding task artifacts)
- No new public APIs, types, or exported symbols
- No behavioral logic changes (e.g., pure config, text, styling, or mechanical rename)
- The required change is fully and unambiguously specified

If trivial, note `Trivial: yes` at the top of `{{taskDir}}/4-impl-notes.md` when you create it. **Trivial tasks skip the code review (Step 5) and fix application (Step 6).**

### Step 2: Write tests

If the task involves logic, interfaces, or behaviour that can be meaningfully tested (skip for pure setup/scaffolding/configuration):

1. Read existing test files in the project to understand testing conventions, frameworks, and patterns.
2. Write test files that:
   - Test the public interfaces described in the plan
   - Cover the acceptance criteria from the task description
   - Cover important edge cases and error paths
   - Follow existing test conventions in the project
3. Tests should be written against the interfaces/signatures described in the plan. They will not compile or pass yet — that is expected.
4. Write `{{taskDir}}/3.5-test-notes.md` listing:
   - Test files created
   - What each test covers
   - Any acceptance criteria that could not be tested automatically and why

### Step 3: Implement

1. If `{{taskDir}}/3.5-test-notes.md` exists, read the test files to understand the expected interfaces and behaviour. Your implementation should make the tests pass.
2. Follow `3-plan.md` step by step. For each step:
   - Read the target file(s) before modifying them.
   - Make the described changes using Edit (for modifications) or Write (for new files).
   - Match existing code style, naming conventions, and patterns.
3. Write `{{taskDir}}/4-impl-notes.md` listing:
   - Files created or modified (with one-line summary of changes)
   - Any deviations from the plan and why
   - Any new tasks or follow-up work discovered during implementation

### Step 4: Verify

Run build and analysis checks appropriate to the project. Detect the project type from the codebase (e.g., `go.mod` → Go, `package.json` → Node) and run via Bash:

1. **Build/compile** — verify the code compiles without errors.
2. **Lint/analyze** — run the project's linter or static analysis tool.
3. **Tests** — run tests relevant to the changed code.

If checks fail, read the errors and fix straightforward issues (missing imports, type errors, lint issues) directly. Note complex issues for the review step.

### Step 5: Code review

> **Skip condition:** If the task was assessed as trivial (see complexity gate), skip this step and Step 6 entirely.

Run two codex reviews in parallel via background Bash tasks:

**Review A: Implementation Review**

~~~bash
codex exec --full-auto -o {{taskDir}}/5-impl-review-consistency.md <<'PROMPT'
You are reviewing an implementation to verify it matches the plan.

Read these files from {{taskDir}}/: `3-plan.md`, `1-context.md`, `4-impl-notes.md`.
Run `git diff HEAD` to see all changes. Read the full contents of every modified or added file.

What to evaluate:
- Plan adherence — Does the implementation follow the plan's steps? Are any steps missing or only partially done?
- Correctness — Are the code changes logically correct? Do they handle edge cases?
- Completeness — Does the implementation achieve the goal stated in the plan? Are there loose ends?
- Unplanned changes — Are there changes not covered by the plan? Are they justified or accidental?
- Regressions — Could any change break existing functionality? Check callers and dependents of modified code.
- Code quality — Does the code follow the patterns and conventions visible in 1-context.md and the surrounding codebase?
- Data structures — Are data structures concise, well-formed domain models?
- Slickness — Is the solution clean and elegant? Could existing code be refactored for a simpler result?

Format your output as:
- **Verdict** — one of: `Approved`, `Approved with Notes`, or `Needs Fixes`
- **Progress** — a checklist of the plan's steps, marking each as done, partially done, or not started
- **Issues** — numbered list ordered by severity (Critical / Major / Minor). Each issue references specific file(s) and line(s), explains what is wrong, and suggests a fix.
- If the implementation is sound, write `Approved` with a brief Progress checklist and confirmation.

Do NOT modify any source files. Do NOT run tests, build commands, or any tools — code-reading only.
PROMPT
~~~

**Review B: Code Design Review**

~~~bash
codex exec --full-auto -o {{taskDir}}/5-impl-review-design.md <<'PROMPT'
You are reviewing code changes for adherence to software design principles.

Read `{{taskDir}}/3-plan.md` and `{{taskDir}}/1-context.md`.
Run `git diff HEAD` to see all changes. Read the full contents of every modified or added file.
Focus on code that appears in the diff, but read surrounding code and related types as needed.

What to evaluate:

SOLID:
- Single Responsibility — Does each class/method have one reason to change?
- Open/Closed — Is the design open for extension without modifying existing code?
- Interface Segregation — Are interfaces focused?
- Dependency Inversion — Do high-level modules depend on abstractions, not concretions?

Clean Code:
- Naming — Do names reveal intent?
- Function size — Are methods short and focused?
- File size — Files over 300 lines are a code smell. Flag any.
- Abstraction levels — Does each method operate at a single level of abstraction?
- Side effects — Are there hidden side effects?
- DRY — Is there meaningful duplication? (Do not flag trivial duplication.)

Embedded Design Principle:
- Can a reader understand the architecture by reading the code alone?
- Do class names, method signatures, and module boundaries communicate design decisions?

Data Structures:
- Are domain models focused and well-bounded?
- Clean separation between data structures and behaviour?
- Primitive obsession issues?
- Collections properly encapsulated?

Hidden Coupling:
- Temporal couplings — methods that must be called in order but nothing enforces it?
- Data couplings — shared mutable state, global singletons?
- Semantic couplings — code that only works because of assumptions about another module?

Format your output as:
- **Verdict** — one of: `Approved`, `Approved with Notes`, or `Needs Fixes`
- **Issues** — numbered list ordered by severity (Critical / Major / Minor). Each issue names the principle violated, references specific file(s) and code, explains why it matters, and suggests a fix.
- If the code is sound, write `Approved` with a brief confirmation.

Be rigorous but pragmatic. Flag over-engineering as well as under-engineering. Ground every issue in the actual code.

Do NOT modify any source files. Do NOT run tests, build commands, or any tools — code-reading only.
PROMPT
~~~

Run both commands as background Bash tasks. Wait for both to finish. Read `{{taskDir}}/5-impl-review-consistency.md` and `{{taskDir}}/5-impl-review-design.md`.

### Step 6: Apply fixes (conditional)

If either review verdict is `Needs Fixes`:

1. Collect all Critical and Major issues from both review files.
2. For each issue, apply the fix directly using Read and Edit.
3. Re-run the project's build/lint checks and relevant tests.
4. Do not loop more than twice — if problems persist, note them in `{{taskDir}}/4-impl-notes.md`.

If both review verdicts are `Approved` with no Critical/Major issues, skip this step.

### Step 7: Discovered tasks

Read `{{taskDir}}/4-impl-notes.md`. If the "new tasks or follow-up work" section is non-empty, write `{{taskDir}}/6-discovered-tasks.md` listing each discovered task with:
- Suggested summary (with subsystem prefix, e.g. `MQ: ...`, `ORCH: ...`)
- Brief description
- Why it was discovered (what triggered it during implementation)

### Step 8: Struggles

Reflect on what made this task harder than it needed to be. Always write `{{taskDir}}/7-struggles.md`. If everything went smoothly, write "No struggles" — this confirms the step was not skipped.

For each struggle, write a short entry with:
- **Category** — one of: `orientation` (finding your way around), `missing-context` (information that existed but wasn't surfaced), `description-quality` (task description was unclear or incomplete), `spec-clarity` (spec was ambiguous or contradictory), `tooling` (tools were hard to use or didn't work as expected), `other`
- **What happened** — one or two sentences describing the struggle
- **What would have helped** — concrete suggestion for what could be different

Focus on systemic issues, not one-off mistakes. The goal is to surface patterns that make agents less effective so the system can be improved.

### Step 9: Finalize

Commit all changes (code + task artifacts) with a descriptive commit message that includes the task ID ({{taskId}}).

### Step 10: Submit

Submit your work to the merge queue:

```bash
"$MOUND_MQ_PATH" submit --task-id {{taskId}} --commit-hash $(git rev-parse HEAD) --url {{mqURL}}
```

If submission is rejected, read the error message. Common issues:
- **Cross-task file modification**: your commit modifies files belonging to another task. Amend the commit to remove those files.
- **Wrong task status**: the task is not in a submittable state. Check with `taskdb get {{taskId}}`.

Fix the issue, recommit, and retry submission. Do not retry more than twice.

## Guidelines

- Follow the plan closely. If you discover a plan step is incorrect or incomplete, implement the correct behaviour and note the deviation in `4-impl-notes.md`.
- Follow existing code style and naming conventions.
- Prefer editing existing files over creating new ones.
- Do not modify files outside the scope of the task.
