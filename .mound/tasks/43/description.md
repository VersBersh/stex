# PRELOAD: Add preload script for settings window

## Summary
The settings window is created with `contextIsolation: true` but has no preload script. When the settings UI needs to read/write settings via IPC (e.g., saving API key, changing hotkey, selecting audio device), it will need its own preload bridge that exposes the relevant IPC channels via `contextBridge.exposeInMainWorld`.

This follows the same pattern established by the overlay preload script (T25/T41) but scoped to the settings window's IPC needs.

## Acceptance criteria
- A preload script exists for the settings window (e.g., `src/preload/settings-preload.ts`)
- The preload script uses `contextBridge.exposeInMainWorld` to expose settings-related IPC channels
- The settings `BrowserWindow` configuration references this preload script
- The preload script is compiled by the webpack/build pipeline
- Unit tests verify the exposed API surface

## References
- Overlay preload implementation (T25/T41) as the pattern to follow
- Settings window creation in WindowManager
- `spec/ipc-channels.md` for the settings-related IPC channel definitions
