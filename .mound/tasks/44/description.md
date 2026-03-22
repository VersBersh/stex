# TEST: Split window.test.ts into focused test files

## Summary
The window test file (`window.test.ts`) has grown to 361+ lines covering multiple concerns: window construction, positioning, opacity, close interception, settings window, and IPC mocking. This makes it harder to maintain, navigate, and understand which tests cover which behavior. It should be split into focused test files by responsibility.

Discovered during code review of T7 (Overlay UI Shell) — flagged as a code smell.

## Acceptance criteria
- `window.test.ts` is split into multiple test files, each focused on a single responsibility (e.g., `window-construction.test.ts`, `window-positioning.test.ts`, `settings-window.test.ts`)
- All existing tests continue to pass after the split
- No test coverage is lost
- Shared test setup/fixtures are extracted into a test helper if needed
- Each test file can run independently

## References
- Current `window.test.ts` file
- T7 (Overlay UI Shell) code review where this was flagged
