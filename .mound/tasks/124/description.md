# Configure [test_runner] in config.toml

## Summary

Set up the `[test_runner]` section in `config.toml` so that Mound workers can run the project's test suite. This enables automated test verification during task implementation.

## Acceptance criteria

- [ ] `config.toml` contains a `[test_runner]` section with all required and applicable fields:
  - `run_all` — command to run the full test suite
  - `run_targeted` — command to run specific failed tests
  - `results_path` — path to test results file (omit if exit-code-only mode is sufficient)
  - `results_format` — `"junit-xml"` or `"failed-tests"`
  - `timeout_seconds` — timeout in seconds (default 600)
- [ ] `run_all` command executes successfully against the current codebase
- [ ] `run_targeted` command works for at least one known test name
- [ ] If `results_path` is configured, the results file is produced in the expected format after a test run
