# Context

## Relevant Files

- `src/main/window.test.ts` — The 420-line test file to be split. Contains tests for: window construction, positioning, opacity, close interception, settings window, show/hide/toggle overlay.
- `src/main/window.ts` — The production module under test. Exports `initWindowManager`, `showOverlay`, `hideOverlay`, `toggleOverlay`, `showSettings`, `getOverlayWindow`, `getValidatedPosition`.
- `src/main/settings.ts` — Settings module mocked in the tests (`getSettings`, `setSetting`).
- `vitest.config.ts` — Test config, uses `include: ['src/**/*.test.ts']` pattern — any `.test.ts` file in `src/` will be picked up automatically.
- `src/main/audio.test.ts` — Example of existing test convention: uses `vi.hoisted()` for mock state, `vi.mock()` for module mocking, `describe/it/expect/beforeEach` from vitest.
- `src/main/hotkey.test.ts` — Another test convention example with same pattern.

## Architecture

The window manager (`window.ts`) is the main-process module responsible for creating and managing the overlay and settings `BrowserWindow` instances in this Electron app. It handles:

1. **Window construction** — Creates the overlay window with specific options (frameless, always-on-top, skip-taskbar, preload script, min/max sizes).
2. **Position validation** — Validates saved window position against connected displays before restoring.
3. **Show/hide/toggle** — Controls overlay visibility with fade-in animation, position/size restoration, and settings persistence on hide.
4. **Opacity on focus/blur** — Sets window opacity to 1.0 on focus, 0.95 on blur.
5. **Close interception** — Converts window close to hide unless the app is quitting.
6. **Settings window** — Separate framed BrowserWindow for settings, singleton pattern.

The test file mocks Electron (`BrowserWindow`, `screen`, `app`, `ipcMain`) and the settings module entirely. All tests share the same mock setup at the top of the file via `vi.hoisted()` and `vi.mock()`.

Key constraint: `vi.mock()` and `vi.hoisted()` calls are module-scoped and must appear at the top of each test file. When splitting, each new file needs its own mock declarations.
