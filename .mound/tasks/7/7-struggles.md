# Struggles

## 1. Missing preload bridge
- **Category:** missing-context
- **What happened:** The task description specifies IPC actions (hide window, pause/resume) but the codebase had no preload script. The preload bridge was a known gap from T4 (documented in discovered-tasks) but was not called out as a dependency in the T7 description. I had to create the preload script, update webpack config, and wire it into the BrowserWindow.
- **What would have helped:** The task description should have listed the preload bridge as an explicit prerequisite or included it in scope with a note that it's a cross-cutting dependency.

## 2. Existing test breakage from cross-task file modification
- **Category:** description-quality
- **What happened:** Adding `ipcMain.on()` to `window.ts` broke all 31 existing window.test.ts tests because the electron mock didn't include `ipcMain`. Had to add the mock, which is a modification to a file owned by another task (T4).
- **What would have helped:** When tasks modify shared files, the description should note which files will be affected and whether test updates are in scope.
