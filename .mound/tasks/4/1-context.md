# Context for T4: Window Manager

## Relevant Files

| File | Role |
|------|------|
| `src/main/window.ts` | **Target file** — currently a minimal stub with `createOverlayWindow()` that creates a basic BrowserWindow. Must be rewritten to implement full Window Manager. |
| `src/main/index.ts` | Electron main entry — calls `createOverlayWindow()` and `registerSettingsIpc()` on app ready. Will need to be updated to use the new Window Manager API. |
| `src/main/settings.ts` | Settings Store — provides `getSettings()`, `setSetting()`, and `registerSettingsIpc()`. Window Manager will read/write `windowPosition` and `windowSize` via this module. |
| `src/shared/types.ts` | Defines `AppSettings` interface including `windowPosition: { x: number; y: number } | null` and `windowSize: { width: number; height: number }`. |
| `src/shared/ipc.ts` | IPC channel name constants. No window-specific channels currently defined. |
| `src/main/settings.test.ts` | Existing test file — demonstrates project test patterns: vitest, `vi.hoisted()` for mock setup, `vi.mock()` for electron and electron-store, describe/it structure. |
| `src/renderer/overlay/index.html` | Overlay renderer HTML loaded by the overlay BrowserWindow. |
| `src/renderer/settings/index.html` | Settings renderer HTML loaded by the settings BrowserWindow. |
| `src/main/tray.ts` | Tray Manager stub — currently empty (`export {}`). Will eventually call Window Manager functions. |
| `src/main/hotkey.ts` | Hotkey Manager stub — currently empty. Will eventually call `toggleOverlay()`. |
| `spec/ui.md` | UI spec — defines window dimensions (600x300 default, 400x200 min), opacity (100% focused, 95% blurred), animations (100ms fade-in, instant hide), position persistence. |
| `spec/architecture.md` | Architecture spec — defines Window Manager responsibilities, file structure, and component interactions. |
| `spec/features/system-tray.md` | System tray spec — defines show/hide behavior, position persistence, and hotkey integration. |

## Architecture

The Window Manager is a main-process module (`src/main/window.ts`) responsible for creating and managing two Electron `BrowserWindow` instances:

1. **Overlay window** — frameless, always-on-top, skip-taskbar. This is the primary transcription UI. It uses show/hide semantics (not create/destroy) for instant activation. Position and size are persisted to `AppSettings` via the Settings Store.

2. **Settings window** — standard framed window opened from the tray menu or programmatically. Single instance.

Key constraints:
- Windows are created once and shown/hidden, never destroyed and recreated (performance requirement from spec: <50ms show time)
- Position persistence must validate against connected displays (user may disconnect monitors)
- Opacity must change on focus/blur (100% focused, 95% blurred)
- Fade-in animation on show (~100ms), instant hide
- The module exports a clean public API: `showOverlay()`, `hideOverlay()`, `toggleOverlay()`, `showSettings()`, `getOverlayWindow()`
- Settings Store already has `windowPosition` and `windowSize` fields in `AppSettings`
- The existing `createOverlayWindow()` in `window.ts` is a basic scaffold from T1 that must be replaced
