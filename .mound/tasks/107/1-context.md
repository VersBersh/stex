# Context

## Relevant Files

- `src/main/logger.ts` — Singleton logger module. Has a module-level `logFile` variable but does not export it. `initLogger()` sets the path to `{logDir}/stex.log`.
- `src/main/logger.test.ts` — Tests for the logger module.
- `src/main/index.ts` — App entry point. Calls `initLogger({ logDir: path.join(app.getPath('userData'), 'logs') })`.
- `src/main/settings.ts` — Settings store and IPC registration. `registerSettingsIpc()` handles `SETTINGS_GET` and `SETTINGS_SET` channels.
- `src/shared/ipc.ts` — IPC channel name constants.
- `src/shared/preload.d.ts` — Type declarations for `SettingsAPI` and `ElectronAPI` interfaces exposed to renderers.
- `src/shared/types.ts` — Shared type definitions including `AppSettings`.
- `src/preload/settings-preload.ts` — Preload script for settings window. Implements `SettingsAPI` using `contextBridge` and `ipcRenderer`.
- `src/preload/settings-preload.test.ts` — Tests for the settings preload bridge.
- `src/renderer/settings/index.tsx` — Settings window React root. Tab-based layout with General, Hotkeys, API Key tabs.
- `src/renderer/settings/pages/General.tsx` — General settings page component. Displays theme, on-show/on-hide behavior, audio device, etc.
- `src/renderer/settings/settings.css` — Styles for the settings window. Defines `.setting-group`, `.btn`, `.hint`, etc.
- `src/main/session-ipc.ts` — Example of using `shell.openExternal()` from Electron in an IPC handler.

## Architecture

The settings UI uses a standard Electron IPC pattern:
1. **Main process** (`settings.ts`) registers `ipcMain.handle()` handlers for request-response channels.
2. **Preload script** (`settings-preload.ts`) wraps `ipcRenderer.invoke()` calls into a typed `SettingsAPI` object, exposed via `contextBridge.exposeInMainWorld('settingsApi', ...)`.
3. **Renderer** (`General.tsx` etc.) calls `window.settingsApi.*` methods, which are typed by `SettingsAPI` in `src/shared/preload.d.ts`.

IPC channel names are centralized in `src/shared/ipc.ts`.

The logger is initialized once at startup with `logDir = path.join(app.getPath('userData'), 'logs')`, producing a log file at `{userData}/logs/stex.log`. The `logFile` variable is module-private and not currently accessible from outside `logger.ts`.

Electron's `shell.showItemInFolder(path)` is used elsewhere in the codebase (via `shell.openExternal` in `session-ipc.ts`) to open OS-native file locations.
