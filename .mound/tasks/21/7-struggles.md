# Struggles

## 1. Binary package.json / package-lock.json conflicts
- **Category:** tooling
- **What happened:** package.json and package-lock.json are stored as binary in this repo, so git could not auto-merge them. Had to manually reconstruct the merged package.json using Node.js and regenerate the lockfile with `npm install --ignore-scripts`.
- **What would have helped:** Storing package.json as text (not binary) would allow git's normal 3-way merge to work.

## 2. Native dependency build failure in worktree
- **Category:** tooling
- **What happened:** `npm install` failed because naudiodon requires node-gyp which needs Python, unavailable in this environment. Used `--ignore-scripts` to skip native builds and still regenerate the lockfile correctly.
- **What would have helped:** Having Python/build tools available in the worktree environment, or a pre-built binary cache for native modules.
