# Struggles for T4

- **Category**: `tooling`
  **What happened**: The `npm install` step was needed before tests could run because the worktree didn't have `node_modules`. The first test run failed with `Cannot find module 'vitest/config'`.
  **What would have helped**: Pre-installing dependencies in worktrees at creation time, or caching `node_modules` across worktrees.

- **Category**: `description-quality`
  **What happened**: The task description didn't explicitly state whether the app should remain visible on startup (for development) or start hidden (final behavior). The plan review flagged this as a Critical issue since tray/hotkey modules are empty stubs. The correct behavior (hidden startup) is defined in the system-tray spec, not the task description.
  **What would have helped**: A note in the task description about cross-task dependencies: "Note: The overlay starts hidden. Until the Tray Manager and Hotkey Manager are implemented, the app will have no visible UI on startup — this is expected."
