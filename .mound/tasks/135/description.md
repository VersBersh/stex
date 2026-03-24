# TEST: Split settings.test.ts into focused test files by concern

## Summary
Split `src/main/settings.test.ts` (416+ lines) into separate test files organized by concern: defaults, store behavior, IPC handlers, and encryption. The file was flagged in code review as exceeding the 300-line guideline. This is a pre-existing issue that grew during task 123 (volume meter and silence threshold).

## Acceptance criteria
- `src/main/settings.test.ts` is split into multiple files, each focused on a single concern (e.g., `settings-defaults.test.ts`, `settings-store.test.ts`, `settings-ipc.test.ts`, `settings-encryption.test.ts` or similar).
- All existing tests continue to pass after the split.
- Each resulting file is under the 300-line guideline.
- No test coverage is lost.

## References
- `src/main/settings.test.ts`
- Task 44 (TEST: Split window.test.ts into focused test files) — similar prior work
- Task 123: Add visual volume dB meter with configurable silence threshold (contributed to file growth)
