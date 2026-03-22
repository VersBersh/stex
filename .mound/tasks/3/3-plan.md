# Plan

## Goal

Implement the Settings Store in `src/main/settings.ts` using `electron-store` for persistence, with IPC handlers for renderer get/set and broadcast on change.

## Steps

### 1. Install `electron-store@8.2.0`

Pin to v8.2.0 — the last CJS-compatible version. v9+ is ESM-only and incompatible with the project's `"module": "commonjs"` tsconfig.

```bash
npm install electron-store@8.2.0
```

### 2. Add `electron-store` to webpack externals in `webpack.main.config.js`

`electron-store` is a Node module that should not be bundled by webpack. Add to existing `externals` object:

```javascript
externals: {
  electron: 'commonjs electron',
  'electron-store': 'commonjs electron-store',
},
```

### 3. Add IPC channel constants to `src/shared/ipc.ts`

Add two new channels to the `IpcChannels` object:

```typescript
SETTINGS_GET: 'settings:get',
SETTINGS_SET: 'settings:set',
```

Follows the existing naming pattern (`UPPER_SNAKE: 'kebab:case'`).

### 4. Implement Settings Store in `src/main/settings.ts`

Extend the existing file (which has `resolveSonioxApiKey` from T20) with:

**a) Import and defaults:**

```typescript
import Store from 'electron-store';
import { AppSettings } from '../shared/types';

export const APP_SETTINGS_DEFAULTS: AppSettings = {
  hotkey: 'Ctrl+Shift+Space',
  launchOnStartup: false,
  onHide: 'clipboard',
  onShow: 'fresh',
  audioInputDevice: null,
  sonioxApiKey: '',
  sonioxModel: 'stt-rt-preview',
  language: 'en',
  maxEndpointDelayMs: 1000,
  theme: 'system',
  windowPosition: null,
  windowSize: { width: 600, height: 300 },
};
```

**b) Store instance:**

```typescript
const store = new Store<AppSettings>({ defaults: APP_SETTINGS_DEFAULTS });
```

**c) Accessor functions:**

- `getSettings(): AppSettings` — Returns all settings from the store, with `sonioxApiKey` resolved via `resolveSonioxApiKey(store.get('sonioxApiKey'))`. Does NOT write the resolved value back to disk.
- `setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void` — Sets a single setting in the store via `store.set(key, value)`.

**d) IPC registration function:**

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '../shared/ipc';

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.SETTINGS_GET, () => getSettings());

  ipcMain.handle(IpcChannels.SETTINGS_SET, (_event, key: keyof AppSettings, value: unknown) => {
    setSetting(key, value as AppSettings[typeof key]);
    const updated = getSettings();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IpcChannels.SETTINGS_UPDATED, updated);
    }
  });
}
```

The `settings:set` handler accepts `key` and `value` as separate arguments (matching `ipcRenderer.invoke('settings:set', key, value)` from the renderer side). After updating, it broadcasts the full effective settings to all windows.

### 5. Register IPC handlers in `src/main/index.ts`

Import `registerSettingsIpc` and call it inside `app.whenReady().then(...)`, before window creation:

```typescript
import { registerSettingsIpc } from './settings';

app.whenReady().then(() => {
  registerSettingsIpc();
  createOverlayWindow();
});
```

### 6. Write/extend tests in `src/main/settings.test.ts`

Extend the existing test file with new test suites. Mock `electron-store` with an in-memory Map implementation, and mock `electron` (`ipcMain.handle`, `BrowserWindow.getAllWindows`).

Tests to add:
- `APP_SETTINGS_DEFAULTS` has all `AppSettings` keys with correct default values
- `getSettings()` returns defaults when store is empty
- `getSettings()` resolves `sonioxApiKey` via `resolveSonioxApiKey()` (env var fallback works)
- `getSettings()` does NOT write the resolved env var value back to the store
- `setSetting()` updates a single setting in the store
- `setSetting()` does not affect other settings
- `registerSettingsIpc()` registers handlers for `SETTINGS_GET` and `SETTINGS_SET`
- The `SETTINGS_SET` handler broadcasts `settings:updated` to all windows

## Risks / Open Questions

1. **Preload bridge not in scope**: The current `BrowserWindow` has `contextIsolation: true` and `nodeIntegration: false`, so renderers cannot directly call `ipcRenderer.invoke()`. A preload script with `contextBridge.exposeInMainWorld` is needed for renderers to use these channels. This is a cross-cutting concern for ALL IPC channels (not just settings) and should be handled by the Window Manager task or a dedicated preload task. This task focuses on the main-process plumbing.

2. **T20 integration**: Per T20's discovered tasks, `getSettings()` must call `resolveSonioxApiKey(store.get('sonioxApiKey'))` for the `sonioxApiKey` field and must NOT write the resolved env var back to disk. The plan handles this by only resolving on read.

3. **electron-store@8.2.0 typing**: v8 ships its own `.d.ts`. The generic `Store<AppSettings>` should work with `defaults: APP_SETTINGS_DEFAULTS` out of the box.
