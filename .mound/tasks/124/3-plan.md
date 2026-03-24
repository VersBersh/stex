# Plan

## Goal

Add a `[test_runner]` section to `.mound/config.toml` so Mound workers can run the project's Vitest test suite.

## Steps

1. **Add `test-results.xml` to `.gitignore`** — Append `test-results.xml` so automated test runs don't leave untracked artifacts in worktrees.

2. **Edit `.mound/config.toml`** — Append a `[test_runner]` section at the end of the file with these fields:
   - `run_all = "npx vitest run --reporter=junit --outputFile=test-results.xml"` — runs the unit test suite and writes JUnit XML results
   - `run_targeted = "npx vitest run --reporter=junit --outputFile=test-results.xml -t \"{{test_name}}\""` — runs specific tests by name pattern (vitest's `-t` accepts a regex pattern)
   - `results_path = "test-results.xml"` — location of the JUnit XML output file
   - `results_format = "junit-xml"` — format of the results file
   - `timeout_seconds = 120` — 2 minutes; the full suite runs in ~5s but allows for cold starts

3. **Verify `run_all`** — Execute the `run_all` command and confirm it exits 0 and produces `test-results.xml` in JUnit XML format.

4. **Verify `run_targeted`** — Execute the `run_targeted` command with a known test name and confirm it runs only matching tests and produces results.

5. **Verify results file** — Confirm `test-results.xml` contains valid JUnit XML with `<testsuites>` root element.

## Risks / Open Questions

- **Integration tests excluded**: The `run_all` command uses the default vitest config which excludes `*.integration.test.ts`. This is intentional — integration tests (`soniox.integration.test.ts`) require external services and are not suitable for automated Mound worker runs. The "full test suite" in this context means all tests that can run without external dependencies.
- **`-t` uses regex semantics**: Vitest's `-t` flag accepts a regex pattern, not a literal string. This is compatible with Mound's `{{test_name}}` interpolation as long as test names don't contain regex metacharacters. This is a known limitation.
- **`timeout_seconds = 120`** is generous (tests take ~5s) but accounts for npm/vitest startup overhead in fresh worktrees.
