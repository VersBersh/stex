# Struggles — Task 78

No major struggles.

- **Category:** `tooling`
- **What happened:** `npm install` fails in the worktree due to native module compilation (`segfault-handler`, `naudiodon`), requiring `--ignore-scripts`. The pre-existing `soniox.test.ts` failure (Electron binary not installed) is a side effect.
- **What would have helped:** A documented workaround for running in worktrees without native compilation, or a vitest config that excludes tests requiring the Electron binary.
