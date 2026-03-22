# T18: Theming — Context

## Relevant Files

### CSS (to be converted to CSS variables)
- `src/renderer/overlay/overlay.css` — All overlay styles. Hardcoded light-theme colors (#fff, #f0f0f0, #ddd, #1a1a1a, #666, #e0e0e0, #f8f8f8, #ccc, #444, #c00). No CSS variables.
- `src/renderer/settings/settings.css` — All settings styles. Hardcoded light-theme colors (#f5f5f5, #e8e8e8, #d0d0d0, #1a1a1a, #444, #d8d8d8, #fff, #0066cc, #333, #888, #ccc, #555). No CSS variables.

### HTML entry points (theme class target)
- `src/renderer/overlay/index.html` — Overlay window HTML shell
- `src/renderer/settings/index.html` — Settings window HTML shell

### Renderer entry points (theme initialization)
- `src/renderer/overlay/index.tsx` — Overlay React root. Imports overlay.css, renders App.
- `src/renderer/settings/index.tsx` — Settings React root. Imports settings.css, renders App. Already has settings state and `onSettingsUpdated` listener.

### Preload scripts (IPC bridge for theme)
- `src/main/preload.ts` — Overlay preload. Exposes `electronAPI` (hideWindow, requestPause, requestResume).
- `src/main/preload-settings.ts` — Settings preload. Exposes `settingsApi` (getSettings, setSetting, onSettingsUpdated, getAudioDevices).

### Main process
- `src/main/window.ts` — Creates overlay and settings BrowserWindows. No nativeTheme usage.
- `src/main/settings.ts` — electron-store settings. `theme` default is `'system'`. `setSetting` broadcasts to all windows via `SETTINGS_UPDATED`.
- `src/main/index.ts` — App entry. Calls `registerSettingsIpc()`, `initWindowManager()`, etc.

### Shared
- `src/shared/types.ts` — `AppSettings.theme: "system" | "light" | "dark"` already defined.
- `src/shared/ipc.ts` — IPC channel constants. Has `SETTINGS_GET`, `SETTINGS_SET`, `SETTINGS_UPDATED`.

### Settings UI (already done)
- `src/renderer/settings/pages/General.tsx` — Theme `<select>` dropdown already exists (system/light/dark).

### Type definitions
- `src/renderer/types.d.ts` — Declares `ElectronAPI` and `Window.electronAPI`.
- `src/renderer/settings/settingsApi.d.ts` — Declares `SettingsApi` and `Window.settingsApi`.

### Tests
- `src/main/settings.test.ts` — Tests for settings store, IPC, defaults.
- `src/main/window.test.ts` — Tests for window creation, show/hide/toggle, position validation.

## Architecture

The app is an Electron tray-resident utility with two renderer windows:

1. **Overlay window** — frameless, always-on-top, with a Lexical editor for live transcription. Uses `OverlayContext` for state. Communicates with main via `electronAPI` (preload.ts).

2. **Settings window** — standard framed window. Uses `settingsApi` (preload-settings.ts) to read/write settings. Settings changes are broadcast to all windows via `SETTINGS_UPDATED` IPC.

**Styling**: Plain CSS loaded via webpack (css-loader + style-loader). No CSS-in-JS, no preprocessor, no CSS variables currently. All colors are hardcoded for light theme.

**Settings flow**: Settings are stored via `electron-store`. When a setting changes, `setSetting()` updates the store, notifies main-process listeners (`onSettingsChanged`), and broadcasts to all windows via IPC. The renderer settings window already has the theme selector dropdown but the value is never consumed.

**Key constraint**: The overlay preload (`preload.ts`) does NOT expose `settingsApi` — it only has `electronAPI` with window/session controls. To apply theme in the overlay, we either need to add settings IPC to the overlay preload, or use a new dedicated theme IPC channel.

**nativeTheme**: Not used anywhere. Needed for `"system"` theme mode to detect and follow Windows dark/light mode.
