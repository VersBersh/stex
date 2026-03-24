# Context

## Relevant Files

- `src/main/settings.test.ts` — the 483-line test file to be split (6 describe blocks covering defaults, store, IPC, encryption, and renderer masking)
- `src/main/settings.ts` — the production module under test (exports: `resolveSonioxApiKey`, `APP_SETTINGS_DEFAULTS`, `getSettings`, `getSettingsForRenderer`, `setSetting`, `registerSettingsIpc`, `onSettingsChanged`)
- `src/main/window-behavior.test.ts` — example of a previously split test file (from task 44), shows the pattern: each file has its own mock setup
- `src/shared/types.ts` — defines `AppSettings` type used in the tests
- `src/shared/ipc.ts` — defines `IpcChannels` enum used by IPC handler tests

## Architecture

`settings.ts` is the main process settings module. It:
1. Creates a module-level `electron-store` instance with `APP_SETTINGS_DEFAULTS`
2. Exports `getSettings()` (reads from store, decrypts API key, resolves env var fallback)
3. Exports `getSettingsForRenderer()` (calls getSettings, masks the API key)
4. Exports `setSetting()` (writes to store with encryption for API key, notifies listeners)
5. Exports `onSettingsChanged()` (subscribe to setting changes)
6. Exports `registerSettingsIpc()` (registers IPC handlers: SETTINGS_GET, SETTINGS_SET, LOG_PATH_GET, LOG_REVEAL)

The test file mocks: `electron-store`, `electron` (ipcMain, BrowserWindow, safeStorage, shell), `./logger`, and `fs`. The mock setup is ~91 lines at the top, shared by all test groups.

The prior split of `window.test.ts` (task 44) established the pattern: each resulting file has its own independent mock setup and imports. No shared test helper files.
