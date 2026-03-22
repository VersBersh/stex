# Discovered Tasks

1. **WIN: Preload bridge for IPC channels**
   - A preload script exposing `contextBridge.exposeInMainWorld` is needed for renderers to call `ipcRenderer.invoke()` on `settings:get`, `settings:set`, and all other IPC channels.
   - Discovered because the window has `contextIsolation: true` and `nodeIntegration: false`, so renderers cannot directly use `ipcRenderer`. This applies to all IPC channels, not just settings.

2. **WIN: Read initial window geometry from settings**
   - `createOverlayWindow()` in `window.ts` hard-codes `width: 600, height: 300`. It should read from `getSettings().windowSize` to use persisted values and eliminate duplication with `APP_SETTINGS_DEFAULTS`.
   - Discovered because code review flagged the semantic coupling between the two hardcoded values.
