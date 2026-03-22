# Context

## Relevant Files

- `src/main/tray.ts` — Target file for implementation; currently a stub (`export {};`)
- `src/main/window.ts` — Window Manager; exports `toggleOverlay()`, `showSettings()`, `showOverlay()`, `hideOverlay()`, `getOverlayWindow()` that tray menu items will call
- `src/main/index.ts` — App entry point; initializes window manager and settings IPC on `app.whenReady()`; has a comment noting tray manager is a future task
- `src/main/settings.ts` — Settings store; provides `getSettings()` and `setSetting()`
- `src/shared/types.ts` — Shared types including `AppSettings`
- `src/shared/ipc.ts` — IPC channel constants
- `src/main/window.test.ts` — Window manager tests; demonstrates mocking patterns for Electron (`vi.hoisted`, `vi.mock('electron', ...)`, `vi.mock('./settings', ...)`)
- `src/main/settings.test.ts` — Settings tests; demonstrates mocking `electron-store` and `electron`
- `package.json` — Uses vitest for testing, webpack for bundling, TypeScript throughout
- `webpack.main.config.js` — Webpack config for main process; sets `__dirname: false` so `path.join(__dirname, ...)` works at runtime; no asset copying configured
- `vitest.config.ts` — Test config; includes `src/**/*.test.ts`

## Architecture

The **Tray Manager** is a main-process component that creates and manages the system tray icon and its right-click context menu. It sits alongside the Window Manager and Settings Store in the Electron main process.

Key relationships:
- **Tray → Window Manager**: The tray's Show/Hide menu item calls `toggleOverlay()`, and Settings calls `showSettings()`. These are direct function imports.
- **Tray → `app.quit()`**: The Quit menu item exits the application via Electron's `app.quit()`.
- **Entry point → Tray**: `index.ts` will call an init function from tray.ts during `app.whenReady()`.
- **Tray icon**: Electron's `Tray` class requires a `NativeImage` or a file path to an icon. On Windows, `.ico` files are preferred. No icon assets exist yet in the repo.

Constraints:
- The tray must persist for the app's lifetime — if the `Tray` instance is garbage-collected, the icon disappears. It must be stored in a module-level variable.
- The app is tray-resident (window-all-closed is intentionally a no-op), so the tray icon is the only way for users to quit.
- Existing modules follow the pattern: module-level state, exported `init*` function, exported action functions.
