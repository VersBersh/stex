# Context

## Relevant Files

| File | Role |
|------|------|
| `src/shared/types.ts` | Defines `AppSettings` interface used throughout the app |
| `src/shared/ipc.ts` | Defines `IpcChannels` constants including `SETTINGS_UPDATED` |
| `src/main/settings.ts` | Currently contains only `resolveSonioxApiKey()` helper (from T20). This is the file to extend with the Settings Store |
| `src/main/settings.test.ts` | Existing tests for `resolveSonioxApiKey()`. Will be extended with Settings Store tests |
| `src/main/index.ts` | Electron main entry point — calls `createOverlayWindow` on ready |
| `src/main/window.ts` | Window Manager — creates overlay BrowserWindow |
| `package.json` | Dependencies — `electron-store` not yet installed |
| `webpack.main.config.js` | Webpack config for main process — externals `electron`, targets `electron-main` |
| `vitest.config.ts` | Vitest config — includes `src/**/*.test.ts` |
| `tsconfig.main.json` | TypeScript config for main process |
| `spec/architecture.md` | Architecture spec defining Settings Store responsibilities and IPC messages |
| `spec/models.md` | Data model spec defining `AppSettings` interface |

## Architecture

The Settings Store is a main-process module responsible for:
1. Persisting `AppSettings` to disk using `electron-store` (JSON file)
2. Providing sensible defaults for all fields on first launch
3. Exposing settings to renderer processes via IPC (read and update)
4. Broadcasting `settings:updated` to all BrowserWindows when a setting changes

The existing `settings.ts` file already has `resolveSonioxApiKey()` from T20, which resolves the API key with env var fallback. Per T20's discovered tasks, when reading `sonioxApiKey`, the store must use `resolveSonioxApiKey(store.get('sonioxApiKey'))` to compute the effective value, without writing the resolved env var back to disk.

IPC channels are defined in `src/shared/ipc.ts`. Currently only `SETTINGS_UPDATED` exists for settings. The task needs two new channels for get/set operations.

The project uses vitest for testing, webpack for bundling main process code, and TypeScript throughout. Other main-process modules (`tray.ts`, `hotkey.ts`, etc.) are stubs (`export {};`).
