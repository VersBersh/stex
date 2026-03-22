# Preload bridge script for IPC channels (contextBridge)

## Summary
A preload script using `contextBridge.exposeInMainWorld` is needed so that renderer processes can invoke IPC channels (`settings:get`, `settings:set`, and all other channels). The window configuration has `contextIsolation: true` and `nodeIntegration: false`, so renderers cannot directly access `ipcRenderer`. This preload bridge is foundational for all renderer-to-main IPC communication.

## Acceptance criteria
- A preload script exists that exposes a typed API via `contextBridge.exposeInMainWorld`.
- All defined IPC channels (settings, and any future channels) are accessible from the renderer via the exposed API.
- The preload script is referenced in the `BrowserWindow` `webPreferences.preload` configuration.
- TypeScript declarations exist so renderers get type-safe access to the bridge API (e.g., `window.api.settingsGet()`).
- No direct `require('electron')` usage in renderer code.

## References
- T4 (task 4): Window Manager — sets `contextIsolation: true`, `nodeIntegration: false`
- T3 (task 3): Settings Store — defines `settings:get`, `settings:set` IPC handlers
- T7 (task 7): Overlay UI Shell — will need the bridge to communicate with main
- T8 (task 8): Settings Window UI — will need the bridge for settings IPC
- Source: `.mound/tasks/3/6-discovered-tasks.md` item 1
