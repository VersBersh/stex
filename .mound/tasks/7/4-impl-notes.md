# Implementation Notes

## Files created
- `src/main/preload.ts` — Preload script exposing `electronAPI` via `contextBridge`
- `src/renderer/types.d.ts` — TypeScript declarations for `*.css` imports and `window.electronAPI`
- `src/renderer/overlay/overlay.css` — Global styles for overlay layout (title bar, editor, status bar)
- `src/renderer/overlay/components/TitleBar.tsx` — Custom frameless title bar with drag region and hide button
- `src/renderer/overlay/components/StatusBar.tsx` — Status bar with mic state, pause/resume, clear, copy buttons
- `src/renderer/overlay/editor/Editor.tsx` — Lexical editor wrapper with RichTextPlugin, HistoryPlugin, and EditorBridge
- `src/renderer/overlay/OverlayContext.tsx` — Shared React context for editor operations, clear confirmation, and pause state

## Files modified
- `src/renderer/overlay/index.tsx` — Replaced scaffold with full App layout (TitleBar + Editor + StatusBar wrapped in OverlayProvider)
- `src/main/window.ts` — Added `ipcMain` import, preload path in overlay webPreferences, `window:hide` IPC handler
- `src/shared/ipc.ts` — Added `WINDOW_HIDE` channel constant
- `webpack.main.config.js` — Changed to multi-entry (`index` + `preload`) with `[name].js` output filename
- `spec/architecture.md` — Added `window:hide` IPC channel and `preload.ts` to file structure

## Deviations from plan
- Used `&#x2715;` (Unicode cross mark) for the hide button instead of "X" text for better visual appearance
- Used `&#x1F3A4;` (Unicode microphone) for mic icon instead of emoji literal, to avoid encoding issues
- Keyboard shortcuts registered in `OverlayContext` provider's `useEffect` rather than a separate component, keeping all shared state together

## Post-review fixes applied
- Added `AutoFocusPlugin` to Editor so the Lexical editor receives focus immediately on mount
- Added empty-editor check to `requestClear()` — skips confirmation when there's no text (per spec)
- Used `IpcChannels` constants in `preload.ts` and `window.ts` instead of raw strings
- Made IPC handler registration idempotent via `ipcMain.removeAllListeners()` before re-registering
- Renamed `paused` state to `pauseRequested` to honestly reflect it's an optimistic UI flag, not authoritative session state
- Added `removeAllListeners` to `ipcMain` mock in `window.test.ts`

## New tasks or follow-up work
- **IPC: Add preload bridge for settings window** — The settings window also has `contextIsolation: true` but no preload script. When settings UI needs IPC, it will need its own preload.
- **UI: Add ipcMain mock to window.test.ts** — The existing window tests don't mock `ipcMain`. Adding `ipcMain.on('window:hide')` in `initWindowManager()` may cause test issues. The mock should be updated.
- **UI: Theme support** — The CSS is currently light-theme only. Dark theme support per spec/ui.md needs to be added.
- **UI: Opacity/focus behavior** — The overlay should be 95% opacity when unfocused. This is handled by window.ts but the CSS doesn't account for any visual cues.
