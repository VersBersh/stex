# Implementation Notes for T4: Window Manager

## Files Created or Modified

| File | Changes |
|------|---------|
| `src/main/window.ts` | **Rewritten** — replaced stub with full Window Manager: `initWindowManager()`, `showOverlay()`, `hideOverlay()`, `toggleOverlay()`, `showSettings()`, `getOverlayWindow()`, `getValidatedPosition()`. Includes close interception, focus/blur opacity (suppressed during fade), debounced move/resize persistence, cancellable fade-in animation, and proper centering when saved position is invalid. |
| `src/main/index.ts` | **Modified** — updated import from `createOverlayWindow` to `initWindowManager`, replaced `window-all-closed` quit handler with empty handler (tray-resident behavior). |
| `src/main/window.test.ts` | **Created** — 31 tests covering all Window Manager functionality. |

## Deviations from Plan

1. **Fade animation**: Added `isFading` flag and `fadeAnimationId` token to suppress focus/blur opacity during fade-in and cancel stale animations. This was identified during code review — the original plan didn't account for the interaction between fade timers and focus/blur handlers.
2. **Position centering**: `showOverlay()` now calls `overlayWindow.center()` when saved position is invalid instead of using partial `setBounds()`. This was identified during code review — the original approach didn't actually reposition the window.
3. **`window-all-closed`**: Added an empty `window-all-closed` handler to prevent Electron from quitting when all windows are hidden. The original plan only removed the quit handler; the empty handler ensures tray-resident behavior.

## New Tasks or Follow-Up Work

1. **Preload scripts**: Both windows need preload scripts for renderer IPC bridge (`contextBridge.exposeInMainWorld()`).
2. **Session lifecycle integration**: `showOverlay()`/`hideOverlay()` only manage visibility. The Session Manager must wire in audio/WebSocket start/stop and clipboard copy.
