# Struggles

## 1. Worktree lacks node_modules
- **Category**: tooling
- **What happened**: The git worktree doesn't have its own `node_modules` directory. Node resolves modules from the parent repo via directory traversal, but electron-builder looks specifically in the project's own `node_modules`. Had to run `npm install` in the worktree to test the dist build.
- **What would have helped**: Worktree setup could symlink or copy `node_modules` from the parent repo, or the task runner could run `npm install` as a setup step.

## 2. Icon size requirement not discoverable from config
- **Category**: missing-context
- **What happened**: The plan assumed `resources/tray-icon.ico` could be used as the app icon, but electron-builder requires at least 256x256. This wasn't documented anywhere in the project and only surfaced at build time.
- **What would have helped**: A note in the electron-builder.json or README about icon requirements, or the plan review catching this by checking the actual icon dimensions.
