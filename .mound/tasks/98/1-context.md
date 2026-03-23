# Context

## Relevant Files

| File | Role |
|------|------|
| `src/renderer/settings/pages/ApiKey.tsx` | Settings UI component for API key entry. Currently shows full key in a `type="password"` input with Show/Hide toggle. After save, the full plaintext key is still available in component state via `settings.sonioxApiKey`. |
| `src/main/settings.ts` | Main process settings module. Uses `electron-store` (plain JSON on disk) to persist all `AppSettings` including `sonioxApiKey`. `getSettings()` returns the full API key to all callers. `setSetting()` writes values to the store and broadcasts to all windows. |
| `src/main/settings.test.ts` | Tests for settings module. Mocks `electron-store` with an in-memory Map. Tests `resolveSonioxApiKey`, `getSettings`, `setSetting`, `onSettingsChanged`, `registerSettingsIpc`. |
| `src/shared/types.ts` | Defines `AppSettings` interface. `sonioxApiKey` is typed as `string`. |
| `src/shared/ipc.ts` | IPC channel constants. `SETTINGS_GET` and `SETTINGS_SET` channels used by settings. |
| `src/shared/preload.d.ts` | Type declarations for `SettingsAPI` and `ElectronAPI` exposed to renderer processes. |
| `src/preload/settings-preload.ts` | Preload bridge for settings window. Exposes `settingsApi` via `contextBridge`. |
| `src/renderer/settings/index.tsx` | Root settings app. Loads all settings via `getSettings()` and passes them to tab components. |
| `src/main/index.ts` | App entry point. Checks `settings.sonioxApiKey` on startup to decide whether to show settings window. |
| `spec/architecture.md` | Architecture spec. Describes Settings Store and Settings UI components. |
| `spec/models.md` | Data model spec. Defines `AppSettings` with `sonioxApiKey` field and resolution rules. |

## Architecture

The settings subsystem spans three Electron process boundaries:

1. **Main process** (`src/main/settings.ts`): An `electron-store` instance persists `AppSettings` as a plain JSON file (`settings.json`) in `%APPDATA%/stex/config/`. `getSettings()` reads all valid keys, applies `resolveSonioxApiKey()` (saved value > env var > empty), and returns the full settings object. `setSetting()` writes to the store, notifies in-process listeners, and IPC-broadcasts to all windows.

2. **Preload bridge** (`src/preload/settings-preload.ts`): Uses `contextBridge` to expose `settingsApi` to the settings renderer. Context isolation is enabled, node integration disabled.

3. **Renderer** (`src/renderer/settings/pages/ApiKey.tsx`): React component that receives full `AppSettings` from parent. Manages local `value` state initialized from `settings.sonioxApiKey`. Uses `type="password"` input with Show/Hide toggle. On save, calls `onSettingChange('sonioxApiKey', value)` which triggers `settingsApi.setSetting()`.

**Key constraint**: The full plaintext API key currently flows through all layers — it's stored as plain text in `settings.json`, sent over IPC as plain text, and held in React state as plain text. The current `type="password"` input only provides visual masking while focused/typing, but the full key value is always accessible in the DOM and component state.

**Storage security**: `electron-store` v8.2.0 supports an `encryptionKey` option for obfuscation, but the app does not use it. Electron 33+ provides `safeStorage` API for OS-level encryption (DPAPI on Windows, Keychain on macOS, Secret Service on Linux).
