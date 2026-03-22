# Implementation Notes

## Files created or modified

| File | Changes |
|------|---------|
| `src/main/settings.ts` | Extended with `APP_SETTINGS_DEFAULTS`, `VALID_KEYS`, `getSettings()`, `setSetting()`, `registerSettingsIpc()`, electron-store instance |
| `src/main/settings.test.ts` | Extended with tests for defaults, getSettings, setSetting, registerSettingsIpc, unknown key rejection, store leak prevention |
| `src/shared/ipc.ts` | Added `SETTINGS_GET` and `SETTINGS_SET` channel constants |
| `src/main/index.ts` | Added `registerSettingsIpc()` call before window creation |
| `webpack.main.config.js` | Added `electron-store` to webpack externals |
| `package.json` | Added `electron-store` pinned at `8.2.0` |

## Deviations from plan

- After code review, `getSettings()` was changed to read known keys explicitly via `store.get(key)` instead of spreading `store.store`. This prevents unknown/corrupted keys from leaking into the returned `AppSettings` object.
- Added `VALID_KEYS` set and runtime validation in the `SETTINGS_SET` IPC handler to reject unknown keys at the boundary.

## New tasks or follow-up work

- **Preload bridge**: A preload script with `contextBridge.exposeInMainWorld` is needed for renderers to invoke `settings:get` and `settings:set`. This is a cross-cutting concern for all IPC channels and should be addressed by the Window Manager or a dedicated preload task.
- **Window geometry deduplication**: `window.ts` hard-codes `width: 600, height: 300` which duplicates `APP_SETTINGS_DEFAULTS.windowSize`. The Window Manager should read initial bounds from `getSettings()` instead.
