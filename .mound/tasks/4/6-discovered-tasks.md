# Discovered Tasks for T4

1. **PRELOAD: Add preload scripts for renderer IPC bridge**
   - Both overlay and settings windows are created with `contextIsolation: true` but no `preload` script.
   - When renderers need to communicate with the main process via IPC, a preload script exposing `contextBridge.exposeInMainWorld()` will be required.
   - Discovered when implementing BrowserWindow options: `webPreferences.preload` is not set.

2. **SESSION: Wire session lifecycle to show/hide**
   - `showOverlay()` and `hideOverlay()` only manage window visibility. The spec requires that show triggers session start (audio capture, WebSocket connection) and hide triggers finalization + clipboard copy.
   - The Session Manager must wrap these calls with lifecycle behavior.
   - Discovered when reviewing the system-tray spec against the Window Manager's scope boundary.
