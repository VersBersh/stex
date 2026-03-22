# T23 Context

## Relevant Files

- `src/main/settings.ts` — Settings Store module; defines `resolveSonioxApiKey`, `getSettings()`, `setSetting()`, `registerSettingsIpc()`, and `APP_SETTINGS_DEFAULTS`
- `src/main/settings.test.ts` — Unit tests for the settings module including resolveSonioxApiKey, getSettings env var integration, setSetting, and IPC handlers
- `src/shared/types.ts` — Defines `AppSettings` interface with `sonioxApiKey: string` field
- `src/shared/ipc.ts` — IPC channel constants including SETTINGS_GET, SETTINGS_SET, SETTINGS_UPDATED

## Architecture

The Settings Store (`src/main/settings.ts`) uses `electron-store` to persist `AppSettings` to disk. The module-level `store` instance is created with `APP_SETTINGS_DEFAULTS`. Key components:

1. **`resolveSonioxApiKey(savedValue)`** — Pure function that resolves the effective API key: non-empty saved value wins, else falls back to `process.env.SONIOX_API_KEY`, else returns `""`. Originally added by T20.

2. **`getSettings()`** — Reads all known keys from the store into a plain object, then applies `resolveSonioxApiKey` to `result.sonioxApiKey` before returning. The resolved value is only in the returned object — never written back to the store.

3. **`setSetting(key, value)`** — Writes a single setting to the store (persists to disk).

4. **`registerSettingsIpc()`** — Registers IPC handlers so renderers can get/set settings and receive broadcasts on change.

The integration point (line 45) already calls `resolveSonioxApiKey(result.sonioxApiKey)` in `getSettings()`, and existing tests already verify all four acceptance criteria from the task description.
