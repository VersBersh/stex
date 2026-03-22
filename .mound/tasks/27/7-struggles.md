# Struggles

- **Category:** tooling
- **What happened:** `npm install` fails in the worktree due to naudiodon's native module requiring Python/node-gyp, which isn't available. This prevented running the full `npm run build` and `npm test` verification commands.
- **What would have helped:** A pre-installed node_modules directory or a CI-like environment with native build dependencies. Alternatively, a `--ignore-scripts` npm install option could be documented for worktrees where native modules aren't needed for config-only changes.
