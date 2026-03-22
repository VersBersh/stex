# Context

## Relevant Files

- `src/main/window.ts` — Window manager module containing `createOverlayWindowInternal()`, which creates the overlay `BrowserWindow` using settings for size/position.
- `src/main/settings.ts` — Settings store providing `getSettings()` and `APP_SETTINGS_DEFAULTS` (which includes `windowSize: { width: 600, height: 300 }`).
- `src/main/window.test.ts` — Tests for the window manager, including a test that verifies persisted window dimensions are used on creation.
- `src/main/settings.test.ts` — Tests for the settings store.

## Architecture

The overlay window is created by `createOverlayWindowInternal()` in `window.ts`. It reads the current settings via `getSettings()` from `settings.ts` and uses `settings.windowSize.width` and `settings.windowSize.height` for the `BrowserWindow` constructor options. The settings store uses `electron-store` with `APP_SETTINGS_DEFAULTS` as fallback defaults, so when no persisted value exists, the default `{ width: 600, height: 300 }` is used automatically.

## Key Finding

**This task is already complete.** T4 (Window Manager) implemented all the changes described in this task:
- `createOverlayWindowInternal()` reads `width`/`height` from `getSettings().windowSize` (lines 50-51)
- Fallback to `APP_SETTINGS_DEFAULTS` is handled by `electron-store` defaults
- No hard-coded `600x300` exists in `window.ts`
- Test "creates overlay with saved size from settings" (line 179) verifies persisted dimensions
