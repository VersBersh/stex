# Plan for Task 30: Wire session lifecycle to overlay show/hide

## Goal

Route the `WINDOW_HIDE` IPC handler through the Session Manager's `closeRequestHandler` callback so that hiding the overlay from the renderer triggers session finalization and clipboard copy, not just raw window hide.

## Steps

### 1. Modify `WINDOW_HIDE` IPC handler in `window.ts` (lines 149-152)

Change the handler from directly calling `hideOverlay()` to using `closeRequestHandler` (falling back to `hideOverlay()` if no handler is set), matching the pattern already used by the close event handler (lines 97-106).

**Before:**
```ts
ipcMain.on(IpcChannels.WINDOW_HIDE, () => {
  hideOverlay();
});
```

**After:**
```ts
ipcMain.on(IpcChannels.WINDOW_HIDE, () => {
  if (closeRequestHandler) {
    closeRequestHandler();
  } else {
    hideOverlay();
  }
});
```

This ensures that when the renderer sends `WINDOW_HIDE` (via `window.electronAPI.hideWindow()`), the request routes through `requestToggle()` → `stopSession()` → finalize + clipboard + hideOverlay, matching the hotkey and tray code paths.

**Dependency**: None. The `closeRequestHandler` is already set by `initSessionManager()` (via `setOverlayCloseHandler`), and `initSessionManager()` is called before the WINDOW_HIDE handler fires in production.

### 2. Add tests for WINDOW_HIDE IPC routing in `window-behavior.test.ts`

Import `setOverlayCloseHandler` from `./window`.

**Test A — handler set**: After `initWindowManager()` + `showOverlay()`, set a mock handler via `setOverlayCloseHandler(mockHandler)`, fire the WINDOW_HIDE IPC handler from `mockIpcMainHandlers`, assert `mockHandler` was called and the window is still visible (not hidden directly).

**Test B — fallback**: After `initWindowManager()` + `showOverlay()`, call `setOverlayCloseHandler(null as unknown as () => void)` to explicitly clear the handler (working around the fact that `initWindowManager` doesn't reset it), then fire the WINDOW_HIDE IPC handler, assert the window is hidden (fallback to `hideOverlay()`).

This addresses the test isolation concern: we explicitly set/clear `closeRequestHandler` before each test case rather than relying on module state.

### 3. Update `spec/architecture.md` IPC table (line 128)

Change:
```
| Renderer → Main | `window:hide` | — | Hide the overlay window (title bar button or Escape key) |
```

To:
```
| Renderer → Main | `window:hide` | — | Request overlay dismiss — routes through Session Manager for finalization before hiding (title bar button or Escape key) |
```

## Risks / Open Questions

- **`toggleOverlay()` bypasses session lifecycle**: `toggleOverlay()` still calls `hideOverlay()` directly. This is intentional — it's a Window Manager primitive not used in production (hotkey and tray both use `requestToggle()`). Modifying only the hide half would create an asymmetric API. If a future feature needs lifecycle-aware toggle, it should call `requestToggle()`. Noted as a discovered task.
- **Race condition**: If `WINDOW_HIDE` fires before `initSessionManager()` sets the handler, the fallback to `hideOverlay()` is safe (no session to finalize yet).
- **No circular dependency risk**: `window.ts` does not import from `session.ts`. The callback pattern via `setOverlayCloseHandler` avoids this.
