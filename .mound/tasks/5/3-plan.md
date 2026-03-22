# Plan

## Goal

Implement the system tray icon and right-click context menu with Show/Hide, Settings, and Quit actions.

## Steps

### 1. Implement `src/main/tray.ts`

Replace the stub with the tray manager implementation. The icon is embedded as a base64-encoded PNG buffer to avoid filesystem/packaging dependencies.

**Module structure** (follows existing patterns in `window.ts`):
- Module-level variable: `let tray: Tray | null = null;`
- Constant: `TRAY_ICON_BASE64` — a minimal 16x16 PNG encoded as base64
- `createTrayIcon(): NativeImage` — creates a `nativeImage` from the embedded base64 buffer
- `initTray(): void` — creates the `Tray` instance and sets the context menu
- `destroyTray(): void` — destroys the tray (for cleanup/testing)

**`initTray()` implementation:**
1. If `tray` already exists and is not destroyed, destroy it first (idempotent re-init for testing)
2. Create icon: `const icon = createTrayIcon()`
3. Create `tray = new Tray(icon)`
4. Set tooltip: `tray.setToolTip('Stex')`
5. Build context menu via `Menu.buildFromTemplate([...])`:
   - `{ label: 'Show/Hide', click: () => toggleOverlay() }`
   - `{ label: 'Settings', click: () => showSettings() }`
   - `{ type: 'separator' }`
   - `{ label: 'Quit', click: () => app.quit() }`
6. Set the context menu: `tray.setContextMenu(menu)`

**Imports**: `Tray`, `Menu`, `nativeImage`, `app` from `electron`; `toggleOverlay`, `showSettings` from `./window`

**Files**: `src/main/tray.ts` (edit)

### 2. Wire tray init into app entry point

In `src/main/index.ts`, import `initTray` from `./tray` and call it inside the `app.whenReady().then(...)` callback, after `initWindowManager()` (tray depends on window manager being initialized first since it calls window functions).

Update the comment about "Tray Manager (future task)" to reflect that it's now implemented.

**Files**: `src/main/index.ts` (edit)

### 3. Write tests for `src/main/tray.test.ts`

Follow the mocking pattern from `window.test.ts`:
- Use `vi.hoisted()` to create mock tracking variables
- Mock `electron` module: provide `Tray` class mock, `Menu.buildFromTemplate` mock, `nativeImage.createFromBuffer` mock, `app.quit` mock
- Mock `./window` module: provide `toggleOverlay` and `showSettings` as `vi.fn()`
- Test cases:
  - `initTray()` creates a Tray instance
  - Tray is created with a NativeImage (returned by `nativeImage.createFromBuffer`)
  - Tooltip is set to 'Stex'
  - Context menu has 4 items (Show/Hide, Settings, separator, Quit)
  - Show/Hide menu click calls `toggleOverlay()`
  - Settings menu click calls `showSettings()`
  - Quit menu click calls `app.quit()`
  - `destroyTray()` destroys the tray and sets it to null
  - Calling `initTray()` twice destroys the first tray before creating new one

**Files**: `src/main/tray.test.ts` (new)

## Risks / Open Questions

- **Placeholder icon quality**: The embedded base64 PNG is a minimal placeholder. A proper branded icon should be created in a future design task.
- **Review issue: index.ts integration test**: The plan review suggested adding integration tests for `index.ts` startup wiring. This is out of scope for this task — `index.ts` is a thin orchestration file and the individual modules have their own tests. The wiring change is two lines and can be verified by reading the code.
