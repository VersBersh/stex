# Context for Task 30: Wire session lifecycle to overlay show/hide

## Relevant Files

| File | Role |
|------|------|
| `src/main/session.ts` | Session Manager — orchestrates start/stop/pause/resume lifecycle, owns `requestToggle()` which already wires show→startSession and hide→stopSession |
| `src/main/window.ts` | Window Manager — creates overlay/settings BrowserWindows, exports `showOverlay()`, `hideOverlay()`, `toggleOverlay()`, `setOverlayCloseHandler()` |
| `src/main/hotkey.ts` | Hotkey Manager — registers global shortcut, calls `requestToggle()` from session.ts on press |
| `src/main/tray.ts` | Tray Manager — system tray icon/menu, Show/Hide calls `requestToggle()` from session.ts |
| `src/main/audio.ts` | Audio Capture — `startCapture()`/`stopCapture()` using naudiodon/PortAudio |
| `src/main/soniox.ts` | Soniox WebSocket Client — manages WS connection, sends audio, receives tokens |
| `src/main/index.ts` | App entry — initializes all managers in order |
| `src/main/preload.ts` | Preload script — exposes `hideWindow()` which sends `WINDOW_HIDE` IPC |
| `src/shared/ipc.ts` | IPC channel constants |
| `src/shared/types.ts` | Shared types (SessionState, AppSettings, SonioxToken, etc.) |
| `src/main/session.test.ts` | Session Manager tests — comprehensive coverage of lifecycle |
| `src/main/window-visibility.test.ts` | Window visibility tests — tests for showOverlay, hideOverlay, toggleOverlay |
| `src/main/window-behavior.test.ts` | Window behavior tests — close interception, focus/blur opacity |
| `src/main/tray.test.ts` | Tray tests — verifies Show/Hide calls `requestToggle()` |
| `src/main/hotkey.test.ts` | Hotkey tests — verifies hotkey callback calls `requestToggle()` |
| `spec/features/system-tray.md` | Spec — defines that show triggers session start, hide triggers finalization + clipboard copy |
| `spec/architecture.md` | Architecture — Session Manager orchestrates lifecycle, Window Manager manages visibility |

## Architecture

The app has a **main process** with distinct managers:

- **Window Manager** (`window.ts`): Creates/manages BrowserWindows. `showOverlay()`/`hideOverlay()` handle pure window visibility (positioning, fade animation, persistence). Exposes `setOverlayCloseHandler()` to let external code intercept close events.

- **Session Manager** (`session.ts`): Orchestrates session lifecycle. `requestToggle()` is the central entry point — when window is hidden it calls `showOverlay()` + `startSession()`; when visible it calls `stopSession()` (which finalizes, clipboard-copies, then calls `hideOverlay()`). The close handler is wired via `setOverlayCloseHandler(() => requestToggle())`.

- **Hotkey Manager** (`hotkey.ts`) and **Tray Manager** (`tray.ts`): Both correctly call `requestToggle()` from session.ts.

**The gap**: Two code paths in `window.ts` bypass the Session Manager:
1. The `WINDOW_HIDE` IPC handler (`ipcMain.on(IpcChannels.WINDOW_HIDE, () => { hideOverlay(); })`) — triggered by the renderer's `hideWindow()` call — goes directly to `hideOverlay()`, skipping session finalization.
2. `toggleOverlay()` calls `showOverlay()`/`hideOverlay()` directly without session lifecycle. (Not used in production code, but exported.)

The dependency direction is: `session.ts` → `window.ts` (no reverse import). The `setOverlayCloseHandler` callback pattern avoids circular dependencies.
