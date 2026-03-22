# Struggles

- **Category:** tooling
  **What happened:** Initial implementation used `fs.createWriteStream` for async file writes, but this caused ENOENT errors in tests because the stream opens the file descriptor asynchronously. When test teardown cleaned up temp directories, pending stream opens would fail with uncaught exceptions.
  **What would have helped:** Knowing upfront that `fs.createWriteStream` has lazy async file opening that doesn't play well with synchronous test cleanup on Windows. Using `fs.appendFileSync` from the start would have avoided this.

- **Category:** tooling
  **What happened:** The codex review flagged `fs.renameSync` failing on Windows when the target file already exists (Windows doesn't silently overwrite on rename like POSIX).
  **What would have helped:** A linter rule or checklist item for Windows-specific filesystem behavior in cross-platform Electron apps.
