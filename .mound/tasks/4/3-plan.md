# Plan for T4: Window Manager

## Goal

Implement `src/main/window.ts` as a complete Window Manager module that creates and manages an overlay BrowserWindow (frameless, always-on-top, skip-taskbar, position-persisted, opacity-animated) and a settings BrowserWindow (standard framed), exposing `initWindowManager()`, `showOverlay()`, `hideOverlay()`, `toggleOverlay()`, `showSettings()`, and `getOverlayWindow()`.

## Scope Boundary

T4 covers **window visibility and persistence only**. Session lifecycle integration (transcription start/stop, clipboard copy on hide, audio/WebSocket management) is handled by downstream tasks (Session Manager, Hotkey Manager, Tray Manager). The `showOverlay()`/`hideOverlay()` functions manage window state; other modules will call them and add session behavior on top.

## Steps

### 1. Rewrite `src/main/window.ts` — `initWindowManager()`

Replace the existing stub entirely. Add an exported `initWindowManager()` function that eagerly creates the overlay window (hidden) at startup. This satisfies the system-tray spec requirement that "main window is created but hidden" for instant activation.

Internal helper `createOverlayWindowInternal()` creates the overlay `BrowserWindow`:

```ts
{
  width: settings.windowSize.width,   // from AppSettings, default 600
  height: settings.windowSize.height,  // default 300
  minWidth: 400,
  minHeight: 200,
  x: validatedPosition?.x,
  y: validatedPosition?.y,
  frame: false,
  transparent: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  show: false,                // created hidden
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
  },
}
```

Load `path.join(__dirname, '../renderer/overlay/index.html')`.

### 2. Intercept overlay `close` event

Attach a `'close'` handler on the overlay window that prevents destruction by converting close to hide:

```ts
let isAppQuitting = false;

overlayWindow.on('close', (e) => {
  if (!isAppQuitting) {
    e.preventDefault();
    hideOverlay();
  }
});

app.on('before-quit', () => {
  isAppQuitting = true;
});
```

This ensures the overlay is never destroyed during normal operation — only when the app is explicitly quitting.

### 3. Implement position validation — `getValidatedPosition()`

Write a helper function `getValidatedPosition(settings: AppSettings): { x: number; y: number } | undefined` that:

1. Reads `settings.windowPosition` and `settings.windowSize`
2. If `windowPosition` is `null`, returns `undefined` (Electron will center the window)
3. Uses `electron.screen.getAllDisplays()` to get all connected displays
4. Checks if the saved position places the window within the bounds of any display (the window's rectangle must intersect with at least one display's work area)
5. If valid, returns `{ x, y }`
6. If invalid (monitor disconnected), returns `undefined` so Electron centers the window on the primary display

### 4. Implement `showOverlay()`

```ts
export function showOverlay(): void
```

1. Read saved position/size from settings, validate with `getValidatedPosition()`
2. Set window bounds to saved size + validated position (or let Electron center if invalid)
3. Implement fade-in: set opacity to 0, show window, animate opacity from 0 to 1.0 over ~100ms using a small `setTimeout` chain
4. Focus the window after show

### 5. Implement `hideOverlay()`

```ts
export function hideOverlay(): void
```

1. If overlay window doesn't exist or isn't visible, return early
2. Save current position and size to Settings Store via `setSetting('windowPosition', ...)` and `setSetting('windowSize', ...)`
3. Hide the window instantly (no animation per spec)

Note: This function handles **window visibility only**. Session-side behavior (transcription finalization, clipboard copy, audio/WS teardown) will be orchestrated by the Session Manager which wraps these calls.

### 6. Implement `toggleOverlay()`

```ts
export function toggleOverlay(): void
```

Calls `showOverlay()` if overlay is hidden, or `hideOverlay()` if visible.

### 7. Implement opacity on focus/blur

Attach event listeners to the overlay window in `createOverlayWindowInternal()`:
- `'focus'` → `overlayWindow.setOpacity(1.0)`
- `'blur'` → `overlayWindow.setOpacity(0.95)`

### 8. Implement position/size persistence on move/resize

Attach event listeners to the overlay window in `createOverlayWindowInternal()`:
- `'move'` → debounce (300ms), then save position via `setSetting('windowPosition', { x, y })`
- `'resize'` → debounce (300ms), then save size via `setSetting('windowSize', { width, height })`

Use a simple inline debounce (`setTimeout`/`clearTimeout` pattern).

### 9. Implement settings window — `showSettings()`

```ts
export function showSettings(): void
```

1. If settings window already exists and is not destroyed, focus it and return
2. If it doesn't exist, create a standard `BrowserWindow` (reasonable defaults — implementation detail, not spec'd):
   ```ts
   {
     width: 600,
     height: 500,
     frame: true,
     skipTaskbar: false,
     webPreferences: {
       nodeIntegration: false,
       contextIsolation: true,
     },
   }
   ```
3. Load `path.join(__dirname, '../renderer/settings/index.html')`
4. On `'closed'`, set the reference to `null`
5. Show and focus the window

### 10. Implement `getOverlayWindow()`

```ts
export function getOverlayWindow(): BrowserWindow | null
```

Returns the overlay `BrowserWindow` instance or `null` if not created.

### 11. Update `src/main/index.ts`

Update the import and startup call:

```ts
import { initWindowManager } from './window';

app.whenReady().then(() => {
  registerSettingsIpc();
  initWindowManager(); // creates overlay hidden, ready for instant show
});
```

Remove the `window-all-closed` → `app.quit()` handler since the app is tray-resident and should not quit when windows are hidden.

### 12. Write tests — `src/main/window.test.ts`

Follow the pattern from `settings.test.ts`:
- Mock `electron` (`BrowserWindow`, `screen`, `app`)
- Mock `./settings` module (`getSettings`, `setSetting`)
- Test `initWindowManager()` creates overlay with correct options
- Test position validation with various display configurations
- Test show/hide/toggle flow
- Test opacity changes on focus/blur events
- Test position persistence on move/resize
- Test close-to-hide interception
- Test settings window creation
- Test `getOverlayWindow()` returns the instance

## Risks / Open Questions

1. **Fade-in animation**: Using `setOpacity()` with `setTimeout` from the main process may not be perfectly smooth. An alternative is CSS opacity transition in the renderer. For this implementation, we'll use `setOpacity()` with `setTimeout` since it's simpler and ~100ms is just 2-3 frames.

2. **Display validation edge case**: `screen.getAllDisplays()` requires the `app` to be ready. Since `initWindowManager()` is only called after `app.whenReady()`, this is safe.

3. **Settings window dimensions**: The settings window size (600x500) is an implementation detail — no spec defines it. It's a reasonable default that can be adjusted later.

4. **Session lifecycle integration**: T4 does not implement session start/stop, clipboard copy, or audio management on show/hide. Those responsibilities belong to downstream tasks (Session Manager, Hotkey Manager). The Window Manager provides the visibility primitives that those modules will orchestrate.

5. **`window-all-closed` removal**: Removing the quit-on-close handler from `index.ts` is correct for a tray-resident app. The Tray Manager (future task) will handle explicit quit via tray menu.
