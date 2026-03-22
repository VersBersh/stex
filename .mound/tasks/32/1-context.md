# Context

## Relevant Files

- `src/main/index.ts` — Contains `initApp()` with first-run detection logic (line 20-23). Checks `settings.sonioxApiKey` from `getSettings()` and opens settings window if empty.
- `src/main/settings.ts` — Settings store. `getSettings()` (line 40-47) calls `resolveSonioxApiKey()` to resolve the effective API key. `resolveSonioxApiKey()` (line 12-17) checks saved value first, then falls back to `SONIOX_API_KEY` env var.
- `src/main/first-run.test.ts` — Tests for first-run experience in `initApp()`. Mocks `getSettings` to return controlled data. Currently tests empty key and present key, but does not explicitly test the env var fallback scenario.
- `src/main/settings.test.ts` — Tests for settings module including `resolveSonioxApiKey`, `getSettings` env var integration, and IPC handlers.
- `spec/features/system-tray.md` — Spec defining first-run behavior (line 18: "no API key configured" triggers first-run setup).

## Architecture

The first-run detection subsystem works as follows:

1. `initApp()` in `index.ts` calls `getSettings()` to get the effective settings.
2. `getSettings()` reads raw values from `electron-store`, then resolves `sonioxApiKey` via `resolveSonioxApiKey(savedValue)` which checks the saved value first and falls back to `SONIOX_API_KEY` env var.
3. If the resolved `sonioxApiKey` is empty (falsy), `showSettings()` is called to open the settings window for API key entry.
4. All other initialization (tray, hotkey, audio, theme, session, window managers) runs regardless of API key state.

Key constraint: The first-run check must use the **resolved** API key (including env var fallback), not just the persisted value from `electron-store`. This is already the case in the code because `getSettings()` applies `resolveSonioxApiKey()`, but the first-run test suite does not explicitly document/verify the env var scenario.
